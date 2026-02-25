import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { DEPTH } from '../utils/constants';
import { getRegionPalette } from '../art/palettes';
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
    }

    // ── Regular buildings (2×2) — arranged asymmetrically around castle ──
    const buildingPositions = [
      { x: 3, y: 3, w: 2, h: 2 },
      { x: 8, y: 4, w: 2, h: 2 },
      { x: 24, y: 3, w: 2, h: 2 },
      { x: 29, y: 4, w: 2, h: 2 },
      { x: 3, y: 17, w: 2, h: 2 },
      { x: 10, y: 19, w: 2, h: 2 },
      { x: 22, y: 18, w: 2, h: 2 },
      { x: 29, y: 17, w: 2, h: 2 },
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

    for (let i = 0; i < buildingPositions.length; i++) {
      const bld = buildingPositions[i];
      if (bld.x + bld.w >= config.width - 1 || bld.y + bld.h >= config.height - 1) continue;

      const bldCx = bld.x * TILE_SIZE + TILE_SIZE;
      const bldCy = bld.y * TILE_SIZE + TILE_SIZE;
      const bldKey = typedBuildingKeys[i] ?? buildingKeys[i % buildingKeys.length];
      const bldScale = 1.0 + Math.random() * 0.25;
      scene.add.image(bldCx, bldCy, bldKey).setDepth(DEPTH.objects).setScale(bldScale);

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
    for (let i = 0; i < 6; i++) {
      const bx = 2 + Math.floor(Math.random() * (config.width - 4));
      const by = 8 + Math.floor(Math.random() * (config.height - 12));
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
      width: 34,
      height: 26,
      groundColor: 0x554433,
      wallColor: 0x333333,
      decorColor: regionColor,
      type: 'town',
      regionId,
    };
  }

  static getFieldConfig(regionId: string, regionColor: number): MapConfig {
    return {
      width: 40,
      height: 28,
      groundColor: 0x335522,
      wallColor: 0x223311,
      decorColor: 0x115511,
      type: 'field',
      regionId,
    };
  }
}
