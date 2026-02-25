import type { CharacterData, EquipmentSlot, EquipmentItem } from '../types';
import { gameState } from './GameStateManager';
import { getEquipmentById } from '../data/items/index';

export class EquipmentSystem {
  static equip(character: CharacterData, equipmentId: string): boolean {
    const equipment = getEquipmentById(equipmentId);
    if (!equipment) return false;

    // Unequip current item in that slot
    const currentId = character.equipment[equipment.slot];
    if (currentId) {
      this.unequipStats(character, currentId);
      gameState.addItem(currentId);
    }

    // Equip new item
    character.equipment[equipment.slot] = equipmentId;
    this.applyStats(character, equipmentId);
    gameState.removeItem(equipmentId);
    return true;
  }

  static unequip(character: CharacterData, slot: EquipmentSlot): boolean {
    const currentId = character.equipment[slot];
    if (!currentId) return false;

    this.unequipStats(character, currentId);
    gameState.addItem(currentId);
    character.equipment[slot] = null;
    return true;
  }

  /** Apply all currently-equipped item bonuses (used for initial state setup) */
  static applyAllEquipment(character: CharacterData): void {
    for (const slot of ['helmet', 'armor', 'shield', 'weapon', 'boots'] as EquipmentSlot[]) {
      const equipId = character.equipment[slot];
      if (equipId) this.applyStats(character, equipId);
    }
  }

  private static applyStats(character: CharacterData, equipmentId: string): void {
    const equip = getEquipmentById(equipmentId);
    if (!equip) return;
    for (const [key, val] of Object.entries(equip.stats)) {
      if (key in character.stats && typeof val === 'number') {
        (character.stats as any)[key] += val;
        if (key === 'maxHP') character.stats.hp = Math.min(character.stats.hp, character.stats.maxHP);
        if (key === 'maxMP') character.stats.mp = Math.min(character.stats.mp, character.stats.maxMP);
      }
    }
  }

  private static unequipStats(character: CharacterData, equipmentId: string): void {
    const equip = getEquipmentById(equipmentId);
    if (!equip) return;
    for (const [key, val] of Object.entries(equip.stats)) {
      if (key in character.stats && typeof val === 'number') {
        (character.stats as any)[key] -= val;
      }
    }
  }

  static getEquipmentComparison(character: CharacterData, equipmentId: string): Record<string, number> {
    const newEquip = getEquipmentById(equipmentId);
    if (!newEquip) return {};
    const currentId = character.equipment[newEquip.slot];
    const currentEquip = currentId ? getEquipmentById(currentId) : null;

    const diff: Record<string, number> = {};
    for (const [key, val] of Object.entries(newEquip.stats)) {
      const currentVal = currentEquip?.stats[key as keyof typeof currentEquip.stats] ?? 0;
      diff[key] = (val as number) - (currentVal as number);
    }
    return diff;
  }

  static getEquippedItems(character: CharacterData): Record<EquipmentSlot, EquipmentItem | null> {
    const result: Record<string, EquipmentItem | null> = {};
    for (const slot of ['helmet', 'armor', 'shield', 'weapon', 'boots'] as EquipmentSlot[]) {
      const id = character.equipment[slot];
      result[slot] = id ? getEquipmentById(id) ?? null : null;
    }
    return result as Record<EquipmentSlot, EquipmentItem | null>;
  }
}
