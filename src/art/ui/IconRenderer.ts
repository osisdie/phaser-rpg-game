import Phaser from 'phaser';
import { MEDIEVAL, darken, lighten } from '../palettes';
import { ArtRegistry } from '../index';

const ICON_SIZE = 32;
const DS = 16; // design space (pixel art coordinates authored at this size)

/** Generates small 16×16 pixel art icons for items, skills, NPC markers, etc. */
export class IconRenderer {

  static generateAll(scene: Phaser.Scene): void {
    // Battle menu icons
    this.generateSwordIcon(scene, 'icon_sword');
    this.generateStarIcon(scene, 'icon_star');
    this.generateBagIcon(scene, 'icon_bag');
    this.generateShieldIcon(scene, 'icon_shield');
    this.generateBootIcon(scene, 'icon_boot');

    // Equipment slot icons
    this.generateHelmetIcon(scene, 'icon_helmet');
    this.generateArmorIcon(scene, 'icon_armor');

    // Item icons
    this.generatePotionIcon(scene, 'icon_potion_hp', '#cc3344');
    this.generatePotionIcon(scene, 'icon_potion_mp', '#3344cc');
    this.generatePotionIcon(scene, 'icon_elixir', '#ccaa33');
    this.generateScrollIcon(scene, 'icon_scroll');
    this.generateHerbIcon(scene, 'icon_herb');
    this.generateGemIcon(scene, 'icon_gem');

    // Skill element icons
    this.generateElementIcon(scene, 'icon_fire', '#ff4422', '#ffaa44');
    this.generateElementIcon(scene, 'icon_ice', '#44aaff', '#aaddff');
    this.generateElementIcon(scene, 'icon_lightning', '#ffdd22', '#ffffaa');
    this.generateHealIcon(scene, 'icon_heal');
    this.generateBuffIcon(scene, 'icon_buff');

    // NPC type markers
    this.generateMarker(scene, 'icon_npc_quest', '#ffcc00', '!');
    this.generateMarker(scene, 'icon_npc_shop', '#88ff88', '$');
    this.generateMarker(scene, 'icon_npc_save', '#8888ff', 'S');
    this.generateMarker(scene, 'icon_npc_info', '#cccccc', '?');

    // Status icons
    this.generateHeartIcon(scene, 'icon_heart');
    this.generateCoinIcon(scene, 'icon_coin');
    this.generateGoldStackIcon(scene, 'icon_gold_stack');
  }

  private static generateSwordIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

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
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

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
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

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
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

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
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

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
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

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
    const S = 20;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    ctx.scale(2, 2);

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
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

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

  private static generateHelmetIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

    ctx.fillStyle = MEDIEVAL.ironMedium;
    // Dome
    ctx.fillRect(4, 2, 8, 4);
    ctx.fillRect(3, 4, 10, 4);
    ctx.fillRect(2, 6, 12, 3);
    // Visor
    ctx.fillStyle = MEDIEVAL.ironDark;
    ctx.fillRect(3, 9, 10, 2);
    ctx.fillRect(5, 11, 6, 1);
    // Eye slit
    ctx.fillStyle = '#111111';
    ctx.fillRect(4, 9, 3, 1);
    ctx.fillRect(9, 9, 3, 1);
    // Crest
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(7, 1, 2, 3);
    // Highlight
    ctx.fillStyle = MEDIEVAL.ironLight;
    ctx.fillRect(5, 3, 3, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateArmorIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

    // Body plate
    ctx.fillStyle = MEDIEVAL.ironMedium;
    ctx.fillRect(3, 3, 10, 10);
    ctx.fillRect(4, 2, 8, 1);
    ctx.fillRect(4, 13, 8, 1);
    // Shoulder plates
    ctx.fillRect(1, 3, 3, 3);
    ctx.fillRect(12, 3, 3, 3);
    // Chest detail
    ctx.fillStyle = MEDIEVAL.ironLight;
    ctx.fillRect(7, 4, 2, 8);
    ctx.fillRect(4, 6, 8, 1);
    // Gold trim
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(4, 2, 8, 1);
    ctx.fillRect(4, 13, 8, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateScrollIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

    // Scroll body
    ctx.fillStyle = MEDIEVAL.parchment;
    ctx.fillRect(4, 3, 8, 10);
    // Top roll
    ctx.fillStyle = MEDIEVAL.parchmentDark;
    ctx.fillRect(3, 2, 10, 2);
    // Bottom roll
    ctx.fillRect(3, 12, 10, 2);
    // Text lines
    ctx.fillStyle = '#665544';
    ctx.fillRect(6, 5, 4, 1);
    ctx.fillRect(6, 7, 5, 1);
    ctx.fillRect(6, 9, 3, 1);
    // Seal
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(5, 10, 2, 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateHerbIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

    // Stem
    ctx.fillStyle = '#3a7a2a';
    ctx.fillRect(7, 6, 2, 8);
    // Leaves
    ctx.fillStyle = '#4a9a3a';
    ctx.fillRect(4, 4, 4, 3);
    ctx.fillRect(8, 3, 4, 3);
    ctx.fillRect(5, 7, 3, 2);
    // Flower top
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(6, 2, 4, 3);
    ctx.fillStyle = '#ffdd66';
    ctx.fillRect(7, 1, 2, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateGemIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

    // Diamond shape
    ctx.fillStyle = '#44aacc';
    ctx.fillRect(6, 2, 4, 2);
    ctx.fillRect(4, 4, 8, 4);
    ctx.fillRect(5, 8, 6, 3);
    ctx.fillRect(6, 11, 4, 2);
    ctx.fillRect(7, 13, 2, 1);
    // Facet highlights
    ctx.fillStyle = '#88ddee';
    ctx.fillRect(6, 3, 2, 1);
    ctx.fillRect(5, 5, 2, 2);
    // Sparkle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(6, 4, 1, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateElementIcon(scene: Phaser.Scene, key: string, baseColor: string, lightColor: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

    // Flame/element shape
    ctx.fillStyle = baseColor;
    ctx.fillRect(6, 3, 4, 10);
    ctx.fillRect(5, 5, 6, 6);
    ctx.fillRect(4, 7, 8, 4);
    // Top flicker
    ctx.fillRect(7, 1, 2, 3);
    // Inner glow
    ctx.fillStyle = lightColor;
    ctx.fillRect(6, 5, 4, 5);
    ctx.fillRect(7, 3, 2, 3);
    // Core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7, 7, 2, 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateHealIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

    // Green cross
    ctx.fillStyle = '#44cc44';
    ctx.fillRect(6, 2, 4, 12);
    ctx.fillRect(2, 6, 12, 4);
    // Inner highlight
    ctx.fillStyle = '#88ff88';
    ctx.fillRect(7, 4, 2, 8);
    ctx.fillRect(4, 7, 8, 2);
    // Center glow
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7, 7, 2, 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateBuffIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

    // Upward arrow shape (buff/power up)
    ctx.fillStyle = '#ffaa22';
    ctx.fillRect(7, 2, 2, 12);
    // Arrowhead
    ctx.fillRect(5, 4, 6, 2);
    ctx.fillRect(6, 3, 4, 2);
    ctx.fillRect(7, 2, 2, 2);
    // Sparkle dots
    ctx.fillStyle = '#ffdd66';
    ctx.fillRect(3, 6, 2, 2);
    ctx.fillRect(11, 6, 2, 2);
    ctx.fillRect(5, 10, 1, 1);
    ctx.fillRect(10, 10, 1, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateCoinIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

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

  /** 3 stacked gold coins — elliptical coin shapes with 3D beveling */
  private static generateGoldStackIcon(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(ICON_SIZE, ICON_SIZE);
    ctx.scale(ICON_SIZE / DS, ICON_SIZE / DS);

    const drawCoin = (cx: number, cy: number, rx: number, ry: number, bright: boolean) => {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1.5, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      // Coin edge (darker ring)
      ctx.fillStyle = MEDIEVAL.goldDark;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      // Coin face (inner fill)
      ctx.fillStyle = bright ? MEDIEVAL.goldBright : MEDIEVAL.gold;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 0.3, rx - 1, ry - 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Inner ring detail
      ctx.strokeStyle = MEDIEVAL.goldDark;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 0.3, rx - 2.5, ry - 1.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Top highlight arc
      ctx.strokeStyle = MEDIEVAL.goldLight;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 0.5, rx - 1.5, ry - 1, 0, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    };

    // Bottom coin (offset left)
    drawCoin(6, 12, 5.5, 2.5, false);
    // Middle coin (offset right)
    drawCoin(9, 9, 5.5, 2.5, false);
    // Top coin (centered, brightest)
    drawCoin(7.5, 5.5, 5.5, 2.5, true);

    ArtRegistry.registerTexture(scene, key, canvas);
  }
}
