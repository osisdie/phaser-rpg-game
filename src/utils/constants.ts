export const SAVE_VERSION = 1;
export const MAX_SAVE_SLOTS = 3;
export const MAX_PARTY_SIZE = 3;
export const MAX_LEVEL = 70;

export const BASE_ENCOUNTER_STEPS = 30;
export const ENCOUNTER_VARIANCE = 10;

export const FONT_FAMILY = '"Microsoft JhengHei", "微軟正黑體", "Noto Sans TC", sans-serif';

export const COLORS = {
  white: 0xffffff,
  black: 0x000000,
  gold: 0xffd700,
  red: 0xff4444,
  green: 0x44ff44,
  blue: 0x4488ff,
  darkBlue: 0x222244,
  panel: 0x1a1a2e,
  panelBorder: 0x4a4a6e,
  hpBar: 0x44cc44,
  mpBar: 0x4488ff,
  expBar: 0xffcc00,
  textPrimary: '#ffffff',
  textSecondary: '#aaaacc',
  textHighlight: '#ffdd44',
  textDamage: '#ff4444',
  textHeal: '#44ff44',
};

export const DEPTH = {
  ground: 0,
  objects: 10,
  characters: 20,
  player: 25,
  ui: 50,
  overlay: 100,
  transition: 200,
};

export const REGION_COLORS: Record<string, number> = {
  region_hero: 0x8888cc,
  region_elf: 0x44cc44,
  region_treant: 0x228822,
  region_beast: 0xcc8844,
  region_merfolk: 0x4488cc,
  region_giant: 0x888888,
  region_dwarf: 0xcc6644,
  region_undead: 0x664488,
  region_volcano: 0xff4422,
  region_hotspring: 0x44cccc,
  region_mountain: 0xccccee,
  region_demon: 0x440044,
};
