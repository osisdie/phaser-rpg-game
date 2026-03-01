import Phaser from 'phaser';
import { TILE_SIZE } from '../../config';
import { MEDIEVAL, darken, lighten, varyColor, blendColors, getRegionPalette } from '../palettes';
import { ArtRegistry } from '../index';

/** Generates medieval building textures (Tudor houses, castles, shops, trees, rocks) */
export class BuildingRenderer {

  static generateAll(scene: Phaser.Scene): void {
    // Decorations (shared across all regions)
    this.generateTree(scene, 'deco_tree_green', '#3a7a2a', '#2a5a1a', '#5a3a1a');
    this.generateTree(scene, 'deco_tree_dark', '#1a5a1a', '#0a3a0a', '#4a3a2a');
    this.generateTree(scene, 'deco_tree_autumn', '#aa6622', '#884411', '#5a3a1a');
    this.generateTree(scene, 'deco_tree_dead', '#444444', '#333333', '#3a2a1a');
    this.generateTree(scene, 'deco_tree_snow', '#aabbcc', '#8899aa', '#5a4a3a');

    this.generateRock(scene, 'deco_rock', MEDIEVAL.stoneMedium, MEDIEVAL.stoneDark);
    this.generateRock(scene, 'deco_rock_dark', '#555555', '#333333');

    this.generateFlowerPatch(scene, 'deco_flowers', '#3a7a2a');
    this.generateWell(scene, 'deco_well');
    this.generateStump(scene, 'deco_stump');
    this.generateLargeRock(scene, 'deco_large_rock', '#888888', '#555555');
    this.generateBush(scene, 'deco_bush_green', '#3a7a2a');
    this.generateBush(scene, 'deco_bush_dark', '#1a5a1a');
    this.generateWaterTile(scene, 'deco_water', '#336688');

    // Region-specific buildings (4 variants each) + trees
    const regions = [
      'region_hero', 'region_elf', 'region_treant', 'region_beast',
      'region_merfolk', 'region_giant', 'region_dwarf', 'region_undead',
      'region_volcano', 'region_hotspring', 'region_mountain', 'region_demon',
    ];
    for (const rid of regions) {
      const pal = getRegionPalette(rid);
      this.generateTree(scene, `deco_tree_${rid}`, pal.tree[1], darken(pal.tree[1], 0.2), pal.tree[0]);
      this.generateBush(scene, `deco_bush_${rid}`, pal.tree[1]);

      // Building colors: warm medieval base tinted with kingdom palette
      const bldFrame = blendColors(MEDIEVAL.woodMedium, pal.wall[0], 0.3);
      const bldWall  = blendColors(MEDIEVAL.parchment, pal.wall[2], 0.2);
      const bldRoof  = blendColors(MEDIEVAL.roofMedium, pal.accent, 0.4);
      const bldStone = blendColors(MEDIEVAL.stoneMedium, pal.wall[1], 0.35);

      // Castle per region (5×5 tile for town center, 3×3 for world map)
      this.generateCastle(scene, `bld_castle_${rid}`, bldStone, darken(bldStone, 0.1), pal.accent, 5);
      this.generateCastle(scene, `bld_castle_sm_${rid}`, bldStone, darken(bldStone, 0.1), pal.accent, 3);

      // Town entrance gate (3×2 tile archway with kingdom banner)
      this.generateGate(scene, `bld_gate_${rid}`, bldStone, darken(bldStone, 0.1), pal.accent);

      // 4 building variants per region — different roof styles, details, accents
      this.generateBuilding(scene, `bld_region_${rid}_0`, bldFrame, bldWall, bldRoof, pal.accent, 'peaked');
      this.generateBuilding(scene, `bld_region_${rid}_1`, darken(bldFrame, 0.1), bldWall, darken(bldRoof, 0.05), pal.accent, 'flat');
      this.generateBuilding(scene, `bld_region_${rid}_2`, lighten(bldFrame, 0.1), lighten(bldWall, 0.05), lighten(bldRoof, 0.05), pal.accent, 'gabled');
      this.generateBuilding(scene, `bld_region_${rid}_3`, darken(bldFrame, 0.15), darken(bldWall, 0.1), darken(bldRoof, 0.1), pal.accent, 'tower');

      // Keep legacy key pointing to variant 0
      if (!scene.textures.exists(`bld_region_${rid}`)) {
        this.generateBuilding(scene, `bld_region_${rid}`, bldFrame, bldWall, bldRoof, pal.accent, 'peaked');
      }

      // Typed buildings — inn, shop, church with distinguishing signs
      this.generateBuilding(scene, `bld_inn_${rid}`, bldFrame, bldWall, bldRoof, pal.accent, 'peaked', 'inn');
      this.generateBuilding(scene, `bld_shop_${rid}`, lighten(bldFrame, 0.1), lighten(bldWall, 0.05), lighten(bldRoof, 0.05), pal.accent, 'gabled', 'shop');
      this.generateBuilding(scene, `bld_church_${rid}`, darken(bldFrame, 0.15), darken(bldWall, 0.1), darken(bldRoof, 0.1), pal.accent, 'tower', 'church');
    }

    // Water feature decorations
    this.generatePond(scene, 'deco_pond');
    this.generateHotSpring(scene, 'deco_hotspring');
    this.generateWaterfall(scene, 'deco_waterfall');

    // Generic fallback buildings (only used if no region is specified)
    this.generateBuilding(scene, 'bld_tudor', MEDIEVAL.woodMedium, MEDIEVAL.parchment, MEDIEVAL.roofMedium, MEDIEVAL.gold, 'peaked');
    this.generateBuilding(scene, 'bld_shop', MEDIEVAL.woodLight, MEDIEVAL.parchmentLight, MEDIEVAL.roofDark, MEDIEVAL.gold, 'flat');
    this.generateBuilding(scene, 'bld_castle', MEDIEVAL.stoneMedium, MEDIEVAL.stoneLight, MEDIEVAL.stoneDark, MEDIEVAL.gold, 'tower');
    this.generateBuilding(scene, 'bld_inn', MEDIEVAL.woodDark, MEDIEVAL.parchmentDark, MEDIEVAL.roofLight, MEDIEVAL.gold, 'gabled');
  }

  /** Generate a 2×2 tile building with transparent background, kingdom colors, and asymmetric design */
  private static generateBuilding(
    scene: Phaser.Scene, key: string,
    frameColor: string, wallColor: string, roofColor: string,
    accentColor: string, roofStyle: 'peaked' | 'flat' | 'gabled' | 'tower',
    signType?: 'inn' | 'shop' | 'church',
  ): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);

    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);
    const margin = r(8);
    // Asymmetry seed based on roof style — different variants look different
    const asymDir = roofStyle === 'peaked' || roofStyle === 'tower' ? -1 : 1; // door offset direction
    const doorOffX = asymDir * r(5);

    // ── Ground shadow (semi-transparent oval) ──
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    fillOval(ctx, margin - r(2), H - r(7), W - margin * 2 + r(4), r(9));

    // ── Chimney (only peaked/gabled, on one side) ──
    if (roofStyle === 'peaked' || roofStyle === 'gabled') {
      const chimX = roofStyle === 'peaked' ? W - margin - r(6) : margin + r(2);
      ctx.fillStyle = darken(wallColor, 0.2);
      ctx.fillRect(chimX, r(2), r(5), r(14));
      ctx.fillStyle = darken(wallColor, 0.3);
      ctx.fillRect(chimX - 1, r(2), r(7), r(2)); // chimney cap
      // Smoke wisps
      ctx.fillStyle = 'rgba(180,180,180,0.3)';
      ctx.fillRect(chimX + 1, 0, r(2), r(2));
    }

    // ── Roof ──
    const roofH = roofStyle === 'tower' ? Math.floor(H * 0.25) : Math.floor(H * 0.33);
    const roofBase = roofStyle === 'flat' ? r(3) : 0;

    if (roofStyle === 'peaked') {
      for (let y = roofBase; y < roofH; y++) {
        const rt = y / roofH;
        const indent = margin + Math.floor((1 - rt) * (W / 2 - margin) * 0.65);
        ctx.fillStyle = varyColor(roofColor, 5);
        ctx.fillRect(indent, y, Math.max(1, W - indent * 2), 1);
      }
    } else if (roofStyle === 'flat') {
      for (let y = roofBase; y < roofH; y++) {
        ctx.fillStyle = varyColor(roofColor, 5);
        ctx.fillRect(margin - r(2), y, W - (margin - r(2)) * 2, 1);
      }
      ctx.fillStyle = darken(roofColor, 0.15);
      for (let x = margin - r(2); x < W - margin + r(2); x += r(4)) {
        ctx.fillRect(x, roofBase, r(2), r(4));
      }
    } else if (roofStyle === 'gabled') {
      for (let y = 0; y < roofH; y++) {
        const rt = y / roofH;
        const indent = margin + Math.floor((1 - rt) * (W / 2 - margin) * 0.85);
        ctx.fillStyle = varyColor(roofColor, 5);
        ctx.fillRect(indent, y, Math.max(1, W - indent * 2), 1);
      }
      ctx.fillStyle = lighten(roofColor, 0.15);
      ctx.fillRect(W / 2 - 1, 0, r(2), r(4));
    } else {
      for (let y = 0; y < roofH; y++) {
        const rt = y / roofH;
        const indent = margin + r(2) + Math.floor((1 - rt) * (W / 2 - margin - r(4)) * 0.5);
        ctx.fillStyle = varyColor(roofColor, 5);
        ctx.fillRect(indent, y, Math.max(1, W - indent * 2), 1);
      }
      ctx.fillStyle = accentColor;
      ctx.fillRect(W / 2 - 1, 0, r(2), r(3));
    }

    // Roof edge
    ctx.fillStyle = darken(roofColor, 0.25);
    ctx.fillRect(margin - 1, roofH - 1, W - (margin - 1) * 2, r(2));

    // ── Walls with subtle color variation ──
    const wallTop = roofH;
    const wallBot = H - r(5);
    for (let y = wallTop; y < wallBot; y++) {
      for (let x = margin; x < W - margin; x++) {
        const edgeDist = Math.min(x - margin, W - margin - 1 - x, y - wallTop);
        if (edgeDist === 0 && (x + y) % 2 === 0) continue;
        ctx.fillStyle = varyColor(wallColor, 4);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Wall shading
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(margin, wallTop, r(4), wallBot - wallTop);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(W - margin - r(4), wallTop, r(4), wallBot - wallTop);

    // ── Timber frame ──
    ctx.fillStyle = frameColor;
    ctx.fillRect(margin, wallTop, r(2), wallBot - wallTop);
    ctx.fillRect(W - margin - r(2), wallTop, r(2), wallBot - wallTop);
    const beamY = wallTop + Math.floor((wallBot - wallTop) * 0.45);
    ctx.fillRect(margin, beamY, W - margin * 2, r(2));

    // ── Windows — asymmetric placement with colorful shutters ──
    const winY = wallTop + r(6);
    // Left window (all styles)
    const lwx = margin + r(6);
    ctx.fillStyle = '#223355';
    ctx.fillRect(lwx, winY, r(4), r(5));
    ctx.fillStyle = darken(frameColor, 0.1);
    ctx.fillRect(lwx - 1, winY - 1, r(6), 1);
    ctx.fillRect(lwx - 1, winY + r(5), r(6), 1);
    // Left window shutters (accent color)
    ctx.fillStyle = accentColor;
    ctx.fillRect(lwx - r(3), winY, r(2), r(5));
    ctx.fillRect(lwx + r(5), winY, r(2), r(5));
    // Window cross
    ctx.fillStyle = darken(frameColor, 0.1);
    ctx.fillRect(lwx + r(1), winY, 1, r(5));

    // Right window — offset differently per style for asymmetry
    if (roofStyle !== 'tower') {
      const rwx = W - margin - r(11);
      ctx.fillStyle = '#223355';
      ctx.fillRect(rwx, winY, r(4), r(5));
      ctx.fillStyle = darken(frameColor, 0.1);
      ctx.fillRect(rwx - 1, winY - 1, r(6), 1);
      ctx.fillRect(rwx - 1, winY + r(5), r(6), 1);
      ctx.fillStyle = accentColor;
      ctx.fillRect(rwx - r(3), winY, r(2), r(5));
      ctx.fillRect(rwx + r(5), winY, r(2), r(5));
      ctx.fillStyle = darken(frameColor, 0.1);
      ctx.fillRect(rwx + r(1), winY, 1, r(5));
    } else {
      // Tower: single tall arched window
      const twx = W / 2 - r(2);
      ctx.fillStyle = '#223355';
      ctx.fillRect(twx, winY, r(4), r(9));
      ctx.fillStyle = darken(frameColor, 0.1);
      ctx.fillRect(twx - 1, winY - 1, r(6), 1);
    }

    // Window reflections
    ctx.fillStyle = 'rgba(150,180,220,0.35)';
    ctx.fillRect(lwx, winY + 1, 1, 1);

    // ── Door — offset for asymmetry ──
    const doorX = W / 2 - r(4) + doorOffX;
    const doorY = wallBot - r(15);
    // Colored door using accent
    ctx.fillStyle = darken(accentColor, 0.3);
    ctx.fillRect(doorX - 1, doorY - 1, r(10), r(16)); // frame
    ctx.fillStyle = darken(accentColor, 0.1);
    ctx.fillRect(doorX, doorY, r(8), r(14));
    ctx.fillStyle = darken(accentColor, 0.2);
    ctx.fillRect(doorX + r(3), doorY, 1, r(14)); // plank
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(doorX + r(6), doorY + r(7), 1, r(2)); // handle
    // Door arch for tower/gabled
    if (roofStyle === 'tower' || roofStyle === 'gabled') {
      ctx.fillStyle = darken(frameColor, 0.15);
      ctx.fillRect(doorX, doorY - r(2), r(8), r(2));
    }

    // ── Flower box under left window ──
    if (roofStyle === 'peaked' || roofStyle === 'flat') {
      ctx.fillStyle = darken(frameColor, 0.1);
      ctx.fillRect(lwx - r(2), winY + r(6), r(9), r(2));
      // Flowers using accent color
      ctx.fillStyle = lighten(accentColor, 0.2);
      ctx.fillRect(lwx - 1, winY + r(4), r(2), r(2));
      ctx.fillRect(lwx + r(2), winY + r(3), r(2), r(3));
      ctx.fillRect(lwx + r(5), winY + r(4), r(2), r(2));
    }

    // ── Hanging sign (shop-style, flat roof only) ──
    if (roofStyle === 'flat') {
      ctx.fillStyle = accentColor;
      ctx.fillRect(W / 2 - r(6), roofH + 1, r(12), r(4));
      ctx.fillStyle = darken(accentColor, 0.3);
      ctx.fillRect(W / 2 - 1, roofH - 1, r(2), r(3));
    }

    // ── Banner/flag (tower only, skip for church cross) ──
    if (roofStyle === 'tower' && signType !== 'church') {
      ctx.fillStyle = accentColor;
      ctx.fillRect(W / 2 + 1, 0, r(6), r(4));
      ctx.fillRect(W / 2 + 1, r(4), r(5), 1);
      ctx.fillStyle = lighten(accentColor, 0.2);
      ctx.fillRect(W / 2 + r(2), 1, r(2), r(2));
    }

    // ── Colored roof trim ──
    if (roofStyle === 'peaked' || roofStyle === 'gabled') {
      ctx.fillStyle = accentColor;
      for (let x = margin + r(2); x < W - margin - r(2); x += r(3)) {
        ctx.fillRect(x, roofH, r(2), r(2));
      }
    }

    // ── Lantern on one side ──
    if (roofStyle === 'gabled') {
      const lx = W - margin - r(3);
      const ly = beamY - r(4);
      ctx.fillStyle = MEDIEVAL.ironDark;
      ctx.fillRect(lx, ly, 1, r(4));
      ctx.fillStyle = '#ffcc44';
      ctx.fillRect(lx - 1, ly + 1, r(3), r(2));
    }

    // ── Foundation ──
    ctx.fillStyle = darken(wallColor, 0.25);
    ctx.fillRect(margin, wallBot, W - margin * 2, r(3));
    ctx.fillStyle = darken(wallColor, 0.15);
    ctx.fillRect(margin - 1, wallBot + 1, 1, r(2));
    ctx.fillRect(W - margin, wallBot + 1, 1, r(2));

    // ── Building type signs ──
    if (signType === 'inn') {
      // Hanging sign with mug icon
      const sX = doorX + r(12);
      ctx.fillStyle = MEDIEVAL.ironMedium;
      ctx.fillRect(sX, beamY, 1, r(6));
      ctx.fillStyle = MEDIEVAL.woodLight;
      ctx.fillRect(sX - r(4), beamY + r(6), r(9), r(6));
      ctx.fillStyle = MEDIEVAL.woodDark;
      ctx.fillRect(sX - r(4), beamY + r(6), r(9), 1);
      ctx.fillStyle = '#ffcc44';
      ctx.fillRect(sX - r(2), beamY + r(8), r(3), r(3));
      ctx.fillRect(sX + 1, beamY + r(9), 1, 1);
      // Warm door glow
      ctx.fillStyle = 'rgba(255,180,80,0.2)';
      ctx.fillRect(doorX - 1, wallBot - r(2), r(10), r(3));
    } else if (signType === 'shop') {
      // Hanging sign with sword icon
      const sX = W - margin - r(4);
      ctx.fillStyle = MEDIEVAL.ironMedium;
      ctx.fillRect(sX, beamY, 1, r(6));
      ctx.fillStyle = accentColor;
      ctx.fillRect(sX - r(5), beamY + r(6), r(8), r(5));
      ctx.fillStyle = darken(accentColor, 0.3);
      ctx.fillRect(sX - r(5), beamY + r(6), r(8), 1);
      ctx.fillStyle = '#ccccdd';
      ctx.fillRect(sX - r(2), beamY + r(7), 1, r(3));
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(sX - r(3), beamY + r(7), r(3), 1);
    } else if (signType === 'church') {
      // Cross on top of tower
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(W / 2 - 1, 0, r(3), r(8));
      ctx.fillRect(W / 2 - r(3), r(2), r(7), r(3));
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(W / 2, 0, 1, r(8));
      ctx.fillRect(W / 2 - r(3), r(3), r(7), 1);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a single-tile tree */
  private static generateTree(scene: Phaser.Scene, key: string, leafColor: string, leafDark: string, trunkColor: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    // Trunk
    ctx.fillStyle = trunkColor;
    ctx.fillRect(S / 2 - 2, S * 0.5, 4, S * 0.5);
    ctx.fillStyle = darken(trunkColor, 0.15);
    ctx.fillRect(S / 2 - 2, S * 0.5, 1, S * 0.5);

    // Canopy (layered ovals)
    const layers = [
      { y: S * 0.35, w: S * 0.6, h: S * 0.25, color: leafDark },
      { y: S * 0.2, w: S * 0.7, h: S * 0.3, color: leafColor },
      { y: S * 0.1, w: S * 0.5, h: S * 0.25, color: lighten(leafColor, 0.1) },
    ];

    for (const l of layers) {
      ctx.fillStyle = l.color;
      fillOval(ctx, S / 2 - l.w / 2, l.y, l.w, l.h);
    }

    // Highlight dots
    ctx.fillStyle = lighten(leafColor, 0.25);
    ctx.fillRect(S / 2 - 2, Math.round(S * 0.15), 2, 2);
    ctx.fillRect(S / 2 + 3, Math.round(S * 0.22), 1, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a rock decoration */
  private static generateRock(scene: Phaser.Scene, key: string, baseColor: string, darkColor: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    ctx.fillStyle = baseColor;
    fillOval(ctx, S * 0.15, S * 0.3, S * 0.7, S * 0.5);
    fillOval(ctx, S * 0.25, S * 0.2, S * 0.4, S * 0.35);

    // Shadow
    ctx.fillStyle = darkColor;
    fillOval(ctx, S * 0.2, S * 0.55, S * 0.6, S * 0.15);

    // Highlight
    ctx.fillStyle = lighten(baseColor, 0.2);
    ctx.fillRect(Math.round(S * 0.35), Math.round(S * 0.25), 3, 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a flower patch */
  private static generateFlowerPatch(scene: Phaser.Scene, key: string, grassColor: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    // Grass base
    ctx.fillStyle = grassColor;
    for (let i = 0; i < 8; i++) {
      const fx = Math.floor(Math.random() * (S - 2));
      const fy = Math.floor(Math.random() * (S - 4)) + 2;
      ctx.fillRect(fx, fy, 1, 3);
    }

    // Flowers
    const colors = [MEDIEVAL.flowerRed, MEDIEVAL.flowerYellow, MEDIEVAL.flowerWhite, MEDIEVAL.flowerPurple];
    for (let i = 0; i < 5; i++) {
      const fx = 4 + Math.floor(Math.random() * (S - 8));
      const fy = 4 + Math.floor(Math.random() * (S - 8));
      ctx.fillStyle = darken(grassColor, 0.1);
      ctx.fillRect(fx, fy + 2, 1, 3); // stem
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(fx - 1, fy, 3, 2); // petals
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a bush decoration */
  private static generateBush(scene: Phaser.Scene, key: string, leafColor: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    ctx.fillStyle = darken(leafColor, 0.15);
    fillOval(ctx, S * 0.1, S * 0.35, S * 0.8, S * 0.45);
    ctx.fillStyle = leafColor;
    fillOval(ctx, S * 0.15, S * 0.3, S * 0.65, S * 0.38);
    ctx.fillStyle = lighten(leafColor, 0.15);
    fillOval(ctx, S * 0.25, S * 0.28, S * 0.35, S * 0.2);
    // Berry dots
    ctx.fillStyle = '#cc3344';
    ctx.fillRect(Math.round(S * 0.3), Math.round(S * 0.45), 2, 2);
    ctx.fillRect(Math.round(S * 0.55), Math.round(S * 0.42), 2, 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a large rock (1.5× normal) */
  private static generateLargeRock(scene: Phaser.Scene, key: string, baseColor: string, darkColor: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    // Multiple overlapping shapes for a natural boulder
    ctx.fillStyle = darkColor;
    fillOval(ctx, S * 0.05, S * 0.2, S * 0.9, S * 0.65);
    ctx.fillStyle = baseColor;
    fillOval(ctx, S * 0.1, S * 0.15, S * 0.75, S * 0.55);
    fillOval(ctx, S * 0.2, S * 0.1, S * 0.5, S * 0.4);
    // Crack detail
    ctx.fillStyle = darken(baseColor, 0.2);
    ctx.fillRect(Math.round(S * 0.4), Math.round(S * 0.3), 1, Math.round(S * 0.25));
    // Highlight
    ctx.fillStyle = lighten(baseColor, 0.25);
    ctx.fillRect(Math.round(S * 0.25), Math.round(S * 0.18), 4, 3);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a water tile for rivers/ponds */
  private static generateWaterTile(scene: Phaser.Scene, key: string, waterColor: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    // Base water
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const wave = Math.sin(x * 0.4 + y * 0.2) * 8;
        ctx.fillStyle = varyColor(waterColor, 4 + Math.round(wave));
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Foam highlights
    ctx.fillStyle = 'rgba(200,230,255,0.25)';
    ctx.fillRect(Math.round(S * 0.2), Math.round(S * 0.3), 4, 1);
    ctx.fillRect(Math.round(S * 0.6), Math.round(S * 0.6), 3, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a dead stump for dark regions */
  private static generateStump(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    // Dead trunk
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(S / 2 - 3, S * 0.3, 6, S * 0.55);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(S / 2 - 4, S * 0.3, 8, 3); // top
    // Dead branches
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(S / 2 + 3, S * 0.35, 6, 2);
    ctx.fillRect(S / 2 - 7, S * 0.4, 5, 2);
    ctx.fillRect(S / 2 + 5, S * 0.28, 2, 4);
    // Hollow
    ctx.fillStyle = '#1a0a00';
    ctx.fillRect(S / 2 - 1, S * 0.5, 3, 4);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a castle (scalable: tiles=3 for 96px, tiles=5 for 160px) */
  static generateCastle(scene: Phaser.Scene, key: string, wallColor: string, roofColor: string, accentColor: string, tiles: number = 3): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * tiles;
    const H = TILE_SIZE * tiles;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const s = tiles / 3; // scale factor relative to original 3-tile size

    const m = Math.round(6 * s);
    const r = (v: number) => Math.round(v * s); // scale helper

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    fillOval(ctx, m, H - r(8), W - m * 2, r(12));

    // ── Main castle body ──
    const bodyTop = Math.round(H * 0.3);
    const bodyBot = H - r(6);
    for (let y = bodyTop; y < bodyBot; y++) {
      for (let x = m + r(10); x < W - m - r(10); x++) {
        ctx.fillStyle = varyColor(wallColor, 3);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // ── Left tower ──
    const towerW = r(18);
    const towerTop = Math.round(H * 0.15);
    for (let y = towerTop; y < bodyBot; y++) {
      for (let x = m; x < m + towerW; x++) {
        ctx.fillStyle = varyColor(wallColor, 3);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    for (let y = 0; y < towerTop; y++) {
      const rt = y / towerTop;
      const indent = m + Math.floor((1 - rt) * towerW * 0.4);
      ctx.fillStyle = varyColor(roofColor, 4);
      ctx.fillRect(indent, y, Math.max(1, m + towerW - indent - Math.floor((1 - rt) * towerW * 0.4)), 1);
    }

    // ── Right tower ──
    for (let y = towerTop; y < bodyBot; y++) {
      for (let x = W - m - towerW; x < W - m; x++) {
        ctx.fillStyle = varyColor(wallColor, 3);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    for (let y = 0; y < towerTop; y++) {
      const rt = y / towerTop;
      const indent = Math.floor((1 - rt) * towerW * 0.4);
      ctx.fillStyle = varyColor(roofColor, 4);
      ctx.fillRect(W - m - towerW + indent, y, Math.max(1, towerW - indent * 2), 1);
    }

    // ── Extra flanking towers (only for larger castles) ──
    if (tiles >= 5) {
      const fTowerW = r(12);
      const fTowerTop = Math.round(H * 0.22);
      // Far-left flanking tower
      for (let y = fTowerTop; y < bodyBot; y++) {
        for (let x = m + towerW + r(2); x < m + towerW + r(2) + fTowerW; x++) {
          ctx.fillStyle = varyColor(darken(wallColor, 0.05), 3);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      // Far-right flanking tower
      for (let y = fTowerTop; y < bodyBot; y++) {
        for (let x = W - m - towerW - r(2) - fTowerW; x < W - m - towerW - r(2); x++) {
          ctx.fillStyle = varyColor(darken(wallColor, 0.05), 3);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      // Flanking tower roofs
      ctx.fillStyle = darken(roofColor, 0.1);
      ctx.fillRect(m + towerW + r(2), fTowerTop - r(3), fTowerW, r(3));
      ctx.fillRect(W - m - towerW - r(2) - fTowerW, fTowerTop - r(3), fTowerW, r(3));
      // Flanking battlements
      ctx.fillStyle = lighten(wallColor, 0.1);
      for (let x = m + towerW + r(2); x < m + towerW + r(2) + fTowerW; x += r(5)) {
        ctx.fillRect(x, fTowerTop - r(5), r(3), r(2));
      }
      for (let x = W - m - towerW - r(2) - fTowerW; x < W - m - towerW - r(2); x += r(5)) {
        ctx.fillRect(x, fTowerTop - r(5), r(3), r(2));
      }
    }

    // ── Center tower (tallest) ──
    const cTowerW = r(22);
    const cTowerTop = Math.round(H * 0.08);
    const cTowerLeft = W / 2 - cTowerW / 2;
    for (let y = cTowerTop; y < bodyTop; y++) {
      for (let x = Math.round(cTowerLeft); x < Math.round(cTowerLeft + cTowerW); x++) {
        ctx.fillStyle = varyColor(lighten(wallColor, 0.05), 3);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    for (let y = 0; y < cTowerTop; y++) {
      const rt = y / cTowerTop;
      const w = Math.max(1, Math.round(cTowerW * rt * 0.5));
      ctx.fillStyle = varyColor(roofColor, 4);
      ctx.fillRect(Math.round(W / 2 - w / 2), y, w, 1);
    }

    // ── Battlements ──
    ctx.fillStyle = lighten(wallColor, 0.1);
    for (let x = m + r(12); x < W - m - r(12); x += r(5)) {
      ctx.fillRect(x, bodyTop - r(4), r(3), r(4));
    }
    for (let x = m; x < m + towerW; x += r(5)) {
      ctx.fillRect(x, towerTop - r(3), r(3), r(3));
    }
    for (let x = W - m - towerW; x < W - m; x += r(5)) {
      ctx.fillRect(x, towerTop - r(3), r(3), r(3));
    }

    // ── Windows ──
    ctx.fillStyle = '#1a2244';
    ctx.fillRect(m + r(5), towerTop + r(12), r(3), r(6));
    ctx.fillRect(m + r(10), towerTop + r(12), r(3), r(6));
    ctx.fillRect(W - m - r(8), towerTop + r(12), r(3), r(6));
    ctx.fillRect(W - m - r(13), towerTop + r(12), r(3), r(6));
    const winCount = tiles >= 5 ? 6 : 4;
    const winSpacing = Math.round((W - 2 * (m + r(18))) / winCount);
    for (let i = 0; i < winCount; i++) {
      const wx = m + r(18) + i * winSpacing;
      ctx.fillRect(wx, bodyTop + r(8), r(4), r(5));
      ctx.fillStyle = '#ffcc44';
      ctx.globalAlpha = 0.3;
      ctx.fillRect(wx + 1, bodyTop + r(9), r(2), r(3));
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1a2244';
    }
    ctx.fillRect(Math.round(W / 2 - r(2)), cTowerTop + r(6), r(4), r(8));

    // ── Grand door ──
    const gdW = r(16);
    const gdH = r(21);
    const gdX = Math.round(W / 2 - gdW / 2);
    const gdY = bodyBot - gdH - r(1);
    ctx.fillStyle = darken(accentColor, 0.3);
    ctx.fillRect(gdX - 1, gdY - 1, gdW + 2, gdH + 2);
    ctx.fillStyle = darken(accentColor, 0.1);
    ctx.fillRect(gdX, gdY, gdW, gdH);
    ctx.fillStyle = lighten(wallColor, 0.1);
    ctx.fillRect(gdX - r(2), gdY - r(3), gdW + r(4), r(3));
    ctx.fillStyle = darken(accentColor, 0.2);
    ctx.fillRect(gdX + Math.round(gdW / 2) - 1, gdY, 2, gdH);
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(gdX + Math.round(gdW * 0.3), gdY + Math.round(gdH * 0.5), r(2), r(2));
    ctx.fillRect(gdX + Math.round(gdW * 0.6), gdY + Math.round(gdH * 0.5), r(2), r(2));

    // ── Royal banner ──
    ctx.fillStyle = accentColor;
    ctx.fillRect(Math.round(W / 2 - r(4)), cTowerTop - r(2), r(8), r(6));
    ctx.fillStyle = lighten(accentColor, 0.3);
    ctx.fillRect(Math.round(W / 2 - r(2)), cTowerTop - 1, r(4), r(4));
    ctx.fillStyle = MEDIEVAL.ironMedium;
    ctx.fillRect(Math.round(W / 2), 0, 1, cTowerTop);

    // ── Throne inside door (visible on larger castles) ──
    if (tiles >= 5) {
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(gdX + Math.round(gdW / 2) - r(4), gdY + r(3), r(8), r(2));
      ctx.fillStyle = darken(accentColor, 0.2);
      ctx.fillRect(gdX + Math.round(gdW / 2) - r(3), gdY + r(5), r(6), r(8));
      ctx.fillStyle = MEDIEVAL.goldDark;
      ctx.fillRect(gdX + Math.round(gdW / 2) - r(3), gdY + r(3), r(1), r(10));
      ctx.fillRect(gdX + Math.round(gdW / 2) + r(2), gdY + r(3), r(1), r(10));
    }

    // ── Foundation ──
    ctx.fillStyle = darken(wallColor, 0.25);
    ctx.fillRect(m, bodyBot, W - m * 2, r(4));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a town gate archway (3×2 tiles) */
  private static generateGate(scene: Phaser.Scene, key: string, wallColor: string, roofColor: string, accentColor: string): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 3;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    const pillarW = r(14);
    // Left pillar
    for (let y = 0; y < H; y++) {
      for (let x = r(2); x < r(2) + pillarW; x++) {
        ctx.fillStyle = varyColor(wallColor, 3);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Right pillar
    for (let y = 0; y < H; y++) {
      for (let x = W - r(2) - pillarW; x < W - r(2); x++) {
        ctx.fillStyle = varyColor(wallColor, 3);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Arch beam
    ctx.fillStyle = darken(wallColor, 0.15);
    ctx.fillRect(r(2), 0, W - r(4), r(8));
    ctx.fillStyle = darken(roofColor, 0.1);
    ctx.fillRect(r(2), r(8), W - r(4), r(4));

    // Battlements on top
    ctx.fillStyle = lighten(wallColor, 0.1);
    for (let x = 0; x < W; x += r(6)) {
      ctx.fillRect(x, 0, r(4), r(4));
    }
    // Pillar caps
    ctx.fillStyle = lighten(wallColor, 0.15);
    ctx.fillRect(0, 0, r(18), r(2));
    ctx.fillRect(W - r(18), 0, r(18), r(2));

    // Kingdom banner
    ctx.fillStyle = accentColor;
    ctx.fillRect(W / 2 - r(8), r(12), r(16), r(12));
    ctx.fillStyle = lighten(accentColor, 0.3);
    ctx.fillRect(W / 2 - r(4), r(14), r(8), r(8));
    ctx.fillStyle = darken(accentColor, 0.3);
    ctx.fillRect(W / 2 - r(8), r(12), r(16), r(2));

    // Torch brackets on pillars
    ctx.fillStyle = MEDIEVAL.ironDark;
    ctx.fillRect(r(12), r(20), r(3), r(2));
    ctx.fillRect(W - r(15), r(20), r(3), r(2));
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(r(14), r(17), r(2), r(3));
    ctx.fillRect(W - r(14), r(17), r(2), r(3));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a stone well */
  private static generateWell(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    // Stone base
    ctx.fillStyle = MEDIEVAL.stoneMedium;
    fillOval(ctx, S * 0.15, S * 0.4, S * 0.7, S * 0.35);
    ctx.fillStyle = MEDIEVAL.stoneDark;
    fillOval(ctx, S * 0.2, S * 0.45, S * 0.6, S * 0.2);
    // Water inside
    ctx.fillStyle = MEDIEVAL.waterDark;
    fillOval(ctx, S * 0.25, S * 0.48, S * 0.5, S * 0.12);
    // Roof supports
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(Math.round(S * 0.2), Math.round(S * 0.1), 2, Math.round(S * 0.4));
    ctx.fillRect(Math.round(S * 0.75), Math.round(S * 0.1), 2, Math.round(S * 0.4));
    // Roof beam
    ctx.fillRect(Math.round(S * 0.15), Math.round(S * 0.1), Math.round(S * 0.7), 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }
  /** Generate a pond (circular water body) */
  private static generatePond(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        const dx = (px - S / 2) / (S * 0.4);
        const dy = (py - S / 2) / (S * 0.35);
        if (dx * dx + dy * dy > 1) continue;
        const wave = Math.sin(px * 0.5 + py * 0.3) * 6;
        ctx.fillStyle = varyColor(MEDIEVAL.waterMedium, 3 + Math.round(wave));
        ctx.fillRect(px, py, 1, 1);
      }
    }
    // Shore edge
    ctx.fillStyle = MEDIEVAL.dirtMedium;
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      ctx.fillRect(
        Math.round(S / 2 + Math.cos(a) * S * 0.4),
        Math.round(S / 2 + Math.sin(a) * S * 0.35), 1, 1,
      );
    }
    ctx.fillStyle = 'rgba(200,230,255,0.3)';
    ctx.fillRect(Math.round(S * 0.35), Math.round(S * 0.35), 3, 1);
    ctx.fillRect(Math.round(S * 0.55), Math.round(S * 0.45), 2, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a hot spring (steaming pond) */
  private static generateHotSpring(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        const dx = (px - S / 2) / (S * 0.38);
        const dy = (py - S / 2) / (S * 0.32);
        if (dx * dx + dy * dy > 1) continue;
        const wave = Math.sin(px * 0.4 + py * 0.2) * 5;
        ctx.fillStyle = varyColor('#448888', 4 + Math.round(wave));
        ctx.fillRect(px, py, 1, 1);
      }
    }
    ctx.fillStyle = '#776655';
    for (let a = 0; a < Math.PI * 2; a += 0.08) {
      const r = 1 + Math.random();
      ctx.fillRect(
        Math.round(S / 2 + Math.cos(a) * S * 0.38),
        Math.round(S / 2 + Math.sin(a) * S * 0.32),
        Math.round(r), Math.round(r),
      );
    }
    // Steam wisps
    ctx.fillStyle = 'rgba(220,240,255,0.25)';
    ctx.fillRect(Math.round(S * 0.3), Math.round(S * 0.15), 2, 4);
    ctx.fillRect(Math.round(S * 0.5), Math.round(S * 0.1), 2, 5);
    ctx.fillRect(Math.round(S * 0.65), Math.round(S * 0.18), 1, 3);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Generate a waterfall tile */
  private static generateWaterfall(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    // Rock face on sides
    ctx.fillStyle = '#666666';
    ctx.fillRect(0, 0, Math.round(S * 0.3), S);
    ctx.fillRect(Math.round(S * 0.7), 0, Math.round(S * 0.3), S);
    ctx.fillStyle = '#555555';
    ctx.fillRect(Math.round(S * 0.25), 0, Math.round(S * 0.08), S);
    ctx.fillRect(Math.round(S * 0.67), 0, Math.round(S * 0.08), S);

    // Cascading water
    for (let py = 0; py < S; py++) {
      for (let px = Math.round(S * 0.3); px < Math.round(S * 0.7); px++) {
        const shimmer = Math.sin(py * 0.8 + px * 0.3) * 8;
        ctx.fillStyle = varyColor(MEDIEVAL.waterLight, 5 + Math.round(shimmer));
        ctx.fillRect(px, py, 1, 1);
      }
    }
    // Foam at bottom
    ctx.fillStyle = 'rgba(220,240,255,0.5)';
    ctx.fillRect(Math.round(S * 0.2), S - 4, Math.round(S * 0.6), 4);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(Math.round(S * 0.4), S - 3, 3, 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }
}

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
