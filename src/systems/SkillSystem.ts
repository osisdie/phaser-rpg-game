import type { SkillData, CharacterData, CombatantState } from '../types';
import { getSkillById } from '../data/skills/index';
import { calculateSkillDamage, calculateHeal } from '../utils/formulas';

export class SkillSystem {
  static canUseSkill(user: CharacterData | CombatantState, skillId: string): boolean {
    const skill = getSkillById(skillId);
    if (!skill) return false;
    return user.stats.mp >= skill.mpCost;
  }

  static useSkill(
    skill: SkillData,
    user: CombatantState,
    targets: CombatantState[]
  ): { target: CombatantState; value: number; type: 'damage' | 'heal' }[] {
    user.stats.mp -= skill.mpCost;
    const results: { target: CombatantState; value: number; type: 'damage' | 'heal' }[] = [];

    const userLevel = user.level ?? 1;
    for (const target of targets) {
      if (skill.type === 'heal') {
        const heal = calculateHeal(skill.power, userLevel);
        target.stats.hp = Math.min(target.stats.maxHP, target.stats.hp + heal);
        results.push({ target, value: heal, type: 'heal' });
      } else if (skill.type === 'physical' || skill.type === 'magical') {
        let damage = calculateSkillDamage(skill.power, user.stats.atk, target.stats.def, userLevel);
        if (target.isDefending) damage = Math.max(1, Math.floor(damage * 0.5));
        // Element weakness check (simplified)
        damage = this.applyElementModifier(damage, skill.element, target.element);
        target.stats.hp = Math.max(0, target.stats.hp - damage);
        results.push({ target, value: damage, type: 'damage' });
      } else if (skill.type === 'buff') {
        // Simple buff: increase ATK by power%
        const buff = Math.floor(target.stats.atk * skill.power / 100);
        target.stats.atk += buff;
        results.push({ target, value: buff, type: 'heal' });
      }
    }

    return results;
  }

  private static applyElementModifier(damage: number, attackElement?: string, defenderElement?: string): number {
    if (!attackElement || attackElement === 'none' || !defenderElement || defenderElement === 'none') {
      return damage;
    }
    const weaknesses: Record<string, string> = {
      fire: 'water',
      water: 'earth',
      earth: 'wind',
      wind: 'fire',
      light: 'dark',
      dark: 'light',
    };
    if (weaknesses[defenderElement] === attackElement) {
      return Math.floor(damage * 1.5); // super effective
    }
    if (weaknesses[attackElement] === defenderElement) {
      return Math.floor(damage * 0.7); // not very effective
    }
    return damage;
  }

  static getUsableSkills(character: CharacterData | CombatantState): SkillData[] {
    return character.skills
      .map(id => getSkillById(id))
      .filter((s): s is SkillData => s !== undefined);
  }
}
