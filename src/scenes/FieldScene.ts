import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';
import { gameState } from '../systems/GameStateManager';
import { getRegionById } from '../data/regions/index';
import { getEncounterTable, getMonstersForRegion, getBossForRegion } from '../data/monsters/index';
import { EncounterSystem } from '../systems/EncounterSystem';
import { MapFactory } from '../maps/MapFactory';
import { Player } from '../entities/Player';
import { MinimapUI } from '../ui/MinimapUI';
import { TransitionEffect } from '../ui/TransitionEffect';
import { audioManager } from '../systems/AudioManager';
import { SaveLoadSystem } from '../systems/SaveLoadSystem';
import { BattleEffects } from '../art/effects/BattleEffects';
import { MonsterRenderer } from '../art/monsters/MonsterRenderer';

export class FieldScene extends Phaser.Scene {
  private player!: Player;
  private minimap!: MinimapUI;
  private regionId = '';
  private mapBounds = { width: 0, height: 0 };

  constructor() {
    super('FieldScene');
  }

  create(data: { regionId: string }): void {
    this.regionId = data.regionId || gameState.getState().currentRegion;
    const region = getRegionById(this.regionId);
    if (!region) { this.scene.start('WorldMapScene'); return; }

    gameState.setCurrentScene('FieldScene');
    EncounterSystem.initSteps();

    // Create field map
    const mapConfig = MapFactory.getFieldConfig(this.regionId, region.color);
    const { wallBodies, bounds } = MapFactory.createMap(this, mapConfig);
    this.mapBounds = bounds;

    // Physics bounds
    this.physics.world.setBounds(0, 0, bounds.width, bounds.height);

    // Player at center-bottom
    this.player = new Player(this,
      Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2,
      (mapConfig.height - 3) * TILE_SIZE + TILE_SIZE / 2
    );
    this.physics.add.collider(this.player, wallBodies);

    // Step counter → encounter check
    this.player.onStep(() => {
      const shouldEncounter = EncounterSystem.step();
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
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 12, 'WASD移動 | T城鎮 | B Boss戰 | ESC選單 | Q世界地圖', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#ddddcc',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.ui + 1);

    // Keys
    this.input.keyboard?.on('keydown-T', () => this.goToTown());
    this.input.keyboard?.on('keydown-Q', () => this.goToWorldMap());
    this.input.keyboard?.on('keydown-ESC', () => this.openMenu());
    this.input.keyboard?.on('keydown-M', () => this.openMenu());
    this.input.keyboard?.on('keydown-B', () => this.triggerBoss());

    // Boss marker on map
    const boss = getBossForRegion(this.regionId);
    if (boss && !gameState.isRegionLiberated(this.regionId)) {
      const bossX = Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2;
      const bossY = 3 * TILE_SIZE + TILE_SIZE / 2;

      // Generate boss texture and use it as marker
      const bossTexKey = MonsterRenderer.getTextureKey(boss.name, boss.id, true);
      MonsterRenderer.generateForMonster(this, bossTexKey, boss.name, boss.spriteColor, true);
      const bossMarker = this.add.image(bossX, bossY, bossTexKey).setDepth(DEPTH.characters);

      const bossLabel = this.add.text(bossX, bossY - TILE_SIZE, 'BOSS', {
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
    this.player.update(time, delta);
    this.minimap.updatePlayerPosition(this.player.x, this.player.y, this.mapBounds.width, this.mapBounds.height);
  }

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
      returnData: { regionId: this.regionId },
    });
  }

  private triggerBoss(): void {
    if (gameState.isRegionLiberated(this.regionId)) return;
    const boss = getBossForRegion(this.regionId);
    if (!boss) return;

    SaveLoadSystem.autoSave();
    TransitionEffect.transition(this, 'BattleScene', {
      monsters: [structuredClone(boss)],
      regionId: this.regionId,
      isBoss: true,
      returnScene: 'FieldScene',
      returnData: { regionId: this.regionId },
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
