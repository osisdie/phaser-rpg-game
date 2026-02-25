import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { getRegionById } from '../data/regions/index';
import { getEncounterTable, getMonstersForRegion, getBossForRegion, getMiniBossForRegion } from '../data/monsters/index';
import { EncounterSystem } from '../systems/EncounterSystem';
import { MapFactory } from '../maps/MapFactory';
import { Player } from '../entities/Player';
import { MinimapUI } from '../ui/MinimapUI';
import { TextBox } from '../ui/TextBox';
import { TransitionEffect } from '../ui/TransitionEffect';
import { audioManager } from '../systems/AudioManager';
import { SaveLoadSystem } from '../systems/SaveLoadSystem';
import { BattleEffects } from '../art/effects/BattleEffects';
import { MonsterRenderer } from '../art/monsters/MonsterRenderer';
import { getAllConsumables, getAllEquipments } from '../data/items/index';

interface TreasureChest {
  sprite: Phaser.GameObjects.Sprite;
  gx: number;
  gy: number;
  flagKey: string;
  opened: boolean;
}

export class FieldScene extends Phaser.Scene {
  private player!: Player;
  private minimap!: MinimapUI;
  private textBox!: TextBox;
  private regionId = '';
  private mapBounds = { width: 0, height: 0 };
  private chests: TreasureChest[] = [];
  private inChestDialogue = false;
  private interactKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super('FieldScene');
  }

  create(data: { regionId: string; playerX?: number; playerY?: number }): void {
    this.regionId = data.regionId || gameState.getState().currentRegion;
    const region = getRegionById(this.regionId);
    if (!region) { this.scene.start('WorldMapScene'); return; }

    gameState.setCurrentScene('FieldScene');
    EncounterSystem.initSteps();
    this.chests = [];
    this.inChestDialogue = false;

    // Create field map
    const mapConfig = MapFactory.getFieldConfig(this.regionId, region.color);
    const { wallBodies, bounds } = MapFactory.createMap(this, mapConfig);
    this.mapBounds = bounds;

    // Physics bounds
    this.physics.world.setBounds(0, 0, bounds.width, bounds.height);

    // Player — restore position if returning from battle, otherwise center-bottom
    const spawnX = data.playerX ?? Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2;
    const spawnY = data.playerY ?? (mapConfig.height - 3) * TILE_SIZE + TILE_SIZE / 2;
    this.player = new Player(this, spawnX, spawnY);
    this.physics.add.collider(this.player, wallBodies);

    // Step counter → encounter check (faster near treasure chests)
    this.player.onStep(() => {
      const nearChest = this.isNearChest();
      let shouldEncounter = EncounterSystem.step();
      // Extra step decrement near unopened chests (effectively 2× encounter rate)
      if (!shouldEncounter && nearChest) {
        shouldEncounter = EncounterSystem.step();
      }
      if (shouldEncounter) {
        this.triggerEncounter();
      }
    });

    // Camera
    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Minimap
    this.minimap = new MinimapUI(this, bounds.width, bounds.height);
    this.minimap.setScrollFactor(0);

    // TextBox for chest messages
    this.textBox = new TextBox(this);

    // Spawn treasure chests (1-3 in field to encourage exploration)
    this.spawnTreasureChests(mapConfig, wallBodies);

    // Header
    if (this.textures.exists('ui_header_bar')) {
      this.add.image(GAME_WIDTH / 2, 16, 'ui_header_bar')
        .setScrollFactor(0).setDepth(DEPTH.ui);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, 16, GAME_WIDTH, 32, 0x000000, 0.5)
        .setScrollFactor(0).setDepth(DEPTH.ui);
    }
    this.add.text(GAME_WIDTH / 2, 16, `${region.name} — 野外  Lv.${region.levelRange[0]}-${region.levelRange[1]}`, {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textHighlight,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.ui + 1);

    // Controls footer with background bar for visibility
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 12, GAME_WIDTH, 24, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(DEPTH.ui);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 12, 'WASD移動 | Z寶箱 | T城鎮 | B Boss戰 | M選單 | Q世界地圖', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#ddddcc',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.ui + 1);

    // Keys
    this.interactKey = this.input.keyboard?.addKey('Z');
    this.input.keyboard?.on('keydown-T', () => { if (!this.inChestDialogue) this.goToTown(); });
    this.input.keyboard?.on('keydown-Q', () => { if (!this.inChestDialogue) this.goToWorldMap(); });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.inChestDialogue) { this.dismissChestDialogue(); }
      else { this.openMenu(); }
    });
    this.input.keyboard?.on('keydown-M', () => { if (!this.inChestDialogue) this.openMenu(); });
    this.input.keyboard?.on('keydown-B', () => { if (!this.inChestDialogue) this.triggerBoss(); });

    // Boss marker on map
    const boss = getBossForRegion(this.regionId);
    if (boss && !gameState.isRegionLiberated(this.regionId)) {
      const bossX = Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2;
      const bossY = 3 * TILE_SIZE + TILE_SIZE / 2;

      // Generate boss texture and use it as marker
      const bossTexKey = MonsterRenderer.getTextureKey(boss.name, boss.id, true);
      MonsterRenderer.generateForMonster(this, bossTexKey, boss.name, boss.spriteColor, true);
      const bossMarker = this.add.image(bossX, bossY, bossTexKey).setDepth(DEPTH.characters);

      this.add.text(bossX, bossY - 52, 'BOSS', {
        fontFamily: FONT_FAMILY, fontSize: '12px', color: '#ff4444',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(DEPTH.characters + 1);

      // Pulse effect
      this.tweens.add({ targets: bossMarker, scale: { from: 1, to: 1.15 }, duration: 800, yoyo: true, repeat: -1 });
    }

    // Environment particles
    BattleEffects.spawnEnvironmentParticles(this, this.regionId, bounds);

    TransitionEffect.fadeIn(this);
    audioManager.playBgm('field', this.regionId);
  }

  update(time: number, delta: number): void {
    if (this.inChestDialogue) {
      this.textBox.update(time, delta);
      if (Phaser.Input.Keyboard.JustDown(this.interactKey!) ||
          this.input.keyboard?.checkDown(this.input.keyboard.addKey('ENTER'), 200) ||
          this.input.keyboard?.checkDown(this.input.keyboard.addKey('SPACE'), 200)) {
        this.dismissChestDialogue();
      }
      return;
    }

    this.player.update(time, delta);
    this.minimap.updatePlayerPosition(this.player.x, this.player.y, this.mapBounds.width, this.mapBounds.height);

    // Check chest interaction
    if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.checkChestInteraction();
    }
  }

  // ─── Treasure Chests ───

  private spawnTreasureChests(mapConfig: { width: number; height: number }, wallBodies: Phaser.Physics.Arcade.StaticGroup): void {
    // Generate chest textures if not exists
    if (!this.textures.exists('deco_chest')) {
      this.generateChestTexture();
    }
    if (!this.textures.exists('deco_chest_open')) {
      this.generateChestOpenTexture();
    }

    // Truly random each visit: 0-3 chests in field
    const chestCount = Math.floor(Math.random() * 4); // 0-3
    if (chestCount === 0) return;

    // Divide map into 3 horizontal zones to avoid clustering
    const zoneW = Math.floor((mapConfig.width - 6) / 3);
    const zones = [
      { minX: 3, maxX: 3 + zoneW },
      { minX: 3 + zoneW, maxX: 3 + zoneW * 2 },
      { minX: 3 + zoneW * 2, maxX: mapConfig.width - 3 },
    ];

    for (let ci = 0; ci < chestCount; ci++) {
      const flagKey = `chest_field_${this.regionId}_${ci}`;

      // Each chest goes in a different zone (no two in same third)
      const zone = zones[ci % zones.length];
      const gx = zone.minX + Math.floor(Math.random() * (zone.maxX - zone.minX));
      const gy = 4 + Math.floor(Math.random() * (mapConfig.height - 8));

      const px = gx * TILE_SIZE + TILE_SIZE / 2;
      const py = gy * TILE_SIZE + TILE_SIZE / 2;

      const sprite = this.add.sprite(px, py, 'deco_chest')
        .setDepth(DEPTH.objects + 1);

      // Add collision body
      const chestBody = this.add.rectangle(px, py, TILE_SIZE - 8, TILE_SIZE - 8);
      this.physics.add.existing(chestBody, true);
      wallBodies.add(chestBody);
      chestBody.setVisible(false);

      this.chests.push({ sprite, gx, gy, flagKey, opened: false });
    }
  }

  private checkChestInteraction(): void {
    const playerPos = this.player.getGridPosition();
    for (const chest of this.chests) {
      const dist = Math.abs(playerPos.gx - chest.gx) + Math.abs(playerPos.gy - chest.gy);
      if (dist <= 2) {
        this.openChest(chest);
        return;
      }
    }
  }

  private openChest(chest: TreasureChest): void {
    if (chest.opened || !chest.sprite) {
      this.inChestDialogue = true;
      this.textBox.show('', t('chest.already_opened'));
      return;
    }

    chest.opened = true;
    chest.sprite.setTexture('deco_chest_open');
    audioManager.playSfx('select');

    // Fade out after a short delay (visual feedback then disappear)
    this.time.delayedCall(800, () => {
      if (chest.sprite) {
        this.tweens.add({ targets: chest.sprite, alpha: 0, duration: 600, ease: 'Power2' });
      }
    });

    // Determine reward: 60% gold, 30% item, 10% equipment
    const roll = Math.random();
    const region = getRegionById(this.regionId);
    const baseLevel = region?.levelRange[0] ?? 1;

    this.inChestDialogue = true;

    if (roll < 0.6) {
      // Gold reward — scaled with kingdom level (higher kingdoms = bigger range)
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

  private dismissChestDialogue(): void {
    this.inChestDialogue = false;
    this.textBox.hide();
  }

  /** Returns true if player is within 3 tiles of any unopened chest */
  private isNearChest(): boolean {
    const playerPos = this.player.getGridPosition();
    for (const chest of this.chests) {
      if (chest.opened) continue;
      const dist = Math.abs(playerPos.gx - chest.gx) + Math.abs(playerPos.gy - chest.gy);
      if (dist <= 3) return true;
    }
    return false;
  }

  private generateChestTexture(): void {
    const S = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;

    // Ground shadow (semi-transparent oval)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let py = S - 5; py < S; py++) {
      const w = Math.round((S - 12) * (1 - (py - (S - 5)) / 5 * 0.3));
      ctx.fillRect(S / 2 - w / 2, py, w, 1);
    }
    // Chest body (wooden box with wood grain)
    const bodyTop = Math.round(S * 0.35);
    const bodyH = Math.round(S * 0.48);
    for (let y = bodyTop; y < bodyTop + bodyH; y++) {
      for (let x = 4; x < S - 4; x++) {
        const grain = ((x * 7 + y * 3) % 5 === 0) ? -12 : 0;
        const r = 0x8B + grain, g = 0x5E + grain, b = 0x3C + grain;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Side shading (left dark, right light)
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(4, bodyTop, 3, bodyH);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(S - 7, bodyTop, 3, bodyH);
    // Chest lid (slightly wider, rounded look)
    ctx.fillStyle = '#A0714F';
    ctx.fillRect(3, Math.round(S * 0.25), S - 6, Math.round(S * 0.13));
    ctx.fillStyle = '#B88060';
    ctx.fillRect(4, Math.round(S * 0.25), S - 8, 2); // lid top highlight
    ctx.fillStyle = '#8a6040';
    ctx.fillRect(3, Math.round(S * 0.36), S - 6, 2); // lid bottom edge
    // Metal bands with rivets
    ctx.fillStyle = '#C8A82E';
    ctx.fillRect(4, Math.round(S * 0.38), S - 8, 2);
    ctx.fillRect(4, Math.round(S * 0.58), S - 8, 2);
    // Rivets on bands
    ctx.fillStyle = '#E0C040';
    for (let rx = 6; rx < S - 6; rx += 5) {
      ctx.fillRect(rx, Math.round(S * 0.38), 1, 1);
      ctx.fillRect(rx, Math.round(S * 0.58), 1, 1);
    }
    // Lock plate
    ctx.fillStyle = '#B89828';
    ctx.fillRect(S / 2 - 3, Math.round(S * 0.40), 6, 9);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(S / 2 - 2, Math.round(S * 0.41), 4, 7);
    // Keyhole
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
    // Open lid (tilted back, 3D perspective)
    ctx.fillStyle = '#A0714F';
    ctx.fillRect(3, Math.round(S * 0.15), S - 6, Math.round(S * 0.10));
    ctx.fillStyle = '#8a6040'; // lid inner face
    ctx.fillRect(4, Math.round(S * 0.24), S - 8, Math.round(S * 0.10));
    ctx.fillStyle = '#705030'; // lid connection
    ctx.fillRect(5, Math.round(S * 0.32), S - 10, Math.round(S * 0.06));
    // Lid highlight
    ctx.fillStyle = '#B88060';
    ctx.fillRect(4, Math.round(S * 0.15), S - 8, 2);
    // Open chest body (lower)
    for (let y = Math.round(S * 0.38); y < Math.round(S * 0.82); y++) {
      for (let x = 4; x < S - 4; x++) {
        const grain = ((x * 7 + y * 3) % 5 === 0) ? -12 : 0;
        ctx.fillStyle = `rgb(${0x8B + grain},${0x5E + grain},${0x3C + grain})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Inside (dark cavity with sparkle)
    ctx.fillStyle = '#2a1808';
    ctx.fillRect(6, Math.round(S * 0.42), S - 12, Math.round(S * 0.22));
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(S / 2 - 1, Math.round(S * 0.50), 2, 2); // gold glint
    ctx.fillRect(S / 2 + 4, Math.round(S * 0.54), 1, 1);
    // Metal band
    ctx.fillStyle = '#C8A82E';
    ctx.fillRect(4, Math.round(S * 0.40), S - 8, 2);

    this.textures.addCanvas('deco_chest_open', canvas);
  }

  // ─── Encounters & Navigation ───

  private triggerEncounter(): void {
    const table = getEncounterTable(this.regionId);
    if (!table) return;
    const monsters = EncounterSystem.generateEncounter(table);
    if (monsters.length === 0) return;

    audioManager.playSfx('hit');
    TransitionEffect.transition(this, 'BattleScene', {
      monsters,
      regionId: this.regionId,
      returnScene: 'FieldScene',
      returnData: { regionId: this.regionId, playerX: this.player.x, playerY: this.player.y },
    });
  }

  private triggerBoss(): void {
    if (gameState.isRegionLiberated(this.regionId)) return;

    // Demon kingdom: must defeat mini-boss before final boss
    const miniBoss = getMiniBossForRegion(this.regionId);
    if (miniBoss && !gameState.getFlag('mini_boss_demon_defeated')) {
      SaveLoadSystem.autoSave();
      TransitionEffect.transition(this, 'BattleScene', {
        monsters: [structuredClone(miniBoss)],
        regionId: this.regionId,
        isBoss: false, // mini-boss doesn't liberate region
        returnScene: 'FieldScene',
        returnData: { regionId: this.regionId, playerX: this.player.x, playerY: this.player.y },
      });
      return;
    }

    const boss = getBossForRegion(this.regionId);
    if (!boss) return;

    SaveLoadSystem.autoSave();
    TransitionEffect.transition(this, 'BattleScene', {
      monsters: [structuredClone(boss)],
      regionId: this.regionId,
      isBoss: true,
      returnScene: 'FieldScene',
      returnData: { regionId: this.regionId, playerX: this.player.x, playerY: this.player.y },
    });
  }

  private goToTown(): void {
    TransitionEffect.transition(this, 'TownScene', { regionId: this.regionId });
  }

  private goToWorldMap(): void {
    TransitionEffect.transition(this, 'WorldMapScene');
  }

  private openMenu(): void {
    this.scene.launch('MenuScene');
    this.scene.pause();
  }
}
