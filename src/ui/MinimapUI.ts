import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';

/** Simple minimap overlay showing player position with parchment style */
export class MinimapUI extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private playerDot: Phaser.GameObjects.Arc;
  private mapWidth = 120;
  private mapHeight = 90;

  constructor(scene: Phaser.Scene, worldWidth: number, worldHeight: number) {
    super(scene, GAME_WIDTH - 140, 50);
    scene.add.existing(this);
    this.setDepth(DEPTH.ui);

    // Use parchment-style minimap background
    if (scene.textures.exists('ui_panel_hud')) {
      this.bg = scene.add.image(0, 0, 'ui_panel_hud')
        .setDisplaySize(this.mapWidth, this.mapHeight);
    } else {
      this.bg = scene.add.rectangle(0, 0, this.mapWidth, this.mapHeight, 0x000000, 0.5);
      (this.bg as Phaser.GameObjects.Rectangle).setStrokeStyle(1, COLORS.panelBorder);
    }

    this.playerDot = scene.add.circle(0, 0, 3, 0x4488ff);
    this.add([this.bg, this.playerDot]);
  }

  updatePlayerPosition(playerX: number, playerY: number, worldWidth: number, worldHeight: number): void {
    const relX = (playerX / worldWidth) * this.mapWidth - this.mapWidth / 2;
    const relY = (playerY / worldHeight) * this.mapHeight - this.mapHeight / 2;
    this.playerDot.setPosition(relX, relY);
  }
}
