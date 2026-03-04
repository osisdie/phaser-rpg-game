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

      // Per-kingdom building style dispatch
      const genFn = this.getKingdomBuildingGenerator(rid);
      for (let vi = 0; vi < 4; vi++) {
        genFn.call(this, scene, `bld_region_${rid}_${vi}`, bldFrame, bldWall, bldRoof, bldStone, pal.accent, vi);
      }
      if (!scene.textures.exists(`bld_region_${rid}`)) {
        genFn.call(this, scene, `bld_region_${rid}`, bldFrame, bldWall, bldRoof, bldStone, pal.accent, 0);
      }
      // Typed buildings with signs
      genFn.call(this, scene, `bld_inn_${rid}`, bldFrame, bldWall, bldRoof, bldStone, pal.accent, 0, 'inn');
      genFn.call(this, scene, `bld_shop_${rid}`, bldFrame, bldWall, bldRoof, bldStone, pal.accent, 2, 'shop');
      genFn.call(this, scene, `bld_church_${rid}`, bldFrame, bldWall, bldRoof, bldStone, pal.accent, 3, 'church');

      // Per-region rocks & hot springs
      this.generateRock(scene, `deco_rock_${rid}`, bldStone, darken(bldStone, 0.2));
      this.generateHotSpring(scene, `deco_hotspring_${rid}`);
    }

    // Water feature decorations
    this.generatePond(scene, 'deco_pond');
    this.generateHotSpring(scene, 'deco_hotspring');
    this.generateWaterfall(scene, 'deco_waterfall');
    // Multi-tile terrain features
    this.generateWaterfallTop(scene, 'deco_waterfall_top');
    this.generateWaterfallMid(scene, 'deco_waterfall_mid');
    this.generateWaterfallBottom(scene, 'deco_waterfall_bottom');
    this.generateCaveEntrance(scene, 'deco_cave');
    this.generateDenseForest(scene, 'deco_dense_forest');

    // Kingdom-specific decorations
    this.generateTrainingDummy(scene, 'deco_training_dummy');
    this.generateVineArch(scene, 'deco_vine_arch');
    this.generateHangingLantern(scene, 'deco_hanging_lantern');
    this.generateAncientTree(scene, 'deco_ancient_tree');
    this.generateMushroomLarge(scene, 'deco_mushroom_large');
    this.generateFirePit(scene, 'deco_fire_pit');
    this.generateTotemPole(scene, 'deco_totem');
    this.generateArenaMarking(scene, 'deco_arena');
    this.generateCanalBridge(scene, 'deco_canal_bridge');
    this.generateDock(scene, 'deco_dock');
    this.generateCrystal(scene, 'deco_crystal');
    this.generateMineEntrance(scene, 'deco_mine_entrance_sm');
    this.generateGravestone(scene, 'deco_gravestone');
    this.generateLavaVent(scene, 'deco_lava_vent');
    this.generateBambooFence(scene, 'deco_bamboo_fence');
    this.generateStoneLantern(scene, 'deco_stone_lantern');
    this.generatePrayerFlag(scene, 'deco_prayer_flag');
    this.generateCairn(scene, 'deco_cairn');
    this.generateRuneCircle(scene, 'deco_rune_circle');

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

  // ─── Kingdom Building Style Dispatch ───

  private static getKingdomBuildingGenerator(rid: string): (
    scene: Phaser.Scene, key: string, frame: string, wall: string, roof: string,
    stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ) => void {
    switch (rid) {
      case 'region_elf': return this.generateElfBuilding;
      case 'region_treant': return this.generateTreantBuilding;
      case 'region_beast': return this.generateBeastHut;
      case 'region_merfolk': return this.generateMerfolkStiltHouse;
      case 'region_giant': return this.generateGiantStoneBlock;
      case 'region_dwarf': return this.generateDwarfBunker;
      case 'region_undead': return this.generateUndeadRuin;
      case 'region_volcano': return this.generateVolcanoFort;
      case 'region_hotspring': return this.generateHotspringBuilding;
      case 'region_mountain': return this.generateMountainChalet;
      case 'region_demon': return this.generateDemonSpire;
      default: return this.generateHeroBuilding;
    }
  }

  // ─── Hero Kingdom (Tudor wrapper) ───

  private static generateHeroBuilding(
    scene: Phaser.Scene, key: string, frame: string, wall: string, roof: string,
    _stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ): void {
    const roofStyles: ('peaked' | 'flat' | 'gabled' | 'tower')[] = ['peaked', 'flat', 'gabled', 'tower'];
    const f2 = [frame, darken(frame, 0.1), lighten(frame, 0.1), darken(frame, 0.15)];
    const w2 = [wall, wall, lighten(wall, 0.05), darken(wall, 0.1)];
    const r2 = [roof, darken(roof, 0.05), lighten(roof, 0.05), darken(roof, 0.1)];
    const vi = variant % 4;
    BuildingRenderer.generateBuilding(scene, key, f2[vi], w2[vi], r2[vi], accent, roofStyles[vi], signType);
  }

  // ─── Elf Kingdom — Treehouse style ───

  private static generateElfBuilding(
    scene: Phaser.Scene, key: string, frame: string, wall: string, roof: string,
    _stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);
    const vi = variant % 4;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    fillOval(ctx, r(6), H - r(7), W - r(12), r(9));

    // ── Tree trunk (slim, organic) ──
    const trunkW = r(12) + vi * r(1);
    const trunkX = W / 2 - trunkW / 2;
    const trunkTop = r(26);
    const trunkBot = H - r(4);
    for (let y = trunkTop; y < trunkBot; y++) {
      for (let x = trunkX; x < trunkX + trunkW; x++) {
        ctx.fillStyle = varyColor(darken(frame, 0.1), 5);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Bark streaks
    ctx.fillStyle = darken(frame, 0.25);
    ctx.fillRect(trunkX + r(2), trunkTop + r(4), 1, r(12));
    ctx.fillRect(trunkX + trunkW - r(3), trunkTop + r(8), 1, r(10));

    // ── Curved leaf canopy roof ──
    const canopyColor = blendColors(roof, '#44aa44', 0.4);
    const canopyTop = r(2);
    const canopyH = r(28);
    for (let y = canopyTop; y < canopyTop + canopyH; y++) {
      const rt = (y - canopyTop) / canopyH;
      const hw = (W / 2 - r(4)) * Math.sin(rt * Math.PI);
      ctx.fillStyle = varyColor(canopyColor, 5);
      ctx.fillRect(Math.round(W / 2 - hw), y, Math.max(1, Math.round(hw * 2)), 1);
    }
    // Canopy highlight
    ctx.fillStyle = lighten(canopyColor, 0.15);
    fillOval(ctx, W / 2 - r(10), canopyTop + r(4), r(20), r(10));

    // ── Platform / walls ──
    const platTop = trunkTop;
    const platBot = trunkTop + r(22);
    const platMargin = r(10);
    ctx.fillStyle = darken(wall, 0.05);
    ctx.fillRect(platMargin, platTop, W - platMargin * 2, platBot - platTop);
    // Wall texture
    for (let y = platTop; y < platBot; y++) {
      for (let x = platMargin + 1; x < W - platMargin - 1; x++) {
        if (Math.random() < 0.15) {
          ctx.fillStyle = varyColor(wall, 6);
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    // ── Round windows (ovals) ──
    const winY = platTop + r(5);
    ctx.fillStyle = '#223355';
    fillOval(ctx, platMargin + r(4), winY, r(5), r(5));
    if (vi !== 3) {
      fillOval(ctx, W - platMargin - r(9), winY, r(5), r(5));
    }
    // Window reflection
    ctx.fillStyle = 'rgba(150,200,220,0.35)';
    ctx.fillRect(platMargin + r(5), winY + 1, 1, 1);

    // ── Round hobbit-like door ──
    const doorX = W / 2 - r(5);
    const doorY = platBot - r(12);
    ctx.fillStyle = darken(accent, 0.3);
    fillOval(ctx, doorX - 1, doorY - 1, r(11), r(13));
    ctx.fillStyle = darken(accent, 0.1);
    fillOval(ctx, doorX, doorY, r(9), r(11));
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(doorX + r(6), doorY + r(5), 1, r(2)); // handle

    // ── Vine decorations ──
    ctx.fillStyle = '#44aa44';
    for (let y = platTop; y < platBot; y += r(3)) {
      ctx.fillRect(platMargin, y, 1, 1);
      ctx.fillRect(W - platMargin - 1, y, 1, 1);
    }
    ctx.fillStyle = '#338833';
    for (let y = platTop + 1; y < platBot; y += r(4)) {
      ctx.fillRect(platMargin + 1, y, 1, 1);
    }

    // ── Roots at base ──
    ctx.fillStyle = darken(frame, 0.15);
    ctx.fillRect(trunkX - r(4), trunkBot - r(3), r(4), r(3));
    ctx.fillRect(trunkX + trunkW, trunkBot - r(3), r(4), r(3));
    ctx.fillRect(trunkX - r(2), trunkBot - r(5), r(2), r(2));

    // ── Building type signs ──
    if (signType) {
      BuildingRenderer.drawBuildingSign(ctx, signType, accent, W, H, W / 2, platTop + r(14), doorX, platBot, f);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Treant Kingdom — Hollow tree trunk ───

  private static generateTreantBuilding(
    scene: Phaser.Scene, key: string, frame: string, wall: string, roof: string,
    _stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);
    const vi = variant % 4;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    fillOval(ctx, r(6), H - r(7), W - r(12), r(9));

    // ── Bark-textured trunk walls ──
    const trunkMargin = r(10) - vi * r(1);
    const trunkTop = r(18);
    const trunkBot = H - r(4);
    const barkBase = blendColors(wall, '#5a3a1a', 0.4);
    for (let y = trunkTop; y < trunkBot; y++) {
      for (let x = trunkMargin; x < W - trunkMargin; x++) {
        ctx.fillStyle = varyColor(barkBase, 6);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Dark bark streaks
    ctx.fillStyle = darken(barkBase, 0.2);
    for (let i = 0; i < 6; i++) {
      const sx = trunkMargin + r(3) + Math.floor(Math.random() * (W - trunkMargin * 2 - r(6)));
      const sy = trunkTop + r(4) + Math.floor(Math.random() * r(20));
      ctx.fillRect(sx, sy, 1, r(5) + Math.floor(Math.random() * r(6)));
    }

    // ── Leaf canopy at top (semicircle, no separate roof) ──
    const leafColor = blendColors(roof, '#225522', 0.5);
    for (let y = 0; y < trunkTop + r(6); y++) {
      const rt = y / (trunkTop + r(6));
      const hw = (W / 2 - r(2)) * Math.sin(rt * Math.PI * 0.5 + Math.PI * 0.5);
      ctx.fillStyle = varyColor(leafColor, 5);
      ctx.fillRect(Math.round(W / 2 - hw), y, Math.max(1, Math.round(hw * 2)), 1);
    }
    // Leaf highlights
    ctx.fillStyle = lighten(leafColor, 0.2);
    fillOval(ctx, W / 2 - r(8), r(3), r(16), r(8));

    // ── Oval door (tree hole) ──
    const doorW = r(10);
    const doorH = r(13);
    const doorX = W / 2 - doorW / 2;
    const doorY = trunkBot - doorH - r(1);
    ctx.fillStyle = '#1a0a00';
    fillOval(ctx, doorX - 1, doorY - 1, doorW + 2, doorH + 2);
    ctx.fillStyle = darken(accent, 0.4);
    fillOval(ctx, doorX, doorY, doorW, doorH);

    // ── Knothole windows ──
    ctx.fillStyle = '#1a1a00';
    fillOval(ctx, trunkMargin + r(4), trunkTop + r(6), r(5), r(4));
    if (vi < 3) {
      fillOval(ctx, W - trunkMargin - r(9), trunkTop + r(8), r(4), r(4));
    }

    // ── Root tendrils at base ──
    ctx.fillStyle = darken(barkBase, 0.15);
    ctx.fillRect(trunkMargin - r(5), trunkBot - r(4), r(6), r(4));
    ctx.fillRect(W - trunkMargin - r(1), trunkBot - r(3), r(6), r(3));
    ctx.fillRect(trunkMargin - r(3), trunkBot - r(2), r(3), r(2));
    ctx.fillRect(W - trunkMargin + r(1), trunkBot - r(4), r(3), r(2));
    // Small roots
    ctx.fillRect(W / 2 - r(8), trunkBot - r(1), r(3), r(2));
    ctx.fillRect(W / 2 + r(5), trunkBot - r(1), r(3), r(2));

    // ── Building type signs ──
    if (signType) {
      BuildingRenderer.drawBuildingSign(ctx, signType, accent, W, H, W / 2, trunkTop + r(14), doorX, trunkBot, f);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Beast Kingdom — Tribal hut ───

  private static generateBeastHut(
    scene: Phaser.Scene, key: string, frame: string, wall: string, roof: string,
    _stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);
    const vi = variant % 4;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    fillOval(ctx, r(6), H - r(7), W - r(12), r(9));

    // ── Short cylindrical walls (leather/hide) ──
    const wallMargin = r(12);
    const wallTop = r(30);
    const wallBot = H - r(5);
    const hideColor = blendColors(wall, '#8b6b3a', 0.3);
    for (let y = wallTop; y < wallBot; y++) {
      const curve = Math.sin(((y - wallTop) / (wallBot - wallTop)) * Math.PI) * r(2);
      for (let x = wallMargin - Math.round(curve); x < W - wallMargin + Math.round(curve); x++) {
        ctx.fillStyle = varyColor(hideColor, 4);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // ── Tall conical thatch roof ──
    const roofTop = r(2) + vi * r(1);
    const thatchColor = blendColors(roof, '#ccaa55', 0.3);
    for (let y = roofTop; y < wallTop + r(2); y++) {
      const rt = (y - roofTop) / (wallTop + r(2) - roofTop);
      const hw = r(4) + rt * (W / 2 - wallMargin + r(4));
      ctx.fillStyle = varyColor(thatchColor, 6);
      ctx.fillRect(Math.round(W / 2 - hw), y, Math.max(1, Math.round(hw * 2)), 1);
    }
    // Thatch texture (overlapping strokes)
    ctx.fillStyle = darken(thatchColor, 0.15);
    for (let y = roofTop + r(4); y < wallTop; y += r(4)) {
      const rt = (y - roofTop) / (wallTop - roofTop);
      const hw = r(4) + rt * (W / 2 - wallMargin + r(2));
      ctx.fillRect(Math.round(W / 2 - hw), y, Math.round(hw * 2), 1);
    }
    // Roof peak ornament
    ctx.fillStyle = darken(frame, 0.1);
    ctx.fillRect(W / 2 - 1, roofTop - r(2), r(2), r(4));

    // ── Wide doorway opening ──
    const doorW = r(12);
    const doorX = W / 2 - doorW / 2;
    const doorY = wallBot - r(14);
    ctx.fillStyle = '#1a1008';
    ctx.fillRect(doorX, doorY, doorW, wallBot - doorY);
    // Door frame (leather flap suggestion)
    ctx.fillStyle = darken(hideColor, 0.2);
    ctx.fillRect(doorX - 1, doorY, 1, wallBot - doorY);
    ctx.fillRect(doorX + doorW, doorY, 1, wallBot - doorY);

    // ── Small slat windows ──
    ctx.fillStyle = '#1a1a08';
    ctx.fillRect(wallMargin + r(3), wallTop + r(4), r(4), r(2));
    if (vi !== 3) {
      ctx.fillRect(W - wallMargin - r(7), wallTop + r(4), r(4), r(2));
    }

    // ── Bone/tusk decorations above door ──
    ctx.fillStyle = '#eeddcc';
    ctx.fillRect(doorX - r(2), doorY - r(3), 1, r(3));
    ctx.fillRect(doorX + doorW + r(1), doorY - r(3), 1, r(3));
    // Horizontal bone
    ctx.fillRect(doorX - r(1), doorY - r(3), doorW + r(2), 1);
    // Small tusks
    ctx.fillStyle = '#ddccbb';
    ctx.fillRect(doorX + r(2), doorY - r(5), 1, r(2));
    ctx.fillRect(doorX + doorW - r(3), doorY - r(5), 1, r(2));

    // ── Foundation ──
    ctx.fillStyle = darken(hideColor, 0.2);
    ctx.fillRect(wallMargin - r(1), wallBot, W - (wallMargin - r(1)) * 2, r(3));

    // ── Building type signs ──
    if (signType) {
      BuildingRenderer.drawBuildingSign(ctx, signType, accent, W, H, W / 2, wallTop + r(10), doorX, wallBot, f);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Merfolk Kingdom — Stilt house ───

  private static generateMerfolkStiltHouse(
    scene: Phaser.Scene, key: string, frame: string, wall: string, roof: string,
    _stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);
    const vi = variant % 4;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    fillOval(ctx, r(6), H - r(7), W - r(12), r(9));

    // ── Water hint at base ──
    ctx.fillStyle = 'rgba(60,100,140,0.2)';
    ctx.fillRect(r(4), H - r(8), W - r(8), r(6));

    // ── Wooden stilts (4 poles) ──
    const stiltTop = r(32);
    const stiltBot = H - r(4);
    const stiltColor = darken(frame, 0.1);
    const stiltPositions = [r(14), r(24), W - r(26), W - r(16)];
    for (const sx of stiltPositions) {
      ctx.fillStyle = stiltColor;
      ctx.fillRect(sx, stiltTop, r(2), stiltBot - stiltTop);
      ctx.fillStyle = darken(stiltColor, 0.15);
      ctx.fillRect(sx, stiltTop, 1, stiltBot - stiltTop);
    }
    // Cross braces
    ctx.fillStyle = darken(stiltColor, 0.1);
    ctx.fillRect(stiltPositions[0], stiltTop + r(10), stiltPositions[3] - stiltPositions[0] + r(2), 1);

    // ── Elevated platform ──
    const platY = stiltTop - r(2);
    ctx.fillStyle = frame;
    ctx.fillRect(r(10), platY, W - r(20), r(3));

    // ── Walls (coral-tinted) ──
    const wallMargin = r(12);
    const wallTop = r(10);
    const wallBot = platY;
    const coralWall = blendColors(wall, '#cc8888', 0.2);
    for (let y = wallTop; y < wallBot; y++) {
      for (let x = wallMargin; x < W - wallMargin; x++) {
        ctx.fillStyle = varyColor(coralWall, 4);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // ── Shell-tile roof (overlapping scales) ──
    const roofTop = r(1);
    const roofBot = wallTop + r(2);
    const scaleColor = blendColors(roof, '#6699cc', 0.3);
    for (let y = roofTop; y < roofBot; y++) {
      const rt = (y - roofTop) / (roofBot - roofTop);
      const indent = r(6) + Math.floor((1 - rt) * r(14));
      ctx.fillStyle = varyColor(scaleColor, 4);
      ctx.fillRect(indent, y, W - indent * 2, 1);
    }
    // Scale pattern
    ctx.fillStyle = darken(scaleColor, 0.12);
    for (let row = 0; row < 3; row++) {
      const sy = roofTop + r(2) + row * r(3);
      const off = row % 2 === 0 ? 0 : r(3);
      for (let x = r(8) + off; x < W - r(8); x += r(6)) {
        fillOval(ctx, x, sy, r(5), r(3));
      }
    }
    // Roof edge
    ctx.fillStyle = darken(scaleColor, 0.2);
    ctx.fillRect(r(6), roofBot - 1, W - r(12), r(2));

    // ── Circular porthole windows ──
    ctx.fillStyle = '#223355';
    fillOval(ctx, wallMargin + r(4), wallTop + r(4), r(5), r(5));
    if (vi < 3) {
      fillOval(ctx, W - wallMargin - r(9), wallTop + r(4), r(5), r(5));
    }
    // Porthole rim
    ctx.fillStyle = darken(frame, 0.1);
    ctx.fillRect(wallMargin + r(4), wallTop + r(4), r(5), 1);
    ctx.fillRect(wallMargin + r(4), wallTop + r(8), r(5), 1);

    // ── Door (elevated, with ladder) ──
    const doorW = r(8);
    const doorX = W / 2 - doorW / 2;
    const doorY = wallBot - r(13);
    ctx.fillStyle = darken(accent, 0.2);
    ctx.fillRect(doorX, doorY, doorW, wallBot - doorY);
    ctx.fillStyle = darken(accent, 0.1);
    ctx.fillRect(doorX + 1, doorY + 1, doorW - 2, wallBot - doorY - 2);
    // Ladder
    ctx.fillStyle = frame;
    ctx.fillRect(doorX + r(1), wallBot, r(1), stiltBot - wallBot - r(2));
    ctx.fillRect(doorX + doorW - r(2), wallBot, r(1), stiltBot - wallBot - r(2));
    for (let ly = wallBot + r(3); ly < stiltBot - r(3); ly += r(4)) {
      ctx.fillRect(doorX + r(1), ly, doorW - r(2), 1);
    }

    // ── Building type signs ──
    if (signType) {
      BuildingRenderer.drawBuildingSign(ctx, signType, accent, W, H, W / 2, wallTop + r(10), doorX, wallBot, f);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Giant Kingdom — Massive stone block ───

  private static generateGiantStoneBlock(
    scene: Phaser.Scene, key: string, _frame: string, wall: string, roof: string,
    stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);
    const vi = variant % 4;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    fillOval(ctx, r(4), H - r(7), W - r(8), r(9));

    const margin = r(6);
    const wallTop = r(12);
    const wallBot = H - r(5);
    const stoneColor = blendColors(stone, wall, 0.3);

    // ── Rough-hewn stone walls with large brick pattern ──
    for (let y = wallTop; y < wallBot; y++) {
      for (let x = margin; x < W - margin; x++) {
        ctx.fillStyle = varyColor(stoneColor, 5);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Large brick lines (mortar)
    ctx.fillStyle = darken(stoneColor, 0.15);
    for (let y = wallTop; y < wallBot; y += r(7)) {
      ctx.fillRect(margin, y, W - margin * 2, 1);
    }
    for (let row = 0; row < 6; row++) {
      const by = wallTop + row * r(7);
      const off = row % 2 === 0 ? 0 : r(8);
      for (let x = margin + r(4) + off; x < W - margin; x += r(16)) {
        ctx.fillRect(x, by, 1, r(7));
      }
    }

    // ── Flat heavy stone slab roof ──
    const roofH = wallTop;
    const slabColor = darken(roof, 0.1 + vi * 0.02);
    ctx.fillStyle = slabColor;
    ctx.fillRect(margin - r(3), r(4), W - (margin - r(3)) * 2, roofH - r(3));
    // Roof texture
    for (let y = r(4); y < roofH; y++) {
      ctx.fillStyle = varyColor(slabColor, 3);
      ctx.fillRect(margin - r(3), y, W - (margin - r(3)) * 2, 1);
    }
    // Roof edge
    ctx.fillStyle = darken(slabColor, 0.2);
    ctx.fillRect(margin - r(4), roofH - r(2), W - (margin - r(4)) * 2, r(3));

    // ── Small slit windows (arrow loops) ──
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(margin + r(6), wallTop + r(8), r(2), r(8));
    if (vi !== 3) {
      ctx.fillRect(W - margin - r(8), wallTop + r(8), r(2), r(8));
    }
    // Faint glow
    ctx.fillStyle = 'rgba(180,180,200,0.15)';
    ctx.fillRect(margin + r(6), wallTop + r(9), r(2), r(4));

    // ── Extra-large iron-banded door ──
    const doorW = r(12);
    const doorH = r(18);
    const doorX = W / 2 - doorW / 2;
    const doorY = wallBot - doorH;
    ctx.fillStyle = darken(accent, 0.4);
    ctx.fillRect(doorX - 1, doorY - 1, doorW + 2, doorH + 2);
    ctx.fillStyle = darken(accent, 0.2);
    ctx.fillRect(doorX, doorY, doorW, doorH);
    // Iron bands
    ctx.fillStyle = MEDIEVAL.ironDark;
    ctx.fillRect(doorX, doorY + r(3), doorW, r(2));
    ctx.fillRect(doorX, doorY + r(9), doorW, r(2));
    ctx.fillRect(doorX, doorY + r(15), doorW, r(2));
    // Door ring
    ctx.fillStyle = MEDIEVAL.ironMedium;
    ctx.fillRect(doorX + doorW - r(4), doorY + r(7), r(2), r(3));

    // ── Iron brackets at corners ──
    ctx.fillStyle = MEDIEVAL.ironDark;
    ctx.fillRect(margin, wallTop, r(4), r(2));
    ctx.fillRect(margin, wallTop, r(2), r(4));
    ctx.fillRect(W - margin - r(4), wallTop, r(4), r(2));
    ctx.fillRect(W - margin - r(2), wallTop, r(2), r(4));
    ctx.fillRect(margin, wallBot - r(4), r(2), r(4));
    ctx.fillRect(W - margin - r(2), wallBot - r(4), r(2), r(4));

    // ── Foundation ──
    ctx.fillStyle = darken(stoneColor, 0.25);
    ctx.fillRect(margin - 1, wallBot, W - (margin - 1) * 2, r(3));

    // ── Building type signs ──
    if (signType) {
      const beamY = wallTop + Math.floor((wallBot - wallTop) * 0.45);
      BuildingRenderer.drawBuildingSign(ctx, signType, accent, W, H, W / 2, beamY, doorX, wallBot, f);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Dwarf Kingdom — Mine bunker ───

  private static generateDwarfBunker(
    scene: Phaser.Scene, key: string, frame: string, wall: string, roof: string,
    stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);
    const vi = variant % 4;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    fillOval(ctx, r(6), H - r(7), W - r(12), r(9));

    const margin = r(7);
    const roofH = r(12);
    const wallTop = roofH;
    const wallBot = H - r(5);
    const stoneWall = blendColors(stone, wall, 0.4);

    // ── Reinforced stone walls ──
    for (let y = wallTop; y < wallBot; y++) {
      for (let x = margin; x < W - margin; x++) {
        ctx.fillStyle = varyColor(stoneWall, 4);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Stone mortar lines
    ctx.fillStyle = darken(stoneWall, 0.1);
    for (let y = wallTop + r(5); y < wallBot; y += r(5)) {
      ctx.fillRect(margin, y, W - margin * 2, 1);
    }

    // ── Metal plate patches ──
    ctx.fillStyle = MEDIEVAL.ironMedium;
    ctx.fillRect(margin + r(2), wallTop + r(3), r(6), r(4));
    ctx.fillRect(W - margin - r(8), wallBot - r(12), r(6), r(4));
    // Rivets on plates
    ctx.fillStyle = lighten(MEDIEVAL.ironMedium, 0.2);
    ctx.fillRect(margin + r(3), wallTop + r(4), 1, 1);
    ctx.fillRect(margin + r(6), wallTop + r(4), 1, 1);

    // ── Low flat roof with chimney stacks ──
    ctx.fillStyle = darken(roof, 0.1);
    ctx.fillRect(margin - r(2), r(4), W - (margin - r(2)) * 2, roofH - r(3));
    // Roof texture
    ctx.fillStyle = darken(roof, 0.15);
    ctx.fillRect(margin - r(2), roofH - r(1), W - (margin - r(2)) * 2, r(2));
    // Multiple chimneys
    const chimneyCount = 2 + (vi % 2);
    for (let ci = 0; ci < chimneyCount; ci++) {
      const cx = margin + r(6) + ci * r(14);
      ctx.fillStyle = MEDIEVAL.ironDark;
      ctx.fillRect(cx, 0, r(4), r(6));
      ctx.fillStyle = MEDIEVAL.ironMedium;
      ctx.fillRect(cx - 1, 0, r(6), r(2));
      // Smoke
      ctx.fillStyle = 'rgba(180,180,180,0.25)';
      ctx.fillRect(cx + 1, 0, r(2), r(1));
    }

    // ── Heavy metal-banded door ──
    const doorW = r(10);
    const doorX = W / 2 - doorW / 2;
    const doorY = wallBot - r(15);
    ctx.fillStyle = darken(frame, 0.3);
    ctx.fillRect(doorX - 1, doorY - 1, doorW + 2, wallBot - doorY + 1);
    ctx.fillStyle = darken(frame, 0.15);
    ctx.fillRect(doorX, doorY, doorW, wallBot - doorY - 1);
    // Metal bands
    ctx.fillStyle = MEDIEVAL.ironDark;
    ctx.fillRect(doorX, doorY + r(2), doorW, r(1));
    ctx.fillRect(doorX, doorY + r(7), doorW, r(1));
    ctx.fillRect(doorX, doorY + r(12), doorW, r(1));
    // Handle
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(doorX + doorW - r(3), doorY + r(6), r(2), r(2));

    // ── Gear/cog decoration on wall ──
    ctx.fillStyle = MEDIEVAL.ironMedium;
    const gearX = W - margin - r(10);
    const gearY = wallTop + r(6);
    fillOval(ctx, gearX, gearY, r(6), r(6));
    ctx.fillStyle = darken(stoneWall, 0.05);
    fillOval(ctx, gearX + r(1), gearY + r(1), r(4), r(4));
    // Gear teeth
    ctx.fillStyle = MEDIEVAL.ironMedium;
    ctx.fillRect(gearX + r(2), gearY - 1, r(2), 1);
    ctx.fillRect(gearX + r(2), gearY + r(6), r(2), 1);
    ctx.fillRect(gearX - 1, gearY + r(2), 1, r(2));
    ctx.fillRect(gearX + r(6), gearY + r(2), 1, r(2));

    // ── Lantern hooks ──
    ctx.fillStyle = MEDIEVAL.ironDark;
    ctx.fillRect(margin + r(1), wallTop + r(12), r(3), 1);
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(margin + r(3), wallTop + r(10), r(2), r(2));

    // ── Foundation ──
    ctx.fillStyle = darken(stoneWall, 0.25);
    ctx.fillRect(margin - 1, wallBot, W - (margin - 1) * 2, r(3));

    // ── Building type signs ──
    if (signType) {
      const beamY = wallTop + Math.floor((wallBot - wallTop) * 0.45);
      BuildingRenderer.drawBuildingSign(ctx, signType, accent, W, H, W / 2, beamY, doorX, wallBot, f);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Undead Kingdom — Ruined Gothic ───

  private static generateUndeadRuin(
    scene: Phaser.Scene, key: string, frame: string, wall: string, roof: string,
    stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);
    const vi = variant % 4;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    fillOval(ctx, r(6), H - r(7), W - r(12), r(9));

    const margin = r(8);
    const roofH = Math.floor(H * 0.3);
    const wallTop = roofH;
    const wallBot = H - r(5);
    const ruinWall = darken(wall, 0.15);

    // ── Crumbling walls with gaps ──
    for (let y = wallTop; y < wallBot; y++) {
      for (let x = margin; x < W - margin; x++) {
        // Random holes in walls
        const holeChance = (x > W - margin - r(6) && y < wallTop + r(8)) ? 0.35 : 0.03;
        if (Math.random() < holeChance) continue;
        ctx.fillStyle = varyColor(ruinWall, 6);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Crack lines
    ctx.fillStyle = darken(ruinWall, 0.2);
    ctx.fillRect(margin + r(10), wallTop + r(3), 1, r(12));
    ctx.fillRect(W - margin - r(8), wallTop + r(6), 1, r(10));

    // ── Crooked/damaged roof (tilted, with holes) ──
    const tilt = r(2) * (vi % 2 === 0 ? 1 : -1);
    for (let y = 0; y < roofH; y++) {
      const rt = y / roofH;
      const indent = margin + Math.floor((1 - rt) * (W / 2 - margin) * 0.6);
      const roofLine = Math.round(y + tilt * rt);
      if (roofLine < 0 || roofLine >= H) continue;
      // Skip some pixels for holes
      for (let x = indent; x < W - indent; x++) {
        if (Math.random() < 0.04) continue;
        ctx.fillStyle = varyColor(darken(roof, 0.1), 5);
        ctx.fillRect(x, roofLine, 1, 1);
      }
    }
    // Roof edge (broken)
    ctx.fillStyle = darken(roof, 0.3);
    for (let x = margin; x < W - margin; x++) {
      if (Math.random() < 0.15) continue;
      ctx.fillRect(x, roofH - 1 + Math.round(tilt), 1, r(2));
    }

    // ── Broken door ──
    const doorX = W / 2 - r(4);
    const doorY = wallBot - r(14);
    ctx.fillStyle = darken(accent, 0.4);
    ctx.fillRect(doorX, doorY, r(8), wallBot - doorY);
    // Missing planks
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(doorX + r(1), doorY + r(2), r(2), r(4));
    ctx.fillRect(doorX + r(5), doorY + r(8), r(2), r(3));

    // ── Cracked windows ──
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(margin + r(6), wallTop + r(5), r(4), r(5));
    if (vi < 3) {
      ctx.fillRect(W - margin - r(10), wallTop + r(5), r(4), r(5));
    }
    // Cracks through windows
    ctx.fillStyle = darken(ruinWall, 0.1);
    ctx.fillRect(margin + r(7), wallTop + r(5), 1, r(5));
    ctx.fillRect(margin + r(6), wallTop + r(7), r(4), 1);

    // ── Cobweb patches ──
    ctx.fillStyle = 'rgba(200,200,200,0.15)';
    // Top-left corner cobweb
    for (let i = 0; i < r(6); i++) {
      ctx.fillRect(margin + i, wallTop + i, 1, 1);
      ctx.fillRect(margin, wallTop + i, i + 1, 1);
    }
    // Top-right corner
    for (let i = 0; i < r(5); i++) {
      ctx.fillRect(W - margin - 1 - i, wallTop + i, 1, 1);
    }

    // ── Debris at base ──
    ctx.fillStyle = darken(ruinWall, 0.1);
    for (let i = 0; i < 5; i++) {
      const dx = margin + Math.floor(Math.random() * (W - margin * 2));
      ctx.fillRect(dx, wallBot + 1, r(2), r(1));
    }

    // ── Foundation (crumbling) ──
    ctx.fillStyle = darken(ruinWall, 0.25);
    for (let x = margin - 1; x < W - margin + 1; x++) {
      if (Math.random() < 0.1) continue;
      ctx.fillRect(x, wallBot, 1, r(3));
    }

    // ── Building type signs ──
    if (signType) {
      const beamY = wallTop + Math.floor((wallBot - wallTop) * 0.45);
      BuildingRenderer.drawBuildingSign(ctx, signType, accent, W, H, W / 2, beamY, doorX, wallBot, f);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Volcano Kingdom — Obsidian fortification ───

  private static generateVolcanoFort(
    scene: Phaser.Scene, key: string, frame: string, wall: string, roof: string,
    stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);
    const vi = variant % 4;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    fillOval(ctx, r(6), H - r(7), W - r(12), r(9));

    const margin = r(8);
    const wallTop = r(14);
    const wallBot = H - r(5);
    const obsidian = blendColors(wall, '#1a1a22', 0.5);

    // ── Angular black/dark stone walls ──
    for (let y = wallTop; y < wallBot; y++) {
      for (let x = margin; x < W - margin; x++) {
        ctx.fillStyle = varyColor(obsidian, 3);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Glowing red mortar lines
    ctx.fillStyle = 'rgba(200,60,20,0.4)';
    for (let y = wallTop + r(5); y < wallBot; y += r(6)) {
      ctx.fillRect(margin, y, W - margin * 2, 1);
    }
    for (let row = 0; row < 5; row++) {
      const by = wallTop + row * r(6);
      const off = row % 2 === 0 ? 0 : r(6);
      for (let x = margin + r(4) + off; x < W - margin; x += r(12)) {
        ctx.fillStyle = 'rgba(200,60,20,0.35)';
        ctx.fillRect(x, by, 1, r(6));
      }
    }

    // ── Flat angular battlements roof ──
    ctx.fillStyle = darken(obsidian, 0.1);
    ctx.fillRect(margin - r(2), r(6), W - (margin - r(2)) * 2, wallTop - r(5));
    // Battlement merlons
    ctx.fillStyle = obsidian;
    for (let x = margin - r(2); x < W - margin + r(2); x += r(6)) {
      ctx.fillRect(x, r(2), r(4), r(5));
    }

    // ── Iron grate door ──
    const doorW = r(10);
    const doorX = W / 2 - doorW / 2;
    const doorY = wallBot - r(15);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(doorX, doorY, doorW, wallBot - doorY);
    // Grate bars (vertical)
    ctx.fillStyle = MEDIEVAL.ironDark;
    for (let x = doorX; x < doorX + doorW; x += r(2)) {
      ctx.fillRect(x, doorY, 1, wallBot - doorY);
    }
    // Grate bars (horizontal)
    for (let y = doorY; y < wallBot; y += r(3)) {
      ctx.fillRect(doorX, y, doorW, 1);
    }
    // Door frame
    ctx.fillStyle = darken(obsidian, 0.2);
    ctx.fillRect(doorX - 1, doorY - 1, doorW + 2, 1);
    ctx.fillRect(doorX - 1, doorY, 1, wallBot - doorY);
    ctx.fillRect(doorX + doorW, doorY, 1, wallBot - doorY);

    // ── Narrow arrow-slit windows with red/orange glow ──
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(margin + r(5), wallTop + r(6), r(2), r(8));
    if (vi < 3) {
      ctx.fillRect(W - margin - r(7), wallTop + r(6), r(2), r(8));
    }
    // Red glow
    ctx.fillStyle = 'rgba(255,80,20,0.35)';
    ctx.fillRect(margin + r(5), wallTop + r(7), r(2), r(5));
    if (vi < 3) {
      ctx.fillRect(W - margin - r(7), wallTop + r(7), r(2), r(5));
    }

    // ── Foundation ──
    ctx.fillStyle = darken(obsidian, 0.2);
    ctx.fillRect(margin - 1, wallBot, W - (margin - 1) * 2, r(3));

    // ── Building type signs ──
    if (signType) {
      const beamY = wallTop + Math.floor((wallBot - wallTop) * 0.45);
      BuildingRenderer.drawBuildingSign(ctx, signType, accent, W, H, W / 2, beamY, doorX, wallBot, f);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Hotspring Kingdom — Japanese-inspired ───

  private static generateHotspringBuilding(
    scene: Phaser.Scene, key: string, frame: string, wall: string, roof: string,
    _stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);
    const vi = variant % 4;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    fillOval(ctx, r(6), H - r(7), W - r(12), r(9));

    const margin = r(8);
    const roofH = Math.floor(H * 0.35);
    const wallTop = roofH;
    const wallBot = H - r(5);
    const woodColor = blendColors(wall, '#ccaa77', 0.3);

    // ── Wooden panel walls (light wood, horizontal planks) ──
    for (let y = wallTop; y < wallBot; y++) {
      for (let x = margin; x < W - margin; x++) {
        ctx.fillStyle = varyColor(woodColor, 3);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Horizontal plank lines
    ctx.fillStyle = darken(woodColor, 0.1);
    for (let y = wallTop + r(3); y < wallBot; y += r(4)) {
      ctx.fillRect(margin, y, W - margin * 2, 1);
    }

    // ── Curved tile roof (pagoda-style) ──
    const roofColor = darken(roof, 0.05 + vi * 0.02);
    for (let y = r(3); y < roofH; y++) {
      const rt = (y - r(3)) / (roofH - r(3));
      // Gentle upward curve at edges
      const curve = Math.pow(rt, 0.7);
      const halfW = (W / 2 - r(2)) * curve;
      const edgeLift = Math.round((1 - rt) * r(2) * (1 - Math.abs(rt - 0.5) * 2));
      ctx.fillStyle = varyColor(roofColor, 4);
      ctx.fillRect(Math.round(W / 2 - halfW), y - edgeLift, Math.max(1, Math.round(halfW * 2)), 1);
    }
    // Roof ridge
    ctx.fillStyle = darken(roofColor, 0.2);
    ctx.fillRect(W / 2 - r(8), r(3), r(16), r(2));
    // Roof edge with upward curve
    ctx.fillStyle = darken(roofColor, 0.25);
    ctx.fillRect(margin - r(4), roofH - 1, W - (margin - r(4)) * 2, r(2));
    // Edge ornaments (upturned tips)
    ctx.fillRect(margin - r(5), roofH - r(3), r(3), r(2));
    ctx.fillRect(W - margin + r(2), roofH - r(3), r(3), r(2));

    // ── Sliding door ──
    const doorW = r(10);
    const doorX = W / 2 - doorW / 2;
    const doorY = wallBot - r(14);
    ctx.fillStyle = darken(accent, 0.1);
    ctx.fillRect(doorX, doorY, doorW, wallBot - doorY);
    // Thin vertical lines (sliding panels)
    ctx.fillStyle = darken(woodColor, 0.15);
    ctx.fillRect(doorX + Math.floor(doorW / 3), doorY, 1, wallBot - doorY);
    ctx.fillRect(doorX + Math.floor(doorW * 2 / 3), doorY, 1, wallBot - doorY);
    // Frame
    ctx.fillStyle = darken(frame, 0.1);
    ctx.fillRect(doorX - 1, doorY - 1, doorW + 2, 1);
    ctx.fillRect(doorX - 1, doorY, 1, wallBot - doorY);
    ctx.fillRect(doorX + doorW, doorY, 1, wallBot - doorY);

    // ── Rice-paper windows ──
    const winY = wallTop + r(4);
    // Left window
    ctx.fillStyle = 'rgba(240,235,220,0.7)';
    ctx.fillRect(margin + r(4), winY, r(8), r(6));
    // Grid
    ctx.fillStyle = darken(frame, 0.1);
    ctx.fillRect(margin + r(8), winY, 1, r(6));
    ctx.fillRect(margin + r(4), winY + r(3), r(8), 1);
    // Frame
    ctx.fillRect(margin + r(3), winY - 1, r(10), 1);
    ctx.fillRect(margin + r(3), winY + r(6), r(10), 1);
    // Right window
    if (vi < 3) {
      ctx.fillStyle = 'rgba(240,235,220,0.7)';
      ctx.fillRect(W - margin - r(12), winY, r(8), r(6));
      ctx.fillStyle = darken(frame, 0.1);
      ctx.fillRect(W - margin - r(8), winY, 1, r(6));
      ctx.fillRect(W - margin - r(12), winY + r(3), r(8), 1);
      ctx.fillRect(W - margin - r(13), winY - 1, r(10), 1);
      ctx.fillRect(W - margin - r(13), winY + r(6), r(10), 1);
    }

    // ── Paper lantern hanging from roof edge ──
    const lanternX = margin + r(2);
    ctx.fillStyle = darken(frame, 0.1);
    ctx.fillRect(lanternX, roofH, 1, r(4));
    ctx.fillStyle = '#cc4422';
    ctx.fillRect(lanternX - r(1), roofH + r(4), r(3), r(4));
    ctx.fillStyle = lighten('#cc4422', 0.2);
    ctx.fillRect(lanternX, roofH + r(5), 1, r(2));

    // ── Foundation ──
    ctx.fillStyle = darken(woodColor, 0.2);
    ctx.fillRect(margin - 1, wallBot, W - (margin - 1) * 2, r(3));

    // ── Building type signs ──
    if (signType) {
      const beamY = wallTop + Math.floor((wallBot - wallTop) * 0.45);
      BuildingRenderer.drawBuildingSign(ctx, signType, accent, W, H, W / 2, beamY, doorX, wallBot, f);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Mountain Kingdom — Alpine chalet ───

  private static generateMountainChalet(
    scene: Phaser.Scene, key: string, frame: string, wall: string, roof: string,
    _stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);
    const vi = variant % 4;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    fillOval(ctx, r(6), H - r(7), W - r(12), r(9));

    const margin = r(8);
    // Steep A-frame roof takes ~55% of height
    const roofH = Math.floor(H * 0.55);
    const wallTop = roofH;
    const wallBot = H - r(5);

    // ── Horizontal log walls ──
    const logColor = blendColors(wall, '#aa7744', 0.3);
    for (let y = wallTop; y < wallBot; y++) {
      for (let x = margin; x < W - margin; x++) {
        ctx.fillStyle = varyColor(logColor, 3);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Visible log lines
    ctx.fillStyle = darken(logColor, 0.12);
    for (let y = wallTop + r(3); y < wallBot; y += r(4)) {
      ctx.fillRect(margin, y, W - margin * 2, 1);
    }
    // Round log ends on sides
    ctx.fillStyle = lighten(logColor, 0.1);
    for (let y = wallTop + r(1); y < wallBot - r(2); y += r(4)) {
      fillOval(ctx, margin - r(2), y, r(3), r(3));
      fillOval(ctx, W - margin - r(1), y, r(3), r(3));
    }

    // ── Steep A-frame roof ──
    for (let y = 0; y < roofH; y++) {
      const rt = y / roofH;
      const indent = margin - r(2) + Math.floor((1 - rt) * (W / 2 - margin + r(2)) * 0.95);
      ctx.fillStyle = varyColor(roof, 5);
      ctx.fillRect(indent, y, Math.max(1, W - indent * 2), 1);
    }
    // Roof ridge
    ctx.fillStyle = darken(roof, 0.2);
    ctx.fillRect(W / 2 - 1, 0, r(2), r(4));
    // Roof edge
    ctx.fillStyle = darken(roof, 0.25);
    ctx.fillRect(margin - r(3), roofH - 1, W - (margin - r(3)) * 2, r(2));

    // ── Snow patches on roof ──
    ctx.fillStyle = 'rgba(240,245,255,0.6)';
    for (let i = 0; i < 4 + vi; i++) {
      const sy = r(2) + Math.floor(Math.random() * (roofH * 0.5));
      const rt = sy / roofH;
      const indent = margin + Math.floor((1 - rt) * (W / 2 - margin) * 0.9);
      const sx = indent + r(4) + Math.floor(Math.random() * Math.max(1, W - indent * 2 - r(8)));
      ctx.fillRect(sx, sy, r(4) + Math.floor(Math.random() * r(4)), r(2));
    }

    // ── Heavy wooden door with iron hinges ──
    const doorW = r(8);
    const doorX = W / 2 - doorW / 2;
    const doorY = wallBot - r(12);
    ctx.fillStyle = darken(frame, 0.2);
    ctx.fillRect(doorX - 1, doorY - 1, doorW + 2, wallBot - doorY + 1);
    ctx.fillStyle = darken(frame, 0.05);
    ctx.fillRect(doorX, doorY, doorW, wallBot - doorY - 1);
    // Door planks
    ctx.fillStyle = darken(frame, 0.15);
    ctx.fillRect(doorX + Math.floor(doorW / 3), doorY, 1, wallBot - doorY);
    // Iron hinges
    ctx.fillStyle = MEDIEVAL.ironDark;
    ctx.fillRect(doorX - 1, doorY + r(2), r(3), r(1));
    ctx.fillRect(doorX - 1, doorY + r(8), r(3), r(1));
    // Handle
    ctx.fillStyle = MEDIEVAL.ironMedium;
    ctx.fillRect(doorX + doorW - r(3), doorY + r(5), r(2), r(2));

    // ── Shuttered windows ──
    const winY = wallTop + r(3);
    ctx.fillStyle = '#223355';
    ctx.fillRect(margin + r(4), winY, r(6), r(5));
    // Shutters (bigger)
    ctx.fillStyle = accent;
    ctx.fillRect(margin + r(1), winY - 1, r(3), r(6));
    ctx.fillRect(margin + r(10), winY - 1, r(3), r(6));
    if (vi < 3) {
      ctx.fillRect(W - margin - r(13), winY - 1, r(3), r(6));
      ctx.fillStyle = '#223355';
      ctx.fillRect(W - margin - r(10), winY, r(6), r(5));
      ctx.fillStyle = accent;
      ctx.fillRect(W - margin - r(4), winY - 1, r(3), r(6));
    }

    // ── Chimney ──
    ctx.fillStyle = darken(logColor, 0.25);
    ctx.fillRect(W - margin - r(4), r(4), r(5), roofH - r(6));
    ctx.fillStyle = darken(logColor, 0.3);
    ctx.fillRect(W - margin - r(5), r(4), r(7), r(2));
    // Smoke
    ctx.fillStyle = 'rgba(180,180,180,0.25)';
    ctx.fillRect(W - margin - r(3), r(1), r(2), r(3));

    // ── Foundation ──
    ctx.fillStyle = darken(logColor, 0.3);
    ctx.fillRect(margin - 1, wallBot, W - (margin - 1) * 2, r(3));

    // ── Building type signs ──
    if (signType) {
      const beamY = wallTop + Math.floor((wallBot - wallTop) * 0.4);
      BuildingRenderer.drawBuildingSign(ctx, signType, accent, W, H, W / 2, beamY, doorX, wallBot, f);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Demon Kingdom — Dark spire ───

  private static generateDemonSpire(
    scene: Phaser.Scene, key: string, frame: string, wall: string, roof: string,
    _stone: string, accent: string, variant: number, signType?: 'inn' | 'shop' | 'church',
  ): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);
    const vi = variant % 4;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    fillOval(ctx, r(6), H - r(7), W - r(12), r(9));

    const margin = r(9);
    const roofH = Math.floor(H * 0.4);
    const wallTop = roofH;
    const wallBot = H - r(5);
    const darkBrick = blendColors(wall, '#221122', 0.4);

    // ── Dark brick walls ──
    for (let y = wallTop; y < wallBot; y++) {
      for (let x = margin; x < W - margin; x++) {
        ctx.fillStyle = varyColor(darkBrick, 4);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Brick pattern
    ctx.fillStyle = darken(darkBrick, 0.12);
    for (let y = wallTop + r(3); y < wallBot; y += r(4)) {
      ctx.fillRect(margin, y, W - margin * 2, 1);
    }
    for (let row = 0; row < 8; row++) {
      const by = wallTop + row * r(4);
      const off = row % 2 === 0 ? 0 : r(5);
      for (let x = margin + r(3) + off; x < W - margin; x += r(10)) {
        ctx.fillRect(x, by, 1, r(4));
      }
    }

    // ── Pointed spike roof (narrow, dark purple/black) ──
    const spireColor = blendColors(roof, '#2a0a2a', 0.5);
    for (let y = 0; y < roofH; y++) {
      const rt = y / roofH;
      const hw = r(2) + rt * (W / 2 - margin + r(2));
      ctx.fillStyle = varyColor(spireColor, 3);
      ctx.fillRect(Math.round(W / 2 - hw), y, Math.max(1, Math.round(hw * 2)), 1);
    }
    // Spire peak
    ctx.fillStyle = darken(spireColor, 0.2);
    ctx.fillRect(W / 2 - 1, 0, r(2), r(4));

    // ── Spike decorations at roof edges ──
    ctx.fillStyle = darken(spireColor, 0.15);
    ctx.fillRect(margin - r(2), roofH - r(6), r(2), r(6));
    ctx.fillRect(W - margin, roofH - r(6), r(2), r(6));
    ctx.fillRect(W / 2 - r(8), roofH - r(4), r(2), r(4));
    ctx.fillRect(W / 2 + r(6), roofH - r(4), r(2), r(4));
    // Roof edge
    ctx.fillStyle = darken(spireColor, 0.25);
    ctx.fillRect(margin - r(3), roofH - 1, W - (margin - r(3)) * 2, r(2));

    // ── Arched entrance with horned frame ──
    const doorW = r(10);
    const doorX = W / 2 - doorW / 2;
    const doorY = wallBot - r(14);
    ctx.fillStyle = '#0a0008';
    ctx.fillRect(doorX, doorY, doorW, wallBot - doorY);
    // Arch top
    ctx.fillStyle = darken(darkBrick, 0.2);
    fillOval(ctx, doorX - r(1), doorY - r(4), doorW + r(2), r(6));
    ctx.fillStyle = '#0a0008';
    fillOval(ctx, doorX, doorY - r(3), doorW, r(4));
    // Horns on arch
    ctx.fillStyle = darken(darkBrick, 0.15);
    ctx.fillRect(doorX - r(2), doorY - r(5), r(2), r(4));
    ctx.fillRect(doorX + doorW, doorY - r(5), r(2), r(4));
    ctx.fillRect(doorX - r(3), doorY - r(7), r(1), r(3));
    ctx.fillRect(doorX + doorW + r(2), doorY - r(7), r(1), r(3));

    // ── Narrow glowing purple windows ──
    ctx.fillStyle = '#1a0a1a';
    ctx.fillRect(margin + r(4), wallTop + r(5), r(2), r(8));
    if (vi < 3) {
      ctx.fillRect(W - margin - r(6), wallTop + r(5), r(2), r(8));
    }
    // Purple glow
    ctx.fillStyle = 'rgba(150,50,200,0.35)';
    ctx.fillRect(margin + r(4), wallTop + r(6), r(2), r(5));
    if (vi < 3) {
      ctx.fillRect(W - margin - r(6), wallTop + r(6), r(2), r(5));
    }

    // ── Foundation ──
    ctx.fillStyle = darken(darkBrick, 0.25);
    ctx.fillRect(margin - 1, wallBot, W - (margin - 1) * 2, r(3));

    // ── Building type signs ──
    if (signType) {
      const beamY = wallTop + Math.floor((wallBot - wallTop) * 0.4);
      BuildingRenderer.drawBuildingSign(ctx, signType, accent, W, H, W / 2, beamY, doorX, wallBot, f);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Shared sign drawing helper ───

  private static drawBuildingSign(
    ctx: CanvasRenderingContext2D, signType: 'inn' | 'shop' | 'church',
    accent: string, W: number, H: number,
    _centerX: number, beamY: number, doorX: number, wallBot: number,
    fScale: number,
  ): void {
    const r = (v: number) => Math.round(v * fScale);
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
      const sX = W - r(8) - r(4);
      ctx.fillStyle = MEDIEVAL.ironMedium;
      ctx.fillRect(sX, beamY, 1, r(6));
      ctx.fillStyle = accent;
      ctx.fillRect(sX - r(5), beamY + r(6), r(8), r(5));
      ctx.fillStyle = darken(accent, 0.3);
      ctx.fillRect(sX - r(5), beamY + r(6), r(8), 1);
      ctx.fillStyle = '#ccccdd';
      ctx.fillRect(sX - r(2), beamY + r(7), 1, r(3));
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(sX - r(3), beamY + r(7), r(3), 1);
    } else if (signType === 'church') {
      // Cross on top
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(W / 2 - 1, 0, r(3), r(8));
      ctx.fillRect(W / 2 - r(3), r(2), r(7), r(3));
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(W / 2, 0, 1, r(8));
      ctx.fillRect(W / 2 - r(3), r(3), r(7), 1);
    }
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

  // ─── Multi-tile Terrain Features ───

  /** Waterfall top: cliff edge with water beginning to pour */
  private static generateWaterfallTop(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S * 2, S);
    // Rock cliff
    ctx.fillStyle = '#777777';
    ctx.fillRect(0, 0, S * 2, S);
    ctx.fillStyle = '#666666';
    ctx.fillRect(0, Math.round(S * 0.6), S * 2, Math.round(S * 0.4));
    // Cliff edge details
    ctx.fillStyle = '#888888';
    for (let x = 0; x < S * 2; x += 4) {
      const h = 2 + Math.floor(Math.random() * 3);
      ctx.fillRect(x, Math.round(S * 0.55), 3, h);
    }
    // Water beginning to pour (center gap)
    for (let py = Math.round(S * 0.6); py < S; py++) {
      for (let px = Math.round(S * 0.6); px < Math.round(S * 1.4); px++) {
        const shimmer = Math.sin(py * 0.6 + px * 0.2) * 6;
        ctx.fillStyle = varyColor(MEDIEVAL.waterLight, 3 + Math.round(shimmer));
        ctx.fillRect(px, py, 1, 1);
      }
    }
    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Waterfall middle: cascading water between rock walls */
  private static generateWaterfallMid(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S * 2, S);
    // Rock walls on sides
    ctx.fillStyle = '#666666';
    ctx.fillRect(0, 0, Math.round(S * 0.55), S);
    ctx.fillRect(Math.round(S * 1.45), 0, Math.round(S * 0.55), S);
    ctx.fillStyle = '#555555';
    ctx.fillRect(Math.round(S * 0.5), 0, Math.round(S * 0.1), S);
    ctx.fillRect(Math.round(S * 1.4), 0, Math.round(S * 0.1), S);
    // Cascading water (wider center)
    for (let py = 0; py < S; py++) {
      for (let px = Math.round(S * 0.6); px < Math.round(S * 1.4); px++) {
        const shimmer = Math.sin(py * 0.8 + px * 0.3) * 8;
        ctx.fillStyle = varyColor(MEDIEVAL.waterLight, 5 + Math.round(shimmer));
        ctx.fillRect(px, py, 1, 1);
      }
    }
    // White streaks
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 4; i++) {
      const sx = Math.round(S * 0.7 + Math.random() * S * 0.5);
      ctx.fillRect(sx, 0, 1, S);
    }
    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Waterfall bottom: splash pool */
  private static generateWaterfallBottom(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S * 2, S);
    // Ground
    ctx.fillStyle = '#555544';
    ctx.fillRect(0, 0, S * 2, S);
    // Pool
    ctx.fillStyle = MEDIEVAL.waterDark;
    fillOval(ctx, Math.round(S * 0.3), Math.round(S * 0.1), Math.round(S * 1.4), Math.round(S * 0.8));
    ctx.fillStyle = MEDIEVAL.waterLight;
    fillOval(ctx, Math.round(S * 0.4), Math.round(S * 0.2), Math.round(S * 1.2), Math.round(S * 0.55));
    // Foam/splash at top center
    ctx.fillStyle = 'rgba(220,240,255,0.6)';
    ctx.fillRect(Math.round(S * 0.7), Math.round(S * 0.05), Math.round(S * 0.6), Math.round(S * 0.15));
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 5; i++) {
      const dx = Math.round(S * 0.75 + Math.random() * S * 0.5);
      const dy = Math.round(S * 0.08 + Math.random() * S * 0.1);
      ctx.fillRect(dx, dy, 2, 2);
    }
    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Cave entrance: 3×2 dark rocky entrance */
  private static generateCaveEntrance(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 3;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);
    // Rock face
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, 0, W, H);
    // Cave opening (dark arch)
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.9, W * 0.35, H * 0.65, 0, Math.PI, 0);
    ctx.fill();
    // Shadow gradient (darker toward center)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.9, W * 0.28, H * 0.5, 0, Math.PI, 0);
    ctx.fill();
    // Rock details around entrance
    ctx.fillStyle = '#666666';
    for (let i = 0; i < 12; i++) {
      const rx = Math.round(Math.random() * W);
      const ry = Math.round(Math.random() * H * 0.4);
      ctx.fillRect(rx, ry, 3 + Math.floor(Math.random() * 4), 2 + Math.floor(Math.random() * 3));
    }
    // Stalactites at top of arch
    ctx.fillStyle = '#444444';
    for (let i = 0; i < 5; i++) {
      const sx = Math.round(W * 0.3 + Math.random() * W * 0.4);
      const sh = Math.round(4 + Math.random() * 8);
      ctx.fillRect(sx, Math.round(H * 0.25), 2, sh);
    }
    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Dense forest: 2×2 dark tree cluster — transparent bg overlays the ground */
  private static generateDenseForest(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);

    // Base ground fill — dark earthy forest floor with soft circular edge
    ctx.fillStyle = '#3a4a2a';
    fillOval(ctx, 2, 2, S - 4, S - 4);
    // Slightly lighter inner area for depth
    ctx.fillStyle = '#455530';
    fillOval(ctx, Math.round(S * 0.08), Math.round(S * 0.08), Math.round(S * 0.84), Math.round(S * 0.84));

    // Soft ground shadow (blends with terrain floor)
    ctx.fillStyle = 'rgba(20,30,15,0.4)';
    fillOval(ctx, Math.round(S * 0.05), Math.round(S * 0.15), Math.round(S * 0.9), Math.round(S * 0.8));

    // Tree trunks (peeking through canopy)
    ctx.fillStyle = '#3a2a1a';
    for (let i = 0; i < 5; i++) {
      const tx = Math.round(S * 0.15 + Math.random() * S * 0.7);
      ctx.fillRect(tx, Math.round(S * 0.5), 5, Math.round(S * 0.45));
    }

    // Dense canopy layers — larger, overlapping for a natural look
    const greens = ['#1a4a1a', '#225522', '#1a3a1a', '#2a5a2a', '#335533'];
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = greens[i % greens.length];
      const cx = Math.round(S * 0.1 + Math.random() * S * 0.8);
      const cy = Math.round(S * 0.05 + Math.random() * S * 0.55);
      const r = Math.round(S * 0.14 + Math.random() * S * 0.16);
      fillOval(ctx, cx - r, cy - r, r * 2, r * 2);
    }

    // Highlight spots (dappled light through canopy)
    ctx.fillStyle = 'rgba(80,120,50,0.3)';
    for (let i = 0; i < 6; i++) {
      const hx = Math.round(S * 0.15 + Math.random() * S * 0.7);
      const hy = Math.round(S * 0.1 + Math.random() * S * 0.5);
      fillOval(ctx, hx, hy, Math.round(S * 0.06), Math.round(S * 0.06));
    }

    // Dark interior shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    fillOval(ctx, Math.round(S * 0.25), Math.round(S * 0.25), Math.round(S * 0.5), Math.round(S * 0.4));
    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Kingdom-Specific Decoration Generators ───

  /** Training dummy: wooden post with straw target (Hero kingdom) */
  private static generateTrainingDummy(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Shadow at base
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    fillOval(ctx, r(8), r(26), r(16), r(5));
    // Wooden post
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(r(14), r(6), r(4), r(22));
    ctx.fillStyle = MEDIEVAL.woodDark;
    ctx.fillRect(r(14), r(6), r(1), r(22));
    // Cross-beam
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(r(8), r(10), r(16), r(3));
    // Straw target body (tan circle)
    ctx.fillStyle = '#c8a860';
    fillOval(ctx, r(9), r(11), r(14), r(14));
    ctx.fillStyle = '#b89850';
    fillOval(ctx, r(11), r(13), r(10), r(10));
    // Red bullseye center
    ctx.fillStyle = '#cc3333';
    fillOval(ctx, r(13), r(15), r(6), r(6));
    ctx.fillStyle = '#ee4444';
    fillOval(ctx, r(14), r(16), r(4), r(4));
    // Straw wisps sticking out
    ctx.fillStyle = '#d4b870';
    ctx.fillRect(r(8), r(14), r(2), r(1));
    ctx.fillRect(r(22), r(16), r(2), r(1));
    ctx.fillRect(r(10), r(24), r(1), r(2));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Vine arch: green archway with hanging tendrils (Elf kingdom) */
  private static generateVineArch(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Two thin brown posts
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(r(4), r(8), r(3), r(22));
    ctx.fillRect(r(25), r(8), r(3), r(22));
    // Curved arch top (green)
    ctx.fillStyle = '#44aa44';
    ctx.fillRect(r(4), r(6), r(24), r(3));
    ctx.fillRect(r(6), r(4), r(20), r(3));
    ctx.fillRect(r(9), r(3), r(14), r(2));
    // Darker vine overlay
    ctx.fillStyle = '#338833';
    ctx.fillRect(r(8), r(5), r(16), r(2));
    // Hanging vine tendrils
    ctx.fillStyle = '#33aa33';
    ctx.fillRect(r(8), r(8), r(1), r(6));
    ctx.fillRect(r(12), r(7), r(1), r(8));
    ctx.fillRect(r(19), r(7), r(1), r(7));
    ctx.fillRect(r(23), r(8), r(1), r(5));
    // Leaf details
    ctx.fillStyle = '#55cc55';
    ctx.fillRect(r(8), r(12), r(2), r(1));
    ctx.fillRect(r(12), r(13), r(2), r(1));
    ctx.fillRect(r(19), r(12), r(2), r(1));
    // Small flowers on arch
    ctx.fillStyle = MEDIEVAL.flowerWhite;
    ctx.fillRect(r(10), r(4), r(2), r(2));
    ctx.fillRect(r(20), r(5), r(2), r(2));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Hanging lantern: pole with glowing lantern (Elf kingdom) */
  private static generateHangingLantern(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Pole
    ctx.fillStyle = MEDIEVAL.woodDark;
    ctx.fillRect(r(10), r(4), r(2), r(26));
    // Arm extending right
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(r(11), r(6), r(10), r(2));
    // Hook
    ctx.fillRect(r(20), r(7), r(1), r(3));
    // Glow effect (soft circle behind lantern)
    ctx.fillStyle = 'rgba(255,200,80,0.15)';
    fillOval(ctx, r(14), r(6), r(14), r(14));
    ctx.fillStyle = 'rgba(255,220,100,0.1)';
    fillOval(ctx, r(12), r(4), r(18), r(18));
    // Lantern body
    ctx.fillStyle = '#cc8822';
    ctx.fillRect(r(17), r(10), r(8), r(2)); // top cap
    ctx.fillRect(r(17), r(18), r(8), r(2)); // bottom cap
    // Glowing center
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(r(18), r(12), r(6), r(6));
    ctx.fillStyle = '#ffdd88';
    ctx.fillRect(r(19), r(13), r(4), r(4));
    // Warm center
    ctx.fillStyle = '#ffffaa';
    ctx.fillRect(r(20), r(14), r(2), r(2));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Ancient tree: giant gnarled tree, 2× tile size (Treant kingdom) */
  private static generateAncientTree(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = S / 64;
    const r = (v: number) => Math.round(v * f);

    // Root shadows on ground
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    fillOval(ctx, r(8), r(50), r(48), r(12));
    // Massive trunk
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(r(20), r(24), r(24), r(34));
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(r(22), r(26), r(20), r(30));
    // Trunk wider at base (roots)
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(r(14), r(48), r(8), r(10));
    ctx.fillRect(r(42), r(48), r(8), r(10));
    ctx.fillRect(r(10), r(52), r(6), r(8));
    ctx.fillRect(r(48), r(52), r(6), r(8));
    // Bark texture
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(r(24), r(30), r(2), r(8));
    ctx.fillRect(r(30), r(34), r(2), r(6));
    ctx.fillRect(r(36), r(28), r(2), r(10));
    // Dense canopy — multiple overlapping ovals
    const greens = ['#1a5a1a', '#225522', '#2a6a2a', '#1a4a1a', '#336633'];
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = greens[i % greens.length];
      const cx = r(14 + (i % 4) * 10 + (i % 3) * 3);
      const cy = r(4 + (i % 3) * 8);
      const rx = r(12 + (i % 2) * 4);
      const ry = r(10 + (i % 2) * 3);
      fillOval(ctx, cx, cy, rx * 2, ry * 2);
    }
    // Top canopy layer (brighter)
    ctx.fillStyle = '#3a8a3a';
    fillOval(ctx, r(16), r(2), r(32), r(18));
    ctx.fillStyle = '#2a7a2a';
    fillOval(ctx, r(10), r(8), r(44), r(22));
    ctx.fillStyle = '#1a6a1a';
    fillOval(ctx, r(14), r(14), r(36), r(18));
    // Highlight dapples
    ctx.fillStyle = 'rgba(100,160,60,0.3)';
    fillOval(ctx, r(20), r(6), r(8), r(6));
    fillOval(ctx, r(36), r(10), r(6), r(5));
    fillOval(ctx, r(26), r(16), r(10), r(5));
    // Dark depth in canopy center
    ctx.fillStyle = 'rgba(0,30,0,0.2)';
    fillOval(ctx, r(22), r(12), r(20), r(12));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Giant mushroom: thick stem, large red cap with white spots (Treant/Dwarf) */
  private static generateMushroomLarge(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    fillOval(ctx, r(6), r(26), r(20), r(5));
    // Thick stem
    ctx.fillStyle = '#e8d8c8';
    ctx.fillRect(r(12), r(16), r(8), r(14));
    ctx.fillStyle = '#d8c8b8';
    ctx.fillRect(r(12), r(16), r(2), r(14));
    // Large red cap
    ctx.fillStyle = '#cc2222';
    fillOval(ctx, r(4), r(4), r(24), r(16));
    ctx.fillStyle = '#dd3333';
    fillOval(ctx, r(6), r(5), r(20), r(12));
    // White spots on cap
    ctx.fillStyle = '#ffffee';
    fillOval(ctx, r(8), r(8), r(4), r(3));
    fillOval(ctx, r(18), r(6), r(3), r(3));
    fillOval(ctx, r(13), r(5), r(3), r(2));
    fillOval(ctx, r(22), r(10), r(3), r(2));
    // Highlight on cap
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    fillOval(ctx, r(8), r(5), r(10), r(5));
    // Underside detail
    ctx.fillStyle = '#c8b8a8';
    ctx.fillRect(r(8), r(16), r(16), r(2));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Fire pit: circle of stones with flames (Beast kingdom) */
  private static generateFirePit(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Glow on ground
    ctx.fillStyle = 'rgba(255,120,30,0.1)';
    fillOval(ctx, r(2), r(6), r(28), r(22));
    // Stone ring (oval of gray stones)
    ctx.fillStyle = MEDIEVAL.stoneDark;
    for (let a = 0; a < Math.PI * 2; a += 0.55) {
      const sx = r(16) + Math.round(r(10) * Math.cos(a));
      const sy = r(18) + Math.round(r(7) * Math.sin(a));
      ctx.fillRect(sx - r(2), sy - r(1), r(4), r(3));
    }
    ctx.fillStyle = MEDIEVAL.stoneMedium;
    for (let a = 0; a < Math.PI * 2; a += 0.55) {
      const sx = r(16) + Math.round(r(10) * Math.cos(a));
      const sy = r(18) + Math.round(r(7) * Math.sin(a));
      ctx.fillRect(sx - r(1), sy, r(3), r(2));
    }
    // Flame base (orange)
    ctx.fillStyle = '#dd6622';
    ctx.beginPath();
    ctx.moveTo(r(12), r(20));
    ctx.lineTo(r(16), r(10));
    ctx.lineTo(r(20), r(20));
    ctx.fill();
    // Inner flame (yellow)
    ctx.fillStyle = '#ffaa22';
    ctx.beginPath();
    ctx.moveTo(r(13), r(19));
    ctx.lineTo(r(16), r(12));
    ctx.lineTo(r(19), r(19));
    ctx.fill();
    // Bright core
    ctx.fillStyle = '#ffdd66';
    ctx.beginPath();
    ctx.moveTo(r(14), r(19));
    ctx.lineTo(r(16), r(14));
    ctx.lineTo(r(18), r(19));
    ctx.fill();
    // Second smaller flame tongue
    ctx.fillStyle = '#ee7733';
    ctx.beginPath();
    ctx.moveTo(r(17), r(19));
    ctx.lineTo(r(19), r(13));
    ctx.lineTo(r(21), r(18));
    ctx.fill();

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Totem pole: tall carved pole with stacked faces and feathers (Beast kingdom) */
  private static generateTotemPole(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    fillOval(ctx, r(10), r(27), r(12), r(4));
    // Main pole body
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(r(11), r(2), r(10), r(28));
    ctx.fillStyle = MEDIEVAL.woodDark;
    ctx.fillRect(r(11), r(2), r(2), r(28));
    // Stacked face sections
    const faceColors = ['#cc4444', '#44aa44', '#4488cc', '#ccaa22'];
    for (let i = 0; i < 4; i++) {
      const fy = r(3 + i * 6);
      // Face band
      ctx.fillStyle = faceColors[i];
      ctx.fillRect(r(10), fy, r(12), r(5));
      // Eyes (dark dots)
      ctx.fillStyle = '#111111';
      ctx.fillRect(r(12), fy + r(1), r(2), r(2));
      ctx.fillRect(r(18), fy + r(1), r(2), r(2));
      // Mouth
      ctx.fillRect(r(14), fy + r(3), r(4), r(1));
    }
    // Feathers at top (colored triangles)
    ctx.fillStyle = '#cc3333';
    ctx.beginPath(); ctx.moveTo(r(14), r(2)); ctx.lineTo(r(12), r(-3)); ctx.lineTo(r(16), r(0)); ctx.fill();
    ctx.fillStyle = '#33aa33';
    ctx.beginPath(); ctx.moveTo(r(16), r(2)); ctx.lineTo(r(16), r(-4)); ctx.lineTo(r(19), r(0)); ctx.fill();
    ctx.fillStyle = '#4488cc';
    ctx.beginPath(); ctx.moveTo(r(18), r(2)); ctx.lineTo(r(20), r(-3)); ctx.lineTo(r(21), r(1)); ctx.fill();

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Arena marking: ground-level ring with corner stakes (Beast kingdom, non-blocking) */
  private static generateArenaMarking(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Thin circle outline on ground (tan/brown)
    ctx.strokeStyle = '#aa8855';
    ctx.lineWidth = r(2);
    ctx.beginPath();
    ctx.ellipse(r(16), r(16), r(12), r(10), 0, 0, Math.PI * 2);
    ctx.stroke();
    // Inner dashed ring
    ctx.strokeStyle = '#997744';
    ctx.lineWidth = r(1);
    ctx.setLineDash([r(3), r(3)]);
    ctx.beginPath();
    ctx.ellipse(r(16), r(16), r(9), r(7), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Corner stakes
    const stakes = [[r(4), r(4)], [r(27), r(4)], [r(4), r(27)], [r(27), r(27)]];
    for (const [sx, sy] of stakes) {
      ctx.fillStyle = MEDIEVAL.woodMedium;
      ctx.fillRect(sx, sy, r(2), r(4));
      // Small flag on stake
      ctx.fillStyle = '#cc3333';
      ctx.fillRect(sx + r(2), sy, r(3), r(2));
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Canal bridge: wooden plank bridge top-down view (Merfolk kingdom) */
  private static generateCanalBridge(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Water underneath (visible at edges)
    ctx.fillStyle = MEDIEVAL.waterMedium;
    ctx.fillRect(0, 0, S, S);
    // Plank shadows
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(r(3), r(2), r(26), r(28));
    // Horizontal planks
    for (let i = 0; i < 8; i++) {
      const py = r(2 + i * 3.5);
      ctx.fillStyle = i % 2 === 0 ? MEDIEVAL.woodMedium : MEDIEVAL.woodLight;
      ctx.fillRect(r(4), py, r(24), r(3));
      // Plank gap
      ctx.fillStyle = MEDIEVAL.woodDark;
      ctx.fillRect(r(4), py + r(3) - 1, r(24), 1);
    }
    // Rail posts on sides
    ctx.fillStyle = MEDIEVAL.woodDark;
    ctx.fillRect(r(3), r(2), r(2), r(28));
    ctx.fillRect(r(27), r(2), r(2), r(28));
    // Rail post highlights
    ctx.fillStyle = MEDIEVAL.woodLight;
    ctx.fillRect(r(4), r(2), r(1), r(28));
    ctx.fillRect(r(28), r(2), r(1), r(28));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Dock: wooden platform with mooring post and rope (Merfolk kingdom) */
  private static generateDock(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Water visible at bottom
    ctx.fillStyle = MEDIEVAL.waterMedium;
    ctx.fillRect(0, r(20), S, r(12));
    // Platform shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(r(2), r(6), r(28), r(18));
    // Horizontal planks
    for (let i = 0; i < 6; i++) {
      const py = r(4 + i * 3);
      ctx.fillStyle = i % 2 === 0 ? MEDIEVAL.woodMedium : MEDIEVAL.woodLight;
      ctx.fillRect(r(2), py, r(28), r(3));
      ctx.fillStyle = MEDIEVAL.woodDark;
      ctx.fillRect(r(2), py + r(3) - 1, r(28), 1);
    }
    // Mooring post
    ctx.fillStyle = MEDIEVAL.woodDark;
    ctx.fillRect(r(22), r(2), r(4), r(10));
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(r(23), r(2), r(2), r(10));
    // Post top cap
    ctx.fillStyle = MEDIEVAL.ironMedium;
    ctx.fillRect(r(21), r(2), r(6), r(2));
    // Rope coil
    ctx.strokeStyle = '#aa9966';
    ctx.lineWidth = r(1);
    ctx.beginPath();
    ctx.ellipse(r(24), r(8), r(3), r(2), 0, 0, Math.PI * 1.5);
    ctx.stroke();
    // Rope tail hanging
    ctx.fillStyle = '#aa9966';
    ctx.fillRect(r(26), r(8), r(1), r(4));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Glowing crystal cluster (Dwarf kingdom) */
  private static generateCrystal(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Glow effect
    ctx.fillStyle = 'rgba(100,120,255,0.08)';
    fillOval(ctx, r(4), r(6), r(24), r(22));
    ctx.fillStyle = 'rgba(120,140,255,0.06)';
    fillOval(ctx, r(1), r(3), r(30), r(28));
    // Main crystal (tall, angular)
    ctx.fillStyle = '#6677cc';
    ctx.beginPath();
    ctx.moveTo(r(14), r(4)); ctx.lineTo(r(10), r(24)); ctx.lineTo(r(18), r(24)); ctx.fill();
    // Crystal highlight face
    ctx.fillStyle = '#8899dd';
    ctx.beginPath();
    ctx.moveTo(r(14), r(4)); ctx.lineTo(r(14), r(22)); ctx.lineTo(r(18), r(24)); ctx.fill();
    // Second crystal (shorter, angled right)
    ctx.fillStyle = '#7788bb';
    ctx.beginPath();
    ctx.moveTo(r(20), r(10)); ctx.lineTo(r(17), r(26)); ctx.lineTo(r(24), r(26)); ctx.fill();
    ctx.fillStyle = '#99aacc';
    ctx.beginPath();
    ctx.moveTo(r(20), r(10)); ctx.lineTo(r(20), r(24)); ctx.lineTo(r(24), r(26)); ctx.fill();
    // Third crystal (small, left)
    ctx.fillStyle = '#9966cc';
    ctx.beginPath();
    ctx.moveTo(r(9), r(14)); ctx.lineTo(r(7), r(26)); ctx.lineTo(r(12), r(26)); ctx.fill();
    // Sparkle points
    ctx.fillStyle = '#ddddff';
    ctx.fillRect(r(14), r(8), r(2), r(2));
    ctx.fillRect(r(20), r(14), r(1), r(1));
    ctx.fillRect(r(9), r(18), r(1), r(1));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Mine entrance: dark opening with timber frame (Dwarf kingdom) */
  private static generateMineEntrance(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Rock surround
    ctx.fillStyle = MEDIEVAL.stoneDark;
    fillOval(ctx, r(4), r(4), r(24), r(24));
    ctx.fillStyle = MEDIEVAL.stoneMedium;
    fillOval(ctx, r(6), r(6), r(20), r(20));
    // Dark interior
    ctx.fillStyle = '#111111';
    ctx.fillRect(r(8), r(10), r(16), r(18));
    // Arch top (dark)
    ctx.fillStyle = '#111111';
    fillOval(ctx, r(8), r(6), r(16), r(10));
    // Timber frame — inverted U
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(r(7), r(8), r(3), r(22)); // left post
    ctx.fillRect(r(22), r(8), r(3), r(22)); // right post
    ctx.fillRect(r(7), r(6), r(18), r(3)); // top beam
    // Beam highlight
    ctx.fillStyle = MEDIEVAL.woodLight;
    ctx.fillRect(r(8), r(7), r(16), r(1));
    // Ore sparkles inside
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(r(12), r(16), r(2), r(1));
    ctx.fillRect(r(18), r(20), r(1), r(1));
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(r(14), r(22), r(1), r(1));
    ctx.fillRect(r(10), r(19), r(1), r(1));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Gravestone: tilted tombstone on dark base (Undead kingdom) */
  private static generateGravestone(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Dark ground mound
    ctx.fillStyle = '#3a3a2a';
    fillOval(ctx, r(6), r(24), r(20), r(6));
    // Tombstone body (slightly tilted via shear)
    ctx.save();
    ctx.transform(1, 0, -0.08, 1, r(2), 0);
    // Stone body
    ctx.fillStyle = MEDIEVAL.stoneMedium;
    ctx.fillRect(r(10), r(10), r(12), r(16));
    // Rounded top
    fillOval(ctx, r(10), r(6), r(12), r(10));
    // Stone highlight
    ctx.fillStyle = MEDIEVAL.stoneLight;
    ctx.fillRect(r(12), r(12), r(1), r(10));
    // Text-like marks (thin horizontal lines)
    ctx.fillStyle = MEDIEVAL.stoneDark;
    ctx.fillRect(r(13), r(14), r(6), r(1));
    ctx.fillRect(r(14), r(17), r(4), r(1));
    ctx.fillRect(r(13), r(20), r(6), r(1));
    ctx.restore();
    // Small cross on top
    ctx.fillStyle = MEDIEVAL.stoneDark;
    ctx.fillRect(r(15), r(6), r(2), r(5));
    ctx.fillRect(r(13), r(8), r(6), r(2));
    // Grass tufts at base
    ctx.fillStyle = '#3a5a2a';
    ctx.fillRect(r(8), r(25), r(1), r(3));
    ctx.fillRect(r(22), r(24), r(1), r(3));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Lava vent: ground crack with orange glow and embers (Volcano kingdom) */
  private static generateLavaVent(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Outer glow
    ctx.fillStyle = 'rgba(255,80,20,0.08)';
    fillOval(ctx, r(2), r(4), r(28), r(24));
    // Dark ground with cracks
    ctx.fillStyle = '#2a2222';
    fillOval(ctx, r(6), r(8), r(20), r(16));
    // Main crack (jagged line)
    ctx.fillStyle = '#ff6622';
    ctx.fillRect(r(14), r(8), r(3), r(4));
    ctx.fillRect(r(13), r(12), r(4), r(3));
    ctx.fillRect(r(15), r(15), r(3), r(4));
    ctx.fillRect(r(13), r(19), r(4), r(3));
    // Bright core of crack
    ctx.fillStyle = '#ffaa44';
    ctx.fillRect(r(15), r(10), r(1), r(3));
    ctx.fillRect(r(14), r(13), r(2), r(2));
    ctx.fillRect(r(16), r(16), r(1), r(3));
    ctx.fillRect(r(14), r(20), r(2), r(1));
    // Side cracks
    ctx.fillStyle = '#cc4411';
    ctx.fillRect(r(11), r(14), r(3), r(1));
    ctx.fillRect(r(18), r(17), r(3), r(1));
    // Orange glow overlay
    ctx.fillStyle = 'rgba(255,120,30,0.12)';
    fillOval(ctx, r(8), r(10), r(16), r(12));
    // Ember particles floating up
    ctx.fillStyle = '#ffcc33';
    ctx.fillRect(r(12), r(6), r(1), r(1));
    ctx.fillRect(r(18), r(5), r(1), r(1));
    ctx.fillRect(r(15), r(3), r(1), r(1));
    ctx.fillStyle = '#ff8844';
    ctx.fillRect(r(10), r(4), r(1), r(1));
    ctx.fillRect(r(20), r(7), r(1), r(1));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Bamboo fence: vertical green poles with horizontal ties (Hotspring kingdom) */
  private static generateBambooFence(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Vertical bamboo poles with slight height variation
    const heights = [20, 22, 19, 23, 21, 20, 22, 19];
    for (let i = 0; i < 8; i++) {
      const px = r(2 + i * 3.5);
      const ph = r(heights[i]);
      const py = r(30) - ph;
      // Pole shadow
      ctx.fillStyle = '#336633';
      ctx.fillRect(px, py, r(3), ph);
      // Pole body
      ctx.fillStyle = '#44aa44';
      ctx.fillRect(px + 1, py, r(2), ph);
      // Pole highlight
      ctx.fillStyle = '#66cc66';
      ctx.fillRect(px + 1, py, r(1), ph);
      // Node marks (bamboo joints)
      ctx.fillStyle = '#338833';
      ctx.fillRect(px, py + r(5), r(3), r(1));
      ctx.fillRect(px, py + r(12), r(3), r(1));
    }
    // Horizontal ties (dark rope)
    ctx.fillStyle = '#554422';
    ctx.fillRect(r(1), r(14), r(30), r(2));
    ctx.fillRect(r(1), r(22), r(30), r(2));
    // Tie knot details
    ctx.fillStyle = '#443311';
    ctx.fillRect(r(8), r(13), r(2), r(4));
    ctx.fillRect(r(20), r(21), r(2), r(4));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Japanese stone lantern (Hotspring kingdom) */
  private static generateStoneLantern(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Base (wide)
    ctx.fillStyle = MEDIEVAL.stoneDark;
    ctx.fillRect(r(8), r(26), r(16), r(4));
    ctx.fillStyle = MEDIEVAL.stoneMedium;
    ctx.fillRect(r(9), r(26), r(14), r(3));
    // Pillar
    ctx.fillStyle = MEDIEVAL.stoneMedium;
    ctx.fillRect(r(13), r(14), r(6), r(12));
    ctx.fillStyle = MEDIEVAL.stoneLight;
    ctx.fillRect(r(14), r(14), r(2), r(12));
    // Light chamber (wider than pillar)
    ctx.fillStyle = MEDIEVAL.stoneDark;
    ctx.fillRect(r(9), r(10), r(14), r(6));
    // Glow inside chamber
    ctx.fillStyle = 'rgba(255,200,80,0.15)';
    fillOval(ctx, r(8), r(8), r(16), r(10));
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(r(11), r(12), r(10), r(3));
    ctx.fillStyle = '#ffdd88';
    ctx.fillRect(r(13), r(12), r(6), r(3));
    // Openings in chamber (dark slits)
    ctx.fillStyle = '#ffaa33';
    ctx.fillRect(r(10), r(11), r(1), r(4));
    ctx.fillRect(r(21), r(11), r(1), r(4));
    // Cap (wider roof)
    ctx.fillStyle = MEDIEVAL.stoneDark;
    ctx.fillRect(r(7), r(8), r(18), r(3));
    // Pointed top
    ctx.fillStyle = MEDIEVAL.stoneMedium;
    ctx.beginPath();
    ctx.moveTo(r(16), r(2)); ctx.lineTo(r(10), r(9)); ctx.lineTo(r(22), r(9)); ctx.fill();
    ctx.fillStyle = MEDIEVAL.stoneLight;
    ctx.beginPath();
    ctx.moveTo(r(16), r(2)); ctx.lineTo(r(16), r(9)); ctx.lineTo(r(22), r(9)); ctx.fill();

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Prayer flags: string of colorful triangular flags (Mountain kingdom) */
  private static generatePrayerFlag(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Two poles
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(r(3), r(4), r(2), r(26));
    ctx.fillRect(r(27), r(6), r(2), r(24));
    // Rope between poles (slight sag)
    ctx.fillStyle = '#887766';
    ctx.fillRect(r(3), r(6), r(26), r(1));
    ctx.fillRect(r(8), r(7), r(16), r(1));
    // Flags hanging from rope
    const flagColors = ['#cc3333', '#3388cc', '#33aa33', '#ddaa22', '#cc55aa'];
    for (let i = 0; i < 5; i++) {
      const fx = r(5 + i * 5);
      const fy = r(7);
      ctx.fillStyle = flagColors[i];
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + r(4), fy);
      ctx.lineTo(fx + r(2), fy + r(8));
      ctx.fill();
      // Flag highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(fx + r(1), fy + r(1), r(2), r(3));
    }
    // Second row (lower, more sag)
    ctx.fillStyle = '#887766';
    ctx.fillRect(r(3), r(16), r(26), r(1));
    ctx.fillRect(r(6), r(17), r(20), r(1));
    const flagColors2 = ['#ddaa22', '#33aa33', '#cc3333', '#cc55aa', '#3388cc'];
    for (let i = 0; i < 5; i++) {
      const fx = r(5 + i * 5);
      const fy = r(17);
      ctx.fillStyle = flagColors2[i];
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + r(4), fy);
      ctx.lineTo(fx + r(2), fy + r(7));
      ctx.fill();
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Cairn: stacked stone pile (Mountain kingdom) */
  private static generateCairn(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    fillOval(ctx, r(6), r(25), r(20), r(6));
    // Bottom stone (largest)
    ctx.fillStyle = '#777777';
    fillOval(ctx, r(6), r(22), r(20), r(8));
    ctx.fillStyle = '#888888';
    fillOval(ctx, r(8), r(22), r(16), r(6));
    // Second stone
    ctx.fillStyle = '#6a6a6a';
    fillOval(ctx, r(8), r(16), r(16), r(8));
    ctx.fillStyle = '#7a7a7a';
    fillOval(ctx, r(10), r(17), r(12), r(6));
    // Third stone
    ctx.fillStyle = '#707070';
    fillOval(ctx, r(10), r(11), r(12), r(7));
    ctx.fillStyle = '#808080';
    fillOval(ctx, r(12), r(12), r(8), r(5));
    // Top stone (smallest)
    ctx.fillStyle = '#757575';
    fillOval(ctx, r(12), r(7), r(8), r(6));
    ctx.fillStyle = '#8a8a8a';
    fillOval(ctx, r(13), r(8), r(6), r(4));
    // Highlights
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(r(14), r(9), r(2), r(1));
    ctx.fillRect(r(12), r(14), r(2), r(1));
    ctx.fillRect(r(10), r(20), r(3), r(1));
    ctx.fillRect(r(18), r(24), r(2), r(1));

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Rune circle: glowing purple magical circle on dark ground (Demon kingdom) */
  private static generateRuneCircle(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) return;
    const S = TILE_SIZE;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const f = TILE_SIZE / 32;
    const r = (v: number) => Math.round(v * f);

    // Dark ground
    ctx.fillStyle = '#1a1118';
    fillOval(ctx, r(2), r(2), r(28), r(28));
    // Outer glow
    ctx.fillStyle = 'rgba(120,40,180,0.08)';
    fillOval(ctx, r(0), r(0), r(32), r(32));
    // Main circle ring (purple glow)
    ctx.strokeStyle = '#9933cc';
    ctx.lineWidth = r(2);
    ctx.beginPath();
    ctx.ellipse(r(16), r(16), r(12), r(12), 0, 0, Math.PI * 2);
    ctx.stroke();
    // Inner ring
    ctx.strokeStyle = '#7722aa';
    ctx.lineWidth = r(1);
    ctx.beginPath();
    ctx.ellipse(r(16), r(16), r(8), r(8), 0, 0, Math.PI * 2);
    ctx.stroke();
    // Rune marks at cardinal points
    ctx.fillStyle = '#cc66ff';
    // Top
    ctx.fillRect(r(15), r(3), r(2), r(3));
    // Bottom
    ctx.fillRect(r(15), r(26), r(2), r(3));
    // Left
    ctx.fillRect(r(3), r(15), r(3), r(2));
    // Right
    ctx.fillRect(r(26), r(15), r(3), r(2));
    // Diagonal rune marks
    ctx.fillStyle = '#aa44dd';
    ctx.fillRect(r(6), r(6), r(2), r(2));
    ctx.fillRect(r(24), r(6), r(2), r(2));
    ctx.fillRect(r(6), r(24), r(2), r(2));
    ctx.fillRect(r(24), r(24), r(2), r(2));
    // Center symbol (small star)
    ctx.fillStyle = '#dd88ff';
    ctx.fillRect(r(15), r(14), r(2), r(4));
    ctx.fillRect(r(14), r(15), r(4), r(2));
    // Inner glow
    ctx.fillStyle = 'rgba(150,60,220,0.12)';
    fillOval(ctx, r(8), r(8), r(16), r(16));

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
