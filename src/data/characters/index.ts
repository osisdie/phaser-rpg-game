import type { CompanionData } from '../../types';

const companions: CompanionData[] = [
  {
    id: 'companion_elf', name: '艾拉', race: 'elf', level: 8, exp: 0,
    regionId: 'region_elf', joinChapter: 1,
    stats: { maxHP: 85, maxMP: 50, hp: 85, mp: 50, atk: 14, def: 8, agi: 16, luck: 8 },
    growth: { hp: 6, mp: 5, atk: [2, 3], def: 1, agi: [2, 3], luck: 1 },
    skills: ['skill_elf_arrow', 'skill_nature_heal'],
    personalSkills: ['skill_elf_arrow', 'skill_rain_arrow', 'skill_nature_heal', 'skill_elf_ultimate'],
    equipment: { helmet: null, armor: null, shield: null, weapon: 'equip_iron_sword', boots: null },
    statPoints: 0,
  },
  {
    id: 'companion_treant', name: '歐克', race: 'treant', level: 15, exp: 0,
    regionId: 'region_treant', joinChapter: 2,
    stats: { maxHP: 150, maxMP: 35, hp: 150, mp: 35, atk: 16, def: 18, agi: 6, luck: 4 },
    growth: { hp: 12, mp: 2, atk: [1, 2], def: 4, agi: [1, 1], luck: 0 },
    skills: ['skill_bark_shield', 'skill_root_strike'],
    personalSkills: ['skill_bark_shield', 'skill_root_strike', 'skill_photosynthesis', 'skill_treant_ultimate'],
    equipment: { helmet: null, armor: 'equip_steel_armor', shield: 'equip_steel_shield', weapon: null, boots: null },
    statPoints: 0,
  },
  {
    id: 'companion_beast', name: '拉格', race: 'beastman', level: 22, exp: 0,
    regionId: 'region_beast', joinChapter: 3,
    stats: { maxHP: 130, maxMP: 25, hp: 130, mp: 25, atk: 28, def: 12, agi: 14, luck: 5 },
    growth: { hp: 9, mp: 2, atk: [3, 4], def: 2, agi: [1, 2], luck: 1 },
    skills: ['skill_berserk', 'skill_frenzy'],
    personalSkills: ['skill_berserk', 'skill_frenzy', 'skill_quake', 'skill_beast_ultimate'],
    equipment: { helmet: null, armor: null, shield: null, weapon: 'equip_steel_sword', boots: 'equip_steel_boots' },
    statPoints: 0,
  },
  {
    id: 'companion_merfolk', name: '美露', race: 'merfolk', level: 29, exp: 0,
    regionId: 'region_merfolk', joinChapter: 4,
    stats: { maxHP: 90, maxMP: 80, hp: 90, mp: 80, atk: 15, def: 10, agi: 12, luck: 10 },
    growth: { hp: 5, mp: 7, atk: [1, 2], def: 1, agi: [1, 2], luck: 2 },
    skills: ['skill_water_bolt', 'skill_aqua_heal'],
    personalSkills: ['skill_water_bolt', 'skill_tidal_wave', 'skill_aqua_heal', 'skill_merfolk_ultimate'],
    equipment: { helmet: null, armor: 'equip_silver_armor', shield: null, weapon: 'equip_silver_sword', boots: null },
    statPoints: 0,
  },
  {
    id: 'companion_giant', name: '巨岩', race: 'giant', level: 36, exp: 0,
    regionId: 'region_giant', joinChapter: 5,
    stats: { maxHP: 200, maxMP: 20, hp: 200, mp: 20, atk: 35, def: 25, agi: 5, luck: 3 },
    growth: { hp: 14, mp: 1, atk: [3, 5], def: 3, agi: [0, 1], luck: 0 },
    skills: ['skill_heavy_strike', 'skill_iron_body'],
    personalSkills: ['skill_heavy_strike', 'skill_ground_pound', 'skill_iron_body', 'skill_giant_ultimate'],
    equipment: { helmet: 'equip_mithril_helmet', armor: 'equip_mithril_armor', shield: 'equip_mithril_shield', weapon: 'equip_mithril_sword', boots: null },
    statPoints: 0,
  },
  {
    id: 'companion_dwarf', name: '鍛冶', race: 'dwarf', level: 43, exp: 0,
    regionId: 'region_dwarf', joinChapter: 6,
    stats: { maxHP: 140, maxMP: 40, hp: 140, mp: 40, atk: 30, def: 22, agi: 10, luck: 8 },
    growth: { hp: 8, mp: 3, atk: [2, 3], def: 3, agi: [1, 1], luck: 1 },
    skills: ['skill_forge_strike', 'skill_reinforce'],
    personalSkills: ['skill_forge_strike', 'skill_trap', 'skill_reinforce', 'skill_dwarf_ultimate'],
    equipment: { helmet: 'equip_dragon_helmet', armor: 'equip_dragon_armor', shield: 'equip_dragon_shield', weapon: 'equip_dragon_sword', boots: 'equip_dragon_boots' },
    statPoints: 0,
  },
  {
    id: 'companion_undead', name: '夜刃', race: 'undead', level: 50, exp: 0,
    regionId: 'region_undead', joinChapter: 7,
    stats: { maxHP: 120, maxMP: 60, hp: 120, mp: 60, atk: 32, def: 15, agi: 18, luck: 6 },
    growth: { hp: 7, mp: 4, atk: [2, 4], def: 2, agi: [2, 3], luck: 1 },
    skills: ['skill_shadow_slash', 'skill_drain_life'],
    personalSkills: ['skill_shadow_slash', 'skill_drain_life', 'skill_dark_wave', 'skill_undead_ultimate'],
    equipment: { helmet: 'equip_holy_helmet', armor: 'equip_holy_armor', shield: null, weapon: 'equip_holy_sword', boots: 'equip_holy_boots' },
    statPoints: 0,
  },
];

const companionMap = new Map<string, CompanionData>();
for (const c of companions) companionMap.set(c.id, c);

export function getCompanionById(id: string): CompanionData | undefined {
  return companionMap.get(id);
}

export function getCompanionForRegion(regionId: string): CompanionData | undefined {
  return companions.find(c => c.regionId === regionId);
}

export function getAllCompanions(): CompanionData[] {
  return companions;
}
