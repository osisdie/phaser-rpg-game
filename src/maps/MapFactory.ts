import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { DEPTH } from '../utils/constants';
import { getRegionPalette, darken, lighten, varyColor } from '../art/palettes';
import { MonsterRenderer } from '../art/monsters/MonsterRenderer';

export interface MapConfig {
  width: number;   // tiles
  height: number;  // tiles
  groundColor: number;
  wallColor: number;
  decorColor: number;
  type: 'town' | 'field';
  regionId: string;
}

/** Procedurally generates tile-based maps using art textures */
export class MapFactory {
  static createMap(scene: Phaser.Scene, config: MapConfig): {
    groundLayer: Phaser.GameObjects.Image[];
    wallBodies: Phaser.Physics.Arcade.StaticGroup;
    bounds: { width: number; height: number };
  } {
    const groundLayer: Phaser.GameObjects.Image[] = [];
    const wallBodies = scene.physics.add.staticGroup();
    const mapW = config.width * TILE_SIZE;
    const mapH = config.height * TILE_SIZE;
    const rid = config.regionId;

    // Generate ground + wall tiles
    for (let y = 0; y < config.height; y++) {
      for (let x = 0; x < config.width; x++) {
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        const isWall = x === 0 || y === 0 || x === config.width - 1 || y === config.height - 1;

        if (isWall) {
          const wallKey = `tile_wall_${rid}`;
          const wall = scene.add.image(px, py, wallKey).setDepth(DEPTH.ground);
          groundLayer.push(wall);
          const wallBody = scene.add.rectangle(px, py, TILE_SIZE, TILE_SIZE);
          scene.physics.add.existing(wallBody, true);
          wallBodies.add(wallBody);
          wallBody.setVisible(false);
        } else {
          // Randomize between 3 ground variants
          const variant = Math.floor(Math.random() * 3);
          const groundKey = `tile_ground_${rid}_${variant}`;
          const ground = scene.add.image(px, py, groundKey).setDepth(DEPTH.ground);
          groundLayer.push(ground);
        }
      }
    }

    // Add decorations
    if (config.type === 'town') {
      this.addTownDecorations(scene, config, wallBodies, rid);
    } else {
      this.addFieldDecorations(scene, config, wallBodies, rid);
    }

    return { groundLayer, wallBodies, bounds: { width: mapW, height: mapH } };
  }

  private static addTownDecorations(
    scene: Phaser.Scene, config: MapConfig,
    wallBodies: Phaser.Physics.Arcade.StaticGroup, regionId: string,
  ): void {
    // ── Castle (5×5 tiles) in upper-center ──
    const castleKey = `bld_castle_${regionId}`;
    const castleGx = Math.floor(config.width / 2) - 2;
    const castleGy = 2;
    if (scene.textures.exists(castleKey)) {
      const castleCx = (castleGx + 2.5) * TILE_SIZE;
      const castleCy = (castleGy + 2.5) * TILE_SIZE;
      scene.add.image(castleCx, castleCy, castleKey).setDepth(DEPTH.objects);

      // Collision for 5×5 area
      for (let dy = 0; dy < 5; dy++) {
        for (let dx = 0; dx < 5; dx++) {
          const px = (castleGx + dx) * TILE_SIZE + TILE_SIZE / 2;
          const py = (castleGy + dy) * TILE_SIZE + TILE_SIZE / 2;
          const body = scene.add.rectangle(px, py, TILE_SIZE, TILE_SIZE);
          scene.physics.add.existing(body, true);
          wallBodies.add(body);
          body.setVisible(false);
        }
      }

      // ── Kingdom banner above castle ──
      const bannerKey = `banner_${regionId}`;
      if (!scene.textures.exists(bannerKey)) {
        this.generateBannerTexture(scene, bannerKey, regionId);
      }
      const bannerCx = castleCx;
      const bannerCy = castleGy * TILE_SIZE - TILE_SIZE * 0.3;
      const bannerImg = scene.add.image(bannerCx, bannerCy, bannerKey).setDepth(DEPTH.objects + 1);
      // Gentle sway animation
      scene.tweens.add({
        targets: bannerImg,
        angle: { from: -3, to: 3 }, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // ── Guardian statues at gate entrance ──
    {
      const midX = Math.floor(config.width / 2);
      const gateGy = config.height - 5;
      const statueKey = `statue_${regionId}`;
      if (!scene.textures.exists(statueKey)) {
        this.generateGuardianStatue(scene, statueKey, regionId);
      }
      // Statues flanking the gate path
      const statueY = (gateGy + 2) * TILE_SIZE + TILE_SIZE / 2;
      const leftStatue = scene.add.image((midX - 1) * TILE_SIZE, statueY, statueKey)
        .setDepth(DEPTH.objects);
      const rightStatue = scene.add.image((midX + 2) * TILE_SIZE, statueY, statueKey)
        .setDepth(DEPTH.objects).setFlipX(true);

      // Collision for statues
      for (const sx of [(midX - 1) * TILE_SIZE, (midX + 2) * TILE_SIZE]) {
        const sb = scene.add.rectangle(sx, statueY, TILE_SIZE - 8, TILE_SIZE - 8);
        scene.physics.add.existing(sb, true);
        wallBodies.add(sb);
        sb.setVisible(false);
      }
    }

    // ── Regular buildings (2×2) — arranged asymmetrically around castle ──
    // Building positions for 40×32 grid (castle at ~(18,2), path at y=16, gate at y=22)
    const buildingPositions = [
      { x: 4, y: 6, w: 2, h: 2 },
      { x: 10, y: 8, w: 2, h: 2 },
      { x: 28, y: 6, w: 2, h: 2 },
      { x: 32, y: 8, w: 2, h: 2 },
      { x: 4, y: 20, w: 2, h: 2 },
      { x: 10, y: 20, w: 2, h: 2 },
      { x: 28, y: 20, w: 2, h: 2 },
      { x: 32, y: 20, w: 2, h: 2 },
    ];

    const buildingKeys = [
      `bld_region_${regionId}_0`, `bld_region_${regionId}_1`,
      `bld_region_${regionId}_2`, `bld_region_${regionId}_3`,
    ];

    // Building type assignment: pos 0=inn, 2=shop, 4=church, rest=houses
    const typedBuildingKeys: Record<number, string> = {
      0: `bld_inn_${regionId}`,
      2: `bld_shop_${regionId}`,
      4: `bld_church_${regionId}`,
    };

    // Building type banner texture keys (universal across all kingdoms)
    const buildingTypeBanners: Record<number, { key: string; type: 'inn' | 'shop' | 'church' }> = {
      0: { key: 'sign_inn', type: 'inn' },
      2: { key: 'sign_shop', type: 'shop' },
      4: { key: 'sign_church', type: 'church' },
    };

    for (let i = 0; i < buildingPositions.length; i++) {
      const bld = buildingPositions[i];
      if (bld.x + bld.w >= config.width - 1 || bld.y + bld.h >= config.height - 1) continue;

      const bldCx = bld.x * TILE_SIZE + TILE_SIZE;
      const bldCy = bld.y * TILE_SIZE + TILE_SIZE;
      const bldKey = typedBuildingKeys[i] ?? buildingKeys[i % buildingKeys.length];
      const bldScale = 1.0 + Math.random() * 0.25;
      scene.add.image(bldCx, bldCy, bldKey).setDepth(DEPTH.objects).setScale(bldScale);

      // Add building type sign banner for inn/shop/church
      const bannerInfo = buildingTypeBanners[i];
      if (bannerInfo) {
        if (!scene.textures.exists(bannerInfo.key)) {
          this.generateBuildingSign(scene, bannerInfo.key, bannerInfo.type);
        }
        // Place sign to the right of building, slightly above center
        const signX = (bld.x + bld.w) * TILE_SIZE + TILE_SIZE * 0.3;
        const signY = bld.y * TILE_SIZE + TILE_SIZE * 0.5;
        scene.add.image(signX, signY, bannerInfo.key).setDepth(DEPTH.objects + 1);
      }

      for (let dy = 0; dy < bld.h; dy++) {
        for (let dx = 0; dx < bld.w; dx++) {
          const px = (bld.x + dx) * TILE_SIZE + TILE_SIZE / 2;
          const py = (bld.y + dy) * TILE_SIZE + TILE_SIZE / 2;
          const body = scene.add.rectangle(px, py, TILE_SIZE, TILE_SIZE);
          scene.physics.add.existing(body, true);
          wallBodies.add(body);
          body.setVisible(false);
        }
      }
    }

    // ── Paths (horizontal main road + vertical to castle) ──
    const midY = Math.floor(config.height / 2);
    const pathKey = `tile_path_${regionId}`;
    for (let x = 1; x < config.width - 1; x++) {
      const px = x * TILE_SIZE + TILE_SIZE / 2;
      const py = midY * TILE_SIZE + TILE_SIZE / 2;
      scene.add.image(px, py, pathKey).setDepth(DEPTH.ground + 1);
    }
    // Vertical path from castle to main road
    const midX = Math.floor(config.width / 2);
    for (let y = castleGy + 5; y <= midY; y++) {
      const px = (castleGx + 2) * TILE_SIZE + TILE_SIZE / 2;
      const py = y * TILE_SIZE + TILE_SIZE / 2;
      scene.add.image(px, py, pathKey).setDepth(DEPTH.ground + 1);
    }

    // ── Gate at south entrance ──
    const gateKey = `bld_gate_${regionId}`;
    const gateGx = midX - 1;
    const gateGy = config.height - 5;
    if (scene.textures.exists(gateKey)) {
      const gateCx = (gateGx + 1.5) * TILE_SIZE;
      const gateCy = (gateGy + 1) * TILE_SIZE;
      scene.add.image(gateCx, gateCy, gateKey).setDepth(DEPTH.objects);
    }

    // Vertical path from main road to south gate
    for (let y = midY + 1; y <= gateGy + 1; y++) {
      const px = midX * TILE_SIZE + TILE_SIZE / 2;
      const py = y * TILE_SIZE + TILE_SIZE / 2;
      scene.add.image(px, py, pathKey).setDepth(DEPTH.ground + 1);
    }

    // ── Well ──
    const wellX = (castleGx - 2) * TILE_SIZE + TILE_SIZE / 2;
    const wellY = (midY - 2) * TILE_SIZE + TILE_SIZE / 2;
    scene.add.image(wellX, wellY, 'deco_well').setDepth(DEPTH.objects);
    const wellBody = scene.add.rectangle(wellX, wellY, TILE_SIZE - 4, TILE_SIZE - 4);
    scene.physics.add.existing(wellBody, true);
    wallBodies.add(wellBody);
    wellBody.setVisible(false);

    // ── Bushes & flowers scattered around town ──
    const bushKey = `deco_bush_${regionId}`;
    for (let i = 0; i < 12; i++) {
      const bx = 2 + Math.floor(Math.random() * (config.width - 4));
      const by = Math.floor(config.height * 0.4) + Math.floor(Math.random() * Math.floor(config.height * 0.4));
      scene.add.image(
        bx * TILE_SIZE + TILE_SIZE / 2,
        by * TILE_SIZE + TILE_SIZE / 2,
        scene.textures.exists(bushKey) ? bushKey : 'deco_bush_green',
      ).setDepth(DEPTH.ground + 1).setScale(0.7 + Math.random() * 0.3);
    }

    // ── Town pond ──
    if (scene.textures.exists('deco_pond')) {
      const pondX = (castleGx + 6) * TILE_SIZE + TILE_SIZE / 2;
      const pondY = (midY - 3) * TILE_SIZE + TILE_SIZE / 2;
      scene.add.image(pondX, pondY, 'deco_pond').setDepth(DEPTH.ground + 1).setScale(1.3);
    }
  }

  private static addFieldDecorations(
    scene: Phaser.Scene, config: MapConfig,
    wallBodies: Phaser.Physics.Arcade.StaticGroup, regionId: string,
  ): void {
    const treeKey = `deco_tree_${regionId}`;
    const bushKey = scene.textures.exists(`deco_bush_${regionId}`) ? `deco_bush_${regionId}` : 'deco_bush_green';
    const isDark = regionId.includes('undead') || regionId.includes('demon');
    const isWater = regionId.includes('merfolk') || regionId.includes('hotspring');
    const isVolcanic = regionId.includes('volcano');
    const isMountain = regionId.includes('mountain') || regionId.includes('giant');

    // Determine decoration palette for this region
    const decoTypes: { key: string; weight: number; scale: [number, number]; blocking: boolean }[] = [
      { key: treeKey, weight: 35, scale: [0.8, 1.5], blocking: true },
      { key: 'deco_rock', weight: 15, scale: [0.7, 1.1], blocking: true },
      { key: 'deco_large_rock', weight: 8, scale: [0.9, 1.3], blocking: true },
      { key: bushKey, weight: 12, scale: [0.6, 1.0], blocking: false },
    ];

    // Add region-specific decorations
    if (isDark) {
      decoTypes.push({ key: 'deco_stump', weight: 15, scale: [0.8, 1.2], blocking: true });
      decoTypes.push({ key: 'deco_rock_dark', weight: 10, scale: [0.8, 1.2], blocking: true });
    }
    if (isWater) {
      decoTypes.push({ key: 'deco_water', weight: 12, scale: [1.0, 1.0], blocking: false });
    }
    if (isVolcanic) {
      decoTypes.push({ key: 'deco_rock_dark', weight: 20, scale: [0.8, 1.4], blocking: true });
    }
    if (isMountain) {
      decoTypes.push({ key: 'deco_large_rock', weight: 15, scale: [1.0, 1.5], blocking: true });
    }

    // Total weight for weighted random selection
    const totalWeight = decoTypes.reduce((sum, d) => sum + d.weight, 0);

    // Scattered obstacles
    const obstacleCount = Math.floor((config.width * config.height) * 0.06);
    for (let i = 0; i < obstacleCount; i++) {
      const x = 2 + Math.floor(Math.random() * (config.width - 4));
      const y = 2 + Math.floor(Math.random() * (config.height - 4));
      const px = x * TILE_SIZE + TILE_SIZE / 2;
      const py = y * TILE_SIZE + TILE_SIZE / 2;

      // Weighted random decoration type
      let roll = Math.random() * totalWeight;
      let chosen = decoTypes[0];
      for (const d of decoTypes) {
        roll -= d.weight;
        if (roll <= 0) { chosen = d; break; }
      }

      const decoScale = chosen.scale[0] + Math.random() * (chosen.scale[1] - chosen.scale[0]);
      scene.add.image(px, py, chosen.key).setDepth(chosen.blocking ? DEPTH.objects : DEPTH.ground + 1).setScale(decoScale);

      if (chosen.blocking) {
        const body = scene.add.rectangle(px, py, TILE_SIZE - 8, TILE_SIZE - 8);
        scene.physics.add.existing(body, true);
        wallBodies.add(body);
        body.setVisible(false);
      }
    }

    // River — meandering water path for aquatic regions
    if (isWater) {
      let rx = 5 + Math.floor(Math.random() * (config.width - 10));
      for (let ry = 2; ry < config.height - 2; ry++) {
        rx += Math.floor(Math.random() * 3) - 1;
        rx = Math.max(2, Math.min(config.width - 4, rx));
        const rw = 2 + Math.floor(Math.random() * 2);
        for (let dx = 0; dx < rw; dx++) {
          scene.add.image(
            (rx + dx) * TILE_SIZE + TILE_SIZE / 2,
            ry * TILE_SIZE + TILE_SIZE / 2,
            'deco_water',
          ).setDepth(DEPTH.ground + 1);
        }
      }
    }

    // Flower patches (non-blocking, skip for dark/volcanic regions)
    if (!isDark && !isVolcanic) {
      const flowerCount = 6 + Math.floor(Math.random() * 6);
      for (let i = 0; i < flowerCount; i++) {
        const fx = 2 + Math.floor(Math.random() * (config.width - 4));
        const fy = 2 + Math.floor(Math.random() * (config.height - 4));
        scene.add.image(
          fx * TILE_SIZE + TILE_SIZE / 2,
          fy * TILE_SIZE + TILE_SIZE / 2,
          'deco_flowers',
        ).setDepth(DEPTH.ground + 1);
      }
    }

    // Ponds — most non-volcanic regions get occasional ponds
    if (!isVolcanic && scene.textures.exists('deco_pond')) {
      const pondCount = isWater ? 3 + Math.floor(Math.random() * 3) : Math.random() > 0.5 ? 1 : 0;
      for (let i = 0; i < pondCount; i++) {
        const px = 4 + Math.floor(Math.random() * (config.width - 8));
        const py = 4 + Math.floor(Math.random() * (config.height - 8));
        scene.add.image(
          px * TILE_SIZE + TILE_SIZE / 2,
          py * TILE_SIZE + TILE_SIZE / 2,
          'deco_pond',
        ).setDepth(DEPTH.ground + 1);
      }
    }

    // Hot springs — hotspring region
    if (regionId.includes('hotspring') && scene.textures.exists('deco_hotspring')) {
      const hsCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < hsCount; i++) {
        const hx = 3 + Math.floor(Math.random() * (config.width - 6));
        const hy = 3 + Math.floor(Math.random() * (config.height - 6));
        scene.add.image(
          hx * TILE_SIZE + TILE_SIZE / 2,
          hy * TILE_SIZE + TILE_SIZE / 2,
          'deco_hotspring',
        ).setDepth(DEPTH.ground + 1);
      }
    }

    // Waterfalls — mountain/giant regions
    if (isMountain && scene.textures.exists('deco_waterfall')) {
      const wfCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < wfCount; i++) {
        const wx = 2 + Math.floor(Math.random() * (config.width - 4));
        const wy = 2 + Math.floor(Math.random() * (config.height - 4));
        const wpx = wx * TILE_SIZE + TILE_SIZE / 2;
        const wpy = wy * TILE_SIZE + TILE_SIZE / 2;
        scene.add.image(wpx, wpy, 'deco_waterfall').setDepth(DEPTH.objects);
        const body = scene.add.rectangle(wpx, wpy, TILE_SIZE - 8, TILE_SIZE - 8);
        scene.physics.add.existing(body, true);
        wallBodies.add(body);
        body.setVisible(false);
      }
    }
  }

  static getTownConfig(regionId: string, regionColor: number): MapConfig {
    return {
      width: 40,
      height: 32,
      groundColor: 0x554433,
      wallColor: 0x333333,
      decorColor: regionColor,
      type: 'town',
      regionId,
    };
  }

  static getFieldConfig(regionId: string, regionColor: number): MapConfig {
    return {
      width: 48,
      height: 36,
      groundColor: 0x335522,
      wallColor: 0x223311,
      decorColor: 0x115511,
      type: 'field',
      regionId,
    };
  }

  /** Generate a kingdom banner texture (pennant with region emblem, scales with TILE_SIZE) */
  private static generateBannerTexture(scene: Phaser.Scene, key: string, regionId: string): void {
    const W = TILE_SIZE;
    const H = Math.round(TILE_SIZE * 1.5);
    const f = TILE_SIZE / 32; // scale factor for pixel art coordinates
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const pal = getRegionPalette(regionId);

    // Pole
    ctx.fillStyle = '#6a6a6a';
    ctx.fillRect(W / 2 - f, 0, f * 2, H);
    ctx.fillStyle = '#888888';
    ctx.fillRect(W / 2 - f, 0, f, H);
    // Pole top ornament
    ctx.fillStyle = '#c8a832';
    ctx.fillRect(W / 2 - f * 2, 0, f * 4, f * 3);
    ctx.fillRect(W / 2 - f, 0, f * 2, f);

    // Banner fabric
    const bx = Math.round(4 * f);
    const by = Math.round(3 * f);
    const bw = W - Math.round(8 * f);
    const bh = H - Math.round(14 * f);

    // Fill fabric with region accent + subtle variation
    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        ctx.fillStyle = varyColor(pal.accent, 3);
        ctx.fillRect(bx + px, by + py, 1, 1);
      }
    }

    // Gold trim on top edge
    ctx.fillStyle = '#c8a832';
    ctx.fillRect(bx, by, bw, Math.round(2 * f));
    // Darker border left/right
    ctx.fillStyle = darken(pal.accent, 0.3);
    ctx.fillRect(bx, by + Math.round(2 * f), Math.round(2 * f), bh - Math.round(2 * f));
    ctx.fillRect(bx + bw - Math.round(2 * f), by + Math.round(2 * f), Math.round(2 * f), bh - Math.round(2 * f));

    // Pennant pointed bottom (triangular cutout)
    const tipY = by + bh;
    const tipRows = Math.round(6 * f);
    ctx.fillStyle = pal.accent;
    for (let i = 0; i < tipRows; i++) {
      const indent = Math.floor((i + 1) * (bw / 2) / tipRows);
      ctx.clearRect(bx, tipY + i, indent, 1);
      ctx.clearRect(bx + bw - indent, tipY + i, indent, 1);
      ctx.fillRect(bx + indent, tipY + i, bw - indent * 2, 1);
    }

    // Kingdom emblem (center of banner) — all coords scaled by f
    const ecx = W / 2;
    const ecy = by + Math.round(bh * 0.45);
    ctx.fillStyle = lighten(pal.accent, 0.35);
    const r = (v: number) => Math.round(v * f); // shorthand

    if (regionId.includes('hero')) {
      ctx.fillRect(ecx - f, ecy - r(7), r(2), r(14));
      ctx.fillRect(ecx - r(4), ecy - f, r(8), r(2));
      ctx.fillStyle = '#c8a832';
      ctx.fillRect(ecx - f, ecy + r(5), r(2), r(3));
    } else if (regionId.includes('elf')) {
      for (let i = -5; i <= 5; i++) {
        const w = Math.max(1, r(4 - Math.abs(i)));
        ctx.fillRect(ecx - Math.floor(w / 2), ecy + r(i), w, f);
      }
      ctx.fillStyle = darken(pal.accent, 0.1);
      ctx.fillRect(ecx, ecy - r(5), f, r(10));
    } else if (regionId.includes('treant')) {
      ctx.fillRect(ecx - f, ecy + f, r(2), r(6));
      ctx.fillRect(ecx - r(5), ecy - r(5), r(10), r(6));
      ctx.fillRect(ecx - r(3), ecy - r(7), r(6), r(3));
    } else if (regionId.includes('beast')) {
      ctx.fillRect(ecx - r(4), ecy - r(5), r(2), r(10));
      ctx.fillRect(ecx - f, ecy - r(6), r(2), r(12));
      ctx.fillRect(ecx + r(2), ecy - r(5), r(2), r(10));
    } else if (regionId.includes('merfolk')) {
      ctx.fillRect(ecx - f, ecy - r(4), r(2), r(10));
      ctx.fillRect(ecx - r(4), ecy - r(6), r(2), r(4));
      ctx.fillRect(ecx + r(2), ecy - r(6), r(2), r(4));
      ctx.fillRect(ecx - r(5), ecy - r(4), r(10), r(2));
    } else if (regionId.includes('giant')) {
      for (let i = 0; i < 7; i++) {
        ctx.fillRect(ecx - r(7 - i), ecy + r(4 - i), r(14 - i * 2), f);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ecx - f, ecy - r(3), r(2), r(2));
    } else if (regionId.includes('dwarf')) {
      ctx.fillRect(ecx - f, ecy - r(3), r(2), r(9));
      ctx.fillRect(ecx - r(4), ecy - r(6), r(8), r(4));
      ctx.fillRect(ecx - r(5), ecy + r(5), r(10), r(2));
    } else if (regionId.includes('undead')) {
      ctx.fillRect(ecx - r(3), ecy - r(4), r(6), r(5));
      ctx.fillRect(ecx - r(2), ecy + f, r(4), r(3));
      ctx.fillStyle = darken(pal.accent, 0.2);
      ctx.fillRect(ecx - r(2), ecy - r(2), r(2), r(2));
      ctx.fillRect(ecx + f, ecy - r(2), r(2), r(2));
    } else if (regionId.includes('volcano')) {
      ctx.fillRect(ecx - f, ecy - r(6), r(2), r(3));
      ctx.fillRect(ecx - r(3), ecy - r(3), r(6), r(4));
      ctx.fillRect(ecx - r(4), ecy + f, r(8), r(5));
      ctx.fillStyle = '#ff4422';
      ctx.fillRect(ecx - f, ecy - r(5), r(2), r(4));
    } else if (regionId.includes('hotspring')) {
      ctx.fillRect(ecx - r(4), ecy + f, r(8), r(4));
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(ecx - r(2), ecy - r(4), f, r(4));
      ctx.fillRect(ecx + f, ecy - r(5), f, r(5));
    } else if (regionId.includes('mountain')) {
      for (let i = 0; i < 7; i++) {
        ctx.fillRect(ecx - r(7 - i), ecy + r(4 - i), r(14 - i * 2), f);
      }
      ctx.fillStyle = '#eeeeff';
      ctx.fillRect(ecx - r(2), ecy - r(3), r(4), r(3));
    } else if (regionId.includes('demon')) {
      ctx.fillRect(ecx - r(5), ecy - r(6), r(2), r(7));
      ctx.fillRect(ecx + r(3), ecy - r(6), r(2), r(7));
      ctx.fillRect(ecx - r(2), ecy - f, r(4), r(4));
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(ecx - f, ecy, r(2), r(2));
    } else {
      ctx.fillRect(ecx - f, ecy - r(5), r(2), r(2));
      ctx.fillRect(ecx - r(3), ecy - r(3), r(6), r(2));
      ctx.fillRect(ecx - r(4), ecy - f, r(8), r(2));
      ctx.fillRect(ecx - r(3), ecy + f, r(6), r(2));
      ctx.fillRect(ecx - f, ecy + r(3), r(2), r(2));
    }

    scene.textures.addCanvas(key, canvas);
  }

  /** Generate a guardian statue texture (stone figure with kingdom motifs, scales with TILE_SIZE) */
  private static generateGuardianStatue(scene: Phaser.Scene, key: string, regionId: string): void {
    const W = TILE_SIZE;
    const H = Math.round(TILE_SIZE * 1.5);
    const f = TILE_SIZE / 32; // scale factor
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const pal = getRegionPalette(regionId);

    // Stone base color — varies by kingdom atmosphere
    const stoneBase = regionId.includes('undead') ? '#666677' :
                      regionId.includes('demon') ? '#554466' :
                      regionId.includes('volcano') ? '#665544' :
                      regionId.includes('merfolk') ? '#668888' :
                      '#888888';
    const stoneDk = darken(stoneBase, 0.25);
    const stoneLt = lighten(stoneBase, 0.15);
    const r = (v: number) => Math.round(v * f);

    // ── Pedestal (wide, stable base) ──
    ctx.fillStyle = stoneDk;
    ctx.fillRect(r(2), H - r(10), W - r(4), r(10));
    ctx.fillStyle = stoneBase;
    ctx.fillRect(r(3), H - r(10), W - r(6), r(2));
    ctx.fillStyle = stoneLt;
    ctx.fillRect(r(4), H - r(10), W - r(8), f);

    // ── Figure body ──
    const bodyX = Math.round(W * 0.25);
    const bodyW = Math.round(W * 0.5);
    const bodyTop = Math.round(H * 0.32);
    const bodyBot = H - r(10);

    // Main torso — pixel-by-pixel stone texture
    for (let py = bodyTop; py < bodyBot; py++) {
      for (let px = bodyX; px < bodyX + bodyW; px++) {
        ctx.fillStyle = varyColor(stoneBase, 3);
        ctx.fillRect(px, py, 1, 1);
      }
    }
    // Shade left edge
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(bodyX, bodyTop, r(2), bodyBot - bodyTop);
    // Highlight right edge
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(bodyX + bodyW - r(2), bodyTop, r(2), bodyBot - bodyTop);

    // ── Head ──
    const headW = Math.round(W * 0.4);
    const headX = Math.round(W / 2 - headW / 2);
    const headTop = Math.round(H * 0.15);
    const headBot = bodyTop + r(2);

    for (let py = headTop; py < headBot; py++) {
      for (let px = headX; px < headX + headW; px++) {
        ctx.fillStyle = varyColor(stoneBase, 3);
        ctx.fillRect(px, py, 1, 1);
      }
    }

    // ── Eyes (glowing with accent color) ──
    ctx.fillStyle = pal.accent;
    const eyeY = headTop + Math.round((headBot - headTop) * 0.45);
    ctx.fillRect(headX + r(3), eyeY, r(2), r(2));
    ctx.fillRect(headX + headW - r(5), eyeY, r(2), r(2));
    ctx.fillStyle = lighten(pal.accent, 0.4);
    ctx.fillRect(headX + r(3), eyeY, f, f);
    ctx.fillRect(headX + headW - r(5), eyeY, f, f);

    // ── Kingdom-specific features (all coords scaled by f) ──
    if (regionId.includes('elf')) {
      ctx.fillStyle = stoneBase;
      ctx.fillRect(headX - r(3), headTop + r(2), r(3), r(5));
      ctx.fillRect(headX + headW, headTop + r(2), r(3), r(5));
      ctx.fillStyle = pal.accent;
      ctx.fillRect(headX + f, headTop, headW - r(2), r(2));
    } else if (regionId.includes('treant')) {
      ctx.fillStyle = darken(stoneBase, 0.1);
      ctx.fillRect(headX - r(2), headTop - r(4), r(2), r(6));
      ctx.fillRect(headX + headW, headTop - r(4), r(2), r(6));
      ctx.fillRect(headX - r(4), headTop - r(6), r(3), r(3));
      ctx.fillRect(headX + headW + f, headTop - r(6), r(3), r(3));
    } else if (regionId.includes('beast')) {
      ctx.fillStyle = lighten(stoneBase, 0.1);
      ctx.fillRect(headX - r(2), headTop - r(6), r(3), r(8));
      ctx.fillRect(headX + headW - f, headTop - r(6), r(3), r(8));
      ctx.fillRect(headX - r(4), headTop - r(4), r(2), r(3));
      ctx.fillRect(headX + headW + f, headTop - r(4), r(2), r(3));
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(headX + r(2), headBot - f, r(2), r(3));
      ctx.fillRect(headX + headW - r(4), headBot - f, r(2), r(3));
    } else if (regionId.includes('merfolk')) {
      ctx.fillStyle = stoneBase;
      ctx.fillRect(W / 2 - f, headTop - r(5), r(2), r(5));
      ctx.fillRect(W / 2 - r(3), headTop - r(3), r(6), r(3));
    } else if (regionId.includes('giant')) {
      ctx.fillStyle = stoneLt;
      ctx.fillRect(headX - r(2), headTop - r(3), headW + r(4), r(5));
      ctx.fillStyle = stoneDk;
      ctx.fillRect(headX - r(2), headTop + f, headW + r(4), r(2));
    } else if (regionId.includes('dwarf')) {
      ctx.fillStyle = stoneLt;
      ctx.fillRect(headX - f, headTop - r(2), headW + r(2), r(4));
      ctx.fillRect(headX - r(3), headTop, r(2), r(5));
      ctx.fillRect(headX + headW + f, headTop, r(2), r(5));
      ctx.fillStyle = stoneBase;
      ctx.fillRect(headX + f, headBot, headW - r(2), r(5));
      ctx.fillRect(headX + r(2), headBot + r(5), headW - r(4), r(2));
    } else if (regionId.includes('undead')) {
      ctx.fillStyle = stoneDk;
      ctx.fillRect(headX - r(2), headTop - r(2), headW + r(4), headBot - headTop + r(4));
      ctx.fillStyle = '#222233';
      ctx.fillRect(headX, headTop + r(2), headW, headBot - headTop - r(2));
      ctx.fillStyle = '#8866cc';
      ctx.fillRect(headX + r(3), eyeY, r(2), r(2));
      ctx.fillRect(headX + headW - r(5), eyeY, r(2), r(2));
    } else if (regionId.includes('volcano')) {
      ctx.fillStyle = '#cc4422';
      ctx.fillRect(headX + f, headTop - r(4), r(2), r(4));
      ctx.fillRect(headX + headW - r(3), headTop - r(4), r(2), r(4));
      ctx.fillRect(W / 2 - f, headTop - r(6), r(2), r(6));
      ctx.fillStyle = '#ff8844';
      ctx.fillRect(W / 2 - f, headTop - r(5), f, r(2));
    } else if (regionId.includes('demon')) {
      ctx.fillStyle = '#553344';
      ctx.fillRect(headX - r(3), headTop - r(7), r(3), r(9));
      ctx.fillRect(headX + headW, headTop - r(7), r(3), r(9));
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(headX + r(3), eyeY, r(2), r(2));
      ctx.fillRect(headX + headW - r(5), eyeY, r(2), r(2));
    } else {
      ctx.fillStyle = '#c8a832';
      ctx.fillRect(headX + f, headTop - r(3), headW - r(2), r(4));
      ctx.fillRect(headX + r(2), headTop - r(5), r(2), r(3));
      ctx.fillRect(W / 2 - f, headTop - r(5), r(2), r(3));
      ctx.fillRect(headX + headW - r(4), headTop - r(5), r(2), r(3));
    }

    // ── Weapon/held item (region-appropriate) ──
    ctx.fillStyle = stoneLt;
    if (regionId.includes('hero') || regionId.includes('giant')) {
      ctx.fillRect(bodyX - r(4), bodyTop + r(4), r(2), Math.round(H * 0.3));
      ctx.fillRect(bodyX - r(6), bodyTop + r(4), r(6), r(2));
    } else if (regionId.includes('dwarf')) {
      ctx.fillRect(bodyX + bodyW + f, bodyTop + r(4), r(2), Math.round(H * 0.28));
      ctx.fillStyle = stoneDk;
      ctx.fillRect(bodyX + bodyW + r(2), bodyTop + r(4), r(4), r(6));
    } else if (regionId.includes('merfolk')) {
      ctx.fillRect(bodyX - r(3), bodyTop, r(2), Math.round(H * 0.38));
      ctx.fillRect(bodyX - r(6), bodyTop, r(8), r(2));
      ctx.fillRect(bodyX - r(6), bodyTop - r(2), r(2), r(3));
      ctx.fillRect(bodyX + r(2), bodyTop - r(2), r(2), r(3));
    } else if (regionId.includes('elf')) {
      ctx.fillStyle = stoneDk;
      const bowLen = Math.round(12 * f);
      for (let i = 0; i < bowLen; i++) {
        const bx = bodyX + bodyW + f + Math.round(Math.sin(i / f * 0.5) * r(2));
        ctx.fillRect(bx, bodyTop + r(2) + i, r(2), 1);
      }
    }

    // ── Accent sash / belt ──
    ctx.fillStyle = pal.accent;
    const beltY = Math.round((bodyTop + bodyBot) * 0.48);
    ctx.fillRect(bodyX + f, beltY, bodyW - r(2), r(2));
    ctx.fillStyle = lighten(pal.accent, 0.3);
    ctx.fillRect(W / 2 - f, beltY, r(2), r(2));

    scene.textures.addCanvas(key, canvas);
  }

  /**
   * Generate a universal building type sign (hanging wooden sign with icon).
   * Same appearance across all kingdoms for consistent identification.
   */
  private static generateBuildingSign(scene: Phaser.Scene, key: string, type: 'inn' | 'shop' | 'church'): void {
    const S = TILE_SIZE;
    const f = S / 32;
    const r = (v: number) => Math.round(v * f);
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;

    // Hanging pole (horizontal bracket from building wall)
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(0, r(2), r(14), r(2));
    ctx.fillStyle = '#6a5a4a';
    ctx.fillRect(0, r(2), r(14), r(1));

    // Vertical chains/rope
    ctx.fillStyle = '#888888';
    ctx.fillRect(r(4), r(4), r(1), r(4));
    ctx.fillRect(r(12), r(4), r(1), r(4));

    // Wooden sign board (rounded rectangle)
    const bx = r(2), by = r(8), bw = r(14), bh = r(14);
    // Board shadow
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(bx + r(1), by + r(1), bw, bh);
    // Board main
    ctx.fillStyle = '#8b6f47';
    ctx.fillRect(bx, by, bw, bh);
    // Board highlight (top edge)
    ctx.fillStyle = '#a08050';
    ctx.fillRect(bx, by, bw, r(2));
    // Board border
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(bx, by, bw, r(1));
    ctx.fillRect(bx, by + bh - r(1), bw, r(1));
    ctx.fillRect(bx, by, r(1), bh);
    ctx.fillRect(bx + bw - r(1), by, r(1), bh);

    // Icon area center
    const cx = bx + bw / 2;
    const cy = by + bh / 2;

    if (type === 'inn') {
      // Moon + Z icon (sleep/rest)
      ctx.fillStyle = '#ffdd44';
      // Crescent moon — draw full circle then erase inner
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const mx = cx - r(2) + Math.cos(a) * r(4);
        const my = cy - r(1) + Math.sin(a) * r(4);
        ctx.fillRect(Math.round(mx), Math.round(my), r(1), r(1));
      }
      // Erase inner circle to make crescent
      ctx.fillStyle = '#8b6f47';
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const mx = cx - r(1) + Math.cos(a) * r(3);
        const my = cy - r(2) + Math.sin(a) * r(3);
        ctx.fillRect(Math.round(mx), Math.round(my), r(2), r(2));
      }
      // Z letters (sleep)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + r(2), cy - r(4), r(3), r(1));
      ctx.fillRect(cx + r(2), cy - r(2), r(3), r(1));
      ctx.fillRect(cx + r(4), cy - r(3), r(1), r(1));
      ctx.fillRect(cx + r(2), cy - r(3), r(1), r(1));
    } else if (type === 'shop') {
      // Gold coin icon
      ctx.fillStyle = '#cc9922';
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const mx = cx + Math.cos(a) * r(4);
        const my = cy + Math.sin(a) * r(4);
        ctx.fillRect(Math.round(mx), Math.round(my), r(1), r(1));
      }
      // Fill interior
      ctx.fillStyle = '#ddaa33';
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const mx = cx + Math.cos(a) * r(3);
        const my = cy + Math.sin(a) * r(3);
        ctx.fillRect(Math.round(mx), Math.round(my), r(1), r(1));
      }
      ctx.fillStyle = '#eebb44';
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const mx = cx + Math.cos(a) * r(2);
        const my = cy + Math.sin(a) * r(2);
        ctx.fillRect(Math.round(mx), Math.round(my), r(1), r(1));
      }
      // $ symbol on coin
      ctx.fillStyle = '#996600';
      ctx.fillRect(cx - r(1), cy - r(3), r(2), r(1));
      ctx.fillRect(cx - r(2), cy - r(2), r(1), r(1));
      ctx.fillRect(cx - r(1), cy - r(1), r(2), r(1));
      ctx.fillRect(cx + r(1), cy, r(1), r(1));
      ctx.fillRect(cx - r(1), cy + r(1), r(2), r(1));
      ctx.fillRect(cx, cy - r(3), r(1), r(6));
    } else if (type === 'church') {
      // Cross / star icon
      ctx.fillStyle = '#ffffff';
      // Vertical bar
      ctx.fillRect(cx - r(1), cy - r(5), r(2), r(10));
      // Horizontal bar (slightly above center)
      ctx.fillRect(cx - r(4), cy - r(2), r(8), r(2));
      // Glow effect
      ctx.fillStyle = 'rgba(255,255,200,0.3)';
      ctx.fillRect(cx - r(2), cy - r(3), r(4), r(4));
      // Highlight
      ctx.fillStyle = '#ffffcc';
      ctx.fillRect(cx, cy - r(4), r(1), r(1));
    }

    scene.textures.addCanvas(key, canvas);
  }
}
