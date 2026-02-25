import Phaser from 'phaser';
import { TILE_SIZE } from '../../config';
import { numToHex } from '../palettes';
import { ArtRegistry } from '../index';
import { drawMonsterShape, type MonsterShape, type MonsterVisual } from './MonsterShapes';

/**
 * MonsterRenderer — Generates monster textures from shape + color definitions.
 * Each region's monsters use the base shape with region-specific color/decoration variants.
 */

/** Map from monster name pattern → base shape */
const MONSTER_SHAPE_MAP: Record<string, MonsterShape> = {
  '史萊姆': 'slime', '黏液': 'slime',
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

    const shape = inferShape(monsterName);
    const features = inferFeatures(monsterName);
    if (isBoss) features.push('crown');

    this.generateMonsterTexture(scene, textureKey, {
      shape,
      baseColor: numToHex(spriteColor),
      accentColor: isBoss ? '#ffd700' : '#ffff44',
      size: isBoss ? 2 : 1,
      features,
    });
  }

  /** Generate a high-resolution monster texture for battle display (no setScale needed) */
  static generateForBattle(scene: Phaser.Scene, textureKey: string, monsterName: string, spriteColor: number, isBoss: boolean): string {
    const battleKey = `${textureKey}_hires`;
    if (scene.textures.exists(battleKey)) return battleKey;

    const shape = inferShape(monsterName);
    const features = inferFeatures(monsterName);
    if (isBoss) features.push('crown');

    this.generateMonsterTexture(scene, battleKey, {
      shape,
      baseColor: numToHex(spriteColor),
      accentColor: isBoss ? '#ffd700' : '#ffff44',
      size: 1, // size is baked into targetSize
      features,
    }, isBoss ? 160 : 120);

    return battleKey;
  }

  /** Generate a single monster texture (targetSize overrides the base calculation) */
  private static generateMonsterTexture(scene: Phaser.Scene, key: string, visual: MonsterVisual, targetSize?: number): void {
    if (scene.textures.exists(key)) return;

    const MONSTER_BASE = 48; // base monster size (was TILE_SIZE=32)
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
