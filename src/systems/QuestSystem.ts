import type { QuestData, QuestStatus } from '../types';
import { gameState } from './GameStateManager';
import { getAllQuests, getQuestById } from '../data/quests/index';

export class QuestSystem {
  static activateQuest(questId: string): boolean {
    const quest = getQuestById(questId);
    if (!quest) return false;
    if (quest.prerequisite && gameState.getQuestStatus(quest.prerequisite) !== 'completed') {
      return false;
    }
    gameState.setQuestStatus(questId, 'active');
    // Initialize progress tracking
    const state = gameState.getState();
    if (!state.questProgress[questId]) {
      state.questProgress[questId] = {};
      for (const obj of quest.objectives) {
        state.questProgress[questId][obj.id] = 0;
      }
    }
    return true;
  }

  static updateObjective(questId: string, objectiveId: string, progress: number = 1): void {
    const state = gameState.getState();
    if (state.questStates[questId] !== 'active') return;
    if (!state.questProgress[questId]) return;
    state.questProgress[questId][objectiveId] = (state.questProgress[questId][objectiveId] ?? 0) + progress;

    // Check if quest is complete
    const quest = getQuestById(questId);
    if (!quest) return;
    const allDone = quest.objectives.every(obj => {
      const current = state.questProgress[questId][obj.id] ?? 0;
      return current >= obj.count;
    });
    if (allDone) {
      this.completeQuest(questId);
    }
  }

  static completeQuest(questId: string): void {
    const quest = getQuestById(questId);
    if (!quest) return;
    gameState.setQuestStatus(questId, 'completed');

    // Give rewards
    if (quest.rewards.gold > 0) gameState.addGold(quest.rewards.gold);
    for (const item of quest.rewards.items) {
      gameState.addItem(item.itemId, item.quantity);
    }
  }

  static getActiveQuests(): { quest: QuestData; progress: Record<string, number> }[] {
    const state = gameState.getState();
    const result: { quest: QuestData; progress: Record<string, number> }[] = [];
    for (const [questId, status] of Object.entries(state.questStates)) {
      if (status === 'active') {
        const quest = getQuestById(questId);
        if (quest) {
          result.push({ quest, progress: state.questProgress[questId] ?? {} });
        }
      }
    }
    return result;
  }

  static getCompletedQuests(): QuestData[] {
    const state = gameState.getState();
    return Object.entries(state.questStates)
      .filter(([, status]) => status === 'completed')
      .map(([id]) => getQuestById(id))
      .filter((q): q is QuestData => q !== undefined);
  }

  static getMainProgress(): { completed: number; total: number } {
    const quests = getAllQuests().filter(q => q.type === 'main');
    const completed = quests.filter(q => gameState.getQuestStatus(q.id) === 'completed').length;
    return { completed, total: quests.length };
  }
}
