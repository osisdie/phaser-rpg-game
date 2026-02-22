import type { RegionData } from '../../types';

const regions: RegionData[] = [
  {
    id: 'region_hero', name: '勇者王國', type: 'main', levelRange: [1, 7],
    description: '曾經繁榮的故鄉，如今被魔王軍佔領。',
    bossId: 'r1_boss', monsterIds: [], companionId: undefined,
    shopItems: ['item_potion_s', 'item_ether_s', 'equip_wood_sword', 'equip_wood_helmet', 'equip_wood_armor', 'equip_wood_shield', 'equip_wood_boots'],
    worldMapPosition: { x: 350, y: 320 }, color: 0x8888cc,
    connections: ['region_elf', 'region_beast'],
  },
  {
    id: 'region_elf', name: '精靈王國', type: 'main', levelRange: [7, 14],
    description: '被古老森林環繞的神秘王國，精靈族世代居住於此。',
    bossId: 'r2_boss', monsterIds: [], companionId: 'companion_elf',
    shopItems: ['item_potion_s', 'item_potion_m', 'item_ether_s', 'equip_iron_sword', 'equip_iron_helmet', 'equip_iron_armor', 'equip_iron_shield', 'equip_iron_boots'],
    worldMapPosition: { x: 200, y: 180 }, color: 0x44cc44,
    connections: ['region_hero', 'region_treant'],
  },
  {
    id: 'region_treant', name: '樹人王國', type: 'main', levelRange: [14, 21],
    description: '由巨大古樹構成的空中城市。',
    bossId: 'r3_boss', monsterIds: [], companionId: 'companion_treant',
    shopItems: ['item_potion_m', 'item_ether_s', 'item_ether_m', 'equip_steel_sword', 'equip_steel_helmet', 'equip_steel_armor', 'equip_steel_shield', 'equip_steel_boots'],
    worldMapPosition: { x: 120, y: 280 }, color: 0x228822,
    connections: ['region_elf', 'region_beast'],
  },
  {
    id: 'region_beast', name: '獸人王國', type: 'main', levelRange: [21, 28],
    description: '廣闘草原上力量至上的戰士國度。',
    bossId: 'r4_boss', monsterIds: [], companionId: 'companion_beast',
    shopItems: ['item_potion_m', 'item_ether_m', 'equip_steel_sword', 'equip_steel_armor', 'equip_silver_sword'],
    worldMapPosition: { x: 500, y: 180 }, color: 0xcc8844,
    connections: ['region_hero', 'region_treant', 'region_merfolk', 'region_volcano'],
  },
  {
    id: 'region_merfolk', name: '人魚王國', type: 'main', levelRange: [28, 35],
    description: '沉入海底的水晶宮殿，人魚族的領地。',
    bossId: 'r5_boss', monsterIds: [], companionId: 'companion_merfolk',
    shopItems: ['item_potion_m', 'item_potion_l', 'item_ether_m', 'equip_silver_sword', 'equip_silver_helmet', 'equip_silver_armor', 'equip_silver_shield', 'equip_silver_boots'],
    worldMapPosition: { x: 700, y: 350 }, color: 0x4488cc,
    connections: ['region_beast', 'region_giant', 'region_hotspring'],
  },
  {
    id: 'region_giant', name: '巨人王國', type: 'main', levelRange: [35, 42],
    description: '聳立於山巔的巨大城堡。',
    bossId: 'r6_boss', monsterIds: [], companionId: 'companion_giant',
    shopItems: ['item_potion_l', 'item_ether_m', 'equip_mithril_sword', 'equip_mithril_helmet', 'equip_mithril_armor', 'equip_mithril_shield', 'equip_mithril_boots'],
    worldMapPosition: { x: 800, y: 200 }, color: 0x888888,
    connections: ['region_merfolk', 'region_dwarf', 'region_mountain'],
  },
  {
    id: 'region_dwarf', name: '矮人王國', type: 'main', levelRange: [42, 49],
    description: '深入地下的礦脈城市，矮人的工藝傳說。',
    bossId: 'r7_boss', monsterIds: [], companionId: 'companion_dwarf',
    shopItems: ['item_potion_l', 'item_ether_m', 'item_elixir', 'equip_dragon_sword', 'equip_dragon_helmet', 'equip_dragon_armor', 'equip_dragon_shield', 'equip_dragon_boots'],
    worldMapPosition: { x: 650, y: 480 }, color: 0xcc6644,
    connections: ['region_giant', 'region_undead'],
  },
  {
    id: 'region_undead', name: '不死王國', type: 'main', levelRange: [49, 56],
    description: '被永恆黑暗籠罩的亡靈之地。',
    bossId: 'r8_boss', monsterIds: [], companionId: 'companion_undead',
    shopItems: ['item_potion_l', 'item_elixir', 'item_revive', 'equip_holy_sword', 'equip_holy_helmet', 'equip_holy_armor', 'equip_holy_shield', 'equip_holy_boots'],
    worldMapPosition: { x: 450, y: 500 }, color: 0x664488,
    connections: ['region_dwarf', 'region_demon'],
  },
  {
    id: 'region_volcano', name: '火山族領地', type: 'side', levelRange: [30, 40],
    description: '活火山周圍的部族聚落，擁有火焰秘技。',
    bossId: 'r9_boss', monsterIds: [],
    shopItems: ['item_potion_m', 'item_potion_l'],
    worldMapPosition: { x: 600, y: 100 }, color: 0xff4422,
    connections: ['region_beast'],
  },
  {
    id: 'region_hotspring', name: '溫泉族領地', type: 'side', levelRange: [40, 50],
    description: '隱藏在山谷中的溫泉村，擁有神秘的恢復之泉。',
    bossId: 'r10_boss', monsterIds: [],
    shopItems: ['item_potion_l', 'item_elixir'],
    worldMapPosition: { x: 850, y: 350 }, color: 0x44cccc,
    connections: ['region_merfolk'],
  },
  {
    id: 'region_mountain', name: '高山族領地', type: 'side', levelRange: [50, 60],
    description: '雪山之巔的隱居部族，擁有遠古寶物。',
    bossId: 'r11_boss', monsterIds: [],
    shopItems: ['item_elixir', 'item_revive'],
    worldMapPosition: { x: 880, y: 120 }, color: 0xccccee,
    connections: ['region_giant'],
  },
  {
    id: 'region_demon', name: '魔王城', type: 'final', levelRange: [60, 70],
    description: '一切邪惡的源頭，大魔王的巢穴。',
    bossId: 'r12_boss', monsterIds: [],
    shopItems: [],
    worldMapPosition: { x: 300, y: 480 }, color: 0x440044,
    connections: ['region_undead'],
  },
];

const regionMap = new Map<string, RegionData>();
for (const r of regions) regionMap.set(r.id, r);

export function getRegionById(id: string): RegionData | undefined {
  return regionMap.get(id);
}

export function getAllRegions(): RegionData[] {
  return regions;
}

export function getMainRegions(): RegionData[] {
  return regions.filter(r => r.type === 'main');
}

export function getSideRegions(): RegionData[] {
  return regions.filter(r => r.type === 'side');
}

export function getConnectedRegions(regionId: string): RegionData[] {
  const region = regionMap.get(regionId);
  if (!region) return [];
  return region.connections.map(id => regionMap.get(id)).filter((r): r is RegionData => r !== undefined);
}
