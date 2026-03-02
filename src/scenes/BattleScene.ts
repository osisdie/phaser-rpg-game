import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { CombatSystem, type StatusTickResult } from '../systems/CombatSystem';
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

interface FormationSlot { x: number; y: number; scale: number; depthOffset: number; facing?: number; }

// Diagonal formations: party bottom-left crescent vs enemies top-right crescent
// Crescent (弧形) with convex side toward opponent; hero at front-center of arc
interface PartyFormation { slots: FormationSlot[]; heroSlot: number; }
// Direction indices: 0=down, 1=left, 2=right, 3=up, 4=down_left, 5=down_right, 6=up_left, 7=up_right
const FACING_NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right'];
const PARTY_FORMATIONS: Record<number, PartyFormation> = {
  1: { heroSlot: 0, slots: [
    { x: 300, y: 420, scale: 1.0, depthOffset: 0, facing: 5 },
  ]},
  2: { heroSlot: 0, slots: [
    { x: 310, y: 380, scale: 1.0, depthOffset: 1, facing: 5 },   // hero: forward-center
    { x: 195, y: 470, scale: 0.85, depthOffset: 0, facing: 5 },  // behind on arc
  ]},
  3: { heroSlot: 0, slots: [
    { x: 310, y: 370, scale: 1.0, depthOffset: 1, facing: 5 },   // hero: center of crescent front
    { x: 190, y: 430, scale: 0.82, depthOffset: 0, facing: 5 },  // upper arc wing
    { x: 240, y: 500, scale: 0.82, depthOffset: 0, facing: 5 },  // lower arc wing
  ]},
  4: { heroSlot: 0, slots: [
    { x: 315, y: 355, scale: 1.0, depthOffset: 2, facing: 5 },   // hero: front-center of crescent
    { x: 210, y: 405, scale: 0.88, depthOffset: 1, facing: 5 },  // upper-inner arc
    { x: 145, y: 485, scale: 0.75, depthOffset: 0, facing: 5 },  // upper-outer arc (far end)
    { x: 260, y: 480, scale: 0.80, depthOffset: 0, facing: 5 },  // lower arc wing
  ]},
};

const ENEMY_FORMATIONS: Record<number, FormationSlot[]> = {
  1: [{ x: 700, y: 220, scale: 1.0, depthOffset: 0 }],
  2: [
    { x: 690, y: 240, scale: 0.90, depthOffset: 1 },    // forward-center
    { x: 810, y: 175, scale: 0.85, depthOffset: 0 },    // behind on arc
  ],
  3: [
    { x: 680, y: 240, scale: 0.85, depthOffset: 1 },    // center of crescent front
    { x: 800, y: 185, scale: 0.80, depthOffset: 0 },    // upper arc wing
    { x: 760, y: 145, scale: 0.78, depthOffset: 0 },    // lower(upper-screen) arc wing
  ],
  4: [
    { x: 680, y: 250, scale: 0.85, depthOffset: 2 },    // front-center of crescent
    { x: 785, y: 200, scale: 0.80, depthOffset: 1 },    // inner arc
    { x: 870, y: 145, scale: 0.72, depthOffset: 0 },    // outer arc (far end)
    { x: 740, y: 150, scale: 0.75, depthOffset: 0 },    // upper arc wing
  ],
};
const BOSS_FORMATION: FormationSlot = { x: 720, y: 210, scale: 1.3, depthOffset: 0 };

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

  // Idle bob parameters (unique per sprite so they never sync)
  private readonly IDLE_BOB_AMP = 3; // pixels
  private readonly IDLE_BOB_FREQS = [0.0017, 0.0021, 0.0013, 0.0019, 0.0023, 0.0015, 0.0025, 0.0011];
  private readonly IDLE_BOB_PHASES = [0, 1.7, 3.3, 0.9, 2.5, 4.1, 1.2, 3.8];

  // Auto-attack mode
  private autoAttackMode = false;
  private autoAttackLabel?: Phaser.GameObjects.Text;
  private autoAttackCancelLabel?: Phaser.GameObjects.Text;

  // Floating HP bars (above enemy and party sprites)
  private enemyHpBars: { bg: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle }[] = [];
  private partyHpBars: { bg: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle }[] = [];

  // Status effect icons (above sprites)
  private statusIcons: Phaser.GameObjects.Text[][] = []; // [combatantGlobalIdx][statusIdx]

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

    // Battle background — use boss variant when applicable
    const bgKey = this.isBoss ? `battle_bg_${this.regionId}_boss` : `battle_bg_${this.regionId}`;
    if (this.textures.exists(bgKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1a2e);
    }

    // Boss: pulsing dark vignette overlay for dramatic effect
    if (this.isBoss) {
      const vignette = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.0)
        .setDepth(DEPTH.ground + 1);
      this.tweens.add({
        targets: vignette,
        alpha: { from: 0, to: 0.15 },
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // ─── Enemy sprites (TOP area, facing down) — horizontal spread ───
    const state = this.combat.getState();
    this.enemySprites = [];
    const isSoloBoss = state.enemies.length === 1 && state.enemies[0].id.includes('boss');
    const enemyFormation = ENEMY_FORMATIONS[state.enemies.length] ?? ENEMY_FORMATIONS[4]!;
    state.enemies.forEach((enemy, i) => {
      const isBossEnemy = enemy.id.includes('boss');
      const slot = isSoloBoss ? BOSS_FORMATION : (enemyFormation[i] ?? enemyFormation[enemyFormation.length - 1]);
      const x = slot.x;
      const y = slot.y;

      // Generate monster textures: overworld (small) + battle (high-res, no scale)
      const texKey = MonsterRenderer.getTextureKey(enemy.name, enemy.id, isBossEnemy);
      MonsterRenderer.generateForMonster(this, texKey, enemy.name, this.monsters[i]?.spriteColor ?? 0xff4444, isBossEnemy);
      const battleTexKey = MonsterRenderer.generateForBattle(this, texKey, enemy.name, this.monsters[i]?.spriteColor ?? 0xff4444, isBossEnemy);

      const sprite = this.add.sprite(x, y, battleTexKey)
        .setScale(slot.scale)
        .setDepth(DEPTH.characters + slot.depthOffset);
      // Flip right-facing procedural monsters so they face the party (lower-left)
      if (MonsterRenderer.needsFlipForBattle(enemy.name)) {
        sprite.setFlipX(true);
      }
      sprite.setData('homeX', x);
      sprite.setData('homeY', y);
      sprite.setData('homeScale', slot.scale);
      this.enemySprites.push(sprite);

      this.add.text(x, y + sprite.displayHeight / 2 + 14, enemy.name, {
        fontFamily: FONT_FAMILY, fontSize: '12px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 0).setDepth(DEPTH.characters + slot.depthOffset + 1);
    });

    // ─── Enemy HP bars (centered above each enemy sprite) ───
    this.enemyHpBars = [];
    const HP_BAR_W = 60;
    const HP_BAR_H = 5;
    this.enemySprites.forEach(sprite => {
      const barX = sprite.x;
      const barY = sprite.y - sprite.displayHeight / 2 - 8;
      const bg = this.add.rectangle(barX, barY, HP_BAR_W, HP_BAR_H, 0x333333)
        .setDepth(DEPTH.characters + 10);
      const fill = this.add.rectangle(barX, barY, HP_BAR_W, HP_BAR_H, COLORS.hpBar)
        .setDepth(DEPTH.characters + 10);
      this.enemyHpBars.push({ bg, fill });
    });

    // ─── Party sprites (BOTTOM area, 3/4 diagonal facing) — crescent formation ───
    // Hero always at front-center (heroSlot); companions fill remaining arc slots
    this.partySprites = [];
    const partyFormation = PARTY_FORMATIONS[state.party.length] ?? PARTY_FORMATIONS[4]!;
    const slotMap: number[] = []; // slotMap[partyIndex] = formationSlotIndex
    const heroSlotIdx = partyFormation.heroSlot;
    slotMap[0] = heroSlotIdx; // hero → V-tip
    let companionSlot = 0;
    for (let ci = 1; ci < state.party.length; ci++) {
      if (companionSlot === heroSlotIdx) companionSlot++; // skip hero's slot
      slotMap[ci] = companionSlot;
      companionSlot++;
    }

    state.party.forEach((member, i) => {
      const slot = partyFormation.slots[slotMap[i]] ?? partyFormation.slots[partyFormation.slots.length - 1];
      const x = slot.x;
      const y = slot.y;

      // Determine texture key — hero or companion
      let texKey = 'char_hero';
      if (i > 0) {
        const companionKey = getCompanionTextureKey(member.id);
        if (companionKey && this.textures.exists(companionKey)) {
          texKey = companionKey;
        }
      }

      // 3/4 diagonal facing — shows face while implying upward gaze toward enemies
      const dirIdx = slot.facing ?? 5; // default: down_right
      const dirName = FACING_NAMES[dirIdx];
      const idleFrame = dirIdx * 4 + 1; // 4 frames/dir, frame 1 = neutral idle

      // Use battle-resolution texture if available (3× native, no scale needed)
      const battleTexKey = `${texKey}_battle`;
      const useBattleTex = this.textures.exists(battleTexKey);
      const actualTexKey = useBattleTex ? battleTexKey : texKey;
      const spriteScale = useBattleTex ? slot.scale : 2.5 * slot.scale;
      const sprite = this.add.sprite(x, y, actualTexKey, idleFrame)
        .setScale(spriteScale)
        .setDepth(DEPTH.characters + slot.depthOffset);

      // Play idle animation in diagonal direction
      const idleAnimKey = `${actualTexKey}_idle_${dirName}`;
      if (this.anims.exists(idleAnimKey)) {
        sprite.play(idleAnimKey);
      }
      sprite.setData('homeX', x);
      sprite.setData('homeY', y);
      sprite.setData('homeScale', spriteScale);
      this.partySprites.push(sprite);

      this.add.text(x, y + sprite.displayHeight / 2 + 14, member.name, {
        fontFamily: FONT_FAMILY, fontSize: '11px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 0).setDepth(DEPTH.characters + slot.depthOffset + 1);
    });

    // ─── Party HP bars (centered above each party sprite) ───
    this.partyHpBars = [];
    this.partySprites.forEach(sprite => {
      const barX = sprite.x;
      const barY = sprite.y - sprite.displayHeight / 2 - 8;
      const bg = this.add.rectangle(barX, barY, HP_BAR_W, HP_BAR_H, 0x333333)
        .setDepth(DEPTH.characters + 10);
      const fill = this.add.rectangle(barX, barY, HP_BAR_W, HP_BAR_H, COLORS.hpBar)
        .setDepth(DEPTH.characters + 10);
      this.partyHpBars.push({ bg, fill });
    });

    // Spawn region-specific ambient particles (fireflies, snow, bubbles, etc.)
    BattleEffects.spawnEnvironmentParticles(this, this.regionId, { width: GAME_WIDTH, height: GAME_HEIGHT });

    // Near-death labels & pulse tracking (hidden initially)
    this.nearDeathLabels = [];
    this.nearDeathTweens = [];
    this.wasNearDeath = [];
    state.party.forEach((_member, i) => {
      const sprite = this.partySprites[i];
      const label = this.add.text(sprite.x, sprite.y - sprite.displayHeight / 2 - 14, t('battle.near_death'), {
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

    // Start with sword-crossing intro → then encounter textbox
    this.uiPhase = 'intro';
    this.currentPartyIndex = 0;
    this.partyActions = [];

    const monsterNames = [...new Set(this.monsters.map(m => m.name))].join('、');

    // Keys for advancing text (registered early so they work during textbox)
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

    // Sword-crossing intro plays during fade-in, then encounter textbox appears
    this.time.delayedCall(200, () => {
      this.playSwordCrossingIntro(() => {
        this.textBox.show('', t('battle.encounter', monsterNames), () => {
          this.uiPhase = 'menu';
          this.textBox.hide();
          this.showMenuForCurrentMember();
        });
      });
    });
    audioManager.playBgm(this.isBoss ? 'boss' : 'battle', this.regionId);
  }

  // ─── Battle Log Panel ───

  private createBattleLog(): void {
    this.battleLogEntries = [];
    this.battleLogScrollY = 0;

    const logX = 320;
    const logY = GAME_HEIGHT - 168;
    const logW = 370;
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

  // ─── Sword-Crossing Intro Animation ───

  private playSwordCrossingIntro(onComplete: () => void): void {
    const cx = GAME_WIDTH / 2;  // 512
    const cy = GAME_HEIGHT / 2; // 384

    // Two swords fly in from opposing corners
    const sword1 = this.add.image(-80, GAME_HEIGHT + 80, 'fx_intro_sword')
      .setDepth(DEPTH.ui + 20).setAngle(-45).setAlpha(0.9);
    const sword2 = this.add.image(GAME_WIDTH + 80, -80, 'fx_intro_sword')
      .setDepth(DEPTH.ui + 20).setAngle(135).setAlpha(0.9);

    // Impact point (slightly offset for crossed swords look)
    const impactX1 = cx - 30;
    const impactY1 = cy - 20;
    const impactX2 = cx + 30;
    const impactY2 = cy - 40;

    // Swords fly in (300ms, eased)
    this.tweens.add({
      targets: sword1,
      x: impactX1, y: impactY1,
      duration: 300,
      ease: 'Power3',
    });
    this.tweens.add({
      targets: sword2,
      x: impactX2, y: impactY2,
      duration: 300,
      ease: 'Power3',
      onComplete: () => {
        // === Impact! ===
        audioManager.playSfx('clash');

        // White screen flash
        const flash = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0xffffff)
          .setDepth(DEPTH.ui + 25).setAlpha(0.7);
        this.tweens.add({
          targets: flash, alpha: 0, duration: 150,
          onComplete: () => flash.destroy(),
        });

        // 12 sparks radiate outward from impact center
        const sparkCx = (impactX1 + impactX2) / 2;
        const sparkCy = (impactY1 + impactY2) / 2;
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
          const dist = 60 + Math.random() * 80;
          const spark = this.add.image(sparkCx, sparkCy, 'fx_intro_spark')
            .setDepth(DEPTH.ui + 22).setAlpha(1).setScale(1 + Math.random() * 0.5);

          this.tweens.add({
            targets: spark,
            x: sparkCx + Math.cos(angle) * dist,
            y: sparkCy + Math.sin(angle) * dist,
            alpha: 0,
            scale: 0,
            duration: 300 + Math.random() * 200,
            ease: 'Power2',
            onComplete: () => spark.destroy(),
          });
        }

        // Hold 200ms, then swords fade out
        this.time.delayedCall(200, () => {
          this.tweens.add({
            targets: [sword1, sword2],
            alpha: 0,
            scale: 1.5,
            duration: 200,
            onComplete: () => {
              sword1.destroy();
              sword2.destroy();
              onComplete();
            },
          });
        });
      },
    });
  }

  // ─── Update & Input ───

  update(time: number, delta: number): void {
    this.textBox.update(time, delta);

    // Update HUD
    const state = this.combat.getState();
    this.hud.updateDisplay(state.party, state.enemies, state.turn);

    // Update sprite visibility for dead combatants + enemy HP bars
    state.enemies.forEach((e, i) => {
      if (this.enemySprites[i]) {
        this.enemySprites[i].setAlpha(e.stats.hp > 0 ? 1 : 0.2);
      }
      // Update floating HP bar position & fill (centered above sprite)
      const bar = this.enemyHpBars[i];
      const sprite = this.enemySprites[i];
      if (bar && sprite) {
        const barX = sprite.x;
        const barY = sprite.y - sprite.displayHeight / 2 - 8;
        bar.bg.setPosition(barX, barY);
        if (e.stats.hp > 0) {
          const ratio = e.stats.hp / e.stats.maxHP;
          const fillW = 60 * ratio;
          bar.fill.setSize(fillW, 5);
          bar.fill.setPosition(barX - (60 - fillW) / 2, barY);
          bar.fill.setAlpha(1);
          bar.bg.setAlpha(1);
        } else {
          bar.fill.setAlpha(0);
          bar.bg.setAlpha(0.2);
        }
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
      // Update floating party HP bar position & fill
      const bar = this.partyHpBars[i];
      const sprite = this.partySprites[i];
      if (bar && sprite) {
        const barX = sprite.x;
        const barY = sprite.y - sprite.displayHeight / 2 - 8;
        bar.bg.setPosition(barX, barY);
        if (p.stats.hp > 0) {
          const ratio = p.stats.hp / p.stats.maxHP;
          const fillW = 60 * ratio;
          bar.fill.setSize(fillW, 5);
          bar.fill.setPosition(barX - (60 - fillW) / 2, barY);
          bar.fill.setAlpha(1);
          bar.bg.setAlpha(1);
        } else {
          bar.fill.setAlpha(0);
          bar.bg.setAlpha(0.2);
        }
      }
    });

    // Update status icons
    this.updateStatusIcons();

    // Idle breathing bob — subtle vertical oscillation with unique freq per sprite
    // Enemies use offset 0, party uses offset 4 so they never share the same freq/phase
    this.applyIdleBob(time, this.enemySprites, 0);
    this.applyIdleBob(time, this.partySprites, 4);
  }

  /** Apply sine-wave idle bob to sprites not currently in an action animation */
  private applyIdleBob(time: number, sprites: Phaser.GameObjects.Sprite[], indexOffset: number): void {
    const N = this.IDLE_BOB_FREQS.length;
    for (let i = 0; i < sprites.length; i++) {
      const s = sprites[i];
      if (!s || s.getData('inAction')) continue;
      const homeY = s.getData('homeY') as number;
      const idx = (i + indexOffset) % N;
      const freq = this.IDLE_BOB_FREQS[idx];
      const phase = this.IDLE_BOB_PHASES[idx];
      s.y = homeY + Math.sin(time * freq + phase) * this.IDLE_BOB_AMP;
    }
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

  /** Update status effect icons above sprites */
  private updateStatusIcons(): void {
    const state = this.combat.getState();
    const statusSymbols: Record<string, string> = { poison: '☠', paralysis: '⚡', confusion: '💫' };
    const statusColors: Record<string, string> = { poison: '#cc66ff', paralysis: '#ffee44', confusion: '#ff88cc' };

    // Clean up old icons
    for (const icons of this.statusIcons) {
      for (const icon of icons) icon.destroy();
    }
    this.statusIcons = [];

    const allCombatants = [...state.party, ...state.enemies];
    const allSprites = [...this.partySprites, ...this.enemySprites];

    allCombatants.forEach((c, gi) => {
      const sprite = allSprites[gi];
      if (!sprite || c.stats.hp <= 0) {
        this.statusIcons.push([]);
        return;
      }
      const icons: Phaser.GameObjects.Text[] = [];
      c.statusEffects.forEach((eff, si) => {
        const sym = statusSymbols[eff.type] ?? '?';
        const col = statusColors[eff.type] ?? '#ffffff';
        const icon = this.add.text(
          sprite.x - 15 + si * 18,
          sprite.y - sprite.displayHeight / 2 - 2,
          sym,
          { fontFamily: FONT_FAMILY, fontSize: '14px', color: col, stroke: '#000000', strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(DEPTH.characters + 3);
        icons.push(icon);
      });
      this.statusIcons.push(icons);
    });
  }

  /** Animate status tick results before showing menu */
  private animateStatusTicks(ticks: StatusTickResult[], index: number, onComplete: () => void): void {
    if (index >= ticks.length) { onComplete(); return; }

    const tick = ticks[index];
    const state = this.combat.getState();
    const sprite = tick.combatant.isEnemy
      ? this.enemySprites[tick.combatant.index]
      : this.partySprites[tick.combatant.index];

    if (!sprite) {
      this.addBattleLogMessage(tick.message);
      this.animateStatusTicks(ticks, index + 1, onComplete);
      return;
    }

    this.addBattleLogMessage(tick.message);

    switch (tick.type) {
      case 'damage': {
        // Poison tick: purple particles + damage number
        BattleEffects.playPoisonEffect(this, sprite.x, sprite.y);
        showDamageNumber(this, sprite.x, sprite.y - sprite.displayHeight / 2 - 10, tick.value ?? 0, 'damage');
        this.time.delayedCall(400, () => this.animateStatusTicks(ticks, index + 1, onComplete));
        break;
      }
      case 'recover': {
        // Recovery: green flash + message
        sprite.setTint(0x44ff44);
        showDamageNumber(this, sprite.x, sprite.y - sprite.displayHeight / 2 - 10, '恢復！', 'status');
        this.time.delayedCall(400, () => {
          sprite.clearTint();
          this.animateStatusTicks(ticks, index + 1, onComplete);
        });
        break;
      }
      default:
        this.time.delayedCall(300, () => this.animateStatusTicks(ticks, index + 1, onComplete));
    }
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
        // Cursor above enemies, below allies (DQ-style top-bottom)
        const cursorY = isAlly
          ? sprite.y + sprite.displayHeight / 2 + 20   // below ally
          : sprite.y - sprite.displayHeight / 2 - 20;  // above enemy
        this.targetCursor?.setPosition(sprite.x, cursorY).setVisible(true);
        this.targetCursor?.setAngle(isAlly ? 180 : 0);  // point down for allies, up for enemies
      }
    };
    updateCursor();

    const cleanup = () => {
      this.targetCursor?.setVisible(false);
      this.targetCursor?.setAngle(0);
      this.input.keyboard?.off('keydown-UP', onPrev);
      this.input.keyboard?.off('keydown-DOWN', onNext);
      this.input.keyboard?.off('keydown-LEFT', onPrev);
      this.input.keyboard?.off('keydown-RIGHT', onNext);
      this.input.keyboard?.off('keydown-ENTER', onConfirm);
      this.input.keyboard?.off('keydown-SPACE', onConfirm);
      this.input.keyboard?.off('keydown-Z', onConfirm);
    };

    const onPrev = () => {
      do { selectedIdx = (selectedIdx - 1 + targets.length) % targets.length; }
      while (targets[selectedIdx].stats.hp <= 0);
      updateCursor();
      audioManager.playSfx('select');
    };
    const onNext = () => {
      do { selectedIdx = (selectedIdx + 1) % targets.length; }
      while (targets[selectedIdx].stats.hp <= 0);
      updateCursor();
      audioManager.playSfx('select');
    };
    const onConfirm = () => {
      cleanup();
      onSelect(selectedIdx);
    };

    // UP/DOWN for vertical navigation (primary), LEFT/RIGHT as aliases
    this.input.keyboard?.on('keydown-UP', onPrev);
    this.input.keyboard?.on('keydown-DOWN', onNext);
    this.input.keyboard?.on('keydown-LEFT', onPrev);
    this.input.keyboard?.on('keydown-RIGHT', onNext);
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

        // Rush toward target (diagonal: party upper-right, enemies lower-left)
        actorSprite.setData('inAction', true);
        const rushX = action.isEnemy ? targetSprite.x - 40 : targetSprite.x + 40;
        const rushY = action.isEnemy ? targetSprite.y + 40 : targetSprite.y - 40;
        this.tweens.add({
          targets: actorSprite,
          x: rushX,
          y: rushY,
          duration: 250,
          ease: 'Power3',
          onComplete: () => {
            // Hit effects
            audioManager.playSfx('hit');
            BattleEffects.playAttackEffect(this, targetSprite.x, targetSprite.y);
            this.showDamageFromMessages(msgs);
            // Add messages to battle log
            for (const msg of msgs) this.addBattleLogMessage(msg);

            // Flash + shake target (diagonal shake)
            this.tweens.add({
              targets: targetSprite,
              x: targetSprite.x + 4,
              y: targetSprite.y + 4,
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
                    actorSprite.setData('inAction', false);
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
        // Step forward slightly (diagonal)
        actorSprite.setData('inAction', true);
        const stepX = action.isEnemy ? homeX - 25 : homeX + 25;
        const stepY = action.isEnemy ? homeY + 25 : homeY - 25;
        this.tweens.add({
          targets: actorSprite,
          x: stepX, y: stepY,
          duration: 150,
          onComplete: () => {
            // Play appropriate SFX based on skill type
            if (skill?.type === 'heal') {
              audioManager.playSfx('heal');
            } else if (skill?.type === 'physical') {
              audioManager.playSfx('hit');
            } else {
              audioManager.playSfx('magic');
            }

            const targetSprites = this.getActionTargetSprites(action);

            for (const ts of targetSprites) {
              if (skill?.type === 'heal') {
                BattleEffects.playHealEffect(this, ts.x, ts.y);
              } else if (skill?.type === 'physical') {
                // Physical skill: flash target (same as basic attack)
                this.tweens.add({
                  targets: ts, alpha: 0.3, duration: 60, yoyo: true, repeat: 2,
                });
              } else {
                BattleEffects.playMagicEffect(this, ts.x, ts.y, skill?.element ?? '');
                this.tweens.add({
                  targets: ts, alpha: 0.3, duration: 60, yoyo: true, repeat: 2,
                });
              }
            }
            this.showDamageFromMessages(msgs);
            // Add messages to battle log
            for (const msg of msgs) this.addBattleLogMessage(msg);

            this.time.delayedCall(350, () => {
              // Return to home (diagonal)
              this.tweens.add({
                targets: actorSprite,
                x: homeX, y: homeY,
                duration: 150,
                onComplete: () => {
                  actorSprite.setData('inAction', false);
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

      case 'flee': {
        for (const msg of msgs) this.addBattleLogMessage(msg);
        if (this.combat.getState().phase === 'fled') {
          // Flee succeeded — skip remaining actions, go to result
          this.time.delayedCall(400, () => this.checkBattleResult());
          return;
        }
        // Flee failed — continue to next action
        this.time.delayedCall(300, () => this.playActionSequence(results, index + 1));
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
            showDamageNumber(this, sprite.x, sprite.y - sprite.displayHeight / 2 - 10, parseInt(dmgMatch[1]), 'damage');
          }
        }
      }
      const healMatch = msg.match(/恢復了? (\d+)/);
      if (healMatch) {
        const healTarget = msg.match(/(.+?) 恢復/);
        if (healTarget) {
          const p = state.party.find(p => p.name === healTarget[1]);
          if (p && this.partySprites[p.index]) {
            showDamageNumber(this, this.partySprites[p.index].x, this.partySprites[p.index].y - this.partySprites[p.index].displayHeight / 2 - 10, parseInt(healMatch[1]), 'heal');
          }
        }
      }

      // Status application — show floating text and effect
      const statusMatch = msg.match(/(.+?) (中毒|麻痺|混亂)了！/);
      if (statusMatch) {
        const targetName = statusMatch[1];
        const statusText = statusMatch[2] + '!';
        const enemy = state.enemies.find(e => e.name === targetName);
        const ally = state.party.find(p => p.name === targetName);
        const sprite = enemy ? this.enemySprites[enemy.index] : ally ? this.partySprites[ally.index] : null;
        if (sprite) {
          showDamageNumber(this, sprite.x, sprite.y - sprite.displayHeight / 2 - 25, statusText, 'status');
          // Play corresponding effect
          if (statusMatch[2] === '中毒') BattleEffects.playPoisonEffect(this, sprite.x, sprite.y);
          else if (statusMatch[2] === '麻痺') BattleEffects.playParalysisEffect(this, sprite.x, sprite.y);
          else if (statusMatch[2] === '混亂') BattleEffects.playConfusionEffect(this, sprite.x, sprite.y);
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
      // Next turn — process status ticks with animation
      const tickResults = this.combat.startTurn();
      this.currentPartyIndex = 0;
      this.partyActions = [];

      if (tickResults.length > 0) {
        // Animate status ticks before showing menu
        this.animateStatusTicks(tickResults, 0, () => {
          // Check if status ticks killed someone
          if (this.combat.checkBattleEnd()) {
            this.checkBattleResult();
            return;
          }
          this.uiPhase = 'menu';
          if (this.autoAttackMode) {
            this.time.delayedCall(200, () => this.showMenuForCurrentMember());
          } else {
            this.showMenuForCurrentMember();
          }
        });
      } else {
        this.uiPhase = 'menu';
        if (this.autoAttackMode) {
          this.time.delayedCall(200, () => this.showMenuForCurrentMember());
        } else {
          this.showMenuForCurrentMember();
        }
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
        } else {
          lines.push(`${companionData.name} 成為了夥伴！隊伍已滿，可在選單中編組隊伍。`);
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
