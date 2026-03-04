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
import { getAllConsumables, getAllEquipments } from '../data/items/index';
import type { BattleResult, LevelUpInfo } from '../types';

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

  // Death animation tracking (prevent re-triggering)
  private deadSet: Set<string> = new Set();

  // Visual HP/MP tracking — reveals damage progressively during action animation
  // When null, HUD uses actual combat state values. When set, HUD uses these instead.
  private visualHP: { hp: number; mp: number }[] | null = null;

  // Victory flow — bypass old advanceResult() when new phased flow handles input
  private resultHandledByCallback = false;

  // Optional callbacks from caller
  private skipIntro = false;
  private onVictoryCallback?: () => void;

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

  create(data: { monsters: MonsterData[]; regionId: string; isBoss?: boolean; returnScene: string; returnData: object; skipIntro?: boolean; onVictory?: () => void; battleBgKey?: string }): void {
    this.monsters = data.monsters;
    this.regionId = data.regionId;
    this.isBoss = data.isBoss ?? false;
    this.returnScene = data.returnScene;
    this.returnData = data.returnData;
    this.skipIntro = data.skipIntro ?? false;
    this.onVictoryCallback = data.onVictory;

    // Initialize combat
    const party = gameState.getParty();
    this.combat = new CombatSystem(party, this.monsters);
    this.combat.startTurn();

    // Battle background — caller override > boss variant > normal variant > fallback
    const bgKey = data.battleBgKey
      ?? (this.isBoss ? `battle_bg_${this.regionId}_boss` : `battle_bg_${this.regionId}`);
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
      // Hidden by default — shown only during targeting and briefly after damage
      bg.setAlpha(0);
      fill.setAlpha(0);
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

    // Party HP is shown in BattleHUD — no floating bars needed (clean JRPG style)
    this.partyHpBars = [];

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
    this.autoAttackLabel = this.add.text(160, GAME_HEIGHT - 30, t('battle.auto_attack'), {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: '#ffdd44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.ui + 10).setVisible(false);
    this.autoAttackCancelLabel = this.add.text(160, GAME_HEIGHT - 14, `(${t('battle.auto_cancel')})`, {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#aaaaaa',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(DEPTH.ui + 10).setVisible(false);

    // Reset state for scene re-entry
    this.deadSet = new Set();
    this.resultHandledByCallback = false;

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
    if (this.skipIntro) {
      this.time.delayedCall(300, () => {
        this.uiPhase = 'menu';
        this.showMenuForCurrentMember();
      });
    } else {
      this.time.delayedCall(200, () => {
        this.playSwordCrossingIntro(() => {
          this.textBox.show('', t('battle.encounter', monsterNames), () => {
            this.uiPhase = 'menu';
            this.textBox.hide();
            this.showMenuForCurrentMember();
          });
        });
      });
    }
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

    // Text object — newest first, word-wrapped with CJK support
    const wrapWidth = logW - 20;
    this.battleLogText = this.add.text(logX + 8, logY + 4, '', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#ccddee',
      wordWrap: { width: wrapWidth },
      lineSpacing: 2,
    }).setDepth(DEPTH.ui + 3);
    this.battleLogText.style.wordWrapCallback = (_text: string, textObject: Phaser.GameObjects.Text) => {
      const ctx = textObject.context;
      let result = '';
      let lineWidth = 0;
      for (const char of _text) {
        if (char === '\n') { result += '\n'; lineWidth = 0; continue; }
        const w = ctx.measureText(char).width;
        if (lineWidth + w > wrapWidth && lineWidth > 0) {
          result += '\n';
          lineWidth = 0;
        }
        result += char;
        lineWidth += w;
      }
      return result;
    };

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

    // Update HUD — use visual HP during action animations for per-hit display
    const state = this.combat.getState();
    if (this.visualHP) {
      const visualParty = state.party.map((m, i) => ({
        ...m,
        stats: { ...m.stats, hp: this.visualHP![i]?.hp ?? m.stats.hp, mp: this.visualHP![i]?.mp ?? m.stats.mp },
      }));
      this.hud.updateDisplay(visualParty, state.enemies, state.turn);
    } else {
      this.hud.updateDisplay(state.party, state.enemies, state.turn);
    }

    // Update sprite visibility for dead combatants + enemy HP bars
    state.enemies.forEach((e, i) => {
      if (this.enemySprites[i] && e.stats.hp <= 0) {
        const deathKey = `enemy_${i}`;
        if (!this.deadSet.has(deathKey)) {
          this.deadSet.add(deathKey);
          BattleEffects.playDeathAnimation(this, this.enemySprites[i]);
        }
      }
      // Update floating HP bar position & fill (hidden by default, shown during targeting)
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
          // Alpha managed by showTargetSelect / flashEnemyHpBar — don't override here
        } else {
          bar.fill.setAlpha(0);
          bar.bg.setAlpha(0);
        }
      }
    });
    state.party.forEach((p, i) => {
      const isDown = p.stats.hp <= 0;
      const isNearDeath = p.stats.hp > 0 && p.stats.hp <= p.stats.maxHP * 0.25;

      if (this.partySprites[i]) {
        if (isDown) {
          const deathKey = `party_${i}`;
          if (!this.deadSet.has(deathKey)) {
            this.deadSet.add(deathKey);
            this.stopNearDeathPulse(i);
            BattleEffects.playDeathAnimation(this, this.partySprites[i]);
          }
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
      // Party HP bars removed — displayed in BattleHUD (JRPG style)
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
        if (this.resultHandledByCallback) {
          // New phased victory flow — advance textbox (triggers onComplete callbacks)
          if (this.textBox.visible) {
            this.textBox.advance();
          }
        } else {
          this.advanceResult();
        }
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
      // All enemies already dead — proceed to execute turn so victory is detected
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

  private showTargetSelect(isAlly: boolean, onSelect: (index: number) => void, reviveMode = false): void {
    const state = this.combat.getState();
    const targets = isAlly ? state.party : state.enemies;
    const sprites = isAlly ? this.partySprites : this.enemySprites;
    // In revive mode, select only KO'd allies; otherwise only alive targets
    const isValidTarget = (t: CombatantState) => reviveMode ? t.stats.hp <= 0 : t.stats.hp > 0;
    let selectedIdx = targets.findIndex(isValidTarget);
    if (selectedIdx === -1) selectedIdx = 0; // fallback

    // Show enemy HP bars during target selection (JRPG: reveal HP when choosing target)
    if (!isAlly) {
      this.enemyHpBars.forEach((bar, idx) => {
        if (targets[idx] && targets[idx].stats.hp > 0) {
          bar.bg.setAlpha(1);
          bar.fill.setAlpha(1);
        }
      });
    }

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
      // Hide enemy HP bars after target selection (JRPG style)
      if (!isAlly) {
        this.enemyHpBars.forEach(bar => {
          bar.bg.setAlpha(0);
          bar.fill.setAlpha(0);
        });
      }
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
      while (!isValidTarget(targets[selectedIdx]));
      updateCursor();
      audioManager.playSfx('select');
    };
    const onNext = () => {
      do { selectedIdx = (selectedIdx + 1) % targets.length; }
      while (!isValidTarget(targets[selectedIdx]));
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
      if (targets[i] && isValidTarget(targets[i])) {
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
    const skillPanelH = Math.min(320, 160 + skills.length * 36);
    if (this.textures.exists('ui_panel_menu')) {
      panel = this.add.image(panelX, panelY, 'ui_panel_menu').setDepth(DEPTH.overlay);
    } else {
      panel = this.add.rectangle(panelX, panelY, 300, skillPanelH, COLORS.panel, 0.95).setDepth(DEPTH.overlay);
      border = this.add.rectangle(panelX, panelY, 304, skillPanelH + 4, COLORS.panelBorder).setDepth(DEPTH.overlay - 1);
    }
    const title = this.add.text(panelX, panelY - 110, t('battle.select_skill'), {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(DEPTH.overlay + 1);

    const items: Phaser.GameObjects.Text[] = [];
    const mpTexts: Phaser.GameObjects.Text[] = [];
    const skillIcons: Phaser.GameObjects.Image[] = [];
    let selectedIdx = 0;

    // Description text below the skill list
    const descText = this.add.text(panelX, panelY + 100, '', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#eeeeff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.overlay + 1);

    skills.forEach((skill, i) => {
      const canUse = actor.stats.mp >= skill.mpCost;
      const iy = panelY - 80 + i * 36;
      // Skill icon
      const iconKey = ItemIconRenderer.getSkillIconKey(skill.element, skill.type);
      if (this.textures.exists(iconKey)) {
        const icon = this.add.image(panelX - 130, iy + 9, iconKey).setScale(0.65).setDepth(DEPTH.overlay + 1);
        if (!canUse) icon.setAlpha(0.4);
        skillIcons.push(icon);
      }
      const text = this.add.text(panelX - 115, iy, `  ${skill.name}`, {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: canUse ? COLORS.textPrimary : '#666666',
      }).setDepth(DEPTH.overlay + 1);

      // Right-aligned MP cost + level
      const mpText = this.add.text(panelX + 100, iy, `MP ${skill.mpCost}`, {
        fontFamily: FONT_FAMILY, fontSize: '12px', color: canUse ? '#88aacc' : '#555555',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 0).setDepth(DEPTH.overlay + 1);
      mpTexts.push(mpText);
      const lvText = this.add.text(panelX + 135, iy + 1, `Lv.${skill.levelRequired}`, {
        fontFamily: FONT_FAMILY, fontSize: '11px', color: '#7799aa',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 0).setDepth(DEPTH.overlay + 1);
      skillIcons.push(lvText as any); // reuse cleanup array

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
        txt.setText(i === selectedIdx ? `► ${skills[i].name}` : `  ${skills[i].name}`);
        if (canUse && i === selectedIdx) txt.setColor(COLORS.textHighlight);
        else if (canUse) txt.setColor(COLORS.textPrimary);
      });
      // Update description
      const sel = skills[selectedIdx];
      if (sel) {
        const typeLabel = sel.type === 'physical' ? '物理' : sel.type === 'magical' ? '魔法' : sel.type === 'heal' ? '回復' : '輔助';
        descText.setText(`${sel.description}  [${typeLabel}] 威力:${sel.power}`);
      }
    };
    updateList();

    const cleanup = () => {
      panel.destroy(); border?.destroy(); title.destroy(); descText.destroy();
      items.forEach(t => t.destroy());
      mpTexts.forEach(t => t.destroy());
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

    // Description text below the item list
    const descText = this.add.text(panelX, panelY + 100, '', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#eeeeff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.overlay + 1);

    const itemIcons: Phaser.GameObjects.Image[] = [];
    usable.forEach((entry, i) => {
      const iy = panelY - 80 + i * 34;
      // Icon
      const iconKey = ItemIconRenderer.getIconKey(entry.item.id);
      if (this.textures.exists(iconKey)) {
        const icon = this.add.image(panelX - 130, iy + 9, iconKey).setScale(0.45).setDepth(DEPTH.overlay + 1);
        itemIcons.push(icon);
      }
      const text = this.add.text(panelX - 100, iy, `  ${entry.item.name} ×${entry.quantity}`, {
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
      // Update description
      const sel = usable[selectedIdx];
      descText.setText(sel ? sel.item.description : '');
    };
    updateList();

    const cleanup = () => {
      panel.destroy(); border?.destroy(); title.destroy(); descText.destroy();
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
      // Revival items target KO'd allies, others target alive allies
      const isReviveItem = usable[i].item.effect?.type === 'revive';
      this.uiPhase = 'target_select';
      this.showTargetSelect(true, (targetIndex) => {
        this.partyActions.push({
          type: 'item', actorIndex: this.currentPartyIndex, isEnemy: false,
          itemId: usable[i].item.id, targetIndex,
        });
        this.currentPartyIndex++;
        this.uiPhase = 'menu';
        this.showMenuForCurrentMember();
      }, isReviveItem);
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

    // Snapshot party HP/MP BEFORE combat resolves — for progressive visual display
    const state = this.combat.getState();
    this.visualHP = state.party.map(m => ({ hp: m.stats.hp, mp: m.stats.mp }));

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
      // All animations done — clear visual HP override so HUD shows actual values
      this.visualHP = null;
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
            // Screen shake — heavier for boss enemies
            const isBossHit = action.isEnemy && this.isBoss;
            BattleEffects.playScreenShake(this, isBossHit ? 0.012 : 0.004, isBossHit ? 250 : 120);
            this.showDamageFromMessages(msgs);
            this.revealVisualHPFromMessages(msgs);
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

            // AoE skills get medium screen shake
            const isAoE = skill?.target === 'all_enemies' || skill?.target === 'all_allies';
            if (isAoE && skill?.type !== 'heal') {
              BattleEffects.playScreenShake(this, 0.006, 180);
            }

            for (const ts of targetSprites) {
              if (skill?.type === 'heal') {
                BattleEffects.playHealingAura(this, ts.x, ts.y);
              } else if (skill?.type === 'physical') {
                // Physical skill: flash target (same as basic attack)
                BattleEffects.playScreenShake(this, 0.004, 120);
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
            this.revealVisualHPFromMessages(msgs);
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
          BattleEffects.playHealingAura(this, targetSprite.x, targetSprite.y);
          this.showDamageFromMessages(msgs);
          this.revealVisualHPFromMessages(msgs);
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
            // Flash enemy HP bar briefly after taking damage (JRPG style)
            if (enemy) this.flashEnemyHpBar(enemy.index);
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

  /** Briefly flash an enemy HP bar visible after taking damage (2s fade-out) */
  private flashEnemyHpBar(enemyIndex: number): void {
    const bar = this.enemyHpBars[enemyIndex];
    if (!bar) return;
    // Show immediately
    bar.bg.setAlpha(1);
    bar.fill.setAlpha(1);
    // Fade out after 1.5s
    this.tweens.add({
      targets: [bar.bg, bar.fill],
      alpha: 0,
      delay: 1500,
      duration: 500,
      ease: 'Power2',
    });
  }

  /** Update visualHP to reveal damage/heal from action messages for progressive HUD display */
  private revealVisualHPFromMessages(msgs: string[]): void {
    if (!this.visualHP) return;
    const state = this.combat.getState();
    for (const msg of msgs) {
      // Damage to party member
      const dmgMatch = msg.match(/對 (.+?) 造成 (\d+) 點傷害/);
      if (dmgMatch) {
        const name = dmgMatch[1];
        const damage = parseInt(dmgMatch[2]);
        const idx = state.party.findIndex(p => p.name === name);
        if (idx >= 0 && this.visualHP[idx]) {
          this.visualHP[idx].hp = Math.max(0, this.visualHP[idx].hp - damage);
        }
      }
      // Heal on party member
      const healMatch = msg.match(/(.+?) 恢復了? (\d+)/);
      if (healMatch) {
        const name = healMatch[1];
        const amount = parseInt(healMatch[2]);
        const idx = state.party.findIndex(p => p.name === name);
        if (idx >= 0 && this.visualHP[idx]) {
          const max = state.party[idx].stats.maxHP;
          this.visualHP[idx].hp = Math.min(max, this.visualHP[idx].hp + amount);
        }
      }
      // MP cost (from skill usage)
      const mpMatch = msg.match(/(.+?) 消耗了? (\d+) MP/);
      if (mpMatch) {
        const name = mpMatch[1];
        const cost = parseInt(mpMatch[2]);
        const idx = state.party.findIndex(p => p.name === name);
        if (idx >= 0 && this.visualHP[idx]) {
          this.visualHP[idx].mp = Math.max(0, this.visualHP[idx].mp - cost);
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
        // Check for revival items before going to game over
        const reviveItems = InventorySystem.getUsableItems().filter(
          e => e.item.effect?.type === 'revive' && e.quantity > 0
        );
        const deadMembers = state.party.filter(p => p.stats.hp <= 0);
        if (reviveItems.length > 0 && deadMembers.length > 0) {
          this.showRevivalPrompt(reviveItems[0].item, deadMembers, () => this.showDefeat());
          return;
        }
        this.showDefeat();
      } else if (state.phase === 'fled') {
        this.addBattleLogMessage(t('battle.fled'));
        this.time.delayedCall(600, () => this.returnToField());
      }
    } else {
      // Next turn — process status ticks with animation
      const tickResults = this.combat.startTurn();
      const newState = this.combat.getState();
      this.addBattleLogMessage(`── 第 ${newState.turn} 回合 ──`);
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

    // Use new phased flow — bypass old advanceResult()
    this.resultHandledByCallback = true;

    // Check if mini-boss was defeated (demon kingdom guard)
    if (this.monsters.some(m => m.id === 'r12_mini_boss')) {
      gameState.setFlag('mini_boss_demon_defeated');
    }

    // Phase 1: Celebration → Phase 2: Rewards → Phase 3: Level Ups → Phase 4: Boss → Return
    this.playVictoryCelebration(() => {
      this.showVictoryRewardsPanel(result, () => {
        this.showLevelUps(result.levelUps, 0, () => {
          this.handleBossVictory(result, () => {
            this.onVictoryCallback?.();
            this.returnToField();
          });
        });
      });
    });
  }

  // ─── Victory Phase 1: Celebration ───

  private playVictoryCelebration(onComplete: () => void): void {
    // Party sprites bounce up (staggered)
    this.partySprites.forEach((sprite, i) => {
      if (sprite.alpha < 0.5) return; // skip dead
      const homeY = sprite.getData('homeY') as number;
      this.tweens.add({
        targets: sprite,
        y: homeY - 30,
        duration: 250,
        yoyo: true,
        ease: 'Quad.easeOut',
        delay: i * 100,
      });
    });

    // "勝利！" gold text with scale-in
    const victoryText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, '勝利！', {
      fontFamily: FONT_FAMILY, fontSize: '48px', color: '#ffd700',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setScale(0).setDepth(DEPTH.overlay + 25);

    this.tweens.add({
      targets: victoryText,
      scale: { from: 0, to: 1.4 },
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: victoryText,
          scale: 1.0,
          duration: 200,
          onComplete: () => {
            // Hold for 800ms, then fade out
            this.tweens.add({
              targets: victoryText,
              alpha: 0,
              y: victoryText.y - 20,
              duration: 500,
              delay: 800,
              onComplete: () => {
                victoryText.destroy();
                onComplete();
              },
            });
          },
        });
      },
    });
  }

  // ─── Victory Phase 2: Rewards Panel ───

  private showVictoryRewardsPanel(result: BattleResult, onComplete: () => void): void {
    const panelElements: Phaser.GameObjects.GameObject[] = [];
    const cx = GAME_WIDTH / 2;

    // Calculate panel height based on content
    const hasDrops = result.drops.length > 0;
    const dropRows = Math.ceil(result.drops.length / 4);
    const panelH = 140 + (hasDrops ? 30 + dropRows * 70 : 0);
    const panelTop = GAME_HEIGHT / 2 - panelH / 2;
    const panelW = 420;

    // Panel background + border
    const border = this.add.rectangle(cx, GAME_HEIGHT / 2, panelW + 4, panelH + 4, COLORS.panelBorder)
      .setDepth(DEPTH.overlay + 10);
    const bg = this.add.rectangle(cx, GAME_HEIGHT / 2, panelW, panelH, COLORS.panel, 0.95)
      .setDepth(DEPTH.overlay + 11);
    panelElements.push(border, bg);

    // Title
    const title = this.add.text(cx, panelTop + 18, '── 戰果 ──', {
      fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(DEPTH.overlay + 12);
    panelElements.push(title);

    // EXP line with counting animation
    const expLabel = this.add.text(cx - 160, panelTop + 50, `EXP: 0`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: '#88ccff',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(DEPTH.overlay + 12);
    panelElements.push(expLabel);

    const expCounter = { val: 0 };
    this.tweens.add({
      targets: expCounter,
      val: result.exp,
      duration: 600,
      onUpdate: () => { expLabel.setText(`EXP: ${Math.floor(expCounter.val)}`); },
    });

    // Gold line with counting animation
    const goldLabel = this.add.text(cx + 20, panelTop + 50, `Gold: 0`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: '#ffdd44',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(DEPTH.overlay + 12);
    panelElements.push(goldLabel);

    const goldCounter = { val: 0 };
    this.tweens.add({
      targets: goldCounter,
      val: result.gold,
      duration: 600,
      onUpdate: () => { goldLabel.setText(`Gold: ${Math.floor(goldCounter.val)}`); },
    });

    // Mini-boss message
    if (this.monsters.some(m => m.id === 'r12_mini_boss')) {
      const mbText = this.add.text(cx, panelTop + 80, '魔王護衛已被擊敗！', {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ff8844',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(DEPTH.overlay + 12);
      panelElements.push(mbText);
    }

    // Item drops with icons
    if (hasDrops) {
      const dropTitle = this.add.text(cx - 160, panelTop + 90, '取得道具:', {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textHighlight,
        stroke: '#000000', strokeThickness: 2,
      }).setDepth(DEPTH.overlay + 12);
      panelElements.push(dropTitle);

      result.drops.forEach((dropName, di) => {
        const row = Math.floor(di / 4);
        const col = di % 4;
        const ix = cx - 150 + col * 95;
        const iy = panelTop + 115 + row * 70;

        // Try to show item icon
        const iconKey = this.findItemIconKeyByName(dropName);
        if (iconKey && this.textures.exists(iconKey)) {
          const icon = this.add.image(ix + 16, iy + 16, iconKey)
            .setDisplaySize(32, 32).setDepth(DEPTH.overlay + 13);
          panelElements.push(icon);
        }

        // Item name
        const nameText = this.add.text(ix, iy + 38, dropName, {
          fontFamily: FONT_FAMILY, fontSize: '11px', color: COLORS.textPrimary,
          stroke: '#000000', strokeThickness: 2,
        }).setDepth(DEPTH.overlay + 12);
        panelElements.push(nameText);
      });
    }

    // "▼ 按 Enter 繼續" blinking prompt
    const promptText = this.add.text(cx, panelTop + panelH - 20, '▼ 按 Enter 繼續', {
      fontFamily: FONT_FAMILY, fontSize: '13px', color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(DEPTH.overlay + 12);
    panelElements.push(promptText);
    this.tweens.add({
      targets: promptText,
      alpha: { from: 1, to: 0.3 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Wait for user input
    const cleanup = () => {
      for (const el of panelElements) el.destroy();
      this.input.keyboard?.off('keydown-ENTER', onConfirm);
      this.input.keyboard?.off('keydown-SPACE', onConfirm);
      this.input.keyboard?.off('keydown-Z', onConfirm);
    };
    const onConfirm = () => {
      cleanup();
      onComplete();
    };

    // Enable input after a short delay (prevent accidental skip)
    this.time.delayedCall(700, () => {
      this.input.keyboard?.on('keydown-ENTER', onConfirm);
      this.input.keyboard?.on('keydown-SPACE', onConfirm);
      this.input.keyboard?.on('keydown-Z', onConfirm);
    });
  }

  // ─── Victory Phase 3: Level Ups (recursive) ───

  private showLevelUps(levelUps: LevelUpInfo[], index: number, onComplete: () => void): void {
    if (index >= levelUps.length) {
      onComplete();
      return;
    }

    const lu = levelUps[index];
    audioManager.playSfx('levelup');

    // Golden flash
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffd700, 0)
      .setDepth(DEPTH.overlay + 20);
    this.tweens.add({
      targets: flash, alpha: { from: 0, to: 0.35 }, yoyo: true, duration: 300,
      onComplete: () => flash.destroy(),
    });

    // Particle effect on correct party sprite
    const state = this.combat.getState();
    const charIndex = state.party.findIndex(p => p.id === lu.characterId);
    const charSprite = this.partySprites[charIndex >= 0 ? charIndex : 0];
    if (charSprite) {
      BattleEffects.playLevelUpEffect(this, charSprite.x, charSprite.y - 40);
    }

    // ─── Celebration panel ───
    const panelContainer = this.add.container(0, 0).setDepth(DEPTH.overlay + 21);

    // Panel background
    const panelW = 360;
    const panelCX = GAME_WIDTH / 2;
    const panelTopY = 120;
    const panelBg = this.add.rectangle(panelCX, panelTopY + 160, panelW + 4, 320 + 4, COLORS.panelBorder);
    const panelBgInner = this.add.rectangle(panelCX, panelTopY + 160, panelW, 320, COLORS.panel, 0.95);
    panelContainer.add([panelBg, panelBgInner]);

    // "LEVEL UP!" header with bounce
    const charName = state.party[charIndex >= 0 ? charIndex : 0]?.name ?? lu.characterId;
    const headerText = this.add.text(panelCX, panelTopY + 16, `✦ ${charName} LEVEL UP! ✦`, {
      fontFamily: FONT_FAMILY, fontSize: '22px', color: '#ffd700',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScale(0);
    panelContainer.add(headerText);
    this.tweens.add({
      targets: headerText, scale: { from: 0, to: 1.2 }, duration: 300, ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({ targets: headerText, scale: 1.0, duration: 200 }),
    });

    // Level line
    const levelLine = this.add.text(panelCX, panelTopY + 52, `Lv ${lu.oldLevel}  →  Lv ${lu.newLevel}`, {
      fontFamily: FONT_FAMILY, fontSize: '18px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);
    panelContainer.add(levelLine);
    this.tweens.add({ targets: levelLine, alpha: 1, y: levelLine.y - 4, duration: 300, delay: 200 });

    // Per-stat gain lines with staggered animation
    const statLabels: Record<string, string> = { maxHP: 'HP', maxMP: 'MP', atk: '攻擊', def: '防禦', agi: '敏捷', luck: '幸運' };
    const statColors: Record<string, string> = { maxHP: '#ff6666', maxMP: '#6699ff', atk: '#ff9944', def: '#66cc66', agi: '#cccc44', luck: '#cc88ff' };
    const statOrder = ['maxHP', 'maxMP', 'atk', 'def', 'agi', 'luck'];

    let lineY = panelTopY + 84;
    let lineDelay = 400;
    for (const key of statOrder) {
      const gain = (lu.statGains as Record<string, number>)[key];
      if (!gain || gain <= 0) continue;

      const label = statLabels[key] ?? key;
      const color = statColors[key] ?? '#ffffff';

      // Stat label (left-aligned)
      const statLabel = this.add.text(panelCX - panelW / 2 + 40, lineY, label, {
        fontFamily: FONT_FAMILY, fontSize: '16px', color: '#cccccc',
        stroke: '#000000', strokeThickness: 2,
      }).setAlpha(0);
      panelContainer.add(statLabel);

      // Gain value (right side, highlighted)
      const gainText = this.add.text(panelCX + panelW / 2 - 40, lineY, `+${gain}`, {
        fontFamily: FONT_FAMILY, fontSize: '18px', color,
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(1, 0).setAlpha(0);
      panelContainer.add(gainText);

      // Animate in with stagger
      this.tweens.add({ targets: statLabel, alpha: 1, x: statLabel.x + 8, duration: 250, delay: lineDelay });
      this.tweens.add({
        targets: gainText, alpha: 1, scale: { from: 1.4, to: 1.0 }, duration: 300, delay: lineDelay + 50,
      });

      lineY += 32;
      lineDelay += 120;
    }

    // Stat points gained
    if (lu.statPoints > 0) {
      const spText = this.add.text(panelCX, lineY + 4, `可分配點數 +${lu.statPoints}`, {
        fontFamily: FONT_FAMILY, fontSize: '15px', color: '#ffd700',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0);
      panelContainer.add(spText);
      this.tweens.add({ targets: spText, alpha: 1, duration: 300, delay: lineDelay });
      lineY += 28;
      lineDelay += 120;
    }

    // New skills
    for (const skillId of lu.newSkills) {
      const skill = getSkillById(skillId);
      if (!skill) continue;
      const skillText = this.add.text(panelCX, lineY + 4, `★ 習得新技能：${skill.name}！`, {
        fontFamily: FONT_FAMILY, fontSize: '15px', color: '#44ffaa',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0);
      panelContainer.add(skillText);
      this.tweens.add({ targets: skillText, alpha: 1, scale: { from: 0.8, to: 1.0 }, duration: 400, delay: lineDelay, ease: 'Back.easeOut' });
      lineY += 28;
      lineDelay += 150;
    }

    // Resize panel to fit content
    const totalH = lineY - panelTopY + 30;
    panelBg.setSize(panelW + 4, totalH + 4).setY(panelTopY + totalH / 2);
    panelBgInner.setSize(panelW, totalH).setY(panelTopY + totalH / 2);

    // "Press Enter" hint (appears after all animations)
    const hintText = this.add.text(panelCX, panelTopY + totalH - 8, '▼ 按 Enter 繼續', {
      fontFamily: FONT_FAMILY, fontSize: '13px', color: '#999999',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0);
    panelContainer.add(hintText);
    this.tweens.add({
      targets: hintText, alpha: { from: 0, to: 0.8 }, duration: 400, delay: lineDelay + 200,
      yoyo: true, repeat: -1, hold: 600,
    });

    // Wait for user input to dismiss
    const dismiss = () => {
      panelContainer.destroy();
      this.showLevelUps(levelUps, index + 1, onComplete);
    };

    this.time.delayedCall(lineDelay + 300, () => {
      this.input.keyboard?.once('keydown-ENTER', dismiss);
      this.input.keyboard?.once('keydown-SPACE', dismiss);
      this.input.keyboard?.once('keydown-Z', dismiss);
      this.input.once('pointerdown', dismiss);
    });
  }

  // ─── Victory Phase 4: Boss Victory ───

  private handleBossVictory(result: BattleResult, onComplete: () => void): void {
    if (!this.isBoss) {
      onComplete();
      return;
    }

    gameState.liberateRegion(this.regionId);
    const liberationLines = [`${gameState.getState().heroName} 解放了此地區！`];

    // Demon king defeated — ending
    const region = getRegionById(this.regionId);
    if (region?.type === 'final') {
      gameState.setGameCompleted();
      SaveLoadSystem.autoSave();
      this.showTextSequence(liberationLines, 0, () => {
        this.returnToField(); // redirects to EndingScene
      });
      return;
    }

    // Add companion for this region
    const companion = getCompanionForRegion(this.regionId);
    if (companion && !gameState.getCompanion(companion.id)) {
      const companionData = structuredClone(companion);
      gameState.addCompanion(companionData);
      const joinedParty = gameState.addToParty(companionData.id);

      this.showTextSequence(liberationLines, 0, () => {
        this.showCompanionJoinCeremony(companionData, joinedParty, onComplete);
      });
    } else {
      this.showTextSequence(liberationLines, 0, onComplete);
    }
  }

  // ─── Helper: Sequential text display ───

  private showTextSequence(lines: string[], index: number, onComplete: () => void): void {
    if (index >= lines.length) {
      this.textBox.hide();
      onComplete();
      return;
    }

    this.textBox.show('', lines[index], () => {
      this.showTextSequence(lines, index + 1, onComplete);
    });
  }

  // ─── Helper: Find item icon key by name ───

  private findItemIconKeyByName(name: string): string | null {
    const allItems = [...getAllConsumables(), ...getAllEquipments()];
    const found = allItems.find(item => item.name === name);
    return found ? ItemIconRenderer.getIconKey(found.id) : null;
  }

  // ─── Companion Join Ceremony ───

  private showCompanionJoinCeremony(
    companion: { id: string; name: string; race: string; level: number; stats: any; skills: string[] },
    joinedParty: boolean,
    onComplete: () => void,
  ): void {
    const ceremonyElements: Phaser.GameObjects.GameObject[] = [];
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Race → class label mapping
    const classMap: Record<string, string> = {
      elf: '弓箭手', treant: '賢者', beastman: '格鬥家',
      merfolk: '白魔法師', giant: '機器人', dwarf: '盜賊', undead: '黑魔法師',
    };
    const classLabel = classMap[companion.race] ?? '冒險者';

    // 1. Dark overlay (fade in)
    const overlay = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
      .setDepth(DEPTH.overlay + 30);
    ceremonyElements.push(overlay);
    this.tweens.add({ targets: overlay, alpha: 0.6, duration: 400 });

    // 2. Portrait slides in from right
    const portraitX = cx - 80;
    const portraitY = cy - 40;
    const battleTexKey = `char_${companion.id}_battle`;
    const overworldTexKey = getCompanionTextureKey(companion.id) ?? `char_${companion.id}`;
    const useBattleTex = this.textures.exists(battleTexKey);
    const actualTexKey = useBattleTex ? battleTexKey : overworldTexKey;
    const portraitScale = useBattleTex ? 1.0 : 2.5;
    const portraitFrame = useBattleTex ? 21 : 1; // down_right idle frame

    let portrait: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
    if (this.textures.exists(actualTexKey)) {
      portrait = this.add.sprite(GAME_WIDTH + 100, portraitY, actualTexKey, portraitFrame)
        .setScale(portraitScale).setDepth(DEPTH.overlay + 31);
    } else {
      // Fallback: colored rectangle placeholder
      portrait = this.add.rectangle(GAME_WIDTH + 100, portraitY, 80, 120, 0x6688cc)
        .setDepth(DEPTH.overlay + 31);
    }
    ceremonyElements.push(portrait);
    this.tweens.add({
      targets: portrait,
      x: portraitX,
      duration: 500,
      delay: 300,
      ease: 'Power2',
    });

    // 3. Golden particle shower
    this.time.delayedCall(600, () => {
      for (let i = 0; i < 20; i++) {
        const px = cx + (Math.random() - 0.5) * 300;
        const py = -10;
        const particle = this.add.circle(px, py, 2 + Math.random() * 3, 0xffd700)
          .setDepth(DEPTH.overlay + 32).setAlpha(0.8);
        ceremonyElements.push(particle);
        this.tweens.add({
          targets: particle,
          y: GAME_HEIGHT + 20,
          x: px + (Math.random() - 0.5) * 60,
          alpha: 0,
          duration: 1500 + Math.random() * 1000,
          delay: i * 100,
          onComplete: () => particle.destroy(),
        });
      }
    });

    // 4. Name + class text
    const nameText = this.add.text(cx + 60, portraitY - 60, companion.name, {
      fontFamily: FONT_FAMILY, fontSize: '24px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(DEPTH.overlay + 33).setAlpha(0);
    ceremonyElements.push(nameText);
    this.tweens.add({ targets: nameText, alpha: 1, duration: 300, delay: 900 });

    const classText = this.add.text(cx + 60, portraitY - 35, `Lv.${companion.level} ${classLabel}`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: '#aabbcc',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(DEPTH.overlay + 33).setAlpha(0);
    ceremonyElements.push(classText);
    this.tweens.add({ targets: classText, alpha: 1, duration: 300, delay: 1000 });

    // 5. Stats panel (staggered fade-in)
    const stats = companion.stats;
    const statLines = [
      `HP: ${stats.maxHP}  MP: ${stats.maxMP}`,
      `ATK: ${stats.atk}  DEF: ${stats.def}`,
      `AGI: ${stats.agi}  LUCK: ${stats.luck}`,
    ];

    // Skills
    const skillNames = companion.skills
      .map(sid => getSkillById(sid))
      .filter(Boolean)
      .map(s => s!.name);
    if (skillNames.length > 0) {
      statLines.push(`技能: ${skillNames.join('、')}`);
    }

    statLines.forEach((line, i) => {
      const st = this.add.text(cx + 60, portraitY - 5 + i * 22, line, {
        fontFamily: FONT_FAMILY, fontSize: '13px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setDepth(DEPTH.overlay + 33).setAlpha(0);
      ceremonyElements.push(st);
      this.tweens.add({ targets: st, alpha: 1, duration: 300, delay: 1200 + i * 100 });
    });

    // 6. Join message in textbox
    this.time.delayedCall(1500, () => {
      audioManager.playSfx('fanfare');
      const joinMsg = joinedParty
        ? t('battle.companion_join', companion.name)
        : `${companion.name} 成為了夥伴！隊伍已滿，可在選單中編組隊伍。`;

      this.textBox.show('', joinMsg);
    });

    // 7. Enable dismiss after 2000ms
    this.time.delayedCall(2000, () => {
      const cleanup = () => {
        for (const el of ceremonyElements) {
          if (el && el.active) el.destroy();
        }
        this.textBox.hide();
        this.input.keyboard?.off('keydown-ENTER', onDismiss);
        this.input.keyboard?.off('keydown-SPACE', onDismiss);
        this.input.keyboard?.off('keydown-Z', onDismiss);
      };
      const onDismiss = () => {
        cleanup();
        onComplete();
      };
      this.input.keyboard?.on('keydown-ENTER', onDismiss);
      this.input.keyboard?.on('keydown-SPACE', onDismiss);
      this.input.keyboard?.on('keydown-Z', onDismiss);
    });
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

  private showRevivalPrompt(
    reviveItem: { id: string; name: string; effect?: { type: string; value: number } },
    deadMembers: CombatantState[],
    onDecline: () => void,
  ): void {
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;

    const panel = this.add.rectangle(panelX, panelY, 320, 120, COLORS.panel, 0.95).setDepth(DEPTH.overlay);
    const border = this.add.rectangle(panelX, panelY, 324, 124, COLORS.panelBorder).setDepth(DEPTH.overlay - 1);
    const prompt = this.add.text(panelX, panelY - 30, `要使用${reviveItem.name}嗎？`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(DEPTH.overlay + 1);

    const yesText = this.add.text(panelX - 50, panelY + 15, '► 是', {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: '#44ff44',
    }).setOrigin(0.5).setDepth(DEPTH.overlay + 1).setInteractive({ useHandCursor: true });
    const noText = this.add.text(panelX + 50, panelY + 15, '  否', {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: '#ff4444',
    }).setOrigin(0.5).setDepth(DEPTH.overlay + 1).setInteractive({ useHandCursor: true });

    let selected = 0;
    const updateChoice = () => {
      yesText.setText(selected === 0 ? '► 是' : '  是');
      yesText.setColor(selected === 0 ? '#44ff44' : '#aaaaaa');
      noText.setText(selected === 1 ? '► 否' : '  否');
      noText.setColor(selected === 1 ? '#ff4444' : '#aaaaaa');
    };

    const cleanup = () => {
      panel.destroy(); border.destroy(); prompt.destroy();
      yesText.destroy(); noText.destroy();
      this.input.keyboard?.off('keydown-LEFT', onPrev);
      this.input.keyboard?.off('keydown-RIGHT', onNext);
      this.input.keyboard?.off('keydown-ENTER', onConfirm);
      this.input.keyboard?.off('keydown-Z', onConfirm);
      this.input.keyboard?.off('keydown-SPACE', onConfirm);
    };

    const onPrev = () => { selected = 0; updateChoice(); audioManager.playSfx('select'); };
    const onNext = () => { selected = 1; updateChoice(); audioManager.playSfx('select'); };
    const onConfirm = () => {
      cleanup();
      if (selected === 0) {
        // Use revival item on first dead member
        const target = deadMembers[0];
        const reviveValue = reviveItem.effect?.value ?? 50;
        if (target && gameState.getItemCount(reviveItem.id) > 0) {
          gameState.removeItem(reviveItem.id);
          target.stats.hp = Math.floor(target.stats.maxHP * (reviveValue / 100));
          audioManager.playSfx('heal');
          BattleEffects.playHealEffect(this, this.partySprites[target.index]?.x ?? panelX, this.partySprites[target.index]?.y ?? panelY);
          this.addBattleLogMessage(`${target.name} 被復活了！`);
          // Update HUD
          this.hud?.update(this.combat.getState().party, this.combat.getState().enemies);
          // Reset combat phase — party member revived, battle continues
          const cState = this.combat.getState();
          cState.phase = 'player_turn';
          cState.result = undefined as any;
          this.time.delayedCall(600, () => this.checkBattleResult());
        } else {
          onDecline();
        }
      } else {
        onDecline();
      }
    };

    this.input.keyboard?.on('keydown-LEFT', onPrev);
    this.input.keyboard?.on('keydown-RIGHT', onNext);
    this.input.keyboard?.on('keydown-ENTER', onConfirm);
    this.input.keyboard?.on('keydown-Z', onConfirm);
    this.input.keyboard?.on('keydown-SPACE', onConfirm);
    yesText.on('pointerdown', () => { selected = 0; onConfirm(); });
    noText.on('pointerdown', () => { selected = 1; onConfirm(); });
  }

  private returnToField(): void {
    // If the demon king was just defeated, play celebration cutscene then ending
    const region = getRegionById(this.regionId);
    if (this.isBoss && region?.type === 'final') {
      const heroName = gameState.getState().heroName;
      const state = gameState.getState();
      const partyKeys = ['char_hero_battle', ...state.party.map(id => `char_${id}_battle`)];
      TransitionEffect.transition(this, 'CutsceneScene', {
        slides: [
          { text: '大魔王被擊敗了！', duration: 3000, bgColor: 0x110011 },
          { text: `${heroName}：「我們做到了！」`, duration: 3000,
            characters: partyKeys, layout: 'celebration' },
          { text: '和平終於降臨這片大地', duration: 3500,
            characters: partyKeys, layout: 'gathering', bgColor: 0x0a0a2a },
          { text: `感謝你，${heroName}。感謝大家。`, duration: 3500,
            characters: partyKeys, layout: 'celebration', bgColor: 0x0a0a2a },
          { text: '新的時代開始了…', duration: 3000, bgColor: 0x111122 },
        ],
        nextScene: 'EndingScene',
        nextData: {},
      });
      return;
    }
    TransitionEffect.transition(this, this.returnScene, this.returnData);
  }
}
