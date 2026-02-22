import type { SaveData } from '../types';
import { gameState } from './GameStateManager';
import { SAVE_VERSION, MAX_SAVE_SLOTS } from '../utils/constants';

const SAVE_KEY_PREFIX = 'rpg_save_';
const AUTO_SAVE_KEY = 'rpg_autosave';

export class SaveLoadSystem {
  static save(slot: number): boolean {
    if (slot < 0 || slot >= MAX_SAVE_SLOTS) return false;
    gameState.updatePlayTime();
    const state = gameState.getState();
    const data: SaveData = {
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
    };
    try {
      localStorage.setItem(SAVE_KEY_PREFIX + slot, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  static load(slot: number): boolean {
    const key = slot === -1 ? AUTO_SAVE_KEY : SAVE_KEY_PREFIX + slot;
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
      });
      return true;
    } catch {
      return false;
    }
  }

  static autoSave(): boolean {
    gameState.updatePlayTime();
    const state = gameState.getState();
    const data: SaveData = {
      version: SAVE_VERSION,
      slot: -1,
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
    };
    try {
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  static getSaveInfo(slot: number): { exists: boolean; heroName?: string; level?: number; region?: string; playTime?: string; timestamp?: number } {
    const key = slot === -1 ? AUTO_SAVE_KEY : SAVE_KEY_PREFIX + slot;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { exists: false };
      const data: SaveData = JSON.parse(raw);
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
      };
    } catch {
      return { exists: false };
    }
  }

  static deleteSave(slot: number): void {
    const key = slot === -1 ? AUTO_SAVE_KEY : SAVE_KEY_PREFIX + slot;
    localStorage.removeItem(key);
  }

  static hasSaves(): boolean {
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      if (localStorage.getItem(SAVE_KEY_PREFIX + i)) return true;
    }
    if (localStorage.getItem(AUTO_SAVE_KEY)) return true;
    return false;
  }
}
