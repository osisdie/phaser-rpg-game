import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { getRegionById } from '../data/regions/index';
import { getCaveEncounterTable, generateCaveBoss } from '../data/monsters/index';
import { EncounterSystem } from '../systems/EncounterSystem';
import { MapFactory } from '../maps/MapFactory';
import { Player } from '../entities/Player';
import { MinimapUI } from '../ui/MinimapUI';
import { TextBox } from '../ui/TextBox';
import { TransitionEffect } from '../ui/TransitionEffect';
import { audioManager } from '../systems/AudioManager';
import { MonsterRenderer } from '../art/monsters/MonsterRenderer';
import { getAllConsumables, getAllEquipments } from '../data/items/index';

interface CaveChest {
  sprite: Phaser.GameObjects.Sprite;
  gx: number;
  gy: number;
  flagKey: string;
  opened: boolean;
  collisionBody?: Phaser.GameObjects.Rectangle;
}

export class CaveScene extends Phaser.Scene {
  private player!: Player;
  private minimap!: MinimapUI;
  private textBox!: TextBox;
  private regionId = '';
  private mapBounds = { width: 0, height: 0 };
  private chest?: CaveChest;
  private inDialogue = false;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private enterKey?: Phaser.Input.Keyboard.Key;

  // Boss state
  private caveBossData?: import('../types').MonsterData;
  private caveBossPos?: { x: number; y: number };
  private bossDefeated = false;
  private dialogueCooldown = 0;

  // Entrance/exit positions (grid coords, passed to FieldScene on return)
  private fieldReturnX = 0;
  private fieldReturnY = 0;

  constructor() {
    super('CaveScene');
  }

  create(data: {
    regionId: string;
    fieldReturnX?: number;
    fieldReturnY?: number;
    playerX?: number;
    playerY?: number;
  }): void {
    this.regionId = data.regionId || gameState.getState().currentRegion;
    this.fieldReturnX = data.fieldReturnX ?? 0;
    this.fieldReturnY = data.fieldReturnY ?? 0;
    const region = getRegionById(this.regionId);
    if (!region) { this.scene.start('FieldScene', { regionId: this.regionId }); return; }

    gameState.setCurrentScene('CaveScene');
    EncounterSystem.initSteps();
    this.chest = undefined;
    this.inDialogue = false;
    this.caveBossData = undefined;
    this.caveBossPos = undefined;
    this.bossDefeated = gameState.getFlag(`cave_boss_${this.regionId}_defeated`);

    // Create cave map
    const mapConfig = MapFactory.getCaveConfig(this.regionId);
    const { wallBodies, bounds } = MapFactory.createMap(this, mapConfig);
    this.mapBounds = bounds;

    // Physics bounds
    this.physics.world.setBounds(0, 0, bounds.width, bounds.height);

    // Player spawn — bottom center (cave entrance) or specified position
    const spawnX = data.playerX ?? Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2;
    const spawnY = data.playerY ?? (mapConfig.height - 3) * TILE_SIZE + TILE_SIZE / 2;
    this.player = new Player(this, spawnX, spawnY);
    this.physics.add.collider(this.player, wallBodies);

    // Step counter → encounters (cave uses higher rate)
    this.player.onStep(() => {
      if (EncounterSystem.step()) {
        this.triggerEncounter();
      }
    });

    // Camera
    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Minimap
    this.minimap = new MinimapUI(this, bounds.width, bounds.height);
    this.minimap.setScrollFactor(0);

    // TextBox for messages
    this.textBox = new TextBox(this);

    // ── Cave Boss ──
    if (!this.bossDefeated) {
      const boss = generateCaveBoss(this.regionId);
      if (boss) {
        this.caveBossData = boss;
        const bossX = Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2;
        const bossY = 6 * TILE_SIZE + TILE_SIZE / 2;
        this.caveBossPos = { x: bossX, y: bossY };

        const bossTexKey = MonsterRenderer.getTextureKey(boss.name, boss.id, true);
        MonsterRenderer.generateForMonster(this, bossTexKey, boss.name, boss.spriteColor, true);
        const bossMarker = this.add.image(bossX, bossY, bossTexKey).setDepth(DEPTH.characters);

        this.add.text(bossX, bossY - 104, '守護者', {
          fontFamily: FONT_FAMILY, fontSize: '12px', color: '#ff6644',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(DEPTH.characters + 1);

        this.tweens.add({ targets: bossMarker, scale: { from: 1, to: 1.1 }, duration: 900, yoyo: true, repeat: -1 });

        // Show guardian on minimap
        this.minimap.setBossPosition(bossX, bossY);
      }
    }

    // ── Treasure Chest (persistent) ──
    this.spawnCaveChest(mapConfig, wallBodies);

    // ── Exit marker at top ──
    const exitX = Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2;
    const exitY = 1.5 * TILE_SIZE;
    this.add.text(exitX, exitY - 16, '▲ 洞窟出口', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#88ccff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.ui);

    // ── Entrance marker at bottom ──
    const entrX = Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2;
    const entrY = (mapConfig.height - 1.5) * TILE_SIZE;
    this.add.text(entrX, entrY + 16, '▼ 返回野外', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#ffcc44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.ui);

    // Dark ambient overlay (cave is dim)
    const ambientOverlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.15
    ).setScrollFactor(0).setDepth(DEPTH.ui - 5);

    // Header
    const lvRange = region.levelRange;
    if (this.textures.exists('ui_header_bar')) {
      this.add.image(GAME_WIDTH / 2, 16, 'ui_header_bar')
        .setScrollFactor(0).setDepth(DEPTH.ui);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, 16, GAME_WIDTH, 32, 0x000000, 0.6)
        .setScrollFactor(0).setDepth(DEPTH.ui);
    }
    this.add.text(GAME_WIDTH / 2, 16, t('cave.header', region.name, lvRange[0], lvRange[1]), {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ccaa77',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.ui + 1);


    // Keys
    this.interactKey = this.input.keyboard?.addKey('Z');
    this.spaceKey = this.input.keyboard?.addKey('SPACE');
    this.enterKey = this.input.keyboard?.addKey('ENTER');
    this.input.keyboard?.on('keydown-Q', () => { if (!this.inDialogue) this.exitToField('entrance'); });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.inDialogue) { this.dismissDialogue(); }
      else { this.openMenu(); }
    });
    this.input.keyboard?.on('keydown-M', () => { if (!this.inDialogue) this.openMenu(); });

    TransitionEffect.fadeIn(this);
    audioManager.playBgm('field', this.regionId); // reuse field BGM
  }

  update(time: number, delta: number): void {
    if (this.inDialogue) {
      this.textBox.update(time, delta);
      if (Phaser.Input.Keyboard.JustDown(this.interactKey!) ||
          (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) ||
          (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey))) {
        this.dismissDialogue();
      }
      return;
    }

    this.player.update(time, delta);
    this.minimap.updatePlayerPosition(this.player.x, this.player.y, this.mapBounds.width, this.mapBounds.height);

    // Check chest interaction
    const justInteract = (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey))
      || (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey))
      || (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey));
    if (justInteract && this.time.now - this.dialogueCooldown > 300) {
      this.checkChestInteraction();
    }

    // Auto-trigger cave boss when close
    if (this.caveBossPos && this.caveBossData) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, this.caveBossPos.x, this.caveBossPos.y
      );
      if (dist < TILE_SIZE * 1.5) {
        this.triggerCaveBoss();
      }
    }

    // Exit: walk to north edge → return to field at exit position
    if (this.player.y <= TILE_SIZE * 1.5) {
      this.exitToField('exit');
    }

    // Return via entrance: walk to south edge
    if (this.player.y >= this.mapBounds.height - TILE_SIZE * 0.5) {
      this.exitToField('entrance');
    }
  }

  // ─── Cave Treasure Chest (Persistent) ───

  private spawnCaveChest(mapConfig: { width: number; height: number }, wallBodies: Phaser.Physics.Arcade.StaticGroup): void {
    if (!this.textures.exists('deco_chest')) {
      this.generateChestTexture();
    }
    if (!this.textures.exists('deco_chest_open')) {
      this.generateChestOpenTexture();
    }

    const flagKey = `cave_chest_${this.regionId}`;
    const alreadyOpened = gameState.getFlag(flagKey);

    // Place chest behind boss area (top-center, just above boss position)
    const gx = Math.floor(mapConfig.width / 2);
    const gy = 4;
    const px = gx * TILE_SIZE + TILE_SIZE / 2;
    const py = gy * TILE_SIZE + TILE_SIZE / 2;

    const textureKey = alreadyOpened ? 'deco_chest_open' : 'deco_chest';
    const sprite = this.add.sprite(px, py, textureKey)
      .setDepth(DEPTH.objects + 1).setScale(0.6);

    // Glow effect on unopened chest
    if (!alreadyOpened) {
      const glow = this.add.circle(px, py, TILE_SIZE * 0.8, 0xffdd44, 0.08)
        .setDepth(DEPTH.objects);
      this.tweens.add({
        targets: glow, alpha: { from: 0.08, to: 0.2 },
        duration: 1200, yoyo: true, repeat: -1,
      });
    }

    const chestBody = this.add.rectangle(px, py, TILE_SIZE / 2 - 4, TILE_SIZE / 2 - 4);
    this.physics.add.existing(chestBody, true);
    wallBodies.add(chestBody);
    chestBody.setVisible(false);

    this.chest = { sprite, gx, gy, flagKey, opened: alreadyOpened, collisionBody: chestBody };
  }

  private checkChestInteraction(): void {
    if (!this.chest) return;
    const playerPos = this.player.getGridPosition();
    const dist = Math.abs(playerPos.gx - this.chest.gx) + Math.abs(playerPos.gy - this.chest.gy);
    if (dist > 2) return;

    if (this.chest.opened) {
      // Already opened — show message
      this.inDialogue = true;
      this.textBox.show('', t('cave.treasure_already'));
      audioManager.playSfx('cancel');
      return;
    }

    // Check if boss is still alive — chest is guarded
    if (!this.bossDefeated) {
      this.inDialogue = true;
      this.textBox.show('', t('cave.chest_guarded'));
      audioManager.playSfx('fail');
      return;
    }

    // Open the chest!
    this.openCaveChest();
  }

  private openCaveChest(): void {
    if (!this.chest || this.chest.opened) return;

    this.chest.opened = true;
    this.chest.sprite.setTexture('deco_chest_open');
    gameState.setFlag(this.chest.flagKey, true);
    audioManager.playSfx('select');

    this.inDialogue = true;

    // Cave treasure is always high-value
    const region = getRegionById(this.regionId);
    const baseLevel = region?.levelRange[0] ?? 1;
    const roll = Math.random();

    if (roll < 0.5) {
      // Rare equipment — 1 tier above current region
      const allEquip = getAllEquipments();
      const tiers = ['wood', 'iron', 'steel', 'silver', 'mithril', 'dragon', 'holy', 'legendary'];
      const tierIndex = Math.min(tiers.length - 1, Math.floor(baseLevel / 8) + 1); // +1 tier above
      const validTiers = tiers.slice(Math.max(0, tierIndex - 1), Math.min(tiers.length, tierIndex + 1));
      const candidates = allEquip.filter(e => validTiers.includes(e.tier));
      const equip = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : allEquip[Math.floor(Math.random() * allEquip.length)];
      gameState.addItem(equip.id);
      this.textBox.show('', `${t('cave.treasure_found')}\n${t('chest.equipment', equip.name)}`);
    } else if (roll < 0.8) {
      // Rare consumable
      const rareItems = ['item_elixir', 'item_potion_l', 'item_ether_m'];
      const itemId = rareItems[Math.floor(Math.random() * rareItems.length)];
      gameState.addItem(itemId);
      const consumables = getAllConsumables();
      const item = consumables.find(c => c.id === itemId);
      this.textBox.show('', `${t('cave.treasure_found')}\n${t('chest.item', item?.name ?? itemId)}`);
    } else {
      // Large gold pile
      const goldAmount = Math.floor(100 + baseLevel * 20 + Math.random() * baseLevel * 10);
      gameState.addGold(goldAmount);
      this.textBox.show('', `${t('cave.treasure_found')}\n${t('chest.gold', goldAmount)}`);
    }
  }

  private dismissDialogue(): void {
    this.inDialogue = false;
    this.dialogueCooldown = this.time.now;
    this.textBox.hide();
  }

  // ─── Cave Boss ───

  private triggerCaveBoss(): void {
    if (!this.caveBossData) return;
    const boss = structuredClone(this.caveBossData);
    this.caveBossData = undefined; // prevent re-trigger
    this.caveBossPos = undefined;

    audioManager.playSfx('hit');
    TransitionEffect.transition(this, 'BattleScene', {
      monsters: [boss],
      regionId: this.regionId,
      isBoss: false, // cave boss doesn't liberate region
      skipIntro: false,
      battleBgKey: `battle_bg_cave_${this.regionId}`,
      returnScene: 'CaveScene',
      returnData: {
        regionId: this.regionId,
        playerX: this.player.x,
        playerY: this.player.y,
        fieldReturnX: this.fieldReturnX,
        fieldReturnY: this.fieldReturnY,
      },
      onVictory: () => {
        gameState.setFlag(`cave_boss_${this.regionId}_defeated`, true);
      },
    });
  }

  // ─── Encounters & Navigation ───

  private triggerEncounter(): void {
    const table = getCaveEncounterTable(this.regionId);
    if (!table) return;
    const monsters = EncounterSystem.generateEncounter(table);
    if (monsters.length === 0) return;

    audioManager.playSfx('hit');
    TransitionEffect.transition(this, 'BattleScene', {
      monsters,
      regionId: this.regionId,
      battleBgKey: `battle_bg_cave_${this.regionId}`,
      returnScene: 'CaveScene',
      returnData: {
        regionId: this.regionId,
        playerX: this.player.x,
        playerY: this.player.y,
        fieldReturnX: this.fieldReturnX,
        fieldReturnY: this.fieldReturnY,
      },
    });
  }

  private exitToField(via: 'entrance' | 'exit'): void {
    if (via === 'exit') {
      // Exit at north → return to field at exit position (different from entrance)
      TransitionEffect.transition(this, 'FieldScene', {
        regionId: this.regionId,
        playerX: this.fieldReturnX,
        playerY: this.fieldReturnY,
      });
    } else {
      // Retreat via entrance → return to field at entrance position
      TransitionEffect.transition(this, 'FieldScene', {
        regionId: this.regionId,
        // No specific position — field will use default spawn (bottom center)
      });
    }
  }

  private openMenu(): void {
    this.scene.launch('MenuScene');
    this.scene.pause();
  }

  // ─── Chest textures (reused from FieldScene pattern) ───

  private generateChestTexture(): void {
    const S = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let py = S - 5; py < S; py++) {
      const w = Math.round((S - 12) * (1 - (py - (S - 5)) / 5 * 0.3));
      ctx.fillRect(S / 2 - w / 2, py, w, 1);
    }
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
    ctx.fillStyle = '#A0714F';
    ctx.fillRect(3, Math.round(S * 0.25), S - 6, Math.round(S * 0.13));
    ctx.fillStyle = '#B88060';
    ctx.fillRect(4, Math.round(S * 0.25), S - 8, 2);
    ctx.fillStyle = '#C8A82E';
    ctx.fillRect(4, Math.round(S * 0.38), S - 8, 2);
    ctx.fillRect(4, Math.round(S * 0.58), S - 8, 2);
    ctx.fillStyle = '#B89828';
    ctx.fillRect(S / 2 - 3, Math.round(S * 0.40), 6, 9);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(S / 2 - 2, Math.round(S * 0.41), 4, 7);
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(S / 2 - 1, Math.round(S * 0.44), 2, 3);
    this.textures.addCanvas('deco_chest', canvas);
  }

  private generateChestOpenTexture(): void {
    const S = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let py = S - 5; py < S; py++) {
      const w = Math.round((S - 12) * (1 - (py - (S - 5)) / 5 * 0.3));
      ctx.fillRect(S / 2 - w / 2, py, w, 1);
    }
    ctx.fillStyle = '#A0714F';
    ctx.fillRect(3, Math.round(S * 0.15), S - 6, Math.round(S * 0.10));
    ctx.fillStyle = '#8a6040';
    ctx.fillRect(4, Math.round(S * 0.24), S - 8, Math.round(S * 0.10));
    for (let y = Math.round(S * 0.38); y < Math.round(S * 0.82); y++) {
      for (let x = 4; x < S - 4; x++) {
        const grain = ((x * 7 + y * 3) % 5 === 0) ? -12 : 0;
        ctx.fillStyle = `rgb(${0x8B + grain},${0x5E + grain},${0x3C + grain})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = '#2a1808';
    ctx.fillRect(6, Math.round(S * 0.42), S - 12, Math.round(S * 0.22));
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(S / 2 - 1, Math.round(S * 0.50), 2, 2);
    this.textures.addCanvas('deco_chest_open', canvas);
  }
}
