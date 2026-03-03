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
import { getNPCTextureKey } from '../art/characters/NPCProfiles';
import { BattleEffects } from '../art/effects/BattleEffects';
import { getAllConsumables, getAllEquipments } from '../data/items/index';
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
  private minimap!: MinimapUI;
  private mapBounds = { width: 0, height: 0 };
  private chests: TreasureChest[] = [];

  constructor() {
    super('TownScene');
  }

  create(data: { regionId: string }): void {
    this.regionId = data.regionId || gameState.getState().currentRegion;
    const region = getRegionById(this.regionId);
    if (!region) { this.scene.start('WorldMapScene'); return; }

    gameState.setCurrentScene('TownScene');
    this.inDialogue = false;
    this.npcSprites = [];
    this.chests = [];

    // Create map
    const mapConfig = MapFactory.getTownConfig(this.regionId, region.color);
    const { wallBodies, bounds } = MapFactory.createMap(this, mapConfig);
    this.mapBounds = bounds;

    // Set world bounds
    this.physics.world.setBounds(0, 0, bounds.width, bounds.height);

    // Player — spawn just south of the gate
    this.player = new Player(this,
      Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2,
      (mapConfig.height - 2) * TILE_SIZE + TILE_SIZE / 2,
    );
    this.physics.add.collider(this.player, wallBodies);

    // Camera
    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // ── Gate guards — 2 kingdom-race guards flanking south entrance, patrolling ──
    const guardKey = `char_guard_${this.regionId}`;
    if (this.textures.exists(guardKey)) {
      const midX = Math.floor(mapConfig.width / 2);
      const gateGy = mapConfig.height - 5;
      // Moved guards 2 tiles back from gate so they don't block the entrance
      const guardY = (gateGy + 4) * TILE_SIZE + TILE_SIZE / 2;
      const leftGuardX = (midX - 2) * TILE_SIZE + TILE_SIZE / 2;
      const rightGuardX = (midX + 2) * TILE_SIZE + TILE_SIZE / 2;

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

      // Use textured sprite
      const texKey = getNPCTextureKey(npc.type, ni);
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

    // Controls footer with background bar for visibility
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 12, GAME_WIDTH, 24, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(DEPTH.ui);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 12, 'WASD移動 | SPACE互動 | F野外 | M選單 | Q世界地圖', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#ddddcc',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.ui + 1);

    // Keys
    this.interactKey = this.input.keyboard?.addKey('Z');
    this.spaceKey = this.input.keyboard?.addKey('SPACE');
    this.enterKey = this.input.keyboard?.addKey('ENTER');
    this.input.keyboard?.on('keydown-F', () => this.goToField());
    this.input.keyboard?.on('keydown-Q', () => this.goToWorldMap());
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.inDialogue) { this.endDialogue(); audioManager.playSfx('cancel'); }
      else { this.openMenu(); }
    });
    this.input.keyboard?.on('keydown-M', () => { if (!this.inDialogue) this.openMenu(); });

    // Environment particles
    BattleEffects.spawnEnvironmentParticles(this, this.regionId, bounds);

    // Landing animation — expanding ring to help locate player spawn
    const spawnX = Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2;
    const spawnY = (mapConfig.height - 2) * TILE_SIZE + TILE_SIZE / 2;
    this.spawnLandingEffect(spawnX, spawnY);

    TransitionEffect.fadeIn(this);
    audioManager.playBgm('town', this.regionId);
  }

  private regenTimer = 0;

  update(time: number, delta: number): void {
    if (this.inDialogue) {
      this.textBox.update(time, delta);
      if (Phaser.Input.Keyboard.JustDown(this.interactKey!) ||
          this.input.keyboard?.checkDown(this.input.keyboard.addKey('ENTER'), 200) ||
          this.input.keyboard?.checkDown(this.input.keyboard.addKey('SPACE'), 200)) {
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
    const justInteract = (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey))
      || (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey))
      || (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey));
    if (justInteract) {
      if (!this.checkChestInteraction()) {
        this.checkNPCInteraction();
      }
    }

    // Edge transition: walk to south edge → field
    if (this.player.y >= this.mapBounds.height - TILE_SIZE * 0.5) {
      this.goToField();
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
    // Generate chest texture if not exists
    if (!this.textures.exists('deco_chest')) {
      this.generateChestTexture();
    }
    if (!this.textures.exists('deco_chest_open')) {
      this.generateChestOpenTexture();
    }

    // Truly random each visit: 0-1 chest per town
    const chestCount = Math.random() < 0.6 ? 1 : 0;
    if (chestCount === 0) return;

    for (let ci = 0; ci < chestCount; ci++) {
      const flagKey = `chest_${this.regionId}_${ci}`;
      const gx = 3 + Math.floor(Math.random() * (mapConfig.width - 6));
      const gy = 6 + Math.floor(Math.random() * (mapConfig.height - 10));

      const px = gx * TILE_SIZE + TILE_SIZE / 2;
      const py = gy * TILE_SIZE + TILE_SIZE / 2;

      const sprite = this.add.sprite(px, py, 'deco_chest')
        .setDepth(DEPTH.objects + 1).setScale(0.5);

      const chestBody = this.add.rectangle(px, py, TILE_SIZE / 2 - 4, TILE_SIZE / 2 - 4);
      this.physics.add.existing(chestBody, true);
      wallBodies.add(chestBody);
      chestBody.setVisible(false);

      this.chests.push({ sprite, gx, gy, flagKey, opened: false, collisionBody: chestBody });
    }
  }

  private checkChestInteraction(): boolean {
    const playerPos = this.player.getGridPosition();
    for (const chest of this.chests) {
      const dist = Math.abs(playerPos.gx - chest.gx) + Math.abs(playerPos.gy - chest.gy);
      if (dist <= 2) {
        this.openChest(chest);
        return true;
      }
    }
    return false;
  }

  private openChest(chest: TreasureChest): void {
    if (chest.opened || !chest.sprite) {
      this.inDialogue = true;
      this.textBox.show('', t('chest.already_opened'));
      return;
    }

    chest.opened = true;
    chest.sprite.setTexture('deco_chest_open');
    audioManager.playSfx('select');

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

    // Determine reward: 60% gold, 30% item, 10% equipment
    const roll = Math.random();
    const region = getRegionById(this.regionId);
    const baseLevel = region?.levelRange[0] ?? 1;

    this.inDialogue = true;

    if (roll < 0.6) {
      // Gold reward — scaled with kingdom level
      const minGold = Math.floor(10 + baseLevel * 3);
      const maxGold = Math.floor(30 + baseLevel * 12);
      const goldAmount = minGold + Math.floor(Math.random() * (maxGold - minGold));
      gameState.addGold(goldAmount);
      this.textBox.show('', `${t('chest.found')}\n${t('chest.gold', goldAmount)}`);
    } else if (roll < 0.9) {
      // Item reward — random consumable
      const consumables = getAllConsumables();
      const item = consumables[Math.floor(Math.random() * consumables.length)];
      gameState.addItem(item.id);
      this.textBox.show('', `${t('chest.found')}\n${t('chest.item', item.name)}`);
    } else {
      // Equipment reward — tier based on region level
      const allEquip = getAllEquipments();
      const tiers = ['wood', 'iron', 'steel', 'silver', 'mithril', 'dragon', 'holy', 'legendary'];
      const tierIndex = Math.min(tiers.length - 1, Math.floor(baseLevel / 8));
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
    const tree = getDialogueTree(npc.dialogueId);
    if (!tree) return;

    this.inDialogue = true;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    // Stop wandering NPCs during dialogue
    for (const entry of this.npcSprites) {
      if (entry.data.behavior === 'wander') {
        const npcBody = entry.sprite.body as Phaser.Physics.Arcade.Body;
        npcBody.setVelocity(0);
      }
    }

    const node = this.dialogueSystem.start(tree);
    if (node) {
      this.textBox.show(node.speaker, node.text);
    }
  }

  private advanceDialogue(): void {
    if (!this.textBox.getIsComplete()) {
      this.textBox.advance();
      return;
    }

    const choices = this.dialogueSystem.getAvailableChoices();
    if (choices.length > 0) {
      this.textBox.showChoices(choices, (index) => {
        audioManager.playSfx('select');
        const next = this.dialogueSystem.advance(index);
        if (next) {
          this.textBox.show(next.speaker, next.text);
          this.checkDialogueFlags();
        } else {
          this.checkDialogueFlags();
          this.endDialogue();
        }
      });
      return;
    }

    const next = this.dialogueSystem.advance();
    if (next) {
      this.textBox.show(next.speaker, next.text);
      this.checkDialogueFlags();
    } else {
      this.checkDialogueFlags();
      this.endDialogue();
    }
  }

  private checkDialogueFlags(): void {
    const state = gameState.getState();
    if (state.flags['trigger_save']) {
      gameState.setFlag('trigger_save', false);
      SaveLoadSystem.autoSave();
    }
    if (state.flags['open_shop_buy']) {
      gameState.setFlag('open_shop_buy', false);
      this.endDialogue();
      this.scene.launch('ShopScene', { regionId: this.regionId, mode: 'buy' });
      this.scene.pause();
    }
    if (state.flags['open_shop_sell']) {
      gameState.setFlag('open_shop_sell', false);
      this.endDialogue();
      this.scene.launch('ShopScene', { regionId: this.regionId, mode: 'sell' });
      this.scene.pause();
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
        audioManager.playSfx('heal');
        this.textBox.show('旅店老闆', `花費了 ${innCost} 金幣。全員 HP/MP 完全恢復！`);
      } else {
        audioManager.playSfx('fail');
        this.textBox.show('旅店老闆', '看來你的錢不太夠呢…下次再來吧。');
      }
    }
  }

  private endDialogue(): void {
    this.inDialogue = false;
    this.textBox.hide();
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
