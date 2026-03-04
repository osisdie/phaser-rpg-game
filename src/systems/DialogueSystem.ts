import type { DialogueTree, DialogueNode } from '../types';
import { gameState } from './GameStateManager';

export class DialogueSystem {
  private tree: DialogueTree | null = null;
  private currentNodeId: string = '';

  start(tree: DialogueTree): DialogueNode | null {
    this.tree = tree;
    this.currentNodeId = tree.startNode;
    return this.getCurrentNode();
  }

  getCurrentNode(): DialogueNode | null {
    if (!this.tree) return null;
    const node = this.tree.nodes[this.currentNodeId];
    if (!node) return null;

    // Replace hero name placeholder
    const heroName = gameState.getState().heroName;
    return {
      ...node,
      text: node.text.replace(/\{heroName\}/g, heroName),
      speaker: node.speaker.replace(/\{heroName\}/g, heroName),
    };
  }

  advance(choiceIndex?: number): DialogueNode | null {
    if (!this.tree) return null;
    const current = this.tree.nodes[this.currentNodeId];
    if (!current) return null;

    // Execute action if any
    if (current.action) {
      this.executeAction(current.action);
    }

    // Handle choices
    if (current.choices && current.choices.length > 0 && choiceIndex !== undefined) {
      const validChoices = current.choices.filter(c => this.checkCondition(c.condition));
      if (choiceIndex >= 0 && choiceIndex < validChoices.length) {
        this.currentNodeId = validChoices[choiceIndex].next;
        return this.getCurrentNode();
      }
    }

    // Auto-advance
    if (current.next) {
      this.currentNodeId = current.next;
      return this.getCurrentNode();
    }

    // End of dialogue
    this.tree = null;
    return null;
  }

  getAvailableChoices(): { text: string; index: number }[] {
    if (!this.tree) return [];
    const current = this.tree.nodes[this.currentNodeId];
    if (!current?.choices) return [];

    return current.choices
      .map((c, i) => ({ text: c.text, index: i, condition: c.condition }))
      .filter(c => this.checkCondition(c.condition))
      .map(({ text, index }) => ({ text, index }));
  }

  isActive(): boolean {
    return this.tree !== null;
  }

  /** Reset dialogue state — clears tree and current node to prevent stale flag leaks */
  reset(): void {
    this.tree = null;
    this.currentNodeId = '';
  }

  private checkCondition(condition?: string): boolean {
    if (!condition) return true;
    // Simple flag-based conditions: "flag:some_flag" or "!flag:some_flag"
    if (condition.startsWith('!flag:')) {
      return !gameState.getFlag(condition.slice(6));
    }
    if (condition.startsWith('flag:')) {
      return gameState.getFlag(condition.slice(5));
    }
    return true;
  }

  private executeAction(action: string): void {
    // Simple actions: "set_flag:name", "add_gold:100", "add_item:item_id"
    const [cmd, val] = action.split(':');
    switch (cmd) {
      case 'set_flag':
        gameState.setFlag(val, true);
        break;
      case 'add_gold':
        gameState.addGold(parseInt(val) || 0);
        break;
      case 'add_item':
        gameState.addItem(val);
        break;
      case 'liberate':
        gameState.liberateRegion(val);
        break;
    }
  }
}
