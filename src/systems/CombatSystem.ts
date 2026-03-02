import type {
  BattleAction, BattleResult, CombatantState, MonsterData,
  CharacterData, LevelUpInfo, SkillData, StatusType, StatusEffect
} from '../types';
import { gameState } from './GameStateManager';
import { LevelSystem } from './LevelSystem';
import { SkillSystem } from './SkillSystem';
import { InventorySystem } from './InventorySystem';
import {
  calculateDamage, calculateFleeChance, calculateDropRate,
  calculateActionSpeed, getDifficultyModifiers
} from '../utils/formulas';
import { getSkillById } from '../data/skills/index';
import { getItemById } from '../data/items/index';
import { getRegionById } from '../data/regions/index';

export type BattlePhase = 'start' | 'player_turn' | 'enemy_turn' | 'action_execute' | 'victory' | 'defeat' | 'fled';

export interface StatusTickResult {
  combatant: CombatantState;
  status: StatusType;
  type: 'damage' | 'skip' | 'redirect' | 'recover';
  value?: number; // damage for poison
  message: string;
}

export interface BattleState {
  party: CombatantState[];
  enemies: CombatantState[];
  turnOrder: number[];
  currentTurnIndex: number;
  turn: number;
  phase: BattlePhase;
  actionQueue: BattleAction[];
  result: BattleResult | null;
  log: string[];
}

export class CombatSystem {
  private state: BattleState;
  private originalMonsters: MonsterData[];

  constructor(partyData: CharacterData[], monsters: MonsterData[]) {
    const difficulty = gameState.getDifficulty();
    const mods = getDifficultyModifiers(difficulty);
    this.originalMonsters = monsters;

    // Build party combatants
    const party: CombatantState[] = partyData.map((c, i) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      stats: { ...c.stats },
      isEnemy: false,
      isDefending: false,
      index: i,
      skills: [...c.skills],
      statusEffects: [],
    }));

    // Build enemy combatants with difficulty modifiers
    const enemies: CombatantState[] = monsters.map((m, i) => ({
      id: m.id,
      name: m.name,
      stats: {
        ...m.stats,
        maxHP: Math.floor(m.stats.maxHP * mods.enemyHpMult),
        hp: Math.floor(m.stats.hp * mods.enemyHpMult),
        atk: Math.floor(m.stats.atk * mods.enemyAtkMult),
      },
      isEnemy: true,
      isDefending: false,
      index: i,
      skills: [...m.skills],
      ai: m.ai,
      element: m.element,
      statusEffects: [],
    }));

    this.state = {
      party,
      enemies,
      turnOrder: [],
      currentTurnIndex: 0,
      turn: 1,
      phase: 'start',
      actionQueue: [],
      result: null,
      log: [],
    };
  }

  getState(): BattleState {
    return this.state;
  }

  /** Calculate turn order based on AGI; returns status tick results for animation */
  startTurn(): StatusTickResult[] {
    // Reset defending
    for (const c of [...this.state.party, ...this.state.enemies]) {
      c.isDefending = false;
    }

    // Process status ticks at turn start
    const tickResults = this.processStatusTicks();

    // Build turn order: all alive combatants sorted by speed
    const allCombatants = [
      ...this.state.party.filter(c => c.stats.hp > 0).map(c => ({
        index: c.index,
        isEnemy: false,
        speed: calculateActionSpeed(c.stats.agi),
      })),
      ...this.state.enemies.filter(c => c.stats.hp > 0).map(c => ({
        index: c.index,
        isEnemy: true,
        speed: calculateActionSpeed(c.stats.agi),
      })),
    ];
    allCombatants.sort((a, b) => b.speed - a.speed);

    this.state.actionQueue = [];
    this.state.currentTurnIndex = 0;
    this.state.phase = 'player_turn';

    return tickResults;
  }

  /** Process status ticks at the start of each turn */
  private processStatusTicks(): StatusTickResult[] {
    const results: StatusTickResult[] = [];
    const allCombatants = [...this.state.party, ...this.state.enemies];

    for (const c of allCombatants) {
      if (c.stats.hp <= 0) continue;

      // Process each status effect (iterate backwards for safe removal)
      for (let si = c.statusEffects.length - 1; si >= 0; si--) {
        const effect = c.statusEffects[si];

        switch (effect.type) {
          case 'poison': {
            const dmg = Math.max(1, Math.floor(c.stats.maxHP * 0.08));
            c.stats.hp = Math.max(1, c.stats.hp - dmg); // poison can't kill (min 1 HP)
            results.push({
              combatant: c, status: 'poison', type: 'damage', value: dmg,
              message: `${c.name} 受到毒素傷害！(-${dmg})`,
            });
            // Poison lasts until recovery (33% chance per turn)
            if (Math.random() < 0.33) {
              c.statusEffects.splice(si, 1);
              results.push({
                combatant: c, status: 'poison', type: 'recover',
                message: `${c.name} 的中毒已恢復！`,
              });
            }
            break;
          }
          case 'paralysis': {
            // 33% chance to recover each turn
            if (Math.random() < 0.33) {
              c.statusEffects.splice(si, 1);
              results.push({
                combatant: c, status: 'paralysis', type: 'recover',
                message: `${c.name} 的麻痺已恢復！`,
              });
            }
            // (skip logic is handled in executeAction)
            break;
          }
          case 'confusion': {
            // 33% chance to recover each turn
            if (Math.random() < 0.33) {
              c.statusEffects.splice(si, 1);
              results.push({
                combatant: c, status: 'confusion', type: 'recover',
                message: `${c.name} 的混亂已恢復！`,
              });
            }
            break;
          }
        }
      }
    }

    return results;
  }

  /** Attempt to apply a status effect to a target */
  applyStatus(target: CombatantState, statusType: StatusType, chance: number, source: string): boolean {
    if (target.stats.hp <= 0) return false;
    // Don't stack same status
    if (target.statusEffects.some(s => s.type === statusType)) return false;
    if (Math.random() >= chance) return false;

    target.statusEffects.push({ type: statusType, turnsRemaining: -1, source });
    return true;
  }

  /** Check if combatant is paralyzed */
  isParalyzed(combatant: CombatantState): boolean {
    return combatant.statusEffects.some(s => s.type === 'paralysis');
  }

  /** Check if combatant is confused */
  isConfused(combatant: CombatantState): boolean {
    return combatant.statusEffects.some(s => s.type === 'confusion');
  }

  /** Get the current combatant that needs to act */
  getCurrentActor(): CombatantState | null {
    const alive = this.getAliveInOrder();
    if (this.state.currentTurnIndex >= alive.length) return null;
    return alive[this.state.currentTurnIndex];
  }

  private getAliveInOrder(): CombatantState[] {
    const all = [...this.state.party, ...this.state.enemies].filter(c => c.stats.hp > 0);
    return all.sort((a, b) => calculateActionSpeed(b.stats.agi) - calculateActionSpeed(a.stats.agi));
  }

  /** Queue a player action */
  queueAction(action: BattleAction): void {
    this.state.actionQueue.push(action);
  }

  /** Execute all queued actions + enemy AI actions, return results */
  executeActions(): { actor: CombatantState; action: BattleAction; results: string[] }[] {
    const executionResults: { actor: CombatantState; action: BattleAction; results: string[] }[] = [];

    // Generate enemy actions
    for (const enemy of this.state.enemies.filter(e => e.stats.hp > 0)) {
      const action = this.generateEnemyAction(enemy);
      this.state.actionQueue.push(action);
    }

    // Sort by AGI, but flee actions always execute first
    this.state.actionQueue.sort((a, b) => {
      // Flee actions get top priority (prevents getting killed before fleeing)
      if (a.type === 'flee' && b.type !== 'flee') return -1;
      if (a.type !== 'flee' && b.type === 'flee') return 1;
      const actorA = a.isEnemy ? this.state.enemies[a.actorIndex] : this.state.party[a.actorIndex];
      const actorB = b.isEnemy ? this.state.enemies[b.actorIndex] : this.state.party[b.actorIndex];
      if (!actorA || !actorB) return 0;
      return calculateActionSpeed(actorB.stats.agi) - calculateActionSpeed(actorA.stats.agi);
    });

    for (const action of this.state.actionQueue) {
      const actor = action.isEnemy
        ? this.state.enemies[action.actorIndex]
        : this.state.party[action.actorIndex];
      if (!actor || actor.stats.hp <= 0) continue;

      const results = this.executeAction(actor, action);
      executionResults.push({ actor, action, results });

      // Check battle end
      if (this.checkBattleEnd()) break;
    }

    this.state.actionQueue = [];
    this.state.turn++;
    return executionResults;
  }

  private executeAction(actor: CombatantState, action: BattleAction): string[] {
    const results: string[] = [];

    // Paralysis check — skip turn
    if (this.isParalyzed(actor) && action.type !== 'defend') {
      results.push(`${actor.name} 因麻痺無法行動！`);
      return results;
    }

    // Confusion check — redirect target to random alive combatant
    let confusionTarget: CombatantState | null = null;
    if (this.isConfused(actor) && (action.type === 'attack' || action.type === 'skill')) {
      const allAlive = [...this.state.party, ...this.state.enemies].filter(c => c.stats.hp > 0);
      if (allAlive.length > 0) {
        confusionTarget = allAlive[Math.floor(Math.random() * allAlive.length)];
        results.push(`${actor.name} 在混亂中攻擊了 ${confusionTarget.name}！`);
      }
    }

    switch (action.type) {
      case 'attack': {
        // Resolve target — confusion overrides normal targeting
        let target: CombatantState | undefined;
        if (confusionTarget) {
          target = confusionTarget;
        } else {
          target = action.isEnemy
            ? this.state.party[action.targetIndex ?? 0]
            : this.state.enemies[action.targetIndex ?? 0];
        }
        if (!target || target.stats.hp <= 0) break;

        let damage = calculateDamage(actor.stats.atk, target.stats.def);
        if (target.isDefending) damage = Math.max(1, Math.floor(damage * 0.5));
        target.stats.hp = Math.max(0, target.stats.hp - damage);
        if (!confusionTarget) {
          results.push(`${actor.name} 對 ${target.name} 造成 ${damage} 點傷害`);
        } else {
          results.push(`對 ${target.name} 造成 ${damage} 點傷害`);
        }
        if (target.stats.hp <= 0) {
          results.push(`${target.name} 被擊倒了！`);
        }

        // Status application from normal attacks (monsters with 毒 in name)
        if (actor.isEnemy && target.stats.hp > 0) {
          if (actor.name.includes('毒')) {
            if (this.applyStatus(target, 'poison', 0.25, actor.name)) {
              results.push(`${target.name} 中毒了！`);
            }
          }
        }
        break;
      }

      case 'skill': {
        const skill = action.skillId ? getSkillById(action.skillId) : null;
        if (!skill || actor.stats.mp < skill.mpCost) {
          results.push(`${actor.name} 的 MP 不足！`);
          break;
        }
        const targets = this.resolveSkillTargets(skill, actor, action.targetIndex ?? 0);
        const skillResults = SkillSystem.useSkill(skill, actor, targets);
        for (const r of skillResults) {
          if (r.type === 'damage') {
            results.push(`${actor.name} 使用 ${skill.name} 對 ${r.target.name} 造成 ${r.value} 點傷害`);
            if (r.target.stats.hp <= 0) results.push(`${r.target.name} 被擊倒了！`);
          } else {
            results.push(`${actor.name} 使用 ${skill.name}，${r.target.name} 恢復了 ${r.value}`);
          }
        }

        // Apply status from skill's statusEffect config
        if (skill.statusEffect) {
          for (const target of targets) {
            if (target.stats.hp > 0 && this.applyStatus(target, skill.statusEffect.type, skill.statusEffect.chance, skill.name)) {
              const statusNames: Record<string, string> = { poison: '中毒', paralysis: '麻痺', confusion: '混亂' };
              results.push(`${target.name} ${statusNames[skill.statusEffect.type]}了！`);
            }
          }
        }
        break;
      }

      case 'item': {
        if (action.itemId && action.targetIndex !== undefined) {
          const target = this.state.party[action.targetIndex];
          if (target) {
            const item = getItemById(action.itemId);
            // Apply item effect directly in combat
            if (item?.effect) {
              switch (item.effect.type) {
                case 'heal_hp':
                  target.stats.hp = Math.min(target.stats.maxHP, target.stats.hp + item.effect.value);
                  results.push(`${target.name} 恢復了 ${item.effect.value} HP`);
                  break;
                case 'heal_mp':
                  target.stats.mp = Math.min(target.stats.maxMP, target.stats.mp + item.effect.value);
                  results.push(`${target.name} 恢復了 ${item.effect.value} MP`);
                  break;
                case 'revive':
                  if (target.stats.hp <= 0) {
                    target.stats.hp = Math.floor(target.stats.maxHP * item.effect.value / 100);
                    results.push(`${target.name} 復活了！`);
                  }
                  break;
                case 'full_restore':
                  target.stats.hp = target.stats.maxHP;
                  target.stats.mp = target.stats.maxMP;
                  results.push(`${target.name} 完全恢復了！`);
                  break;
              }
              gameState.removeItem(action.itemId);
            }
          }
        }
        break;
      }

      case 'defend':
        actor.isDefending = true;
        results.push(`${actor.name} 採取防禦姿勢`);
        break;

      case 'flee': {
        const partyAvgAgi = this.avgStat(this.state.party, 'agi');
        const enemyAvgAgi = this.avgStat(this.state.enemies, 'agi');
        // Low-level regions grant flee bonus (region_hero ≈ +0.16, scales to 0 by level 35+)
        const region = getRegionById(gameState.getState().currentRegion);
        const regionMaxLv = region?.levelRange[1] ?? 50;
        const regionBonus = 0.2 * Math.max(0, 1 - regionMaxLv / 35);
        const chance = calculateFleeChance(partyAvgAgi, enemyAvgAgi, regionBonus);
        if (Math.random() < chance) {
          this.state.phase = 'fled';
          results.push('成功逃跑了！');
        } else {
          results.push('逃跑失敗！');
        }
        break;
      }
    }

    return results;
  }

  private resolveSkillTargets(skill: SkillData, actor: CombatantState, targetIndex: number): CombatantState[] {
    switch (skill.target) {
      case 'single_enemy':
        if (actor.isEnemy) {
          const alive = this.state.party.filter(c => c.stats.hp > 0);
          return [alive[targetIndex] ?? alive[0]].filter(Boolean);
        }
        const aliveEnemies = this.state.enemies.filter(c => c.stats.hp > 0);
        return [aliveEnemies[targetIndex] ?? aliveEnemies[0]].filter(Boolean);

      case 'all_enemies':
        return actor.isEnemy
          ? this.state.party.filter(c => c.stats.hp > 0)
          : this.state.enemies.filter(c => c.stats.hp > 0);

      case 'single_ally':
        if (actor.isEnemy) {
          const aliveE = this.state.enemies.filter(c => c.stats.hp > 0);
          return [aliveE[targetIndex] ?? aliveE[0]].filter(Boolean);
        }
        return [this.state.party[targetIndex] ?? this.state.party[0]].filter(Boolean);

      case 'all_allies':
        return actor.isEnemy
          ? this.state.enemies.filter(c => c.stats.hp > 0)
          : this.state.party.filter(c => c.stats.hp > 0);

      case 'self':
        return [actor];

      default:
        return [];
    }
  }

  private generateEnemyAction(enemy: CombatantState): BattleAction {
    const alivePlayers = this.state.party.filter(c => c.stats.hp > 0);
    if (alivePlayers.length === 0) {
      return { type: 'defend', actorIndex: enemy.index, isEnemy: true };
    }

    switch (enemy.ai) {
      case 'aggressive': {
        // Target lowest HP player
        const weakest = alivePlayers.reduce((a, b) => a.stats.hp < b.stats.hp ? a : b);
        // 40% chance to use a skill if available
        if (Math.random() < 0.4 && enemy.skills.length > 0) {
          const usableSkills = enemy.skills.filter(s => {
            const skill = getSkillById(s);
            return skill && enemy.stats.mp >= skill.mpCost;
          });
          if (usableSkills.length > 0) {
            const skillId = usableSkills[Math.floor(Math.random() * usableSkills.length)];
            return { type: 'skill', actorIndex: enemy.index, isEnemy: true, targetIndex: weakest.index, skillId };
          }
        }
        return { type: 'attack', actorIndex: enemy.index, isEnemy: true, targetIndex: weakest.index };
      }

      case 'defensive': {
        // Defend if HP < 30%
        if (enemy.stats.hp < enemy.stats.maxHP * 0.3) {
          return { type: 'defend', actorIndex: enemy.index, isEnemy: true };
        }
        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        return { type: 'attack', actorIndex: enemy.index, isEnemy: true, targetIndex: target.index };
      }

      case 'healer': {
        // Heal wounded allies
        const woundedAllies = this.state.enemies.filter(
          e => e.stats.hp > 0 && e.stats.hp < e.stats.maxHP * 0.5
        );
        const healSkill = enemy.skills.find(s => {
          const skill = getSkillById(s);
          return skill?.type === 'heal' && enemy.stats.mp >= (skill?.mpCost ?? 999);
        });
        if (woundedAllies.length > 0 && healSkill) {
          return {
            type: 'skill', actorIndex: enemy.index, isEnemy: true,
            targetIndex: woundedAllies[0].index, skillId: healSkill,
          };
        }
        // Otherwise attack
        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        return { type: 'attack', actorIndex: enemy.index, isEnemy: true, targetIndex: target.index };
      }

      default: {
        // Random target
        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        // Try to use skill occasionally
        if (Math.random() < 0.3 && enemy.skills.length > 0) {
          const usableSkills = enemy.skills.filter(s => {
            const skill = getSkillById(s);
            return skill && enemy.stats.mp >= skill.mpCost;
          });
          if (usableSkills.length > 0) {
            const skillId = usableSkills[Math.floor(Math.random() * usableSkills.length)];
            return { type: 'skill', actorIndex: enemy.index, isEnemy: true, targetIndex: target.index, skillId };
          }
        }
        return { type: 'attack', actorIndex: enemy.index, isEnemy: true, targetIndex: target.index };
      }
    }
  }

  checkBattleEnd(): boolean {
    // Fled — no further actions should execute
    if (this.state.phase === 'fled') return true;

    const partyAlive = this.state.party.some(c => c.stats.hp > 0);
    const enemiesAlive = this.state.enemies.some(c => c.stats.hp > 0);

    if (!partyAlive) {
      this.state.phase = 'defeat';
      this.state.result = { victory: false, fled: false, exp: 0, gold: 0, drops: [], levelUps: [] };
      return true;
    }

    if (!enemiesAlive) {
      this.state.phase = 'victory';
      this.state.result = this.calculateVictoryRewards();
      return true;
    }

    return false;
  }

  private calculateVictoryRewards(): BattleResult {
    const difficulty = gameState.getDifficulty();
    const mods = getDifficultyModifiers(difficulty);
    const party = gameState.getParty();
    const avgLuck = party.reduce((sum, c) => sum + c.stats.luck, 0) / party.length;

    let totalExp = 0;
    let totalGold = 0;
    const drops: string[] = [];

    for (const monster of this.originalMonsters) {
      totalExp += Math.floor(monster.exp * mods.expMult);
      totalGold += monster.gold;

      for (const drop of monster.drops) {
        const adjustedRate = calculateDropRate(drop.rate * mods.dropRateMult, avgLuck);
        if (Math.random() < adjustedRate) {
          const item = getItemById(drop.itemId);
          drops.push(item?.name ?? drop.itemId);
          gameState.addItem(drop.itemId);
        }
      }
    }

    // Clear all status effects on party after battle
    for (const combatant of this.state.party) {
      combatant.statusEffects = [];
    }

    // Sync stats back from combat to game state BEFORE EXP distribution
    // so that level-up full heal isn't overwritten by old combat HP
    // Auto-revive KO'd party members to 1 HP after victory (瀕死 → 復活)
    for (const combatant of this.state.party) {
      const char = party.find(c => c.id === combatant.id);
      if (char) {
        char.stats.hp = combatant.stats.hp <= 0 ? 1 : combatant.stats.hp;
        char.stats.mp = combatant.stats.mp;
      }
    }

    // Distribute EXP (after sync so level-up full heal is preserved)
    const levelUps: LevelUpInfo[] = [];
    const aliveParty = party.filter(c => c.stats.hp > 0);
    const expPerMember = Math.floor(totalExp / Math.max(1, aliveParty.length));

    for (const char of aliveParty) {
      const info = LevelSystem.addExp(char, expPerMember);
      if (info) levelUps.push(info);
    }

    gameState.addGold(totalGold);

    return { victory: true, fled: false, exp: totalExp, gold: totalGold, drops, levelUps };
  }

  isBattleOver(): boolean {
    return this.state.phase === 'victory' || this.state.phase === 'defeat' || this.state.phase === 'fled';
  }

  private avgStat(combatants: CombatantState[], stat: keyof CombatantState['stats']): number {
    const alive = combatants.filter(c => c.stats.hp > 0);
    if (alive.length === 0) return 0;
    return alive.reduce((sum, c) => sum + (c.stats[stat] as number), 0) / alive.length;
  }
}
