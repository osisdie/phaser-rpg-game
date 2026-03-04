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
    // Battle background (wide) — normal + boss variant
    this.regSize(scene, `battle_bg_${rid}`, GAME_WIDTH, GAME_HEIGHT, ctx => this.drawBattleBg(ctx, pal, rid, false));
    this.regSize(scene, `battle_bg_${rid}_boss`, GAME_WIDTH, GAME_HEIGHT, ctx => this.drawBattleBg(ctx, pal, rid, true));
    // Cave tiles — dark stone variants
    for (let v = 0; v < 3; v++) {
      this.reg(scene, `tile_cave_ground_${rid}_${v}`, ctx => this.drawCaveGround(ctx, pal, v));
    }
    this.reg(scene, `tile_cave_wall_${rid}`, ctx => this.drawCaveWall(ctx, pal));
    this.regSize(scene, `battle_bg_cave_${rid}`, GAME_WIDTH, GAME_HEIGHT, ctx => this.drawCaveBattleBg(ctx, pal));
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
      const fx = Math.round(S * 0.25) + Math.floor(Math.random() * Math.round(S * 0.5));
      const fy = Math.round(S * 0.25) + Math.floor(Math.random() * Math.round(S * 0.5));
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
    const brickH = Math.round(S / 4);
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
    const f = S / 32;
    const r = (v: number) => Math.round(v * f);

    // Base
    ctx.fillStyle = mid;
    ctx.fillRect(0, 0, S, S);

    // Large stone blocks (coordinates in 32px design units, scaled at render)
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
      const sx = r(s.x), sy = r(s.y), sw = r(s.w), sh = r(s.h);
      ctx.fillStyle = varyColor(mid, 15);
      ctx.fillRect(sx, sy, sw, sh);
      // Top-left highlight
      ctx.fillStyle = varyColor(light, 8);
      ctx.fillRect(sx, sy, sw, 1);
      ctx.fillRect(sx, sy, 1, sh);
      // Bottom-right shadow
      ctx.fillStyle = varyColor(dark, 8);
      ctx.fillRect(sx, sy + sh - 1, sw, 1);
      ctx.fillRect(sx + sw - 1, sy, 1, sh);
    }

    // Mortar gaps
    ctx.fillStyle = darken(dark, 0.15);
    ctx.fillRect(0, r(12), S, 1);
    ctx.fillRect(0, r(22), S, 1);
    ctx.fillRect(r(16), 0, 1, S);
    ctx.fillRect(r(12), r(12), 1, r(10));
    ctx.fillRect(r(22), r(12), 1, S - r(12));
  }

  // ─── Wood floor ───────────────────────────────────────────────────

  private static drawWoodFloor(ctx: CanvasRenderingContext2D): void {
    const S = TILE_SIZE;
    const f = S / 32;
    const r = (v: number) => Math.round(v * f);
    const plankH = Math.round(S / 4);
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
        const gy = y + r(2) + g * r(3);
        ctx.fillStyle = varyColor(MEDIEVAL.woodGrain, 5);
        ctx.fillRect(0, gy, S, 1);
      }

      // Gap between planks
      ctx.fillStyle = MEDIEVAL.woodDark;
      ctx.fillRect(0, y + plankH - 1, S, 1);

      // Occasional knot
      if (Math.random() < 0.3) {
        const kx = r(4) + Math.floor(Math.random() * r(24));
        const ky = y + r(2) + Math.floor(Math.random() * r(4));
        ctx.fillStyle = darken(MEDIEVAL.woodMedium, 0.2);
        ctx.fillRect(kx, ky, r(3), r(3));
        ctx.fillStyle = darken(MEDIEVAL.woodMedium, 0.3);
        ctx.fillRect(kx + 1, ky + 1, 1, 1);
      }
    }
  }

  // ─── Cobblestone path ─────────────────────────────────────────────

  private static drawPath(ctx: CanvasRenderingContext2D, pal: RegionPalette): void {
    const S = TILE_SIZE;
    const f = S / 32;
    const r = (v: number) => Math.round(v * f);
    const [stoneCol, mortarCol] = pal.path;

    // Base mortar color
    ctx.fillStyle = darken(mortarCol, 0.15);
    ctx.fillRect(0, 0, S, S);

    // Cobblestones — irregular rounded shapes (coordinates in 32px design units)
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
      const sx = r(s.x), sy = r(s.y), sw = r(s.w), sh = r(s.h);
      const col = varyColor(stoneCol, 15);
      ctx.fillStyle = col;
      // Rounded rectangle approximation
      ctx.fillRect(sx + 1, sy, sw - 2, sh);
      ctx.fillRect(sx, sy + 1, sw, sh - 2);
      // Highlight top-left
      ctx.fillStyle = lighten(col, 0.15);
      ctx.fillRect(sx + 1, sy, sw - 2, 1);
      // Shadow bottom-right
      ctx.fillStyle = darken(col, 0.15);
      ctx.fillRect(sx + 1, sy + sh - 1, sw - 2, 1);
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
      const baseY = Math.round(S * 0.125) + row * Math.round(S * 0.25);
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

  // ─── Cave ground ────────────────────────────────────────────────

  private static drawCaveGround(ctx: CanvasRenderingContext2D, pal: RegionPalette, variant: number): void {
    const S = TILE_SIZE;
    const baseDark = darken(MEDIEVAL.stoneDark, 0.3);
    const baseMid = darken(MEDIEVAL.stoneMedium, 0.25);
    const baseLight = darken(MEDIEVAL.stoneLight, 0.25);
    // Slight tint from region accent
    const tintR = parseInt(pal.accent.slice(1, 3), 16) / 255;
    const tintG = parseInt(pal.accent.slice(3, 5), 16) / 255;
    const tintB = parseInt(pal.accent.slice(5, 7), 16) / 255;

    // Per-pixel stone fill with region tint
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const base = varyColor(baseMid, 6);
        // Apply subtle region tint (10% blend)
        const r = parseInt(base.slice(1, 3), 16);
        const g = parseInt(base.slice(3, 5), 16);
        const b = parseInt(base.slice(5, 7), 16);
        const tr = Math.round(r * 0.9 + tintR * 255 * 0.1);
        const tg = Math.round(g * 0.9 + tintG * 255 * 0.1);
        const tb = Math.round(b * 0.9 + tintB * 255 * 0.1);
        ctx.fillStyle = `rgb(${Math.min(255, tr)},${Math.min(255, tg)},${Math.min(255, tb)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Dark cracks
    for (let i = 0; i < 2 + variant; i++) {
      const cx = Math.floor(Math.random() * (S - 8)) + 3;
      const cy = Math.floor(Math.random() * (S - 6)) + 2;
      ctx.fillStyle = varyColor(baseDark, 4);
      ctx.fillRect(cx, cy, 1 + Math.floor(Math.random() * 6), 1);
      ctx.fillRect(cx + 1, cy + 1, 1 + Math.floor(Math.random() * 3), 1);
    }

    // Small highlight spots (moisture / mineral)
    if (variant >= 1) {
      for (let i = 0; i < 2; i++) {
        const hx = Math.floor(Math.random() * (S - 2)) + 1;
        const hy = Math.floor(Math.random() * (S - 2)) + 1;
        ctx.fillStyle = varyColor(baseLight, 10);
        ctx.fillRect(hx, hy, 1, 1);
      }
    }

    // Occasional small stone/pebble on variant 2
    if (variant === 2) {
      const sx = Math.round(S * 0.3) + Math.floor(Math.random() * Math.round(S * 0.4));
      const sy = Math.round(S * 0.3) + Math.floor(Math.random() * Math.round(S * 0.4));
      ctx.fillStyle = varyColor(baseDark, 8);
      ctx.fillRect(sx, sy, 3, 2);
      ctx.fillStyle = varyColor(baseLight, 8);
      ctx.fillRect(sx, sy, 2, 1);
    }
  }

  // ─── Cave wall ─────────────────────────────────────────────────

  private static drawCaveWall(ctx: CanvasRenderingContext2D, pal: RegionPalette): void {
    const S = TILE_SIZE;
    const baseDark = darken(MEDIEVAL.stoneDark, 0.4);
    const baseMid = darken(MEDIEVAL.stoneMedium, 0.35);
    const baseLight = darken(MEDIEVAL.stoneLight, 0.3);

    // Rough rocky texture fill
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        // Random rough stone pattern
        const noise = ((x * 7 + y * 13) % 11) / 11;
        const col = noise < 0.3 ? baseDark : noise < 0.7 ? baseMid : baseLight;
        ctx.fillStyle = varyColor(col, 5);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Horizontal crevice lines (cave rock strata)
    for (let row = 0; row < 3; row++) {
      const ly = Math.round(S * (0.25 + row * 0.25));
      ctx.fillStyle = varyColor(baseDark, 3);
      for (let x = 0; x < S; x++) {
        const offset = Math.floor(Math.sin(x * 0.3 + row) * 2);
        ctx.fillRect(x, ly + offset, 1, 1);
      }
    }

    // Dark edge (cave wall feels closed-in)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, S, 2);
    ctx.fillRect(0, S - 2, S, 2);
    ctx.fillRect(0, 0, 2, S);
    ctx.fillRect(S - 2, 0, 2, S);
  }

  // ─── Cave battle background ────────────────────────────────────

  private static drawCaveBattleBg(ctx: CanvasRenderingContext2D, pal: RegionPalette): void {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const ceilCol = darken(MEDIEVAL.stoneDark, 0.35);
    const wallCol = darken(MEDIEVAL.stoneMedium, 0.3);
    const floorCol = darken(MEDIEVAL.stoneMedium, 0.2);

    // Cave ceiling (top 35%)
    const ceilH = Math.floor(H * 0.35);
    for (let y = 0; y < ceilH; y++) {
      const t = y / ceilH;
      ctx.fillStyle = blendHex(ceilCol, wallCol, t);
      ctx.fillRect(0, y, W, 1);
    }

    // Cave floor (bottom 65%)
    for (let y = ceilH; y < H; y++) {
      const t = (y - ceilH) / (H - ceilH);
      ctx.fillStyle = blendHex(wallCol, floorCol, t);
      ctx.fillRect(0, y, W, 1);
    }

    // Stalactites from ceiling
    for (let sx = 30; sx < W; sx += 40 + Math.floor(Math.random() * 50)) {
      const sh = 25 + Math.floor(Math.random() * 45);
      const sw = 4 + Math.floor(Math.random() * 6);
      ctx.fillStyle = varyColor(ceilCol, 8);
      // Tapered shape
      for (let dy = 0; dy < sh; dy++) {
        const w = Math.max(1, Math.round(sw * (1 - dy / sh)));
        ctx.fillRect(sx - Math.floor(w / 2), dy, w, 1);
      }
    }

    // Stalagmites from floor
    for (let sx = 50; sx < W; sx += 50 + Math.floor(Math.random() * 60)) {
      const sh = 20 + Math.floor(Math.random() * 35);
      const sw = 5 + Math.floor(Math.random() * 6);
      ctx.fillStyle = varyColor(floorCol, 8);
      for (let dy = 0; dy < sh; dy++) {
        const w = Math.max(1, Math.round(sw * (1 - dy / sh)));
        ctx.fillRect(sx - Math.floor(w / 2), H - dy, w, 1);
      }
    }

    // Crystal clusters (region accent color, dim glow)
    const accentDim = darken(pal.accent, 0.3);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = accentDim;
    const crystals = [150, 420, 680, 900];
    for (const cx of crystals) {
      ctx.fillRect(cx, H - 50, 4, 18);
      ctx.fillRect(cx + 7, H - 44, 3, 14);
      ctx.fillRect(cx - 5, H - 38, 3, 10);
    }
    ctx.globalAlpha = 1.0;

    // Dim lighting — vignette effect (always present in caves)
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, 0, W, 60);
    ctx.fillRect(0, H - 60, W, 60);
    ctx.fillRect(0, 0, 60, H);
    ctx.fillRect(W - 60, 0, 60, H);
    ctx.globalAlpha = 0.15;
    ctx.fillRect(0, 0, W, 30);
    ctx.fillRect(0, H - 30, W, 30);
    ctx.globalAlpha = 1.0;

    // Ground texture
    for (let i = 0; i < 80; i++) {
      const gx = Math.floor(Math.random() * W);
      const gy = ceilH + 30 + Math.floor(Math.random() * (H - ceilH - 30));
      ctx.fillStyle = varyColor(floorCol, 12);
      ctx.fillRect(gx, gy, 2 + Math.floor(Math.random() * 3), 1);
    }
  }

  // ─── Battle background (full screen) ─────────────────────────────

  private static drawBattleBg(ctx: CanvasRenderingContext2D, pal: RegionPalette, rid: string, isBoss: boolean): void {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    let [skyCol, horizonCol, groundCol] = pal.battleBg;

    // Boss variant: darken palette by 15%
    if (isBoss) {
      skyCol = darken(skyCol, 0.15);
      horizonCol = darken(horizonCol, 0.15);
      groundCol = darken(groundCol, 0.15);
    }

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

    // ── Region-specific terrain features ──
    const accentDark = darken(pal.accent, 0.3);
    const accentMid = darken(pal.accent, 0.15);

    switch (rid) {
      case 'region_hero': {
        // Castle turrets silhouette on horizon
        const turrets = [120, 280, 500, 720, 880];
        ctx.fillStyle = accentDark;
        for (const tx of turrets) {
          const tw = 18 + Math.floor(Math.random() * 12);
          const th = 40 + Math.floor(Math.random() * 30);
          ctx.fillRect(tx, skyH - th, tw, th);
          // Pointed roof
          ctx.fillRect(tx - 2, skyH - th - 6, tw + 4, 6);
          ctx.fillRect(tx + 2, skyH - th - 12, tw - 4, 6);
        }
        // Battlements between turrets
        ctx.fillStyle = darken(horizonCol, 0.25);
        ctx.fillRect(80, skyH - 20, 850, 20);
        for (let bx = 80; bx < 930; bx += 16) {
          ctx.fillRect(bx, skyH - 28, 8, 8);
        }
        break;
      }

      case 'region_elf': {
        // Tall pine tree silhouettes
        const trees = [60, 150, 320, 470, 600, 780, 920];
        ctx.fillStyle = accentDark;
        for (const tx of trees) {
          const th = 50 + Math.floor(Math.random() * 40);
          // Trunk
          ctx.fillRect(tx - 3, skyH - 8, 6, 8);
          // Triangular canopy (layered)
          for (let ly = 0; ly < 4; ly++) {
            const lw = 10 + ly * 8;
            ctx.fillRect(tx - lw / 2, skyH - 8 - th + ly * (th / 4), lw, th / 4 + 2);
          }
        }
        break;
      }

      case 'region_treant': {
        // Ancient twisted trees with hanging moss
        const trees = [100, 350, 650, 900];
        ctx.fillStyle = accentDark;
        for (const tx of trees) {
          const th = 60 + Math.floor(Math.random() * 30);
          // Wide curved trunk
          ctx.fillRect(tx - 8, skyH - 12, 16, 12);
          ctx.fillRect(tx - 12, skyH - th, 24, th - 12);
          // Broad canopy
          ctx.fillRect(tx - 30, skyH - th - 15, 60, 20);
          ctx.fillRect(tx - 22, skyH - th - 25, 44, 12);
          // Hanging moss (vertical lines)
          ctx.fillStyle = darken(accentMid, 0.1);
          for (let mx = tx - 25; mx < tx + 25; mx += 6) {
            const mh = 10 + Math.floor(Math.random() * 15);
            ctx.fillRect(mx, skyH - th - 10, 1, mh);
          }
          ctx.fillStyle = accentDark;
        }
        break;
      }

      case 'region_beast': {
        // Tall grass tufts + distant watchtower
        ctx.fillStyle = accentDark;
        for (let gx = 20; gx < W; gx += 30 + Math.floor(Math.random() * 20)) {
          const gh = 8 + Math.floor(Math.random() * 12);
          ctx.fillRect(gx, skyH - gh, 3, gh);
          ctx.fillRect(gx + 4, skyH - gh + 3, 2, gh - 3);
          ctx.fillRect(gx - 3, skyH - gh + 5, 2, gh - 5);
        }
        // Watchtower
        ctx.fillRect(750, skyH - 80, 14, 80);
        ctx.fillRect(742, skyH - 90, 30, 12);
        break;
      }

      case 'region_merfolk': {
        // Underwater coral + light rays from above
        ctx.fillStyle = accentDark;
        const corals = [80, 200, 400, 560, 730, 890];
        for (const cx of corals) {
          const ch = 30 + Math.floor(Math.random() * 30);
          // Branching vertical shapes from bottom
          ctx.fillRect(cx, H - ch, 6, ch);
          ctx.fillRect(cx - 8, H - ch + 10, 5, ch - 10);
          ctx.fillRect(cx + 8, H - ch + 6, 4, ch - 6);
        }
        // Light rays from above (semi-transparent diagonal beams)
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#aaddff';
        for (let rx = 100; rx < W; rx += 180) {
          ctx.save();
          ctx.translate(rx, 0);
          ctx.transform(1, 0, -0.3, 1, 0, 0);
          ctx.fillRect(0, 0, 40, H * 0.7);
          ctx.restore();
        }
        ctx.globalAlpha = 1.0;
        break;
      }

      case 'region_giant': {
        // Rocky peaks + boulders
        ctx.fillStyle = accentDark;
        const peaks = [100, 300, 520, 700, 900];
        for (const px of peaks) {
          const ph = 50 + Math.floor(Math.random() * 40);
          ctx.fillRect(px - 20, skyH - ph, 40, ph);
          ctx.fillRect(px - 12, skyH - ph - 15, 24, 15);
          ctx.fillRect(px - 6, skyH - ph - 22, 12, 8);
        }
        // Ground boulders
        ctx.fillStyle = accentMid;
        for (let bx = 50; bx < W; bx += 120 + Math.floor(Math.random() * 80)) {
          const bw = 20 + Math.floor(Math.random() * 20);
          const bh = 12 + Math.floor(Math.random() * 10);
          ctx.fillRect(bx, skyH + 40 + Math.floor(Math.random() * 60), bw, bh);
        }
        break;
      }

      case 'region_dwarf': {
        // Cave ceiling (stalactites) + crystal clusters
        ctx.fillStyle = accentDark;
        // Stalactites from top
        for (let sx = 20; sx < W; sx += 25 + Math.floor(Math.random() * 30)) {
          const sh = 20 + Math.floor(Math.random() * 40);
          const sw = 4 + Math.floor(Math.random() * 6);
          ctx.fillRect(sx, 0, sw, sh);
          ctx.fillRect(sx + 1, sh, sw - 2, 4);
        }
        // Crystal clusters (bright rectangles)
        ctx.fillStyle = lighten(pal.accent, 0.3);
        const crystals = [150, 400, 650, 850];
        for (const cx of crystals) {
          ctx.fillRect(cx, skyH + 20, 4, 14);
          ctx.fillRect(cx + 6, skyH + 24, 3, 10);
          ctx.fillRect(cx - 4, skyH + 28, 3, 8);
        }
        break;
      }

      case 'region_undead': {
        // Dead trees + gravestones
        ctx.fillStyle = accentDark;
        const deadTrees = [120, 380, 650, 870];
        for (const tx of deadTrees) {
          const th = 40 + Math.floor(Math.random() * 30);
          ctx.fillRect(tx - 3, skyH - th, 6, th);
          // Bare branches
          ctx.fillRect(tx - 15, skyH - th + 8, 12, 3);
          ctx.fillRect(tx + 3, skyH - th + 4, 14, 3);
          ctx.fillRect(tx - 10, skyH - th + 16, 8, 2);
        }
        // Gravestones
        ctx.fillStyle = accentMid;
        for (let gx = 60; gx < W; gx += 80 + Math.floor(Math.random() * 60)) {
          ctx.fillRect(gx, skyH - 10, 10, 12);
          ctx.fillRect(gx + 2, skyH - 14, 6, 4);
          // Cross on top
          ctx.fillRect(gx + 4, skyH - 18, 2, 6);
          ctx.fillRect(gx + 2, skyH - 16, 6, 2);
        }
        break;
      }

      case 'region_volcano': {
        // Lava pools (orange glow) + smoke plumes
        ctx.fillStyle = '#cc4400';
        ctx.globalAlpha = 0.6;
        const pools = [150, 400, 700, 900];
        for (const px of pools) {
          const pw = 30 + Math.floor(Math.random() * 20);
          ctx.fillRect(px - pw / 2, skyH + 60, pw, 8);
          // Glow above
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = '#ff6600';
          ctx.fillRect(px - pw / 2 - 5, skyH + 50, pw + 10, 12);
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = '#cc4400';
        }
        ctx.globalAlpha = 1.0;
        // Smoke plumes
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#888888';
        for (const px of pools) {
          for (let sy = 0; sy < 4; sy++) {
            const sw = 12 + sy * 6;
            ctx.fillRect(px - sw / 2, skyH + 30 - sy * 15, sw, 12);
          }
        }
        ctx.globalAlpha = 1.0;
        break;
      }

      case 'region_hotspring': {
        // Steam columns + hot pool
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#ffffff';
        for (let sx = 100; sx < W; sx += 200) {
          for (let sy = 0; sy < 6; sy++) {
            const sw = 15 + sy * 4;
            ctx.fillRect(sx - sw / 2, skyH - sy * 20, sw, 16);
          }
        }
        ctx.globalAlpha = 1.0;
        // Blue-tinted hot pool at ground level
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#4488aa';
        ctx.fillRect(200, skyH + 50, 250, 14);
        ctx.fillRect(600, skyH + 60, 200, 12);
        ctx.globalAlpha = 1.0;
        break;
      }

      case 'region_mountain': {
        // Snow-capped peaks + pine trees
        ctx.fillStyle = accentDark;
        const peaks = [80, 250, 450, 680, 880];
        for (const px of peaks) {
          const ph = 60 + Math.floor(Math.random() * 50);
          // Mountain body
          ctx.fillRect(px - 30, skyH - ph, 60, ph);
          ctx.fillRect(px - 20, skyH - ph - 15, 40, 15);
          ctx.fillRect(px - 10, skyH - ph - 25, 20, 10);
          // Snow cap
          ctx.fillStyle = '#eeeeff';
          ctx.fillRect(px - 8, skyH - ph - 25, 16, 12);
          ctx.fillStyle = accentDark;
        }
        // Small pine trees in foreground
        ctx.fillStyle = darken(accentDark, 0.1);
        for (let tx = 40; tx < W; tx += 70 + Math.floor(Math.random() * 40)) {
          ctx.fillRect(tx - 2, skyH - 4, 4, 4);
          ctx.fillRect(tx - 6, skyH - 14, 12, 10);
          ctx.fillRect(tx - 4, skyH - 20, 8, 8);
        }
        break;
      }

      case 'region_demon': {
        // Dark pillars + ominous runes (glowing red dots)
        ctx.fillStyle = accentDark;
        const pillars = [100, 300, 500, 700, 900];
        for (const px of pillars) {
          const ph = 80 + Math.floor(Math.random() * 40);
          ctx.fillRect(px - 8, skyH - ph, 16, ph);
          ctx.fillRect(px - 12, skyH - ph, 24, 6);
          ctx.fillRect(px - 12, skyH - 6, 24, 6);
        }
        // Glowing runes
        ctx.fillStyle = '#cc2222';
        ctx.globalAlpha = 0.7;
        for (const px of pillars) {
          ctx.fillRect(px - 2, skyH - 50, 4, 4);
          ctx.fillRect(px - 2, skyH - 38, 4, 4);
          ctx.fillRect(px - 2, skyH - 26, 4, 4);
        }
        ctx.globalAlpha = 1.0;
        break;
      }
    }

    // ── Boss-only: vignette + lightning ──
    if (isBoss) {
      // Vignette: dark borders
      const vigSize = 80;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, vigSize);          // top
      ctx.fillRect(0, H - vigSize, W, vigSize); // bottom
      ctx.fillRect(0, 0, vigSize, H);           // left
      ctx.fillRect(W - vigSize, 0, vigSize, H); // right
      ctx.globalAlpha = 0.12;
      ctx.fillRect(0, 0, W, vigSize / 2);
      ctx.fillRect(0, H - vigSize / 2, W, vigSize / 2);
      ctx.globalAlpha = 1.0;

      // Lightning bolts (2-3 jagged lines across sky)
      ctx.strokeStyle = lighten(pal.accent, 0.5);
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4;
      for (let li = 0; li < 3; li++) {
        const startX = 100 + li * 350 + Math.floor(Math.random() * 80);
        let lx = startX;
        let ly = 10 + Math.floor(Math.random() * 30);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        for (let seg = 0; seg < 6; seg++) {
          lx += -20 + Math.floor(Math.random() * 40);
          ly += 30 + Math.floor(Math.random() * 25);
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
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
