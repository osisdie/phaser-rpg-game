import type { CharacterData } from '../types';
import { gameState } from './GameStateManager';
import { MAX_PARTY_SIZE } from '../utils/constants';

export class PartySystem {
  static getActiveParty(): CharacterData[] {
    return gameState.getParty();
  }

  static addMember(companionId: string): boolean {
    return gameState.addToParty(companionId);
  }

  static removeMember(companionId: string): boolean {
    return gameState.removeFromParty(companionId);
  }

  static swapMember(removeId: string, addId: string): boolean {
    if (removeId === 'hero') return false;
    if (!gameState.removeFromParty(removeId)) return false;
    return gameState.addToParty(addId);
  }

  static isPartyFull(): boolean {
    return gameState.getState().party.length >= MAX_PARTY_SIZE;
  }

  static getAvailableCompanions(): CharacterData[] {
    const state = gameState.getState();
    return Object.values(state.companions).filter(
      c => !state.party.includes(c.id)
    );
  }

  static isPartyAlive(): boolean {
    return gameState.getParty().some(c => c.stats.hp > 0);
  }

  static healParty(amount: number): void {
    for (const char of gameState.getParty()) {
      if (char.stats.hp > 0) {
        char.stats.hp = Math.min(char.stats.maxHP, char.stats.hp + amount);
        char.stats.mp = Math.min(char.stats.maxMP, char.stats.mp + amount);
      }
    }
  }

  static fullHealParty(): void {
    for (const char of gameState.getParty()) {
      char.stats.hp = char.stats.maxHP;
      char.stats.mp = char.stats.maxMP;
    }
  }
}
