import type { Stats, Difficulty, StatsGrowth } from '../types';

/** 傷害公式: ATK × (1 + random(0, 0.2)) - DEF × 0.5，最低 1 */
export function calculateDamage(attackerAtk: number, defenderDef: number): number {
  const raw = attackerAtk * (1 + Math.random() * 0.2) - defenderDef * 0.5;
  return Math.max(1, Math.floor(raw));
}

/** 技能傷害: power × levelScale × ATK / 100 × (1 + random(0, 0.15)) - DEF × 0.3 */
export function calculateSkillDamage(power: number, attackerAtk: number, defenderDef: number, attackerLevel = 1): number {
  const levelScale = 1 + (attackerLevel - 1) * 0.015; // Lv1=1.0, Lv50=1.735, Lv70=2.035
  const raw = (power * levelScale * attackerAtk / 100) * (1 + Math.random() * 0.15) - defenderDef * 0.3;
  return Math.max(1, Math.floor(raw));
}

/** 回復量: power × (1 + level × 0.02) × (1 + random(0, 0.1)) */
export function calculateHeal(power: number, healerLevel = 1): number {
  const levelScale = 1 + (healerLevel - 1) * 0.02; // Lv1=1.0, Lv50=1.98, Lv70=2.38
  return Math.floor(power * levelScale * (1 + Math.random() * 0.1));
}

/** 經驗值需求: level^2.5 × 10 */
export function expForLevel(level: number): number {
  return Math.floor(Math.pow(level, 2.5) * 10);
}

/** 到達某等級的總經驗值 */
export function totalExpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += expForLevel(i);
  }
  return total;
}

/** 逃跑機率: 基於我方平均 AGI vs 敵方平均 AGI + 區域加成 (低等區域更容易逃) */
export function calculateFleeChance(partyAvgAgi: number, enemyAvgAgi: number, regionBonus: number = 0): number {
  const ratio = partyAvgAgi / Math.max(1, enemyAvgAgi);
  return Math.min(0.95, Math.max(0.15, 0.6 * ratio + regionBonus));
}

/** 掉落率修正: 基於幸運屬性 */
export function calculateDropRate(baseRate: number, luck: number): number {
  return Math.min(1, baseRate * (1 + luck / 100));
}

/** 難度修正係數 */
export function getDifficultyModifiers(difficulty: Difficulty) {
  switch (difficulty) {
    case 'easy':
      return { enemyHpMult: 0.7, enemyAtkMult: 0.8, dropRateMult: 1.5, expMult: 1.3 };
    case 'hard':
      return { enemyHpMult: 1.5, enemyAtkMult: 1.3, dropRateMult: 1.2, expMult: 0.8 };
    default:
      return { enemyHpMult: 1, enemyAtkMult: 1, dropRateMult: 1, expMult: 1 };
  }
}

/** 升級屬性成長 */
export function calculateLevelUpGains(growth: StatsGrowth): Partial<Stats> {
  return {
    maxHP: growth.hp,
    maxMP: growth.mp,
    atk: randomRange(growth.atk[0], growth.atk[1]),
    def: growth.def,
    agi: randomRange(growth.agi[0], growth.agi[1]),
    luck: growth.luck,
  };
}

/** 行動順序計算: AGI + random(-5, 5) */
export function calculateActionSpeed(agi: number): number {
  return agi + Math.floor(Math.random() * 11) - 5;
}

/** 區間隨機整數 */
export function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 隨機遇敵步數 */
export function calculateEncounterSteps(baseSteps: number, variance: number): number {
  return baseSteps + Math.floor(Math.random() * variance * 2) - variance;
}
