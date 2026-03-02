import type { MonsterData, EncounterTable } from '../../types';

// ─── Equipment tier helpers ───
const EQUIP_TIERS = ['wood', 'iron', 'steel', 'silver', 'mithril', 'dragon', 'holy', 'legendary'] as const;
const EQUIP_SLOTS = ['sword', 'helmet', 'armor', 'shield', 'boots'];

function getTierForLevel(lv: number): string {
  if (lv < 8) return 'wood';
  if (lv < 18) return 'iron';
  if (lv < 30) return 'steel';
  if (lv < 42) return 'silver';
  if (lv < 55) return 'mithril';
  if (lv < 65) return 'dragon';
  return 'holy';
}

function getNextTier(tier: string): string {
  const idx = EQUIP_TIERS.indexOf(tier as any);
  return EQUIP_TIERS[Math.min(idx + 1, EQUIP_TIERS.length - 1)];
}

function getPotionForLevel(lv: number): string {
  if (lv < 15) return 'item_potion_s';
  if (lv < 35) return 'item_potion_m';
  return 'item_potion_l';
}

function getEtherForLevel(lv: number): string {
  return lv < 30 ? 'item_ether_s' : 'item_ether_m';
}

/** Determine skills for a monster based on name and level */
function getMonsterSkills(name: string, lv: number): string[] {
  const base: string[] = lv > 10 ? ['skill_monster_bite'] : [];
  // Poison-type monsters
  if (name.includes('毒')) base.push('skill_monster_poison_bite');
  // Paralysis-type monsters
  if (/蠍|蛇|水母|觸/.test(name)) base.push('skill_monster_paralyze');
  // Confusion-type monsters
  if (/幽靈|迷霧|幽魂|迷惑/.test(name)) base.push('skill_monster_confuse');
  return base;
}

/** Generate monsters for a region based on level range */
function generateRegionMonsters(
  regionId: string,
  baseLv: number,
  names: string[],
  color: number,
  element: string = 'none'
): MonsterData[] {
  return names.map((name, i) => {
    const lv = baseLv + i * Math.max(1, Math.floor((names.length > 1 ? 7 : 1) / (names.length - 1 || 1)));
    const hpBase = 22 + lv * 12;
    const tier = getTierForLevel(lv);
    const equipSlot = EQUIP_SLOTS[i % EQUIP_SLOTS.length];
    const equipDropRate = 0.04 + i * 0.006; // 4%→10% scaling with monster index

    return {
      id: `${regionId}_monster_${i}`,
      name,
      stats: {
        maxHP: hpBase, hp: hpBase,
        maxMP: 10 + lv * 2, mp: 10 + lv * 2,
        atk: 5 + lv * 3,
        def: 5 + lv * 2,
        agi: 5 + lv,
        luck: 3,
      },
      ai: i % 3 === 0 ? 'aggressive' : 'normal',
      exp: 10 + lv * 5,
      gold: 5 + lv * 3,
      drops: [
        { itemId: getPotionForLevel(lv), rate: 0.3 },
        { itemId: getEtherForLevel(lv), rate: 0.08 },
        { itemId: `equip_${tier}_${equipSlot}`, rate: equipDropRate },
      ],
      skills: getMonsterSkills(name, lv),
      element: element as any,
      isBoss: false,
      spriteColor: color + i * 0x111111 & 0xffffff,
    };
  });
}

function generateBoss(
  regionId: string,
  name: string,
  lv: number,
  color: number,
  element: string = 'dark'
): MonsterData {
  const tier = getTierForLevel(lv);
  const nextTier = getNextTier(tier);
  return {
    id: `${regionId}_boss`,
    name,
    stats: {
      maxHP: (22 + lv * 12) * 2.0, hp: (22 + lv * 12) * 2.0,
      maxMP: 50 + lv * 5, mp: 50 + lv * 5,
      atk: (5 + lv * 3) * 1.4,
      def: (5 + lv * 2) * 1.2,
      agi: 5 + lv * 1.2,
      luck: 10,
    },
    ai: 'aggressive',
    exp: (10 + lv * 5) * 5,
    gold: (5 + lv * 3) * 5,
    drops: [
      { itemId: getPotionForLevel(lv + 10), rate: 1 },
      { itemId: getEtherForLevel(lv + 10), rate: 0.5 },
      { itemId: `equip_${nextTier}_sword`, rate: 1.0 },   // guaranteed weapon
      { itemId: `equip_${nextTier}_armor`, rate: 0.5 },   // 50% armor
    ],
    skills: ['skill_boss_smash', 'skill_monster_fire'],
    element: element as any,
    isBoss: true,
    spriteColor: color,
  };
}

// ─── Region 1: 勇者王國 (Lv 1-7) ───
const heroMonsters = generateRegionMonsters('r1', 1,
  ['史萊姆', '蝙蝠', '小哥布林', '毒蛇', '野狼', '骷髏兵', '土匪', '暗影鼠', '食屍鬼', '黑蜘蛛'],
  0x44aa44
);
// Tutorial boss — hand-crafted for solo hero at ~Lv 5-6
const heroBoss: MonsterData = {
  id: 'r1_boss',
  name: '墮落守衛長',
  stats: { maxHP: 250, hp: 250, maxMP: 40, mp: 40, atk: 35, def: 20, agi: 12, luck: 5 },
  ai: 'aggressive',
  exp: 200,
  gold: 150,
  drops: [
    { itemId: 'item_potion_m', rate: 1.0 },
    { itemId: 'equip_iron_sword', rate: 1.0 },
    { itemId: 'equip_iron_armor', rate: 0.5 },
  ],
  skills: ['skill_monster_bite', 'skill_monster_fire'],
  element: 'dark',
  isBoss: true,
  spriteColor: 0x880000,
};

// ─── Region 2: 精靈王國 (Lv 7-14) ───
const elfMonsters = generateRegionMonsters('r2', 7,
  ['毒史萊姆', '樹精靈', '森林狼', '巨型蜜蜂', '森林史萊姆', '藤蔓蛇', '迷霧幽靈', '暗影鹿', '腐化精靈', '森林巨蜘蛛'],
  0x228822, 'earth'
);
const elfBoss = generateBoss('r2', '腐化精靈王', 18, 0x226622, 'earth');

// ─── Region 3: 樹人王國 (Lv 14-21) ───
const treantMonsters = generateRegionMonsters('r3', 14,
  ['枯木怪', '苔蘚蟲', '腐根獸', '寄生花', '毒孢子', '泥沼史萊姆', '朽木兵', '蟲巢母', '黑藤蔓', '暗影樹靈'],
  0x336633, 'earth'
);
const treantBoss = generateBoss('r3', '腐朽古樹', 25, 0x445500, 'earth');

// ─── Region 4: 獸人王國 (Lv 21-28) ───
const beastMonsters = generateRegionMonsters('r4', 21,
  ['草原獅', '戰鬥犬', '荒野鷹', '毒蠍', '沙漠蜥蜴', '野牛', '鬣狗群', '岩石蛇', '狂暴猿', '暗影豹'],
  0xcc8844
);
const beastBoss = generateBoss('r4', '魔獸將軍', 32, 0x884400);

// ─── Region 5: 人魚王國 (Lv 28-35) ───
const merfolkMonsters = generateRegionMonsters('r5', 28,
  ['海水史萊姆', '利齒魚', '海蛇', '珊瑚怪', '水元素', '深海章魚', '幽靈船員', '海馬騎兵', '毒水母', '暗影鯊'],
  0x4488cc, 'water'
);
const merfolkBoss = generateBoss('r5', '深海魔龍', 39, 0x224488, 'water');

// ─── Region 6: 巨人王國 (Lv 35-42) ───
const giantMonsters = generateRegionMonsters('r6', 35,
  ['石魔像', '山岳鷹', '岩石蟲', '冰霜巨人', '飛石怪', '山洞蝙蝠王', '鐵甲龜', '落石精', '雪怪', '暗影巨人'],
  0x888888
);
const giantBoss = generateBoss('r6', '山嶽魔王', 46, 0x666666, 'earth');

// ─── Region 7: 矮人王國 (Lv 42-49) ───
const dwarfMonsters = generateRegionMonsters('r7', 42,
  ['地底蟲', '礦石蟲', '火焰蜥蜴', '機關人偶', '毒氣菇', '鋼鐵蝙蝠', '熔岩蛇', '金屬史萊姆', '暗金鼠', '暗影工匠'],
  0xcc6644, 'fire'
);
const dwarfBoss = generateBoss('r7', '鑄造魔將', 53, 0xaa4422, 'fire');

// ─── Region 8: 不死王國 (Lv 49-56) ───
const undeadMonsters = generateRegionMonsters('r8', 49,
  ['骷髏弓手', '殭屍兵', '幽魂', '吸血蝙蝠', '死靈法師', '骨龍', '暗影騎士', '腐屍巨人', '亡靈魔法師', '詛咒盔甲'],
  0x664488, 'dark'
);
const undeadBoss = generateBoss('r8', '不死魔將', 60, 0x442266, 'dark');

// ─── Region 9-11: 支線 ───
const volcanoMonsters = generateRegionMonsters('r9', 30,
  ['火焰蜥蜴', '熔岩蟲', '火山蝙蝠', '炎魔', '灰燼鳥', '火史萊姆', '火焰巨人', '煉獄犬', '火山龜', '暗影火靈'],
  0xff4422, 'fire'
);
const volcanoBoss = generateBoss('r9', '火山之主', 42, 0xcc2200, 'fire');

const hotspringMonsters = generateRegionMonsters('r10', 40,
  ['溫泉猴', '蒸氣怪', '水霧精靈', '溫泉蟹', '地熱蟲', '噴泉蛇', '硫磺蝠', '溫泉龜', '蒸汽魔像', '暗影水靈'],
  0x44cccc, 'water'
);
const hotspringBoss = generateBoss('r10', '溫泉守護者', 52, 0x22aaaa, 'water');

const mountainMonsters = generateRegionMonsters('r11', 50,
  ['雪狼', '冰史萊姆', '雪原鷹', '冰霜元素', '雪人', '極地熊', '冰龍幼體', '暴風鳥', '水晶蛇', '暗影冰靈'],
  0xccccee, 'wind'
);
const mountainBoss = generateBoss('r11', '冰峰之王', 62, 0x8888cc, 'wind');

// ─── Region 12: 魔王城 (Lv 60-70) ───
const demonMonsters = generateRegionMonsters('r12', 60,
  ['魔王衛兵', '暗黑騎士', '地獄犬', '魔法師', '暗影刺客', '惡魔弓手', '深淵蟲', '魔王分身', '墮天使', '混沌魔獸'],
  0x880088, 'dark'
);

// Mini-boss guard that must be defeated before the final boss
const demonMiniBoss: MonsterData = {
  id: 'r12_mini_boss',
  name: '魔王護衛',
  stats: { maxHP: 5000, hp: 5000, maxMP: 500, mp: 500, atk: 140, def: 110, agi: 80, luck: 30 },
  ai: 'aggressive',
  exp: 5000,
  gold: 5000,
  drops: [
    { itemId: 'item_elixir', rate: 1.0 },
    { itemId: 'equip_holy_sword', rate: 0.5 },
  ],
  skills: ['skill_boss_smash', 'skill_boss_dark_blast', 'skill_monster_fire'],
  element: 'dark',
  isBoss: true,
  spriteColor: 0x660066,
};

const finalBoss: MonsterData = {
  id: 'r12_boss',
  name: '大魔王',
  stats: { maxHP: 9999, hp: 9999, maxMP: 999, mp: 999, atk: 180, def: 150, agi: 100, luck: 50 },
  ai: 'aggressive',
  exp: 9999,
  gold: 9999,
  drops: [],
  skills: ['skill_boss_smash', 'skill_boss_dark_blast', 'skill_monster_fire'],
  element: 'dark',
  isBoss: true,
  spriteColor: 0x440044,
};

// ─── All monsters flat list + map ───
const allMonsters: MonsterData[] = [
  ...heroMonsters, heroBoss,
  ...elfMonsters, elfBoss,
  ...treantMonsters, treantBoss,
  ...beastMonsters, beastBoss,
  ...merfolkMonsters, merfolkBoss,
  ...giantMonsters, giantBoss,
  ...dwarfMonsters, dwarfBoss,
  ...undeadMonsters, undeadBoss,
  ...volcanoMonsters, volcanoBoss,
  ...hotspringMonsters, hotspringBoss,
  ...mountainMonsters, mountainBoss,
  ...demonMonsters, demonMiniBoss, finalBoss,
];

const monsterMap = new Map<string, MonsterData>();
for (const m of allMonsters) monsterMap.set(m.id, m);

export function getMonsterById(id: string): MonsterData | undefined {
  return monsterMap.get(id);
}

export function getMonstersForRegion(regionId: string): MonsterData[] {
  const prefix = regionId.replace('region_', 'r');
  const prefixMap: Record<string, string> = {
    'region_hero': 'r1', 'region_elf': 'r2', 'region_treant': 'r3',
    'region_beast': 'r4', 'region_merfolk': 'r5', 'region_giant': 'r6',
    'region_dwarf': 'r7', 'region_undead': 'r8', 'region_volcano': 'r9',
    'region_hotspring': 'r10', 'region_mountain': 'r11', 'region_demon': 'r12',
  };
  const p = prefixMap[regionId] ?? prefix;
  return allMonsters.filter(m => m.id.startsWith(p + '_') && !m.isBoss);
}

export function getMiniBossForRegion(regionId: string): MonsterData | undefined {
  if (regionId === 'region_demon') return monsterMap.get('r12_mini_boss');
  return undefined;
}

export function getBossForRegion(regionId: string): MonsterData | undefined {
  const prefixMap: Record<string, string> = {
    'region_hero': 'r1', 'region_elf': 'r2', 'region_treant': 'r3',
    'region_beast': 'r4', 'region_merfolk': 'r5', 'region_giant': 'r6',
    'region_dwarf': 'r7', 'region_undead': 'r8', 'region_volcano': 'r9',
    'region_hotspring': 'r10', 'region_mountain': 'r11', 'region_demon': 'r12',
  };
  const p = prefixMap[regionId];
  return allMonsters.find(m => m.id === `${p}_boss`);
}

// ─── Encounter Tables ───
function makeEncounterTable(regionId: string, baseRate: number = 22): EncounterTable {
  const monsters = getMonstersForRegion(regionId);
  // Steeper weight curve: easy monsters much more common
  // maxCount scales down: first 3 can appear in groups, later ones solo
  return {
    regionId,
    baseRate,
    entries: monsters.map((m, i) => ({
      monsterId: m.id,
      weight: Math.max(1, 14 - i * 2),
      minCount: 1,
      maxCount: i < 3 ? 3 : i < 6 ? 2 : 1,
    })),
  };
}

const encounterTables: Record<string, EncounterTable> = {
  region_hero: makeEncounterTable('region_hero'),
  region_elf: makeEncounterTable('region_elf'),
  region_treant: makeEncounterTable('region_treant'),
  region_beast: makeEncounterTable('region_beast'),
  region_merfolk: makeEncounterTable('region_merfolk'),
  region_giant: makeEncounterTable('region_giant'),
  region_dwarf: makeEncounterTable('region_dwarf'),
  region_undead: makeEncounterTable('region_undead'),
  region_volcano: makeEncounterTable('region_volcano'),
  region_hotspring: makeEncounterTable('region_hotspring'),
  region_mountain: makeEncounterTable('region_mountain'),
  region_demon: makeEncounterTable('region_demon', 10),
};

export function getEncounterTable(regionId: string): EncounterTable | undefined {
  return encounterTables[regionId];
}
