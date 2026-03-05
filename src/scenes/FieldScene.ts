import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { getRegionById } from '../data/regions/index';
import { getEncounterTable, getMonstersForRegion, getBossForRegion, getMiniBossForRegion, generateFieldMiniBoss } from '../data/monsters/index';
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
  collisionBody?: Phaser.GameObjects.Rectangle;
  isStatic: boolean;
  spawnIndex: number;
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
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private enterKey?: Phaser.Input.Keyboard.Key;
  private bossMarkerPos?: { x: number; y: number };
  private fieldMiniBossPos?: { x: number; y: number };
  private fieldMiniBossData?: import('../types').MonsterData;
  private miniBossImmune = false; // prevent re-trigger loop after flee/defeat
  private caveEntrancePos?: { x: number; y: number };
  private caveExitPos?: { x: number; y: number };
  private southHintText?: Phaser.GameObjects.Text;
  private mapWidth = 68; // store for use in update()

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
    this.bossMarkerPos = undefined;
    this.fieldMiniBossPos = undefined;
    this.fieldMiniBossData = undefined;
    this.caveEntrancePos = undefined;
    this.caveExitPos = undefined;
    this.southHintText = undefined;
    // If returning from battle (playerX provided), add brief immunity to prevent mini-boss re-trigger loop
    this.miniBossImmune = !!data.playerX;
    if (this.miniBossImmune) {
      this.time.delayedCall(1500, () => { this.miniBossImmune = false; });
    }

    // Create field map
    const mapConfig = MapFactory.getFieldConfig(this.regionId, region.color);
    const { wallBodies, bounds } = MapFactory.createMap(this, mapConfig);
    this.mapBounds = bounds;
    this.mapWidth = mapConfig.width;

    // Physics bounds
    this.physics.world.setBounds(0, 0, bounds.width, bounds.height);

    // Player — restore position if returning from battle, otherwise bottom (from town)
    const spawnX = data.playerX ?? Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2;
    const spawnY = data.playerY ?? (mapConfig.height - 3) * TILE_SIZE + TILE_SIZE / 2;
    this.player = new Player(this, spawnX, spawnY);
    this.physics.add.collider(this.player, wallBodies);

    // Step counter → encounter check (faster near treasure chests)
    this.player.onStep(() => {
      const nearChest = this.isNearChest();
      let shouldEncounter = EncounterSystem.step();
      // Extra steps near unopened chests (~2.5× encounter rate)
      if (!shouldEncounter && nearChest) {
        shouldEncounter = EncounterSystem.step();
        if (!shouldEncounter && Math.random() < 0.5) {
          shouldEncounter = EncounterSystem.step();
        }
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


    // Keys
    this.interactKey = this.input.keyboard?.addKey('Z');
    this.spaceKey = this.input.keyboard?.addKey('SPACE');
    this.enterKey = this.input.keyboard?.addKey('ENTER');
    this.input.keyboard?.on('keydown-Q', () => { if (!this.inChestDialogue) this.goToWorldMap(); });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.inChestDialogue) { this.dismissChestDialogue(); }
      else { this.openMenu(); }
    });
    this.input.keyboard?.on('keydown-M', () => { if (!this.inChestDialogue) this.openMenu(); });
    this.input.keyboard?.on('keydown-T', () => { if (!this.inChestDialogue) this.goToTown(); });

    // Boss marker on map + minimap
    const boss = getBossForRegion(this.regionId);
    if (boss && !gameState.isRegionLiberated(this.regionId)) {
      const bossX = Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2;
      const bossY = 6 * TILE_SIZE + TILE_SIZE / 2;

      // Generate boss texture and use it as marker
      const bossTexKey = MonsterRenderer.getTextureKey(boss.name, boss.id, true);
      MonsterRenderer.generateForMonster(this, bossTexKey, boss.name, boss.spriteColor, true);
      this.bossMarkerPos = { x: bossX, y: bossY };
      const bossMarker = this.add.image(bossX, bossY, bossTexKey).setDepth(DEPTH.characters);

      this.add.text(bossX, bossY - 104, 'BOSS', {
        fontFamily: FONT_FAMILY, fontSize: '12px', color: '#ff4444',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(DEPTH.characters + 1);

      // Pulse effect
      this.tweens.add({ targets: bossMarker, scale: { from: 1, to: 1.15 }, duration: 800, yoyo: true, repeat: -1 });

      // Red dot on minimap for boss location
      this.minimap.setBossPosition(bossX, bossY);
    }

    // Field mini-boss — can appear before or after liberation (with cooldown)
    if (gameState.canSpawnMiniBoss(this.regionId)) {
      const miniBoss = generateFieldMiniBoss(this.regionId);
      if (miniBoss) {
        this.fieldMiniBossData = miniBoss;
        const mbX = Math.floor(mapConfig.width * 0.7) * TILE_SIZE + TILE_SIZE / 2;
        const mbY = Math.floor(mapConfig.height * 0.3) * TILE_SIZE + TILE_SIZE / 2;
        this.fieldMiniBossPos = { x: mbX, y: mbY };

        const mbTexKey = MonsterRenderer.getTextureKey(miniBoss.name, miniBoss.id, false);
        MonsterRenderer.generateForMonster(this, mbTexKey, miniBoss.name, miniBoss.spriteColor ?? 0x888888, false);
        const mbMarker = this.add.image(mbX, mbY, mbTexKey).setDepth(DEPTH.characters);
        this.add.text(mbX, mbY - 64, '強敵', {
          fontFamily: FONT_FAMILY, fontSize: '11px', color: '#ffaa22',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(DEPTH.characters + 1);
        this.tweens.add({ targets: mbMarker, scale: { from: 0.9, to: 1.05 }, duration: 1000, yoyo: true, repeat: -1 });

        // Orange dot on minimap for mini-boss location
        this.minimap.setMiniBossPosition(mbX, mbY);
      }
    }

    // ── Cave entrance & exit markers ──
    this.placeCaveEntrance(mapConfig);

    // Brown dot on minimap for cave entrance (placeCaveEntrance sets this.caveEntrancePos)
    const cavePos = this.caveEntrancePos as { x: number; y: number } | undefined;
    if (cavePos) {
      this.minimap.setCavePosition(cavePos.x, cavePos.y);
    }

    // ── South signpost — "城鎮" indicator near spawn ──
    const signX = Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2;
    const signY = (mapConfig.height - 4) * TILE_SIZE;
    // Signpost pole
    this.add.rectangle(signX, signY, 6, 40, 0x6b4f3a).setDepth(DEPTH.objects);
    // Sign board
    this.add.rectangle(signX, signY - 24, 72, 22, 0x5a4020)
      .setDepth(DEPTH.objects + 1).setStrokeStyle(1, 0x3a2a10);
    this.add.text(signX, signY - 24, '▼ 城鎮', {
      fontFamily: FONT_FAMILY, fontSize: '11px', color: '#ffcc44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.objects + 2);

    // Landing animation — expanding ring to help locate player spawn
    this.spawnLandingEffect(spawnX, spawnY);

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

    // Check chest interaction (Z, SPACE, or ENTER)
    const justInteract = (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey))
      || (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey))
      || (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey));
    if (justInteract) {
      this.checkChestInteraction();
    }

    // Auto-trigger field mini-boss when close (skip during immunity after flee/defeat)
    if (this.fieldMiniBossPos && this.fieldMiniBossData && !this.miniBossImmune) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, this.fieldMiniBossPos.x, this.fieldMiniBossPos.y
      );
      if (dist < TILE_SIZE * 1.2) {
        this.triggerFieldMiniBoss();
      }
    }

    // Cave entrance — auto-enter on overlap
    if (this.caveEntrancePos) {
      const caveDist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, this.caveEntrancePos.x, this.caveEntrancePos.y
      );
      if (caveDist < TILE_SIZE * 1.2) {
        this.enterCave();
      }
    }

    // Edge transition: walk through south gate gap → town (5-tile wide gate)
    const fieldMidX = Math.floor(this.mapWidth / 2) * TILE_SIZE + TILE_SIZE / 2;
    if (this.player.y >= this.mapBounds.height - TILE_SIZE * 1.5
        && Math.abs(this.player.x - fieldMidX) < TILE_SIZE * 3) {
      this.goToTown();
    }

    // South approach indicator
    if (this.player.y >= this.mapBounds.height - TILE_SIZE * 4
        && Math.abs(this.player.x - fieldMidX) < TILE_SIZE * 3) {
      if (!this.southHintText) {
        this.southHintText = this.add.text(
          fieldMidX, this.mapBounds.height - TILE_SIZE * 2.5,
          '▼ 返回城鎮', {
            fontFamily: FONT_FAMILY, fontSize: '12px', color: '#88ccff',
            stroke: '#000000', strokeThickness: 3,
          }).setOrigin(0.5).setDepth(DEPTH.ui);
      }
    } else {
      if (this.southHintText) {
        this.southHintText.destroy();
        this.southHintText = undefined;
      }
    }
  }

  // ─── Treasure Chests ───

  private spawnTreasureChests(mapConfig: { width: number; height: number }, wallBodies: Phaser.Physics.Arcade.StaticGroup): void {
    if (!this.textures.exists('deco_chest')) this.generateChestTexture();
    if (!this.textures.exists('deco_chest_open')) this.generateChestOpenTexture();

    // Build blocked grid from wall bodies for smart placement
    const blocked = this.buildBlockedGrid(wallBodies, mapConfig.width, mapConfig.height);

    // ── Static chests (2-3, one-time, permanent flags) ──
    const staticSpots = this.findChestSpots(blocked, mapConfig.width, mapConfig.height, 3, 6);
    for (let i = 0; i < staticSpots.length; i++) {
      const flagKey = `static_chest_field_${this.regionId}_${i}`;
      if (gameState.getFlag(flagKey)) continue; // permanently opened
      const { gx, gy } = staticSpots[i];
      this.placeChest(gx, gy, flagKey, true, i, wallBodies);
    }

    // ── Dynamic chests (1-2, respawning with 30-min cooldown) ──
    // Zone-limited + keep distance from static chest positions
    const dynKey = `dyn_chest_field_${this.regionId}`;
    const dynCount = 1 + (Math.random() < 0.5 ? 1 : 0);
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
      if (spawn.opened[i]) continue; // already opened this cycle
      const { gx, gy } = spawn.positions[i];
      this.placeChest(gx, gy, dynKey, false, i, wallBodies);
    }
  }

  private placeChest(gx: number, gy: number, flagKey: string, isStatic: boolean, spawnIndex: number, wallBodies: Phaser.Physics.Arcade.StaticGroup): void {
    const px = gx * TILE_SIZE + TILE_SIZE / 2;
    const py = gy * TILE_SIZE + TILE_SIZE / 2;

    const sprite = this.add.sprite(px, py, 'deco_chest')
      .setDepth(DEPTH.objects + 1).setScale(0.5);

    // Golden glow pulse for static chests
    if (isStatic) {
      this.tweens.add({ targets: sprite, alpha: { from: 0.85, to: 1 }, duration: 1200, yoyo: true, repeat: -1 });
    }

    const chestBody = this.add.rectangle(px, py, TILE_SIZE / 2 - 4, TILE_SIZE / 2 - 4);
    this.physics.add.existing(chestBody, true);
    wallBodies.add(chestBody);
    chestBody.setVisible(false);

    this.chests.push({ sprite, gx, gy, flagKey, opened: false, collisionBody: chestBody, isStatic, spawnIndex });
  }

  /** Build a boolean grid marking blocked (wall/border) tiles */
  private buildBlockedGrid(wallBodies: Phaser.Physics.Arcade.StaticGroup, w: number, h: number): boolean[][] {
    const grid: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false));
    // Mark borders
    for (let x = 0; x < w; x++) { grid[0][x] = true; grid[h - 1][x] = true; }
    for (let y = 0; y < h; y++) { grid[y][0] = true; grid[y][w - 1] = true; }
    // Mark wall body tiles
    for (const body of wallBodies.getChildren()) {
      const go = body as Phaser.GameObjects.Rectangle;
      const gx = Math.floor(go.x / TILE_SIZE);
      const gy = Math.floor(go.y / TILE_SIZE);
      if (gx >= 0 && gx < w && gy >= 0 && gy < h) grid[gy][gx] = true;
    }
    return grid;
  }

  /**
   * Find good chest spots by scoring walkable tiles based on wall-neighbor count.
   * @param exclude positions to keep distance from (e.g. already-placed static chests)
   * @param zoneLimit if true, enforce max 1 pick per horizontal zone (left/center/right)
   */
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
      // Min distance from other picked spots
      const tooClose = picked.some(p =>
        Math.abs(p.gx - s.gx) + Math.abs(p.gy - s.gy) < 8
      );
      if (tooClose) continue;
      // Min distance from excluded positions (static chests etc.)
      const nearExclude = exclude.some(p =>
        Math.abs(p.gx - s.gx) + Math.abs(p.gy - s.gy) < 10
      );
      if (nearExclude) continue;
      // Zone limit: max 1 per horizontal third
      if (zoneLimit) {
        const zone = Math.min(2, Math.floor(s.gx / zoneW));
        if (usedZones.has(zone)) continue;
        usedZones.add(zone);
      }
      picked.push({ gx: s.gx, gy: s.gy });
    }

    // Fallback: random positions if insufficient
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

  private checkChestInteraction(): void {
    const playerPos = this.player.getGridPosition();
    for (const chest of this.chests) {
      if (chest.opened) continue; // Skip opened chests — they fade out visually
      const dist = Math.abs(playerPos.gx - chest.gx) + Math.abs(playerPos.gy - chest.gy);
      if (dist <= 2) {
        this.openChest(chest);
        return;
      }
    }
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

    this.inChestDialogue = true;

    if (chest.isStatic) {
      this.openStaticFieldChest(regionLevel);
    } else {
      this.openDynamicFieldChest(effectiveLevel);
    }
  }

  /** Static field chest: guaranteed good reward (equipment / rare consumable / 2× gold) */
  private openStaticFieldChest(regionLevel: number): void {
    const roll = Math.random();
    const tiers = ['wood', 'iron', 'steel', 'silver', 'mithril', 'dragon', 'holy', 'legendary'];
    const tierIndex = Math.min(tiers.length - 1, Math.floor(regionLevel / 8));

    if (roll < 0.5) {
      // 50% region-tier equipment
      const allEquip = getAllEquipments();
      const validTiers = tiers.slice(Math.max(0, tierIndex - 1), Math.min(tiers.length, tierIndex + 2));
      const candidates = allEquip.filter(e => validTiers.includes(e.tier));
      const equip = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : allEquip[Math.floor(Math.random() * allEquip.length)];
      gameState.addItem(equip.id);
      this.textBox.show('', `✦ ${t('chest.found')}\n${t('chest.equipment', equip.name)}`);
    } else if (roll < 0.8) {
      // 30% rare consumable
      const rareItems = ['item_elixir', 'item_potion_l', 'item_ether_m'];
      const itemId = rareItems[Math.floor(Math.random() * rareItems.length)];
      const consumables = getAllConsumables();
      const item = consumables.find(c => c.id === itemId) ?? consumables[0];
      gameState.addItem(item.id);
      this.textBox.show('', `✦ ${t('chest.found')}\n${t('chest.item', item.name)}`);
    } else {
      // 20% gold (2× normal formula)
      const goldAmount = Math.floor((30 + regionLevel * 12) * 2);
      gameState.addGold(goldAmount);
      this.textBox.show('', `✦ ${t('chest.found')}\n${t('chest.gold', goldAmount)}`);
    }
  }

  /** Dynamic field chest: standard rewards with effectiveLevel cap */
  private openDynamicFieldChest(effectiveLevel: number): void {
    const roll = Math.random();

    if (roll < 0.6) {
      // 60% gold with effectiveLevel
      const minGold = Math.floor(10 + effectiveLevel * 3);
      const maxGold = Math.floor(30 + effectiveLevel * 12);
      const goldAmount = minGold + Math.floor(Math.random() * (maxGold - minGold));
      gameState.addGold(goldAmount);
      this.textBox.show('', `${t('chest.found')}\n${t('chest.gold', goldAmount)}`);
    } else if (roll < 0.9) {
      // 30% consumable
      const consumables = getAllConsumables();
      if (consumables.length === 0) { gameState.addGold(50); this.textBox.show('', `${t('chest.found')}\n${t('chest.gold', 50)}`); return; }
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

  private triggerFieldMiniBoss(): void {
    if (!this.fieldMiniBossData) return;
    const monster = structuredClone(this.fieldMiniBossData);
    this.fieldMiniBossData = undefined; // prevent re-trigger
    this.fieldMiniBossPos = undefined;

    audioManager.playSfx('hit');
    TransitionEffect.transition(this, 'BattleScene', {
      monsters: [monster],
      regionId: this.regionId,
      isBoss: false,
      skipIntro: true, // no sword-crossing intro for field mini-boss
      returnScene: 'FieldScene',
      returnData: { regionId: this.regionId, playerX: this.player.x, playerY: this.player.y },
      onVictory: () => { gameState.recordMiniBossDefeat(this.regionId); },
    });
  }

  private triggerBoss(): void {
    if (gameState.isRegionLiberated(this.regionId)) return;

    // Must be within 1.5 tiles of the boss marker
    if (this.bossMarkerPos) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, this.bossMarkerPos.x, this.bossMarkerPos.y
      );
      if (dist > TILE_SIZE * 1.5) {
        // Show brief hint
        const hint = this.add.text(this.player.x, this.player.y - 40, '靠近 Boss 才能挑戰！', {
          fontFamily: FONT_FAMILY, fontSize: '13px', color: '#ff8888',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(DEPTH.ui + 10);
        this.tweens.add({ targets: hint, alpha: 0, y: hint.y - 20, duration: 1200, onComplete: () => hint.destroy() });
        return;
      }
    }

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

  private placeCaveEntrance(mapConfig: { width: number; height: number }): void {
    // Cave entrance: north-central area of field (deeper territory)
    const entrGx = Math.floor(mapConfig.width * 0.65);
    const entrGy = Math.floor(mapConfig.height * 0.2);
    const entrPx = entrGx * TILE_SIZE + TILE_SIZE / 2;
    const entrPy = entrGy * TILE_SIZE + TILE_SIZE / 2;
    this.caveEntrancePos = { x: entrPx, y: entrPy };

    // Generate cave entrance texture if not exists
    if (!this.textures.exists('deco_cave_entrance')) {
      this.generateCaveEntranceTexture();
    }
    this.add.image(entrPx, entrPy, 'deco_cave_entrance')
      .setDepth(DEPTH.objects).setScale(1.2);

    // Label with glow effect
    this.add.text(entrPx, entrPy - 60, '洞窟入口', {
      fontFamily: FONT_FAMILY, fontSize: '13px', color: '#ffcc44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.characters + 1);

    // Mountain ring around cave entrance (C-shape with south gap for approach)
    const rockKey = this.textures.exists('deco_large_rock') ? 'deco_large_rock' : 'deco_rock';
    const hasRockTex = this.textures.exists(rockKey);
    // Ring offsets: positions around the cave entrance (gap at south for approach path)
    const ringOffsets = [
      { dx: -2, dy: -2 }, { dx: -1, dy: -2 }, { dx: 0, dy: -2 }, { dx: 1, dy: -2 }, { dx: 2, dy: -2 },
      { dx: -2, dy: -1 }, { dx: 2, dy: -1 },
      { dx: -2, dy: 0 }, { dx: 2, dy: 0 },
      { dx: -2, dy: 1 }, { dx: 2, dy: 1 },
      // Gap at south center (dx=0,dy=2) left open for approach
      { dx: -2, dy: 2 }, { dx: 2, dy: 2 },
    ];
    for (const off of ringOffsets) {
      const rx = (entrGx + off.dx) * TILE_SIZE + TILE_SIZE / 2;
      const ry = (entrGy + off.dy) * TILE_SIZE + TILE_SIZE / 2;
      if (hasRockTex) {
        this.add.image(rx, ry, rockKey)
          .setDepth(DEPTH.objects).setScale(0.8 + Math.random() * 0.3);
      } else {
        this.add.rectangle(rx, ry, TILE_SIZE - 4, TILE_SIZE - 4, 0x555555)
          .setDepth(DEPTH.objects);
      }
      // Add collision body for mountain rocks
      const body = this.add.rectangle(rx, ry, TILE_SIZE - 8, TILE_SIZE - 8);
      this.physics.add.existing(body, true);
      body.setVisible(false);
      this.physics.add.collider(this.player, body);
    }

    // Approach path: 2-tile-wide dirt/stone path from south gap toward open area
    const pathKey = this.textures.exists('tile_path') ? 'tile_path' : null;
    for (let py = entrGy + 3; py <= entrGy + 5; py++) {
      for (let px2 = entrGx - 1; px2 <= entrGx + 1; px2++) {
        const ppx = px2 * TILE_SIZE + TILE_SIZE / 2;
        const ppy = py * TILE_SIZE + TILE_SIZE / 2;
        if (pathKey) {
          this.add.image(ppx, ppy, pathKey).setDepth(DEPTH.ground + 1).setAlpha(0.6);
        } else {
          this.add.rectangle(ppx, ppy, TILE_SIZE, TILE_SIZE, 0x887755, 0.3)
            .setDepth(DEPTH.ground + 1);
        }
      }
    }

    // Cave exit: left side, upper area (different position)
    const exitGx = Math.floor(mapConfig.width * 0.2);
    const exitGy = Math.floor(mapConfig.height * 0.15);
    const exitPx = exitGx * TILE_SIZE + TILE_SIZE / 2;
    const exitPy = exitGy * TILE_SIZE + TILE_SIZE / 2;
    this.caveExitPos = { x: exitPx, y: exitPy };

    // Exit marker (visual only, non-interactive — shows as a small rocky opening)
    if (!this.textures.exists('deco_cave_exit')) {
      this.generateCaveExitTexture();
    }
    this.add.image(exitPx, exitPy, 'deco_cave_exit')
      .setDepth(DEPTH.objects).setScale(0.9);

    this.add.text(exitPx, exitPy - 36, '洞窟出口', {
      fontFamily: FONT_FAMILY, fontSize: '10px', color: '#888888',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(DEPTH.characters + 1);
  }

  private enterCave(): void {
    if (!this.caveExitPos) return;
    audioManager.playSfx('select');
    TransitionEffect.transition(this, 'CaveScene', {
      regionId: this.regionId,
      fieldReturnX: this.caveExitPos.x,
      fieldReturnY: this.caveExitPos.y,
    });
  }

  private generateCaveEntranceTexture(): void {
    const S = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S * 2; canvas.height = S * 2;
    const ctx = canvas.getContext('2d')!;
    const cx = S, cy = S;

    // Larger rock frame with rough edges (mountain-like)
    ctx.fillStyle = '#4a4a4a';
    for (let a = 0; a < Math.PI; a += 0.015) {
      const rx = 46 + Math.sin(a * 3) * 4;
      const ry = 50 + Math.cos(a * 5) * 3;
      const x = cx + Math.cos(a + Math.PI) * rx;
      const y = cy + Math.sin(a + Math.PI) * ry * 0.7 - 8;
      ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 8);
    }

    // Inner rock layer (lighter)
    ctx.fillStyle = '#5a5a5a';
    for (let a = 0; a < Math.PI; a += 0.02) {
      const rx = 38 + Math.sin(a * 4) * 3;
      const ry = 42 + Math.cos(a * 3) * 2;
      const x = cx + Math.cos(a + Math.PI) * rx;
      const y = cy + Math.sin(a + Math.PI) * ry * 0.7 - 6;
      ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6);
    }

    // Dark interior (cave opening) — deeper
    ctx.fillStyle = '#0a0a0a';
    for (let y = cy - 22; y < cy + 28; y++) {
      const t = (y - (cy - 22)) / 50;
      const w = Math.round(30 * Math.sin(Math.min(1, t * 1.4) * Math.PI));
      ctx.fillRect(cx - w, y, w * 2, 1);
    }
    // Gradient depth effect
    ctx.fillStyle = '#1a1a1a';
    for (let y = cy - 16; y < cy + 20; y++) {
      const t = (y - (cy - 16)) / 36;
      const w = Math.round(22 * Math.sin(Math.min(1, t * 1.3) * Math.PI));
      ctx.fillRect(cx - w, y, w * 2, 1);
    }

    // Rock details with highlights
    ctx.fillStyle = '#6a6a6a';
    ctx.fillRect(cx - 36, cy - 18, 10, 7);
    ctx.fillRect(cx + 26, cy - 14, 9, 6);
    ctx.fillRect(cx - 30, cy + 14, 8, 9);
    ctx.fillRect(cx + 24, cy + 10, 8, 12);

    // Top keystone
    ctx.fillStyle = '#777777';
    ctx.fillRect(cx - 8, cy - 30, 16, 6);
    ctx.fillStyle = '#888888';
    ctx.fillRect(cx - 6, cy - 30, 12, 3);

    // Ground rocks at base
    ctx.fillStyle = '#444444';
    ctx.fillRect(cx - 38, cy + 26, 14, 7);
    ctx.fillRect(cx + 24, cy + 24, 16, 9);

    // ── Torches on each side ──
    // Left torch bracket
    ctx.fillStyle = '#6b4f3a';
    ctx.fillRect(cx - 38, cy - 6, 4, 16);
    // Right torch bracket
    ctx.fillRect(cx + 34, cy - 6, 4, 16);
    // Left flame (orange-yellow)
    ctx.fillStyle = '#ff8822';
    ctx.fillRect(cx - 39, cy - 12, 6, 6);
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(cx - 38, cy - 14, 4, 4);
    ctx.fillStyle = '#ffee88';
    ctx.fillRect(cx - 37, cy - 13, 2, 2);
    // Right flame
    ctx.fillStyle = '#ff8822';
    ctx.fillRect(cx + 33, cy - 12, 6, 6);
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(cx + 34, cy - 14, 4, 4);
    ctx.fillStyle = '#ffee88';
    ctx.fillRect(cx + 35, cy - 13, 2, 2);

    // Torch glow (soft orange circles)
    ctx.fillStyle = 'rgba(255, 140, 40, 0.15)';
    for (let r = 12; r > 0; r -= 3) {
      ctx.beginPath();
      ctx.arc(cx - 36, cy - 10, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 36, cy - 10, r, 0, Math.PI * 2);
      ctx.fill();
    }

    this.textures.addCanvas('deco_cave_entrance', canvas);
  }

  private generateCaveExitTexture(): void {
    const S = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    const cx = S / 2, cy = S / 2;

    // Smaller rocky opening (exit hole)
    ctx.fillStyle = '#555555';
    for (let a = 0; a < Math.PI; a += 0.04) {
      const rx = 18 + Math.sin(a * 4) * 2;
      const ry = 20;
      const x = cx + Math.cos(a + Math.PI) * rx;
      const y = cy + Math.sin(a + Math.PI) * ry * 0.6;
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    }

    // Dark center
    ctx.fillStyle = '#1a1a1a';
    for (let y = cy - 8; y < cy + 10; y++) {
      const t = (y - (cy - 8)) / 18;
      const w = Math.round(12 * Math.sin(Math.min(1, t * 1.4) * Math.PI));
      ctx.fillRect(cx - w, y, w * 2, 1);
    }

    // Rocks around
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(cx - 16, cy + 8, 8, 5);
    ctx.fillRect(cx + 8, cy + 6, 9, 6);

    this.textures.addCanvas('deco_cave_exit', canvas);
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
