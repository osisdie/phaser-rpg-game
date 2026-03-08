import Phaser from 'phaser';
import { TileRenderer } from './tiles/TileRenderer';
import { CharacterRenderer } from './characters/CharacterRenderer';
import { MonsterRenderer } from './monsters/MonsterRenderer';
import { BuildingRenderer } from './tiles/BuildingRenderer';
import { PanelRenderer } from './ui/PanelRenderer';
import { IconRenderer } from './ui/IconRenderer';
import { ItemIconRenderer } from './ui/ItemIconRenderer';
import { WorldMapRenderer } from './worldmap/WorldMapRenderer';
import { BattleEffects } from './effects/BattleEffects';

/** AI asset manifest shape (loaded from public/assets/ai/manifest.json) */
export interface AIAssetManifest {
  tiles?: string[];
  characters?: string[];
  monsters?: string[];
  buildings?: string[];
  battle_backgrounds?: string[];
  portraits?: string[];
  interiors?: string[];
  decorations?: string[];
}

/**
 * ArtRegistry — Central entry point for all procedural art generation.
 * Called once during BootScene to generate all textures.
 *
 * Supports "AI first, procedural fallback": if AI-generated images were
 * preloaded (via loadAIAssets), those texture keys already exist and the
 * procedural renderers will skip them automatically.
 */
export class ArtRegistry {
  private static generated = false;
  /** Keys that were loaded from AI-generated images */
  private static aiLoadedKeys: Set<string> = new Set();

  /** How many AI textures were loaded this session */
  static get aiAssetCount(): number { return this.aiLoadedKeys.size; }

  /**
   * Preload AI-generated assets into Phaser's loader queue.
   * Call in BootScene.preload() BEFORE create().
   * The loader will register these as textures; when generateAll() runs,
   * registerTexture/registerSpriteSheet will see they already exist and skip.
   */
  /** Categories that are lazy-loaded per-region (large textures, 1024x768) */
  private static readonly LAZY_CATEGORIES = new Set(['battle_backgrounds', 'interiors']);

  /** Full manifest (kept for lazy loading lookups) */
  private static manifest: AIAssetManifest | null = null;

  /** Map generic AI tile names to region-specific game tile keys */
  private static readonly TILE_REGION_MAP: Record<string, Record<string, string>> = (() => {
    const regions = [
      'region_hero', 'region_elf', 'region_treant', 'region_beast',
      'region_merfolk', 'region_giant', 'region_dwarf', 'region_undead',
      'region_volcano', 'region_hotspring', 'region_mountain', 'region_demon',
    ];
    // Which generic ground tile each region uses
    const regionGround: Record<string, string> = {
      region_hero: 'tile_grass', region_elf: 'tile_grass', region_treant: 'tile_grass',
      region_beast: 'tile_dirt', region_merfolk: 'tile_sand', region_giant: 'tile_stone',
      region_dwarf: 'tile_stone', region_undead: 'tile_dark_stone',
      region_volcano: 'tile_lava', region_hotspring: 'tile_grass',
      region_mountain: 'tile_snow', region_demon: 'tile_dark_stone',
    };
    // Which generic wall tile each region uses
    const regionWall: Record<string, string> = {
      region_hero: 'tile_wall_stone', region_elf: 'tile_wall_wood', region_treant: 'tile_wall_wood',
      region_beast: 'tile_wall_stone', region_merfolk: 'tile_wall_stone', region_giant: 'tile_wall_stone',
      region_dwarf: 'tile_wall_stone', region_undead: 'tile_wall_stone',
      region_volcano: 'tile_dark_stone', region_hotspring: 'tile_wall_wood',
      region_mountain: 'tile_wall_stone', region_demon: 'tile_dark_stone',
    };
    // Build mapping: game key → AI tile key
    const map: Record<string, Record<string, string>> = {};
    for (const rid of regions) {
      const ground = regionGround[rid];
      // 3 ground variants all use the same AI tile
      for (let v = 0; v < 3; v++) map[`tile_ground_${rid}_${v}`] = { ai: ground };
      map[`tile_wall_${rid}`] = { ai: regionWall[rid] };
      map[`tile_path_${rid}`] = { ai: 'tile_stone' };
      map[`tile_water_${rid}`] = { ai: 'tile_water' };
      // Cave tiles
      const caveGround = rid === 'region_volcano' ? 'tile_lava' : 'tile_cave';
      for (let v = 0; v < 3; v++) map[`tile_cave_ground_${rid}_${v}`] = { ai: caveGround };
      map[`tile_cave_wall_${rid}`] = { ai: 'tile_dark_stone' };
    }
    return map;
  })();

  static loadAIAssets(scene: Phaser.Scene, manifest: AIAssetManifest): void {
    this.manifest = manifest;
    const basePath = 'assets/ai';

    const categoryDirs: Record<string, string> = {
      tiles: 'tiles',
      characters: 'characters',
      monsters: 'monsters',
      buildings: 'buildings',
      battle_backgrounds: 'battle_backgrounds',
      portraits: 'portraits',
      interiors: 'interiors',
      decorations: 'decorations',
    };

    // Collect available AI tile keys for alias expansion
    const aiTileKeys = new Set(manifest.tiles ?? []);

    for (const [category, keys] of Object.entries(manifest)) {
      const dir = categoryDirs[category];
      if (!dir || !keys) continue;

      // Skip character images — they're single portraits but the game needs
      // procedural spritesheets (24 frames: 4 walk × 6 directions) for animations.
      if (category === 'characters') continue;

      // Defer large textures (battle_backgrounds, interiors) for lazy loading
      if (this.LAZY_CATEGORIES.has(category)) continue;

      for (const key of keys) {
        const path = `${basePath}/${dir}/${key}.png`;
        scene.load.image(key, path);
        this.aiLoadedKeys.add(key);
      }
    }

    // Expand generic AI tiles into region-specific aliases
    // e.g. tile_grass.png → tile_ground_region_hero_0, tile_ground_region_elf_0, ...
    for (const [gameKey, { ai: aiKey }] of Object.entries(this.TILE_REGION_MAP)) {
      if (aiTileKeys.has(aiKey)) {
        const path = `${basePath}/tiles/${aiKey}.png`;
        scene.load.image(gameKey, path);
        this.aiLoadedKeys.add(gameKey);
      }
    }

    // Also register tile_wood and tile_stone_generic directly
    if (aiTileKeys.has('tile_wood')) {
      // tile_wood already loaded by generic loop above, just ensure it's tracked
    }
    if (aiTileKeys.has('tile_stone')) {
      const path = `${basePath}/tiles/tile_stone.png`;
      scene.load.image('tile_stone_generic', path);
      this.aiLoadedKeys.add('tile_stone_generic');
    }
  }

  /**
   * Lazy-load a specific AI texture on demand (for battle backgrounds, interiors).
   * Returns a Promise that resolves when the texture is ready.
   * If the texture doesn't exist in manifest or is already loaded, resolves immediately.
   */
  static loadOnDemand(scene: Phaser.Scene, key: string): Promise<void> {
    // Already loaded as AI texture — skip
    if (this.aiLoadedKeys.has(key)) return Promise.resolve();

    // Find the key in lazy categories
    if (!this.manifest) return Promise.resolve();
    const basePath = 'assets/ai';
    const categoryDirs: Record<string, string> = {
      battle_backgrounds: 'battle_backgrounds',
      interiors: 'interiors',
    };

    for (const [category, dir] of Object.entries(categoryDirs)) {
      const keys = (this.manifest as Record<string, string[]>)[category];
      if (keys?.includes(key)) {
        const path = `${basePath}/${dir}/${key}.png`;
        // Use a temp key to avoid collision with existing procedural texture
        const loadKey = `__ai_${key}`;
        if (scene.textures.exists(loadKey)) {
          // Already loaded under temp key
          this.aiLoadedKeys.add(key);
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          scene.load.image(loadKey, path);
          scene.load.once('complete', () => {
            const tex = scene.textures.get(loadKey);
            if (tex && tex.key !== '__MISSING') {
              tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
              this.aiLoadedKeys.add(key);
            }
            resolve();
          });
          scene.load.start();
        });
      }
    }
    return Promise.resolve();
  }

  /** Get the actual texture key for a lazy-loaded asset (may be temp-prefixed) */
  static getTextureKey(key: string): string {
    return this.aiLoadedKeys.has(key) ? `__ai_${key}` : key;
  }

  /** Check if a specific texture key was loaded from AI assets */
  static isAIAsset(key: string): boolean {
    return this.aiLoadedKeys.has(key);
  }

  /** Generate all game textures. Call from BootScene.create(). */
  static generateAll(scene: Phaser.Scene, onProgress?: (pct: number, label: string) => void): void {
    if (this.generated) return;

    const steps: { label: string; fn: () => void }[] = [
      { label: '磚塊材質...', fn: () => TileRenderer.generateAll(scene) },
      { label: '角色精靈...', fn: () => CharacterRenderer.generateAll(scene) },
      { label: '怪物精靈...', fn: () => MonsterRenderer.generateAll(scene) },
      { label: '建築物...', fn: () => BuildingRenderer.generateAll(scene) },
      { label: '介面面板...', fn: () => PanelRenderer.generateAll(scene) },
      { label: '圖標...', fn: () => IconRenderer.generateAll(scene) },
      { label: '物品圖標...', fn: () => ItemIconRenderer.generateAll(scene) },
      { label: '世界地圖...', fn: () => WorldMapRenderer.generateAll(scene) },
      { label: '戰鬥特效...', fn: () => BattleEffects.generateAll(scene) },
    ];

    for (let i = 0; i < steps.length; i++) {
      onProgress?.((i / steps.length) * 100, steps[i].label);
      steps[i].fn();
    }

    onProgress?.(100, '完成！');
    this.generated = true;

    // Apply NEAREST filter to all AI-loaded textures so they stay crisp
    // when used as source in canvas drawImage or displayed at pixel scale
    for (const key of this.aiLoadedKeys) {
      const tex = scene.textures.get(key);
      if (tex && tex.key !== '__MISSING') {
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }

    if (this.aiLoadedKeys.size > 0) {
      console.log(`[ArtRegistry] ${this.aiLoadedKeys.size} AI-generated textures loaded, rest procedural`);
    }
  }

  /** Create a canvas helper used by all renderers */
  static createCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
  }

  /** Register a canvas as a Phaser texture (skip if exists) */
  static registerTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, smooth = false): void {
    if (!scene.textures.exists(key)) {
      const tex = scene.textures.addCanvas(key, canvas);
      if (tex && !smooth) {
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
  }

  /** Register a canvas as a spritesheet texture with manual frame slicing */
  static registerSpriteSheet(
    scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement,
    frameWidth: number, frameHeight: number,
  ): void {
    if (scene.textures.exists(key)) return;

    // addCanvas is synchronous — no async Image loading issues
    const tex = scene.textures.addCanvas(key, canvas)!;
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const cols = Math.floor(canvas.width / frameWidth);
    const rows = Math.floor(canvas.height / frameHeight);

    // Manually add numbered frames (same layout as addSpriteSheet)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const frameIndex = row * cols + col;
        tex.add(frameIndex, 0, col * frameWidth, row * frameHeight, frameWidth, frameHeight);
      }
    }
  }
}
