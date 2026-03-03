import type { NPCData } from '../../types';

/**
 * NPC definitions per region — each kingdom has unique cultural NPCs.
 *
 * Town map: 40×32 grid (TILE_SIZE=64)
 * Castle 5×5 at (18,2)-(22,6), entrance at y=7
 * Building positions & door fronts:
 *   Inn  (pos 0): bld (4,6)   → door (5, 8)
 *   House(pos 1): bld (10,8)  → door (11,10)
 *   Shop (pos 2): bld (28,6)  → door (29,8)
 *   House(pos 3): bld (32,8)  → door (33,10)
 *   Church(pos4): bld (4,20)  → door (5,22)
 *   House(pos 5): bld (10,20) → door (11,22)
 *   House(pos 6): bld (28,20) → door (29,22)
 *   House(pos 7): bld (32,20) → door (33,22)
 * Main path: horizontal y=16, vertical x=20
 * Gate entrance: y≈27 (south)
 * Valid NPC range: x:1-38, y:1-30
 */
export const regionNPCs: Record<string, NPCData[]> = {
  // ─── 勇者王國 — 中世紀人類村莊 ───
  region_hero: [
    { id: 'npc_hero_king', name: '國王 亞瑟', x: 20, y: 7, spriteColor: 0xffdd44, dialogueId: 'npc_king_hero', type: 'quest' },
    { id: 'npc_hero_royal_guard1', name: '禁衛隊長', x: 19, y: 7, spriteColor: 0x4466aa, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_hero_royal_guard2', name: '禁衛兵', x: 21, y: 7, spriteColor: 0x4466aa, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_hero_elder', name: '王室長老', x: 12, y: 12, spriteColor: 0xffcc00, dialogueId: 'npc_elder_intro', type: 'elder' },
    { id: 'npc_hero_shop', name: '商人', x: 29, y: 9, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_hero_inn', name: '旅店老闆', x: 5, y: 9, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_hero_save', name: '記錄者', x: 5, y: 23, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_hero_villager1', name: '村民', x: 33, y: 11, spriteColor: 0xcccccc, dialogueId: 'npc_generic_villager', type: 'info' },
    { id: 'npc_hero_farmer', name: '農夫', x: 20, y: 18, spriteColor: 0x997744, dialogueId: 'npc_hero_farmer', type: 'info', behavior: 'wander' },
    { id: 'npc_hero_guard', name: '城門守衛', x: 20, y: 27, spriteColor: 0x6688aa, dialogueId: 'npc_gate_guard', type: 'info' },
  ],

  // ─── 精靈王國 — 古老森林中的精靈城市 ───
  region_elf: [
    { id: 'npc_elf_king', name: '精靈王 艾瑞隆', x: 20, y: 7, spriteColor: 0x22cc44, dialogueId: 'npc_king_elf', type: 'quest' },
    { id: 'npc_elf_guard1', name: '森林守衛', x: 19, y: 7, spriteColor: 0x227744, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_elf_guard2', name: '森林守衛', x: 21, y: 7, spriteColor: 0x227744, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_elf_elder', name: '精靈長老', x: 12, y: 12, spriteColor: 0x44ff44, dialogueId: 'npc_elf_elder', type: 'elder' },
    { id: 'npc_elf_shop', name: '精靈商人', x: 29, y: 9, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_elf_inn', name: '旅店精靈', x: 5, y: 9, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_elf_save', name: '記錄者', x: 5, y: 23, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_elf_companion', name: '艾拉', x: 12, y: 23, spriteColor: 0x44cc44, dialogueId: 'npc_companion_join', type: 'quest' },
    { id: 'npc_elf_hunter', name: '精靈獵人', x: 29, y: 23, spriteColor: 0x338844, dialogueId: 'npc_elf_hunter', type: 'info', behavior: 'wander' },
    { id: 'npc_elf_gardener', name: '精靈園丁', x: 33, y: 23, spriteColor: 0x55bb55, dialogueId: 'npc_elf_gardener', type: 'info', behavior: 'wander' },
  ],

  // ─── 樹人王國 — 巨大古樹中的空中城市 ───
  region_treant: [
    { id: 'npc_treant_king', name: '樹人王 歐克斯', x: 20, y: 7, spriteColor: 0x226622, dialogueId: 'npc_king_treant', type: 'quest' },
    { id: 'npc_treant_guard1', name: '樹衛兵', x: 19, y: 7, spriteColor: 0x335522, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_treant_shop', name: '樹靈商人', x: 29, y: 9, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_treant_inn', name: '樹洞旅館主人', x: 5, y: 9, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_treant_save', name: '記錄者', x: 5, y: 23, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_treant_keeper', name: '樹人守護者', x: 33, y: 11, spriteColor: 0x336622, dialogueId: 'npc_treant_keeper', type: 'info', behavior: 'wander' },
    { id: 'npc_treant_fairy', name: '花精靈', x: 29, y: 23, spriteColor: 0xffaaee, dialogueId: 'npc_treant_fairy', type: 'info', behavior: 'wander' },
  ],

  // ─── 獸人王國 — 草原上的戰士部族 ───
  region_beast: [
    { id: 'npc_beast_king', name: '獸王 格羅姆', x: 20, y: 7, spriteColor: 0xcc8833, dialogueId: 'npc_king_beast', type: 'quest' },
    { id: 'npc_beast_guard1', name: '獸人衛兵', x: 19, y: 7, spriteColor: 0x996633, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_beast_shop', name: '獸人商販', x: 29, y: 9, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_beast_inn', name: '野營旅店主', x: 5, y: 9, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_beast_save', name: '記錄者', x: 5, y: 23, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_beast_warrior', name: '獸人戰士', x: 33, y: 11, spriteColor: 0xcc6633, dialogueId: 'npc_beast_warrior', type: 'info', behavior: 'wander' },
    { id: 'npc_beast_hunter', name: '獸人獵人', x: 29, y: 23, spriteColor: 0x886633, dialogueId: 'npc_beast_hunter', type: 'info', behavior: 'wander' },
  ],

  // ─── 人魚王國 — 海底水晶宮殿 ───
  region_merfolk: [
    { id: 'npc_merfolk_king', name: '人魚王 尼普頓', x: 20, y: 7, spriteColor: 0x44aaee, dialogueId: 'npc_king_merfolk', type: 'quest' },
    { id: 'npc_merfolk_guard1', name: '海衛兵', x: 19, y: 7, spriteColor: 0x3388aa, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_merfolk_shop', name: '珍珠商人', x: 29, y: 9, spriteColor: 0x88ccff, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_merfolk_inn', name: '海螺旅館主人', x: 5, y: 9, spriteColor: 0x44aacc, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_merfolk_save', name: '記錄者', x: 5, y: 23, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_merfolk_singer', name: '人魚歌手', x: 12, y: 23, spriteColor: 0x66ccee, dialogueId: 'npc_merfolk_singer', type: 'info' },
    { id: 'npc_merfolk_fisher', name: '人魚漁夫', x: 33, y: 11, spriteColor: 0x4488aa, dialogueId: 'npc_merfolk_fisher', type: 'info', behavior: 'wander' },
  ],

  // ─── 巨人王國 — 山巔巨大城堡 ───
  region_giant: [
    { id: 'npc_giant_king', name: '巨人王 泰坦', x: 20, y: 7, spriteColor: 0x889999, dialogueId: 'npc_king_giant', type: 'quest' },
    { id: 'npc_giant_guard1', name: '巨人衛兵', x: 19, y: 7, spriteColor: 0x667788, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_giant_shop', name: '巨人商人', x: 29, y: 9, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_giant_inn', name: '巨人旅店主', x: 5, y: 9, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_giant_save', name: '記錄者', x: 5, y: 23, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_giant_mason', name: '巨人石匠', x: 33, y: 11, spriteColor: 0x888888, dialogueId: 'npc_giant_mason', type: 'info' },
    { id: 'npc_giant_cook', name: '巨人廚師', x: 29, y: 23, spriteColor: 0xeebb88, dialogueId: 'npc_giant_cook', type: 'info', behavior: 'wander' },
  ],

  // ─── 矮人王國 — 地下礦脈城市 ───
  region_dwarf: [
    { id: 'npc_dwarf_king', name: '矮人王 杜林', x: 20, y: 7, spriteColor: 0xcc8844, dialogueId: 'npc_king_dwarf', type: 'quest' },
    { id: 'npc_dwarf_guard1', name: '矮人衛兵', x: 19, y: 7, spriteColor: 0x886644, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_dwarf_shop', name: '矮人商人', x: 29, y: 9, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_dwarf_inn', name: '矮人酒館主人', x: 5, y: 9, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_dwarf_save', name: '記錄者', x: 5, y: 23, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_dwarf_forge', name: '矮人鑄造師', x: 12, y: 12, spriteColor: 0xff6644, dialogueId: 'npc_dwarf_forge', type: 'info' },
    { id: 'npc_dwarf_miner', name: '矮人礦工', x: 12, y: 23, spriteColor: 0x886644, dialogueId: 'npc_dwarf_miner', type: 'info', behavior: 'wander' },
  ],

  // ─── 不死王國 — 永恆黑暗的亡靈之地 ───
  region_undead: [
    { id: 'npc_undead_king', name: '亡靈王 莫爾德', x: 20, y: 7, spriteColor: 0x664488, dialogueId: 'npc_king_undead', type: 'quest' },
    { id: 'npc_undead_guard1', name: '骷髏衛兵', x: 19, y: 7, spriteColor: 0xccccaa, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_undead_shop', name: '亡靈商人', x: 29, y: 9, spriteColor: 0x88aa88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_undead_inn', name: '幽靈旅館主', x: 5, y: 9, spriteColor: 0xaa88cc, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_undead_save', name: '記錄者', x: 5, y: 23, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_undead_scholar', name: '幽靈學者', x: 33, y: 11, spriteColor: 0x8866aa, dialogueId: 'npc_undead_scholar', type: 'info', behavior: 'wander' },
    { id: 'npc_undead_knight', name: '骷髏騎士', x: 29, y: 23, spriteColor: 0xccccaa, dialogueId: 'npc_undead_knight', type: 'info', behavior: 'wander' },
  ],

  // ─── 火山族領地 — 活火山周圍的部族聚落 ───
  region_volcano: [
    { id: 'npc_volcano_king', name: '火族長 伊格尼斯', x: 20, y: 7, spriteColor: 0xff6622, dialogueId: 'npc_king_volcano', type: 'quest' },
    { id: 'npc_volcano_guard1', name: '火族衛兵', x: 19, y: 7, spriteColor: 0xcc4411, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_volcano_shop', name: '火族商販', x: 29, y: 9, spriteColor: 0xff8844, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_volcano_inn', name: '火山旅店主', x: 5, y: 9, spriteColor: 0xffaa44, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_volcano_save', name: '記錄者', x: 5, y: 23, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_volcano_dancer', name: '火焰舞者', x: 12, y: 23, spriteColor: 0xff4422, dialogueId: 'npc_volcano_dancer', type: 'info', behavior: 'wander' },
    { id: 'npc_volcano_forge', name: '熔岩鍛造師', x: 12, y: 12, spriteColor: 0xcc4411, dialogueId: 'npc_volcano_forge', type: 'info' },
  ],

  // ─── 溫泉族領地 — 山谷中的溫泉療養村 ───
  region_hotspring: [
    { id: 'npc_hotspring_king', name: '溫泉族長 泉月', x: 20, y: 7, spriteColor: 0x44cccc, dialogueId: 'npc_king_hotspring', type: 'quest' },
    { id: 'npc_hotspring_guard1', name: '溫泉守護者', x: 19, y: 7, spriteColor: 0x338888, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_hotspring_shop', name: '溫泉商人', x: 29, y: 9, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_hotspring_inn', name: '溫泉旅館主人', x: 5, y: 9, spriteColor: 0x44cccc, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_hotspring_save', name: '記錄者', x: 5, y: 23, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_hotspring_herbalist', name: '藥草師', x: 33, y: 11, spriteColor: 0x55aa55, dialogueId: 'npc_hotspring_herbalist', type: 'info', behavior: 'wander' },
    { id: 'npc_hotspring_attendant', name: '溫泉管理員', x: 12, y: 23, spriteColor: 0x88dddd, dialogueId: 'npc_hotspring_attendant', type: 'info' },
  ],

  // ─── 高山族領地 — 雪山之巔的隱居部族 ───
  region_mountain: [
    { id: 'npc_mountain_king', name: '山族長 蒼嵐', x: 20, y: 7, spriteColor: 0xaabbdd, dialogueId: 'npc_king_mountain', type: 'quest' },
    { id: 'npc_mountain_guard1', name: '山嶺衛兵', x: 19, y: 7, spriteColor: 0x8899aa, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_mountain_shop', name: '高山商人', x: 29, y: 9, spriteColor: 0x88ff88, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_mountain_inn', name: '山頂小屋主人', x: 5, y: 9, spriteColor: 0xaabbcc, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_mountain_save', name: '記錄者', x: 5, y: 23, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_mountain_guide', name: '登山嚮導', x: 33, y: 11, spriteColor: 0x8899aa, dialogueId: 'npc_mountain_guide', type: 'info', behavior: 'wander' },
    { id: 'npc_mountain_hermit', name: '隱士', x: 29, y: 23, spriteColor: 0x889988, dialogueId: 'npc_mountain_hermit', type: 'info' },
  ],

  // ─── 魔王城 — 邪惡的最終堡壘 ───
  region_demon: [
    { id: 'npc_demon_king', name: '魔王 撒旦魯斯', x: 20, y: 7, spriteColor: 0x880088, dialogueId: 'npc_king_demon', type: 'quest' },
    { id: 'npc_demon_guard1', name: '魔族禁衛', x: 19, y: 7, spriteColor: 0x553355, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_demon_guard2', name: '魔族禁衛', x: 21, y: 7, spriteColor: 0x553355, dialogueId: 'npc_royal_guard', type: 'info' },
    { id: 'npc_demon_shop', name: '暗商', x: 29, y: 9, spriteColor: 0x885588, dialogueId: 'npc_shop', type: 'shop' },
    { id: 'npc_demon_inn', name: '地牢看守', x: 5, y: 9, spriteColor: 0x664466, dialogueId: 'npc_inn', type: 'inn' },
    { id: 'npc_demon_save', name: '記錄者', x: 5, y: 23, spriteColor: 0x8888ff, dialogueId: 'npc_save', type: 'save' },
    { id: 'npc_demon_servant', name: '暗影僕從', x: 12, y: 23, spriteColor: 0x442244, dialogueId: 'npc_demon_servant', type: 'info', behavior: 'wander' },
    { id: 'npc_demon_prisoner', name: '被囚勇者', x: 29, y: 23, spriteColor: 0xaa8866, dialogueId: 'npc_demon_prisoner', type: 'info' },
  ],
};

export function getNPCsForRegion(regionId: string): NPCData[] {
  return regionNPCs[regionId] ?? [];
}
