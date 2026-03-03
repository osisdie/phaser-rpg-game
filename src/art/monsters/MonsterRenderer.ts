import Phaser from 'phaser';
import { TILE_SIZE } from '../../config';
import { numToHex } from '../palettes';
import { ArtRegistry } from '../index';
import { drawMonsterShape, drawFeature, type MonsterShape, type MonsterVisual, RIGHT_FACING_SHAPES } from './MonsterShapes';

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
  demon: 'mon_boss_demon_lord',
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
  'mon_slime', // Use procedural pudgy dome (矮胖型) for better per-element color differentiation
  'mon_snake', // Use procedural pudgy coiled shape (矮胖型) instead of AI bow-tie
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
  '狼': 'wolf', '犬': 'wolf',
  '蛇': 'snake', '蟒': 'snake', '蜥': 'snake',
  '蜘蛛': 'spider', '蛛': 'spider',
  '骷髏': 'skeleton', '亡靈': 'skeleton', '屍': 'skeleton',
  '哥布林': 'goblin', '妖精': 'goblin', '地精': 'goblin',
  '幽靈': 'ghost', '鬼': 'ghost', '魂': 'ghost', '惡靈': 'ghost', '獵手': 'ghost',
  '精靈': 'elemental', '元素': 'elemental',
  '石像': 'gargoyle', '魔像': 'gargoyle', '石魔': 'gargoyle', '魔獸': 'gargoyle', '石獸': 'gargoyle',
  '龍': 'dragon', '飛龍': 'dragon', '巨龍': 'dragon',
  '魔蟲': 'spider', '飛蟲': 'spider', '爬蟲': 'spider',
  '蟲': 'insect', '蟻': 'insect', '蜂': 'insect', '蠍': 'insect',
  '魚': 'fish', '水母': 'fish', '海': 'fish',
  '鳥': 'bird', '鷹': 'bird', '鴉': 'bird',
  '熊': 'bear', '猿': 'bear', '巨': 'bear',
  '龜': 'turtle', '甲': 'turtle',
  '蟹': 'crab', '蝦': 'crab',
  '花': 'plant', '樹': 'plant', '藤': 'plant', '菇': 'plant',
  '土匪': 'goblin', '盜賊': 'goblin', '刺客': 'goblin', '忍者': 'goblin',
  '鼠': 'bat', '蝎': 'insect',
  '影': 'ghost',
  '大魔王': 'demon', '魔王護衛': 'gargoyle', '護衛': 'gargoyle',
  '魔王': 'demon', '魔': 'demon',
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

/** Infer boss elemental aura feature from monster name (replaces crown).
 *  Order matters — more specific patterns first. */
const BOSS_ELEMENT_KEYWORDS: [string, string][] = [
  ['火山', 'fire'],     ['鑄造', 'fire'],    // forge/volcano → fire
  ['冰峰', 'ice'],      ['冰', 'ice'],       ['霜', 'ice'],      ['雪', 'ice'],
  ['深海', 'water_aura'], ['溫泉', 'water_aura'], ['海', 'water_aura'], ['水', 'water_aura'],
  ['雷', 'lightning'],  ['電', 'lightning'],  ['閃', 'lightning'],
  ['山嶽', 'earth_aura'], ['岩', 'earth_aura'], ['石', 'earth_aura'],
  ['風', 'wind_aura'],  ['嵐', 'wind_aura'],
  ['光', 'light_aura'], ['聖', 'light_aura'], ['神', 'light_aura'],
  ['腐化', 'poison'],   ['腐朽', 'poison'],  ['毒', 'poison'],
  ['不死', 'lightning'], // undead → eerie lightning
  ['古樹', 'earth_aura'], // ancient tree → earth/nature
  ['火', 'fire'],       ['焰', 'fire'],      ['炎', 'fire'],     ['熔', 'fire'],
  ['魔', 'fire'],       // demon/dark bosses → fire
];

function inferBossElement(monsterName: string): string {
  for (const [keyword, element] of BOSS_ELEMENT_KEYWORDS) {
    if (monsterName.includes(keyword)) return element;
  }
  return 'fire'; // default boss element
}

/** Infer a tint color from monster name for elemental/attribute differentiation.
 *  Returns null if the monster has no recognizable elemental keyword (keep original AI color). */
const ELEMENT_TINTS: [string, string][] = [
  ['金屬', '#99aacc'],  // metallic silver-blue
  ['海水', '#3388cc'],  // ocean blue
  ['森林', '#228844'],  // forest green
  ['泥沼', '#887744'],  // swamp brown
  ['熔岩', '#dd4411'],  // lava red-orange
  ['毒', '#9944cc'],    // poison purple
  ['冰', '#55bbff'],    // ice cyan
  ['霜', '#66ccee'],    // frost light-cyan
  ['雪', '#aaddff'],    // snow pale-blue
  ['火', '#ff5522'],    // fire red-orange
  ['焰', '#ff6633'],    // flame orange
  ['暗影', '#555577'],  // shadow dark-purple
  ['暗', '#444466'],    // dark indigo
];

function inferTintColor(monsterName: string): string | null {
  for (const [keyword, color] of ELEMENT_TINTS) {
    if (monsterName.includes(keyword)) return color;
  }
  return null;
}

export class MonsterRenderer {

  /** Check if a procedural monster needs horizontal flip for diagonal battle layout.
   *  Right-facing shapes (wolf, dragon, fish, bird, turtle) look off-screen
   *  when enemies are positioned top-right — flip them to face party. */
  static needsFlipForBattle(monsterName: string): boolean {
    return RIGHT_FACING_SHAPES.has(inferShape(monsterName));
  }

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
      features: ['dark_aura', 'fire'],
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
      const tint = inferTintColor(monsterName);
      const feats = inferFeatures(monsterName);
      if (isBoss) feats.push(inferBossElement(monsterName));
      if (this.copyAITexture(scene, aiKey, textureKey, targetSize, tint, feats)) return;
    }

    const shape = inferShape(monsterName);
    const features = inferFeatures(monsterName);
    if (isBoss) { features.push('dark_aura', inferBossElement(monsterName)); }

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
    // Apply elemental tint + feature overlays for attribute differentiation
    const aiKey = this.findAITexture(scene, monsterName, textureKey, isBoss);
    if (aiKey) {
      const battleSize = isBoss ? 240 : 180;
      const tint = inferTintColor(monsterName);
      const feats = inferFeatures(monsterName);
      if (isBoss) { feats.push('dark_aura', inferBossElement(monsterName)); }
      if (this.copyAITexture(scene, aiKey, battleKey, battleSize, tint, feats)) return battleKey;
    }

    const shape = inferShape(monsterName);
    const features = inferFeatures(monsterName);
    if (isBoss) { features.push('dark_aura', inferBossElement(monsterName)); }

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
   * Currently disabled — all monsters use procedural rendering for consistent art style.
   * To re-enable AI textures, restore the lookup logic (see git history).
   */
  private static findAITexture(
    _scene: Phaser.Scene, _monsterName: string, _textureKey: string, _isBoss: boolean,
  ): string | null {
    return null; // Use procedural rendering for all monsters (consistent art style)
  }

  /**
   * Copy an AI texture to a new key, scaling to targetSize with NEAREST filtering.
   * Centers the source image within the target canvas.
   * Optionally applies a color tint and/or feature overlays (ice/fire/poison).
   * Returns false if the source image is too transparent (rembg damage), so
   * the caller can fall back to procedural rendering.
   */
  private static copyAITexture(
    scene: Phaser.Scene, aiKey: string, targetKey: string, targetSize: number,
    tintColor?: string | null, features?: string[],
  ): boolean {
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

    // Apply color tint (source-atop only affects existing opaque pixels)
    if (tintColor) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = tintColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Overlay elemental feature decorations (ice crystals, flames, poison mist, etc.)
    if (features && features.length > 0) {
      for (const feat of features) {
        drawFeature(ctx, padding, padding, targetSize, targetSize, feat, '#ffff44');
      }
    }

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
