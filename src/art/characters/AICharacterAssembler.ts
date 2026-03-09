import Phaser from 'phaser';
import { ArtRegistry } from '../index';

/**
 * AICharacterAssembler — Converts single AI character images (64×96)
 * into full 256×576 spritesheets (4 walk frames × 6 directions).
 *
 * Uses bob-based pseudo-walk animation (same approach as battle characters'
 * idle bob tween, but baked into the spritesheet frames).
 *
 * Row layout matches CharacterRenderer's format:
 *   0=down, 1=left, 2=right, 3=up, 4=down_left, 5=down_right
 *
 * Walk frame bob offsets (Y-axis): [0, -2, 0, -1]
 *   - Frames 0,2: neutral (contact poses)
 *   - Frame 1: highest bob (passing pose)
 *   - Frame 3: slight bob (second pass)
 */

const CHAR_W = 64;
const CHAR_H = 96;
const COLS = 4;  // walk frames per direction
const ROWS = 6;  // directions (down, left, right, up, down_left, down_right)
const BOB_OFFSETS = [0, -2, 0, -1];

/** Prefix used when loading AI character source images */
export const OWC_PREFIX = '__owc_';

/**
 * Known AI character keys and the game spritesheet keys they produce.
 * Party + companion keys map 1:1 (char_hero → char_hero).
 * NPC keys expand into 6 variants (char_npc_shop → char_npc_shop_0..5).
 */
const PARTY_KEYS = ['char_hero', 'char_elf', 'char_treant', 'char_beast', 'char_merfolk', 'char_giant', 'char_dwarf', 'char_undead'];
const NPC_TYPES = ['shop', 'quest', 'save', 'info', 'inn'];
const NPC_VARIANT_COUNT = 6;

export class AICharacterAssembler {

  /**
   * Assemble all available AI character images into spritesheets.
   * Call BEFORE CharacterRenderer.generateAll() so AI keys are registered first.
   */
  static assembleAll(scene: Phaser.Scene): void {
    // Party / companion characters — 1:1 mapping
    for (const key of PARTY_KEYS) {
      const srcKey = `${OWC_PREFIX}${key}`;
      if (scene.textures.exists(srcKey)) {
        this.assembleSheet(scene, srcKey, key);
      }
    }

    // NPC types — one AI image expands to 6 variants
    for (const type of NPC_TYPES) {
      const srcKey = `${OWC_PREFIX}char_npc_${type}`;
      if (scene.textures.exists(srcKey)) {
        for (let i = 0; i < NPC_VARIANT_COUNT; i++) {
          this.assembleSheet(scene, srcKey, `char_npc_${type}_${i}`);
        }
      }
    }

    // Guard base — one image tinted per region (future: apply region tint)
    const guardSrcKey = `${OWC_PREFIX}char_guard`;
    if (scene.textures.exists(guardSrcKey)) {
      const guardRegions = [
        'region_hero', 'region_elf', 'region_treant', 'region_beast',
        'region_merfolk', 'region_giant', 'region_dwarf', 'region_undead',
        'region_volcano', 'region_hotspring', 'region_mountain',
      ];
      for (const rid of guardRegions) {
        this.assembleSheet(scene, guardSrcKey, `char_guard_${rid}`);
      }
    }
  }

  /**
   * Build a 256×576 spritesheet from a single source image texture.
   *
   * Direction rows:
   *   0 (down):       original image + bob
   *   1 (left):       horizontally flipped + bob
   *   2 (right):      original image + bob
   *   3 (up):         AI back image if available, else darkened silhouette + bob
   *   4 (down_left):  horizontally flipped + bob
   *   5 (down_right): original image + bob
   */
  private static assembleSheet(scene: Phaser.Scene, srcKey: string, targetKey: string): void {
    if (scene.textures.exists(targetKey)) return;

    const srcTex = scene.textures.get(srcKey);
    if (!srcTex || srcTex.key === '__MISSING') return;

    const srcCanvas = srcTex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;

    const sheetW = CHAR_W * COLS;
    const sheetH = CHAR_H * ROWS;
    const { canvas, ctx } = ArtRegistry.createCanvas(sheetW, sheetH);

    // Check for AI-generated back-facing image (e.g. __owc_char_hero_back)
    const backKey = `${srcKey}_back`;
    const backTex = scene.textures.exists(backKey) ? scene.textures.get(backKey) : null;
    const hasBack = backTex != null && backTex.key !== '__MISSING';

    // Pre-build back view: use AI back image or darkened front as fallback
    const back = ArtRegistry.createCanvas(CHAR_W, CHAR_H);
    if (hasBack) {
      const backSrc = backTex!.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      back.ctx.drawImage(backSrc, 0, 0, CHAR_W, CHAR_H);
    } else {
      back.ctx.drawImage(srcCanvas, 0, 0, CHAR_W, CHAR_H);
      back.ctx.globalCompositeOperation = 'source-atop';
      back.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      back.ctx.fillRect(0, 0, CHAR_W, CHAR_H);
    }

    // Pre-build flipped version for left / down_left rows
    const flip = ArtRegistry.createCanvas(CHAR_W, CHAR_H);
    flip.ctx.translate(CHAR_W, 0);
    flip.ctx.scale(-1, 1);
    flip.ctx.drawImage(srcCanvas, 0, 0, CHAR_W, CHAR_H);

    // Source images per row: original, flipped, back, or darkened fallback
    const rowSources: (HTMLCanvasElement | HTMLImageElement)[] = [
      srcCanvas,    // 0: down
      flip.canvas,  // 1: left
      srcCanvas,    // 2: right
      back.canvas,  // 3: up (AI back image or darkened fallback)
      flip.canvas,  // 4: down_left
      srcCanvas,    // 5: down_right
    ];

    // Draw each row (direction) × column (walk frame)
    for (let row = 0; row < ROWS; row++) {
      const src = rowSources[row];
      for (let col = 0; col < COLS; col++) {
        const bobY = BOB_OFFSETS[col];
        ctx.drawImage(src, col * CHAR_W, row * CHAR_H + bobY, CHAR_W, CHAR_H);
      }
    }

    ArtRegistry.registerSpriteSheet(scene, targetKey, canvas, CHAR_W, CHAR_H);
  }
}
