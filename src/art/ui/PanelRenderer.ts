import Phaser from 'phaser';
import { GAME_WIDTH } from '../../config';
import { MEDIEVAL, darken, lighten, varyColor } from '../palettes';
import { ArtRegistry } from '../index';

/** Generates medieval-themed UI panel textures */
export class PanelRenderer {

  static generateAll(scene: Phaser.Scene): void {
    // Main dialogue panel (920×140)
    this.generatePanel(scene, 'ui_panel_dialogue', 920, 140);
    // Menu panel — matches MenuScene fallback rect (GAME_WIDTH-80 × GAME_HEIGHT-60)
    this.generatePanel(scene, 'ui_panel_menu', 944, 708);
    // Battle menu (150×170)
    this.generatePanel(scene, 'ui_panel_battle_menu', 180, 200);
    // Skill/item select (300×250)
    this.generatePanel(scene, 'ui_panel_select', 300, 250);
    // Small panel (200×200)
    this.generatePanel(scene, 'ui_panel_small', 200, 200);
    // Shop panel (840×560)
    this.generatePanel(scene, 'ui_panel_shop', 840, 560);
    // Header bar (full width × 32)
    this.generateHeaderBar(scene, 'ui_header_bar', GAME_WIDTH, 32);
    // HP bar frame
    this.generateBarFrame(scene, 'ui_bar_frame_hp', 200, 12);
    this.generateBarFrame(scene, 'ui_bar_frame_mp', 200, 8);
    // Button background
    this.generateButton(scene, 'ui_btn', 160, 40);
    // Name plate
    this.generateNamePlate(scene, 'ui_nameplate', 120, 24);
  }

  /** Generate a wood-framed parchment panel */
  private static generatePanel(scene: Phaser.Scene, key: string, w: number, h: number): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(w, h);
    const borderW = 10;

    // Parchment background
    for (let y = borderW; y < h - borderW; y++) {
      for (let x = borderW; x < w - borderW; x++) {
        ctx.fillStyle = varyColor(MEDIEVAL.parchmentDark, 4);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Subtle texture on parchment
    for (let i = 0; i < (w * h) / 200; i++) {
      const px = borderW + Math.floor(Math.random() * (w - borderW * 2));
      const py = borderW + Math.floor(Math.random() * (h - borderW * 2));
      ctx.fillStyle = varyColor(MEDIEVAL.parchment, 8);
      ctx.fillRect(px, py, 2, 1);
    }

    // Wood frame — top
    for (let y = 0; y < borderW; y++) {
      ctx.fillStyle = varyColor(MEDIEVAL.woodMedium, 3);
      ctx.fillRect(0, y, w, 1);
    }
    // Bottom
    for (let y = h - borderW; y < h; y++) {
      ctx.fillStyle = varyColor(MEDIEVAL.woodDark, 3);
      ctx.fillRect(0, y, w, 1);
    }
    // Left
    for (let x = 0; x < borderW; x++) {
      ctx.fillStyle = varyColor(MEDIEVAL.woodMedium, 3);
      ctx.fillRect(x, 0, 1, h);
    }
    // Right
    for (let x = w - borderW; x < w; x++) {
      ctx.fillStyle = varyColor(MEDIEVAL.woodDark, 3);
      ctx.fillRect(x, 0, 1, h);
    }

    // Inner highlight edge
    ctx.fillStyle = lighten(MEDIEVAL.woodLight, 0.1);
    ctx.fillRect(borderW, borderW, w - borderW * 2, 1);
    ctx.fillRect(borderW, borderW, 1, h - borderW * 2);

    // Inner shadow edge
    ctx.fillStyle = darken(MEDIEVAL.woodDark, 0.1);
    ctx.fillRect(borderW, h - borderW - 1, w - borderW * 2, 1);
    ctx.fillRect(w - borderW - 1, borderW, 1, h - borderW * 2);

    // Corner decorations (gold rivets)
    const corners = [
      [5, 5], [w - 8, 5], [5, h - 8], [w - 8, h - 8],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(cx, cy, 3, 3);
      ctx.fillStyle = MEDIEVAL.goldLight;
      ctx.fillRect(cx, cy, 1, 1);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a header bar (semi-transparent dark parchment) */
  private static generateHeaderBar(scene: Phaser.Scene, key: string, w: number, h: number): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(w, h);

    ctx.globalAlpha = 0.85;
    for (let y = 0; y < h; y++) {
      ctx.fillStyle = varyColor(MEDIEVAL.panelBg, 3);
      ctx.fillRect(0, y, w, 1);
    }
    ctx.globalAlpha = 1;

    // Gold border bottom
    ctx.fillStyle = MEDIEVAL.goldDark;
    ctx.fillRect(0, h - 2, w, 1);
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(0, h - 1, w, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a metallic bar frame for HP/MP bars */
  private static generateBarFrame(scene: Phaser.Scene, key: string, w: number, h: number): void {
    if (scene.textures.exists(key)) return;
    const fw = w + 4;
    const fh = h + 4;
    const { canvas, ctx } = ArtRegistry.createCanvas(fw, fh);

    // Metal frame
    ctx.fillStyle = MEDIEVAL.ironMedium;
    ctx.fillRect(0, 0, fw, fh);
    // Inner groove
    ctx.fillStyle = MEDIEVAL.ironDark;
    ctx.fillRect(1, 1, fw - 2, fh - 2);
    // Clear center so the colored fill bar shows through
    ctx.clearRect(2, 2, fw - 4, fh - 4);
    // Highlight
    ctx.fillStyle = MEDIEVAL.ironLight;
    ctx.fillRect(0, 0, fw, 1);
    ctx.fillRect(0, 0, 1, fh);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a button background */
  private static generateButton(scene: Phaser.Scene, key: string, w: number, h: number): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(w, h);

    // Button body
    for (let y = 2; y < h - 2; y++) {
      const t = y / h;
      ctx.fillStyle = varyColor(darken(MEDIEVAL.woodMedium, t * 0.2), 3);
      ctx.fillRect(2, y, w - 4, 1);
    }

    // Border
    ctx.fillStyle = MEDIEVAL.woodDark;
    ctx.fillRect(2, 0, w - 4, 2);
    ctx.fillRect(2, h - 2, w - 4, 2);
    ctx.fillRect(0, 2, 2, h - 4);
    ctx.fillRect(w - 2, 2, 2, h - 4);

    // Highlight
    ctx.fillStyle = MEDIEVAL.woodLight;
    ctx.fillRect(3, 2, w - 6, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a speaker name plate */
  private static generateNamePlate(scene: Phaser.Scene, key: string, w: number, h: number): void {
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(w, h);

    // Dark background
    ctx.fillStyle = MEDIEVAL.panelBg;
    ctx.fillRect(0, 0, w, h);
    // Gold border
    ctx.fillStyle = MEDIEVAL.goldDark;
    ctx.fillRect(0, 0, w, 1);
    ctx.fillRect(0, h - 1, w, 1);
    ctx.fillRect(0, 0, 1, h);
    ctx.fillRect(w - 1, 0, 1, h);

    ArtRegistry.registerTexture(scene, key, canvas);
  }
}
