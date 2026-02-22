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
import { TextBox } from '../ui/TextBox';
import { TransitionEffect } from '../ui/TransitionEffect';
import { audioManager } from '../systems/AudioManager';
import { getNPCTextureKey } from '../art/characters/NPCProfiles';
import { BattleEffects } from '../art/effects/BattleEffects';
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

export class TownScene extends Phaser.Scene {
  private player!: Player;
  private textBox!: TextBox;
  private dialogueSystem = new DialogueSystem();
  private npcSprites: NPCSpriteEntry[] = [];
  private regionId = '';
  private interactKey?: Phaser.Input.Keyboard.Key;
  private inDialogue = false;
  private mapBounds = { width: 0, height: 0 };

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

    // Create map
    const mapConfig = MapFactory.getTownConfig(this.regionId, region.color);
    const { wallBodies, bounds } = MapFactory.createMap(this, mapConfig);
    this.mapBounds = bounds;

    // Set world bounds
    this.physics.world.setBounds(0, 0, bounds.width, bounds.height);

    // Player
    this.player = new Player(this,
      Math.floor(mapConfig.width / 2) * TILE_SIZE + TILE_SIZE / 2,
      (mapConfig.height - 3) * TILE_SIZE + TILE_SIZE / 2,
    );
    this.physics.add.collider(this.player, wallBodies);

    // Camera
    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

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
      const label = this.add.text(px, py - 20, npc.name, {
        fontFamily: FONT_FAMILY, fontSize: '10px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(DEPTH.characters + 1);

      // Type marker icon
      let marker: Phaser.GameObjects.Image | undefined;
      const markerKey = `icon_npc_${npc.type}`;
      if (this.textures.exists(markerKey)) {
        marker = this.add.image(px, py - 26, markerKey)
          .setDepth(DEPTH.characters + 2);
      }

      this.npcSprites.push({
        sprite, data: npc, label, marker,
        homeX: px, homeY: py,
        wanderTimer: 500 + Math.random() * 1500, // stagger initial timers
        wanderDirX: 0, wanderDirY: 0,
      });
    }

    // UI
    this.textBox = new TextBox(this);

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
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 12, 'WASD移動 | Z互動 | F野外 | ESC選單 | Q世界地圖', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#ddddcc',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.ui + 1);

    // Keys
    this.interactKey = this.input.keyboard?.addKey('Z');
    this.input.keyboard?.on('keydown-F', () => this.goToField());
    this.input.keyboard?.on('keydown-Q', () => this.goToWorldMap());
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.inDialogue) { this.endDialogue(); }
      else { this.openMenu(); }
    });
    this.input.keyboard?.on('keydown-M', () => { if (!this.inDialogue) this.openMenu(); });

    // Environment particles
    BattleEffects.spawnEnvironmentParticles(this, this.regionId, bounds);

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

    // Check NPC interaction
    if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.checkNPCInteraction();
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
      entry.label.setPosition(entry.sprite.x, entry.sprite.y - 20);
      if (entry.marker) {
        entry.marker.setPosition(entry.sprite.x, entry.sprite.y - 26);
      }
    }
  }

  private checkNPCInteraction(): void {
    const playerPos = this.player.getGridPosition();
    for (const { sprite, data } of this.npcSprites) {
      const npcGx = Math.floor(sprite.x / TILE_SIZE);
      const npcGy = Math.floor(sprite.y / TILE_SIZE);
      const dist = Math.abs(playerPos.gx - npcGx) + Math.abs(playerPos.gy - npcGy);
      if (dist <= 2) {
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
      audioManager.playSfx('select');
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
        const next = this.dialogueSystem.advance(index);
        if (next) {
          this.textBox.show(next.speaker, next.text);
          this.checkDialogueFlags();
        } else {
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
      const innCost = 30;
      if (gameState.spendGold(innCost)) {
        // Full heal all party members
        const party = gameState.getParty();
        for (const member of party) {
          member.stats.hp = member.stats.maxHP;
          member.stats.mp = member.stats.maxMP;
        }
        audioManager.playSfx('heal');
      } else {
        // Not enough gold — show "no gold" dialogue
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
