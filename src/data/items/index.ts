import type { ItemData, EquipmentItem, EquipmentSlot, EquipmentTier } from '../../types';

// ─── 消耗品 ───
const consumables: ItemData[] = [
  { id: 'item_potion_s', name: '小型藥水', type: 'consumable', description: '恢復 50 HP', price: 30, sellPrice: 15, effect: { type: 'heal_hp', value: 50, target: 'single' }, stackable: true, maxStack: 99 },
  { id: 'item_potion_m', name: '中型藥水', type: 'consumable', description: '恢復 150 HP', price: 100, sellPrice: 50, effect: { type: 'heal_hp', value: 150, target: 'single' }, stackable: true, maxStack: 99 },
  { id: 'item_potion_l', name: '大型藥水', type: 'consumable', description: '恢復 400 HP', price: 300, sellPrice: 150, effect: { type: 'heal_hp', value: 400, target: 'single' }, stackable: true, maxStack: 99 },
  { id: 'item_ether_s', name: '小型魔力水', type: 'consumable', description: '恢復 30 MP', price: 50, sellPrice: 25, effect: { type: 'heal_mp', value: 30, target: 'single' }, stackable: true, maxStack: 99 },
  { id: 'item_ether_m', name: '中型魔力水', type: 'consumable', description: '恢復 80 MP', price: 150, sellPrice: 75, effect: { type: 'heal_mp', value: 80, target: 'single' }, stackable: true, maxStack: 99 },
  { id: 'item_elixir', name: '靈藥', type: 'consumable', description: '完全恢復 HP 和 MP', price: 1000, sellPrice: 500, effect: { type: 'full_restore', value: 0, target: 'single' }, stackable: true, maxStack: 10 },
  { id: 'item_revive', name: '復活羽毛', type: 'consumable', description: '復活倒下的夥伴（50% HP）', price: 200, sellPrice: 100, effect: { type: 'revive', value: 50, target: 'single' }, stackable: true, maxStack: 10 },
];

// ─── 裝備：生成 8 階 × 5 插槽 ───
const tierData: { tier: EquipmentTier; mult: number; price: number; prefix: string }[] = [
  { tier: 'wood', mult: 1, price: 50, prefix: '木製' },
  { tier: 'iron', mult: 2, price: 150, prefix: '鐵製' },
  { tier: 'steel', mult: 3, price: 400, prefix: '鋼製' },
  { tier: 'silver', mult: 4.5, price: 800, prefix: '銀製' },
  { tier: 'mithril', mult: 6, price: 1500, prefix: '秘銀' },
  { tier: 'dragon', mult: 8, price: 3000, prefix: '龍族' },
  { tier: 'holy', mult: 10, price: 5000, prefix: '聖潔' },
  { tier: 'legendary', mult: 13, price: 10000, prefix: '傳說' },
];

const slotBase: { slot: EquipmentSlot; idSuffix: string; name: string; mainStat: keyof EquipmentItem['stats']; baseValue: number }[] = [
  { slot: 'weapon', idSuffix: 'sword', name: '劍', mainStat: 'atk', baseValue: 5 },
  { slot: 'helmet', idSuffix: 'helmet', name: '頭盔', mainStat: 'def', baseValue: 2 },
  { slot: 'armor', idSuffix: 'armor', name: '鎧甲', mainStat: 'def', baseValue: 4 },
  { slot: 'shield', idSuffix: 'shield', name: '盾牌', mainStat: 'def', baseValue: 3 },
  { slot: 'boots', idSuffix: 'boots', name: '靴子', mainStat: 'agi', baseValue: 2 },
];

const equipments: EquipmentItem[] = [];

for (const td of tierData) {
  for (const sb of slotBase) {
    const value = Math.floor(sb.baseValue * td.mult);
    const stats: Partial<Record<string, number>> = {};
    stats[sb.mainStat] = value;

    // Secondary stats
    if (sb.slot === 'armor') stats['maxHP'] = Math.floor(value * 3);
    if (sb.slot === 'boots') stats['agi'] = value;

    equipments.push({
      id: `equip_${td.tier}_${sb.idSuffix}`,
      name: `${td.prefix}${sb.name}`,
      slot: sb.slot,
      tier: td.tier,
      stats: stats as any,
      price: td.price,
      description: `${td.prefix}${sb.name}`,
    });
  }
}

// Lookup maps
const itemMap = new Map<string, ItemData>();
for (const item of consumables) itemMap.set(item.id, item);

const equipMap = new Map<string, EquipmentItem>();
for (const eq of equipments) equipMap.set(eq.id, eq);

// Also add equipment as items for inventory display
for (const eq of equipments) {
  itemMap.set(eq.id, {
    id: eq.id,
    name: eq.name,
    type: 'equipment',
    description: eq.description,
    price: eq.price,
    sellPrice: Math.floor(eq.price / 2),
    stackable: false,
    maxStack: 1,
  });
}

export function getItemById(id: string): ItemData | undefined {
  return itemMap.get(id);
}

export function getEquipmentById(id: string): EquipmentItem | undefined {
  return equipMap.get(id);
}

export function getAllConsumables(): ItemData[] {
  return consumables;
}

export function getAllEquipments(): EquipmentItem[] {
  return equipments;
}

export function getEquipmentsByTier(tier: EquipmentTier): EquipmentItem[] {
  return equipments.filter(e => e.tier === tier);
}

export function getEquipmentsBySlot(slot: EquipmentSlot): EquipmentItem[] {
  return equipments.filter(e => e.slot === slot);
}
