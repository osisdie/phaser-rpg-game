import Phaser from 'phaser';
import { TILE_SIZE } from '../../config';
import { MEDIEVAL, darken, lighten, varyColor } from '../palettes';
import { ArtRegistry } from '../index';
import {
  type CharacterAppearance, type Direction, type WalkFrame,
  HERO_APPEARANCE, COMPANION_APPEARANCES, generateNPCAppearance,
} from './CharacterParts';

/** Frame size for character sprites */
const CHAR_W = 24;
const CHAR_H = 32;

/** Directions in spritesheet order */
const DIRECTIONS: Direction[] = ['down', 'left', 'right', 'up'];

/**
 * CharacterRenderer — Generates character spritesheets using Canvas 2D.
 * Each spritesheet = 3 cols (walk frames) × 4 rows (directions) = 12 frames
 * Layout: 72×128 pixels total (3×24 wide, 4×32 tall)
 */
export class CharacterRenderer {

  static generateAll(scene: Phaser.Scene): void {
    // Hero
    this.generateCharSheet(scene, 'char_hero', HERO_APPEARANCE);

    // Companions
    for (const [id, appearance] of Object.entries(COMPANION_APPEARANCES)) {
      this.generateCharSheet(scene, `char_${id}`, appearance);
    }

    // NPC types (6 variants each)
    const npcTypes = ['shop', 'quest', 'save', 'info'];
    for (const type of npcTypes) {
      for (let i = 0; i < 6; i++) {
        const appearance = generateNPCAppearance(type, i);
        this.generateCharSheet(scene, `char_npc_${type}_${i}`, appearance);
      }
    }

    // Register walk animations
    this.registerAnimations(scene);
  }

  /** Generate a 72×128 spritesheet for one character */
  static generateCharSheet(scene: Phaser.Scene, key: string, appearance: CharacterAppearance): void {
    if (scene.textures.exists(key)) return;

    const sheetW = CHAR_W * 3;
    const sheetH = CHAR_H * 4;
    const { canvas, ctx } = ArtRegistry.createCanvas(sheetW, sheetH);

    for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
      const dir = DIRECTIONS[dirIdx];
      for (let frame = 0; frame < 3; frame++) {
        const ox = frame * CHAR_W;
        const oy = dirIdx * CHAR_H;
        this.drawCharacter(ctx, ox, oy, appearance, dir, frame as WalkFrame);
      }
    }

    ArtRegistry.registerSpriteSheet(scene, key, canvas, CHAR_W, CHAR_H);
  }

  /** Draw a single character frame at the given canvas offset */
  private static drawCharacter(
    ctx: CanvasRenderingContext2D, ox: number, oy: number,
    app: CharacterAppearance, dir: Direction, frame: WalkFrame,
  ): void {
    // Walk bounce
    const bounce = frame === 1 ? -1 : frame === 2 ? -1 : 0;
    const legOffset = frame === 0 ? 0 : frame === 1 ? 1 : -1;

    // ── Cape (behind body) ──
    if (app.cape && (dir === 'down' || dir === 'left' || dir === 'right')) {
      ctx.fillStyle = app.capeColor;
      if (dir === 'down') {
        ctx.fillRect(ox + 7, oy + 12 + bounce, 10, 14);
        ctx.fillRect(ox + 6, oy + 14 + bounce, 12, 10);
      } else {
        const capeX = dir === 'left' ? ox + 12 : ox + 4;
        ctx.fillRect(capeX, oy + 12 + bounce, 8, 13);
      }
    }

    // ── Legs ──
    const legY = oy + 24 + bounce;
    ctx.fillStyle = darken(app.bodyColor, 0.2);
    // Left leg
    ctx.fillRect(ox + 8 + legOffset, legY, 3, 7);
    ctx.fillStyle = darken(app.bodyColor, 0.35); // boots
    ctx.fillRect(ox + 8 + legOffset, legY + 5, 3, 2);
    // Right leg
    ctx.fillStyle = darken(app.bodyColor, 0.2);
    ctx.fillRect(ox + 13 - legOffset, legY, 3, 7);
    ctx.fillStyle = darken(app.bodyColor, 0.35);
    ctx.fillRect(ox + 13 - legOffset, legY + 5, 3, 2);

    // ── Body ──
    const bodyY = oy + 12 + bounce;
    ctx.fillStyle = app.bodyColor;
    if (app.bodyType === 'armor') {
      ctx.fillRect(ox + 6, bodyY, 12, 12);
      // Armor highlight
      ctx.fillStyle = lighten(app.bodyColor, 0.2);
      ctx.fillRect(ox + 7, bodyY + 1, 10, 1);
      ctx.fillRect(ox + 6, bodyY, 1, 12);
      // Belt
      ctx.fillStyle = darken(app.bodyColor, 0.3);
      ctx.fillRect(ox + 6, bodyY + 10, 12, 2);
    } else if (app.bodyType === 'robe') {
      ctx.fillRect(ox + 6, bodyY, 12, 16);
      // Robe details
      ctx.fillStyle = lighten(app.bodyColor, 0.15);
      ctx.fillRect(ox + 11, bodyY + 2, 2, 14);
    } else if (app.bodyType === 'dress') {
      ctx.fillRect(ox + 6, bodyY, 12, 16);
      ctx.fillRect(ox + 5, bodyY + 10, 14, 6);
    } else {
      // tunic / leather
      ctx.fillRect(ox + 6, bodyY, 12, 12);
      // Collar
      ctx.fillStyle = lighten(app.bodyColor, 0.2);
      ctx.fillRect(ox + 9, bodyY, 6, 2);
    }

    // ── Arms ──
    ctx.fillStyle = app.skinColor;
    if (dir === 'down' || dir === 'up') {
      ctx.fillRect(ox + 4, bodyY + 2, 2, 8);
      ctx.fillRect(ox + 18, bodyY + 2, 2, 8);
    } else if (dir === 'left') {
      ctx.fillRect(ox + 4, bodyY + 2, 2, 8);
    } else {
      ctx.fillRect(ox + 18, bodyY + 2, 2, 8);
    }

    // ── Head ──
    const headY = oy + 4 + bounce;
    // Head outline
    ctx.fillStyle = app.skinColor;
    ctx.fillRect(ox + 8, headY, 8, 8);
    ctx.fillRect(ox + 7, headY + 1, 10, 6);

    // Face (eyes) — only for down and side views
    if (dir === 'down') {
      ctx.fillStyle = '#222222';
      ctx.fillRect(ox + 9, headY + 3, 2, 2);
      ctx.fillRect(ox + 13, headY + 3, 2, 2);
      // Eye whites
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 9, headY + 3, 1, 1);
      ctx.fillRect(ox + 13, headY + 3, 1, 1);
      // Mouth
      ctx.fillStyle = darken(app.skinColor, 0.2);
      ctx.fillRect(ox + 11, headY + 6, 2, 1);
    } else if (dir === 'left') {
      ctx.fillStyle = '#222222';
      ctx.fillRect(ox + 8, headY + 3, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 8, headY + 3, 1, 1);
    } else if (dir === 'right') {
      ctx.fillStyle = '#222222';
      ctx.fillRect(ox + 14, headY + 3, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 15, headY + 3, 1, 1);
    }

    // ── Hair ──
    ctx.fillStyle = app.hairColor;
    if (app.hairStyle === 'short') {
      ctx.fillRect(ox + 7, headY - 1, 10, 3);
      ctx.fillRect(ox + 7, headY, 2, 4);
      ctx.fillRect(ox + 15, headY, 2, 4);
    } else if (app.hairStyle === 'long') {
      ctx.fillRect(ox + 7, headY - 1, 10, 3);
      ctx.fillRect(ox + 6, headY, 2, 8);
      ctx.fillRect(ox + 16, headY, 2, 8);
      ctx.fillRect(ox + 7, headY, 1, 6);
      ctx.fillRect(ox + 16, headY, 1, 6);
    } else if (app.hairStyle === 'spiky') {
      ctx.fillRect(ox + 7, headY - 2, 10, 3);
      ctx.fillRect(ox + 8, headY - 3, 2, 2);
      ctx.fillRect(ox + 12, headY - 3, 2, 2);
      ctx.fillRect(ox + 10, headY - 4, 3, 2);
    } else if (app.hairStyle === 'ponytail') {
      ctx.fillRect(ox + 7, headY - 1, 10, 3);
      if (dir === 'down' || dir === 'right') {
        ctx.fillRect(ox + 16, headY + 1, 2, 2);
        ctx.fillRect(ox + 17, headY + 3, 2, 6);
      }
    }
    // bald = no hair

    // ── Headgear ──
    if (app.headgear === 'helmet') {
      ctx.fillStyle = MEDIEVAL.ironMedium;
      ctx.fillRect(ox + 6, headY - 2, 12, 5);
      ctx.fillStyle = MEDIEVAL.ironLight;
      ctx.fillRect(ox + 7, headY - 2, 10, 1);
      // Nose guard
      if (dir === 'down') {
        ctx.fillStyle = MEDIEVAL.ironMedium;
        ctx.fillRect(ox + 11, headY, 2, 5);
      }
    } else if (app.headgear === 'wizard_hat') {
      ctx.fillStyle = '#3333aa';
      ctx.fillRect(ox + 6, headY - 2, 12, 3);
      ctx.fillRect(ox + 8, headY - 5, 8, 3);
      ctx.fillRect(ox + 10, headY - 7, 4, 2);
      ctx.fillRect(ox + 11, headY - 8, 2, 1);
      // Star on hat
      ctx.fillStyle = MEDIEVAL.goldBright;
      ctx.fillRect(ox + 11, headY - 5, 2, 2);
    } else if (app.headgear === 'hood') {
      ctx.fillStyle = app.bodyColor;
      ctx.fillRect(ox + 6, headY - 2, 12, 6);
      ctx.fillRect(ox + 5, headY, 2, 5);
      ctx.fillRect(ox + 17, headY, 2, 5);
    } else if (app.headgear === 'crown') {
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(ox + 7, headY - 2, 10, 3);
      ctx.fillStyle = MEDIEVAL.goldBright;
      ctx.fillRect(ox + 8, headY - 3, 2, 1);
      ctx.fillRect(ox + 11, headY - 4, 2, 2);
      ctx.fillRect(ox + 14, headY - 3, 2, 1);
      // Gem
      ctx.fillStyle = '#cc2222';
      ctx.fillRect(ox + 11, headY - 1, 2, 1);
    } else if (app.headgear === 'circlet') {
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(ox + 7, headY - 1, 10, 1);
      ctx.fillStyle = '#44aaff';
      ctx.fillRect(ox + 11, headY - 1, 2, 1);
    } else if (app.headgear === 'bandana') {
      ctx.fillStyle = '#cc3333';
      ctx.fillRect(ox + 7, headY - 1, 10, 2);
    }

    // ── Weapon ──
    if (app.weapon !== 'none') {
      const wpnSide = (dir === 'left') ? -1 : 1;
      const wpnX = dir === 'left' ? ox + 2 : ox + 19;
      const wpnY = bodyY + 3;

      ctx.fillStyle = app.weaponColor;
      if (app.weapon === 'sword') {
        ctx.fillRect(wpnX, wpnY, 2, 10);
        ctx.fillStyle = darken(app.weaponColor, 0.2);
        ctx.fillRect(wpnX - 1, wpnY + 8, 4, 2); // crossguard
        ctx.fillStyle = MEDIEVAL.woodMedium;
        ctx.fillRect(wpnX, wpnY + 10, 2, 3); // handle
      } else if (app.weapon === 'staff') {
        ctx.fillRect(wpnX, wpnY - 4, 2, 18);
        ctx.fillStyle = lighten(app.weaponColor, 0.3);
        ctx.fillRect(wpnX - 1, wpnY - 6, 4, 3); // orb
      } else if (app.weapon === 'bow') {
        ctx.fillStyle = MEDIEVAL.woodMedium;
        ctx.fillRect(wpnX, wpnY, 1, 12);
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(wpnX + 1, wpnY, 1, 12); // string
      } else if (app.weapon === 'axe') {
        ctx.fillRect(wpnX, wpnY, 2, 12);
        ctx.fillStyle = MEDIEVAL.ironMedium;
        ctx.fillRect(wpnX - 2, wpnY, 4, 4); // blade
      } else if (app.weapon === 'dagger') {
        ctx.fillRect(wpnX, wpnY + 2, 2, 6);
      } else if (app.weapon === 'hammer') {
        ctx.fillRect(wpnX, wpnY, 2, 12);
        ctx.fillStyle = MEDIEVAL.ironDark;
        ctx.fillRect(wpnX - 2, wpnY - 2, 6, 4);
      }
    }
  }

  /** Register Phaser animations for all character spritesheets */
  private static registerAnimations(scene: Phaser.Scene): void {
    // Get all character texture keys
    const texKeys = scene.textures.getTextureKeys().filter(k => k.startsWith('char_'));

    for (const key of texKeys) {
      for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
        const dir = DIRECTIONS[dirIdx];
        const animKey = `${key}_walk_${dir}`;
        if (scene.anims.exists(animKey)) continue;

        const baseFrame = dirIdx * 3;
        scene.anims.create({
          key: animKey,
          frames: [
            { key, frame: baseFrame },       // stand
            { key, frame: baseFrame + 1 },   // step left
            { key, frame: baseFrame },       // stand
            { key, frame: baseFrame + 2 },   // step right
          ],
          frameRate: 6,
          repeat: -1,
        });

        // Idle (single frame)
        const idleKey = `${key}_idle_${dir}`;
        if (!scene.anims.exists(idleKey)) {
          scene.anims.create({
            key: idleKey,
            frames: [{ key, frame: baseFrame }],
            frameRate: 1,
          });
        }
      }
    }
  }
}
