import type { NPCData } from '../../types';

/** NPC definitions per region — each kingdom has unique cultural NPCs */
export const regionNPCs: Record<string, NPCData[]> = {
  // ─── 勇者王國 — 中世紀人類村莊 ───
  region_hero: [
    { id: 'npc_hero_elder', name: '村長', x: 5, y: 5, spriteColor: 0xffcc00, dialogueId: 'npc_elder_intro', type: 'quest' },
    { id: 'npc_hero_shop', name: '商人', x: 12, y: 8, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_hero_inn', name: '旅店老闆', x: 18, y: 5, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_hero_save', name: '記錄者', x: 5, y: 13, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_hero_villager1', name: '村民', x: 22, y: 5, spriteColor: 0xcccccc, dialogueId: 'npc_generic_villager', type: 'info' },
    { id: 'npc_hero_farmer', name: '農夫', x: 15, y: 14, spriteColor: 0x997744, dialogueId: 'npc_hero_farmer', type: 'info', behavior: 'wander' },
    { id: 'npc_hero_guard', name: '村莊守衛', x: 25, y: 12, spriteColor: 0x6688aa, dialogueId: 'npc_hero_guard', type: 'info', behavior: 'wander' },
    { id: 'npc_hero_child', name: '小孩', x: 8, y: 10, spriteColor: 0xffaacc, dialogueId: 'npc_hero_child', type: 'info', behavior: 'wander' },
  ],

  // ─── 精靈王國 — 古老森林中的精靈城市 ───
  region_elf: [
    { id: 'npc_elf_elder', name: '精靈長老', x: 12, y: 5, spriteColor: 0x44ff44, dialogueId: 'npc_elf_elder', type: 'quest' },
    { id: 'npc_elf_shop', name: '精靈商人', x: 6, y: 10, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_elf_inn', name: '旅店精靈', x: 20, y: 10, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_elf_save', name: '記錄者', x: 22, y: 7, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_elf_companion', name: '艾拉', x: 16, y: 8, spriteColor: 0x44cc44, dialogueId: 'npc_companion_join', type: 'quest' },
    { id: 'npc_elf_bard', name: '精靈樂師', x: 14, y: 14, spriteColor: 0x66dd88, dialogueId: 'npc_elf_bard', type: 'info' },
    { id: 'npc_elf_hunter', name: '精靈獵人', x: 26, y: 12, spriteColor: 0x338844, dialogueId: 'npc_elf_hunter', type: 'info', behavior: 'wander' },
    { id: 'npc_elf_gardener', name: '精靈園丁', x: 8, y: 15, spriteColor: 0x55bb55, dialogueId: 'npc_elf_gardener', type: 'info', behavior: 'wander' },
  ],

  // ─── 樹人王國 — 巨大古樹中的空中城市 ───
  region_treant: [
    { id: 'npc_treant_shop', name: '樹靈商人', x: 12, y: 8, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_treant_inn', name: '樹洞旅館主人', x: 18, y: 5, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_treant_save', name: '記錄者', x: 22, y: 7, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_treant_keeper', name: '樹人守護者', x: 7, y: 12, spriteColor: 0x336622, dialogueId: 'npc_treant_keeper', type: 'info', behavior: 'wander' },
    { id: 'npc_treant_fairy', name: '花精靈', x: 15, y: 14, spriteColor: 0xffaaee, dialogueId: 'npc_treant_fairy', type: 'info', behavior: 'wander' },
    { id: 'npc_treant_mushroom', name: '蘑菇採集者', x: 25, y: 14, spriteColor: 0xbb8844, dialogueId: 'npc_treant_mushroom', type: 'info', behavior: 'wander' },
  ],

  // ─── 獸人王國 — 草原上的戰士部族 ───
  region_beast: [
    { id: 'npc_beast_shop', name: '獸人商販', x: 12, y: 8, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_beast_inn', name: '野營旅店主', x: 18, y: 5, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_beast_save', name: '記錄者', x: 22, y: 7, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_beast_warrior', name: '獸人戰士', x: 7, y: 10, spriteColor: 0xcc6633, dialogueId: 'npc_beast_warrior', type: 'info', behavior: 'wander' },
    { id: 'npc_beast_hunter', name: '獸人獵人', x: 26, y: 12, spriteColor: 0x886633, dialogueId: 'npc_beast_hunter', type: 'info', behavior: 'wander' },
    { id: 'npc_beast_smith', name: '獸人鍛造師', x: 15, y: 14, spriteColor: 0xaa5522, dialogueId: 'npc_beast_smith', type: 'info' },
  ],

  // ─── 人魚王國 — 海底水晶宮殿 ───
  region_merfolk: [
    { id: 'npc_merfolk_shop', name: '珍珠商人', x: 12, y: 8, spriteColor: 0x88ccff, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_merfolk_inn', name: '海螺旅館主人', x: 18, y: 5, spriteColor: 0x44aacc, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_merfolk_save', name: '記錄者', x: 22, y: 7, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_merfolk_singer', name: '人魚歌手', x: 14, y: 14, spriteColor: 0x66ccee, dialogueId: 'npc_merfolk_singer', type: 'info' },
    { id: 'npc_merfolk_fisher', name: '人魚漁夫', x: 7, y: 12, spriteColor: 0x4488aa, dialogueId: 'npc_merfolk_fisher', type: 'info', behavior: 'wander' },
    { id: 'npc_merfolk_sculptor', name: '珊瑚雕刻師', x: 25, y: 14, spriteColor: 0xff8866, dialogueId: 'npc_merfolk_sculptor', type: 'info' },
  ],

  // ─── 巨人王國 — 山巔巨大城堡 ───
  region_giant: [
    { id: 'npc_giant_shop', name: '巨人商人', x: 12, y: 8, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_giant_inn', name: '巨人旅店主', x: 18, y: 5, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_giant_save', name: '記錄者', x: 22, y: 7, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_giant_mason', name: '巨人石匠', x: 7, y: 12, spriteColor: 0x888888, dialogueId: 'npc_giant_mason', type: 'info' },
    { id: 'npc_giant_cook', name: '巨人廚師', x: 15, y: 14, spriteColor: 0xeebb88, dialogueId: 'npc_giant_cook', type: 'info', behavior: 'wander' },
    { id: 'npc_giant_guard', name: '巨人守衛', x: 26, y: 10, spriteColor: 0x667788, dialogueId: 'npc_giant_guard', type: 'info', behavior: 'wander' },
  ],

  // ─── 矮人王國 — 地下礦脈城市 ───
  region_dwarf: [
    { id: 'npc_dwarf_shop', name: '矮人商人', x: 12, y: 8, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_dwarf_inn', name: '矮人酒館主人', x: 18, y: 5, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_dwarf_save', name: '記錄者', x: 22, y: 7, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_dwarf_forge', name: '矮人鑄造師', x: 7, y: 10, spriteColor: 0xff6644, dialogueId: 'npc_dwarf_forge', type: 'info' },
    { id: 'npc_dwarf_miner', name: '矮人礦工', x: 15, y: 14, spriteColor: 0x886644, dialogueId: 'npc_dwarf_miner', type: 'info', behavior: 'wander' },
    { id: 'npc_dwarf_brewer', name: '矮人釀酒師', x: 25, y: 12, spriteColor: 0xccaa44, dialogueId: 'npc_dwarf_brewer', type: 'info' },
  ],

  // ─── 不死王國 — 永恆黑暗的亡靈之地 ───
  region_undead: [
    { id: 'npc_undead_shop', name: '亡靈商人', x: 12, y: 8, spriteColor: 0x88aa88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_undead_inn', name: '幽靈旅館主', x: 18, y: 5, spriteColor: 0xaa88cc, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_undead_save', name: '記錄者', x: 22, y: 7, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_undead_scholar', name: '幽靈學者', x: 7, y: 12, spriteColor: 0x8866aa, dialogueId: 'npc_undead_scholar', type: 'info', behavior: 'wander' },
    { id: 'npc_undead_knight', name: '骷髏騎士', x: 26, y: 10, spriteColor: 0xccccaa, dialogueId: 'npc_undead_knight', type: 'info', behavior: 'wander' },
    { id: 'npc_undead_poet', name: '亡靈詩人', x: 14, y: 14, spriteColor: 0x9977aa, dialogueId: 'npc_undead_poet', type: 'info' },
  ],

  // ─── 火山族領地 — 活火山周圍的部族聚落 ───
  region_volcano: [
    { id: 'npc_volcano_shop', name: '火族商販', x: 12, y: 8, spriteColor: 0xff8844, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_volcano_inn', name: '火山旅店主', x: 18, y: 5, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_volcano_save', name: '記錄者', x: 22, y: 7, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_volcano_dancer', name: '火焰舞者', x: 14, y: 14, spriteColor: 0xff4422, dialogueId: 'npc_volcano_dancer', type: 'info', behavior: 'wander' },
    { id: 'npc_volcano_forge', name: '熔岩鍛造師', x: 7, y: 10, spriteColor: 0xcc4411, dialogueId: 'npc_volcano_forge', type: 'info' },
    { id: 'npc_volcano_priest', name: '火山祭司', x: 25, y: 12, spriteColor: 0xff6633, dialogueId: 'npc_volcano_priest', type: 'info' },
  ],

  // ─── 溫泉族領地 — 山谷中的溫泉療養村 ───
  region_hotspring: [
    { id: 'npc_hotspring_shop', name: '溫泉商人', x: 12, y: 8, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_hotspring_inn', name: '溫泉旅館主人', x: 18, y: 5, spriteColor: 0x44cccc, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_hotspring_save', name: '記錄者', x: 22, y: 7, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_hotspring_herbalist', name: '藥草師', x: 7, y: 12, spriteColor: 0x55aa55, dialogueId: 'npc_hotspring_herbalist', type: 'info', behavior: 'wander' },
    { id: 'npc_hotspring_attendant', name: '溫泉管理員', x: 14, y: 14, spriteColor: 0x88dddd, dialogueId: 'npc_hotspring_attendant', type: 'info' },
    { id: 'npc_hotspring_traveler', name: '疲憊旅人', x: 25, y: 14, spriteColor: 0xbbaa88, dialogueId: 'npc_hotspring_traveler', type: 'info' },
  ],

  // ─── 高山族領地 — 雪山之巔的隱居部族 ───
  region_mountain: [
    { id: 'npc_mountain_shop', name: '高山商人', x: 12, y: 8, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_mountain_inn', name: '山頂小屋主人', x: 18, y: 5, spriteColor: 0xaabbcc, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_mountain_save', name: '記錄者', x: 22, y: 7, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_mountain_guide', name: '登山嚮導', x: 7, y: 12, spriteColor: 0x8899aa, dialogueId: 'npc_mountain_guide', type: 'info', behavior: 'wander' },
    { id: 'npc_mountain_hermit', name: '隱士', x: 26, y: 14, spriteColor: 0x889988, dialogueId: 'npc_mountain_hermit', type: 'info' },
    { id: 'npc_mountain_falcon', name: '鷹匠', x: 14, y: 14, spriteColor: 0x998877, dialogueId: 'npc_mountain_falcon', type: 'info' },
  ],

  // ─── 魔王城 — 邪惡的最終堡壘 ───
  region_demon: [
    { id: 'npc_demon_shop', name: '暗商', x: 12, y: 8, spriteColor: 0x885588, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_demon_inn', name: '地牢看守', x: 18, y: 5, spriteColor: 0x664466, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_demon_save', name: '記錄者', x: 22, y: 7, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_demon_servant', name: '暗影僕從', x: 7, y: 12, spriteColor: 0x442244, dialogueId: 'npc_demon_servant', type: 'info', behavior: 'wander' },
    { id: 'npc_demon_guard', name: '魔族衛兵', x: 26, y: 10, spriteColor: 0x553355, dialogueId: 'npc_demon_guard', type: 'info', behavior: 'wander' },
    { id: 'npc_demon_prisoner', name: '被囚勇者', x: 14, y: 14, spriteColor: 0xaa8866, dialogueId: 'npc_demon_prisoner', type: 'info' },
  ],
};

export function getNPCsForRegion(regionId: string): NPCData[] {
  return regionNPCs[regionId] ?? [];
}
