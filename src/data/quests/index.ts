import type { QuestData } from '../../types';

const quests: QuestData[] = [
  // ─── 主線 ───
  {
    id: 'quest_prologue', name: '王國的陷落', description: '勇者王國已被魔王佔領，你必須踏上旅程尋求幫助。',
    type: 'main', chapter: 0,
    objectives: [
      { id: 'escape', description: '離開勇者王國', type: 'explore_area', target: 'region_hero', count: 1, current: 0 },
    ],
    rewards: { exp: 50, gold: 50, items: [] },
  },
  {
    id: 'quest_ch1_elf', name: '精靈王國的危機', description: '精靈王國正遭受腐化精靈的威脅，擊敗入侵者來贏得精靈族的信任。',
    type: 'main', chapter: 1, prerequisite: 'quest_prologue',
    objectives: [
      { id: 'talk_elder', description: '與精靈長老交談', type: 'talk_npc', target: 'elf_elder', count: 1, current: 0 },
      { id: 'defeat_boss', description: '擊敗腐化精靈王', type: 'defeat_boss', target: 'r2_boss', count: 1, current: 0 },
    ],
    rewards: { exp: 200, gold: 300, items: [{ itemId: 'item_potion_m', quantity: 5 }] },
  },
  {
    id: 'quest_ch2_treant', name: '巨木城的腐朽', description: '樹人王國的古樹正在枯死，找出背後的原因。',
    type: 'main', chapter: 2, prerequisite: 'quest_ch1_elf',
    objectives: [
      { id: 'defeat_boss', description: '擊敗腐朽古樹', type: 'defeat_boss', target: 'r3_boss', count: 1, current: 0 },
    ],
    rewards: { exp: 400, gold: 500, items: [{ itemId: 'item_ether_m', quantity: 3 }] },
  },
  {
    id: 'quest_ch3_beast', name: '草原的咆哮', description: '獸人族被魔獸將軍統治，證明你的力量。',
    type: 'main', chapter: 3, prerequisite: 'quest_ch2_treant',
    objectives: [
      { id: 'defeat_boss', description: '擊敗魔獸將軍', type: 'defeat_boss', target: 'r4_boss', count: 1, current: 0 },
    ],
    rewards: { exp: 600, gold: 800, items: [{ itemId: 'equip_silver_sword', quantity: 1 }] },
  },
  {
    id: 'quest_ch4_merfolk', name: '深海的呼喚', description: '人魚王國的水晶宮殿被深海魔龍佔據。',
    type: 'main', chapter: 4, prerequisite: 'quest_ch3_beast',
    objectives: [
      { id: 'defeat_boss', description: '擊敗深海魔龍', type: 'defeat_boss', target: 'r5_boss', count: 1, current: 0 },
    ],
    rewards: { exp: 900, gold: 1200, items: [{ itemId: 'item_elixir', quantity: 2 }] },
  },
  {
    id: 'quest_ch5_giant', name: '山巔的考驗', description: '巨人王國被山嶽魔王封鎖，解放這座山城。',
    type: 'main', chapter: 5, prerequisite: 'quest_ch4_merfolk',
    objectives: [
      { id: 'defeat_boss', description: '擊敗山嶽魔王', type: 'defeat_boss', target: 'r6_boss', count: 1, current: 0 },
    ],
    rewards: { exp: 1200, gold: 1800, items: [{ itemId: 'equip_mithril_sword', quantity: 1 }] },
  },
  {
    id: 'quest_ch6_dwarf', name: '地下城的火焰', description: '矮人的地下礦城被鑄造魔將控制。',
    type: 'main', chapter: 6, prerequisite: 'quest_ch5_giant',
    objectives: [
      { id: 'defeat_boss', description: '擊敗鑄造魔將', type: 'defeat_boss', target: 'r7_boss', count: 1, current: 0 },
    ],
    rewards: { exp: 1600, gold: 2500, items: [{ itemId: 'equip_dragon_armor', quantity: 1 }] },
  },
  {
    id: 'quest_ch7_undead', name: '亡靈的國度', description: '最後一個盟友就在不死王國，但那裡充滿了亡靈。',
    type: 'main', chapter: 7, prerequisite: 'quest_ch6_dwarf',
    objectives: [
      { id: 'defeat_boss', description: '擊敗不死魔將', type: 'defeat_boss', target: 'r8_boss', count: 1, current: 0 },
    ],
    rewards: { exp: 2000, gold: 3000, items: [{ itemId: 'equip_holy_sword', quantity: 1 }] },
  },
  {
    id: 'quest_final', name: '最終決戰', description: '帶著七國的盟友，回到勇者王國，擊敗大魔王！',
    type: 'main', chapter: 8, prerequisite: 'quest_ch7_undead',
    objectives: [
      { id: 'defeat_boss', description: '擊敗大魔王', type: 'defeat_boss', target: 'r12_boss', count: 1, current: 0 },
    ],
    rewards: { exp: 9999, gold: 9999, items: [{ itemId: 'equip_legendary_sword', quantity: 1 }] },
  },
  // ─── 支線 ───
  {
    id: 'quest_side_volcano', name: '火山的秘密', description: '探索火山族領地，學習火焰之力。',
    type: 'side', chapter: 4,
    objectives: [
      { id: 'defeat_boss', description: '擊敗火山之主', type: 'defeat_boss', target: 'r9_boss', count: 1, current: 0 },
    ],
    rewards: { exp: 800, gold: 1000, items: [{ itemId: 'item_elixir', quantity: 3 }] },
  },
  {
    id: 'quest_side_hotspring', name: '恢復之泉', description: '找到傳說中的溫泉，永久提升體力上限。',
    type: 'side', chapter: 5,
    objectives: [
      { id: 'defeat_boss', description: '擊敗溫泉守護者', type: 'defeat_boss', target: 'r10_boss', count: 1, current: 0 },
    ],
    rewards: { exp: 1000, gold: 1500, items: [{ itemId: 'item_elixir', quantity: 5 }] },
  },
  {
    id: 'quest_side_mountain', name: '雪山的挑戰', description: '登上雪山之巔，尋找遠古寶物。',
    type: 'side', chapter: 6,
    objectives: [
      { id: 'defeat_boss', description: '擊敗冰峰之王', type: 'defeat_boss', target: 'r11_boss', count: 1, current: 0 },
    ],
    rewards: { exp: 1500, gold: 2000, items: [{ itemId: 'equip_legendary_armor', quantity: 1 }] },
  },
];

const questMap = new Map<string, QuestData>();
for (const q of quests) questMap.set(q.id, q);

export function getQuestById(id: string): QuestData | undefined {
  return questMap.get(id);
}

export function getAllQuests(): QuestData[] {
  return quests;
}

export function getQuestsForChapter(chapter: number): QuestData[] {
  return quests.filter(q => q.chapter === chapter);
}
