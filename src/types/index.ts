// ─── 基礎屬性 ───
export interface Stats {
  maxHP: number;
  maxMP: number;
  hp: number;
  mp: number;
  atk: number;
  def: number;
  agi: number;
  luck: number;
}

export interface StatsGrowth {
  hp: number;
  mp: number;
  atk: [number, number]; // [min, max] range
  def: number;
  agi: [number, number];
  luck: number;
}

// ─── 種族 ───
export type Race =
  | 'human'
  | 'elf'
  | 'treant'
  | 'beastman'
  | 'merfolk'
  | 'giant'
  | 'dwarf'
  | 'undead'
  | 'volcano'
  | 'hotspring'
  | 'mountain';

// ─── 角色 ───
export interface CharacterData {
  id: string;
  name: string;
  race: Race;
  level: number;
  exp: number;
  stats: Stats;
  growth: StatsGrowth;
  skills: string[];
  equipment: EquipmentLoadout;
  statPoints: number;
}

export interface CompanionData extends CharacterData {
  regionId: string;
  joinChapter: number;
  personalSkills: string[];
}

// ─── 裝備 ───
export type EquipmentSlot = 'helmet' | 'armor' | 'shield' | 'weapon' | 'boots';

export interface EquipmentLoadout {
  helmet: string | null;
  armor: string | null;
  shield: string | null;
  weapon: string | null;
  boots: string | null;
}

export type EquipmentTier = 'wood' | 'iron' | 'steel' | 'silver' | 'mithril' | 'dragon' | 'holy' | 'legendary';

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  tier: EquipmentTier;
  stats: Partial<Stats>;
  price: number;
  description: string;
}

// ─── 道具 ───
export type ItemType = 'consumable' | 'equipment' | 'key' | 'material';

export interface ItemData {
  id: string;
  name: string;
  type: ItemType;
  description: string;
  price: number;
  sellPrice: number;
  effect?: ItemEffect;
  stackable: boolean;
  maxStack: number;
}

export interface ItemEffect {
  type: 'heal_hp' | 'heal_mp' | 'heal_both' | 'revive' | 'buff' | 'full_restore';
  value: number;
  target: 'single' | 'all';
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

// ─── 技能 ───
export type SkillTarget = 'single_enemy' | 'all_enemies' | 'single_ally' | 'all_allies' | 'self';
export type SkillType = 'physical' | 'magical' | 'heal' | 'buff' | 'debuff' | 'special';
export type ElementType = 'none' | 'fire' | 'water' | 'earth' | 'wind' | 'light' | 'dark';

export interface SkillData {
  id: string;
  name: string;
  description: string;
  type: SkillType;
  target: SkillTarget;
  element: ElementType;
  mpCost: number;
  power: number;
  levelRequired: number;
  race?: Race;
  animation?: string;
}

// ─── 怪物 ───
export type MonsterAI = 'normal' | 'aggressive' | 'defensive' | 'healer';

export interface MonsterData {
  id: string;
  name: string;
  stats: Stats;
  ai: MonsterAI;
  exp: number;
  gold: number;
  drops: DropEntry[];
  skills: string[];
  element: ElementType;
  isBoss: boolean;
  spriteColor: number;
}

export interface DropEntry {
  itemId: string;
  rate: number; // 0-1
}

// ─── 戰鬥 ───
export interface BattleAction {
  type: 'attack' | 'skill' | 'item' | 'defend' | 'flee';
  actorIndex: number;
  isEnemy: boolean;
  targetIndex?: number;
  skillId?: string;
  itemId?: string;
}

export interface BattleResult {
  victory: boolean;
  fled: boolean;
  exp: number;
  gold: number;
  drops: string[];
  levelUps: LevelUpInfo[];
}

export interface LevelUpInfo {
  characterId: string;
  oldLevel: number;
  newLevel: number;
  statGains: Partial<Stats>;
  newSkills: string[];
  statPoints: number;
}

export interface CombatantState {
  id: string;
  name: string;
  stats: Stats;
  isEnemy: boolean;
  isDefending: boolean;
  index: number;
  skills: string[];
  ai?: MonsterAI;
  element?: ElementType;
}

// ─── 區域 ───
export interface RegionData {
  id: string;
  name: string;
  type: 'main' | 'side' | 'final';
  levelRange: [number, number];
  description: string;
  companionId?: string;
  bossId: string;
  monsterIds: string[];
  shopItems: string[];
  worldMapPosition: { x: number; y: number };
  color: number;
  connections: string[];
}

// ─── 對話 ───
export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  choices?: DialogueChoice[];
  next?: string;
  condition?: string;
  action?: string;
}

export interface DialogueChoice {
  text: string;
  next: string;
  condition?: string;
}

export interface DialogueTree {
  id: string;
  nodes: Record<string, DialogueNode>;
  startNode: string;
}

// ─── 任務 ───
export type QuestStatus = 'inactive' | 'active' | 'completed';
export type QuestType = 'main' | 'side';

export interface QuestData {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  chapter: number;
  objectives: QuestObjective[];
  rewards: QuestReward;
  prerequisite?: string;
}

export interface QuestObjective {
  id: string;
  description: string;
  type: 'defeat_boss' | 'talk_npc' | 'collect_item' | 'explore_area' | 'reach_level';
  target: string;
  count: number;
  current: number;
}

export interface QuestReward {
  exp: number;
  gold: number;
  items: { itemId: string; quantity: number }[];
}

// ─── 存檔 ───
export interface SaveData {
  version: number;
  slot: number;
  heroName: string;
  hero: CharacterData;
  party: string[];
  companions: Record<string, CompanionData>;
  inventory: InventoryEntry[];
  gold: number;
  flags: Record<string, boolean>;
  currentRegion: string;
  currentScene: string;
  questStates: Record<string, QuestStatus>;
  questProgress: Record<string, Record<string, number>>;
  liberatedRegions: string[];
  visitedRegions: string[];
  playTime: number;
  difficulty: Difficulty;
  timestamp: number;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

// ─── 遊戲狀態 ───
export interface GameState {
  heroName: string;
  hero: CharacterData;
  party: string[];
  companions: Record<string, CompanionData>;
  inventory: InventoryEntry[];
  gold: number;
  flags: Record<string, boolean>;
  currentRegion: string;
  currentScene: string;
  questStates: Record<string, QuestStatus>;
  questProgress: Record<string, Record<string, number>>;
  liberatedRegions: string[];
  visitedRegions: string[];
  playTime: number;
  difficulty: Difficulty;
  encounterSteps: number;
}

// ─── NPC ───
export interface NPCData {
  id: string;
  name: string;
  x: number;
  y: number;
  spriteColor: number;
  dialogueId: string;
  type: 'quest' | 'shop' | 'info' | 'save' | 'inn';
  /** NPC behavior: idle (default), wander (random walk near home), patrol (back-and-forth) */
  behavior?: 'idle' | 'wander';
}

// ─── 遇敵表 ───
export interface EncounterEntry {
  monsterId: string;
  weight: number;
  minCount: number;
  maxCount: number;
}

export interface EncounterTable {
  regionId: string;
  baseRate: number; // steps between encounters
  entries: EncounterEntry[];
}
