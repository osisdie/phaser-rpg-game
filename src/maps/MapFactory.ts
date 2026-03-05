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
  type: 'town' | 'field' | 'cave';
  regionId: string;
}

interface BuildingPlacement {
  gx: number; gy: number;
  type: 'inn' | 'shop' | 'church' | 'house';
}

interface SpecialDeco {
  key: string; gx: number; gy: number;
  scale?: number; blocking?: boolean;
}

interface KingdomTownLayout {
  castle: { gx: number; gy: number; size: number };
  buildings: BuildingPlacement[];
  gate: { gx: number; gy: number };
  mainRoadY: number;
  specialDecos: SpecialDeco[];
  treeDensity: number;  // 0-1, fraction of eligible tiles that get trees
  noTrees?: boolean;    // dwarf/cave kingdoms with no trees
  canalY?: number;      // merfolk: horizontal water channel row
}

const KINGDOM_LAYOUTS: Record<string, KingdomTownLayout> = {
  // 1. Hero (勇者王國) — Classic medieval town
  r1: {
    castle: { gx: 18, gy: 2, size: 5 },
    buildings: [
      { gx: 4, gy: 6, type: 'inn' },
      { gx: 10, gy: 8, type: 'house' },
      { gx: 28, gy: 6, type: 'shop' },
      { gx: 32, gy: 8, type: 'house' },
      { gx: 4, gy: 20, type: 'church' },
      { gx: 10, gy: 20, type: 'house' },
      { gx: 28, gy: 20, type: 'house' },
      { gx: 32, gy: 20, type: 'house' },
    ],
    gate: { gx: 19, gy: 27 },
    mainRoadY: 16,
    specialDecos: [
      { key: 'well', gx: 20, gy: 14, blocking: true },
      { key: 'deco_training_dummy', gx: 16, gy: 26, blocking: true },
    ],
    treeDensity: 0.3,
  },
  // 2. Elf (精靈王國) — Forest settlement
  r2: {
    castle: { gx: 18, gy: 2, size: 5 },
    buildings: [
      { gx: 6, gy: 10, type: 'inn' },
      { gx: 30, gy: 12, type: 'shop' },
      { gx: 8, gy: 24, type: 'church' },
      { gx: 24, gy: 8, type: 'house' },
      { gx: 16, gy: 18, type: 'house' },
      { gx: 34, gy: 20, type: 'house' },
    ],
    gate: { gx: 19, gy: 27 },
    mainRoadY: 15,
    specialDecos: [
      { key: 'deco_vine_arch', gx: 19, gy: 26, blocking: false },
      { key: 'deco_hanging_lantern', gx: 12, gy: 14, blocking: false },
      { key: 'deco_hanging_lantern', gx: 26, gy: 16, blocking: false },
    ],
    treeDensity: 0.8,
  },
  // 3. Treant (樹人王國) — Ancient grove
  r3: {
    castle: { gx: 18, gy: 2, size: 5 },
    buildings: [
      { gx: 4, gy: 12, type: 'inn' },
      { gx: 32, gy: 10, type: 'shop' },
      { gx: 6, gy: 22, type: 'church' },
      { gx: 14, gy: 14, type: 'house' },
      { gx: 24, gy: 14, type: 'house' },
      { gx: 28, gy: 22, type: 'house' },
    ],
    gate: { gx: 19, gy: 27 },
    mainRoadY: 16,
    specialDecos: [
      { key: 'deco_ancient_tree', gx: 19, gy: 8, blocking: true, scale: 2 },
      { key: 'deco_mushroom_large', gx: 10, gy: 18, blocking: false },
      { key: 'deco_mushroom_large', gx: 30, gy: 18, blocking: false },
    ],
    treeDensity: 0.6,
  },
  // 4. Beast (獸人王國) — Tribal camp
  r4: {
    castle: { gx: 18, gy: 2, size: 5 },
    buildings: [
      { gx: 6, gy: 8, type: 'inn' },
      { gx: 30, gy: 8, type: 'shop' },
      { gx: 6, gy: 22, type: 'church' },
      { gx: 30, gy: 22, type: 'house' },
      { gx: 14, gy: 20, type: 'house' },
      { gx: 24, gy: 20, type: 'house' },
    ],
    gate: { gx: 19, gy: 27 },
    mainRoadY: 15,
    specialDecos: [
      { key: 'deco_fire_pit', gx: 19, gy: 15, blocking: true },
      { key: 'deco_totem', gx: 14, gy: 12, blocking: true },
      { key: 'deco_totem', gx: 24, gy: 12, blocking: true },
      { key: 'deco_arena', gx: 18, gy: 20, blocking: false },
    ],
    treeDensity: 0.15,
  },
  // 5. Merfolk (人魚王國) — Waterfront settlement
  r5: {
    castle: { gx: 18, gy: 2, size: 5 },
    buildings: [
      { gx: 4, gy: 8, type: 'inn' },
      { gx: 28, gy: 6, type: 'shop' },
      { gx: 4, gy: 22, type: 'church' },
      { gx: 34, gy: 8, type: 'house' },
      { gx: 14, gy: 22, type: 'house' },
      { gx: 28, gy: 22, type: 'house' },
    ],
    gate: { gx: 19, gy: 27 },
    mainRoadY: 12,
    canalY: 15,
    specialDecos: [
      { key: 'deco_canal_bridge', gx: 19, gy: 15, blocking: false },
      { key: 'deco_canal_bridge', gx: 10, gy: 15, blocking: false },
      { key: 'deco_canal_bridge', gx: 30, gy: 15, blocking: false },
      { key: 'deco_dock', gx: 36, gy: 14, blocking: true },
    ],
    treeDensity: 0.2,
  },
  // 6. Giant (巨人王國) — Mountain fortress
  r6: {
    castle: { gx: 18, gy: 2, size: 5 },
    buildings: [
      { gx: 4, gy: 8, type: 'inn' },
      { gx: 30, gy: 8, type: 'shop' },
      { gx: 6, gy: 22, type: 'church' },
      { gx: 30, gy: 22, type: 'house' },
    ],
    gate: { gx: 19, gy: 27 },
    mainRoadY: 16,
    specialDecos: [
      { key: 'rock', gx: 14, gy: 14, blocking: true },
      { key: 'rock', gx: 24, gy: 14, blocking: true },
      { key: 'rock', gx: 10, gy: 20, blocking: true },
      { key: 'rock', gx: 28, gy: 18, blocking: true },
    ],
    treeDensity: 0.1,
  },
  // 7. Dwarf (矮人王國) — Underground city
  r7: {
    castle: { gx: 18, gy: 2, size: 5 },
    buildings: [
      { gx: 4, gy: 6, type: 'inn' },
      { gx: 28, gy: 6, type: 'shop' },
      { gx: 4, gy: 14, type: 'church' },
      { gx: 10, gy: 6, type: 'house' },
      { gx: 14, gy: 14, type: 'house' },
      { gx: 28, gy: 14, type: 'house' },
      { gx: 10, gy: 22, type: 'house' },
      { gx: 28, gy: 22, type: 'house' },
    ],
    gate: { gx: 19, gy: 27 },
    mainRoadY: 16,
    noTrees: true,
    specialDecos: [
      { key: 'deco_crystal', gx: 16, gy: 10, blocking: false },
      { key: 'deco_crystal', gx: 24, gy: 10, blocking: false },
      { key: 'deco_mushroom_large', gx: 20, gy: 20, blocking: false },
      { key: 'deco_mine_entrance_sm', gx: 34, gy: 14, blocking: true },
    ],
    treeDensity: 0,
  },
  // 8. Undead (不死王國) — Haunted ruins
  r8: {
    castle: { gx: 18, gy: 2, size: 5 },
    buildings: [
      { gx: 6, gy: 10, type: 'inn' },
      { gx: 26, gy: 8, type: 'shop' },
      { gx: 8, gy: 24, type: 'church' },
      { gx: 32, gy: 6, type: 'house' },
      { gx: 14, gy: 20, type: 'house' },
      { gx: 30, gy: 22, type: 'house' },
    ],
    gate: { gx: 19, gy: 27 },
    mainRoadY: 15,
    specialDecos: [
      { key: 'deco_gravestone', gx: 16, gy: 14, blocking: true },
      { key: 'deco_gravestone', gx: 18, gy: 13, blocking: true },
      { key: 'deco_gravestone', gx: 20, gy: 14, blocking: true },
      { key: 'deco_gravestone', gx: 22, gy: 13, blocking: true },
    ],
    treeDensity: 0.15,
  },
  // 9. Volcano (火山族) — Obsidian stronghold
  r9: {
    castle: { gx: 18, gy: 2, size: 5 },
    buildings: [
      { gx: 4, gy: 8, type: 'inn' },
      { gx: 30, gy: 8, type: 'shop' },
      { gx: 4, gy: 22, type: 'church' },
      { gx: 32, gy: 8, type: 'house' },
      { gx: 10, gy: 20, type: 'house' },
      { gx: 28, gy: 20, type: 'house' },
    ],
    gate: { gx: 19, gy: 27 },
    mainRoadY: 16,
    specialDecos: [
      { key: 'deco_lava_vent', gx: 14, gy: 14, blocking: false },
      { key: 'deco_lava_vent', gx: 24, gy: 14, blocking: false },
      { key: 'deco_lava_vent', gx: 20, gy: 20, blocking: false },
    ],
    treeDensity: 0.05,
  },
  // 10. Hotspring (溫泉族) — Onsen village
  r10: {
    castle: { gx: 18, gy: 2, size: 5 },
    buildings: [
      { gx: 4, gy: 10, type: 'inn' },
      { gx: 34, gy: 8, type: 'shop' },
      { gx: 6, gy: 24, type: 'church' },
      { gx: 14, gy: 6, type: 'house' },
      { gx: 24, gy: 6, type: 'house' },
      { gx: 28, gy: 24, type: 'house' },
    ],
    gate: { gx: 19, gy: 27 },
    mainRoadY: 16,
    specialDecos: [
      { key: 'hotspring', gx: 16, gy: 14, blocking: false },
      { key: 'hotspring', gx: 24, gy: 14, blocking: false },
      { key: 'deco_stone_lantern', gx: 12, gy: 18, blocking: true },
      { key: 'deco_stone_lantern', gx: 28, gy: 18, blocking: true },
      { key: 'deco_bamboo_fence', gx: 14, gy: 18, blocking: false },
    ],
    treeDensity: 0.25,
  },
  // 11. Mountain (高山族) — Alpine village
  r11: {
    castle: { gx: 18, gy: 2, size: 5 },
    buildings: [
      { gx: 4, gy: 10, type: 'inn' },
      { gx: 30, gy: 6, type: 'shop' },
      { gx: 6, gy: 24, type: 'church' },
      { gx: 32, gy: 12, type: 'house' },
      { gx: 12, gy: 18, type: 'house' },
      { gx: 26, gy: 20, type: 'house' },
    ],
    gate: { gx: 19, gy: 27 },
    mainRoadY: 15,
    specialDecos: [
      { key: 'deco_prayer_flag', gx: 16, gy: 10, blocking: false },
      { key: 'deco_prayer_flag', gx: 22, gy: 10, blocking: false },
      { key: 'deco_cairn', gx: 20, gy: 14, blocking: true },
      { key: 'deco_cairn', gx: 14, gy: 22, blocking: true },
    ],
    treeDensity: 0.2,
  },
  // 12. Demon (魔王城) — Dark fortress
  r12: {
    castle: { gx: 18, gy: 2, size: 5 },
    buildings: [
      { gx: 4, gy: 8, type: 'inn' },
      { gx: 32, gy: 8, type: 'shop' },
      { gx: 4, gy: 22, type: 'church' },
      { gx: 32, gy: 22, type: 'house' },
      { gx: 14, gy: 14, type: 'house' },
      { gx: 24, gy: 14, type: 'house' },
    ],
    gate: { gx: 19, gy: 27 },
    mainRoadY: 16,
    specialDecos: [
      { key: 'deco_rune_circle', gx: 18, gy: 14, blocking: false },
      { key: 'deco_rune_circle', gx: 10, gy: 20, blocking: false },
      { key: 'deco_rune_circle', gx: 28, gy: 20, blocking: false },
    ],
    treeDensity: 0.05,
  },
};

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

    // Gate openings in border walls
    const midX = Math.floor(config.width / 2);
    const hasSouthGate = config.type === 'town' || config.type === 'field';
    const hasWestGate = config.type === 'town';
    // Both field and town use 5-tile-wide south gate for reliable exit
    const southGateHalf = 2;
    // West gate: 3-tile gap on left border, southwest area (y = height-8 to height-6)
    const westGateY = config.height - 8;

    // Generate ground + wall tiles
    for (let y = 0; y < config.height; y++) {
      for (let x = 0; x < config.width; x++) {
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        const isBorder = x === 0 || y === 0 || x === config.width - 1 || y === config.height - 1;
        // Skip collision body at gate openings (visual wall tile still rendered)
        const isSouthGate = hasSouthGate && y === config.height - 1
          && x >= midX - southGateHalf && x <= midX + southGateHalf;
        const isWestGate = hasWestGate && x === 0
          && y >= westGateY && y <= westGateY + 2;
        const isWall = isBorder && !isSouthGate && !isWestGate;

        if (isBorder) {
          const isGate = isSouthGate || isWestGate;
          if (isGate) {
            // Gate openings render as ground — visible opening in the wall
            const variant = Math.floor(Math.random() * 3);
            const prefix = config.type === 'cave' ? 'tile_cave_ground' : 'tile_ground';
            const groundKey = `${prefix}_${rid}_${variant}`;
            scene.add.image(px, py, groundKey).setDepth(DEPTH.ground);
          } else {
            const wallKey = config.type === 'cave' ? `tile_cave_wall_${rid}` : `tile_wall_${rid}`;
            const wall = scene.add.image(px, py, wallKey).setDepth(DEPTH.ground);
            groundLayer.push(wall);
            if (isWall) {
              const wallBody = scene.add.rectangle(px, py, TILE_SIZE, TILE_SIZE);
              scene.physics.add.existing(wallBody, true);
              wallBodies.add(wallBody);
              wallBody.setVisible(false);
            }
          }
        } else {
          // Randomize between 3 ground variants
          const variant = Math.floor(Math.random() * 3);
          const prefix = config.type === 'cave' ? 'tile_cave_ground' : 'tile_ground';
          const groundKey = `${prefix}_${rid}_${variant}`;
          const ground = scene.add.image(px, py, groundKey).setDepth(DEPTH.ground);
          groundLayer.push(ground);
        }
      }
    }

    // Add decorations
    if (config.type === 'town') {
      this.addTownDecorations(scene, config, wallBodies, rid);
    } else if (config.type === 'cave') {
      this.addCaveDecorations(scene, config, wallBodies, rid);
    } else {
      this.addFieldDecorations(scene, config, wallBodies, rid);
    }

    return { groundLayer, wallBodies, bounds: { width: mapW, height: mapH } };
  }

  private static addTownDecorations(
    scene: Phaser.Scene, config: MapConfig,
    wallBodies: Phaser.Physics.Arcade.StaticGroup, regionId: string,
  ): void {
    const layout = KINGDOM_LAYOUTS[regionId] ?? KINGDOM_LAYOUTS.r1;
    const occupied = new Set<string>(); // "gx,gy" keys to prevent overlap
    const mark = (gx: number, gy: number, w = 1, h = 1) => {
      for (let dy = 0; dy < h; dy++)
        for (let dx = 0; dx < w; dx++) occupied.add(`${gx + dx},${gy + dy}`);
    };

    // ── Castle ──
    const { gx: castleGx, gy: castleGy, size: castleSize } = layout.castle;
    const castleKey = `bld_castle_${regionId}`;
    if (scene.textures.exists(castleKey)) {
      const castleCx = (castleGx + castleSize / 2) * TILE_SIZE;
      const castleCy = (castleGy + castleSize / 2) * TILE_SIZE;
      scene.add.image(castleCx, castleCy, castleKey).setDepth(DEPTH.objects);
      for (let dy = 0; dy < castleSize; dy++) {
        for (let dx = 0; dx < castleSize; dx++) {
          const px = (castleGx + dx) * TILE_SIZE + TILE_SIZE / 2;
          const py = (castleGy + dy) * TILE_SIZE + TILE_SIZE / 2;
          const body = scene.add.rectangle(px, py, TILE_SIZE, TILE_SIZE);
          scene.physics.add.existing(body, true);
          wallBodies.add(body);
          body.setVisible(false);
        }
      }
      mark(castleGx, castleGy, castleSize, castleSize);

      // Kingdom banner
      const bannerKey = `banner_${regionId}`;
      if (!scene.textures.exists(bannerKey)) this.generateBannerTexture(scene, bannerKey, regionId);
      const bannerImg = scene.add.image(castleCx, castleGy * TILE_SIZE - TILE_SIZE * 0.3, bannerKey)
        .setDepth(DEPTH.objects + 1);
      scene.tweens.add({
        targets: bannerImg,
        angle: { from: -3, to: 3 }, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // ── Guardian statues at gate ──
    {
      const { gx: gateGx, gy: gateGy } = layout.gate;
      const midX = gateGx + 1;
      const statueKey = `statue_${regionId}`;
      if (!scene.textures.exists(statueKey)) this.generateGuardianStatue(scene, statueKey, regionId);
      const statueY = (gateGy + 2) * TILE_SIZE + TILE_SIZE / 2;
      scene.add.image((midX - 1) * TILE_SIZE, statueY, statueKey).setDepth(DEPTH.objects);
      scene.add.image((midX + 2) * TILE_SIZE, statueY, statueKey).setDepth(DEPTH.objects).setFlipX(true);
      for (const sx of [(midX - 1) * TILE_SIZE, (midX + 2) * TILE_SIZE]) {
        const sb = scene.add.rectangle(sx, statueY, TILE_SIZE - 8, TILE_SIZE - 8);
        scene.physics.add.existing(sb, true);
        wallBodies.add(sb);
        sb.setVisible(false);
      }
    }

    // ── Buildings from layout ──
    const bldHouseKeys = [
      `bld_region_${regionId}_0`, `bld_region_${regionId}_1`,
      `bld_region_${regionId}_2`, `bld_region_${regionId}_3`,
    ];
    const signMap: Record<string, { key: string; type: 'inn' | 'shop' | 'church' }> = {
      inn:    { key: 'sign_inn', type: 'inn' },
      shop:   { key: 'sign_shop', type: 'shop' },
      church: { key: 'sign_church', type: 'church' },
    };
    let houseIdx = 0;
    for (const bld of layout.buildings) {
      const w = 2, h = 2;
      if (bld.gx + w >= config.width - 1 || bld.gy + h >= config.height - 1) continue;

      const bldCx = bld.gx * TILE_SIZE + TILE_SIZE;
      const bldCy = bld.gy * TILE_SIZE + TILE_SIZE;
      let bldKey: string;
      if (bld.type === 'inn') bldKey = `bld_inn_${regionId}`;
      else if (bld.type === 'shop') bldKey = `bld_shop_${regionId}`;
      else if (bld.type === 'church') bldKey = `bld_church_${regionId}`;
      else { bldKey = bldHouseKeys[houseIdx % bldHouseKeys.length]; houseIdx++; }

      const bldScale = 1.0 + Math.random() * 0.25;
      scene.add.image(bldCx, bldCy, bldKey).setDepth(DEPTH.objects).setScale(bldScale);

      // Type sign for inn/shop/church
      const si = signMap[bld.type];
      if (si) {
        if (!scene.textures.exists(si.key)) this.generateBuildingSign(scene, si.key, si.type);
        const signX = (bld.gx + w) * TILE_SIZE + TILE_SIZE * 0.3;
        const signY = bld.gy * TILE_SIZE + TILE_SIZE * 0.5;
        scene.add.image(signX, signY, si.key).setDepth(DEPTH.objects + 1);
      }

      // Collision
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const px = (bld.gx + dx) * TILE_SIZE + TILE_SIZE / 2;
          const py = (bld.gy + dy) * TILE_SIZE + TILE_SIZE / 2;
          const body = scene.add.rectangle(px, py, TILE_SIZE, TILE_SIZE);
          scene.physics.add.existing(body, true);
          wallBodies.add(body);
          body.setVisible(false);
        }
      }
      mark(bld.gx, bld.gy, w, h);
    }

    // ── Paths ──
    const pathKey = `tile_path_${regionId}`;
    const roadY = layout.mainRoadY;
    const midX = Math.floor(config.width / 2);
    // Horizontal main road
    for (let x = 1; x < config.width - 1; x++) {
      scene.add.image(x * TILE_SIZE + TILE_SIZE / 2, roadY * TILE_SIZE + TILE_SIZE / 2, pathKey)
        .setDepth(DEPTH.ground + 1);
      mark(x, roadY);
    }
    // Vertical: castle to road
    for (let y = castleGy + layout.castle.size; y <= roadY; y++) {
      scene.add.image(midX * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, pathKey)
        .setDepth(DEPTH.ground + 1);
      mark(midX, y);
    }
    // Vertical: road to gate
    const { gy: gateGy } = layout.gate;
    for (let y = roadY + 1; y <= gateGy + 1; y++) {
      scene.add.image(midX * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, pathKey)
        .setDepth(DEPTH.ground + 1);
      mark(midX, y);
    }

    // Gate
    const gateKey = `bld_gate_${regionId}`;
    if (scene.textures.exists(gateKey)) {
      const gateCx = (layout.gate.gx + 1.5) * TILE_SIZE;
      const gateCy = (gateGy + 1) * TILE_SIZE;
      scene.add.image(gateCx, gateCy, gateKey).setDepth(DEPTH.objects);
    }

    // ── Canal (Merfolk) ──
    if (layout.canalY != null) {
      const waterKey = `tile_water_${regionId}`;
      const fallbackWater = 'tile_ground_r5_0'; // blue-ish ground fallback
      const wk = scene.textures.exists(waterKey) ? waterKey : fallbackWater;
      for (let x = 1; x < config.width - 1; x++) {
        for (let row = 0; row < 2; row++) {
          const cy = layout.canalY + row;
          const px = x * TILE_SIZE + TILE_SIZE / 2;
          const py = cy * TILE_SIZE + TILE_SIZE / 2;
          scene.add.image(px, py, wk).setDepth(DEPTH.ground + 1).setAlpha(0.85);
          // Canal is blocking except where bridges are placed
          const hasBridge = layout.specialDecos.some(
            d => d.key === 'deco_canal_bridge' && d.gx === x && d.gy === layout.canalY,
          );
          if (!hasBridge) {
            const wb = scene.add.rectangle(px, py, TILE_SIZE, TILE_SIZE);
            scene.physics.add.existing(wb, true);
            wallBodies.add(wb);
            wb.setVisible(false);
          }
          mark(x, cy);
        }
      }
    }

    // ── Special decorations from layout ──
    for (const deco of layout.specialDecos) {
      const dk = scene.textures.exists(deco.key) ? deco.key
        : deco.key === 'well' ? 'deco_well'
        : deco.key === 'rock' ? `deco_rock_${regionId}`
        : deco.key === 'hotspring' ? (scene.textures.exists(`deco_hotspring_${regionId}`) ? `deco_hotspring_${regionId}` : 'deco_pond')
        : null;
      if (!dk) continue; // texture not yet generated — skip gracefully
      const px = deco.gx * TILE_SIZE + TILE_SIZE / 2;
      const py = deco.gy * TILE_SIZE + TILE_SIZE / 2;
      const scale = deco.scale ?? 1;
      scene.add.image(px, py, dk).setDepth(DEPTH.objects).setScale(scale);
      if (deco.blocking) {
        const db = scene.add.rectangle(px, py, TILE_SIZE - 4, TILE_SIZE - 4);
        scene.physics.add.existing(db, true);
        wallBodies.add(db);
        db.setVisible(false);
      }
      mark(deco.gx, deco.gy);
    }

    // ── Trees (density-based, skip if noTrees) ──
    if (!layout.noTrees) {
      const treeKey = `deco_tree_${regionId}`;
      for (let y = 2; y < config.height - 2; y++) {
        for (let x = 2; x < config.width - 2; x++) {
          if (occupied.has(`${x},${y}`)) continue;
          if (Math.random() > layout.treeDensity) continue;
          // Also skip tiles adjacent to buildings/paths for breathing room
          const adjOccupied = occupied.has(`${x - 1},${y}`) || occupied.has(`${x + 1},${y}`)
            || occupied.has(`${x},${y - 1}`) || occupied.has(`${x},${y + 1}`);
          if (adjOccupied && Math.random() < 0.7) continue;
          const tk = scene.textures.exists(treeKey) ? treeKey : 'deco_tree_r1';
          scene.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, tk)
            .setDepth(DEPTH.objects).setScale(0.8 + Math.random() * 0.4);
          mark(x, y);
        }
      }
    }

    // ── Bushes scattered (fewer than trees) ──
    const bushKey = `deco_bush_${regionId}`;
    const bk = scene.textures.exists(bushKey) ? bushKey : 'deco_bush_green';
    for (let i = 0; i < 8; i++) {
      const bx = 2 + Math.floor(Math.random() * (config.width - 4));
      const by = Math.floor(config.height * 0.3) + Math.floor(Math.random() * Math.floor(config.height * 0.5));
      if (occupied.has(`${bx},${by}`)) continue;
      scene.add.image(bx * TILE_SIZE + TILE_SIZE / 2, by * TILE_SIZE + TILE_SIZE / 2, bk)
        .setDepth(DEPTH.ground + 1).setScale(0.7 + Math.random() * 0.3);
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
    const isForest = regionId.includes('elf') || regionId.includes('treant') || regionId.includes('hero');

    // ── Overlap detection (same pattern as addTownDecorations) ──
    const occupied = new Set<string>();
    const mark = (gx: number, gy: number, w = 1, h = 1) => {
      for (let dy = 0; dy < h; dy++)
        for (let dx = 0; dx < w; dx++) occupied.add(`${gx + dx},${gy + dy}`);
    };
    const midX = Math.floor(config.width / 2);

    // Pre-mark reserved zones: south gate, cave entrance/exit, boss area, spawn
    // South gate area (center bottom ±3)
    for (let sx = midX - 3; sx <= midX + 3; sx++)
      for (let sy = config.height - 5; sy < config.height; sy++) mark(sx, sy);
    // Cave entrance area (~7×6 around width*0.65, height*0.2)
    const caveGx = Math.floor(config.width * 0.65);
    const caveGy = Math.floor(config.height * 0.2);
    mark(caveGx - 3, caveGy - 3, 7, 8);
    // Cave exit area (~5×5 around width*0.2, height*0.15)
    const exitGx = Math.floor(config.width * 0.2);
    const exitGy = Math.floor(config.height * 0.15);
    mark(exitGx - 2, exitGy - 2, 5, 5);
    // Boss marker area (center, row 4-8)
    mark(midX - 3, 3, 6, 6);
    // Spawn zone (bottom center)
    mark(midX - 2, config.height - 4, 5, 4);

    // Determine decoration palette for this region (capped scales to avoid neighbor bleed)
    const decoTypes: { key: string; weight: number; scale: [number, number]; blocking: boolean }[] = [
      { key: treeKey, weight: 35, scale: [0.9, 1.05], blocking: true },
      { key: 'deco_rock', weight: 15, scale: [0.7, 1.1], blocking: true },
      { key: 'deco_large_rock', weight: 8, scale: [0.9, 1.15], blocking: true },
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

    // ── Kingdom-specific field landmarks ──
    if (regionId.includes('elf')) {
      if (scene.textures.exists('deco_mushroom_large'))
        decoTypes.push({ key: 'deco_mushroom_large', weight: 8, scale: [0.7, 1.0], blocking: false });
      if (scene.textures.exists('deco_hanging_lantern'))
        decoTypes.push({ key: 'deco_hanging_lantern', weight: 5, scale: [0.8, 1.0], blocking: false });
    }
    if (regionId.includes('treant')) {
      if (scene.textures.exists('deco_mushroom_large'))
        decoTypes.push({ key: 'deco_mushroom_large', weight: 12, scale: [0.8, 1.2], blocking: false });
    }
    if (regionId.includes('beast')) {
      if (scene.textures.exists('deco_totem'))
        decoTypes.push({ key: 'deco_totem', weight: 5, scale: [0.8, 1.0], blocking: true });
    }
    if (regionId.includes('merfolk')) {
      if (scene.textures.exists('deco_dock'))
        decoTypes.push({ key: 'deco_dock', weight: 6, scale: [0.9, 1.1], blocking: true });
    }
    if (regionId.includes('dwarf')) {
      if (scene.textures.exists('deco_crystal'))
        decoTypes.push({ key: 'deco_crystal', weight: 10, scale: [0.7, 1.0], blocking: false });
    }
    if (regionId.includes('undead')) {
      if (scene.textures.exists('deco_gravestone'))
        decoTypes.push({ key: 'deco_gravestone', weight: 12, scale: [0.8, 1.1], blocking: true });
    }
    if (regionId.includes('volcano')) {
      if (scene.textures.exists('deco_lava_vent'))
        decoTypes.push({ key: 'deco_lava_vent', weight: 10, scale: [0.9, 1.2], blocking: false });
    }
    if (regionId.includes('hotspring')) {
      if (scene.textures.exists('deco_stone_lantern'))
        decoTypes.push({ key: 'deco_stone_lantern', weight: 6, scale: [0.8, 1.0], blocking: true });
      if (scene.textures.exists('deco_bamboo_fence'))
        decoTypes.push({ key: 'deco_bamboo_fence', weight: 5, scale: [0.9, 1.0], blocking: false });
    }
    if (regionId.includes('mountain')) {
      if (scene.textures.exists('deco_cairn'))
        decoTypes.push({ key: 'deco_cairn', weight: 8, scale: [0.8, 1.1], blocking: true });
      if (scene.textures.exists('deco_prayer_flag'))
        decoTypes.push({ key: 'deco_prayer_flag', weight: 5, scale: [0.9, 1.0], blocking: false });
    }
    if (regionId.includes('demon')) {
      if (scene.textures.exists('deco_rune_circle'))
        decoTypes.push({ key: 'deco_rune_circle', weight: 8, scale: [0.9, 1.1], blocking: false });
    }

    // Total weight for weighted random selection
    const totalWeight = decoTypes.reduce((sum, d) => sum + d.weight, 0);

    // ── Placement order: rivers → multi-tile features → obstacles → flowers/ponds ──
    // (previously obstacles came first and got overwritten by later features)

    // River — meandering water path for aquatic regions
    if (isWater) {
      let rx = 5 + Math.floor(Math.random() * (config.width - 10));
      for (let ry = 2; ry < config.height - 2; ry++) {
        rx += Math.floor(Math.random() * 3) - 1;
        rx = Math.max(2, Math.min(config.width - 4, rx));
        const rw = 2 + Math.floor(Math.random() * 2);
        for (let dx = 0; dx < rw; dx++) {
          const tileX = rx + dx;
          mark(tileX, ry);
          scene.add.image(
            tileX * TILE_SIZE + TILE_SIZE / 2,
            ry * TILE_SIZE + TILE_SIZE / 2,
            'deco_water',
          ).setDepth(DEPTH.ground + 1);
        }
      }
    }

    // Multi-tile waterfalls — mountain/giant regions (3 rows × 2 cols)
    if (isMountain && scene.textures.exists('deco_waterfall_top')) {
      const wfCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < wfCount; i++) {
        const wx = 4 + Math.floor(Math.random() * (config.width - 8));
        const wy = 3 + Math.floor(Math.random() * Math.max(1, config.height - 10));
        if (this.placeMultiTileFeature(scene, wallBodies, wx, wy, 'waterfall', occupied)) {
          mark(wx, wy, 2, 3);
        }
      }
    } else if (isMountain && scene.textures.exists('deco_waterfall')) {
      const wfCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < wfCount; i++) {
        const wx = 2 + Math.floor(Math.random() * (config.width - 4));
        const wy = 2 + Math.floor(Math.random() * (config.height - 4));
        if (occupied.has(`${wx},${wy}`)) continue;
        mark(wx, wy);
        const wpx = wx * TILE_SIZE + TILE_SIZE / 2;
        const wpy = wy * TILE_SIZE + TILE_SIZE / 2;
        scene.add.image(wpx, wpy, 'deco_waterfall').setDepth(DEPTH.objects);
        const body = scene.add.rectangle(wpx, wpy, TILE_SIZE - 8, TILE_SIZE - 8);
        scene.physics.add.existing(body, true);
        wallBodies.add(body);
        body.setVisible(false);
      }
    }

    // Multi-tile caves — mountain/volcanic regions (3×2 tiles)
    if ((isMountain || isVolcanic) && scene.textures.exists('deco_cave')) {
      if (Math.random() > 0.4) {
        const cx = 5 + Math.floor(Math.random() * (config.width - 10));
        const cy = 4 + Math.floor(Math.random() * Math.max(1, config.height - 8));
        if (this.placeMultiTileFeature(scene, wallBodies, cx, cy, 'cave', occupied)) {
          mark(cx, cy, 3, 2);
        }
      }
    }

    // Multi-tile dense forest groves — forest/elf/treant regions (2×2 tiles)
    if (isForest && scene.textures.exists('deco_dense_forest')) {
      const groveCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < groveCount; i++) {
        const gx = 4 + Math.floor(Math.random() * (config.width - 8));
        const gy = 3 + Math.floor(Math.random() * Math.max(1, config.height - 7));
        if (this.placeMultiTileFeature(scene, wallBodies, gx, gy, 'forest', occupied)) {
          mark(gx, gy, 2, 2);
        }
      }
    }

    // Scattered obstacles (with overlap check)
    const obstacleCount = Math.floor((config.width * config.height) * 0.05);
    for (let i = 0; i < obstacleCount; i++) {
      const x = 2 + Math.floor(Math.random() * (config.width - 4));
      const y = 2 + Math.floor(Math.random() * (config.height - 4));
      if (occupied.has(`${x},${y}`)) continue;

      const px = x * TILE_SIZE + TILE_SIZE / 2;
      const py = y * TILE_SIZE + TILE_SIZE / 2;

      // Weighted random decoration type
      let roll = Math.random() * totalWeight;
      let chosen = decoTypes[0];
      for (const d of decoTypes) {
        roll -= d.weight;
        if (roll <= 0) { chosen = d; break; }
      }

      // Skip trees adjacent to existing obstacles to avoid patchwork look
      if (chosen.key.includes('tree')) {
        const adjOccupied = occupied.has(`${x-1},${y}`) || occupied.has(`${x+1},${y}`)
          || occupied.has(`${x},${y-1}`) || occupied.has(`${x},${y+1}`);
        if (adjOccupied && Math.random() < 0.6) continue;
      }

      const decoScale = chosen.scale[0] + Math.random() * (chosen.scale[1] - chosen.scale[0]);
      scene.add.image(px, py, chosen.key).setDepth(chosen.blocking ? DEPTH.objects : DEPTH.ground + 1).setScale(decoScale);

      // Mark occupied + adjacent tiles for large-scale blocking decos
      mark(x, y);
      if (decoScale > 1.1 && chosen.blocking) {
        mark(x - 1, y); mark(x + 1, y); mark(x, y - 1); mark(x, y + 1);
      }

      if (chosen.blocking) {
        const body = scene.add.rectangle(px, py, TILE_SIZE - 8, TILE_SIZE - 8);
        scene.physics.add.existing(body, true);
        wallBodies.add(body);
        body.setVisible(false);
      }
    }

    // Flower patches (non-blocking, skip for dark/volcanic regions)
    if (!isDark && !isVolcanic) {
      const flowerCount = 6 + Math.floor(Math.random() * 6);
      for (let i = 0; i < flowerCount; i++) {
        const fx = 2 + Math.floor(Math.random() * (config.width - 4));
        const fy = 2 + Math.floor(Math.random() * (config.height - 4));
        if (occupied.has(`${fx},${fy}`)) continue;
        mark(fx, fy);
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
        const px2 = 4 + Math.floor(Math.random() * (config.width - 8));
        const py2 = 4 + Math.floor(Math.random() * (config.height - 8));
        if (occupied.has(`${px2},${py2}`)) continue;
        mark(px2, py2);
        scene.add.image(
          px2 * TILE_SIZE + TILE_SIZE / 2,
          py2 * TILE_SIZE + TILE_SIZE / 2,
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
        if (occupied.has(`${hx},${hy}`)) continue;
        mark(hx, hy);
        scene.add.image(
          hx * TILE_SIZE + TILE_SIZE / 2,
          hy * TILE_SIZE + TILE_SIZE / 2,
          'deco_hotspring',
        ).setDepth(DEPTH.ground + 1);
      }
    }
  }

  private static addCaveDecorations(
    scene: Phaser.Scene, config: MapConfig,
    wallBodies: Phaser.Physics.Arcade.StaticGroup, regionId: string,
  ): void {
    const addBody = (px: number, py: number, w: number, h: number) => {
      const body = scene.add.rectangle(px, py, w, h);
      scene.physics.add.existing(body, true);
      wallBodies.add(body);
      body.setVisible(false);
    };

    // Generate cave-specific decoration textures
    if (!scene.textures.exists('deco_stalactite')) {
      this.generateStalactiteTexture(scene);
    }
    if (!scene.textures.exists('deco_stalagmite')) {
      this.generateStalagmiteTexture(scene);
    }
    if (!scene.textures.exists('deco_cave_rock')) {
      this.generateCaveRockTexture(scene);
    }

    // Irregularly shaped inner walls to create winding passages
    // Add rock clusters to narrow the cave and create atmosphere
    const obstacleCount = Math.floor(config.width * config.height * 0.05);
    const safeZones = [
      // Entrance area (bottom center)
      { x: config.width / 2 - 3, y: config.height - 4, w: 6, h: 3 },
      // Exit area (top center)
      { x: config.width / 2 - 3, y: 1, w: 6, h: 3 },
      // Boss area (upper center)
      { x: config.width / 2 - 4, y: 4, w: 8, h: 4 },
      // Main path (vertical center corridor)
      { x: config.width / 2 - 2, y: 3, w: 4, h: config.height - 6 },
    ];

    for (let i = 0; i < obstacleCount; i++) {
      const gx = 2 + Math.floor(Math.random() * (config.width - 4));
      const gy = 2 + Math.floor(Math.random() * (config.height - 4));

      // Skip safe zones
      const inSafe = safeZones.some(z =>
        gx >= z.x && gx < z.x + z.w && gy >= z.y && gy < z.y + z.h
      );
      if (inSafe) continue;

      const px = gx * TILE_SIZE + TILE_SIZE / 2;
      const py = gy * TILE_SIZE + TILE_SIZE / 2;

      // Choose decoration type
      const roll = Math.random();
      if (roll < 0.3) {
        // Stalactite (non-blocking, visual depth)
        scene.add.image(px, py, 'deco_stalactite')
          .setDepth(DEPTH.objects).setScale(0.6 + Math.random() * 0.4);
      } else if (roll < 0.6) {
        // Rock (blocking)
        scene.add.image(px, py, 'deco_cave_rock')
          .setDepth(DEPTH.objects).setScale(0.7 + Math.random() * 0.4);
        addBody(px, py, TILE_SIZE - 12, TILE_SIZE - 12);
      } else if (roll < 0.8) {
        // Stalagmite (blocking)
        scene.add.image(px, py, 'deco_stalagmite')
          .setDepth(DEPTH.objects).setScale(0.6 + Math.random() * 0.4);
        addBody(px, py, TILE_SIZE / 2, TILE_SIZE / 2);
      } else {
        // Cave wall extension (blocking, creates irregular walls)
        const wallKey = `tile_cave_wall_${regionId}`;
        scene.add.image(px, py, wallKey).setDepth(DEPTH.ground + 1);
        addBody(px, py, TILE_SIZE, TILE_SIZE);
      }
    }

    // Ambient light pools (non-blocking, subtle glow on floor)
    const pal = getRegionPalette(regionId);
    for (let i = 0; i < 4; i++) {
      const lx = (4 + Math.floor(Math.random() * (config.width - 8))) * TILE_SIZE + TILE_SIZE / 2;
      const ly = (4 + Math.floor(Math.random() * (config.height - 8))) * TILE_SIZE + TILE_SIZE / 2;
      const glow = scene.add.circle(lx, ly, TILE_SIZE * 1.5, Phaser.Display.Color.HexStringToColor(pal.accent).color, 0.06);
      glow.setDepth(DEPTH.ground + 1);
    }
  }

  private static generateStalactiteTexture(scene: Phaser.Scene): void {
    const S = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    // Hanging rock formation from above
    const cols = ['#444444', '#555555', '#3a3a3a'];
    for (let i = 0; i < 3; i++) {
      const bx = S / 2 - 10 + i * 8;
      const bh = 20 + Math.floor(Math.random() * 20);
      ctx.fillStyle = cols[i % cols.length];
      for (let dy = 0; dy < bh; dy++) {
        const w = Math.max(1, Math.round((6 - i) * (1 - dy / bh)));
        ctx.fillRect(bx - Math.floor(w / 2), dy, w, 1);
      }
    }
    scene.textures.addCanvas('deco_stalactite', canvas);
  }

  private static generateStalagmiteTexture(scene: Phaser.Scene): void {
    const S = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    // Rising rock formation from below
    const baseY = S;
    for (let i = 0; i < 2; i++) {
      const bx = S / 2 - 6 + i * 12;
      const bh = 25 + Math.floor(Math.random() * 15);
      ctx.fillStyle = i === 0 ? '#555555' : '#4a4a4a';
      for (let dy = 0; dy < bh; dy++) {
        const w = Math.max(1, Math.round(7 * (1 - dy / bh)));
        ctx.fillRect(bx - Math.floor(w / 2), baseY - dy, w, 1);
      }
    }
    // Highlight on leading edge
    ctx.fillStyle = '#666666';
    ctx.fillRect(S / 2 - 1, baseY - 25, 1, 10);
    scene.textures.addCanvas('deco_stalagmite', canvas);
  }

  private static generateCaveRockTexture(scene: Phaser.Scene): void {
    const S = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    // Irregular boulder
    const cx = S / 2, cy = S / 2;
    const rx = 18, ry = 14;
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          const shade = 60 + Math.floor(Math.random() * 30);
          ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    // Highlight (top-left)
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(cx - rx + 4, cy - ry + 3, rx, ry / 2);
    scene.textures.addCanvas('deco_cave_rock', canvas);
  }

  /** Place a multi-tile terrain feature and add collision bodies.
   *  Returns true if placed successfully, false if blocked by occupied tiles. */
  private static placeMultiTileFeature(
    scene: Phaser.Scene,
    wallBodies: Phaser.Physics.Arcade.StaticGroup,
    gx: number, gy: number,
    type: 'waterfall' | 'cave' | 'forest',
    occupied?: Set<string>,
  ): boolean {
    // Check overlap if occupied set provided
    if (occupied) {
      const dims = type === 'waterfall' ? [2, 3] : type === 'cave' ? [3, 2] : [2, 2];
      for (let dy = 0; dy < dims[1]; dy++)
        for (let dx = 0; dx < dims[0]; dx++)
          if (occupied.has(`${gx + dx},${gy + dy}`)) return false;
    }
    const addBody = (px: number, py: number, w: number, h: number) => {
      const body = scene.add.rectangle(px, py, w, h);
      scene.physics.add.existing(body, true);
      wallBodies.add(body);
      body.setVisible(false);
    };

    if (type === 'waterfall') {
      // 2 cols × 3 rows: top, mid, bottom
      const px = gx * TILE_SIZE + TILE_SIZE; // center of 2-tile width
      const topY = gy * TILE_SIZE + TILE_SIZE / 2;
      scene.add.image(px, topY, 'deco_waterfall_top').setDepth(DEPTH.objects);
      addBody(px, topY, TILE_SIZE * 2 - 8, TILE_SIZE - 8);

      const midY = (gy + 1) * TILE_SIZE + TILE_SIZE / 2;
      scene.add.image(px, midY, 'deco_waterfall_mid').setDepth(DEPTH.objects);
      addBody(px, midY, TILE_SIZE * 2 - 8, TILE_SIZE - 8);

      const botY = (gy + 2) * TILE_SIZE + TILE_SIZE / 2;
      scene.add.image(px, botY, 'deco_waterfall_bottom').setDepth(DEPTH.objects);
      addBody(px, botY, TILE_SIZE * 2 - 8, TILE_SIZE - 8);
    } else if (type === 'cave') {
      // 3 cols × 2 rows single image
      const px = gx * TILE_SIZE + TILE_SIZE * 1.5;
      const py = gy * TILE_SIZE + TILE_SIZE;
      scene.add.image(px, py, 'deco_cave').setDepth(DEPTH.objects);
      addBody(px, py, TILE_SIZE * 3 - 8, TILE_SIZE * 2 - 8);
    } else if (type === 'forest') {
      // 2×2 single image
      const px = gx * TILE_SIZE + TILE_SIZE;
      const py = gy * TILE_SIZE + TILE_SIZE;
      scene.add.image(px, py, 'deco_dense_forest').setDepth(DEPTH.objects);
      addBody(px, py, TILE_SIZE * 2 - 8, TILE_SIZE * 2 - 8);
    }
    return true;
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
      width: 68,
      height: 52,
      groundColor: 0x335522,
      wallColor: 0x223311,
      decorColor: 0x115511,
      type: 'field',
      regionId,
    };
  }

  static getCaveConfig(regionId: string): MapConfig {
    return {
      width: 30,
      height: 24,
      groundColor: 0x333333,
      wallColor: 0x222222,
      decorColor: 0x444444,
      type: 'cave',
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
