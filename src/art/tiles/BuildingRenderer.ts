import Phaser from 'phaser';
import { TILE_SIZE } from '../../config';
import { MEDIEVAL, darken, lighten, varyColor, getRegionPalette } from '../palettes';
import { ArtRegistry } from '../index';

/** Generates medieval building textures (Tudor houses, castles, shops, trees, rocks) */
export class BuildingRenderer {

  static generateAll(scene: Phaser.Scene): void {
    // Generic buildings
    this.generateBuilding(scene, 'bld_tudor', MEDIEVAL.woodMedium, MEDIEVAL.parchment, MEDIEVAL.roofMedium);
    this.generateBuilding(scene, 'bld_shop', MEDIEVAL.woodLight, MEDIEVAL.parchmentLight, MEDIEVAL.roofDark);
    this.generateBuilding(scene, 'bld_castle', MEDIEVAL.stoneMedium, MEDIEVAL.stoneLight, MEDIEVAL.stoneDark);
    this.generateBuilding(scene, 'bld_inn', MEDIEVAL.woodDark, MEDIEVAL.parchmentDark, MEDIEVAL.roofLight);

    // Decorations
    this.generateTree(scene, 'deco_tree_green', '#3a7a2a', '#2a5a1a', '#5a3a1a');
    this.generateTree(scene, 'deco_tree_dark', '#1a5a1a', '#0a3a0a', '#4a3a2a');
    this.generateTree(scene, 'deco_tree_autumn', '#aa6622', '#884411', '#5a3a1a');
    this.generateTree(scene, 'deco_tree_dead', '#444444', '#333333', '#3a2a1a');
    this.generateTree(scene, 'deco_tree_snow', '#aabbcc', '#8899aa', '#5a4a3a');

    this.generateRock(scene, 'deco_rock', MEDIEVAL.stoneMedium, MEDIEVAL.stoneDark);
    this.generateRock(scene, 'deco_rock_dark', '#555555', '#333333');

    this.generateFlowerPatch(scene, 'deco_flowers', '#3a7a2a');
    this.generateWell(scene, 'deco_well');

    // Region-specific decorations
    const regions = [
      'region_hero', 'region_elf', 'region_treant', 'region_beast',
      'region_merfolk', 'region_giant', 'region_dwarf', 'region_undead',
      'region_volcano', 'region_hotspring', 'region_mountain', 'region_demon',
    ];
    for (const rid of regions) {
      const pal = getRegionPalette(rid);
      this.generateTree(scene, `deco_tree_${rid}`, pal.tree[1], darken(pal.tree[1], 0.2), pal.tree[0]);
      this.generateBuilding(scene, `bld_region_${rid}`, pal.wall[1], pal.wall[2], darken(pal.wall[0], 0.1));
    }
  }

  /** Generate a 2×2 tile (64×64) Tudor-style building */
  private static generateBuilding(scene: Phaser.Scene, key: string, frameColor: string, wallColor: string, roofColor: string): void {
    if (scene.textures.exists(key)) return;
    const W = TILE_SIZE * 2;
    const H = TILE_SIZE * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(W, H);

    // Roof (top third, triangular)
    const roofH = Math.floor(H * 0.35);
    ctx.fillStyle = roofColor;
    for (let y = 0; y < roofH; y++) {
      const t = y / roofH;
      const indent = Math.floor((1 - t) * W * 0.4);
      ctx.fillStyle = varyColor(roofColor, 5);
      ctx.fillRect(indent, y, W - indent * 2, 1);
    }
    // Roof edge
    ctx.fillStyle = darken(roofColor, 0.2);
    ctx.fillRect(0, roofH - 1, W, 2);

    // Wall (below roof)
    for (let y = roofH; y < H - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        ctx.fillStyle = varyColor(wallColor, 4);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Timber frame (Tudor cross-beams)
    ctx.fillStyle = frameColor;
    // Vertical beams
    ctx.fillRect(2, roofH, 3, H - roofH);
    ctx.fillRect(W - 5, roofH, 3, H - roofH);
    ctx.fillRect(W / 2 - 1, roofH, 3, H - roofH);
    // Horizontal beam
    ctx.fillRect(2, roofH + Math.floor((H - roofH) * 0.5), W - 4, 3);
    // Diagonal beams (X pattern)
    for (let i = 0; i < 10; i++) {
      const t = i / 10;
      ctx.fillRect(Math.round(5 + t * (W / 2 - 7)), Math.round(roofH + 3 + t * ((H - roofH) * 0.45)), 2, 2);
      ctx.fillRect(Math.round(W / 2 - 2 - t * (W / 2 - 7)), Math.round(roofH + 3 + t * ((H - roofH) * 0.45)), 2, 2);
    }

    // Window
    ctx.fillStyle = '#334466';
    ctx.fillRect(W / 2 - 5, roofH + 8, 4, 6);
    ctx.fillRect(W / 2 + 2, roofH + 8, 4, 6);
    // Window frame
    ctx.fillStyle = darken(frameColor, 0.1);
    ctx.fillRect(W / 2 - 6, roofH + 7, 13, 1);
    ctx.fillRect(W / 2 - 6, roofH + 15, 13, 1);

    // Door
    const doorX = W / 2 - 4;
    const doorY = H - 16;
    ctx.fillStyle = darken(frameColor, 0.15);
    ctx.fillRect(doorX, doorY, 9, 14);
    ctx.fillStyle = frameColor;
    ctx.fillRect(doorX + 1, doorY + 1, 7, 12);
    // Door handle
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(doorX + 6, doorY + 7, 1, 1);

    // Foundation
    ctx.fillStyle = MEDIEVAL.stoneDark;
    ctx.fillRect(0, H - 2, W, 2);

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
