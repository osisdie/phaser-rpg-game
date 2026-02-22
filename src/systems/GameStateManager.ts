import type { GameState, CharacterData, CompanionData, InventoryEntry, Difficulty } from '../types';
import { MAX_PARTY_SIZE } from '../utils/constants';

const DEFAULT_HERO_STATS: CharacterData = {
  id: 'hero',
  name: '勇者',
  race: 'human',
  level: 1,
  exp: 0,
  stats: { maxHP: 100, maxMP: 30, hp: 100, mp: 30, atk: 15, def: 10, agi: 10, luck: 5 },
  growth: { hp: 8, mp: 3, atk: [2, 3], def: 2, agi: [1, 2], luck: 1 },
  skills: ['skill_slash'],
  equipment: { helmet: null, armor: null, shield: null, weapon: 'equip_wood_sword', boots: null },
  statPoints: 0,
};

function createDefaultState(): GameState {
  return {
    heroName: '勇者',
    hero: structuredClone(DEFAULT_HERO_STATS),
    party: ['hero'],
    companions: {},
    inventory: [
      { itemId: 'item_potion_s', quantity: 3 },
    ],
    gold: 100,
    flags: {},
    currentRegion: 'region_hero',
    currentScene: 'TitleScene',
    questStates: {},
    questProgress: {},
    liberatedRegions: [],
    visitedRegions: ['region_hero'],
    playTime: 0,
    difficulty: 'normal',
    encounterSteps: 0,
  };
}

class GameStateManager {
  private state: GameState = createDefaultState();
  private playTimeStart: number = Date.now();

  reset(): void {
    this.state = createDefaultState();
    this.playTimeStart = Date.now();
  }

  getState(): GameState {
    return this.state;
  }

  loadState(data: GameState): void {
    this.state = data;
    this.playTimeStart = Date.now();
  }

  // ─── Hero ───
  setHeroName(name: string): void {
    this.state.heroName = name;
    this.state.hero.name = name;
  }

  getHero(): CharacterData {
    return this.state.hero;
  }

  // ─── Party ───
  getParty(): CharacterData[] {
    return this.state.party.map(id => {
      if (id === 'hero') return this.state.hero;
      return this.state.companions[id];
    }).filter(Boolean);
  }

  addToParty(companionId: string): boolean {
    if (this.state.party.length >= MAX_PARTY_SIZE) return false;
    if (this.state.party.includes(companionId)) return false;
    this.state.party.push(companionId);
    return true;
  }

  removeFromParty(companionId: string): boolean {
    if (companionId === 'hero') return false;
    const idx = this.state.party.indexOf(companionId);
    if (idx === -1) return false;
    this.state.party.splice(idx, 1);
    return true;
  }

  addCompanion(data: CompanionData): void {
    this.state.companions[data.id] = data;
  }

  getCompanion(id: string): CompanionData | undefined {
    return this.state.companions[id];
  }

  // ─── Inventory ───
  addItem(itemId: string, quantity: number = 1): void {
    const entry = this.state.inventory.find(e => e.itemId === itemId);
    if (entry) {
      entry.quantity += quantity;
    } else {
      this.state.inventory.push({ itemId, quantity });
    }
  }

  removeItem(itemId: string, quantity: number = 1): boolean {
    const entry = this.state.inventory.find(e => e.itemId === itemId);
    if (!entry || entry.quantity < quantity) return false;
    entry.quantity -= quantity;
    if (entry.quantity <= 0) {
      this.state.inventory = this.state.inventory.filter(e => e.itemId !== itemId);
    }
    return true;
  }

  getItemCount(itemId: string): number {
    return this.state.inventory.find(e => e.itemId === itemId)?.quantity ?? 0;
  }

  getInventory(): InventoryEntry[] {
    return this.state.inventory;
  }

  // ─── Gold ───
  addGold(amount: number): void {
    this.state.gold += amount;
  }

  spendGold(amount: number): boolean {
    if (this.state.gold < amount) return false;
    this.state.gold -= amount;
    return true;
  }

  getGold(): number {
    return this.state.gold;
  }

  // ─── Flags ───
  setFlag(key: string, value: boolean = true): void {
    this.state.flags[key] = value;
  }

  getFlag(key: string): boolean {
    return this.state.flags[key] ?? false;
  }

  // ─── Region ───
  setCurrentRegion(regionId: string): void {
    this.state.currentRegion = regionId;
    if (!this.state.visitedRegions.includes(regionId)) {
      this.state.visitedRegions.push(regionId);
    }
  }

  liberateRegion(regionId: string): void {
    if (!this.state.liberatedRegions.includes(regionId)) {
      this.state.liberatedRegions.push(regionId);
    }
  }

  isRegionLiberated(regionId: string): boolean {
    return this.state.liberatedRegions.includes(regionId);
  }

  // ─── Quest ───
  setQuestStatus(questId: string, status: 'inactive' | 'active' | 'completed'): void {
    this.state.questStates[questId] = status;
  }

  getQuestStatus(questId: string): string {
    return this.state.questStates[questId] ?? 'inactive';
  }

  // ─── Scene ───
  setCurrentScene(scene: string): void {
    this.state.currentScene = scene;
  }

  // ─── Difficulty ───
  setDifficulty(d: Difficulty): void {
    this.state.difficulty = d;
  }

  getDifficulty(): Difficulty {
    return this.state.difficulty;
  }

  // ─── Play Time ───
  updatePlayTime(): void {
    const now = Date.now();
    this.state.playTime += (now - this.playTimeStart) / 1000;
    this.playTimeStart = now;
  }

  getPlayTime(): number {
    return this.state.playTime + (Date.now() - this.playTimeStart) / 1000;
  }

  getPlayTimeFormatted(): string {
    const total = Math.floor(this.getPlayTime());
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // ─── Encounter ───
  getEncounterSteps(): number {
    return this.state.encounterSteps;
  }

  setEncounterSteps(steps: number): void {
    this.state.encounterSteps = steps;
  }

  decrementEncounterSteps(): number {
    this.state.encounterSteps--;
    return this.state.encounterSteps;
  }
}

export const gameState = new GameStateManager();
