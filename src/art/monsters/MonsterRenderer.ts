import Phaser from 'phaser';
import { TILE_SIZE } from '../../config';
import { numToHex } from '../palettes';
import { ArtRegistry } from '../index';
import { drawMonsterShape, type MonsterShape, type MonsterVisual } from './MonsterShapes';

/**
 * Mapping from monster shape → AI asset texture key.
 * When a game monster's inferred shape matches, we reuse the AI texture
 * instead of generating a procedural one.
 */
const AI_SHAPE_MAP: Record<MonsterShape, string> = {
  slime: 'mon_slime',
  bat: 'mon_bat',
  wolf: 'mon_wolf',
  snake: 'mon_snake',
  spider: 'mon_spider',
  skeleton: 'mon_skeleton',
  goblin: 'mon_goblin',
  ghost: 'mon_ghost',
  elemental: 'mon_ghost',
  gargoyle: 'mon_golem',
  dragon: 'mon_dragon_young',
  insect: 'mon_scorpion',
  fish: 'mon_jellyfish',
  bird: 'mon_bat',
  bear: 'mon_lion',
  turtle: 'mon_golem',
  crab: 'mon_scorpion',
  plant: 'mon_flower',
};

/**
 * Higher-priority name-based mapping: specific Chinese name keywords → AI texture.
 * Checked before shape-based mapping for more precise matches.
 */
const AI_NAME_MAP: Record<string, string> = {
  '蘑菇': 'mon_mushroom',
  '菇': 'mon_mushroom',
  '獅': 'mon_lion',
  '鯊': 'mon_shark',
  '暗黑騎士': 'mon_dark_knight',
  '黑騎士': 'mon_dark_knight',
  '魔兵': 'mon_demon_soldier',
  '魔劍士': 'mon_demon_soldier',
  '樹人': 'mon_treant',
  '古樹': 'mon_treant',
  '水母': 'mon_jellyfish',
  '花': 'mon_flower',
};

/** Boss monster ID → AI boss texture key */
const AI_BOSS_MAP: Record<string, string> = {
  r1_boss: 'mon_boss_guardian',
  r2_boss: 'mon_boss_elf_king',
  r3_boss: 'mon_boss_ancient_tree',
  r4_boss: 'mon_boss_beast_general',
  r5_boss: 'mon_boss_sea_dragon',
  r6_boss: 'mon_boss_mountain_king',
  r7_boss: 'mon_boss_forge_master',
  r8_boss: 'mon_boss_death_lord',
  r12_boss: 'mon_boss_demon_lord',
  r12_mini_boss: 'mon_boss_demon_lord',
};

/**
 * Blacklist: AI textures that pass the alpha gate but have wrong/unusable content
 * (SD generated buildings, character sheets, etc. instead of monsters).
 * These will always fall back to procedural rendering.
 * NOTE: Cleared after HD regeneration with improved prompts — re-add entries
 * if any new images still have wrong content.
 */
const AI_CONTENT_BLACKLIST = new Set<string>([
  // Cleared — All-In-One-Pixel-Model (pixelsprite) produces good isolated sprites
]);

/**
 * MonsterRenderer — Generates monster textures from shape + color definitions.
 * Each region's monsters use the base shape with region-specific color/decoration variants.
 */

/** Map from monster name pattern → base shape (more specific patterns first) */
const MONSTER_SHAPE_MAP: Record<string, MonsterShape> = {
  '毒史萊姆': 'slime', '冰史萊姆': 'slime', '火史萊姆': 'slime', '金屬史萊姆': 'slime',
  '泥沼史萊姆': 'slime', '森林史萊姆': 'slime', '海水史萊姆': 'slime', '史萊姆': 'slime', '黏液': 'slime',
  '蝙蝠': 'bat', '翼': 'bat',
  '狼': 'wolf', '犬': 'wolf', '獸': 'wolf',
  '蛇': 'snake', '蟒': 'snake', '蜥': 'snake',
  '蜘蛛': 'spider', '蛛': 'spider',
  '骷髏': 'skeleton', '亡靈': 'skeleton', '屍': 'skeleton',
  '哥布林': 'goblin', '妖精': 'goblin', '地精': 'goblin',
  '幽靈': 'ghost', '鬼': 'ghost', '魂': 'ghost', '影': 'ghost',
  '精靈': 'elemental', '元素': 'elemental',
  '石像': 'gargoyle', '魔像': 'gargoyle',
  '龍': 'dragon', '飛龍': 'dragon', '巨龍': 'dragon',
  '蟲': 'insect', '蟻': 'insect', '蜂': 'insect', '蠍': 'insect',
  '魚': 'fish', '水母': 'fish', '海': 'fish',
  '鳥': 'bird', '鷹': 'bird', '鴉': 'bird',
  '熊': 'bear', '猿': 'bear', '巨': 'bear',
  '龜': 'turtle', '甲': 'turtle',
  '蟹': 'crab', '蝦': 'crab',
  '花': 'plant', '樹': 'plant', '藤': 'plant', '菇': 'plant',
  '土匪': 'goblin', '盜賊': 'goblin', '刺客': 'goblin', '忍者': 'goblin',
  '鼠': 'bat', '蝎': 'insect',
};

/** Hash string to integer for deterministic variant selection */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Infer monster shape from its name */
function inferShape(monsterName: string): MonsterShape {
  for (const [pattern, shape] of Object.entries(MONSTER_SHAPE_MAP)) {
    if (monsterName.includes(pattern)) return shape;
  }
  // Default fallback based on hash
  const shapes: MonsterShape[] = ['slime', 'goblin', 'bat', 'wolf', 'spider', 'ghost'];
  let hash = 0;
  for (let i = 0; i < monsterName.length; i++) hash = (hash * 31 + monsterName.charCodeAt(i)) | 0;
  return shapes[Math.abs(hash) % shapes.length];
}

/** Feature keywords to detect in monster names */
const FEATURE_KEYWORDS: Record<string, string> = {
  '冰': 'ice', '霜': 'ice', '雪': 'ice',
  '火': 'fire', '焰': 'fire', '炎': 'fire',
  '毒': 'poison', '瘴': 'poison',
};

function inferFeatures(monsterName: string): string[] {
  const features: string[] = [];
  for (const [keyword, feat] of Object.entries(FEATURE_KEYWORDS)) {
    if (monsterName.includes(keyword)) features.push(feat);
  }
  return features;
}

export class MonsterRenderer {

  /** Generate all monster textures that exist in game data */
  static generateAll(scene: Phaser.Scene): void {
    // We generate textures lazily — provide a generate-on-demand method
    // But also pre-generate the 6 base monster color placeholders for backward compat
    const fallbackColors = [0xff4444, 0xcc44cc, 0x44cccc, 0xcc8844, 0x888844, 0x448844];
    fallbackColors.forEach((color, i) => {
      this.generateMonsterTexture(scene, `monster_${i}`, {
        shape: (['slime', 'bat', 'wolf', 'spider', 'goblin', 'ghost'] as MonsterShape[])[i],
        baseColor: numToHex(color),
        accentColor: '#ffff44',
        size: 1,
      });
    });

    // Boss placeholder
    this.generateMonsterTexture(scene, 'boss', {
      shape: 'dragon',
      baseColor: '#880000',
      accentColor: '#ff4444',
      size: 2,
      features: ['horns', 'fire'],
    });
  }

  /** Generate texture for a specific monster by name + spriteColor */
  static generateForMonster(scene: Phaser.Scene, textureKey: string, monsterName: string, spriteColor: number, isBoss: boolean): void {
    if (scene.textures.exists(textureKey)) return;

    // Try AI texture first (falls back if image is too transparent)
    const aiKey = this.findAITexture(scene, monsterName, textureKey, isBoss);
    if (aiKey) {
      const MONSTER_BASE = 96;
      const targetSize = isBoss ? MONSTER_BASE * 2 : MONSTER_BASE;
      if (this.copyAITexture(scene, aiKey, textureKey, targetSize)) return;
    }

    const shape = inferShape(monsterName);
    const features = inferFeatures(monsterName);
    if (isBoss) features.push('crown');

    const visual: MonsterVisual = {
      shape,
      baseColor: numToHex(spriteColor),
      accentColor: isBoss ? '#ffd700' : '#ffff44',
      size: isBoss ? 2 : 1,
      features,
    };
    if (shape === 'slime') visual.slimeVariant = hashString(monsterName) % 3;

    this.generateMonsterTexture(scene, textureKey, visual);
  }

  /** Generate a high-resolution monster texture for battle display (no setScale needed) */
  static generateForBattle(scene: Phaser.Scene, textureKey: string, monsterName: string, spriteColor: number, isBoss: boolean): string {
    const battleKey = `${textureKey}_hires`;
    if (scene.textures.exists(battleKey)) return battleKey;

    // Try AI texture first — scale up to battle resolution with NEAREST filtering
    const aiKey = this.findAITexture(scene, monsterName, textureKey, isBoss);
    if (aiKey) {
      const battleSize = isBoss ? 240 : 180;
      if (this.copyAITexture(scene, aiKey, battleKey, battleSize)) return battleKey;
    }

    const shape = inferShape(monsterName);
    const features = inferFeatures(monsterName);
    if (isBoss) features.push('crown');

    const visual: MonsterVisual = {
      shape,
      baseColor: numToHex(spriteColor),
      accentColor: isBoss ? '#ffd700' : '#ffff44',
      size: 1,
      features,
    };
    if (shape === 'slime') visual.slimeVariant = hashString(monsterName) % 3;

    this.generateMonsterTexture(scene, battleKey, visual, isBoss ? 240 : 180);

    return battleKey;
  }

  /**
   * Find an AI-generated texture matching this monster.
   * Priority: exact AI key match → name-based → shape-based.
   */
  private static findAITexture(scene: Phaser.Scene, monsterName: string, textureKey: string, isBoss: boolean): string | null {
    // 1. Boss mapping by monster ID (e.g., r1_boss → mon_boss_guardian)
    if (isBoss) {
      const monsterId = textureKey.replace('mon_boss_', '');
      const aiKey = AI_BOSS_MAP[monsterId];
      if (aiKey && !AI_CONTENT_BLACKLIST.has(aiKey) && scene.textures.exists(aiKey)) return aiKey;
    }

    // 2. Name-based mapping (specific Chinese keywords → specific AI texture)
    for (const [keyword, aiKey] of Object.entries(AI_NAME_MAP)) {
      if (monsterName.includes(keyword) && !AI_CONTENT_BLACKLIST.has(aiKey) && scene.textures.exists(aiKey)) return aiKey;
    }

    // 3. Shape-based mapping (inferred shape → generic AI texture)
    const shape = inferShape(monsterName);
    const aiKey = AI_SHAPE_MAP[shape];
    if (aiKey && !AI_CONTENT_BLACKLIST.has(aiKey) && scene.textures.exists(aiKey)) return aiKey;

    return null;
  }

  /**
   * Copy an AI texture to a new key, scaling to targetSize with NEAREST filtering.
   * Centers the source image within the target canvas.
   * Returns false if the source image is too transparent (rembg damage), so
   * the caller can fall back to procedural rendering.
   */
  private static copyAITexture(scene: Phaser.Scene, aiKey: string, targetKey: string, targetSize: number): boolean {
    if (scene.textures.exists(targetKey)) return true;

    const aiTex = scene.textures.get(aiKey);
    const source = aiTex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sw = source.width;
    const sh = source.height;

    // Alpha quality gate: reject images where rembg removed too much content.
    // Draw source to a temp canvas and check pixel alpha.
    const checkCanvas = document.createElement('canvas');
    checkCanvas.width = sw;
    checkCanvas.height = sh;
    const checkCtx = checkCanvas.getContext('2d')!;
    checkCtx.drawImage(source, 0, 0);
    const imgData = checkCtx.getImageData(0, 0, sw, sh);
    let transparent = 0;
    for (let i = 3; i < imgData.data.length; i += 4) {
      if (imgData.data[i] < 10) transparent++;
    }
    const totalPixels = sw * sh;
    if (totalPixels > 0 && transparent / totalPixels > 0.95) {
      // Image is nearly empty — rembg destroyed the content, skip AI texture
      // (Normal transparent backgrounds are 55-85% transparent; truly damaged ones are 96%+)
      return false;
    }

    const padding = Math.round(targetSize * 0.1);
    const canvasSize = targetSize + padding * 2;
    const { canvas, ctx } = ArtRegistry.createCanvas(canvasSize, canvasSize);

    // Scale source to fit targetSize, maintaining aspect ratio, centered with padding
    ctx.imageSmoothingEnabled = false; // NEAREST for pixel art
    const scale = targetSize / Math.max(sw, sh);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    ctx.drawImage(source, padding + Math.round((targetSize - dw) / 2), padding + Math.round((targetSize - dh) / 2), dw, dh);

    ArtRegistry.registerTexture(scene, targetKey, canvas);
    return true;
  }

  /** Generate a single monster texture (targetSize overrides the base calculation) */
  private static generateMonsterTexture(scene: Phaser.Scene, key: string, visual: MonsterVisual, targetSize?: number): void {
    if (scene.textures.exists(key)) return;

    const MONSTER_BASE = 96; // base monster size (2× TILE_SIZE=64)
    const size = targetSize ?? Math.round(MONSTER_BASE * visual.size);
    const padding = Math.round(size * 0.1);
    const canvasSize = size + padding * 2;

    const { canvas, ctx } = ArtRegistry.createCanvas(canvasSize, canvasSize);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    const shadowH = Math.max(3, size * 0.08);
    fillOvalSimple(ctx, padding + size * 0.15, padding + size - shadowH, size * 0.7, shadowH * 2);

    // Draw the monster shape
    drawMonsterShape(ctx, padding, padding, size, size, visual);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  /** Get or generate texture key for a monster */
  static getTextureKey(monsterName: string, monsterId: string, isBoss: boolean): string {
    if (isBoss) return `mon_boss_${monsterId}`;
    return `mon_${monsterId}`;
  }
}

function fillOvalSimple(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const cx = x + w / 2, cy = y + h / 2;
  const rx = w / 2, ry = h / 2;
  for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
    const dy = (py + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const dx = Math.sqrt(1 - dy * dy) * rx;
    ctx.fillRect(Math.round(cx - dx), py, Math.max(1, Math.round(dx * 2)), 1);
  }
}
