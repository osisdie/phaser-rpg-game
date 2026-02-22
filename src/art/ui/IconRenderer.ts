import Phaser from 'phaser';
import { MEDIEVAL, darken, lighten } from '../palettes';
import { ArtRegistry } from '../index';

const ICON_SIZE = 16;

/** Generates small 16×16 pixel art icons for items, skills, NPC markers, etc. */
export class IconRenderer {

  static generateAll(scene: Phaser.Scene): void {
    // Battle menu icons
    this.generateSwordIcon(scene, 'icon_sword');
    this.generateStarIcon(scene, 'icon_star');
    this.generateBagIcon(scene, 'icon_bag');
    this.generateShieldIcon(scene, 'icon_shield');
    this.generateBootIcon(scene, 'icon_boot');

    // Item icons
    this.generatePotionIcon(scene, 'icon_potion_hp', '#cc3344');
    this.generatePotionIcon(scene, 'icon_potion_mp', '#3344cc');
    this.generatePotionIcon(scene, 'icon_elixir', '#ccaa33');

    // NPC type markers
    this.generateMarker(scene, 'icon_npc_quest', '#ffcc00', '!');
    this.generateMarker(scene, 'icon_npc_shop', '#88ff88', '$');
    this.generateMarker(scene, 'icon_npc_save', '#8888ff', 'S');
    this.generateMarker(scene, 'icon_npc_info', '#cccccc', '?');

    // Status icons
    this.generateHeartIcon(scene, 'icon_heart');
    this.generateCoinIcon(scene, 'icon_coin');
  }

  private static generateSwordIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);

    // Blade (diagonal)
    ctx.fillStyle = MEDIEVAL.ironLight;
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(3 + i, 10 - i, 2, 2);
    }
    // Guard
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(3, 10, 5, 2);
    // Handle
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(2, 12, 2, 3);
    // Blade highlight
    ctx.fillStyle = '#cccccc';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(5 + i, 8 - i, 1, 1);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateStarIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);

    ctx.fillStyle = MEDIEVAL.goldBright;
    // Center
    ctx.fillRect(6, 4, 4, 8);
    ctx.fillRect(3, 6, 10, 4);
    // Points
    ctx.fillRect(7, 2, 2, 2);
    ctx.fillRect(7, 12, 2, 2);
    ctx.fillRect(1, 7, 2, 2);
    ctx.fillRect(13, 7, 2, 2);
    // Inner glow
    ctx.fillStyle = MEDIEVAL.goldLight;
    ctx.fillRect(7, 6, 2, 4);
    ctx.fillRect(5, 7, 6, 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateBagIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);

    // Bag body
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(3, 5, 10, 9);
    ctx.fillRect(4, 4, 8, 1);
    ctx.fillRect(4, 14, 8, 1);
    // Drawstring opening
    ctx.fillStyle = MEDIEVAL.woodDark;
    ctx.fillRect(4, 4, 8, 2);
    // Tie
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(6, 2, 4, 2);
    ctx.fillRect(7, 1, 2, 1);
    // Highlight
    ctx.fillStyle = MEDIEVAL.woodLight;
    ctx.fillRect(4, 6, 1, 7);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateShieldIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);

    // Shield shape
    ctx.fillStyle = MEDIEVAL.ironMedium;
    ctx.fillRect(3, 2, 10, 8);
    ctx.fillRect(4, 10, 8, 2);
    ctx.fillRect(5, 12, 6, 1);
    ctx.fillRect(6, 13, 4, 1);
    ctx.fillRect(7, 14, 2, 1);
    // Cross design
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(7, 3, 2, 10);
    ctx.fillRect(4, 5, 8, 2);
    // Highlight
    ctx.fillStyle = MEDIEVAL.ironLight;
    ctx.fillRect(3, 2, 10, 1);
    ctx.fillRect(3, 2, 1, 8);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateBootIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);

    // Boot
    ctx.fillStyle = MEDIEVAL.woodDark;
    ctx.fillRect(5, 3, 4, 8);
    ctx.fillRect(4, 11, 8, 3);
    ctx.fillRect(3, 13, 10, 1);
    // Highlight
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(6, 3, 2, 7);
    // Sole
    ctx.fillStyle = '#333333';
    ctx.fillRect(3, 14, 10, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generatePotionIcon(scene: Phaser.Scene, key: string, liquidColor: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);

    // Bottle neck
    ctx.fillStyle = '#aabbcc';
    ctx.fillRect(6, 2, 4, 3);
    // Cork
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(6, 1, 4, 2);
    // Bottle body
    ctx.fillStyle = '#8899aa';
    ctx.fillRect(4, 5, 8, 8);
    ctx.fillRect(5, 13, 6, 1);
    // Liquid
    ctx.fillStyle = liquidColor;
    ctx.fillRect(5, 7, 6, 5);
    // Highlight
    ctx.fillStyle = lighten(liquidColor, 0.3);
    ctx.fillRect(5, 7, 1, 3);
    // Glass shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(10, 6, 1, 4);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateMarker(scene: Phaser.Scene, key: string, color: string, _symbol: string): void {
    if (scene.textures.exists(key)) return;
    const S = 10;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    // Circle background
    ctx.fillStyle = color;
    ctx.fillRect(2, 1, 6, 8);
    ctx.fillRect(1, 2, 8, 6);
    // Darker border
    ctx.fillStyle = darken(color, 0.3);
    ctx.fillRect(2, 0, 6, 1);
    ctx.fillRect(2, 9, 6, 1);
    ctx.fillRect(0, 2, 1, 6);
    ctx.fillRect(9, 2, 1, 6);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateHeartIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);

    ctx.fillStyle = '#cc2244';
    // Heart shape
    ctx.fillRect(2, 4, 5, 4);
    ctx.fillRect(9, 4, 5, 4);
    ctx.fillRect(1, 5, 14, 4);
    ctx.fillRect(2, 9, 12, 2);
    ctx.fillRect(3, 11, 10, 1);
    ctx.fillRect(4, 12, 8, 1);
    ctx.fillRect(5, 13, 6, 1);
    ctx.fillRect(6, 14, 4, 1);
    ctx.fillRect(7, 15, 2, 1);
    // Highlight
    ctx.fillStyle = '#ee4466';
    ctx.fillRect(3, 5, 3, 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateCoinIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);

    // Coin body
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(4, 2, 8, 12);
    ctx.fillRect(3, 3, 10, 10);
    ctx.fillRect(2, 4, 12, 8);
    // Inner ring
    ctx.fillStyle = MEDIEVAL.goldDark;
    ctx.fillRect(5, 4, 6, 1);
    ctx.fillRect(5, 11, 6, 1);
    ctx.fillRect(4, 5, 1, 6);
    ctx.fillRect(11, 5, 1, 6);
    // Highlight
    ctx.fillStyle = MEDIEVAL.goldLight;
    ctx.fillRect(5, 3, 4, 1);
    ctx.fillRect(3, 5, 1, 4);
    // Center symbol
    ctx.fillStyle = MEDIEVAL.goldDark;
    ctx.fillRect(7, 6, 2, 4);
    ctx.fillRect(6, 7, 4, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }
}
