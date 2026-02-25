import type { SaveData } from '../types';
import { gameState } from './GameStateManager';
import { SAVE_VERSION, MAX_SAVE_SLOTS } from '../utils/constants';

/**
 * Per-hero save system.
 * V2 key format: rpg_v2_HERONAME_N (slot 0-2) or rpg_v2_HERONAME_auto
 * Legacy keys (rpg_save_N, rpg_autosave) are read for backward compatibility.
 */
const V2_PREFIX = 'rpg_v2_';
const LEGACY_SAVE_PREFIX = 'rpg_save_';
const LEGACY_AUTO_KEY = 'rpg_autosave';

export interface SaveEntry {
  heroName: string;
  slot: number; // -1 for autosave
  level: number;
  region: string;
  playTime: string;
  timestamp: number;
  storageKey: string; // actual localStorage key for loading
  gameCompleted: boolean;
}

export class SaveLoadSystem {

  private static getKey(heroName: string, slot: number): string {
    return slot === -1
      ? `${V2_PREFIX}${heroName}_auto`
      : `${V2_PREFIX}${heroName}_${slot}`;
  }

  private static buildSaveData(slot: number): SaveData {
    gameState.updatePlayTime();
    const state = gameState.getState();
    return {
      version: SAVE_VERSION,
      slot,
      heroName: state.heroName,
      hero: structuredClone(state.hero),
      party: [...state.party],
      companions: structuredClone(state.companions),
      inventory: structuredClone(state.inventory),
      gold: state.gold,
      flags: { ...state.flags },
      currentRegion: state.currentRegion,
      currentScene: state.currentScene,
      questStates: { ...state.questStates },
      questProgress: structuredClone(state.questProgress),
      liberatedRegions: [...state.liberatedRegions],
      visitedRegions: [...state.visitedRegions],
      playTime: state.playTime,
      difficulty: state.difficulty,
      timestamp: Date.now(),
      gameCompleted: state.gameCompleted,
    };
  }

  static save(slot: number): boolean {
    if (slot < 0 || slot >= MAX_SAVE_SLOTS) return false;
    const heroName = gameState.getState().heroName;
    if (!heroName) return false;
    try {
      const data = this.buildSaveData(slot);
      localStorage.setItem(this.getKey(heroName, slot), JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  static autoSave(): boolean {
    const heroName = gameState.getState().heroName;
    if (!heroName) return false;
    try {
      const data = this.buildSaveData(-1);
      localStorage.setItem(this.getKey(heroName, -1), JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  /** Load a save by its storage key (from getAllSaves) */
  static loadByKey(storageKey: string): boolean {
    return this.loadFromKey(storageKey);
  }

  /** Load a save for a specific hero and slot */
  static load(heroName: string, slot: number): boolean {
    return this.loadFromKey(this.getKey(heroName, slot));
  }

  private static loadFromKey(key: string): boolean {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const data: SaveData = JSON.parse(raw);
      if (data.version !== SAVE_VERSION) return false;
      gameState.loadState({
        heroName: data.heroName,
        hero: data.hero,
        party: data.party,
        companions: data.companions,
        inventory: data.inventory,
        gold: data.gold,
        flags: data.flags,
        currentRegion: data.currentRegion,
        currentScene: data.currentScene,
        questStates: data.questStates,
        questProgress: data.questProgress,
        liberatedRegions: data.liberatedRegions,
        visitedRegions: data.visitedRegions,
        playTime: data.playTime,
        difficulty: data.difficulty,
        encounterSteps: 0,
        gameCompleted: data.gameCompleted ?? false,
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Get save info for the current hero's slot */
  static getSaveInfo(slot: number): { exists: boolean; heroName?: string; level?: number; region?: string; playTime?: string; timestamp?: number; gameCompleted?: boolean } {
    const heroName = gameState.getState().heroName;
    if (!heroName) return { exists: false };
    const key = this.getKey(heroName, slot);
    return this.parseSaveInfoFromKey(key);
  }

  private static parseSaveInfoFromKey(key: string): { exists: boolean; heroName?: string; level?: number; region?: string; playTime?: string; timestamp?: number; gameCompleted?: boolean } {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { exists: false };
      const data: SaveData = JSON.parse(raw);
      if (data.version !== SAVE_VERSION) return { exists: false };
      const total = Math.floor(data.playTime);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      return {
        exists: true,
        heroName: data.heroName,
        level: data.hero.level,
        region: data.currentRegion,
        playTime: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
        timestamp: data.timestamp,
        gameCompleted: data.gameCompleted ?? false,
      };
    } catch {
      return { exists: false };
    }
  }

  static deleteSave(slot: number): void {
    const heroName = gameState.getState().heroName;
    if (!heroName) return;
    localStorage.removeItem(this.getKey(heroName, slot));
  }

  /** Delete a save by its localStorage key (used from title screen where heroName isn't set) */
  static deleteByKey(storageKey: string): void {
    localStorage.removeItem(storageKey);
  }

  /** Get all save entries across all heroes (including legacy saves) */
  static getAllSaves(): SaveEntry[] {
    const saves: SaveEntry[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // V2 format: rpg_v2_HERONAME_N or rpg_v2_HERONAME_auto
      if (key.startsWith(V2_PREFIX)) {
        const rest = key.slice(V2_PREFIX.length);
        let heroName: string;
        let slot: number;
        if (rest.endsWith('_auto')) {
          heroName = rest.slice(0, -5);
          slot = -1;
        } else {
          const lastUnderscore = rest.lastIndexOf('_');
          if (lastUnderscore === -1) continue;
          heroName = rest.slice(0, lastUnderscore);
          slot = parseInt(rest.slice(lastUnderscore + 1));
          if (isNaN(slot)) continue;
        }
        const entry = this.parseSaveEntry(key, heroName, slot);
        if (entry) saves.push(entry);
        continue;
      }

      // Legacy format: rpg_save_N
      const legacyMatch = key.match(/^rpg_save_(\d+)$/);
      if (legacyMatch) {
        const entry = this.parseSaveEntry(key, '', parseInt(legacyMatch[1]));
        if (entry) saves.push(entry);
        continue;
      }

      // Legacy autosave
      if (key === LEGACY_AUTO_KEY) {
        const entry = this.parseSaveEntry(key, '', -1);
        if (entry) saves.push(entry);
      }
    }
    return saves;
  }

  private static parseSaveEntry(storageKey: string, fallbackHeroName: string, slot: number): SaveEntry | null {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const data: SaveData = JSON.parse(raw);
      if (data.version !== SAVE_VERSION) return null;
      const total = Math.floor(data.playTime);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      return {
        heroName: data.heroName || fallbackHeroName,
        slot,
        level: data.hero.level,
        region: data.currentRegion,
        playTime: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
        timestamp: data.timestamp ?? 0,
        storageKey,
        gameCompleted: data.gameCompleted ?? false,
      };
    } catch {
      return null;
    }
  }

  static hasSaves(): boolean {
    return this.getAllSaves().length > 0;
  }
}
