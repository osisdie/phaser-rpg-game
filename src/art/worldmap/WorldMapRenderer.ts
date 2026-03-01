import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config';
import { MEDIEVAL, darken, lighten, varyColor } from '../palettes';
import { ArtRegistry } from '../index';

/** Generates world map visual assets — parchment background, region node icons */
export class WorldMapRenderer {

  static generateAll(scene: Phaser.Scene): void {
    this.generateParchmentBg(scene);
    this.generateNodeIcons(scene);
    this.generateCastleSilhouette(scene);
  }

  // ─── Parchment Background (HD) ──────────────────────────────────────

  /** Full-screen parchment background with aged paper, ink terrain, and ornate border */
  private static generateParchmentBg(scene: Phaser.Scene): void {
    const key = 'worldmap_bg';
    if (scene.textures.exists(key)) return;
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);

    // ── Base parchment with radial gradient ──
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
    grad.addColorStop(0, MEDIEVAL.parchmentLight);
    grad.addColorStop(0.6, MEDIEVAL.parchment);
    grad.addColorStop(1, MEDIEVAL.parchmentDark);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ── Paper fiber texture (noise) ──
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const noise = (Math.random() - 0.5) * 12;
        ctx.fillStyle = `rgba(${noise > 0 ? 255 : 0},${noise > 0 ? 255 : 0},${noise > 0 ? 255 : 0},${Math.abs(noise) / 255})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // ── Edge darkening (vignette) ──
    ctx.save();
    const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(60,40,20,0.35)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ── Stain marks (coffee-ring-style aged spots) ──
    for (let i = 0; i < 30; i++) {
      const sx = 40 + Math.random() * (W - 80);
      const sy = 40 + Math.random() * (H - 80);
      const sr = 15 + Math.random() * 50;
      const ringGrad = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr);
      ringGrad.addColorStop(0, 'rgba(120,90,50,0)');
      ringGrad.addColorStop(0.7, `rgba(120,90,50,${0.02 + Math.random() * 0.06})`);
      ringGrad.addColorStop(1, 'rgba(120,90,50,0)');
      ctx.fillStyle = ringGrad;
      ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }

    // ── Fold/crease lines ──
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#5a4a30';
    ctx.lineWidth = 1;
    // Horizontal fold
    ctx.beginPath();
    ctx.moveTo(30, H * 0.5 + Math.random() * 10);
    ctx.lineTo(W - 30, H * 0.5 - Math.random() * 10);
    ctx.stroke();
    // Vertical fold
    ctx.beginPath();
    ctx.moveTo(W * 0.5 + Math.random() * 10, 30);
    ctx.lineTo(W * 0.5 - Math.random() * 10, H - 30);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ── Ocean edges (water around the parchment content) ──
    const oceanInset = 24;
    // Top ocean
    for (let y = oceanInset; y < oceanInset + 35; y++) {
      const fade = (y - oceanInset) / 35;
      ctx.globalAlpha = (1 - fade) * 0.12;
      for (let x = oceanInset; x < W - oceanInset; x += 3) {
        const wave = Math.sin(x * 0.03 + y * 0.1) * 3;
        ctx.fillStyle = varyColor('#4466aa', 8 + Math.round(wave));
        ctx.fillRect(x, y, 3, 1);
      }
    }
    // Bottom ocean
    for (let y = H - oceanInset - 35; y < H - oceanInset; y++) {
      const fade = (H - oceanInset - y) / 35;
      ctx.globalAlpha = (1 - fade) * 0.12;
      for (let x = oceanInset; x < W - oceanInset; x += 3) {
        const wave = Math.sin(x * 0.03 + y * 0.1) * 3;
        ctx.fillStyle = varyColor('#4466aa', 8 + Math.round(wave));
        ctx.fillRect(x, y, 3, 1);
      }
    }
    ctx.globalAlpha = 1;

    // ── Ornate border frame (layered wood + gold) ──
    const bw = 14; // border width
    // Outer dark wood
    for (let x = 0; x < W; x++) {
      for (let t = 0; t < bw; t++) {
        const shade = t / bw;
        ctx.fillStyle = varyColor(shade < 0.3 ? MEDIEVAL.woodDark : MEDIEVAL.woodMedium, 3);
        ctx.fillRect(x, t, 1, 1);
        ctx.fillRect(x, H - 1 - t, 1, 1);
      }
    }
    for (let y = 0; y < H; y++) {
      for (let t = 0; t < bw; t++) {
        const shade = t / bw;
        ctx.fillStyle = varyColor(shade < 0.3 ? MEDIEVAL.woodDark : MEDIEVAL.woodMedium, 3);
        ctx.fillRect(t, y, 1, 1);
        ctx.fillRect(W - 1 - t, y, 1, 1);
      }
    }

    // Inner gold border lines (double)
    ctx.fillStyle = MEDIEVAL.goldDark;
    ctx.fillRect(bw, bw, W - bw * 2, 2);
    ctx.fillRect(bw, H - bw - 2, W - bw * 2, 2);
    ctx.fillRect(bw, bw, 2, H - bw * 2);
    ctx.fillRect(W - bw - 2, bw, 2, H - bw * 2);
    // Second gold line (thinner, inside)
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(bw + 4, bw + 4, W - (bw + 4) * 2, 1);
    ctx.fillRect(bw + 4, H - bw - 5, W - (bw + 4) * 2, 1);
    ctx.fillRect(bw + 4, bw + 4, 1, H - (bw + 4) * 2);
    ctx.fillRect(W - bw - 5, bw + 4, 1, H - (bw + 4) * 2);

    // ── Corner ornaments (medieval fleur-de-lis style) ──
    const corners: [number, number][] = [
      [bw + 2, bw + 2], [W - bw - 20, bw + 2],
      [bw + 2, H - bw - 20], [W - bw - 20, H - bw - 20],
    ];
    for (const [cx, cy] of corners) {
      // Diamond
      ctx.fillStyle = MEDIEVAL.goldBright;
      ctx.fillRect(cx + 7, cy + 2, 4, 4);
      ctx.fillRect(cx + 5, cy + 4, 8, 4);
      ctx.fillRect(cx + 3, cy + 6, 12, 4);
      ctx.fillRect(cx + 5, cy + 10, 8, 4);
      ctx.fillRect(cx + 7, cy + 14, 4, 4);
      // Center jewel
      ctx.fillStyle = '#cc2222';
      ctx.fillRect(cx + 7, cy + 7, 4, 4);
      // Highlight
      ctx.fillStyle = MEDIEVAL.goldLight;
      ctx.fillRect(cx + 8, cy + 3, 2, 2);
    }

    // ── Compass rose (bottom-right corner) ──
    this.drawCompassRose(ctx, W - 80, H - 80, 32);

    // ── Map title cartouche (top center, subtle) ──
    ctx.fillStyle = 'rgba(80,60,30,0.08)';
    ctx.fillRect(W / 2 - 120, bw + 8, 240, 28);
    ctx.fillStyle = MEDIEVAL.goldDark;
    ctx.fillRect(W / 2 - 120, bw + 8, 240, 1);
    ctx.fillRect(W / 2 - 120, bw + 35, 240, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Draw a compass rose at (cx, cy) with given radius */
  private static drawCompassRose(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.save();

    // Outer circle
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = MEDIEVAL.goldDark;
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
      ctx.fillRect(Math.round(cx + Math.cos(a) * (r - 1)), Math.round(cy + Math.sin(a) * (r - 1)), 1, 1);
    }

    ctx.globalAlpha = 0.3;

    // Cardinal points (N, S, E, W) — long narrow triangles
    const dirs = [
      { angle: -Math.PI / 2, len: r * 0.9 },  // N
      { angle: Math.PI / 2, len: r * 0.9 },    // S
      { angle: 0, len: r * 0.9 },               // E
      { angle: Math.PI, len: r * 0.9 },         // W
    ];
    for (const { angle, len } of dirs) {
      const tipX = cx + Math.cos(angle) * len;
      const tipY = cy + Math.sin(angle) * len;
      const leftAngle = angle + Math.PI / 2;
      const lx = cx + Math.cos(leftAngle) * 3;
      const ly = cy + Math.sin(leftAngle) * 3;
      const rx = cx - Math.cos(leftAngle) * 3;
      const ry = cy - Math.sin(leftAngle) * 3;
      ctx.fillStyle = angle === -Math.PI / 2 ? '#cc2222' : MEDIEVAL.goldDark;
      fillTriangle(ctx, tipX, tipY, lx, ly, rx, ry);
    }

    // Ordinal points (shorter)
    const ordinals = [Math.PI * -0.25, Math.PI * 0.25, Math.PI * 0.75, Math.PI * -0.75];
    ctx.fillStyle = MEDIEVAL.goldDark;
    ctx.globalAlpha = 0.2;
    for (const angle of ordinals) {
      const len = r * 0.55;
      const tipX = cx + Math.cos(angle) * len;
      const tipY = cy + Math.sin(angle) * len;
      const leftAngle = angle + Math.PI / 2;
      const lx = cx + Math.cos(leftAngle) * 2;
      const ly = cy + Math.sin(leftAngle) * 2;
      const rx = cx - Math.cos(leftAngle) * 2;
      const ry = cy - Math.sin(leftAngle) * 2;
      fillTriangle(ctx, tipX, tipY, lx, ly, rx, ry);
    }

    // Center dot
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = MEDIEVAL.goldBright;
    ctx.fillRect(cx - 1, cy - 1, 3, 3);

    ctx.restore();
  }

  // ─── Node Icons ──────────────────────────────────────────────────────

  /** Region node icons: castle, forest, mountain, volcano, etc. */
  private static generateNodeIcons(scene: Phaser.Scene): void {
    // Castle icon (for kingdoms)
    this.generateNodeIcon(scene, 'node_castle', (ctx, s) => {
      ctx.fillStyle = MEDIEVAL.stoneMedium;
      // Main tower
      ctx.fillRect(s * 0.3, s * 0.2, s * 0.4, s * 0.6);
      // Side towers
      ctx.fillRect(s * 0.1, s * 0.3, s * 0.2, s * 0.5);
      ctx.fillRect(s * 0.7, s * 0.3, s * 0.2, s * 0.5);
      // Battlements
      ctx.fillRect(s * 0.3, s * 0.15, s * 0.1, s * 0.1);
      ctx.fillRect(s * 0.5, s * 0.15, s * 0.1, s * 0.1);
      ctx.fillRect(s * 0.6, s * 0.15, s * 0.1, s * 0.1);
      ctx.fillRect(s * 0.1, s * 0.25, s * 0.05, s * 0.05);
      ctx.fillRect(s * 0.25, s * 0.25, s * 0.05, s * 0.05);
      ctx.fillRect(s * 0.7, s * 0.25, s * 0.05, s * 0.05);
      ctx.fillRect(s * 0.85, s * 0.25, s * 0.05, s * 0.05);
      // Door
      ctx.fillStyle = MEDIEVAL.woodDark;
      ctx.fillRect(s * 0.4, s * 0.55, s * 0.2, s * 0.25);
      // Flag
      ctx.fillStyle = '#cc2222';
      ctx.fillRect(s * 0.45, s * 0.05, s * 0.15, s * 0.1);
      ctx.fillStyle = MEDIEVAL.ironMedium;
      ctx.fillRect(s * 0.44, s * 0.05, 1, s * 0.15);
    });

    // Forest icon
    this.generateNodeIcon(scene, 'node_forest', (ctx, s) => {
      const treePositions = [[s * 0.2, s * 0.5], [s * 0.5, s * 0.35], [s * 0.75, s * 0.55]];
      for (const [tx, ty] of treePositions) {
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(tx, ty, s * 0.06, s * 0.3);
        ctx.fillStyle = '#2a6a2a';
        fillOval(ctx, tx - s * 0.12, ty - s * 0.2, s * 0.3, s * 0.25);
        ctx.fillStyle = '#3a8a3a';
        fillOval(ctx, tx - s * 0.08, ty - s * 0.15, s * 0.22, s * 0.18);
      }
    });

    // Mountain icon
    this.generateNodeIcon(scene, 'node_mountain', (ctx, s) => {
      ctx.fillStyle = '#777788';
      fillTriangle(ctx, s * 0.5, s * 0.1, s * 0.15, s * 0.8, s * 0.85, s * 0.8);
      ctx.fillStyle = '#999aaa';
      fillTriangle(ctx, s * 0.3, s * 0.35, s * 0.05, s * 0.8, s * 0.55, s * 0.8);
      ctx.fillStyle = '#eeeeff';
      fillTriangle(ctx, s * 0.5, s * 0.1, s * 0.4, s * 0.3, s * 0.6, s * 0.3);
    });

    // Volcano icon
    this.generateNodeIcon(scene, 'node_volcano', (ctx, s) => {
      ctx.fillStyle = '#554433';
      fillTriangle(ctx, s * 0.5, s * 0.15, s * 0.1, s * 0.85, s * 0.9, s * 0.85);
      ctx.fillStyle = '#332211';
      ctx.fillRect(Math.round(s * 0.35), Math.round(s * 0.15), Math.round(s * 0.3), Math.round(s * 0.1));
      ctx.fillStyle = '#ff4422';
      ctx.fillRect(Math.round(s * 0.4), Math.round(s * 0.12), Math.round(s * 0.2), Math.round(s * 0.08));
      ctx.fillStyle = '#ff8844';
      ctx.fillRect(Math.round(s * 0.42), Math.round(s * 0.08), Math.round(s * 0.06), Math.round(s * 0.06));
    });

    // Water/cave icon
    this.generateNodeIcon(scene, 'node_water', (ctx, s) => {
      ctx.fillStyle = '#3366aa';
      for (let i = 0; i < 3; i++) {
        const wy = s * 0.3 + i * s * 0.15;
        for (let x = 0; x < Math.round(s); x++) {
          const y = wy + Math.sin(x * 0.3 + i) * s * 0.05;
          ctx.fillRect(Math.round(s * 0.1 + x * 0.8), Math.round(y), 1, Math.round(s * 0.08));
        }
      }
      ctx.fillStyle = '#5588cc';
      ctx.fillRect(Math.round(s * 0.3), Math.round(s * 0.35), Math.round(s * 0.2), 1);
    });

    // Skull/undead icon
    this.generateNodeIcon(scene, 'node_skull', (ctx, s) => {
      ctx.fillStyle = '#ccccbb';
      fillOval(ctx, s * 0.25, s * 0.15, s * 0.5, s * 0.45);
      ctx.fillRect(Math.round(s * 0.35), Math.round(s * 0.55), Math.round(s * 0.3), Math.round(s * 0.15));
      ctx.fillStyle = '#000000';
      fillOval(ctx, s * 0.3, s * 0.3, s * 0.15, s * 0.12);
      fillOval(ctx, s * 0.55, s * 0.3, s * 0.15, s * 0.12);
      fillTriangle(ctx, s * 0.5, s * 0.42, s * 0.45, s * 0.5, s * 0.55, s * 0.5);
      ctx.fillStyle = '#ccccbb';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(Math.round(s * 0.38 + i * s * 0.06), Math.round(s * 0.58), Math.round(s * 0.04), Math.round(s * 0.08));
      }
    });

    // Demon castle icon
    this.generateNodeIcon(scene, 'node_demon', (ctx, s) => {
      ctx.fillStyle = '#442244';
      ctx.fillRect(Math.round(s * 0.3), Math.round(s * 0.2), Math.round(s * 0.4), Math.round(s * 0.6));
      ctx.fillRect(Math.round(s * 0.1), Math.round(s * 0.3), Math.round(s * 0.2), Math.round(s * 0.5));
      ctx.fillRect(Math.round(s * 0.7), Math.round(s * 0.3), Math.round(s * 0.2), Math.round(s * 0.5));
      fillTriangle(ctx, s * 0.2, s * 0.3, s * 0.15, s * 0.1, s * 0.25, s * 0.1);
      fillTriangle(ctx, s * 0.8, s * 0.3, s * 0.75, s * 0.1, s * 0.85, s * 0.1);
      fillTriangle(ctx, s * 0.5, s * 0.2, s * 0.42, s * 0.02, s * 0.58, s * 0.02);
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(Math.round(s * 0.4), Math.round(s * 0.4), 2, 2);
      ctx.fillRect(Math.round(s * 0.55), Math.round(s * 0.4), 2, 2);
    });

    // Treant icon
    this.generateNodeIcon(scene, 'node_treant', (ctx, s) => {
      ctx.fillStyle = '#4a2a0a';
      ctx.fillRect(Math.round(s * 0.35), Math.round(s * 0.4), Math.round(s * 0.3), Math.round(s * 0.45));
      ctx.fillRect(Math.round(s * 0.25), Math.round(s * 0.75), Math.round(s * 0.12), Math.round(s * 0.1));
      ctx.fillRect(Math.round(s * 0.63), Math.round(s * 0.75), Math.round(s * 0.12), Math.round(s * 0.1));
      ctx.fillStyle = '#3a1a00';
      ctx.fillRect(Math.round(s * 0.2), Math.round(s * 0.35), Math.round(s * 0.15), Math.round(s * 0.06));
      ctx.fillRect(Math.round(s * 0.65), Math.round(s * 0.35), Math.round(s * 0.15), Math.round(s * 0.06));
      ctx.fillStyle = '#1a5a1a';
      fillOval(ctx, s * 0.1, s * 0.05, s * 0.8, s * 0.4);
      ctx.fillStyle = '#2a7a2a';
      fillOval(ctx, s * 0.15, s * 0.1, s * 0.7, s * 0.3);
      ctx.fillStyle = '#2a1a00';
      ctx.fillRect(Math.round(s * 0.4), Math.round(s * 0.5), 2, 2);
      ctx.fillRect(Math.round(s * 0.55), Math.round(s * 0.5), 2, 2);
      ctx.fillRect(Math.round(s * 0.44), Math.round(s * 0.58), Math.round(s * 0.12), 1);
    });

    // Peak icon
    this.generateNodeIcon(scene, 'node_peak', (ctx, s) => {
      ctx.fillStyle = '#8888aa';
      fillTriangle(ctx, s * 0.3, s * 0.2, s * 0.05, s * 0.85, s * 0.55, s * 0.85);
      ctx.fillStyle = '#666688';
      fillTriangle(ctx, s * 0.55, s * 0.05, s * 0.25, s * 0.85, s * 0.85, s * 0.85);
      ctx.fillStyle = '#777799';
      fillTriangle(ctx, s * 0.75, s * 0.25, s * 0.55, s * 0.85, s * 0.95, s * 0.85);
      ctx.fillStyle = '#eeeeff';
      fillTriangle(ctx, s * 0.3, s * 0.2, s * 0.2, s * 0.38, s * 0.4, s * 0.38);
      fillTriangle(ctx, s * 0.55, s * 0.05, s * 0.42, s * 0.28, s * 0.68, s * 0.28);
      fillTriangle(ctx, s * 0.75, s * 0.25, s * 0.65, s * 0.4, s * 0.85, s * 0.4);
    });

    // Hotspring icon
    this.generateNodeIcon(scene, 'node_hotspring', (ctx, s) => {
      ctx.fillStyle = '#4488bb';
      fillOval(ctx, s * 0.15, s * 0.5, s * 0.7, s * 0.35);
      ctx.fillStyle = '#66aadd';
      fillOval(ctx, s * 0.25, s * 0.55, s * 0.5, s * 0.2);
      ctx.fillStyle = '#887766';
      fillOval(ctx, s * 0.08, s * 0.6, s * 0.15, s * 0.12);
      fillOval(ctx, s * 0.75, s * 0.55, s * 0.15, s * 0.14);
      fillOval(ctx, s * 0.35, s * 0.72, s * 0.12, s * 0.1);
      ctx.fillStyle = '#ccddee';
      for (let col = 0; col < 3; col++) {
        const baseX = s * 0.28 + col * s * 0.18;
        for (let py = 0; py < 6; py++) {
          const y = Math.round(s * 0.48 - py * s * 0.07);
          const x = Math.round(baseX + Math.sin(py * 1.2 + col) * s * 0.04);
          ctx.globalAlpha = 0.7 - py * 0.1;
          ctx.fillRect(x, y, 2, Math.round(s * 0.04));
        }
      }
      ctx.globalAlpha = 1;
    });

    // Dwarf fortress icon
    this.generateNodeIcon(scene, 'node_dwarf', (ctx, s) => {
      ctx.fillStyle = '#665544';
      fillTriangle(ctx, s * 0.5, s * 0.1, s * 0.05, s * 0.8, s * 0.95, s * 0.8);
      ctx.fillStyle = '#554433';
      ctx.fillRect(Math.round(s * 0.25), Math.round(s * 0.35), Math.round(s * 0.5), Math.round(s * 0.45));
      ctx.fillStyle = '#776655';
      ctx.fillRect(Math.round(s * 0.25), Math.round(s * 0.33), Math.round(s * 0.5), Math.round(s * 0.05));
      ctx.fillStyle = '#221100';
      ctx.fillRect(Math.round(s * 0.35), Math.round(s * 0.45), Math.round(s * 0.3), Math.round(s * 0.35));
      ctx.fillStyle = '#aaaaaa';
      ctx.fillRect(Math.round(s * 0.4), Math.round(s * 0.55), Math.round(s * 0.2), Math.round(s * 0.04));
      ctx.fillRect(Math.round(s * 0.42), Math.round(s * 0.59), Math.round(s * 0.16), Math.round(s * 0.04));
      ctx.fillRect(Math.round(s * 0.46), Math.round(s * 0.63), Math.round(s * 0.08), Math.round(s * 0.06));
      ctx.fillRect(Math.round(s * 0.42), Math.round(s * 0.69), Math.round(s * 0.16), Math.round(s * 0.03));
      ctx.fillStyle = '#ffaa22';
      ctx.fillRect(Math.round(s * 0.28), Math.round(s * 0.38), 2, 3);
      ctx.fillRect(Math.round(s * 0.68), Math.round(s * 0.38), 2, 3);
    });
  }

  /** Generate a single node icon */
  private static generateNodeIcon(
    scene: Phaser.Scene, key: string,
    draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  ): void {
    if (scene.textures.exists(key)) return;
    const S = 40;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    draw(ctx, S);
    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Castle Silhouette (HD) ──────────────────────────────────────────

  /** Castle silhouette for title screen — grand and atmospheric */
  private static generateCastleSilhouette(scene: Phaser.Scene): void {
    const key = 'title_castle';
    if (scene.textures.exists(key)) return;
    const W = 700, H = 350;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const c = '#0e0e1e'; // silhouette color
    const cLight = '#151528'; // slightly lighter shade for depth

    // ── Distant mountains (background layer) ──
    ctx.fillStyle = '#0c0c18';
    fillTriangle(ctx, 60, 120, -60, H, 180, H);
    fillTriangle(ctx, 250, 100, 130, H, 370, H);
    fillTriangle(ctx, 500, 110, 380, H, 620, H);
    fillTriangle(ctx, 650, 130, 550, H, W + 50, H);

    // ── Ground ──
    ctx.fillStyle = c;
    ctx.fillRect(0, H - 50, W, 50);
    // Gentle hill
    for (let x = 0; x < W; x++) {
      const hillH = 15 + Math.sin(x * 0.008) * 12 + Math.sin(x * 0.025) * 6;
      ctx.fillRect(x, H - 50 - Math.round(hillH), 1, Math.round(hillH));
    }

    // ── Castle body (complex multi-section) ──
    const baseY = H - 50;

    // Main keep (center)
    ctx.fillStyle = c;
    ctx.fillRect(250, baseY - 160, 200, 160);

    // Left wing
    ctx.fillRect(140, baseY - 120, 115, 120);
    // Right wing
    ctx.fillRect(445, baseY - 120, 115, 120);

    // ── Towers (6 towers at different heights) ──
    // Far-left tower
    ctx.fillRect(110, baseY - 170, 35, 170);
    fillTriangle(ctx, 127, baseY - 195, 105, baseY - 170, 150, baseY - 170);
    // Left-main tower
    ctx.fillRect(240, baseY - 200, 40, 200);
    fillTriangle(ctx, 260, baseY - 230, 235, baseY - 200, 285, baseY - 200);
    // Center tower (tallest — the keep)
    ctx.fillRect(320, baseY - 240, 55, 240);
    fillTriangle(ctx, 347, baseY - 280, 315, baseY - 240, 380, baseY - 240);
    // Right-main tower
    ctx.fillRect(420, baseY - 200, 40, 200);
    fillTriangle(ctx, 440, baseY - 230, 415, baseY - 200, 465, baseY - 200);
    // Far-right tower
    ctx.fillRect(555, baseY - 170, 35, 170);
    fillTriangle(ctx, 572, baseY - 195, 550, baseY - 170, 595, baseY - 170);
    // Outer watchtower (left)
    ctx.fillRect(60, baseY - 130, 28, 130);
    fillTriangle(ctx, 74, baseY - 150, 56, baseY - 130, 92, baseY - 130);
    // Outer watchtower (right)
    ctx.fillRect(610, baseY - 130, 28, 130);
    fillTriangle(ctx, 624, baseY - 150, 606, baseY - 130, 642, baseY - 130);

    // ── Battlements ──
    ctx.fillStyle = c;
    // Main wall battlements
    for (let x = 145; x < 240; x += 10) ctx.fillRect(x, baseY - 125, 6, 8);
    for (let x = 455; x < 555; x += 10) ctx.fillRect(x, baseY - 125, 6, 8);
    // Keep battlements
    for (let x = 255; x < 420; x += 10) ctx.fillRect(x, baseY - 165, 6, 8);
    // Tower-top battlements
    for (let x = 112; x < 143; x += 8) ctx.fillRect(x, baseY - 174, 4, 6);
    for (let x = 557; x < 588; x += 8) ctx.fillRect(x, baseY - 174, 4, 6);

    // ── Flags on tower spires ──
    ctx.fillStyle = '#331122';
    ctx.fillRect(347, baseY - 280, 1, 12);
    ctx.fillRect(348, baseY - 280, 14, 6);
    ctx.fillRect(348, baseY - 274, 12, 1);
    ctx.fillRect(260, baseY - 230, 1, 10);
    ctx.fillRect(261, baseY - 230, 10, 5);
    ctx.fillRect(440, baseY - 230, 1, 10);
    ctx.fillRect(441, baseY - 230, 10, 5);

    // ── Windows (warm glow) ──
    ctx.fillStyle = '#ffaa44';
    ctx.globalAlpha = 0.7;
    // Keep windows (2 rows)
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(270 + i * 30, baseY - 140, 8, 14);
      if (i < 4) ctx.fillRect(280 + i * 30, baseY - 100, 6, 10);
    }
    // Left wing windows
    for (let i = 0; i < 3; i++) ctx.fillRect(155 + i * 30, baseY - 95, 6, 10);
    // Right wing windows
    for (let i = 0; i < 3; i++) ctx.fillRect(460 + i * 30, baseY - 95, 6, 10);
    // Tower windows
    ctx.fillRect(335, baseY - 220, 6, 12);
    ctx.fillRect(350, baseY - 220, 6, 12);
    ctx.fillRect(255, baseY - 180, 5, 10);
    ctx.fillRect(430, baseY - 180, 5, 10);
    ctx.fillRect(120, baseY - 150, 4, 8);
    ctx.fillRect(565, baseY - 150, 4, 8);

    // ── Grand gate with warm light ──
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffcc66';
    ctx.fillRect(330, baseY - 50, 35, 50);
    // Gate arch
    ctx.fillStyle = c;
    fillTriangle(ctx, 347, baseY - 58, 328, baseY - 50, 367, baseY - 50);
    // Light spill on ground
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ffaa44';
    fillTriangle(ctx, 347, baseY - 10, 310, baseY + 20, 385, baseY + 20);

    ctx.globalAlpha = 1;

    // ── Flanking trees (silhouette) ──
    ctx.fillStyle = '#0a0a16';
    // Left trees
    fillOval(ctx, -15, baseY - 90, 60, 70);
    ctx.fillRect(10, baseY - 30, 8, 30);
    fillOval(ctx, 25, baseY - 80, 50, 55);
    ctx.fillRect(42, baseY - 30, 7, 30);
    // Right trees
    fillOval(ctx, W - 50, baseY - 85, 55, 65);
    ctx.fillRect(W - 30, baseY - 25, 8, 25);
    fillOval(ctx, W - 80, baseY - 70, 50, 50);
    ctx.fillRect(W - 60, baseY - 25, 7, 25);

    // ── Faint wall connector lines ──
    ctx.fillStyle = c;
    ctx.fillRect(90, baseY - 70, 50, 10); // left wall to watchtower
    ctx.fillRect(560, baseY - 70, 50, 10); // right wall to watchtower

    ArtRegistry.registerTexture(scene, key, canvas);
  }
}

/** Region ID → node icon key mapping */
export function getNodeIconKey(regionId: string): string {
  const mapping: Record<string, string> = {
    region_hero: 'node_castle',
    region_elf: 'node_forest',
    region_treant: 'node_treant',
    region_beast: 'node_mountain',
    region_merfolk: 'node_water',
    region_giant: 'node_mountain',
    region_dwarf: 'node_dwarf',
    region_undead: 'node_skull',
    region_volcano: 'node_volcano',
    region_hotspring: 'node_hotspring',
    region_mountain: 'node_peak',
    region_demon: 'node_demon',
  };
  return mapping[regionId] ?? 'node_castle';
}

// ─── Shape helpers ──────────────────────────────────────────────────

function fillOval(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const cx = x + w / 2, cy = y + h / 2;
  const rx = w / 2, ry = h / 2;
  for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
    const dy = (py + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const dx = Math.sqrt(1 - dy * dy) * rx;
    ctx.fillRect(Math.round(cx - dx), py, Math.max(1, Math.round(dx * 2)), 1);
  }
}

function fillTriangle(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
  const minY = Math.floor(Math.min(y1, y2, y3));
  const maxY = Math.ceil(Math.max(y1, y2, y3));
  const edges = [[x1, y1, x2, y2], [x2, y2, x3, y3], [x3, y3, x1, y1]];
  for (let y = minY; y <= maxY; y++) {
    let minX = Infinity, maxX = -Infinity;
    for (const [ex1, ey1, ex2, ey2] of edges) {
      if ((ey1 <= y && ey2 > y) || (ey2 <= y && ey1 > y)) {
        const t = (y - ey1) / (ey2 - ey1);
        const ix = ex1 + t * (ex2 - ex1);
        minX = Math.min(minX, ix);
        maxX = Math.max(maxX, ix);
      }
    }
    if (minX <= maxX) ctx.fillRect(Math.round(minX), y, Math.max(1, Math.round(maxX - minX)), 1);
  }
}
