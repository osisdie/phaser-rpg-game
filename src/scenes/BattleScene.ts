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
import { ItemIconRenderer } from '../art/ui/ItemIconRenderer';
import { getCompanionForRegion } from '../data/characters/index';
import { getRegionById } from '../data/regions/index';

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
  private nearDeathTweens: (Phaser.Tweens.Tween | null)[] = [];
  private wasNearDeath: boolean[] = [];
  private activeOverlayCleanup: (() => void) | null = null;

  // Auto-attack mode
  private autoAttackMode = false;
  private autoAttackLabel?: Phaser.GameObjects.Text;
  private autoAttackCancelLabel?: Phaser.GameObjects.Text;

  // Battle log panel (scrollable, auto-append)
  private battleLogEntries: string[] = [];
  private battleLogBg!: Phaser.GameObjects.Rectangle;
  private battleLogText!: Phaser.GameObjects.Text;
  private battleLogMaskGraphics!: Phaser.GameObjects.Graphics;
  private battleLogScrollY = 0;
  private battleLogMaxScroll = 0;

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
    const enemySpacing = Math.min(180, (GAME_WIDTH - 300) / Math.max(1, state.enemies.length));
    const enemyTotalW = (state.enemies.length - 1) * enemySpacing;
    state.enemies.forEach((enemy, i) => {
      const x = GAME_WIDTH / 2 - enemyTotalW / 2 + i * enemySpacing;
      const y = this.isBoss ? 160 : 200;
      const isBossEnemy = enemy.id.includes('boss');

      // Generate monster textures: overworld (small) + battle (high-res, no scale)
      const texKey = MonsterRenderer.getTextureKey(enemy.name, enemy.id, isBossEnemy);
      MonsterRenderer.generateForMonster(this, texKey, enemy.name, this.monsters[i]?.spriteColor ?? 0xff4444, isBossEnemy);
      const battleTexKey = MonsterRenderer.generateForBattle(this, texKey, enemy.name, this.monsters[i]?.spriteColor ?? 0xff4444, isBossEnemy);

      const sprite = this.add.sprite(x, y, battleTexKey).setDepth(DEPTH.characters);
      sprite.setData('homeX', x);
      sprite.setData('homeY', y);
      this.enemySprites.push(sprite);

      this.add.text(x, y + (isBossEnemy ? 100 : 75), enemy.name, {
        fontFamily: FONT_FAMILY, fontSize: '12px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 0).setDepth(DEPTH.characters + 1);
    });

    // Direction indices for diagonal battle facing (matches DIRECTIONS array in CharacterRenderer)
    const DIR_DOWN_LEFT = 4;
    const DIR_DOWN = 0;
    const DIR_DOWN_RIGHT = 5;

    // Draw party sprites (bottom center) — classic JRPG layout
    this.partySprites = [];
    const partySpacing = Math.min(150, (GAME_WIDTH - 300) / Math.max(1, state.party.length));
    const partyTotalW = (state.party.length - 1) * partySpacing;
    state.party.forEach((member, i) => {
      const x = GAME_WIDTH / 2 - partyTotalW / 2 + i * partySpacing;
      const y = 450;

      // Determine texture key — hero or companion
      let texKey = 'char_hero';
      if (i > 0) {
        const companionKey = getCompanionTextureKey(member.id);
        if (companionKey && this.textures.exists(companionKey)) {
          texKey = companionKey;
        }
      }

      // Choose diagonal facing based on screen position (3/4 view toward enemies)
      const relX = (x - GAME_WIDTH / 2) / (GAME_WIDTH / 2);
      const battleDir = relX < -0.15 ? DIR_DOWN_RIGHT : relX > 0.15 ? DIR_DOWN_LEFT : DIR_DOWN;
      const idleFrame = battleDir * 4 + 1; // 4 frames/dir, frame 1 = neutral idle

      // Use battle-resolution texture if available (3× native, no scale needed)
      const battleTexKey = `${texKey}_battle`;
      const useBattleTex = this.textures.exists(battleTexKey);
      const sprite = this.add.sprite(x, y, useBattleTex ? battleTexKey : texKey, idleFrame).setDepth(DEPTH.characters);
      if (!useBattleTex) sprite.setScale(2.5); // fallback for missing battle textures
      sprite.setData('homeX', x);
      sprite.setData('homeY', y);
      this.partySprites.push(sprite);

      this.add.text(x, y + 80, member.name, {
        fontFamily: FONT_FAMILY, fontSize: '11px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 0).setDepth(DEPTH.characters + 1);
    });

    // Near-death labels & pulse tracking (hidden initially)
    this.nearDeathLabels = [];
    this.nearDeathTweens = [];
    this.wasNearDeath = [];
    state.party.forEach((_member, i) => {
      const sprite = this.partySprites[i];
      const label = this.add.text(sprite.x, sprite.y - 80, t('battle.near_death'), {
        fontFamily: FONT_FAMILY, fontSize: '10px', color: '#ff4444',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(DEPTH.characters + 2).setVisible(false);
      this.nearDeathLabels.push(label);
      this.nearDeathTweens.push(null);
      this.wasNearDeath.push(false);
    });

    // HUD
    this.hud = new BattleHUD(this);
    this.hud.setupParty(state.party);
    this.hud.setupEnemies(state.enemies);
    this.hud.updateDisplay(state.party, state.enemies, state.turn);

    // Menu
    this.menu = new BattleMenu(this);

    // TextBox (for intro and victory/defeat only)
    this.textBox = new TextBox(this);

    // Battle log panel (always visible during combat)
    this.createBattleLog();

    // Target cursor (larger offset for scaled sprites)
    this.targetCursor = this.add.triangle(0, 0, 0, 0, 12, -18, 24, 0, COLORS.gold)
      .setDepth(DEPTH.ui + 5).setVisible(false);

    // Auto-attack UI (hidden initially)
    this.autoAttackMode = false;
    this.autoAttackLabel = this.add.text(GAME_WIDTH / 2, 30, t('battle.auto_attack'), {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: '#ffdd44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.ui + 10).setVisible(false);
    this.autoAttackCancelLabel = this.add.text(GAME_WIDTH / 2, 50, `(${t('battle.auto_cancel')})`, {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#aaaaaa',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(DEPTH.ui + 10).setVisible(false);

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
    this.input.keyboard?.on('keydown-A', () => {
      if (this.uiPhase === 'menu' && !this.autoAttackMode) {
        this.startAutoAttack();
      }
    });

    TransitionEffect.fadeIn(this, 300);
    audioManager.playBgm(this.isBoss ? 'boss' : 'battle', this.regionId);
  }

  // ─── Battle Log Panel ───

  private createBattleLog(): void {
    this.battleLogEntries = [];
    this.battleLogScrollY = 0;

    const logX = 195;
    const logY = GAME_HEIGHT - 168;
    const logW = 500;
    const logH = 138;

    // Semi-transparent background
    this.battleLogBg = this.add.rectangle(logX + logW / 2, logY + logH / 2, logW, logH, 0x000000, 0.45)
      .setDepth(DEPTH.ui + 2);

    // Border
    this.add.rectangle(logX + logW / 2, logY + logH / 2, logW + 2, logH + 2, 0x334466, 0.6)
      .setDepth(DEPTH.ui + 1);

    // Text object — newest first, word-wrapped
    this.battleLogText = this.add.text(logX + 8, logY + 4, '', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#ccddee',
      wordWrap: { width: logW - 20 },
      lineSpacing: 2,
    }).setDepth(DEPTH.ui + 3);

    // Mask so text doesn't overflow
    this.battleLogMaskGraphics = this.add.graphics().setDepth(0);
    this.battleLogMaskGraphics.fillRect(logX, logY, logW, logH);
    const mask = this.battleLogMaskGraphics.createGeometryMask();
    this.battleLogText.setMask(mask);

    // Mouse wheel scroll
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: Phaser.GameObjects.GameObject[], _dx: number, deltaY: number) => {
      if (this.uiPhase === 'executing' || this.uiPhase === 'menu') {
        this.battleLogScrollY += deltaY > 0 ? 24 : -24;
        this.battleLogScrollY = Phaser.Math.Clamp(this.battleLogScrollY, 0, this.battleLogMaxScroll);
        this.updateBattleLogDisplay();
      }
    });
  }

  private addBattleLogMessage(msg: string): void {
    this.battleLogEntries.unshift(msg); // newest first
    this.battleLogScrollY = 0; // auto-scroll to top (newest)
    this.updateBattleLogDisplay();
  }

  private updateBattleLogDisplay(): void {
    const logH = 138;
    const text = this.battleLogEntries.join('\n');
    this.battleLogText.setText(text);

    // Calculate max scroll based on text height
    const textHeight = this.battleLogText.height;
    this.battleLogMaxScroll = Math.max(0, textHeight - logH + 8);

    // Apply scroll offset
    const logY = GAME_HEIGHT - 168;
    this.battleLogText.setY(logY + 4 - this.battleLogScrollY);
  }

  // ─── Update & Input ───

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
      const isDown = p.stats.hp <= 0;
      const isNearDeath = p.stats.hp > 0 && p.stats.hp <= p.stats.maxHP * 0.25;

      if (this.partySprites[i]) {
        if (isDown) {
          this.partySprites[i].setAlpha(0.4);
          this.partySprites[i].setTint(0xff4444);
          this.stopNearDeathPulse(i);
        } else if (isNearDeath) {
          // First time entering near-death → SFX + start pulse
          if (!this.wasNearDeath[i]) {
            audioManager.playSfx('warning');
            this.startNearDeathPulse(i);
            this.wasNearDeath[i] = true;
          }
          // Tint managed by pulse tween — don't clear
        } else {
          // Healthy — clear effects
          if (this.uiPhase !== 'menu' || i !== this.currentPartyIndex) this.partySprites[i].clearTint();
          this.partySprites[i].setAlpha(1);
          this.stopNearDeathPulse(i);
        }
      }
      if (this.nearDeathLabels[i]) {
        this.nearDeathLabels[i].setVisible(isNearDeath);
      }
    });
  }

  private startNearDeathPulse(index: number): void {
    if (this.nearDeathTweens[index]) return;
    const sprite = this.partySprites[index];
    if (!sprite) return;
    sprite.setTint(0xff8888);
    this.nearDeathTweens[index] = this.tweens.add({
      targets: sprite,
      alpha: { from: 1, to: 0.45 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private stopNearDeathPulse(index: number): void {
    const tw = this.nearDeathTweens[index];
    if (tw) {
      tw.destroy();
      this.nearDeathTweens[index] = null;
    }
    this.wasNearDeath[index] = false;
  }

  private handleConfirm(): void {
    switch (this.uiPhase) {
      case 'intro':
        this.textBox.advance();
        break;
      case 'result':
        this.advanceResult();
        break;
    }
  }

  private handleCancel(): void {
    // Cancel auto-attack mode
    if (this.autoAttackMode) {
      this.autoAttackMode = false;
      this.autoAttackLabel?.setVisible(false);
      this.autoAttackCancelLabel?.setVisible(false);
      audioManager.playSfx('cancel');
      // If we're in executing phase, the mode will stop after current turn
      // If we're in menu phase, show the menu
      if (this.uiPhase === 'menu') {
        this.showMenuForCurrentMember();
      }
      return;
    }

    if (this.uiPhase === 'target_select' || this.uiPhase === 'skill_select' || this.uiPhase === 'item_select') {
      // Clean up skill/item overlay panels and their keyboard listeners
      if (this.activeOverlayCleanup) {
        this.activeOverlayCleanup();
        this.activeOverlayCleanup = null;
      }
      this.targetCursor?.setVisible(false);
      this.uiPhase = 'menu';
      audioManager.playSfx('cancel');
      this.showMenuForCurrentMember();
    }
  }

  // ─── Menu & Target Selection ───

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

    // Auto-attack: skip menu and auto-assign attack
    if (this.autoAttackMode) {
      const firstAliveEnemy = state.enemies.findIndex(e => e.stats.hp > 0);
      if (firstAliveEnemy >= 0) {
        this.partyActions.push({
          type: 'attack', actorIndex: this.currentPartyIndex, isEnemy: false, targetIndex: firstAliveEnemy,
        });
        this.currentPartyIndex++;
        this.showMenuForCurrentMember();
        return;
      }
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

  /** Toggle auto-attack mode from BattleMenu 'A' key */
  private startAutoAttack(): void {
    if (this.uiPhase !== 'menu') return;
    this.autoAttackMode = true;
    this.autoAttackLabel?.setVisible(true);
    this.autoAttackCancelLabel?.setVisible(true);
    // Pulse animation for the label
    this.tweens.add({
      targets: this.autoAttackLabel,
      alpha: { from: 1, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.menu.hide();
    audioManager.playSfx('select');
    this.showMenuForCurrentMember();
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
        this.targetCursor?.setPosition(sprite.x, sprite.y - 85).setVisible(true);
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
      audioManager.playSfx('select');
    };
    const onRight = () => {
      do { selectedIdx = (selectedIdx + 1) % targets.length; }
      while (targets[selectedIdx].stats.hp <= 0);
      updateCursor();
      audioManager.playSfx('select');
    };
    const onConfirm = () => {
      cleanup();
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
    const skillIcons: Phaser.GameObjects.Image[] = [];
    let selectedIdx = 0;

    skills.forEach((skill, i) => {
      const canUse = actor.stats.mp >= skill.mpCost;
      const iy = panelY - 80 + i * 28;
      // Skill icon
      const iconKey = ItemIconRenderer.getSkillIconKey(skill.element, skill.type);
      if (this.textures.exists(iconKey)) {
        const icon = this.add.image(panelX - 130, iy + 9, iconKey).setScale(0.65).setDepth(DEPTH.overlay + 1);
        if (!canUse) icon.setAlpha(0.4);
        skillIcons.push(icon);
      }
      const text = this.add.text(panelX - 115, iy, `  ${skill.name} (MP:${skill.mpCost})`, {
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
      skillIcons.forEach(ic => ic.destroy());
      this.input.keyboard?.off('keydown-UP', onUp);
      this.input.keyboard?.off('keydown-DOWN', onDown);
      this.input.keyboard?.off('keydown-ENTER', onConfirm);
      this.input.keyboard?.off('keydown-SPACE', onConfirm);
      this.input.keyboard?.off('keydown-Z', onConfirm);
      this.activeOverlayCleanup = null;
    };
    this.activeOverlayCleanup = cleanup;

    const selectSkill = (i: number) => {
      const skill = skills[i];
      if (actor.stats.mp < skill.mpCost) return;
      cleanup();

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

    const onUp = () => { selectedIdx = (selectedIdx - 1 + skills.length) % skills.length; updateList(); audioManager.playSfx('select'); };
    const onDown = () => { selectedIdx = (selectedIdx + 1) % skills.length; updateList(); audioManager.playSfx('select'); };
    const onConfirm = () => selectSkill(selectedIdx);

    this.input.keyboard?.on('keydown-UP', onUp);
    this.input.keyboard?.on('keydown-DOWN', onDown);
    this.input.keyboard?.on('keydown-ENTER', onConfirm);
    this.input.keyboard?.on('keydown-SPACE', onConfirm);
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

    const itemIcons: Phaser.GameObjects.Image[] = [];
    usable.forEach((entry, i) => {
      const iy = panelY - 80 + i * 28;
      // Icon
      const iconKey = ItemIconRenderer.getIconKey(entry.item.id);
      if (this.textures.exists(iconKey)) {
        const icon = this.add.image(panelX - 130, iy + 9, iconKey).setScale(0.65).setDepth(DEPTH.overlay + 1);
        itemIcons.push(icon);
      }
      const text = this.add.text(panelX - 115, iy, `  ${entry.item.name} ×${entry.quantity}`, {
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
      itemIcons.forEach(ic => ic.destroy());
      this.input.keyboard?.off('keydown-UP', onUp);
      this.input.keyboard?.off('keydown-DOWN', onDown);
      this.input.keyboard?.off('keydown-ENTER', onConfirm);
      this.input.keyboard?.off('keydown-SPACE', onConfirm);
      this.input.keyboard?.off('keydown-Z', onConfirm);
      this.activeOverlayCleanup = null;
    };
    this.activeOverlayCleanup = cleanup;

    const selectItem = (i: number) => {
      cleanup();
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

    const onUp = () => { selectedIdx = (selectedIdx - 1 + usable.length) % usable.length; updateList(); audioManager.playSfx('select'); };
    const onDown = () => { selectedIdx = (selectedIdx + 1) % usable.length; updateList(); audioManager.playSfx('select'); };
    const onConfirm = () => selectItem(selectedIdx);

    this.input.keyboard?.on('keydown-UP', onUp);
    this.input.keyboard?.on('keydown-DOWN', onDown);
    this.input.keyboard?.on('keydown-ENTER', onConfirm);
    this.input.keyboard?.on('keydown-SPACE', onConfirm);
    this.input.keyboard?.on('keydown-Z', onConfirm);
  }

  // ─── Turn Execution & Action Sequence ───

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
      // All animations done — go directly to check result (no TextBox log needed)
      this.checkBattleResult();
      return;
    }

    const { actor, action, results: msgs } = results[index];

    // Skip if actor died mid-turn
    if (actor.stats.hp <= 0 && action.type !== 'defend') {
      // Still log death-related messages
      for (const msg of msgs) this.addBattleLogMessage(msg);
      this.playActionSequence(results, index + 1);
      return;
    }

    const actorSprite = action.isEnemy
      ? this.enemySprites[action.actorIndex]
      : this.partySprites[action.actorIndex];

    if (!actorSprite) {
      for (const msg of msgs) this.addBattleLogMessage(msg);
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
          for (const msg of msgs) this.addBattleLogMessage(msg);
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
            // Add messages to battle log
            for (const msg of msgs) this.addBattleLogMessage(msg);

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
            // Play appropriate SFX based on skill type
            const isHealSkill = skill?.type === 'heal';
            if (isHealSkill) {
              audioManager.playSfx('heal');
            } else {
              audioManager.playSfx('magic');
            }

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
            // Add messages to battle log
            for (const msg of msgs) this.addBattleLogMessage(msg);

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
          audioManager.playSfx('heal');
          BattleEffects.playHealEffect(this, targetSprite.x, targetSprite.y);
          this.showDamageFromMessages(msgs);
        }
        // Add messages to battle log
        for (const msg of msgs) this.addBattleLogMessage(msg);
        this.time.delayedCall(400, () => {
          this.playActionSequence(results, index + 1);
        });
        break;
      }

      case 'defend': {
        // Brief shield flash
        actorSprite.setTint(0x4488ff);
        // Add messages to battle log
        for (const msg of msgs) this.addBattleLogMessage(msg);
        this.time.delayedCall(350, () => {
          actorSprite.clearTint();
          this.playActionSequence(results, index + 1);
        });
        break;
      }

      default:
        for (const msg of msgs) this.addBattleLogMessage(msg);
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
            showDamageNumber(this, sprite.x, sprite.y - 70, parseInt(dmgMatch[1]), 'damage');
          }
        }
      }
      const healMatch = msg.match(/恢復了? (\d+)/);
      if (healMatch) {
        const healTarget = msg.match(/(.+?) 恢復/);
        if (healTarget) {
          const p = state.party.find(p => p.name === healTarget[1]);
          if (p && this.partySprites[p.index]) {
            showDamageNumber(this, this.partySprites[p.index].x, this.partySprites[p.index].y - 70, parseInt(healMatch[1]), 'heal');
          }
        }
      }
    }
  }

  // ─── Battle Result ───

  private checkBattleResult(): void {
    if (this.combat.isBattleOver()) {
      const state = this.combat.getState();
      this.uiPhase = 'result';

      if (state.phase === 'victory') {
        this.showVictory();
      } else if (state.phase === 'defeat') {
        this.showDefeat();
      } else if (state.phase === 'fled') {
        this.addBattleLogMessage(t('battle.fled'));
        this.time.delayedCall(600, () => this.returnToField());
      }
    } else {
      // Next turn
      this.combat.startTurn();
      this.currentPartyIndex = 0;
      this.partyActions = [];
      this.uiPhase = 'menu';
      // Small delay before auto-attack continues (so player can see results)
      if (this.autoAttackMode) {
        this.time.delayedCall(200, () => this.showMenuForCurrentMember());
      } else {
        this.showMenuForCurrentMember();
      }
    }
  }

  private showVictory(): void {
    const result = this.combat.getState().result!;
    audioManager.playBgm('victory');
    audioManager.playSfx('fanfare');

    // Stop auto-attack on victory
    this.autoAttackMode = false;
    this.autoAttackLabel?.setVisible(false);
    this.autoAttackCancelLabel?.setVisible(false);

    const lines: string[] = [t('battle.victory')];
    lines.push(t('battle.exp_gained', result.exp));
    lines.push(t('battle.gold_gained', result.gold));

    for (const drop of result.drops) {
      lines.push(t('battle.item_dropped', drop));
    }

    // Check if mini-boss was defeated (demon kingdom guard)
    if (this.monsters.some(m => m.id === 'r12_mini_boss')) {
      gameState.setFlag('mini_boss_demon_defeated');
      lines.push('魔王護衛已被擊敗！前方就是大魔王！');
    }
    for (const lu of result.levelUps) {
      audioManager.playSfx('levelup');
      lines.push(t('battle.level_up', lu.characterId, lu.newLevel));
    }

    // Handle boss defeat
    if (this.isBoss) {
      gameState.liberateRegion(this.regionId);
      lines.push(`${gameState.getState().heroName} 解放了此地區！`);

      // Add companion for this region (if available)
      const companion = getCompanionForRegion(this.regionId);
      if (companion) {
        const companionData = structuredClone(companion);
        gameState.addCompanion(companionData);
        if (gameState.addToParty(companionData.id)) {
          lines.push(t('battle.companion_join', companionData.name));
        }
      }

      // Demon king defeated — trigger ending sequence
      const region = getRegionById(this.regionId);
      if (region?.type === 'final') {
        gameState.setGameCompleted();
        SaveLoadSystem.autoSave();
        this.actionLog = lines;
        this.logIndex = 0;
        this.textBox.show('', lines[0]);
        return; // returnToField will redirect to EndingScene
      }
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
    // If the demon king was just defeated, go to ending instead
    const region = getRegionById(this.regionId);
    if (this.isBoss && region?.type === 'final') {
      TransitionEffect.transition(this, 'EndingScene');
      return;
    }
    TransitionEffect.transition(this, this.returnScene, this.returnData);
  }
}
