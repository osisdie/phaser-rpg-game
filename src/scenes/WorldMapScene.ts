import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { buildWorldMapNodes, getWorldConnections } from '../maps/WorldMapData';
import type { WorldNode } from '../maps/WorldMapData';
import { TransitionEffect } from '../ui/TransitionEffect';
import { ProgressUI } from '../ui/ProgressUI';
import { audioManager } from '../systems/AudioManager';
import { getNodeIconKey } from '../art/worldmap/WorldMapRenderer';

export class WorldMapScene extends Phaser.Scene {
  private nodes: WorldNode[] = [];
  private nodeSprites: Phaser.GameObjects.Container[] = [];
  private selectedIndex = 0;
  private cursor!: Phaser.GameObjects.Triangle;
  private infoText!: Phaser.GameObjects.Text;
  private progressUI!: ProgressUI;

  constructor() {
    super('WorldMapScene');
  }

  create(): void {
    // Reset state on re-entry
    this.nodeSprites = [];
    this.selectedIndex = 0;

    gameState.setCurrentScene('WorldMapScene');

    // Parchment background
    if (this.textures.exists('worldmap_bg')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'worldmap_bg');
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a2a1a);
    }

    // Title
    this.add.text(GAME_WIDTH / 2, 20, t('world.title'), {
      fontFamily: FONT_FAMILY, fontSize: '20px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0);

    // Build nodes
    this.nodes = buildWorldMapNodes();
    const connections = getWorldConnections();

    // Draw connections — aged ink style on parchment
    const graphics = this.add.graphics();
    for (const conn of connections) {
      const from = this.nodes.find(n => n.region.id === conn.from.id);
      const to = this.nodes.find(n => n.region.id === conn.to.id);
      if (from && to) {
        // Dashed road-style line
        graphics.lineStyle(3, 0x8a7a5a, 0.6);
        graphics.lineBetween(from.screenX, from.screenY, to.screenX, to.screenY);
        graphics.lineStyle(1, 0x6a5a3a, 0.4);
        graphics.lineBetween(from.screenX + 1, from.screenY + 1, to.screenX + 1, to.screenY + 1);
      }
    }

    // Draw nodes
    this.nodes.forEach((node, i) => {
      const container = this.add.container(node.screenX, node.screenY);
      const alpha = node.accessible ? 1 : 0.3;

      // Region node icon (replaces plain circle)
      const iconKey = getNodeIconKey(node.region.id);
      let nodeVisual: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;

      if (this.textures.exists(iconKey)) {
        nodeVisual = this.add.image(0, 0, iconKey).setAlpha(alpha);
        if (node.liberated) {
          nodeVisual.setTint(0x88ff88);
        } else if (!node.visited) {
          nodeVisual.setTint(0x888888);
        }
      } else {
        // Fallback to circle
        const size = node.region.type === 'final' ? 20 : node.region.type === 'side' ? 12 : 16;
        const color = node.liberated ? 0x44ff44 : node.visited ? node.region.color : 0x666666;
        nodeVisual = this.add.circle(0, 0, size, color, alpha);
        if (node.liberated) {
          (nodeVisual as Phaser.GameObjects.Arc).setStrokeStyle(2, 0xffffff);
        }
      }

      // Label — larger font with strong stroke for readability
      const label = this.add.text(0, 26, node.region.name, {
        fontFamily: FONT_FAMILY, fontSize: '15px', color: node.accessible ? '#ffffff' : '#888888',
        stroke: '#000000', strokeThickness: 4,
        shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true },
      }).setOrigin(0.5, 0);

      // Level range
      const levelText = this.add.text(0, 44, `Lv.${node.region.levelRange[0]}-${node.region.levelRange[1]}`, {
        fontFamily: FONT_FAMILY, fontSize: '13px', color: '#ddddaa',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 0);

      // Status indicator
      let statusText = '';
      if (node.liberated) statusText = t('world.liberated');
      else if (node.visited) statusText = t('world.occupied');
      else if (!node.accessible) statusText = t('world.unexplored');

      const status = this.add.text(0, -28, statusText, {
        fontFamily: FONT_FAMILY, fontSize: '12px',
        color: node.liberated ? '#44ff44' : '#ffaa44',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1);

      container.add([nodeVisual, label, levelText, status]);

      // Interactivity — set on the node visual
      nodeVisual.setInteractive({ useHandCursor: node.accessible });
      nodeVisual.on('pointerdown', () => {
        if (node.accessible) {
          this.selectedIndex = i;
          this.updateCursor();
          this.enterRegion();
        }
      });
      nodeVisual.on('pointerover', () => {
        if (node.accessible) {
          this.selectedIndex = i;
          this.updateCursor();
        }
      });

      this.nodeSprites.push(container);
    });

    // Cursor
    this.cursor = this.add.triangle(0, 0, 0, 0, 10, -16, 20, 0, COLORS.gold);
    this.cursor.setOrigin(0.5, 0);

    // Info text with background for readability
    this.infoText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 65, '', {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: '#ffffff',
      wordWrap: { width: 600 }, align: 'center',
      stroke: '#000000', strokeThickness: 4,
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 3, fill: true },
    }).setOrigin(0.5);

    // Progress
    this.progressUI = new ProgressUI(this, 16, GAME_HEIGHT - 30);
    this.progressUI.refresh();

    // Controls hint — strong stroke so it's visible on any background
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, '方向鍵選擇 | Enter 進入 | M 選單', {
      fontFamily: FONT_FAMILY, fontSize: '13px', color: '#ddddcc',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Keyboard
    this.input.keyboard?.on('keydown-LEFT', () => this.navigate(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.navigate(1));
    this.input.keyboard?.on('keydown-UP', () => this.navigate(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.navigate(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.enterRegion());
    this.input.keyboard?.on('keydown-SPACE', () => this.enterRegion());
    this.input.keyboard?.on('keydown-M', () => this.openMenu());
    this.input.keyboard?.on('keydown-ESC', () => this.openMenu());

    // Find initial selection (current region)
    const currentIdx = this.nodes.findIndex(n => n.region.id === gameState.getState().currentRegion);
    if (currentIdx >= 0) this.selectedIndex = currentIdx;

    this.updateCursor();
    TransitionEffect.fadeIn(this);
    audioManager.playBgm('field');
  }

  private navigate(dir: number): void {
    const accessible = this.nodes.map((n, i) => ({ n, i })).filter(x => x.n.accessible);
    if (accessible.length === 0) return;

    const currentAccessibleIdx = accessible.findIndex(x => x.i === this.selectedIndex);
    const nextIdx = (currentAccessibleIdx + dir + accessible.length) % accessible.length;
    this.selectedIndex = accessible[nextIdx].i;
    this.updateCursor();
    audioManager.playSfx('select');
  }

  private updateCursor(): void {
    const node = this.nodes[this.selectedIndex];
    if (!node) return;
    this.cursor.setPosition(node.screenX, node.screenY - 30);

    const desc = node.region.description;
    this.infoText.setText(`${node.region.name}\n${desc}\n${t('world.press_enter')}`);
  }

  private enterRegion(): void {
    const node = this.nodes[this.selectedIndex];
    if (!node?.accessible) return;

    gameState.setCurrentRegion(node.region.id);
    audioManager.playSfx('select');

    // Enter town first, then player can go to field
    TransitionEffect.transition(this, 'TownScene', { regionId: node.region.id });
  }

  private openMenu(): void {
    this.scene.launch('MenuScene');
    this.scene.pause();
  }
}
