import Phaser from 'phaser';
import { TileRenderer } from './tiles/TileRenderer';
import { CharacterRenderer } from './characters/CharacterRenderer';
import { MonsterRenderer } from './monsters/MonsterRenderer';
import { BuildingRenderer } from './tiles/BuildingRenderer';
import { PanelRenderer } from './ui/PanelRenderer';
import { IconRenderer } from './ui/IconRenderer';
import { WorldMapRenderer } from './worldmap/WorldMapRenderer';
import { BattleEffects } from './effects/BattleEffects';

/**
 * ArtRegistry — Central entry point for all procedural art generation.
 * Called once during BootScene to generate all textures.
 */
export class ArtRegistry {
  private static generated = false;

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
      { label: '世界地圖...', fn: () => WorldMapRenderer.generateAll(scene) },
      { label: '戰鬥特效...', fn: () => BattleEffects.generateAll(scene) },
    ];

    for (let i = 0; i < steps.length; i++) {
      onProgress?.((i / steps.length) * 100, steps[i].label);
      steps[i].fn();
    }

    onProgress?.(100, '完成！');
    this.generated = true;
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
