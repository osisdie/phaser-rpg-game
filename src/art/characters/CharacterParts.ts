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

/** Direction for sprite facing */
export type Direction = 'down' | 'left' | 'right' | 'up';

/** Walk animation frame (0=stand, 1=step-left, 2=step-right) */
export type WalkFrame = 0 | 1 | 2;

// ─── Predefined character appearances ───────────────────────────────

/** Hero default appearance */
export const HERO_APPEARANCE: CharacterAppearance = {
  skinColor: MEDIEVAL.skinLight,
  hairStyle: 'short',
  hairColor: MEDIEVAL.hairBrown,
  headgear: 'none',
  bodyType: 'tunic',
  bodyColor: '#4466aa',
  capeColor: '#cc3333',
  cape: true,
  weapon: 'sword',
  weaponColor: MEDIEVAL.ironLight,
};

/** Companion appearances by companion ID */
export const COMPANION_APPEARANCES: Record<string, CharacterAppearance> = {
  companion_elf: {
    skinColor: MEDIEVAL.skinPale,
    hairStyle: 'long',
    hairColor: MEDIEVAL.hairBlonde,
    headgear: 'circlet',
    bodyType: 'robe',
    bodyColor: '#336633',
    capeColor: '#448844',
    cape: true,
    weapon: 'bow',
    weaponColor: '#6b4f3a',
  },
  companion_treant: {
    skinColor: '#7a8a5a',
    hairStyle: 'spiky',
    hairColor: '#3a5a2a',
    headgear: 'none',
    bodyType: 'leather',
    bodyColor: '#5a6a3a',
    capeColor: '#3a4a2a',
    cape: false,
    weapon: 'staff',
    weaponColor: '#5a4a2a',
  },
  companion_beast: {
    skinColor: '#c8a070',
    hairStyle: 'spiky',
    hairColor: '#884422',
    headgear: 'bandana',
    bodyType: 'leather',
    bodyColor: '#885533',
    capeColor: '#664422',
    cape: false,
    weapon: 'axe',
    weaponColor: MEDIEVAL.ironMedium,
  },
  companion_merfolk: {
    skinColor: '#a0c8d8',
    hairStyle: 'long',
    hairColor: MEDIEVAL.hairBlue,
    headgear: 'circlet',
    bodyType: 'dress',
    bodyColor: '#4488aa',
    capeColor: '#3366aa',
    cape: true,
    weapon: 'staff',
    weaponColor: '#88aacc',
  },
  companion_giant: {
    skinColor: MEDIEVAL.skinDark,
    hairStyle: 'bald',
    hairColor: MEDIEVAL.hairBlack,
    headgear: 'helmet',
    bodyType: 'armor',
    bodyColor: '#666666',
    capeColor: '#444444',
    cape: false,
    weapon: 'hammer',
    weaponColor: MEDIEVAL.ironDark,
  },
  companion_dwarf: {
    skinColor: MEDIEVAL.skinMedium,
    hairStyle: 'short',
    hairColor: MEDIEVAL.hairRed,
    headgear: 'helmet',
    bodyType: 'armor',
    bodyColor: '#886644',
    capeColor: '#664422',
    cape: false,
    weapon: 'axe',
    weaponColor: MEDIEVAL.gold,
  },
  companion_undead: {
    skinColor: '#c0c0d0',
    hairStyle: 'long',
    hairColor: MEDIEVAL.hairWhite,
    headgear: 'hood',
    bodyType: 'robe',
    bodyColor: '#442266',
    capeColor: '#332255',
    cape: true,
    weapon: 'staff',
    weaponColor: '#8866aa',
  },
};

/** NPC type → base appearance */
export const NPC_TYPE_APPEARANCES: Record<string, Partial<CharacterAppearance>> = {
  shop: {
    headgear: 'none',
    bodyType: 'tunic',
    bodyColor: '#886644',
    weapon: 'none',
    cape: false,
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
};

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
