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
  static loadAIAssets(scene: Phaser.Scene, manifest: AIAssetManifest): void {
    const basePath = 'assets/ai';

    const categoryDirs: Record<string, string> = {
      tiles: 'tiles',
      characters: 'characters',
      monsters: 'monsters',
      buildings: 'buildings',
    };

    for (const [category, keys] of Object.entries(manifest)) {
      const dir = categoryDirs[category];
      if (!dir || !keys) continue;

      // Skip character images — they're single portraits but the game needs
      // procedural spritesheets (18 frames: 3 walk × 6 directions) for animations
      if (category === 'characters') continue;

      // Skip categories where sprites need transparent backgrounds.
      // AI-generated PNGs are RGB (no alpha channel) — overlaying them on
      // ground/battle layers produces ugly opaque rectangles.
      // Buildings & monsters always need transparency.
      if (category === 'buildings' || category === 'monsters') continue;

      for (const key of keys) {
        // Skip decoration sprites — they overlay on ground and need transparency
        if (key.startsWith('deco_')) continue;

        const path = `${basePath}/${dir}/${key}.png`;
        scene.load.image(key, path);
        this.aiLoadedKeys.add(key);
      }
    }
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
