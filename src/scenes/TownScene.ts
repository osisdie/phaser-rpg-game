import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { getRegionById } from '../data/regions/index';
import { getNPCsForRegion } from '../data/tables/index';
import { getDialogueTree } from '../data/dialogue/index';
import { DialogueSystem } from '../systems/DialogueSystem';
import { SaveLoadSystem } from '../systems/SaveLoadSystem';
import { MapFactory } from '../maps/MapFactory';
import { Player } from '../entities/Player';
import { MinimapUI } from '../ui/MinimapUI';
import { TextBox } from '../ui/TextBox';
import { TransitionEffect } from '../ui/TransitionEffect';
import { audioManager } from '../systems/AudioManager';
import { getNPCTextureKey, getCompanionTextureKey } from '../art/characters/NPCProfiles';
import { BattleEffects } from '../art/effects/BattleEffects';
import { getAllConsumables, getAllEquipments } from '../data/items/index';
import { getCompanionForRegion } from '../data/characters/index';
import type { NPCData } from '../types';

/** Extended NPC tracking with label, marker, and wandering state */
interface NPCSpriteEntry {
  sprite: Phaser.GameObjects.Sprite;
  data: NPCData;
  label: Phaser.GameObjects.Text;
  marker?: Phaser.GameObjects.Image;
  // Wandering state
  homeX: number;
  homeY: number;
  wanderTimer: number;
  wanderDirX: number;
  wanderDirY: number;
}

interface TreasureChest {
  sprite: Phaser.GameObjects.Sprite;
  gx: number;
  gy: number;
  flagKey: string;
  opened: boolean;
  collisionBody?: Phaser.GameObjects.Rectangle;
  isStatic: boolean;
  spawnIndex: number;
}

export class TownScene extends Phaser.Scene {
  private player!: Player;
  private textBox!: TextBox;
  private dialogueSystem = new DialogueSystem();
  private npcSprites: NPCSpriteEntry[] = [];
  private regionId = '';
  private interactKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private enterKey?: Phaser.Input.Keyboard.Key;
  private inDialogue = false;
  private isAdvancingDialogue = false; // guard against re-entrant advanceDialogue calls
  private minimap!: MinimapUI;
  private mapBounds = { width: 0, height: 0 };
  private chests: TreasureChest[] = [];
  private dialogueCooldown = 0; // prevents re-triggering NPC dialogue on dismiss
  private dialogueStartTime = 0; // safety valve: track when dialogue began
  private resumeCooldown = 0; // prevents input bleed from paused overlay scenes

  constructor() {
    super('TownScene');
  }

  create(data: { regionId: string; fromWorldMap?: boolean }): void {
    this.regionId = data.regionId || gameState.getState().currentRegion;
    const region = getRegionById(this.regionId);
    if (!region) { this.scene.start('WorldMapScene'); return; }

    gameState.setCurrentScene('TownScene');
    this.inDialogue = false;
    this.isAdvancingDialogue = false;
    this.dialogueCooldown = 0;
    this.npcSprites = [];
    this.chests = [];

    // Clear stale dialogue flags to prevent cross-NPC leaks
    this.dialogueSystem.reset();
    for (const flag of ['trigger_inn', 'trigger_save', 'open_shop_buy', 'open_shop_sell', 'companion_joined']) {
      gameState.setFlag(flag, false);
    }

    // Create map
    const mapConfig = MapFactory.getTownConfig(this.regionId, region.color);
    const { wallBodies, bounds } = MapFactory.createMap(this, mapConfig);
    this.mapBounds = bounds;

    // Set world bounds
    this.physics.world.setBounds(0, 0, bounds.width, bounds.height);

    // Player — dual spawn: from world map → west gate (southwest), from field → south gate
    const midX = Math.floor(mapConfig.width / 2);
    const westGateY = mapConfig.height - 8; // matches MapFactory west gate gap position
    const fromWorldMap = data.fromWorldMap ?? false;
    let spawnX: number, spawnY: number;
    if (fromWorldMap) {
      // Spawn at west gate path — just inside the left border at southwest area
      spawnX = 3 * TILE_SIZE + TILE_SIZE / 2;
      spawnY = (westGateY + 1) * TILE_SIZE + TILE_SIZE / 2;
    } else {
      // Spawn at south gate (existing, from field)
      spawnX = midX * TILE_SIZE + TILE_SIZE / 2;
      spawnY = (mapConfig.height - 3) * TILE_SIZE + TILE_SIZE / 2;
    }
    this.player = new Player(this, spawnX, spawnY);
    this.physics.add.collider(this.player, wallBodies);

    // Camera
    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // ── Gate guards — 2 kingdom-race guards flanking south entrance, patrolling ──
    const guardKey = `char_guard_${this.regionId}`;
    if (this.textures.exists(guardKey)) {
      const gateGy = mapConfig.height - 5;
      // Place guards flanking gate — wide enough to not block the arch entrance
      const guardY = (gateGy + 1) * TILE_SIZE + TILE_SIZE / 2;
      const leftGuardX = (midX - 3) * TILE_SIZE + TILE_SIZE / 2;
      const rightGuardX = (midX + 3) * TILE_SIZE + TILE_SIZE / 2;

      // Left guard (wandering near gate)
      const leftGuard = this.add.sprite(leftGuardX, guardY, guardKey, 21)
        .setDepth(DEPTH.characters);
      this.physics.add.existing(leftGuard, false);
      const lgBody = leftGuard.body as Phaser.Physics.Arcade.Body;
      lgBody.setImmovable(true);
      lgBody.setCollideWorldBounds(true);
      lgBody.setSize(TILE_SIZE - 8, TILE_SIZE - 8);
      this.physics.add.collider(this.player, leftGuard);
      this.physics.add.collider(leftGuard, wallBodies);

      const leftLabel = this.add.text(leftGuardX, guardY - 56, '守衛', {
        fontFamily: FONT_FAMILY, fontSize: '10px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(DEPTH.characters + 1);

      this.npcSprites.push({
        sprite: leftGuard, data: { id: 'guard_left', name: '守衛', type: 'guard', dialogueId: '', x: 0, y: 0, spriteColor: 0x556688, behavior: 'wander' },
        label: leftLabel, homeX: leftGuardX, homeY: guardY,
        wanderTimer: 1000 + Math.random() * 1500, wanderDirX: 0, wanderDirY: 0,
      });

      // Right guard (wandering near gate)
      const rightGuard = this.add.sprite(rightGuardX, guardY, guardKey, 17)
        .setDepth(DEPTH.characters);
      this.physics.add.existing(rightGuard, false);
      const rgBody = rightGuard.body as Phaser.Physics.Arcade.Body;
      rgBody.setImmovable(true);
      rgBody.setCollideWorldBounds(true);
      rgBody.setSize(TILE_SIZE - 8, TILE_SIZE - 8);
      this.physics.add.collider(this.player, rightGuard);
      this.physics.add.collider(rightGuard, wallBodies);

      const rightLabel = this.add.text(rightGuardX, guardY - 56, '守衛', {
        fontFamily: FONT_FAMILY, fontSize: '10px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(DEPTH.characters + 1);

      this.npcSprites.push({
        sprite: rightGuard, data: { id: 'guard_right', name: '守衛', type: 'guard', dialogueId: '', x: 0, y: 0, spriteColor: 0x556688, behavior: 'wander' },
        label: rightLabel, homeX: rightGuardX, homeY: guardY,
        wanderTimer: 2000 + Math.random() * 1500, wanderDirX: 0, wanderDirY: 0,
      });
    }

    // NPCs — use character sprites with wandering behavior
    const npcs = getNPCsForRegion(this.regionId);
    for (let ni = 0; ni < npcs.length; ni++) {
      const npc = npcs[ni];
      const px = npc.x * TILE_SIZE + TILE_SIZE / 2;
      const py = npc.y * TILE_SIZE + TILE_SIZE / 2;
      const isWanderer = npc.behavior === 'wander';

      // Use companion-specific texture if available, otherwise generic NPC type texture
      const texKey = npc.companionId
        ? getCompanionTextureKey(npc.companionId)
        : getNPCTextureKey(npc.type, ni);
      const sprite = this.add.sprite(px, py, texKey, 0);
      sprite.setDepth(DEPTH.characters);

      if (isWanderer) {
        // Dynamic body for wandering NPCs (immovable so player can't push them)
        this.physics.add.existing(sprite, false);
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        body.setImmovable(true);
        body.setCollideWorldBounds(true);
        body.setSize(TILE_SIZE - 8, TILE_SIZE - 8);
      } else {
        // Static body for idle NPCs
        this.physics.add.existing(sprite, true);
      }
      this.physics.add.collider(this.player, sprite);
      this.physics.add.collider(sprite, wallBodies);

      // NPC label (follows sprite for wanderers)
      const label = this.add.text(px, py - 56, npc.name, {
        fontFamily: FONT_FAMILY, fontSize: '10px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(DEPTH.characters + 1);

      // Type marker icon (positioned well above label to avoid overlap)
      let marker: Phaser.GameObjects.Image | undefined;
      const markerKey = `icon_npc_${npc.type}`;
      if (this.textures.exists(markerKey)) {
        marker = this.add.image(px, py - 84, markerKey)
          .setDepth(DEPTH.characters + 2).setScale(0.8);
      }

      this.npcSprites.push({
        sprite, data: npc, label, marker,
        homeX: px, homeY: py,
        wanderTimer: 500 + Math.random() * 1500, // stagger initial timers
        wanderDirX: 0, wanderDirY: 0,
      });
    }

    // Spawn treasure chests
    this.spawnTreasureChests(mapConfig, wallBodies);

    // UI
    this.textBox = new TextBox(this);

    // Minimap with NPC markers
    this.minimap = new MinimapUI(this, bounds.width, bounds.height);
    this.minimap.setScrollFactor(0);
    const npcMarkers = npcs.map(n => ({
      x: n.x * TILE_SIZE + TILE_SIZE / 2,
      y: n.y * TILE_SIZE + TILE_SIZE / 2,
      type: n.type,
    }));
    this.minimap.setNPCPositions(npcMarkers);

    // Header
    if (this.textures.exists('ui_header_bar')) {
      this.add.image(GAME_WIDTH / 2, 16, 'ui_header_bar')
        .setScrollFactor(0).setDepth(DEPTH.ui);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, 16, GAME_WIDTH, 32, 0x000000, 0.5)
        .setScrollFactor(0).setDepth(DEPTH.ui);
    }
    this.add.text(GAME_WIDTH / 2, 16, `${region.name} — 城鎮`, {
      fontFamily: FONT_FAMILY, fontSize: '15px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.ui + 1);

    // ── West gate visual — stone pillars + arch (southwest entrance to world map) ──
    const westGateBaseX = 2 * TILE_SIZE;
    const westGateMidY = (westGateY + 1) * TILE_SIZE + TILE_SIZE / 2;
    const wPillarW = TILE_SIZE * 1.4;
    // Stone pillars (horizontal — flanking the vertical gate opening)
    this.add.rectangle(westGateBaseX, westGateMidY - TILE_SIZE * 1.2, wPillarW, 14, 0x777788)
      .setDepth(DEPTH.objects).setStrokeStyle(1, 0x555566);
    this.add.rectangle(westGateBaseX, westGateMidY + TILE_SIZE * 1.2, wPillarW, 14, 0x777788)
      .setDepth(DEPTH.objects).setStrokeStyle(1, 0x555566);
    // Arch connecting pillars (vertical)
    this.add.rectangle(westGateBaseX - wPillarW / 2 + 4, westGateMidY, 10, TILE_SIZE * 2.4 + 14, 0x888899)
      .setDepth(DEPTH.objects + 1).setStrokeStyle(1, 0x666677);

    // ── South gate visual — stone pillars + arch + signpost ──
    const gateMidX = midX * TILE_SIZE + TILE_SIZE / 2;
    const gateBaseY = (mapConfig.height - 4) * TILE_SIZE;
    const pillarH = TILE_SIZE * 1.4;
    // Stone pillars
    this.add.rectangle(gateMidX - TILE_SIZE * 1.2, gateBaseY, 14, pillarH, 0x777788)
      .setDepth(DEPTH.objects).setStrokeStyle(1, 0x555566);
    this.add.rectangle(gateMidX + TILE_SIZE * 1.2, gateBaseY, 14, pillarH, 0x777788)
      .setDepth(DEPTH.objects).setStrokeStyle(1, 0x555566);
    // Arch connecting pillars
    this.add.rectangle(gateMidX, gateBaseY - pillarH / 2 + 4, TILE_SIZE * 2.4 + 14, 10, 0x888899)
      .setDepth(DEPTH.objects + 1).setStrokeStyle(1, 0x666677);
    // Signpost
    this.add.text(gateMidX, gateBaseY + pillarH / 2 + 12, '▼ 野外', {
      fontFamily: FONT_FAMILY, fontSize: '13px', color: '#ffcc44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.objects + 2);

    // ── South approach path — curved cobblestone from town interior through south gate ──
    const southTrailRows = [
      { y: mapConfig.height - 7, xs: [1] },                 // narrow start, offset east
      { y: mapConfig.height - 6, xs: [0, 1] },              // widen slightly
      { y: mapConfig.height - 5, xs: [0, 1] },
      { y: mapConfig.height - 4, xs: [-1, 0, 1] },          // widen
      { y: mapConfig.height - 3, xs: [-1, 0, 1] },
      { y: mapConfig.height - 2, xs: [-2, -1, 0, 1, 2] },  // full gate width
      { y: mapConfig.height - 1, xs: [-2, -1, 0, 1, 2] },  // through gate wall row
    ];
    for (const row of southTrailRows) {
      for (const dx of row.xs) {
        const sPx = (midX + dx) * TILE_SIZE + TILE_SIZE / 2;
        const sPy = row.y * TILE_SIZE + TILE_SIZE / 2;
        this.add.rectangle(sPx, sPy, TILE_SIZE, TILE_SIZE, 0x776655, 0.4)
          .setDepth(DEPTH.ground + 1);
      }
    }

    // ── West gate visual — curved cobblestone trail → World Map (southwest entrance) ──
    // Trail enters from left border (x=0) at westGateY, curves right and upward into town
    const westTrailRows = [
      { x: 0, ys: [0, 1, 2] },    // through gate wall column (at x=0)
      { x: 1, ys: [0, 1, 2] },    // gate opening: y=westGateY+0..+2
      { x: 2, ys: [0, 1, 2] },
      { x: 3, ys: [-1, 0, 1] },   // shift up
      { x: 4, ys: [-1, 0, 1] },
      { x: 5, ys: [-2, -1, 0] },  // shift up more
      { x: 6, ys: [-2, -1, 0] },
    ];
    for (const col of westTrailRows) {
      for (const dy of col.ys) {
        const pathPx = col.x * TILE_SIZE + TILE_SIZE / 2;
        const pathPy = (westGateY + dy) * TILE_SIZE + TILE_SIZE / 2;
        this.add.rectangle(pathPx, pathPy, TILE_SIZE, TILE_SIZE, 0x776655, 0.35)
          .setDepth(DEPTH.ground + 1);
      }
    }
    // Wooden fence posts — shift with curve edges
    // At x=2: top at westGateY-0.3, bottom at westGateY+2.3
    const fence1X = 2 * TILE_SIZE + TILE_SIZE / 2;
    this.add.rectangle(fence1X, (westGateY - 0.3) * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.8, 8, 0x6b4f3a)
      .setDepth(DEPTH.objects).setStrokeStyle(1, 0x4a3528);
    this.add.rectangle(fence1X, (westGateY + 2.3) * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.8, 8, 0x6b4f3a)
      .setDepth(DEPTH.objects).setStrokeStyle(1, 0x4a3528);
    // At x=5: top at westGateY-2.3, bottom at westGateY+0.3
    const fence2X = 5 * TILE_SIZE + TILE_SIZE / 2;
    this.add.rectangle(fence2X, (westGateY - 2.3) * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.8, 8, 0x6b4f3a)
      .setDepth(DEPTH.objects).setStrokeStyle(1, 0x4a3528);
    this.add.rectangle(fence2X, (westGateY + 0.3) * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.8, 8, 0x6b4f3a)
      .setDepth(DEPTH.objects).setStrokeStyle(1, 0x4a3528);
    // Wooden waypost signpost — at curve midpoint (x=4, y=westGateY)
    const waypostPx = 4 * TILE_SIZE + TILE_SIZE / 2;
    const waypostY = (westGateY - 1) * TILE_SIZE;
    // Post pole
    this.add.rectangle(waypostPx, waypostY, 6, 40, 0x6b4f3a)
      .setDepth(DEPTH.objects);
    // Sign board (warm wood color, distinct from south gate's stone)
    this.add.rectangle(waypostPx, waypostY - 24, 80, 22, 0x7a5a30)
      .setDepth(DEPTH.objects + 1).setStrokeStyle(1, 0x5a4020);
    this.add.text(waypostPx, waypostY - 24, '◄ 世界地圖', {
      fontFamily: FONT_FAMILY, fontSize: '11px', color: '#ffe8a0',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.objects + 2);

    // Resume cooldown — prevent stale JustDown from paused overlay scenes (Shop/Menu)
    this.events.on('resume', () => {
      this.resumeCooldown = this.time.now + 200;
      // Reset key states to prevent stale JustDown triggers
      this.interactKey?.reset();
      this.spaceKey?.reset();
      this.enterKey?.reset();
    });

    // Keys
    this.interactKey = this.input.keyboard?.addKey('Z');
    this.spaceKey = this.input.keyboard?.addKey('SPACE');
    this.enterKey = this.input.keyboard?.addKey('ENTER');
    this.input.keyboard?.on('keydown-Q', () => this.goToWorldMap());
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.time.now < this.resumeCooldown) return; // block bleed-through from overlay
      if (this.inDialogue) { this.endDialogue(); audioManager.playSfx('cancel'); }
      else { this.openMenu(); }
    });
    this.input.keyboard?.on('keydown-M', () => { if (!this.inDialogue && this.time.now >= this.resumeCooldown) this.openMenu(); });
    this.input.keyboard?.on('keydown-F', () => { if (!this.inDialogue) this.goToField(); });

    // Environment particles
    BattleEffects.spawnEnvironmentParticles(this, this.regionId, bounds);

    // Landing animation — expanding ring to help locate player spawn
    this.spawnLandingEffect(spawnX, spawnY);

    TransitionEffect.fadeIn(this);
    audioManager.playBgm('town', this.regionId);
  }

  private regenTimer = 0;

  update(time: number, delta: number): void {
    if (this.inDialogue) {
      // Safety valve: if inDialogue for >5s with no visible textBox, force end
      if (this.dialogueStartTime > 0 && time - this.dialogueStartTime > 5000 && !this.textBox.isVisible()) {
        console.warn('[TownScene] Dialogue stuck for >5s with no textBox — forcing endDialogue');
        this.endDialogue();
        return;
      }
      this.textBox.update(time, delta);
      // Use JustDown for ALL keys to prevent rapid-fire advances and race conditions
      if ((this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) ||
          (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) ||
          (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey))) {
        this.advanceDialogue();
      }
      return;
    }

    this.player.update(time, delta);
    this.minimap.updatePlayerPosition(this.player.x, this.player.y, this.mapBounds.width, this.mapBounds.height);

    // Update wandering NPCs
    this.updateWanderingNPCs(delta);

    // Passive regen in town: 1% HP/MP every 2 seconds
    this.regenTimer += delta;
    if (this.regenTimer >= 2000) {
      this.regenTimer = 0;
      const party = gameState.getParty();
      for (const member of party) {
        if (member.stats.hp > 0 && member.stats.hp < member.stats.maxHP) {
          member.stats.hp = Math.min(member.stats.maxHP, member.stats.hp + Math.max(1, Math.floor(member.stats.maxHP * 0.01)));
        }
        if (member.stats.mp < member.stats.maxMP) {
          member.stats.mp = Math.min(member.stats.maxMP, member.stats.mp + Math.max(1, Math.floor(member.stats.maxMP * 0.01)));
        }
      }
    }

    // Check NPC interaction or chest interaction (Z, SPACE, or ENTER)
    // Cooldown prevents accidental re-trigger after dialogue dismiss
    const justInteract = (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey))
      || (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey))
      || (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey));
    if (justInteract && time > this.dialogueCooldown) {
      if (!this.checkChestInteraction()) {
        this.checkNPCInteraction();
      }
    }

    // Edge transition: walk through south gate gap → field (X must be near gate center)
    const southGateCenterX = Math.floor(this.mapBounds.width / TILE_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2;
    if (this.player.y >= this.mapBounds.height - TILE_SIZE * 1.5
        && Math.abs(this.player.x - southGateCenterX) < TILE_SIZE * 3) {
      this.goToField();
    }

    // West gate exit → World Map (left border, southwest area near westGateY)
    const mapH = Math.floor(this.mapBounds.height / TILE_SIZE);
    const westGateCenterY = (mapH - 8 + 1) * TILE_SIZE + TILE_SIZE / 2; // westGateY + 1 center
    if (this.player.x <= TILE_SIZE * 1.5
        && Math.abs(this.player.y - westGateCenterY) < TILE_SIZE * 2) {
      this.goToWorldMap();
    }
  }

  /** Move wandering NPCs around their home position */
  private updateWanderingNPCs(delta: number): void {
    const WANDER_SPEED = 40;
    const LEASH_DIST = TILE_SIZE * 3; // max distance from home

    for (const entry of this.npcSprites) {
      if (entry.data.behavior !== 'wander') continue;

      const body = entry.sprite.body as Phaser.Physics.Arcade.Body;

      // Update wander timer
      entry.wanderTimer -= delta;
      if (entry.wanderTimer <= 0) {
        entry.wanderTimer = 1500 + Math.random() * 2500;

        // Check distance from home — if too far, head back
        const dx = entry.sprite.x - entry.homeX;
        const dy = entry.sprite.y - entry.homeY;
        const distFromHome = Math.sqrt(dx * dx + dy * dy);

        if (distFromHome > LEASH_DIST) {
          // Head back toward home
          const angle = Math.atan2(-dy, -dx);
          entry.wanderDirX = Math.cos(angle);
          entry.wanderDirY = Math.sin(angle);
        } else if (Math.random() > 0.2) {
          // Random walk direction (80% chance to walk)
          const angle = Math.random() * Math.PI * 2;
          entry.wanderDirX = Math.cos(angle);
          entry.wanderDirY = Math.sin(angle);
        } else {
          // Brief pause (stand still)
          entry.wanderDirX = 0;
          entry.wanderDirY = 0;
        }
      }

      // Apply velocity
      body.setVelocity(
        entry.wanderDirX * WANDER_SPEED,
        entry.wanderDirY * WANDER_SPEED,
      );

      // Update label and marker to follow sprite
      entry.label.setPosition(entry.sprite.x, entry.sprite.y - 56);
      if (entry.marker) {
        entry.marker.setPosition(entry.sprite.x, entry.sprite.y - 84);
      }
    }
  }

  // ─── Treasure Chests ───

  private spawnTreasureChests(mapConfig: { width: number; height: number }, wallBodies: Phaser.Physics.Arcade.StaticGroup): void {
    if (!this.textures.exists('deco_chest')) this.generateChestTexture();
    if (!this.textures.exists('deco_chest_open')) this.generateChestOpenTexture();

    const blocked = this.buildBlockedGrid(wallBodies, mapConfig.width, mapConfig.height);

    // ── Static chest (1, one-time, behind buildings) ──
    const staticSpots = this.findChestSpots(blocked, mapConfig.width, mapConfig.height, 1, 6);
    for (let i = 0; i < staticSpots.length; i++) {
      const flagKey = `static_chest_town_${this.regionId}_${i}`;
      if (gameState.getFlag(flagKey)) continue;
      const { gx, gy } = staticSpots[i];
      this.placeTownChest(gx, gy, flagKey, true, i, wallBodies);
    }

    // ── Dynamic chest (0-1, respawning) ──
    const dynKey = `dyn_chest_town_${this.regionId}`;
    const dynCount = Math.random() < 0.5 ? 1 : 0;
    if (dynCount > 0) {
      let spawn = gameState.getChestSpawn(dynKey);
      if (!spawn || gameState.isChestSpawnExpired(dynKey)) {
        const dynSpots = this.findChestSpots(blocked, mapConfig.width, mapConfig.height, dynCount, 3, staticSpots, true);
        spawn = {
          positions: dynSpots,
          spawnTime: Date.now(),
          opened: dynSpots.map(() => false),
        };
        gameState.setChestSpawn(dynKey, spawn);
      }
      for (let i = 0; i < spawn.positions.length; i++) {
        if (spawn.opened[i]) continue;
        const { gx, gy } = spawn.positions[i];
        this.placeTownChest(gx, gy, dynKey, false, i, wallBodies);
      }
    }
  }

  private placeTownChest(gx: number, gy: number, flagKey: string, isStatic: boolean, spawnIndex: number, wallBodies: Phaser.Physics.Arcade.StaticGroup): void {
    const px = gx * TILE_SIZE + TILE_SIZE / 2;
    const py = gy * TILE_SIZE + TILE_SIZE / 2;

    const sprite = this.add.sprite(px, py, 'deco_chest')
      .setDepth(DEPTH.objects + 1).setScale(0.5);

    if (isStatic) {
      this.tweens.add({ targets: sprite, alpha: { from: 0.85, to: 1 }, duration: 1200, yoyo: true, repeat: -1 });
    }

    const chestBody = this.add.rectangle(px, py, TILE_SIZE / 2 - 4, TILE_SIZE / 2 - 4);
    this.physics.add.existing(chestBody, true);
    wallBodies.add(chestBody);
    chestBody.setVisible(false);

    this.chests.push({ sprite, gx, gy, flagKey, opened: false, collisionBody: chestBody, isStatic, spawnIndex });
  }

  private buildBlockedGrid(wallBodies: Phaser.Physics.Arcade.StaticGroup, w: number, h: number): boolean[][] {
    const grid: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false));
    for (let x = 0; x < w; x++) { grid[0][x] = true; grid[h - 1][x] = true; }
    for (let y = 0; y < h; y++) { grid[y][0] = true; grid[y][w - 1] = true; }
    for (const body of wallBodies.getChildren()) {
      const go = body as Phaser.GameObjects.Rectangle;
      const gx = Math.floor(go.x / TILE_SIZE);
      const gy = Math.floor(go.y / TILE_SIZE);
      if (gx >= 0 && gx < w && gy >= 0 && gy < h) grid[gy][gx] = true;
    }
    return grid;
  }

  private findChestSpots(
    grid: boolean[][], w: number, h: number, count: number, minScore: number,
    exclude: { gx: number; gy: number }[] = [], zoneLimit = false,
  ): { gx: number; gy: number }[] {
    const scores: { gx: number; gy: number; score: number }[] = [];
    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    const zoneW = Math.floor(w / 3);

    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        if (grid[y][x]) continue;
        let score = 0;
        for (const [dy, dx] of dirs) {
          if (grid[y + dy]?.[x + dx]) score += 2;
        }
        if (x <= 3 || x >= w - 4 || y <= 3 || y >= h - 4) score += 2;
        const midX = Math.floor(w / 2);
        if (Math.abs(x - midX) <= 2 && y > h - 8) score -= 5;
        if (score >= minScore) scores.push({ gx: x, gy: y, score });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    const picked: { gx: number; gy: number }[] = [];
    const usedZones = new Set<number>();

    for (const s of scores) {
      if (picked.length >= count) break;
      const tooClose = picked.some(p => Math.abs(p.gx - s.gx) + Math.abs(p.gy - s.gy) < 8);
      if (tooClose) continue;
      const nearExclude = exclude.some(p => Math.abs(p.gx - s.gx) + Math.abs(p.gy - s.gy) < 10);
      if (nearExclude) continue;
      if (zoneLimit) {
        const zone = Math.min(2, Math.floor(s.gx / zoneW));
        if (usedZones.has(zone)) continue;
        usedZones.add(zone);
      }
      picked.push({ gx: s.gx, gy: s.gy });
    }

    let attempts = 0;
    while (picked.length < count && attempts < 50) {
      attempts++;
      const gx = 3 + Math.floor(Math.random() * (w - 6));
      const gy = 3 + Math.floor(Math.random() * (h - 6));
      if (grid[gy][gx]) continue;
      const tooClose = picked.some(p => Math.abs(p.gx - gx) + Math.abs(p.gy - gy) < 6);
      if (tooClose) continue;
      const nearExclude = exclude.some(p => Math.abs(p.gx - gx) + Math.abs(p.gy - gy) < 10);
      if (nearExclude) continue;
      if (zoneLimit) {
        const zone = Math.min(2, Math.floor(gx / zoneW));
        if (usedZones.has(zone)) continue;
        usedZones.add(zone);
      }
      picked.push({ gx, gy });
    }
    return picked;
  }

  private checkChestInteraction(): boolean {
    const playerPos = this.player.getGridPosition();
    for (const chest of this.chests) {
      if (chest.opened) continue; // Skip opened chests — they fade out visually
      const dist = Math.abs(playerPos.gx - chest.gx) + Math.abs(playerPos.gy - chest.gy);
      if (dist <= 2) {
        this.openChest(chest);
        return true;
      }
    }
    return false;
  }

  private openChest(chest: TreasureChest): void {
    if (chest.opened || !chest.sprite) return;

    chest.opened = true;
    chest.sprite.setTexture('deco_chest_open');
    audioManager.playSfx('select');

    // Persist open state
    if (chest.isStatic) {
      gameState.setFlag(chest.flagKey, true);
    } else {
      gameState.markChestOpened(chest.flagKey, chest.spawnIndex);
    }

    // Fade out after a short delay
    this.time.delayedCall(800, () => {
      if (chest.sprite) {
        this.tweens.add({
          targets: chest.sprite, alpha: 0, duration: 600, ease: 'Power2',
          onComplete: () => {
            chest.collisionBody?.destroy();
            chest.collisionBody = undefined;
          },
        });
      }
    });

    const region = getRegionById(this.regionId);
    const regionLevel = region?.levelRange[0] ?? 1;
    const effectiveLevel = Math.min(gameState.getHero().level, regionLevel);

    this.inDialogue = true;

    if (chest.isStatic) {
      this.openStaticTownChest(regionLevel);
    } else {
      this.openDynamicTownChest(effectiveLevel);
    }
  }

  /** Static town chest: equipment or rare consumable (no gold in town static) */
  private openStaticTownChest(regionLevel: number): void {
    const roll = Math.random();
    const tiers = ['wood', 'iron', 'steel', 'silver', 'mithril', 'dragon', 'holy', 'legendary'];
    const tierIndex = Math.min(tiers.length - 1, Math.floor(regionLevel / 8));

    if (roll < 0.6) {
      // 60% equipment
      const allEquip = getAllEquipments();
      const validTiers = tiers.slice(Math.max(0, tierIndex - 1), Math.min(tiers.length, tierIndex + 2));
      const candidates = allEquip.filter(e => validTiers.includes(e.tier));
      const equip = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : allEquip[Math.floor(Math.random() * allEquip.length)];
      gameState.addItem(equip.id);
      this.textBox.show('', `✦ ${t('chest.found')}\n${t('chest.equipment', equip.name)}`);
    } else {
      // 40% rare consumable
      const rareItems = ['item_elixir', 'item_potion_l', 'item_ether_m'];
      const itemId = rareItems[Math.floor(Math.random() * rareItems.length)];
      const consumables = getAllConsumables();
      const item = consumables.find(c => c.id === itemId) ?? consumables[0];
      gameState.addItem(item.id);
      this.textBox.show('', `✦ ${t('chest.found')}\n${t('chest.item', item.name)}`);
    }
  }

  /** Dynamic town chest: standard rewards with effectiveLevel + 40% gold nerf */
  private openDynamicTownChest(effectiveLevel: number): void {
    const roll = Math.random();

    if (roll < 0.6) {
      // 60% gold with effectiveLevel + town 40% nerf
      const minGold = Math.floor(10 + effectiveLevel * 3);
      const maxGold = Math.floor(30 + effectiveLevel * 12);
      const rawGold = minGold + Math.floor(Math.random() * (maxGold - minGold));
      const goldAmount = Math.max(1, Math.floor(rawGold * 0.4));
      gameState.addGold(goldAmount);
      this.textBox.show('', `${t('chest.found')}\n${t('chest.gold', goldAmount)}`);
    } else if (roll < 0.9) {
      // 30% consumable
      const consumables = getAllConsumables();
      const item = consumables[Math.floor(Math.random() * consumables.length)];
      gameState.addItem(item.id);
      this.textBox.show('', `${t('chest.found')}\n${t('chest.item', item.name)}`);
    } else {
      // 10% equipment with effectiveLevel tier
      const allEquip = getAllEquipments();
      const tiers = ['wood', 'iron', 'steel', 'silver', 'mithril', 'dragon', 'holy', 'legendary'];
      const tierIndex = Math.min(tiers.length - 1, Math.floor(effectiveLevel / 8));
      const validTiers = tiers.slice(Math.max(0, tierIndex - 1), Math.min(tiers.length, tierIndex + 2));
      const candidates = allEquip.filter(e => validTiers.includes(e.tier));
      const equip = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : allEquip[Math.floor(Math.random() * allEquip.length)];
      gameState.addItem(equip.id);
      this.textBox.show('', `${t('chest.found')}\n${t('chest.equipment', equip.name)}`);
    }
  }

  private generateChestTexture(): void {
    const S = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let py = S - 5; py < S; py++) {
      const w = Math.round((S - 12) * (1 - (py - (S - 5)) / 5 * 0.3));
      ctx.fillRect(S / 2 - w / 2, py, w, 1);
    }
    // Chest body with wood grain
    const bodyTop = Math.round(S * 0.35);
    const bodyH = Math.round(S * 0.48);
    for (let y = bodyTop; y < bodyTop + bodyH; y++) {
      for (let x = 4; x < S - 4; x++) {
        const grain = ((x * 7 + y * 3) % 5 === 0) ? -12 : 0;
        ctx.fillStyle = `rgb(${0x8B + grain},${0x5E + grain},${0x3C + grain})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(4, bodyTop, 3, bodyH);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(S - 7, bodyTop, 3, bodyH);
    // Lid
    ctx.fillStyle = '#A0714F';
    ctx.fillRect(3, Math.round(S * 0.25), S - 6, Math.round(S * 0.13));
    ctx.fillStyle = '#B88060';
    ctx.fillRect(4, Math.round(S * 0.25), S - 8, 2);
    ctx.fillStyle = '#8a6040';
    ctx.fillRect(3, Math.round(S * 0.36), S - 6, 2);
    // Metal bands with rivets
    ctx.fillStyle = '#C8A82E';
    ctx.fillRect(4, Math.round(S * 0.38), S - 8, 2);
    ctx.fillRect(4, Math.round(S * 0.58), S - 8, 2);
    ctx.fillStyle = '#E0C040';
    for (let rx = 6; rx < S - 6; rx += 5) {
      ctx.fillRect(rx, Math.round(S * 0.38), 1, 1);
      ctx.fillRect(rx, Math.round(S * 0.58), 1, 1);
    }
    // Lock plate + keyhole
    ctx.fillStyle = '#B89828';
    ctx.fillRect(S / 2 - 3, Math.round(S * 0.40), 6, 9);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(S / 2 - 2, Math.round(S * 0.41), 4, 7);
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(S / 2 - 1, Math.round(S * 0.44), 2, 3);
    // Corner brackets
    ctx.fillStyle = '#A08020';
    ctx.fillRect(4, bodyTop, 3, 3);
    ctx.fillRect(S - 7, bodyTop, 3, 3);
    ctx.fillRect(4, bodyTop + bodyH - 3, 3, 3);
    ctx.fillRect(S - 7, bodyTop + bodyH - 3, 3, 3);

    this.textures.addCanvas('deco_chest', canvas);
  }

  private generateChestOpenTexture(): void {
    const S = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let py = S - 5; py < S; py++) {
      const w = Math.round((S - 12) * (1 - (py - (S - 5)) / 5 * 0.3));
      ctx.fillRect(S / 2 - w / 2, py, w, 1);
    }
    // Open lid
    ctx.fillStyle = '#A0714F';
    ctx.fillRect(3, Math.round(S * 0.15), S - 6, Math.round(S * 0.10));
    ctx.fillStyle = '#8a6040';
    ctx.fillRect(4, Math.round(S * 0.24), S - 8, Math.round(S * 0.10));
    ctx.fillStyle = '#705030';
    ctx.fillRect(5, Math.round(S * 0.32), S - 10, Math.round(S * 0.06));
    ctx.fillStyle = '#B88060';
    ctx.fillRect(4, Math.round(S * 0.15), S - 8, 2);
    // Open body with grain
    for (let y = Math.round(S * 0.38); y < Math.round(S * 0.82); y++) {
      for (let x = 4; x < S - 4; x++) {
        const grain = ((x * 7 + y * 3) % 5 === 0) ? -12 : 0;
        ctx.fillStyle = `rgb(${0x8B + grain},${0x5E + grain},${0x3C + grain})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Inside cavity with gold glint
    ctx.fillStyle = '#2a1808';
    ctx.fillRect(6, Math.round(S * 0.42), S - 12, Math.round(S * 0.22));
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(S / 2 - 1, Math.round(S * 0.50), 2, 2);
    ctx.fillRect(S / 2 + 4, Math.round(S * 0.54), 1, 1);
    // Metal band
    ctx.fillStyle = '#C8A82E';
    ctx.fillRect(4, Math.round(S * 0.40), S - 8, 2);

    this.textures.addCanvas('deco_chest_open', canvas);
  }

  // ─── Landing Effect ───

  private spawnLandingEffect(x: number, y: number): void {
    // Downward arrow indicator above player
    const arrow = this.add.triangle(x, y - 80, 0, 20, 12, 0, 24, 20, 0xffdd44)
      .setDepth(DEPTH.ui - 1);
    this.tweens.add({
      targets: arrow, y: y - 56, alpha: { from: 1, to: 0 },
      duration: 1200, ease: 'Bounce.easeOut',
      onComplete: () => arrow.destroy(),
    });

    // Expanding ring at feet
    const ring = this.add.circle(x, y + 16, 8, 0xffffff, 0)
      .setStrokeStyle(2, 0x44ccff)
      .setDepth(DEPTH.player - 1);
    this.tweens.add({
      targets: ring,
      scale: { from: 0.5, to: 3 },
      alpha: { from: 0.8, to: 0 },
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    // Second ring with slight delay
    const ring2 = this.add.circle(x, y + 16, 8, 0xffffff, 0)
      .setStrokeStyle(2, 0x44ccff).setAlpha(0)
      .setDepth(DEPTH.player - 1);
    this.time.delayedCall(200, () => {
      this.tweens.add({
        targets: ring2,
        scale: { from: 0.5, to: 3 },
        alpha: { from: 0.6, to: 0 },
        duration: 800,
        ease: 'Cubic.easeOut',
        onComplete: () => ring2.destroy(),
      });
    });
  }

  // ─── NPC Interaction ───

  private checkNPCInteraction(): void {
    const playerPos = this.player.getGridPosition();
    for (const { sprite, data } of this.npcSprites) {
      const npcGx = Math.floor(sprite.x / TILE_SIZE);
      const npcGy = Math.floor(sprite.y / TILE_SIZE);
      const dist = Math.abs(playerPos.gx - npcGx) + Math.abs(playerPos.gy - npcGy);
      if (dist <= 2) {
        audioManager.playSfx('select');
        this.startDialogue(data);
        return;
      }
    }
  }

  private startDialogue(npc: NPCData): void {
    this.inDialogue = true;
    this.dialogueStartTime = this.time.now;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    // Stop wandering NPCs during dialogue
    for (const entry of this.npcSprites) {
      if (entry.data.behavior === 'wander') {
        const npcBody = entry.sprite.body as Phaser.Physics.Arcade.Body;
        npcBody.setVelocity(0);
      }
    }

    try {
      // ── Companion recruitment NPC — validate before showing join dialogue ──
      if (npc.dialogueId === 'npc_companion_join') {
        const companion = getCompanionForRegion(this.regionId);
        if (!companion) { this.endDialogue(); return; }

        // Already recruited — friendly greeting
        if (gameState.getCompanion(companion.id)) {
          this.textBox.show(npc.name, '有你在真是太好了！我們一起加油吧！');
          return;
        }

        // Region not yet liberated — hint dialogue
        if (!gameState.getState().liberatedRegions.includes(this.regionId)) {
          this.textBox.show(npc.name, '你就是那位旅行中的勇者嗎？等這片土地恢復和平之後，我想跟你聊聊…');
          return;
        }

        // Region liberated, companion not yet recruited — show join dialogue with proper name
        const tree = getDialogueTree(npc.dialogueId);
        if (!tree) { this.endDialogue(); return; }
        const treeCopy = structuredClone(tree);
        for (const nodeId in treeCopy.nodes) {
          if (treeCopy.nodes[nodeId].speaker === '???') {
            treeCopy.nodes[nodeId].speaker = npc.name;
          }
        }
        // Tag which companion this recruitment is for
        gameState.setFlag('pending_companion_region', false);
        (gameState.getState().flags as Record<string, any>)['pending_companion_region'] = this.regionId;
        const node = this.dialogueSystem.start(treeCopy);
        if (node) {
          this.textBox.show(node.speaker, node.text);
        } else {
          this.endDialogue();
        }
        return;
      }

      const tree = getDialogueTree(npc.dialogueId);
      if (!tree) { this.endDialogue(); return; }

      // Inject inn cost into dialogue text
      let dialogueTree = tree;
      if (npc.dialogueId === 'npc_inn') {
        const region = getRegionById(this.regionId);
        const baseLevel = region?.levelRange[0] ?? 1;
        const innCost = 20 + baseLevel * 5;
        dialogueTree = structuredClone(tree);
        for (const nodeId in dialogueTree.nodes) {
          dialogueTree.nodes[nodeId].text = dialogueTree.nodes[nodeId].text.replace(/\{innCost\}/g, String(innCost));
        }
      }

      const node = this.dialogueSystem.start(dialogueTree);
      if (node) {
        this.textBox.show(node.speaker, node.text);
      } else {
        this.endDialogue();
      }
    } catch (e) {
      console.error('[TownScene] startDialogue error:', e);
      this.endDialogue();
    }
  }

  private advanceDialogue(): void {
    // Guard against re-entrant calls (e.g. showChoices onConfirm + update both fire)
    if (this.isAdvancingDialogue) return;
    this.isAdvancingDialogue = true;

    try {
      if (!this.textBox.getIsComplete()) {
        this.textBox.advance();
        return;
      }

      // If choices are currently displayed, don't advance — let showChoices handle it
      if (this.textBox.hasActiveChoices()) return;

      // Guard: if dialogue system was never started (simple textbox-only messages like
      // companion greetings), just end dialogue — prevents checkDialogueFlags() from
      // processing stale flags from a previous NPC conversation
      if (!this.dialogueSystem.isActive()) {
        this.endDialogue();
        return;
      }

      const choices = this.dialogueSystem.getAvailableChoices();
      if (choices.length > 0) {
        this.textBox.showChoices(choices, (index) => {
          // Consume JustDown flags to prevent double-fire — the TextBox key event
          // handler that triggered this callback sets _justDown on shared Key objects,
          // which would otherwise cause advanceDialogue() to fire again in the same
          // frame's update loop, corrupting dialogue state across shop cycles.
          if (this.interactKey) Phaser.Input.Keyboard.JustDown(this.interactKey);
          if (this.enterKey) Phaser.Input.Keyboard.JustDown(this.enterKey);
          if (this.spaceKey) Phaser.Input.Keyboard.JustDown(this.spaceKey);

          audioManager.playSfx('select');
          const next = this.dialogueSystem.advance(index);
          if (next) {
            this.textBox.show(next.speaker, next.text);
            this.checkDialogueFlags();
          } else {
            const handled = this.checkDialogueFlags();
            if (!handled && this.inDialogue) this.endDialogue();
          }
        });
        return;
      }

      const next = this.dialogueSystem.advance();
      if (next) {
        this.textBox.show(next.speaker, next.text);
        this.checkDialogueFlags();
      } else {
        const handled = this.checkDialogueFlags();
        if (!handled && this.inDialogue) this.endDialogue();
      }
    } finally {
      this.isAdvancingDialogue = false;
    }
  }

  /** Check dialogue flags and handle side effects. Returns true if a new textbox was shown
   *  (caller should NOT call endDialogue). */
  private checkDialogueFlags(): boolean {
    const state = gameState.getState();
    if (state.flags['trigger_save']) {
      gameState.setFlag('trigger_save', false);
      SaveLoadSystem.autoSave();
      audioManager.playSfx('fanfare');
      this.textBox.show('記錄者', '冒險記錄已保存！祝你旅途平安！');
      return true;
    }
    if (state.flags['open_shop_buy']) {
      gameState.setFlag('open_shop_buy', false);
      this.endDialogue();
      this.scene.launch('ShopScene', { regionId: this.regionId, mode: 'buy' });
      this.scene.pause();
      return true;
    }
    if (state.flags['open_shop_sell']) {
      gameState.setFlag('open_shop_sell', false);
      this.endDialogue();
      this.scene.launch('ShopScene', { regionId: this.regionId, mode: 'sell' });
      this.scene.pause();
      return true;
    }
    if (state.flags['trigger_inn']) {
      gameState.setFlag('trigger_inn', false);
      const region = getRegionById(this.regionId);
      const baseLevel = region?.levelRange[0] ?? 1;
      const innCost = 20 + baseLevel * 5;
      if (gameState.spendGold(innCost)) {
        const party = gameState.getParty();
        for (const member of party) {
          member.stats.hp = member.stats.maxHP;
          member.stats.mp = member.stats.maxMP;
        }
        // Fade-to-black overnight animation
        this.dialogueStartTime = this.time.now; // Reset safety valve timer for animation duration
        this.textBox.hide();
        const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
          .setScrollFactor(0).setDepth(DEPTH.ui + 100);
        this.tweens.add({
          targets: overlay, alpha: 1, duration: 500, ease: 'Sine.easeInOut',
          onComplete: () => {
            // Moon icon at center
            const moon = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, '☽', {
              fontFamily: FONT_FAMILY, fontSize: '48px', color: '#ffeeaa',
            }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.ui + 101);
            const zzz = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, 'z z z', {
              fontFamily: FONT_FAMILY, fontSize: '18px', color: '#8899aa',
            }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.ui + 101);
            this.tweens.add({ targets: zzz, alpha: { from: 0.4, to: 1 }, duration: 600, yoyo: true, repeat: 2 });
            // Hold black screen longer for dramatic effect, then fade back in
            this.time.delayedCall(2000, () => {
              moon.destroy();
              zzz.destroy();
              this.tweens.add({
                targets: overlay, alpha: 0, duration: 500, ease: 'Sine.easeInOut',
                onComplete: () => {
                  overlay.destroy();
                  audioManager.playSfx('heal');
                  this.textBox.show('旅店老闆', `花費了 ${innCost} 金幣。全員 HP/MP 完全恢復！`);
                },
              });
            });
          },
        });
      } else {
        audioManager.playSfx('fail');
        this.textBox.show('旅店老闆', '看來你的錢不太夠呢…下次再來吧。');
      }
      return true;
    }
    // ── Companion recruitment ──
    if (state.flags['companion_joined']) {
      gameState.setFlag('companion_joined', false);
      const recruitRegion = (state.flags as Record<string, any>)['pending_companion_region'] as string || this.regionId;
      delete (state.flags as Record<string, any>)['pending_companion_region'];
      const companion = getCompanionForRegion(recruitRegion);
      if (companion && !gameState.getCompanion(companion.id)) {
        const companionData = structuredClone(companion);
        // Scale companion level to hero's level
        const heroLevel = gameState.getHero().level;
        companionData.level = Math.max(companionData.level, heroLevel);
        companionData.stats.hp = companionData.stats.maxHP;
        companionData.stats.mp = companionData.stats.maxMP;
        gameState.addCompanion(companionData);
        const joinedParty = gameState.addToParty(companionData.id);
        audioManager.playSfx('levelup');
        const msg = joinedParty
          ? `${companionData.name} 加入了隊伍！`
          : `${companionData.name} 成為了夥伴！（隊伍已滿，可在選單中更換）`;
        this.textBox.show(companionData.name, msg);
        return true;
      }
    }
    return false;
  }

  private endDialogue(): void {
    this.inDialogue = false;
    this.textBox.hide();
    this.dialogueCooldown = this.time.now + 1200; // 1200ms cooldown to prevent re-trigger
    this.dialogueSystem.reset(); // prevent stale dialogue state from leaking to next NPC
    // Clean up any dangling companion recruitment state
    delete (gameState.getState().flags as Record<string, any>)['pending_companion_region'];
  }

  private goToField(): void {
    if (this.inDialogue) return;
    TransitionEffect.transition(this, 'FieldScene', { regionId: this.regionId });
  }

  private goToWorldMap(): void {
    if (this.inDialogue) return;
    TransitionEffect.transition(this, 'WorldMapScene');
  }

  private openMenu(): void {
    this.scene.launch('MenuScene');
    this.scene.pause();
  }
}
