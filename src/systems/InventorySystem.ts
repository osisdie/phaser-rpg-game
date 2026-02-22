import type { ItemData, CharacterData } from '../types';
import { gameState } from './GameStateManager';
import { getItemById } from '../data/items/index';

export class InventorySystem {
  static useItem(itemId: string, target: CharacterData): boolean {
    const item = getItemById(itemId);
    if (!item?.effect) return false;
    if (gameState.getItemCount(itemId) <= 0) return false;

    const effect = item.effect;
    let used = false;

    switch (effect.type) {
      case 'heal_hp':
        if (target.stats.hp < target.stats.maxHP && target.stats.hp > 0) {
          target.stats.hp = Math.min(target.stats.maxHP, target.stats.hp + effect.value);
          used = true;
        }
        break;
      case 'heal_mp':
        if (target.stats.mp < target.stats.maxMP && target.stats.hp > 0) {
          target.stats.mp = Math.min(target.stats.maxMP, target.stats.mp + effect.value);
          used = true;
        }
        break;
      case 'heal_both':
        if (target.stats.hp > 0) {
          target.stats.hp = Math.min(target.stats.maxHP, target.stats.hp + effect.value);
          target.stats.mp = Math.min(target.stats.maxMP, target.stats.mp + effect.value);
          used = true;
        }
        break;
      case 'revive':
        if (target.stats.hp <= 0) {
          target.stats.hp = Math.floor(target.stats.maxHP * (effect.value / 100));
          used = true;
        }
        break;
      case 'full_restore':
        if (target.stats.hp > 0) {
          target.stats.hp = target.stats.maxHP;
          target.stats.mp = target.stats.maxMP;
          used = true;
        }
        break;
    }

    if (used) {
      gameState.removeItem(itemId);
    }
    return used;
  }

  static getUsableItems(): { item: ItemData; quantity: number }[] {
    const result: { item: ItemData; quantity: number }[] = [];
    for (const entry of gameState.getInventory()) {
      const item = getItemById(entry.itemId);
      if (item && item.type === 'consumable' && item.effect) {
        result.push({ item, quantity: entry.quantity });
      }
    }
    return result;
  }

  static getAllItems(): { item: ItemData; quantity: number }[] {
    const result: { item: ItemData; quantity: number }[] = [];
    for (const entry of gameState.getInventory()) {
      const item = getItemById(entry.itemId);
      if (item) {
        result.push({ item, quantity: entry.quantity });
      }
    }
    return result;
  }

  static buyItem(itemId: string, price: number): boolean {
    if (!gameState.spendGold(price)) return false;
    gameState.addItem(itemId);
    return true;
  }

  static sellItem(itemId: string): boolean {
    const item = getItemById(itemId);
    if (!item) return false;
    if (!gameState.removeItem(itemId)) return false;
    gameState.addGold(item.sellPrice);
    return true;
  }
}
