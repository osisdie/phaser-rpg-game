import type { SkillData, Race } from '../../types';

const skills: SkillData[] = [
  // ─── 勇者通用技能 ───
  { id: 'skill_slash', name: '斬擊', description: '強力的一刀', type: 'physical', target: 'single_enemy', element: 'none', mpCost: 3, power: 130, levelRequired: 1 },
  { id: 'skill_power_strike', name: '猛力一擊', description: '全力揮擊', type: 'physical', target: 'single_enemy', element: 'none', mpCost: 8, power: 200, levelRequired: 10 },
  { id: 'skill_heal', name: '治療', description: '恢復少量 HP', type: 'heal', target: 'single_ally', element: 'light', mpCost: 5, power: 60, levelRequired: 3 },
  { id: 'skill_war_cry', name: '戰吼', description: '提升全體攻擊力', type: 'buff', target: 'all_allies', element: 'none', mpCost: 10, power: 20, levelRequired: 15 },
  { id: 'skill_holy_blade', name: '聖光劍', description: '光屬性強力攻擊', type: 'magical', target: 'single_enemy', element: 'light', mpCost: 15, power: 280, levelRequired: 25 },
  { id: 'skill_hero_strike', name: '勇者一擊', description: '勇者的必殺技', type: 'physical', target: 'single_enemy', element: 'light', mpCost: 30, power: 500, levelRequired: 50 },

  // ─── 精靈弓手 ───
  { id: 'skill_elf_arrow', name: '精靈之箭', description: '精準的魔法箭矢', type: 'magical', target: 'single_enemy', element: 'wind', mpCost: 4, power: 140, levelRequired: 1, race: 'elf' },
  { id: 'skill_rain_arrow', name: '箭雨', description: '對全體敵人射出箭雨', type: 'magical', target: 'all_enemies', element: 'wind', mpCost: 12, power: 100, levelRequired: 15, race: 'elf' },
  { id: 'skill_nature_heal', name: '自然恢復', description: '精靈的治癒魔法', type: 'heal', target: 'single_ally', element: 'earth', mpCost: 8, power: 120, levelRequired: 10, race: 'elf' },
  { id: 'skill_elf_ultimate', name: '精靈風暴', description: '召喚精靈之力的終極攻擊', type: 'magical', target: 'all_enemies', element: 'wind', mpCost: 40, power: 350, levelRequired: 60, race: 'elf' },

  // ─── 樹人守衛 ───
  { id: 'skill_bark_shield', name: '樹皮護盾', description: '以堅硬樹皮保護自身', type: 'buff', target: 'self', element: 'earth', mpCost: 5, power: 30, levelRequired: 1, race: 'treant' },
  { id: 'skill_root_strike', name: '根系打擊', description: '地面冒出樹根攻擊', type: 'physical', target: 'single_enemy', element: 'earth', mpCost: 6, power: 150, levelRequired: 10, race: 'treant' },
  { id: 'skill_photosynthesis', name: '光合作用', description: '持續恢復全體 HP', type: 'heal', target: 'all_allies', element: 'earth', mpCost: 15, power: 80, levelRequired: 20, race: 'treant' },
  { id: 'skill_treant_ultimate', name: '大地守護', description: '大地之力的終極防護', type: 'buff', target: 'all_allies', element: 'earth', mpCost: 35, power: 50, levelRequired: 55, race: 'treant' },

  // ─── 獸人戰士 ───
  { id: 'skill_berserk', name: '狂暴', description: '進入狂暴狀態，大幅提升攻擊', type: 'buff', target: 'self', element: 'none', mpCost: 8, power: 50, levelRequired: 1, race: 'beastman' },
  { id: 'skill_frenzy', name: '狂亂打擊', description: '對敵人連續攻擊', type: 'physical', target: 'single_enemy', element: 'none', mpCost: 10, power: 220, levelRequired: 15, race: 'beastman' },
  { id: 'skill_quake', name: '地震踏', description: '猛烈踏地攻擊全體', type: 'physical', target: 'all_enemies', element: 'earth', mpCost: 15, power: 130, levelRequired: 25, race: 'beastman' },
  { id: 'skill_beast_ultimate', name: '獸王之怒', description: '野獸之力的終極爆發', type: 'physical', target: 'all_enemies', element: 'none', mpCost: 40, power: 400, levelRequired: 60, race: 'beastman' },

  // ─── 人魚法師 ───
  { id: 'skill_water_bolt', name: '水彈', description: '發射水屬性魔法', type: 'magical', target: 'single_enemy', element: 'water', mpCost: 5, power: 140, levelRequired: 1, race: 'merfolk' },
  { id: 'skill_tidal_wave', name: '潮汐', description: '水屬性全體攻擊', type: 'magical', target: 'all_enemies', element: 'water', mpCost: 14, power: 110, levelRequired: 20, race: 'merfolk' },
  { id: 'skill_aqua_heal', name: '潤澤之泉', description: '全體恢復大量 HP', type: 'heal', target: 'all_allies', element: 'water', mpCost: 20, power: 150, levelRequired: 15, race: 'merfolk' },
  { id: 'skill_merfolk_ultimate', name: '深海洪流', description: '深海之力的終極魔法', type: 'magical', target: 'all_enemies', element: 'water', mpCost: 45, power: 380, levelRequired: 60, race: 'merfolk' },

  // ─── 巨人鐵匠 ───
  { id: 'skill_heavy_strike', name: '重擊', description: '以巨大力量猛擊', type: 'physical', target: 'single_enemy', element: 'none', mpCost: 7, power: 180, levelRequired: 1, race: 'giant' },
  { id: 'skill_ground_pound', name: '大地震擊', description: '全體物理攻擊', type: 'physical', target: 'all_enemies', element: 'earth', mpCost: 16, power: 140, levelRequired: 20, race: 'giant' },
  { id: 'skill_iron_body', name: '鋼鐵之軀', description: '大幅提升防禦力', type: 'buff', target: 'self', element: 'none', mpCost: 10, power: 40, levelRequired: 15, race: 'giant' },
  { id: 'skill_giant_ultimate', name: '泰坦之拳', description: '巨人族的終極重擊', type: 'physical', target: 'single_enemy', element: 'earth', mpCost: 40, power: 550, levelRequired: 60, race: 'giant' },

  // ─── 矮人工匠 ───
  { id: 'skill_forge_strike', name: '鍛造打擊', description: '用工匠錘頭攻擊', type: 'physical', target: 'single_enemy', element: 'fire', mpCost: 5, power: 150, levelRequired: 1, race: 'dwarf' },
  { id: 'skill_trap', name: '設置陷阱', description: '對敵人設置陷阱', type: 'physical', target: 'single_enemy', element: 'none', mpCost: 8, power: 170, levelRequired: 15, race: 'dwarf' },
  { id: 'skill_reinforce', name: '裝備強化', description: '強化全體防禦力', type: 'buff', target: 'all_allies', element: 'none', mpCost: 12, power: 25, levelRequired: 20, race: 'dwarf' },
  { id: 'skill_dwarf_ultimate', name: '大師鍛造', description: '矮人工藝的終極一擊', type: 'physical', target: 'all_enemies', element: 'fire', mpCost: 38, power: 360, levelRequired: 60, race: 'dwarf' },

  // ─── 不死騎士 ───
  { id: 'skill_shadow_slash', name: '暗影斬', description: '暗屬性攻擊', type: 'magical', target: 'single_enemy', element: 'dark', mpCost: 6, power: 160, levelRequired: 1, race: 'undead' },
  { id: 'skill_drain_life', name: '吸血攻擊', description: '攻擊並吸收 HP', type: 'physical', target: 'single_enemy', element: 'dark', mpCost: 10, power: 140, levelRequired: 15, race: 'undead' },
  { id: 'skill_dark_wave', name: '暗黑波動', description: '全體暗屬性攻擊', type: 'magical', target: 'all_enemies', element: 'dark', mpCost: 18, power: 120, levelRequired: 25, race: 'undead' },
  { id: 'skill_undead_ultimate', name: '冥府審判', description: '亡靈之力的終極魔法', type: 'magical', target: 'all_enemies', element: 'dark', mpCost: 42, power: 370, levelRequired: 60, race: 'undead' },

  // ─── 怪物技能 ───
  { id: 'skill_monster_bite', name: '撕咬', description: '野獸的撕咬', type: 'physical', target: 'single_enemy', element: 'none', mpCost: 0, power: 120, levelRequired: 1 },
  { id: 'skill_monster_fire', name: '火焰吐息', description: '噴出火焰', type: 'magical', target: 'all_enemies', element: 'fire', mpCost: 5, power: 100, levelRequired: 1 },
  { id: 'skill_monster_heal', name: '再生', description: '恢復少量 HP', type: 'heal', target: 'self', element: 'none', mpCost: 5, power: 80, levelRequired: 1 },
  { id: 'skill_boss_smash', name: '毀滅重擊', description: '魔王的強力攻擊', type: 'physical', target: 'single_enemy', element: 'dark', mpCost: 10, power: 200, levelRequired: 1 },
  { id: 'skill_boss_dark_blast', name: '暗黑爆裂', description: '魔王的全體攻擊', type: 'magical', target: 'all_enemies', element: 'dark', mpCost: 20, power: 200, levelRequired: 1 },
];

const skillMap = new Map<string, SkillData>();
for (const s of skills) skillMap.set(s.id, s);

export function getSkillById(id: string): SkillData | undefined {
  return skillMap.get(id);
}

export function getSkillsForRace(race: Race): SkillData[] {
  return skills.filter(s => s.race === race);
}

export function getSkillsForLevel(race: Race, level: number): SkillData[] {
  return skills.filter(s =>
    (s.race === race || (!s.race && race === 'human')) &&
    s.levelRequired === level
  );
}

export function getAllSkills(): SkillData[] {
  return skills;
}
