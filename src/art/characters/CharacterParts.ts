import { MEDIEVAL } from '../palettes';

/** Character appearance configuration — each character needs ~10 params */
export interface CharacterAppearance {
  skinColor: string;
  hairStyle: 'short' | 'long' | 'spiky' | 'ponytail' | 'bald';
  hairColor: string;
  headgear: 'none' | 'helmet' | 'wizard_hat' | 'hood' | 'crown' | 'circlet' | 'bandana';
  bodyType: 'tunic' | 'armor' | 'robe' | 'leather' | 'dress';
  bodyColor: string;
  capeColor: string;
  cape: boolean;
  weapon: 'sword' | 'staff' | 'bow' | 'axe' | 'dagger' | 'hammer' | 'none';
  weaponColor: string;
}

/** Direction for sprite facing (includes diagonal 3/4 views for battle) */
export type Direction = 'down' | 'left' | 'right' | 'up' | 'down_left' | 'down_right' | 'up_left' | 'up_right';

/** Walk animation frame (0=left-step, 1=neutral-pass, 2=right-step, 3=neutral-pass) */
export type WalkFrame = 0 | 1 | 2 | 3;

// ─── Predefined character appearances ───────────────────────────────

/** Hero appearance — prince swordsman with silver armor, crimson cape, and gold circlet */
export const HERO_APPEARANCE: CharacterAppearance = {
  skinColor: MEDIEVAL.skinLight,
  hairStyle: 'short',
  hairColor: MEDIEVAL.hairBrown,
  headgear: 'circlet',
  bodyType: 'armor',
  bodyColor: '#5577bb',
  capeColor: '#881a2a',
  cape: true,
  weapon: 'sword',
  weaponColor: MEDIEVAL.ironLight,
};

/** Companion appearances by companion ID */
export const COMPANION_APPEARANCES: Record<string, CharacterAppearance> = {
  companion_elf: { // 弓箭手 (Archer) — forest ranger with green cloak
    skinColor: MEDIEVAL.skinPale,
    hairStyle: 'long',
    hairColor: MEDIEVAL.hairBlonde,
    headgear: 'circlet',
    bodyType: 'leather',
    bodyColor: '#2a5530',
    capeColor: '#44aa44',
    cape: true,
    weapon: 'bow',
    weaponColor: '#6b4f3a',
  },
  companion_treant: { // 賢者 (Sage) — ancient bark sage with emerald robe
    skinColor: '#7a8a5a',
    hairStyle: 'bald',
    hairColor: '#3a5a2a',
    headgear: 'circlet',
    bodyType: 'robe',
    bodyColor: '#3a6a3a',
    capeColor: '#225522',
    cape: true,
    weapon: 'staff',
    weaponColor: '#5a4a2a',
  },
  companion_beast: { // 格鬥家 (Monk/Brawler) — fierce martial artist
    skinColor: '#c8a070',
    hairStyle: 'spiky',
    hairColor: '#884422',
    headgear: 'bandana',
    bodyType: 'tunic',
    bodyColor: '#cc6633',
    capeColor: '#aa4400',
    cape: false,
    weapon: 'none',
    weaponColor: MEDIEVAL.ironMedium,
  },
  companion_merfolk: { // 白魔法師 (White Mage) — ocean priestess
    skinColor: '#a0c8d8',
    hairStyle: 'long',
    hairColor: MEDIEVAL.hairBlue,
    headgear: 'circlet',
    bodyType: 'robe',
    bodyColor: '#ddddee',
    capeColor: '#6699cc',
    cape: true,
    weapon: 'staff',
    weaponColor: '#88aacc',
  },
  companion_giant: { // 機器人 (Robot) — armored war machine
    skinColor: '#888899',
    hairStyle: 'bald',
    hairColor: MEDIEVAL.hairBlack,
    headgear: 'helmet',
    bodyType: 'armor',
    bodyColor: '#556699',
    capeColor: '#334466',
    cape: true,
    weapon: 'hammer',
    weaponColor: MEDIEVAL.ironDark,
  },
  companion_dwarf: { // 盜賊 (Thief/Rogue) — shadow assassin with dark cloak
    skinColor: MEDIEVAL.skinMedium,
    hairStyle: 'short',
    hairColor: MEDIEVAL.hairRed,
    headgear: 'hood',
    bodyType: 'leather',
    bodyColor: '#2a2a3a',
    capeColor: '#553322',
    cape: true,
    weapon: 'dagger',
    weaponColor: MEDIEVAL.ironLight,
  },
  companion_undead: { // 黑魔法師 (Black Mage) — dark sorcerer with violet cape
    skinColor: '#c0c0d0',
    hairStyle: 'long',
    hairColor: MEDIEVAL.hairWhite,
    headgear: 'wizard_hat',
    bodyType: 'robe',
    bodyColor: '#442266',
    capeColor: '#9933cc',
    cape: true,
    weapon: 'staff',
    weaponColor: '#8866aa',
  },
};

/** NPC type → base appearance */
export const NPC_TYPE_APPEARANCES: Record<string, Partial<CharacterAppearance>> = {
  shop: {
    headgear: 'hood',
    bodyType: 'tunic',
    bodyColor: '#886644',
    weapon: 'none',
    cape: true,
    capeColor: '#665533',
  },
  inn: {
    headgear: 'none',
    bodyType: 'tunic',
    bodyColor: '#cc7744',
    weapon: 'none',
    cape: true,
    capeColor: '#aa5533',
  },
  quest: {
    headgear: 'crown',
    bodyType: 'robe',
    bodyColor: '#cc8833',
    weapon: 'none',
    cape: true,
    capeColor: '#aa6622',
  },
  save: {
    headgear: 'wizard_hat',
    bodyType: 'robe',
    bodyColor: '#4444aa',
    weapon: 'staff',
    weaponColor: '#8888cc',
    cape: false,
  },
  info: {
    headgear: 'none',
    bodyType: 'tunic',
    bodyColor: '#668866',
    weapon: 'none',
    cape: false,
  },
  companion: {
    headgear: 'none',
    bodyType: 'leather',
    bodyColor: '#777777',
    weapon: 'sword',
    cape: false,
  },
  elder: {
    headgear: 'circlet',
    bodyType: 'robe',
    bodyColor: '#8877aa',
    weapon: 'staff',
    weaponColor: '#887766',
    cape: true,
    capeColor: '#665588',
    hairColor: '#cccccc',
    hairStyle: 'short',
  },
};

/** Guard appearances per region — derived from companion races */
export function generateGuardAppearance(regionId: string): CharacterAppearance {
  // Map regions to their companion race's look
  const raceMap: Record<string, Partial<CharacterAppearance>> = {
    region_elf:       { skinColor: MEDIEVAL.skinPale, hairColor: MEDIEVAL.hairBlonde, hairStyle: 'long', bodyColor: '#336633' },
    region_treant:    { skinColor: '#7a8a5a', hairColor: '#3a5a2a', hairStyle: 'bald', bodyColor: '#5a6a3a' },
    region_beast:     { skinColor: '#c8a070', hairColor: '#884422', hairStyle: 'spiky', bodyColor: '#885533' },
    region_merfolk:   { skinColor: '#a0c8d8', hairColor: MEDIEVAL.hairBlue, hairStyle: 'long', bodyColor: '#4488aa' },
    region_giant:     { skinColor: MEDIEVAL.skinDark, hairColor: MEDIEVAL.hairBlack, hairStyle: 'bald', bodyColor: '#666666' },
    region_dwarf:     { skinColor: MEDIEVAL.skinMedium, hairColor: MEDIEVAL.hairRed, hairStyle: 'short', bodyColor: '#886644' },
    region_undead:    { skinColor: '#c0c0d0', hairColor: MEDIEVAL.hairWhite, hairStyle: 'short', bodyColor: '#442266' },
    region_volcano:   { skinColor: MEDIEVAL.skinDark, hairColor: MEDIEVAL.hairBlack, hairStyle: 'spiky', bodyColor: '#883322' },
    region_hotspring: { skinColor: MEDIEVAL.skinLight, hairColor: MEDIEVAL.hairBrown, hairStyle: 'ponytail', bodyColor: '#558866' },
    region_mountain:  { skinColor: MEDIEVAL.skinPale, hairColor: MEDIEVAL.hairBlonde, hairStyle: 'short', bodyColor: '#8888aa' },
  };
  const race = raceMap[regionId] ?? {};
  return {
    skinColor: race.skinColor ?? MEDIEVAL.skinLight,
    hairStyle: (race.hairStyle as CharacterAppearance['hairStyle']) ?? 'short',
    hairColor: race.hairColor ?? MEDIEVAL.hairBrown,
    headgear: 'helmet',
    bodyType: 'armor',
    bodyColor: race.bodyColor ?? '#556688',
    capeColor: race.bodyColor ?? '#556688',
    cape: false,
    weapon: 'sword',
    weaponColor: MEDIEVAL.ironLight,
  };
}

/** Generate a deterministic NPC appearance from type + seed */
export function generateNPCAppearance(type: string, seed: number): CharacterAppearance {
  const base = NPC_TYPE_APPEARANCES[type] ?? NPC_TYPE_APPEARANCES['info'];
  const skins = [MEDIEVAL.skinLight, MEDIEVAL.skinMedium, MEDIEVAL.skinDark, MEDIEVAL.skinPale];
  const hairs = [MEDIEVAL.hairBrown, MEDIEVAL.hairBlonde, MEDIEVAL.hairBlack, MEDIEVAL.hairRed];
  const styles: CharacterAppearance['hairStyle'][] = ['short', 'long', 'ponytail', 'bald'];

  return {
    skinColor: skins[seed % skins.length],
    hairStyle: styles[(seed >> 2) % styles.length],
    hairColor: hairs[(seed >> 4) % hairs.length],
    headgear: base.headgear ?? 'none',
    bodyType: base.bodyType ?? 'tunic',
    bodyColor: base.bodyColor ?? '#666666',
    capeColor: base.capeColor ?? '#444444',
    cape: base.cape ?? false,
    weapon: base.weapon ?? 'none',
    weaponColor: base.weaponColor ?? MEDIEVAL.ironMedium,
  };
}
