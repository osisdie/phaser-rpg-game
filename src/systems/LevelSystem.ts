import type { CharacterData, LevelUpInfo } from '../types';
import { MAX_LEVEL } from '../utils/constants';
import { expForLevel, calculateLevelUpGains } from '../utils/formulas';
import { getSkillsForLevel } from '../data/skills/index';

export class LevelSystem {
  static addExp(character: CharacterData, amount: number): LevelUpInfo | null {
    character.exp += amount;
    const oldLevel = character.level;
    let totalGains: Partial<Record<string, number>> = {};
    const newSkills: string[] = [];

    while (character.level < MAX_LEVEL) {
      const needed = expForLevel(character.level);
      if (character.exp < needed) break;
      character.exp -= needed;
      character.level++;

      // Apply stat gains
      const gains = calculateLevelUpGains(character.growth);
      character.stats.maxHP += gains.maxHP ?? 0;
      character.stats.maxMP += gains.maxMP ?? 0;
      character.stats.atk += gains.atk ?? 0;
      character.stats.def += gains.def ?? 0;
      character.stats.agi += gains.agi ?? 0;
      character.stats.luck += gains.luck ?? 0;

      // Full heal on level up
      character.stats.hp = character.stats.maxHP;
      character.stats.mp = character.stats.maxMP;

      // Bonus stat points
      character.statPoints += 2;

      // Track total gains
      for (const [key, val] of Object.entries(gains)) {
        totalGains[key] = (totalGains[key] as number ?? 0) + (val as number);
      }

      // Check for new skills
      const learned = getSkillsForLevel(character.race, character.level);
      for (const skill of learned) {
        if (!character.skills.includes(skill.id)) {
          character.skills.push(skill.id);
          newSkills.push(skill.id);
        }
      }
    }

    if (character.level > oldLevel) {
      return {
        characterId: character.id,
        oldLevel,
        newLevel: character.level,
        statGains: totalGains as any,
        newSkills,
        statPoints: (character.level - oldLevel) * 2,
      };
    }
    return null;
  }

  static allocateStatPoint(character: CharacterData, stat: 'maxHP' | 'maxMP' | 'atk' | 'def' | 'agi' | 'luck'): boolean {
    if (character.statPoints <= 0) return false;
    character.statPoints--;
    const amounts: Record<string, number> = {
      maxHP: 5, maxMP: 3, atk: 1, def: 1, agi: 1, luck: 1,
    };
    character.stats[stat] += amounts[stat] ?? 1;
    if (stat === 'maxHP') character.stats.hp = Math.min(character.stats.hp + amounts[stat], character.stats.maxHP);
    if (stat === 'maxMP') character.stats.mp = Math.min(character.stats.mp + amounts[stat], character.stats.maxMP);
    return true;
  }

  static getExpToNextLevel(character: CharacterData): number {
    if (character.level >= MAX_LEVEL) return 0;
    return expForLevel(character.level);
  }

  static getExpProgress(character: CharacterData): number {
    if (character.level >= MAX_LEVEL) return 1;
    return character.exp / expForLevel(character.level);
  }
}
