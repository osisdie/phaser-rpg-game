import type { EncounterTable, EncounterEntry, MonsterData } from '../types';
import { gameState } from './GameStateManager';
import { calculateEncounterSteps, randomRange } from '../utils/formulas';
import { BASE_ENCOUNTER_STEPS, ENCOUNTER_VARIANCE } from '../utils/constants';
import { getMonsterById } from '../data/monsters/index';

export class EncounterSystem {
  static initSteps(): void {
    gameState.setEncounterSteps(
      calculateEncounterSteps(BASE_ENCOUNTER_STEPS, ENCOUNTER_VARIANCE)
    );
  }

  static step(): boolean {
    const remaining = gameState.decrementEncounterSteps();
    if (remaining <= 0) {
      this.initSteps();
      return true; // trigger encounter
    }
    return false;
  }

  static generateEncounter(table: EncounterTable): MonsterData[] {
    const totalWeight = table.entries.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosen: EncounterEntry = table.entries[0];
    for (const entry of table.entries) {
      roll -= entry.weight;
      if (roll <= 0) {
        chosen = entry;
        break;
      }
    }
    const count = randomRange(chosen.minCount, chosen.maxCount);
    const monsters: MonsterData[] = [];
    for (let i = 0; i < count; i++) {
      const m = getMonsterById(chosen.monsterId);
      if (m) monsters.push(structuredClone(m));
    }
    return monsters;
  }
}
