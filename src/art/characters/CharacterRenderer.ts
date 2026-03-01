import Phaser from 'phaser';
import { TILE_SIZE } from '../../config';
import { MEDIEVAL, darken, lighten, varyColor } from '../palettes';
import { ArtRegistry } from '../index';
import {
  type CharacterAppearance, type Direction, type WalkFrame,
  HERO_APPEARANCE, COMPANION_APPEARANCES, generateNPCAppearance, generateGuardAppearance,
} from './CharacterParts';

/** Actual frame size for character sprites (64×96 = 1 tile wide × 1.5 tiles tall at 2× resolution) */
const CHAR_W = 64;
const CHAR_H = 96;

/** Design-space size — all drawCharacter pixel art is authored at this resolution, then ctx.scale'd up */
const DESIGN_W = 32;
const DESIGN_H = 48;

/** Directions in spritesheet order (6 directions: 4 cardinal + 2 diagonal for battle) */
const DIRECTIONS: Direction[] = ['down', 'left', 'right', 'up', 'down_left', 'down_right'];

/**
 * CharacterRenderer — Generates character spritesheets using Canvas 2D.
 * Each spritesheet = 4 cols (walk frames) × 6 rows (directions) = 24 frames
 * Layout: 256×576 pixels total (4×64 wide, 6×96 tall)
 * Walk cycle: left-step → neutral-pass → right-step → neutral-pass
 */
export class CharacterRenderer {

  static generateAll(scene: Phaser.Scene): void {
    // Hero (overworld + battle resolution)
    this.generateCharSheet(scene, 'char_hero', HERO_APPEARANCE);
    this.generateBattleSheet(scene, 'char_hero', HERO_APPEARANCE);

    // Companions (overworld + battle resolution)
    for (const [id, appearance] of Object.entries(COMPANION_APPEARANCES)) {
      this.generateCharSheet(scene, `char_${id}`, appearance);
      this.generateBattleSheet(scene, `char_${id}`, appearance);
    }

    // NPC types (6 variants each — no battle sheets needed)
    const npcTypes = ['shop', 'quest', 'save', 'info'];
    for (const type of npcTypes) {
      for (let i = 0; i < 6; i++) {
        const appearance = generateNPCAppearance(type, i);
        this.generateCharSheet(scene, `char_npc_${type}_${i}`, appearance);
      }
    }

    // Guard textures per region (kingdom-race-themed soldiers)
    const guardRegions = [
      'region_hero', 'region_elf', 'region_treant', 'region_beast',
      'region_merfolk', 'region_giant', 'region_dwarf', 'region_undead',
      'region_volcano', 'region_hotspring', 'region_mountain',
    ];
    for (const rid of guardRegions) {
      const guardApp = generateGuardAppearance(rid);
      this.generateCharSheet(scene, `char_guard_${rid}`, guardApp);
    }

    // Register walk animations
    this.registerAnimations(scene);
  }

  /** Generate a 128×288 spritesheet for one character */
  static generateCharSheet(scene: Phaser.Scene, key: string, appearance: CharacterAppearance): void {
    if (scene.textures.exists(key)) return;

    const sheetW = CHAR_W * 4;
    const sheetH = CHAR_H * DIRECTIONS.length;
    const { canvas, ctx } = ArtRegistry.createCanvas(sheetW, sheetH);

    for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
      const dir = DIRECTIONS[dirIdx];
      for (let frame = 0; frame < 4; frame++) {
        ctx.save();
        ctx.translate(frame * CHAR_W, dirIdx * CHAR_H);
        ctx.scale(CHAR_W / DESIGN_W, CHAR_H / DESIGN_H);
        this.drawCharacter(ctx, 0, 0, appearance, dir, frame as WalkFrame);
        ctx.restore();
      }
    }

    ArtRegistry.registerSpriteSheet(scene, key, canvas, CHAR_W, CHAR_H);
  }

  /** Generate a 2× resolution battle spritesheet (128×192 per frame, pixel-perfect) */
  static generateBattleSheet(scene: Phaser.Scene, key: string, appearance: CharacterAppearance): void {
    const battleKey = `${key}_battle`;
    if (scene.textures.exists(battleKey)) return;

    const S = 2; // battle multiplier over overworld size (128×192)
    const bw = CHAR_W * S;
    const bh = CHAR_H * S;
    const sheetW = bw * 4;
    const sheetH = bh * DIRECTIONS.length;
    const { canvas, ctx } = ArtRegistry.createCanvas(sheetW, sheetH);

    for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
      const dir = DIRECTIONS[dirIdx];
      for (let frame = 0; frame < 4; frame++) {
        ctx.save();
        ctx.translate(frame * bw, dirIdx * bh);
        ctx.scale(bw / DESIGN_W, bh / DESIGN_H);
        this.drawCharacter(ctx, 0, 0, appearance, dir, frame as WalkFrame);
        ctx.restore();
      }
    }

    ArtRegistry.registerSpriteSheet(scene, battleKey, canvas, bw, bh);
  }

  /** Draw a single character frame at the given canvas offset */
  private static drawCharacter(
    ctx: CanvasRenderingContext2D, ox: number, oy: number,
    app: CharacterAppearance, dir: Direction, frame: WalkFrame,
  ): void {
    // Walk cycle: 0=left-step, 1=neutral-pass, 2=right-step, 3=neutral-pass
    const bounce = (frame === 0 || frame === 2) ? -2 : frame === 3 ? -1 : 0;
    const legOffset = frame === 0 ? 3 : frame === 2 ? -3 : 0;
    const armSwing = frame === 0 ? 2 : frame === 2 ? -2 : 0;
    // Cape flutter: bottom flare sways opposite to stride direction
    const capeWave = frame === 0 ? 2 : frame === 2 ? -2 : frame === 3 ? -1 : 1;

    // Diagonal directions share base logic with 'down' but asymmetric
    if (dir === 'down_left' || dir === 'down_right') {
      this.drawCharacterDiagonal(ctx, ox, oy, app, dir, bounce, legOffset, armSwing, capeWave);
      return;
    }

    // ── Cape (behind body — visible in all directions) ──
    if (app.cape) {
      const cY = oy + 18 + bounce;
      if (dir === 'down') {
        // Cape base — wider than body for visibility
        ctx.fillStyle = darken(app.capeColor, 0.15);
        ctx.fillRect(ox + 6, cY + 2, 20, 22);
        ctx.fillStyle = app.capeColor;
        ctx.fillRect(ox + 7, cY, 18, 21);
        // Cape edge highlight (lighter inner border)
        ctx.fillStyle = lighten(app.capeColor, 0.2);
        ctx.fillRect(ox + 7, cY, 18, 2);
        // Cape bottom flare — shifts with walk frame for flutter
        ctx.fillStyle = darken(app.capeColor, 0.1);
        ctx.fillRect(ox + 5 + capeWave, cY + 18, 22, 6);
      } else if (dir === 'up') {
        // Facing away — cape fully visible covering the back
        ctx.fillStyle = darken(app.capeColor, 0.15);
        ctx.fillRect(ox + 6, cY + 2, 20, 22);
        ctx.fillStyle = app.capeColor;
        ctx.fillRect(ox + 7, cY, 18, 21);
        ctx.fillStyle = lighten(app.capeColor, 0.15);
        ctx.fillRect(ox + 7, cY, 18, 2);
        // Cape bottom flare — flutter
        ctx.fillStyle = darken(app.capeColor, 0.1);
        ctx.fillRect(ox + 5 + capeWave, cY + 18, 22, 6);
      } else {
        // Left or right — flutter shifts bottom outward
        const capeX = dir === 'left' ? ox + 16 : ox + 3;
        const sideWave = dir === 'left' ? capeWave : -capeWave;
        ctx.fillStyle = darken(app.capeColor, 0.15);
        ctx.fillRect(capeX, cY + 1, 13, 22);
        ctx.fillStyle = app.capeColor;
        ctx.fillRect(capeX + 1, cY, 12, 21);
        ctx.fillStyle = lighten(app.capeColor, 0.2);
        ctx.fillRect(capeX + 1, cY, 12, 2);
        // Side cape bottom flare — flutter
        ctx.fillStyle = darken(app.capeColor, 0.1);
        ctx.fillRect(capeX + sideWave, cY + 18, 13, 4);
      }
    }

    // ── Legs ──
    const legY = oy + 36 + bounce;
    ctx.fillStyle = darken(app.bodyColor, 0.15);
    // Left leg (trousers)
    ctx.fillRect(ox + 11 + legOffset, legY, 4, 7);
    // Left boot (taller, darker, with highlight)
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(ox + 10 + legOffset, legY + 6, 6, 5);
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(ox + 11 + legOffset, legY + 6, 4, 1); // boot top highlight
    // Right leg (trousers)
    ctx.fillStyle = darken(app.bodyColor, 0.15);
    ctx.fillRect(ox + 17 - legOffset, legY, 4, 7);
    // Right boot
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(ox + 16 - legOffset, legY + 6, 6, 5);
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(ox + 17 - legOffset, legY + 6, 4, 1);

    // ── Body ──
    const bodyY = oy + 18 + bounce;
    ctx.fillStyle = app.bodyColor;
    if (app.bodyType === 'armor') {
      ctx.fillRect(ox + 8, bodyY, 16, 18);
      // Shoulder pauldrons (wider than body)
      ctx.fillStyle = lighten(app.bodyColor, 0.15);
      ctx.fillRect(ox + 6, bodyY, 4, 5);
      ctx.fillRect(ox + 22, bodyY, 4, 5);
      // Pauldron highlight
      ctx.fillStyle = lighten(app.bodyColor, 0.35);
      ctx.fillRect(ox + 6, bodyY, 4, 2);
      ctx.fillRect(ox + 22, bodyY, 4, 2);
      // Chest plate highlight
      ctx.fillStyle = lighten(app.bodyColor, 0.2);
      ctx.fillRect(ox + 9, bodyY + 2, 14, 2);
      // Chest emblem (small diamond)
      ctx.fillStyle = MEDIEVAL.goldBright;
      ctx.fillRect(ox + 15, bodyY + 5, 2, 2);
      ctx.fillRect(ox + 14, bodyY + 6, 4, 2);
      ctx.fillRect(ox + 15, bodyY + 8, 2, 2);
      // Belt
      ctx.fillStyle = darken(app.bodyColor, 0.3);
      ctx.fillRect(ox + 8, bodyY + 15, 16, 3);
      // Belt buckle
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(ox + 15, bodyY + 15, 2, 3);
    } else if (app.bodyType === 'robe') {
      ctx.fillRect(ox + 8, bodyY, 16, 24);
      // Robe details
      ctx.fillStyle = lighten(app.bodyColor, 0.15);
      ctx.fillRect(ox + 15, bodyY + 3, 3, 21);
    } else if (app.bodyType === 'dress') {
      ctx.fillRect(ox + 8, bodyY, 16, 24);
      ctx.fillRect(ox + 7, bodyY + 15, 18, 9);
    } else {
      // tunic / leather
      ctx.fillRect(ox + 8, bodyY, 16, 18);
      // Collar
      ctx.fillStyle = lighten(app.bodyColor, 0.2);
      ctx.fillRect(ox + 12, bodyY, 8, 3);
    }

    // ── Arms (swing opposite to legs for natural walk) ──
    ctx.fillStyle = app.skinColor;
    if (dir === 'down' || dir === 'up') {
      ctx.fillRect(ox + 5, bodyY + 3 - armSwing, 3, 12);
      ctx.fillRect(ox + 24, bodyY + 3 + armSwing, 3, 12);
    } else if (dir === 'left') {
      ctx.fillRect(ox + 5, bodyY + 3 - armSwing, 3, 12);
    } else {
      ctx.fillRect(ox + 24, bodyY + 3 + armSwing, 3, 12);
    }

    // ── Head ──
    const headY = oy + 6 + bounce;
    // Head outline
    ctx.fillStyle = app.skinColor;
    ctx.fillRect(ox + 11, headY, 10, 12);
    ctx.fillRect(ox + 10, headY + 2, 12, 8);

    // Face (eyes) — only for down and side views
    if (dir === 'down') {
      ctx.fillStyle = '#222222';
      ctx.fillRect(ox + 12, headY + 4, 2, 3);
      ctx.fillRect(ox + 18, headY + 4, 2, 3);
      // Eye whites
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 12, headY + 4, 1, 1);
      ctx.fillRect(ox + 18, headY + 4, 1, 1);
      // Mouth
      ctx.fillStyle = darken(app.skinColor, 0.2);
      ctx.fillRect(ox + 15, headY + 9, 2, 1);
    } else if (dir === 'left') {
      ctx.fillStyle = '#222222';
      ctx.fillRect(ox + 11, headY + 4, 2, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 11, headY + 4, 1, 1);
    } else if (dir === 'right') {
      ctx.fillStyle = '#222222';
      ctx.fillRect(ox + 19, headY + 4, 2, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 20, headY + 4, 1, 1);
    }

    // ── Hair ──
    ctx.fillStyle = app.hairColor;
    if (app.hairStyle === 'short') {
      ctx.fillRect(ox + 10, headY - 2, 12, 4);
      ctx.fillRect(ox + 10, headY, 2, 6);
      ctx.fillRect(ox + 20, headY, 2, 6);
    } else if (app.hairStyle === 'long') {
      ctx.fillRect(ox + 10, headY - 2, 12, 4);
      ctx.fillRect(ox + 8, headY, 3, 12);
      ctx.fillRect(ox + 21, headY, 3, 12);
      ctx.fillRect(ox + 10, headY, 2, 9);
      ctx.fillRect(ox + 21, headY, 2, 9);
    } else if (app.hairStyle === 'spiky') {
      ctx.fillRect(ox + 10, headY - 3, 12, 4);
      ctx.fillRect(ox + 11, headY - 5, 3, 3);
      ctx.fillRect(ox + 16, headY - 5, 3, 3);
      ctx.fillRect(ox + 13, headY - 6, 4, 3);
    } else if (app.hairStyle === 'ponytail') {
      ctx.fillRect(ox + 10, headY - 2, 12, 4);
      if (dir === 'down' || dir === 'right') {
        ctx.fillRect(ox + 21, headY + 2, 3, 3);
        ctx.fillRect(ox + 23, headY + 5, 3, 9);
      }
    }
    // bald = no hair

    // ── Headgear ──
    if (app.headgear === 'helmet') {
      ctx.fillStyle = MEDIEVAL.ironMedium;
      ctx.fillRect(ox + 8, headY - 3, 16, 7);
      ctx.fillStyle = MEDIEVAL.ironLight;
      ctx.fillRect(ox + 9, headY - 3, 14, 2);
      // Nose guard
      if (dir === 'down') {
        ctx.fillStyle = MEDIEVAL.ironMedium;
        ctx.fillRect(ox + 15, headY, 2, 7);
      }
    } else if (app.headgear === 'wizard_hat') {
      ctx.fillStyle = '#3333aa';
      ctx.fillRect(ox + 8, headY - 3, 16, 5);
      ctx.fillRect(ox + 11, headY - 8, 10, 5);
      ctx.fillRect(ox + 13, headY - 11, 6, 3);
      ctx.fillRect(ox + 15, headY - 12, 2, 2);
      // Star on hat
      ctx.fillStyle = MEDIEVAL.goldBright;
      ctx.fillRect(ox + 15, headY - 8, 2, 2);
    } else if (app.headgear === 'hood') {
      ctx.fillStyle = app.bodyColor;
      ctx.fillRect(ox + 8, headY - 3, 16, 9);
      ctx.fillRect(ox + 7, headY, 2, 8);
      ctx.fillRect(ox + 23, headY, 2, 8);
    } else if (app.headgear === 'crown') {
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(ox + 9, headY - 3, 14, 5);
      ctx.fillStyle = MEDIEVAL.goldBright;
      ctx.fillRect(ox + 11, headY - 5, 3, 2);
      ctx.fillRect(ox + 15, headY - 6, 3, 3);
      ctx.fillRect(ox + 19, headY - 5, 3, 2);
      // Gem
      ctx.fillStyle = '#cc2222';
      ctx.fillRect(ox + 15, headY - 2, 3, 2);
    } else if (app.headgear === 'circlet') {
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(ox + 10, headY - 1, 12, 2);
      ctx.fillStyle = '#44aaff';
      ctx.fillRect(ox + 15, headY - 1, 2, 2);
    } else if (app.headgear === 'bandana') {
      ctx.fillStyle = '#cc3333';
      ctx.fillRect(ox + 10, headY - 1, 12, 3);
    }

    // ── Weapon ──
    if (app.weapon !== 'none') {
      const wpnX = dir === 'left' ? ox + 3 : ox + 25;
      const wpnY = bodyY + 5;

      ctx.fillStyle = app.weaponColor;
      if (app.weapon === 'sword') {
        ctx.fillRect(wpnX, wpnY, 3, 15);
        ctx.fillStyle = darken(app.weaponColor, 0.2);
        ctx.fillRect(wpnX - 1, wpnY + 12, 5, 3); // crossguard
        ctx.fillStyle = MEDIEVAL.woodMedium;
        ctx.fillRect(wpnX, wpnY + 15, 3, 4); // handle
      } else if (app.weapon === 'staff') {
        ctx.fillRect(wpnX, wpnY - 6, 3, 27);
        ctx.fillStyle = lighten(app.weaponColor, 0.3);
        ctx.fillRect(wpnX - 2, wpnY - 9, 5, 5); // orb
      } else if (app.weapon === 'bow') {
        ctx.fillStyle = MEDIEVAL.woodMedium;
        ctx.fillRect(wpnX, wpnY, 2, 18);
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(wpnX + 2, wpnY, 1, 18); // string
      } else if (app.weapon === 'axe') {
        ctx.fillRect(wpnX, wpnY, 3, 18);
        ctx.fillStyle = MEDIEVAL.ironMedium;
        ctx.fillRect(wpnX - 3, wpnY, 5, 6); // blade
      } else if (app.weapon === 'dagger') {
        ctx.fillRect(wpnX, wpnY + 3, 3, 9);
      } else if (app.weapon === 'hammer') {
        ctx.fillRect(wpnX, wpnY, 3, 18);
        ctx.fillStyle = MEDIEVAL.ironDark;
        ctx.fillRect(wpnX - 3, wpnY - 3, 8, 6);
      }
    }
  }

  /**
   * Draw a diagonal (3/4 view) character frame.
   * down_left = facing viewer, angled left; down_right = mirror.
   */
  private static drawCharacterDiagonal(
    ctx: CanvasRenderingContext2D, ox: number, oy: number,
    app: CharacterAppearance, dir: 'down_left' | 'down_right',
    bounce: number, legOffset: number, armSwing: number, capeWave: number,
  ): void {
    // Mirror helper: flips X offset around design-space center (16)
    const m = dir === 'down_right';
    const mx = (x: number) => m ? (DESIGN_W - x) : x;
    // For rects: mx flips position, need to also shift by width
    const mRect = (x: number, w: number) => m ? (DESIGN_W - x - w) : x;

    // ── Cape (behind body, on trailing side) ──
    if (app.cape) {
      const cY = oy + 18 + bounce;
      // Cape shadow
      ctx.fillStyle = darken(app.capeColor, 0.15);
      ctx.fillRect(ox + mRect(15, 14), cY + 1, 14, 23);
      // Cape body
      ctx.fillStyle = app.capeColor;
      ctx.fillRect(ox + mRect(16, 13), cY, 13, 22);
      // Cape highlight
      ctx.fillStyle = lighten(app.capeColor, 0.2);
      ctx.fillRect(ox + mRect(16, 13), cY, 13, 2);
      // Cape bottom flare — flutter (direction-aware)
      ctx.fillStyle = darken(app.capeColor, 0.1);
      const diagWave = m ? capeWave : -capeWave;
      ctx.fillRect(ox + mRect(14, 16) + diagWave, cY + 19, 16, 5);
    }

    // ── Legs ──
    const legY = oy + 36 + bounce;
    ctx.fillStyle = darken(app.bodyColor, 0.2);
    // Forward leg (slightly ahead)
    ctx.fillRect(ox + mRect(10, 4) + legOffset, legY, 4, 10);
    ctx.fillStyle = darken(app.bodyColor, 0.35);
    ctx.fillRect(ox + mRect(10, 4) + legOffset, legY + 8, 4, 3);
    // Back leg
    ctx.fillStyle = darken(app.bodyColor, 0.2);
    ctx.fillRect(ox + mRect(17, 4) - legOffset, legY, 4, 10);
    ctx.fillStyle = darken(app.bodyColor, 0.35);
    ctx.fillRect(ox + mRect(17, 4) - legOffset, legY + 8, 4, 3);

    // ── Body (asymmetric — forward shoulder wider) ──
    const bodyY = oy + 18 + bounce;
    ctx.fillStyle = app.bodyColor;
    // Slightly shifted body to show 3/4 perspective
    ctx.fillRect(ox + mRect(7, 17), bodyY, 17, 18);

    if (app.bodyType === 'armor') {
      // Shoulder pauldrons
      ctx.fillStyle = lighten(app.bodyColor, 0.15);
      ctx.fillRect(ox + mRect(4, 5), bodyY, 5, 5);
      ctx.fillRect(ox + mRect(22, 5), bodyY, 5, 5);
      ctx.fillStyle = lighten(app.bodyColor, 0.35);
      ctx.fillRect(ox + mRect(4, 5), bodyY, 5, 2);
      ctx.fillRect(ox + mRect(22, 5), bodyY, 5, 2);
      // Chest highlight
      ctx.fillStyle = lighten(app.bodyColor, 0.2);
      ctx.fillRect(ox + mRect(8, 14), bodyY + 2, 14, 2);
      // Chest emblem
      ctx.fillStyle = MEDIEVAL.goldBright;
      ctx.fillRect(ox + mRect(13, 2), bodyY + 5, 2, 2);
      ctx.fillRect(ox + mRect(12, 4), bodyY + 6, 4, 2);
      // Belt
      ctx.fillStyle = darken(app.bodyColor, 0.3);
      ctx.fillRect(ox + mRect(7, 17), bodyY + 15, 17, 3);
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(ox + mRect(14, 2), bodyY + 15, 2, 3);
    } else if (app.bodyType === 'robe') {
      ctx.fillRect(ox + mRect(7, 17), bodyY, 17, 24);
      ctx.fillStyle = lighten(app.bodyColor, 0.15);
      ctx.fillRect(ox + mRect(13, 3), bodyY + 3, 3, 21);
    } else if (app.bodyType === 'dress') {
      ctx.fillRect(ox + mRect(7, 17), bodyY, 17, 24);
      ctx.fillRect(ox + mRect(6, 19), bodyY + 15, 19, 9);
    } else {
      ctx.fillStyle = lighten(app.bodyColor, 0.2);
      ctx.fillRect(ox + mRect(11, 8), bodyY, 8, 3);
    }

    // ── Arms (swing opposite to legs) ──
    ctx.fillStyle = app.skinColor;
    // Forward arm (fully visible)
    ctx.fillRect(ox + mRect(4, 3), bodyY + 3 - armSwing, 3, 12);
    // Back arm (partially hidden, thinner)
    ctx.fillRect(ox + mRect(25, 2), bodyY + 4 + armSwing, 2, 10);

    // ── Head (slightly shifted for 3/4 angle) ──
    const headY = oy + 6 + bounce;
    ctx.fillStyle = app.skinColor;
    ctx.fillRect(ox + mRect(10, 11), headY, 11, 12);
    ctx.fillRect(ox + mRect(9, 13), headY + 2, 13, 8);

    // ── Face — both eyes visible, asymmetric ──
    // Forward eye (full size)
    ctx.fillStyle = '#222222';
    ctx.fillRect(ox + mRect(11, 2), headY + 4, 2, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + mRect(11, 1), headY + 4, 1, 1);
    // Back eye (slightly smaller/closer to center — 3/4 foreshortening)
    ctx.fillStyle = '#222222';
    ctx.fillRect(ox + mRect(17, 2), headY + 4, 2, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + mRect(17, 1), headY + 4, 1, 1);
    // Nose hint (small shadow on forward side)
    ctx.fillStyle = darken(app.skinColor, 0.15);
    ctx.fillRect(ox + mRect(14, 1), headY + 6, 1, 2);
    // Mouth (slightly off-center toward viewer)
    ctx.fillStyle = darken(app.skinColor, 0.2);
    ctx.fillRect(ox + mRect(14, 2), headY + 9, 2, 1);

    // ── Hair ──
    ctx.fillStyle = app.hairColor;
    if (app.hairStyle === 'short') {
      ctx.fillRect(ox + mRect(9, 13), headY - 2, 13, 4);
      ctx.fillRect(ox + mRect(9, 2), headY, 2, 6);
      ctx.fillRect(ox + mRect(20, 2), headY, 2, 6);
    } else if (app.hairStyle === 'long') {
      ctx.fillRect(ox + mRect(9, 13), headY - 2, 13, 4);
      ctx.fillRect(ox + mRect(7, 3), headY, 3, 12);
      ctx.fillRect(ox + mRect(21, 3), headY, 3, 12);
    } else if (app.hairStyle === 'spiky') {
      ctx.fillRect(ox + mRect(9, 13), headY - 3, 13, 4);
      ctx.fillRect(ox + mRect(10, 3), headY - 5, 3, 3);
      ctx.fillRect(ox + mRect(16, 3), headY - 5, 3, 3);
      ctx.fillRect(ox + mRect(13, 4), headY - 6, 4, 3);
    } else if (app.hairStyle === 'ponytail') {
      ctx.fillRect(ox + mRect(9, 13), headY - 2, 13, 4);
      // Ponytail on back side
      ctx.fillRect(ox + mRect(21, 3), headY + 2, 3, 3);
      ctx.fillRect(ox + mRect(23, 3), headY + 5, 3, 9);
    }

    // ── Headgear ──
    if (app.headgear === 'helmet') {
      ctx.fillStyle = MEDIEVAL.ironMedium;
      ctx.fillRect(ox + mRect(7, 17), headY - 3, 17, 7);
      ctx.fillStyle = MEDIEVAL.ironLight;
      ctx.fillRect(ox + mRect(8, 15), headY - 3, 15, 2);
    } else if (app.headgear === 'wizard_hat') {
      ctx.fillStyle = '#3333aa';
      ctx.fillRect(ox + mRect(7, 17), headY - 3, 17, 5);
      ctx.fillRect(ox + mRect(10, 11), headY - 8, 11, 5);
      ctx.fillRect(ox + mRect(12, 7), headY - 11, 7, 3);
      ctx.fillRect(ox + mRect(14, 3), headY - 12, 3, 2);
      ctx.fillStyle = MEDIEVAL.goldBright;
      ctx.fillRect(ox + mRect(14, 2), headY - 8, 2, 2);
    } else if (app.headgear === 'hood') {
      ctx.fillStyle = app.bodyColor;
      ctx.fillRect(ox + mRect(7, 17), headY - 3, 17, 9);
      ctx.fillRect(ox + mRect(6, 2), headY, 2, 8);
      ctx.fillRect(ox + mRect(23, 2), headY, 2, 8);
    } else if (app.headgear === 'crown') {
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(ox + mRect(8, 15), headY - 3, 15, 5);
      ctx.fillStyle = MEDIEVAL.goldBright;
      ctx.fillRect(ox + mRect(10, 3), headY - 5, 3, 2);
      ctx.fillRect(ox + mRect(14, 3), headY - 6, 3, 3);
      ctx.fillRect(ox + mRect(18, 3), headY - 5, 3, 2);
      ctx.fillStyle = '#cc2222';
      ctx.fillRect(ox + mRect(14, 3), headY - 2, 3, 2);
    } else if (app.headgear === 'circlet') {
      ctx.fillStyle = MEDIEVAL.gold;
      ctx.fillRect(ox + mRect(9, 13), headY - 1, 13, 2);
      ctx.fillStyle = '#44aaff';
      ctx.fillRect(ox + mRect(14, 2), headY - 1, 2, 2);
    } else if (app.headgear === 'bandana') {
      ctx.fillStyle = '#cc3333';
      ctx.fillRect(ox + mRect(9, 13), headY - 1, 13, 3);
    }

    // ── Weapon (on the outer/back hand) ──
    if (app.weapon !== 'none') {
      const wpnX = ox + mRect(25, 3);
      const wpnY = bodyY + 5;

      ctx.fillStyle = app.weaponColor;
      if (app.weapon === 'sword') {
        ctx.fillRect(wpnX, wpnY, 3, 15);
        ctx.fillStyle = darken(app.weaponColor, 0.2);
        ctx.fillRect(wpnX - 1, wpnY + 12, 5, 3);
        ctx.fillStyle = MEDIEVAL.woodMedium;
        ctx.fillRect(wpnX, wpnY + 15, 3, 4);
      } else if (app.weapon === 'staff') {
        ctx.fillRect(wpnX, wpnY - 6, 3, 27);
        ctx.fillStyle = lighten(app.weaponColor, 0.3);
        ctx.fillRect(wpnX - 2, wpnY - 9, 5, 5);
      } else if (app.weapon === 'bow') {
        ctx.fillStyle = MEDIEVAL.woodMedium;
        ctx.fillRect(wpnX, wpnY, 2, 18);
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(wpnX + 2, wpnY, 1, 18);
      } else if (app.weapon === 'axe') {
        ctx.fillRect(wpnX, wpnY, 3, 18);
        ctx.fillStyle = MEDIEVAL.ironMedium;
        ctx.fillRect(wpnX - 3, wpnY, 5, 6);
      } else if (app.weapon === 'dagger') {
        ctx.fillRect(wpnX, wpnY + 3, 3, 9);
      } else if (app.weapon === 'hammer') {
        ctx.fillRect(wpnX, wpnY, 3, 18);
        ctx.fillStyle = MEDIEVAL.ironDark;
        ctx.fillRect(wpnX - 3, wpnY - 3, 8, 6);
      }
    }
  }

  /** Register Phaser animations for all character spritesheets */
  private static registerAnimations(scene: Phaser.Scene): void {
    // Get all character texture keys (exclude _battle hi-res textures — they don't need walk animations)
    const texKeys = scene.textures.getTextureKeys().filter(k => k.startsWith('char_') && !k.endsWith('_battle'));

    for (const key of texKeys) {
      for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
        const dir = DIRECTIONS[dirIdx];
        const animKey = `${key}_walk_${dir}`;
        if (scene.anims.exists(animKey)) continue;

        const baseFrame = dirIdx * 4;
        scene.anims.create({
          key: animKey,
          frames: [
            { key, frame: baseFrame },       // left step
            { key, frame: baseFrame + 1 },   // neutral pass
            { key, frame: baseFrame + 2 },   // right step
            { key, frame: baseFrame + 3 },   // neutral pass
          ],
          frameRate: 8,
          repeat: -1,
        });

        // Idle — 2 frames for cape flutter sway (frames 1 & 3 have different capeWave)
        const idleKey = `${key}_idle_${dir}`;
        if (!scene.anims.exists(idleKey)) {
          scene.anims.create({
            key: idleKey,
            frames: [
              { key, frame: baseFrame + 1 },
              { key, frame: baseFrame + 3 },
            ],
            frameRate: 2,
            repeat: -1,
          });
        }
      }
    }

    // Register idle animations for battle-resolution textures (same layout, 2× size)
    const battleTexKeys = scene.textures.getTextureKeys().filter(k => k.startsWith('char_') && k.endsWith('_battle'));
    for (const bKey of battleTexKeys) {
      for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
        const dir = DIRECTIONS[dirIdx];
        const idleKey = `${bKey}_idle_${dir}`;
        if (scene.anims.exists(idleKey)) continue;
        const baseFrame = dirIdx * 4;
        scene.anims.create({
          key: idleKey,
          frames: [
            { key: bKey, frame: baseFrame + 1 },
            { key: bKey, frame: baseFrame + 3 },
          ],
          frameRate: 2,
          repeat: -1,
        });
      }
    }
  }
}
