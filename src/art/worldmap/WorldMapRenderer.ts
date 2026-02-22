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

  /** Full-screen parchment background for world map */
  private static generateParchmentBg(scene: Phaser.Scene): void {
    const key = 'worldmap_bg';
    if (scene.textures.exists(key)) return;
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);

    // Base parchment
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // Edge darkening
        const edgeDist = Math.min(x, y, W - x, H - y);
        const edgeFactor = Math.min(1, edgeDist / 60);
        const base = edgeFactor > 0.8 ? MEDIEVAL.parchment : MEDIEVAL.parchmentDark;
        ctx.fillStyle = varyColor(base, 4);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Stain marks (aged paper effect)
    for (let i = 0; i < 20; i++) {
      const sx = Math.floor(Math.random() * W);
      const sy = Math.floor(Math.random() * H);
      const sr = 20 + Math.floor(Math.random() * 40);
      ctx.fillStyle = darken(MEDIEVAL.parchmentDark, 0.05);
      ctx.globalAlpha = 0.15;
      for (let py = sy - sr; py < sy + sr; py++) {
        for (let px = sx - sr; px < sx + sr; px++) {
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          const d = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2);
          if (d < sr) ctx.fillRect(px, py, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Border decoration (ornate frame)
    const bw = 8;
    // Top/bottom borders
    for (let x = 0; x < W; x++) {
      ctx.fillStyle = varyColor(MEDIEVAL.woodDark, 3);
      ctx.fillRect(x, 0, 1, bw);
      ctx.fillRect(x, H - bw, 1, bw);
    }
    // Left/right borders
    for (let y = 0; y < H; y++) {
      ctx.fillStyle = varyColor(MEDIEVAL.woodDark, 3);
      ctx.fillRect(0, y, bw, 1);
      ctx.fillRect(W - bw, y, bw, 1);
    }
    // Gold inner line
    ctx.fillStyle = MEDIEVAL.goldDark;
    ctx.fillRect(bw, bw, W - bw * 2, 1);
    ctx.fillRect(bw, H - bw - 1, W - bw * 2, 1);
    ctx.fillRect(bw, bw, 1, H - bw * 2);
    ctx.fillRect(W - bw - 1, bw, 1, H - bw * 2);
    // Corner ornaments
    for (const [cx, cy] of [[bw + 2, bw + 2], [W - bw - 6, bw + 2], [bw + 2, H - bw - 6], [W - bw - 6, H - bw - 6]]) {
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(cx, cy, 5, 5);
      ctx.fillStyle = MEDIEVAL.goldLight;
      ctx.fillRect(cx + 1, cy + 1, 3, 3);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

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
      // Trees
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
      // Snow cap
      ctx.fillStyle = '#eeeeff';
      fillTriangle(ctx, s * 0.5, s * 0.1, s * 0.4, s * 0.3, s * 0.6, s * 0.3);
    });

    // Volcano icon
    this.generateNodeIcon(scene, 'node_volcano', (ctx, s) => {
      ctx.fillStyle = '#554433';
      fillTriangle(ctx, s * 0.5, s * 0.15, s * 0.1, s * 0.85, s * 0.9, s * 0.85);
      // Crater
      ctx.fillStyle = '#332211';
      ctx.fillRect(Math.round(s * 0.35), Math.round(s * 0.15), Math.round(s * 0.3), Math.round(s * 0.1));
      // Lava
      ctx.fillStyle = '#ff4422';
      ctx.fillRect(Math.round(s * 0.4), Math.round(s * 0.12), Math.round(s * 0.2), Math.round(s * 0.08));
      ctx.fillStyle = '#ff8844';
      ctx.fillRect(Math.round(s * 0.42), Math.round(s * 0.08), Math.round(s * 0.06), Math.round(s * 0.06));
    });

    // Water/cave icon
    this.generateNodeIcon(scene, 'node_water', (ctx, s) => {
      // Waves
      ctx.fillStyle = '#3366aa';
      for (let i = 0; i < 3; i++) {
        const wy = s * 0.3 + i * s * 0.15;
        for (let x = 0; x < Math.round(s); x++) {
          const y = wy + Math.sin(x * 0.3 + i) * s * 0.05;
          ctx.fillRect(Math.round(s * 0.1 + x * 0.8), Math.round(y), 1, Math.round(s * 0.08));
        }
      }
      // Highlight
      ctx.fillStyle = '#5588cc';
      ctx.fillRect(Math.round(s * 0.3), Math.round(s * 0.35), Math.round(s * 0.2), 1);
    });

    // Skull/undead icon
    this.generateNodeIcon(scene, 'node_skull', (ctx, s) => {
      ctx.fillStyle = '#ccccbb';
      fillOval(ctx, s * 0.25, s * 0.15, s * 0.5, s * 0.45);
      ctx.fillRect(Math.round(s * 0.35), Math.round(s * 0.55), Math.round(s * 0.3), Math.round(s * 0.15));
      // Eye sockets
      ctx.fillStyle = '#000000';
      fillOval(ctx, s * 0.3, s * 0.3, s * 0.15, s * 0.12);
      fillOval(ctx, s * 0.55, s * 0.3, s * 0.15, s * 0.12);
      // Nose
      fillTriangle(ctx, s * 0.5, s * 0.42, s * 0.45, s * 0.5, s * 0.55, s * 0.5);
      // Teeth
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
      // Spires
      fillTriangle(ctx, s * 0.2, s * 0.3, s * 0.15, s * 0.1, s * 0.25, s * 0.1);
      fillTriangle(ctx, s * 0.8, s * 0.3, s * 0.75, s * 0.1, s * 0.85, s * 0.1);
      fillTriangle(ctx, s * 0.5, s * 0.2, s * 0.42, s * 0.02, s * 0.58, s * 0.02);
      // Glowing eyes
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(Math.round(s * 0.4), Math.round(s * 0.4), 2, 2);
      ctx.fillRect(Math.round(s * 0.55), Math.round(s * 0.4), 2, 2);
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

  /** Castle silhouette for title screen (wide) */
  private static generateCastleSilhouette(scene: Phaser.Scene): void {
    const key = 'title_castle';
    if (scene.textures.exists(key)) return;
    const W = 400, H = 200;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);

    ctx.fillStyle = '#111122';
    // Ground line
    ctx.fillRect(0, H - 20, W, 20);
    // Main castle body
    ctx.fillRect(100, 60, 200, H - 80);
    // Towers
    ctx.fillRect(80, 40, 40, H - 60);
    ctx.fillRect(280, 40, 40, H - 60);
    // Center tower (tall)
    ctx.fillRect(170, 20, 60, H - 40);
    // Battlements
    for (let i = 0; i < 8; i++) {
      const bx = 100 + i * 25;
      ctx.fillRect(bx, 55, 12, 10);
    }
    // Spires
    fillTriangle(ctx, 100, 40, 85, 15, 115, 15);
    fillTriangle(ctx, 300, 40, 285, 15, 315, 15);
    fillTriangle(ctx, 200, 20, 180, -10, 220, -10);
    // Windows (glowing)
    ctx.fillStyle = '#ffaa44';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(140, 90, 8, 12);
    ctx.fillRect(180, 90, 8, 12);
    ctx.fillRect(220, 90, 8, 12);
    ctx.fillRect(260, 90, 8, 12);
    ctx.fillRect(190, 40, 6, 10);
    ctx.fillRect(210, 40, 6, 10);
    // Door
    ctx.fillRect(188, H - 50, 24, 30);
    ctx.globalAlpha = 1;

    ArtRegistry.registerTexture(scene, key, canvas);
  }
}

/** Region ID → node icon key mapping */
export function getNodeIconKey(regionId: string): string {
  const mapping: Record<string, string> = {
    region_hero: 'node_castle',
    region_elf: 'node_forest',
    region_treant: 'node_forest',
    region_beast: 'node_mountain',
    region_merfolk: 'node_water',
    region_giant: 'node_mountain',
    region_dwarf: 'node_castle',
    region_undead: 'node_skull',
    region_volcano: 'node_volcano',
    region_hotspring: 'node_water',
    region_mountain: 'node_mountain',
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
