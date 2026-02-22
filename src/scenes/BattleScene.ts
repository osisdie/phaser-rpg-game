import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { CombatSystem } from '../systems/CombatSystem';
import type { MonsterData, BattleAction, SkillData, CombatantState } from '../types';
import { BattleHUD } from '../ui/BattleHUD';
import { BattleMenu, type MenuAction } from '../ui/BattleMenu';
import { TextBox } from '../ui/TextBox';
import { showDamageNumber } from '../ui/DamageNumber';
import { TransitionEffect } from '../ui/TransitionEffect';
import { audioManager } from '../systems/AudioManager';
import { getSkillById } from '../data/skills/index';
import { InventorySystem } from '../systems/InventorySystem';
import { SkillSystem } from '../systems/SkillSystem';
import { SaveLoadSystem } from '../systems/SaveLoadSystem';
import { MonsterRenderer } from '../art/monsters/MonsterRenderer';
import { BattleEffects } from '../art/effects/BattleEffects';
import { getCompanionTextureKey } from '../art/characters/NPCProfiles';

type BattlePhaseUI = 'intro' | 'menu' | 'target_select' | 'skill_select' | 'item_select' | 'executing' | 'result';

export class BattleScene extends Phaser.Scene {
  private combat!: CombatSystem;
  private hud!: BattleHUD;
  private menu!: BattleMenu;
  private textBox!: TextBox;
  private monsters: MonsterData[] = [];
  private returnScene = 'FieldScene';
  private returnData: object = {};
  private isBoss = false;
  private regionId = '';
  private uiPhase: BattlePhaseUI = 'intro';
  private currentPartyIndex = 0;
  private partyActions: BattleAction[] = [];
  private enemySprites: Phaser.GameObjects.Sprite[] = [];
  private partySprites: Phaser.GameObjects.Sprite[] = [];
  private actionLog: string[] = [];
  private logIndex = 0;
  private targetCursor?: Phaser.GameObjects.Triangle;
  private nearDeathLabels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('BattleScene');
  }

  create(data: { monsters: MonsterData[]; regionId: string; isBoss?: boolean; returnScene: string; returnData: object }): void {
    this.monsters = data.monsters;
    this.regionId = data.regionId;
    this.isBoss = data.isBoss ?? false;
    this.returnScene = data.returnScene;
    this.returnData = data.returnData;

    // Initialize combat
    const party = gameState.getParty();
    this.combat = new CombatSystem(party, this.monsters);
    this.combat.startTurn();

    // Battle background — use region-specific texture if available
    const bgKey = `battle_bg_${this.regionId}`;
    if (this.textures.exists(bgKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1a2e);
    }

    // Ground divider (between enemies and party)
    this.add.rectangle(GAME_WIDTH / 2, 360, GAME_WIDTH, 2, 0x333366, 0.3);

    // Draw enemy sprites (top center) — classic JRPG layout
    const state = this.combat.getState();
    this.enemySprites = [];
    const enemySpacing = Math.min(140, (GAME_WIDTH - 300) / Math.max(1, state.enemies.length));
    const enemyTotalW = (state.enemies.length - 1) * enemySpacing;
    state.enemies.forEach((enemy, i) => {
      const x = GAME_WIDTH / 2 - enemyTotalW / 2 + i * enemySpacing;
      const y = this.isBoss ? 160 : 200;
      const isBossEnemy = enemy.id.includes('boss');

      // Generate monster texture on-demand
      const texKey = MonsterRenderer.getTextureKey(enemy.name, enemy.id, isBossEnemy);
      MonsterRenderer.generateForMonster(this, texKey, enemy.name, this.monsters[i]?.spriteColor ?? 0xff4444, isBossEnemy);

      const sprite = this.add.sprite(x, y, texKey).setDepth(DEPTH.characters);
      sprite.setData('homeX', x);
      sprite.setData('homeY', y);
      this.enemySprites.push(sprite);

      this.add.text(x, y + (isBossEnemy ? TILE_SIZE + 8 : TILE_SIZE / 2 + 8), enemy.name, {
        fontFamily: FONT_FAMILY, fontSize: '12px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 0).setDepth(DEPTH.characters + 1);
    });

    // Draw party sprites (bottom center) — classic JRPG layout
    this.partySprites = [];
    const partySpacing = Math.min(110, (GAME_WIDTH - 300) / Math.max(1, state.party.length));
    const partyTotalW = (state.party.length - 1) * partySpacing;
    state.party.forEach((member, i) => {
      const x = GAME_WIDTH / 2 - partyTotalW / 2 + i * partySpacing;
      const y = 470;

      // Determine texture key — hero or companion
      let texKey = 'char_hero';
      if (i > 0) {
        const companionKey = getCompanionTextureKey(member.id);
        if (companionKey && this.textures.exists(companionKey)) {
          texKey = companionKey;
        }
      }

      const sprite = this.add.sprite(x, y, texKey, 0).setDepth(DEPTH.characters);
      sprite.setData('homeX', x);
      sprite.setData('homeY', y);
      this.partySprites.push(sprite);

      this.add.text(x, y + TILE_SIZE / 2 + 4, member.name, {
        fontFamily: FONT_FAMILY, fontSize: '11px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 0).setDepth(DEPTH.characters + 1);
    });

    // Near-death labels (hidden initially)
    this.nearDeathLabels = [];
    state.party.forEach((_member, i) => {
      const sprite = this.partySprites[i];
      const label = this.add.text(sprite.x, sprite.y - 20, t('battle.near_death'), {
        fontFamily: FONT_FAMILY, fontSize: '10px', color: '#ff4444',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(DEPTH.characters + 2).setVisible(false);
      this.nearDeathLabels.push(label);
    });

    // HUD
    this.hud = new BattleHUD(this);
    this.hud.setupParty(state.party);
    this.hud.setupEnemies(state.enemies);
    this.hud.updateDisplay(state.party, state.enemies, state.turn);

    // Menu
    this.menu = new BattleMenu(this);

    // TextBox
    this.textBox = new TextBox(this);

    // Target cursor
    this.targetCursor = this.add.triangle(0, 0, 0, 0, 10, -14, 20, 0, COLORS.gold)
      .setDepth(DEPTH.ui + 5).setVisible(false);

    // Start with intro message
    this.uiPhase = 'intro';
    this.currentPartyIndex = 0;
    this.partyActions = [];

    const monsterNames = [...new Set(this.monsters.map(m => m.name))].join('、');
    this.textBox.show('', t('battle.encounter', monsterNames), () => {
      this.uiPhase = 'menu';
      this.textBox.hide();
      this.showMenuForCurrentMember();
    });

    // Keys for advancing text
    this.input.keyboard?.on('keydown-ENTER', () => this.handleConfirm());
    this.input.keyboard?.on('keydown-SPACE', () => this.handleConfirm());
    this.input.keyboard?.on('keydown-Z', () => this.handleConfirm());
    this.input.keyboard?.on('keydown-ESC', () => this.handleCancel());

    TransitionEffect.fadeIn(this, 300);
    audioManager.playBgm(this.isBoss ? 'boss' : 'battle', this.regionId);
  }

  update(time: number, delta: number): void {
    this.textBox.update(time, delta);

    // Update HUD
    const state = this.combat.getState();
    this.hud.updateDisplay(state.party, state.enemies, state.turn);

    // Update sprite visibility for dead combatants
    state.enemies.forEach((e, i) => {
      if (this.enemySprites[i]) {
        this.enemySprites[i].setAlpha(e.stats.hp > 0 ? 1 : 0.2);
      }
    });
    state.party.forEach((p, i) => {
      if (this.partySprites[i]) {
        const isDown = p.stats.hp <= 0;
        this.partySprites[i].setAlpha(isDown ? 0.4 : 1);
        if (isDown) this.partySprites[i].setTint(0xff4444);
        else if (this.uiPhase !== 'menu' || i !== this.currentPartyIndex) this.partySprites[i].clearTint();
      }
      if (this.nearDeathLabels[i]) {
        this.nearDeathLabels[i].setVisible(p.stats.hp <= 0);
      }
    });
  }

  private handleConfirm(): void {
    switch (this.uiPhase) {
      case 'intro':
        this.textBox.advance();
        break;
      case 'result':
        this.advanceResult();
        break;
      case 'executing':
        this.advanceLog();
        break;
    }
  }

  private handleCancel(): void {
    if (this.uiPhase === 'target_select' || this.uiPhase === 'skill_select' || this.uiPhase === 'item_select') {
      this.targetCursor?.setVisible(false);
      this.uiPhase = 'menu';
      this.showMenuForCurrentMember();
    }
  }

  private showMenuForCurrentMember(): void {
    const state = this.combat.getState();
    // Skip dead members
    while (this.currentPartyIndex < state.party.length && state.party[this.currentPartyIndex].stats.hp <= 0) {
      this.currentPartyIndex++;
    }

    if (this.currentPartyIndex >= state.party.length) {
      // All party members have chosen, execute turn
      this.executeTurn();
      return;
    }

    // Highlight current member with tint
    this.partySprites.forEach((s, i) => {
      if (i === this.currentPartyIndex) {
        s.setTint(0xffdd88); // Gold tint for selected
      } else {
        s.clearTint();
      }
    });

    this.menu.show((action) => this.handleMenuAction(action));
  }

  private handleMenuAction(action: MenuAction): void {
    const state = this.combat.getState();
    const actor = state.party[this.currentPartyIndex];
    if (!actor) return;

    switch (action) {
      case 'attack':
        this.uiPhase = 'target_select';
        this.showTargetSelect(false, (targetIndex) => {
          this.partyActions.push({
            type: 'attack', actorIndex: this.currentPartyIndex, isEnemy: false, targetIndex,
          });
          this.currentPartyIndex++;
          this.uiPhase = 'menu';
          this.showMenuForCurrentMember();
        });
        break;

      case 'skill':
        this.uiPhase = 'skill_select';
        this.showSkillSelect(actor);
        break;

      case 'item':
        this.uiPhase = 'item_select';
        this.showItemSelect();
        break;

      case 'defend':
        this.partyActions.push({
          type: 'defend', actorIndex: this.currentPartyIndex, isEnemy: false,
        });
        this.currentPartyIndex++;
        this.uiPhase = 'menu';
        this.showMenuForCurrentMember();
        break;

      case 'flee':
        this.partyActions.push({
          type: 'flee', actorIndex: this.currentPartyIndex, isEnemy: false,
        });
        this.currentPartyIndex++;
        this.uiPhase = 'menu';
        this.showMenuForCurrentMember();
        break;
    }
  }

  private showTargetSelect(isAlly: boolean, onSelect: (index: number) => void): void {
    const state = this.combat.getState();
    const targets = isAlly ? state.party : state.enemies;
    const sprites = isAlly ? this.partySprites : this.enemySprites;
    let selectedIdx = targets.findIndex(t => t.stats.hp > 0);

    const updateCursor = () => {
      const sprite = sprites[selectedIdx];
      if (sprite) {
        this.targetCursor?.setPosition(sprite.x, sprite.y - 30).setVisible(true);
      }
    };
    updateCursor();

    const cleanup = () => {
      this.targetCursor?.setVisible(false);
      this.input.keyboard?.off('keydown-LEFT', onLeft);
      this.input.keyboard?.off('keydown-RIGHT', onRight);
      this.input.keyboard?.off('keydown-ENTER', onConfirm);
      this.input.keyboard?.off('keydown-SPACE', onConfirm);
      this.input.keyboard?.off('keydown-Z', onConfirm);
    };

    const onLeft = () => {
      do { selectedIdx = (selectedIdx - 1 + targets.length) % targets.length; }
      while (targets[selectedIdx].stats.hp <= 0);
      updateCursor();
    };
    const onRight = () => {
      do { selectedIdx = (selectedIdx + 1) % targets.length; }
      while (targets[selectedIdx].stats.hp <= 0);
      updateCursor();
    };
    const onConfirm = () => {
      cleanup();
      audioManager.playSfx('select');
      onSelect(selectedIdx);
    };

    this.input.keyboard?.on('keydown-LEFT', onLeft);
    this.input.keyboard?.on('keydown-RIGHT', onRight);
    this.input.keyboard?.on('keydown-ENTER', onConfirm);
    this.input.keyboard?.on('keydown-SPACE', onConfirm);
    this.input.keyboard?.on('keydown-Z', onConfirm);

    // Click support
    sprites.forEach((sprite, i) => {
      if (targets[i]?.stats.hp > 0) {
        sprite.setInteractive({ useHandCursor: true });
        sprite.once('pointerdown', () => { cleanup(); onSelect(i); });
      }
    });
  }

  private showSkillSelect(actor: CombatantState): void {
    const skills = SkillSystem.getUsableSkills(actor);
    if (skills.length === 0) {
      this.uiPhase = 'menu';
      this.showMenuForCurrentMember();
      return;
    }

    // Create skill list overlay — use panel texture if available
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;

    let panel: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    let border: Phaser.GameObjects.Rectangle | null = null;
    if (this.textures.exists('ui_panel_menu')) {
      panel = this.add.image(panelX, panelY, 'ui_panel_menu').setDepth(DEPTH.overlay);
    } else {
      panel = this.add.rectangle(panelX, panelY, 300, 250, COLORS.panel, 0.95).setDepth(DEPTH.overlay);
      border = this.add.rectangle(panelX, panelY, 304, 254, COLORS.panelBorder).setDepth(DEPTH.overlay - 1);
    }
    const title = this.add.text(panelX, panelY - 110, t('battle.select_skill'), {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(DEPTH.overlay + 1);

    const items: Phaser.GameObjects.Text[] = [];
    let selectedIdx = 0;

    skills.forEach((skill, i) => {
      const canUse = actor.stats.mp >= skill.mpCost;
      const text = this.add.text(panelX - 130, panelY - 80 + i * 28, `  ${skill.name} (MP:${skill.mpCost})`, {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: canUse ? COLORS.textPrimary : '#666666',
      }).setDepth(DEPTH.overlay + 1);

      if (canUse) {
        text.setInteractive({ useHandCursor: true });
        text.on('pointerdown', () => selectSkill(i));
        text.on('pointerover', () => { selectedIdx = i; updateList(); });
      }
      items.push(text);
    });

    const updateList = () => {
      items.forEach((txt, i) => {
        const canUse = actor.stats.mp >= skills[i].mpCost;
        txt.setText(i === selectedIdx ? `► ${skills[i].name} (MP:${skills[i].mpCost})` : `  ${skills[i].name} (MP:${skills[i].mpCost})`);
        if (canUse && i === selectedIdx) txt.setColor(COLORS.textHighlight);
        else if (canUse) txt.setColor(COLORS.textPrimary);
      });
    };
    updateList();

    const cleanup = () => {
      panel.destroy(); border?.destroy(); title.destroy();
      items.forEach(t => t.destroy());
      this.input.keyboard?.off('keydown-UP', onUp);
      this.input.keyboard?.off('keydown-DOWN', onDown);
      this.input.keyboard?.off('keydown-ENTER', onConfirm);
      this.input.keyboard?.off('keydown-Z', onConfirm);
    };

    const selectSkill = (i: number) => {
      const skill = skills[i];
      if (actor.stats.mp < skill.mpCost) return;
      cleanup();
      audioManager.playSfx('select');

      const isAllyTarget = skill.target === 'single_ally' || skill.target === 'all_allies' || skill.target === 'self';
      if (skill.target === 'self' || skill.target.startsWith('all_')) {
        this.partyActions.push({
          type: 'skill', actorIndex: this.currentPartyIndex, isEnemy: false,
          skillId: skill.id, targetIndex: 0,
        });
        this.currentPartyIndex++;
        this.uiPhase = 'menu';
        this.showMenuForCurrentMember();
      } else {
        this.uiPhase = 'target_select';
        this.showTargetSelect(isAllyTarget, (targetIndex) => {
          this.partyActions.push({
            type: 'skill', actorIndex: this.currentPartyIndex, isEnemy: false,
            skillId: skill.id, targetIndex,
          });
          this.currentPartyIndex++;
          this.uiPhase = 'menu';
          this.showMenuForCurrentMember();
        });
      }
    };

    const onUp = () => { selectedIdx = (selectedIdx - 1 + skills.length) % skills.length; updateList(); };
    const onDown = () => { selectedIdx = (selectedIdx + 1) % skills.length; updateList(); };
    const onConfirm = () => selectSkill(selectedIdx);

    this.input.keyboard?.on('keydown-UP', onUp);
    this.input.keyboard?.on('keydown-DOWN', onDown);
    this.input.keyboard?.on('keydown-ENTER', onConfirm);
    this.input.keyboard?.on('keydown-Z', onConfirm);
  }

  private showItemSelect(): void {
    const usable = InventorySystem.getUsableItems();
    if (usable.length === 0) {
      this.uiPhase = 'menu';
      this.showMenuForCurrentMember();
      return;
    }

    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;

    let panel: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    let border: Phaser.GameObjects.Rectangle | null = null;
    if (this.textures.exists('ui_panel_menu')) {
      panel = this.add.image(panelX, panelY, 'ui_panel_menu').setDepth(DEPTH.overlay);
    } else {
      panel = this.add.rectangle(panelX, panelY, 300, 250, COLORS.panel, 0.95).setDepth(DEPTH.overlay);
      border = this.add.rectangle(panelX, panelY, 304, 254, COLORS.panelBorder).setDepth(DEPTH.overlay - 1);
    }
    const title = this.add.text(panelX, panelY - 110, t('battle.select_item'), {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(DEPTH.overlay + 1);

    const items: Phaser.GameObjects.Text[] = [];
    let selectedIdx = 0;

    usable.forEach((entry, i) => {
      const text = this.add.text(panelX - 130, panelY - 80 + i * 28, `  ${entry.item.name} ×${entry.quantity}`, {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textPrimary,
      }).setDepth(DEPTH.overlay + 1).setInteractive({ useHandCursor: true });

      text.on('pointerdown', () => selectItem(i));
      text.on('pointerover', () => { selectedIdx = i; updateList(); });
      items.push(text);
    });

    const updateList = () => {
      items.forEach((txt, i) => {
        txt.setText(i === selectedIdx ? `► ${usable[i].item.name} ×${usable[i].quantity}` : `  ${usable[i].item.name} ×${usable[i].quantity}`);
        txt.setColor(i === selectedIdx ? COLORS.textHighlight : COLORS.textPrimary);
      });
    };
    updateList();

    const cleanup = () => {
      panel.destroy(); border?.destroy(); title.destroy();
      items.forEach(t => t.destroy());
      this.input.keyboard?.off('keydown-UP', onUp);
      this.input.keyboard?.off('keydown-DOWN', onDown);
      this.input.keyboard?.off('keydown-ENTER', onConfirm);
      this.input.keyboard?.off('keydown-Z', onConfirm);
    };

    const selectItem = (i: number) => {
      cleanup();
      audioManager.playSfx('select');
      // Select target for item (always ally)
      this.uiPhase = 'target_select';
      this.showTargetSelect(true, (targetIndex) => {
        this.partyActions.push({
          type: 'item', actorIndex: this.currentPartyIndex, isEnemy: false,
          itemId: usable[i].item.id, targetIndex,
        });
        this.currentPartyIndex++;
        this.uiPhase = 'menu';
        this.showMenuForCurrentMember();
      });
    };

    const onUp = () => { selectedIdx = (selectedIdx - 1 + usable.length) % usable.length; updateList(); };
    const onDown = () => { selectedIdx = (selectedIdx + 1) % usable.length; updateList(); };
    const onConfirm = () => selectItem(selectedIdx);

    this.input.keyboard?.on('keydown-UP', onUp);
    this.input.keyboard?.on('keydown-DOWN', onDown);
    this.input.keyboard?.on('keydown-ENTER', onConfirm);
    this.input.keyboard?.on('keydown-Z', onConfirm);
  }

  private executeTurn(): void {
    this.uiPhase = 'executing';
    this.menu.hide();

    // Clear current member highlight
    this.partySprites.forEach(s => s.clearTint());

    // Queue all party actions
    for (const action of this.partyActions) {
      this.combat.queueAction(action);
    }

    // Execute all actions (combat resolves instantly, we animate sequentially)
    const results = this.combat.executeActions();
    this.actionLog = [];

    // Animate each action one by one with rush/effect animations
    this.playActionSequence(results, 0);
  }

  /** Recursively animate each combat action with rush-forward + hit effects */
  private playActionSequence(
    results: { actor: CombatantState; action: BattleAction; results: string[] }[],
    index: number,
  ): void {
    if (index >= results.length) {
      // All animations done — show the full action log
      this.logIndex = 0;
      if (this.actionLog.length > 0) {
        this.textBox.show('', this.actionLog[0], () => this.advanceLog());
      } else {
        this.checkBattleResult();
      }
      return;
    }

    const { actor, action, results: msgs } = results[index];
    this.actionLog.push(...msgs);

    // Skip if actor died mid-turn
    if (actor.stats.hp <= 0 && action.type !== 'defend') {
      this.playActionSequence(results, index + 1);
      return;
    }

    const actorSprite = action.isEnemy
      ? this.enemySprites[action.actorIndex]
      : this.partySprites[action.actorIndex];

    if (!actorSprite) {
      this.playActionSequence(results, index + 1);
      return;
    }

    const homeX = actorSprite.getData('homeX') as number;
    const homeY = actorSprite.getData('homeY') as number;

    switch (action.type) {
      case 'attack': {
        // Determine target sprite
        const targetSprite = action.isEnemy
          ? this.partySprites[action.targetIndex ?? 0]
          : this.enemySprites[action.targetIndex ?? 0];

        if (!targetSprite) {
          this.playActionSequence(results, index + 1);
          return;
        }

        // Rush toward target (enemies rush down, party rushes up)
        const rushOffsetY = action.isEnemy ? -40 : 40;
        this.tweens.add({
          targets: actorSprite,
          x: targetSprite.x,
          y: targetSprite.y + rushOffsetY,
          duration: 250,
          ease: 'Power3',
          onComplete: () => {
            // Hit effects
            audioManager.playSfx('hit');
            BattleEffects.playAttackEffect(this, targetSprite.x, targetSprite.y);
            this.showDamageFromMessages(msgs);

            // Flash + shake target
            this.tweens.add({
              targets: targetSprite,
              x: targetSprite.x + 6,
              alpha: 0.3,
              duration: 60,
              yoyo: true,
              repeat: 3,
              onComplete: () => {
                // Return to home position
                this.tweens.add({
                  targets: actorSprite,
                  x: homeX, y: homeY,
                  duration: 200,
                  ease: 'Power2',
                  onComplete: () => {
                    this.time.delayedCall(80, () => {
                      this.playActionSequence(results, index + 1);
                    });
                  },
                });
              },
            });
          },
        });
        break;
      }

      case 'skill': {
        const skill = action.skillId ? getSkillById(action.skillId) : null;
        // Step forward slightly
        const stepY = action.isEnemy ? homeY + 25 : homeY - 25;
        this.tweens.add({
          targets: actorSprite,
          y: stepY,
          duration: 150,
          onComplete: () => {
            // Play magic/heal effects on targets
            audioManager.playSfx('hit');
            const isHealSkill = skill?.type === 'heal';
            const targetSprites = this.getActionTargetSprites(action);

            for (const ts of targetSprites) {
              if (isHealSkill) {
                BattleEffects.playHealEffect(this, ts.x, ts.y);
              } else {
                BattleEffects.playMagicEffect(this, ts.x, ts.y, skill?.element ?? '');
                // Flash target
                this.tweens.add({
                  targets: ts, alpha: 0.3, duration: 60, yoyo: true, repeat: 2,
                });
              }
            }
            this.showDamageFromMessages(msgs);

            this.time.delayedCall(350, () => {
              // Return to home
              this.tweens.add({
                targets: actorSprite,
                y: homeY,
                duration: 150,
                onComplete: () => {
                  this.time.delayedCall(80, () => {
                    this.playActionSequence(results, index + 1);
                  });
                },
              });
            });
          },
        });
        break;
      }

      case 'item': {
        const targetSprite = this.partySprites[action.targetIndex ?? 0];
        if (targetSprite) {
          BattleEffects.playHealEffect(this, targetSprite.x, targetSprite.y);
          this.showDamageFromMessages(msgs);
        }
        this.time.delayedCall(400, () => {
          this.playActionSequence(results, index + 1);
        });
        break;
      }

      case 'defend': {
        // Brief shield flash
        actorSprite.setTint(0x4488ff);
        this.time.delayedCall(350, () => {
          actorSprite.clearTint();
          this.playActionSequence(results, index + 1);
        });
        break;
      }

      default:
        this.playActionSequence(results, index + 1);
    }
  }

  /** Get target sprites for a given action */
  private getActionTargetSprites(action: BattleAction): Phaser.GameObjects.Sprite[] {
    if (action.type === 'attack') {
      const s = action.isEnemy
        ? this.partySprites[action.targetIndex ?? 0]
        : this.enemySprites[action.targetIndex ?? 0];
      return s ? [s] : [];
    }
    if (action.type === 'skill' && action.skillId) {
      const skill = getSkillById(action.skillId);
      if (!skill) return [];
      switch (skill.target) {
        case 'single_enemy':
          return action.isEnemy
            ? [this.partySprites[action.targetIndex ?? 0]].filter(Boolean)
            : [this.enemySprites[action.targetIndex ?? 0]].filter(Boolean);
        case 'all_enemies':
          return action.isEnemy ? [...this.partySprites] : [...this.enemySprites];
        case 'single_ally':
          return action.isEnemy
            ? [this.enemySprites[action.targetIndex ?? 0]].filter(Boolean)
            : [this.partySprites[action.targetIndex ?? 0]].filter(Boolean);
        case 'all_allies':
          return action.isEnemy ? [...this.enemySprites] : [...this.partySprites];
        case 'self':
          return action.isEnemy
            ? [this.enemySprites[action.actorIndex]].filter(Boolean)
            : [this.partySprites[action.actorIndex]].filter(Boolean);
      }
    }
    if (action.type === 'item') {
      return [this.partySprites[action.targetIndex ?? 0]].filter(Boolean);
    }
    return [];
  }

  /** Parse damage/heal from result messages and show floating numbers */
  private showDamageFromMessages(msgs: string[]): void {
    const state = this.combat.getState();
    for (const msg of msgs) {
      const dmgMatch = msg.match(/造成 (\d+) 點傷害/);
      if (dmgMatch) {
        const targetMatch = msg.match(/對 (.+?) 造成/);
        if (targetMatch) {
          const name = targetMatch[1];
          const enemy = state.enemies.find(e => e.name === name);
          const ally = state.party.find(p => p.name === name);
          const sprite = enemy ? this.enemySprites[enemy.index] : ally ? this.partySprites[ally.index] : null;
          if (sprite) {
            showDamageNumber(this, sprite.x, sprite.y - 20, parseInt(dmgMatch[1]), 'damage');
          }
        }
      }
      const healMatch = msg.match(/恢復了? (\d+)/);
      if (healMatch) {
        const healTarget = msg.match(/(.+?) 恢復/);
        if (healTarget) {
          const p = state.party.find(p => p.name === healTarget[1]);
          if (p && this.partySprites[p.index]) {
            showDamageNumber(this, this.partySprites[p.index].x, this.partySprites[p.index].y - 20, parseInt(healMatch[1]), 'heal');
          }
        }
      }
    }
  }

  private advanceLog(): void {
    if (!this.textBox.getIsComplete()) {
      this.textBox.advance();
      return;
    }

    this.logIndex++;
    if (this.logIndex < this.actionLog.length) {
      this.textBox.show('', this.actionLog[this.logIndex], () => this.advanceLog());
    } else {
      this.textBox.hide();
      this.checkBattleResult();
    }
  }

  private checkBattleResult(): void {
    if (this.combat.isBattleOver()) {
      const state = this.combat.getState();
      this.uiPhase = 'result';

      if (state.phase === 'victory') {
        this.showVictory();
      } else if (state.phase === 'defeat') {
        this.showDefeat();
      } else if (state.phase === 'fled') {
        this.returnToField();
      }
    } else {
      // Next turn
      this.combat.startTurn();
      this.currentPartyIndex = 0;
      this.partyActions = [];
      this.uiPhase = 'menu';
      this.showMenuForCurrentMember();
    }
  }

  private showVictory(): void {
    const result = this.combat.getState().result!;
    audioManager.playBgm('victory');

    const lines: string[] = [t('battle.victory')];
    lines.push(t('battle.exp_gained', result.exp));
    lines.push(t('battle.gold_gained', result.gold));

    for (const drop of result.drops) {
      lines.push(t('battle.item_dropped', drop));
    }
    for (const lu of result.levelUps) {
      lines.push(t('battle.level_up', lu.characterId, lu.newLevel));
    }

    // Handle boss defeat
    if (this.isBoss) {
      gameState.liberateRegion(this.regionId);
      lines.push(`${gameState.getState().heroName} 解放了此地區！`);
    }

    this.actionLog = lines;
    this.logIndex = 0;
    this.textBox.show('', lines[0]);
  }

  private showDefeat(): void {
    audioManager.stopBgm();
    this.time.delayedCall(1000, () => {
      this.scene.start('GameOverScene', {
        returnScene: this.returnScene,
        returnData: this.returnData,
        regionId: this.regionId,
      });
    });
  }

  private advanceResult(): void {
    if (!this.textBox.getIsComplete()) {
      this.textBox.advance();
      return;
    }

    this.logIndex++;
    if (this.logIndex < this.actionLog.length) {
      this.textBox.show('', this.actionLog[this.logIndex]);
    } else {
      this.returnToField();
    }
  }

  private returnToField(): void {
    TransitionEffect.transition(this, this.returnScene, this.returnData);
  }
}
