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
    // Buildings (2×2 tile each) — spread across the town grid
    const buildingPositions = [
      { x: 3, y: 3, w: 2, h: 2 },
      { x: 10, y: 3, w: 2, h: 2 },
      { x: 20, y: 3, w: 2, h: 2 },
      { x: 28, y: 3, w: 2, h: 2 },
      { x: 3, y: 18, w: 2, h: 2 },
      { x: 10, y: 18, w: 2, h: 2 },
      { x: 20, y: 18, w: 2, h: 2 },
      { x: 28, y: 18, w: 2, h: 2 },
    ];

    const buildingKeys = [`bld_region_${regionId}`, 'bld_tudor', 'bld_shop', 'bld_inn'];

    for (let i = 0; i < buildingPositions.length; i++) {
      const bld = buildingPositions[i];
      if (bld.x + bld.w >= config.width - 1 || bld.y + bld.h >= config.height - 1) continue;

      // Place building sprite (centered on 2×2 area)
      const bldCx = bld.x * TILE_SIZE + TILE_SIZE;
      const bldCy = bld.y * TILE_SIZE + TILE_SIZE;
      const bldKey = buildingKeys[i % buildingKeys.length];
      scene.add.image(bldCx, bldCy, bldKey).setDepth(DEPTH.objects);

      // Collision for the 2×2 area
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

    // Paths (use path texture for the middle row)
    const midY = Math.floor(config.height / 2);
    for (let x = 1; x < config.width - 1; x++) {
      const pathKey = `tile_path_${regionId}`;
      const px = x * TILE_SIZE + TILE_SIZE / 2;
      const py = midY * TILE_SIZE + TILE_SIZE / 2;
      scene.add.image(px, py, pathKey).setDepth(DEPTH.ground + 1);
    }

    // Well decoration in center
    const wellX = Math.floor(config.width / 2) * TILE_SIZE + TILE_SIZE / 2;
    const wellY = (midY - 2) * TILE_SIZE + TILE_SIZE / 2;
    scene.add.image(wellX, wellY, 'deco_well').setDepth(DEPTH.objects);
    const wellBody = scene.add.rectangle(wellX, wellY, TILE_SIZE - 4, TILE_SIZE - 4);
    scene.physics.add.existing(wellBody, true);
    wallBodies.add(wellBody);
    wellBody.setVisible(false);
  }

  private static addFieldDecorations(
    scene: Phaser.Scene, config: MapConfig,
    wallBodies: Phaser.Physics.Arcade.StaticGroup, regionId: string,
  ): void {
    const treeKey = `deco_tree_${regionId}`;
    const rockKey = 'deco_rock';

    // Scattered trees and rocks
    const obstacleCount = Math.floor((config.width * config.height) * 0.05);
    for (let i = 0; i < obstacleCount; i++) {
      const x = 2 + Math.floor(Math.random() * (config.width - 4));
      const y = 2 + Math.floor(Math.random() * (config.height - 4));
      const px = x * TILE_SIZE + TILE_SIZE / 2;
      const py = y * TILE_SIZE + TILE_SIZE / 2;

      // Alternate between trees and rocks
      const isTree = Math.random() > 0.3;
      const key = isTree ? treeKey : rockKey;

      scene.add.image(px, py, key).setDepth(DEPTH.objects);
      const body = scene.add.rectangle(px, py, TILE_SIZE - 8, TILE_SIZE - 8);
      scene.physics.add.existing(body, true);
      wallBodies.add(body);
      body.setVisible(false);
    }

    // Flower patches (non-blocking)
    if (!regionId.includes('undead') && !regionId.includes('demon') && !regionId.includes('volcano')) {
      for (let i = 0; i < 8; i++) {
        const fx = 2 + Math.floor(Math.random() * (config.width - 4));
        const fy = 2 + Math.floor(Math.random() * (config.height - 4));
        scene.add.image(
          fx * TILE_SIZE + TILE_SIZE / 2,
          fy * TILE_SIZE + TILE_SIZE / 2,
          'deco_flowers',
        ).setDepth(DEPTH.ground + 1);
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
