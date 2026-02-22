import Phaser from 'phaser';
import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT } from '../../config';
import { MEDIEVAL, getRegionPalette, varyColor, darken, lighten, type RegionPalette } from '../palettes';

/** Generates medieval-themed tile textures using Canvas 2D API */
export class TileRenderer {

  /** Generate all tile textures for all regions */
  static generateAll(scene: Phaser.Scene): void {
    // Base tiles (region-independent)
    this.reg(scene, 'tile_wood', ctx => this.drawWoodFloor(ctx));
    this.reg(scene, 'tile_stone_generic', ctx =>
      this.drawStoneFloor(ctx, MEDIEVAL.stoneDark, MEDIEVAL.stoneMedium, MEDIEVAL.stoneLight));

    // Region-specific tiles
    const regionIds = Object.keys(getRegionPalette('region_hero') ? {} : {});
    const allRegions = [
      'region_hero', 'region_elf', 'region_treant', 'region_beast',
      'region_merfolk', 'region_giant', 'region_dwarf', 'region_undead',
      'region_volcano', 'region_hotspring', 'region_mountain', 'region_demon',
    ];

    for (const rid of allRegions) {
      const pal = getRegionPalette(rid);
      this.generateRegionTiles(scene, rid, pal);
    }
  }

  private static generateRegionTiles(scene: Phaser.Scene, rid: string, pal: RegionPalette): void {
    // 3 ground variants for visual variety
    for (let v = 0; v < 3; v++) {
      this.reg(scene, `tile_ground_${rid}_${v}`, ctx => this.drawGround(ctx, pal, v));
    }
    // Wall
    this.reg(scene, `tile_wall_${rid}`, ctx => this.drawWall(ctx, pal));
    // Path (cobblestone)
    this.reg(scene, `tile_path_${rid}`, ctx => this.drawPath(ctx, pal));
    // Water
    this.reg(scene, `tile_water_${rid}`, ctx => this.drawWater(ctx, pal));
    // Battle background (wide)
    this.regSize(scene, `battle_bg_${rid}`, GAME_WIDTH, GAME_HEIGHT, ctx => this.drawBattleBg(ctx, pal));
  }

  // ─── Registration helpers ──────────────────────────────────────────

  private static reg(scene: Phaser.Scene, key: string, draw: (ctx: CanvasRenderingContext2D) => void): void {
    this.regSize(scene, key, TILE_SIZE, TILE_SIZE, draw);
  }

  private static regSize(
    scene: Phaser.Scene, key: string, w: number, h: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ): void {
    if (scene.textures.exists(key)) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    scene.textures.addCanvas(key, canvas);
  }

  // ─── Ground tiles ─────────────────────────────────────────────────

  private static drawGround(ctx: CanvasRenderingContext2D, pal: RegionPalette, variant: number): void {
    const S = TILE_SIZE;
    const [dark, mid, light] = pal.ground;

    // Base fill with slight per-pixel variation
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        ctx.fillStyle = varyColor(mid, 8);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Darker patches (dirt/shadow)
    const patchCount = 2 + variant;
    for (let i = 0; i < patchCount; i++) {
      const px = Math.floor(Math.random() * (S - 6)) + 2;
      const py = Math.floor(Math.random() * (S - 6)) + 2;
      const pw = 3 + Math.floor(Math.random() * 4);
      const ph = 2 + Math.floor(Math.random() * 3);
      ctx.fillStyle = varyColor(dark, 5);
      ctx.fillRect(px, py, pw, ph);
    }

    // Light highlights
    for (let i = 0; i < 3; i++) {
      const px = Math.floor(Math.random() * (S - 4)) + 1;
      const py = Math.floor(Math.random() * (S - 4)) + 1;
      ctx.fillStyle = varyColor(light, 8);
      ctx.fillRect(px, py, 2, 1);
    }

    // Grass blades (thin vertical lines)
    if (!pal.id.includes('merfolk') && !pal.id.includes('volcano') && !pal.id.includes('demon')) {
      for (let i = 0; i < 4 + variant * 2; i++) {
        const bx = Math.floor(Math.random() * S);
        const by = Math.floor(Math.random() * (S - 4)) + 2;
        const bh = 2 + Math.floor(Math.random() * 3);
        ctx.fillStyle = varyColor(light, 12);
        ctx.fillRect(bx, by, 1, bh);
      }
    }

    // Occasional flower (on variant 2)
    if (variant === 2 && !pal.id.includes('merfolk') && !pal.id.includes('undead') && !pal.id.includes('demon')) {
      const fx = 8 + Math.floor(Math.random() * 16);
      const fy = 8 + Math.floor(Math.random() * 16);
      const flowerColors = [MEDIEVAL.flowerRed, MEDIEVAL.flowerYellow, MEDIEVAL.flowerWhite, MEDIEVAL.flowerPurple];
      ctx.fillStyle = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      ctx.fillRect(fx, fy, 2, 2);
      ctx.fillStyle = varyColor(light, 5);
      ctx.fillRect(fx, fy + 2, 1, 2); // stem
    }
  }

  // ─── Wall tiles ───────────────────────────────────────────────────

  private static drawWall(ctx: CanvasRenderingContext2D, pal: RegionPalette): void {
    const S = TILE_SIZE;
    const [dark, mid, light] = pal.wall;

    // Brick/stone pattern
    const brickH = 8;
    const rows = Math.ceil(S / brickH);

    for (let row = 0; row < rows; row++) {
      const y = row * brickH;
      const offset = (row % 2 === 0) ? 0 : S / 2;
      const brickW = S / 2;

      for (let col = -1; col < 3; col++) {
        const x = col * brickW + offset;
        const bx = Math.max(0, x);
        const bw = Math.min(S, x + brickW - 1) - bx;
        if (bw <= 0) continue;

        // Fill brick with varied color
        const baseColor = varyColor(mid, 12);
        ctx.fillStyle = baseColor;
        ctx.fillRect(bx, y, bw, brickH - 1);

        // Top edge highlight
        ctx.fillStyle = varyColor(light, 8);
        ctx.fillRect(bx, y, bw, 1);

        // Left edge highlight
        ctx.fillStyle = varyColor(light, 5);
        ctx.fillRect(bx, y, 1, brickH - 1);

        // Bottom shadow
        ctx.fillStyle = varyColor(dark, 6);
        ctx.fillRect(bx, y + brickH - 2, bw, 1);
      }

      // Mortar line (horizontal)
      ctx.fillStyle = darken(mid, 0.3);
      ctx.fillRect(0, y + brickH - 1, S, 1);
    }

    // Top border (castle battlement hint)
    ctx.fillStyle = darken(dark, 0.2);
    ctx.fillRect(0, 0, S, 1);
    ctx.fillRect(0, S - 1, S, 1);
  }

  // ─── Stone floor ──────────────────────────────────────────────────

  private static drawStoneFloor(ctx: CanvasRenderingContext2D, dark: string, mid: string, light: string): void {
    const S = TILE_SIZE;

    // Base
    ctx.fillStyle = mid;
    ctx.fillRect(0, 0, S, S);

    // Large stone blocks
    const stones = [
      { x: 1, y: 1, w: 14, h: 10 },
      { x: 17, y: 1, w: 14, h: 14 },
      { x: 1, y: 13, w: 10, h: 8 },
      { x: 13, y: 13, w: 8, h: 8 },
      { x: 1, y: 23, w: 14, h: 8 },
      { x: 17, y: 17, w: 14, h: 14 },
      { x: 23, y: 13, w: 8, h: 8 },
    ];

    for (const s of stones) {
      ctx.fillStyle = varyColor(mid, 15);
      ctx.fillRect(s.x, s.y, s.w, s.h);
      // Top-left highlight
      ctx.fillStyle = varyColor(light, 8);
      ctx.fillRect(s.x, s.y, s.w, 1);
      ctx.fillRect(s.x, s.y, 1, s.h);
      // Bottom-right shadow
      ctx.fillStyle = varyColor(dark, 8);
      ctx.fillRect(s.x, s.y + s.h - 1, s.w, 1);
      ctx.fillRect(s.x + s.w - 1, s.y, 1, s.h);
    }

    // Mortar gaps
    ctx.fillStyle = darken(dark, 0.15);
    ctx.fillRect(0, 12, S, 1);
    ctx.fillRect(0, 22, S, 1);
    ctx.fillRect(16, 0, 1, S);
    ctx.fillRect(12, 12, 1, 10);
    ctx.fillRect(22, 12, 1, S - 12);
  }

  // ─── Wood floor ───────────────────────────────────────────────────

  private static drawWoodFloor(ctx: CanvasRenderingContext2D): void {
    const S = TILE_SIZE;
    const plankH = 8;
    const rows = S / plankH;

    for (let row = 0; row < rows; row++) {
      const y = row * plankH;
      const baseColor = varyColor(MEDIEVAL.woodMedium, 10);

      // Fill plank
      for (let py = y; py < y + plankH - 1; py++) {
        ctx.fillStyle = varyColor(baseColor, 3);
        ctx.fillRect(0, py, S, 1);
      }

      // Grain lines (subtle horizontal)
      for (let g = 0; g < 2; g++) {
        const gy = y + 2 + g * 3;
        ctx.fillStyle = varyColor(MEDIEVAL.woodGrain, 5);
        ctx.fillRect(0, gy, S, 1);
      }

      // Gap between planks
      ctx.fillStyle = MEDIEVAL.woodDark;
      ctx.fillRect(0, y + plankH - 1, S, 1);

      // Occasional knot
      if (Math.random() < 0.3) {
        const kx = 4 + Math.floor(Math.random() * 24);
        const ky = y + 2 + Math.floor(Math.random() * 4);
        ctx.fillStyle = darken(MEDIEVAL.woodMedium, 0.2);
        ctx.fillRect(kx, ky, 3, 3);
        ctx.fillStyle = darken(MEDIEVAL.woodMedium, 0.3);
        ctx.fillRect(kx + 1, ky + 1, 1, 1);
      }
    }
  }

  // ─── Cobblestone path ─────────────────────────────────────────────

  private static drawPath(ctx: CanvasRenderingContext2D, pal: RegionPalette): void {
    const S = TILE_SIZE;
    const [stoneCol, mortarCol] = pal.path;

    // Base mortar color
    ctx.fillStyle = darken(mortarCol, 0.15);
    ctx.fillRect(0, 0, S, S);

    // Cobblestones — irregular rounded shapes
    const stones = [
      { x: 2, y: 2, w: 7, h: 6 },
      { x: 11, y: 1, w: 8, h: 7 },
      { x: 21, y: 2, w: 9, h: 6 },
      { x: 1, y: 10, w: 9, h: 7 },
      { x: 12, y: 10, w: 7, h: 6 },
      { x: 21, y: 10, w: 8, h: 7 },
      { x: 3, y: 19, w: 8, h: 6 },
      { x: 13, y: 18, w: 9, h: 7 },
      { x: 24, y: 19, w: 7, h: 6 },
      { x: 1, y: 27, w: 7, h: 4 },
      { x: 10, y: 27, w: 8, h: 4 },
      { x: 20, y: 27, w: 9, h: 4 },
    ];

    for (const s of stones) {
      const col = varyColor(stoneCol, 15);
      ctx.fillStyle = col;
      // Rounded rectangle approximation
      ctx.fillRect(s.x + 1, s.y, s.w - 2, s.h);
      ctx.fillRect(s.x, s.y + 1, s.w, s.h - 2);
      // Highlight top-left
      ctx.fillStyle = lighten(col, 0.15);
      ctx.fillRect(s.x + 1, s.y, s.w - 2, 1);
      // Shadow bottom-right
      ctx.fillStyle = darken(col, 0.15);
      ctx.fillRect(s.x + 1, s.y + s.h - 1, s.w - 2, 1);
    }
  }

  // ─── Water tile ───────────────────────────────────────────────────

  private static drawWater(ctx: CanvasRenderingContext2D, pal: RegionPalette): void {
    const S = TILE_SIZE;
    const tint = pal.waterTint ?? MEDIEVAL.waterMedium;

    // Base water color
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const wave = Math.sin((x + y * 0.5) * 0.4) * 0.1;
        ctx.fillStyle = varyColor(tint, 6);
        ctx.globalAlpha = 0.9 + wave;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;

    // Wave lines
    for (let row = 0; row < 4; row++) {
      const baseY = 4 + row * 8;
      ctx.fillStyle = lighten(tint, 0.2);
      for (let x = 0; x < S; x++) {
        const wy = baseY + Math.round(Math.sin((x + row * 5) * 0.5) * 1.5);
        if (wy >= 0 && wy < S) {
          ctx.fillRect(x, wy, 1, 1);
        }
      }
    }

    // Sparkle highlights
    for (let i = 0; i < 3; i++) {
      const sx = Math.floor(Math.random() * (S - 2)) + 1;
      const sy = Math.floor(Math.random() * (S - 2)) + 1;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.4;
      ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ─── Battle background (full screen) ─────────────────────────────

  private static drawBattleBg(ctx: CanvasRenderingContext2D, pal: RegionPalette): void {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const [skyCol, horizonCol, groundCol] = pal.battleBg;

    // Sky gradient (top half)
    const skyH = Math.floor(H * 0.55);
    for (let y = 0; y < skyH; y++) {
      const t = y / skyH;
      ctx.fillStyle = blendHex(skyCol, horizonCol, t);
      ctx.fillRect(0, y, W, 1);
    }

    // Ground gradient (bottom half)
    for (let y = skyH; y < H; y++) {
      const t = (y - skyH) / (H - skyH);
      ctx.fillStyle = blendHex(horizonCol, groundCol, t);
      ctx.fillRect(0, y, W, 1);
    }

    // Horizon line
    ctx.fillStyle = lighten(horizonCol, 0.15);
    ctx.fillRect(0, skyH - 1, W, 2);

    // Ground texture (subtle)
    for (let i = 0; i < 60; i++) {
      const gx = Math.floor(Math.random() * W);
      const gy = skyH + 40 + Math.floor(Math.random() * (H - skyH - 40));
      ctx.fillStyle = varyColor(groundCol, 10);
      ctx.fillRect(gx, gy, 2 + Math.floor(Math.random() * 4), 1);
    }

    // Mountains/hills silhouette on horizon
    ctx.fillStyle = darken(horizonCol, 0.15);
    for (let x = 0; x < W; x++) {
      const hillH = Math.sin(x * 0.008) * 25 + Math.sin(x * 0.023) * 15 + Math.sin(x * 0.047) * 8;
      const hy = Math.round(skyH - 10 - Math.abs(hillH));
      ctx.fillRect(x, hy, 1, skyH - hy);
    }
  }
}

/** Local blend helper (avoids importing from palettes for internal use) */
function blendHex(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
