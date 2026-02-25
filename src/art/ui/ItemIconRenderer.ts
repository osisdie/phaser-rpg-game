import { MEDIEVAL, darken, lighten } from '../palettes';
import { ArtRegistry } from '../index';

/**
 * Generates 32×32 pixel-art icons with colored beveled backgrounds
 * for items, equipment, and skills. Each icon has:
 *   - 2px beveled border (highlight top-left, shadow bottom-right)
 *   - Colored background fill
 *   - Centered pixel art (≈24×24)
 */

const S = 32; // icon size

// ─── Color Themes ───

const TIER_THEME: Record<string, { bg: string; border: string; metal: string; hi: string }> = {
  wood:      { bg: '#2e1f12', border: '#6b4f3a', metal: '#8b6f4e', hi: '#aa9060' },
  iron:      { bg: '#222228', border: '#555560', metal: '#777780', hi: '#9999a0' },
  steel:     { bg: '#1e2530', border: '#455568', metal: '#6a7a90', hi: '#8a9aaa' },
  silver:    { bg: '#2a2a40', border: '#7777aa', metal: '#aaaacc', hi: '#ccccee' },
  mithril:   { bg: '#122828', border: '#339977', metal: '#55bb99', hi: '#88ddbb' },
  dragon:    { bg: '#2e1008', border: '#aa3322', metal: '#cc5533', hi: '#ee7744' },
  holy:      { bg: '#2a2a12', border: '#b89828', metal: '#e8c848', hi: '#ffe860' },
  legendary: { bg: '#221230', border: '#7733aa', metal: '#9955cc', hi: '#bb77ee' },
};

const ELEM_THEME: Record<string, { bg: string; border: string; c1: string; c2: string }> = {
  fire:  { bg: '#301008', border: '#bb3311', c1: '#ff5522', c2: '#ffaa44' },
  water: { bg: '#081030', border: '#2255bb', c1: '#4488ff', c2: '#88bbff' },
  earth: { bg: '#201808', border: '#886633', c1: '#aa8844', c2: '#ccaa66' },
  wind:  { bg: '#082010', border: '#33aa55', c1: '#55cc77', c2: '#88ee99' },
  light: { bg: '#282010', border: '#bb9922', c1: '#ffdd33', c2: '#ffee88' },
  dark:  { bg: '#180828', border: '#6622aa', c1: '#8844cc', c2: '#aa66ee' },
  none:  { bg: '#1e1e28', border: '#555568', c1: '#7777aa', c2: '#9999cc' },
};

const ITEM_BG: Record<string, { bg: string; border: string }> = {
  hp:      { bg: '#301010', border: '#cc3344' },
  mp:      { bg: '#101030', border: '#3344cc' },
  elixir:  { bg: '#282010', border: '#ccaa33' },
  revive:  { bg: '#202028', border: '#8899bb' },
};

export class ItemIconRenderer {
  static readonly SIZE = S;

  // ─── Public API ───

  static generateAll(scene: Phaser.Scene): void {
    // Consumable items
    this.genItem(scene, 'item_potion_s', 'hp', 'potion', '#cc3344');
    this.genItem(scene, 'item_potion_m', 'hp', 'potion', '#dd4455');
    this.genItem(scene, 'item_potion_l', 'hp', 'potion', '#ee5566');
    this.genItem(scene, 'item_ether_s', 'mp', 'potion', '#3344cc');
    this.genItem(scene, 'item_ether_m', 'mp', 'potion', '#4455dd');
    this.genItem(scene, 'item_elixir', 'elixir', 'potion', '#ccaa33');
    this.genItem(scene, 'item_revive', 'revive', 'feather', '#aabbdd');

    // Equipment: 8 tiers × 5 slots
    for (const tier of Object.keys(TIER_THEME)) {
      for (const slot of ['sword', 'helmet', 'armor', 'shield', 'boots']) {
        this.genEquip(scene, `equip_${tier}_${slot}`, tier, slot);
      }
    }

    // Skills: element × type
    for (const elem of Object.keys(ELEM_THEME)) {
      for (const type of ['physical', 'magical', 'heal', 'buff', 'debuff', 'special']) {
        this.genSkill(scene, elem, type);
      }
    }
  }

  /** Icon texture key for an item/equipment ID */
  static getIconKey(id: string): string { return `iicon_${id}`; }

  /** Icon texture key for a skill by element+type */
  static getSkillIconKey(element: string, type: string): string {
    return `sicon_${element}_${type}`;
  }

  // ─── Generators ───

  private static genItem(scene: Phaser.Scene, id: string, theme: string, shape: string, color: string): void {
    const key = `iicon_${id}`;
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const t = ITEM_BG[theme] ?? ITEM_BG.hp;
    this.drawPlate(ctx, t.bg, t.border);
    if (shape === 'potion') this.drawPotion(ctx, color);
    else this.drawFeather(ctx, color);
    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static genEquip(scene: Phaser.Scene, id: string, tier: string, slot: string): void {
    const key = `iicon_${id}`;
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const t = TIER_THEME[tier] ?? TIER_THEME.iron;
    this.drawPlate(ctx, t.bg, t.border);
    const draw: Record<string, () => void> = {
      sword: () => this.drawSword(ctx, t.metal, t.hi),
      helmet: () => this.drawHelmet(ctx, t.metal, t.hi),
      armor: () => this.drawArmor(ctx, t.metal, t.hi),
      shield: () => this.drawShield(ctx, t.metal, t.hi),
      boots: () => this.drawBoots(ctx, t.metal, t.hi),
    };
    draw[slot]?.();
    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static genSkill(scene: Phaser.Scene, element: string, type: string): void {
    const key = `sicon_${element}_${type}`;
    if (scene.textures.exists(key)) return;
    const { canvas, ctx } = ArtRegistry.createCanvas(S, S);
    const t = ELEM_THEME[element] ?? ELEM_THEME.none;
    this.drawPlate(ctx, t.bg, t.border);
    const draw: Record<string, () => void> = {
      physical: () => this.drawSlash(ctx, t.c1, t.c2),
      magical: () => this.drawStar(ctx, t.c1, t.c2),
      heal: () => this.drawCross(ctx, t.c1, t.c2),
      buff: () => this.drawArrowUp(ctx, t.c1, t.c2),
      debuff: () => this.drawArrowDown(ctx, t.c1, t.c2),
      special: () => this.drawDiamond(ctx, t.c1, t.c2),
    };
    draw[type]?.();
    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Plate (beveled background) ───

  private static drawPlate(ctx: CanvasRenderingContext2D, bg: string, border: string): void {
    ctx.fillStyle = border;
    ctx.fillRect(0, 0, S, S);
    // Highlight (top + left inner edges)
    ctx.fillStyle = lighten(border, 0.35);
    ctx.fillRect(1, 1, S - 2, 1);
    ctx.fillRect(1, 2, 1, S - 4);
    // Shadow (bottom + right inner edges)
    ctx.fillStyle = darken(border, 0.35);
    ctx.fillRect(1, S - 2, S - 2, 1);
    ctx.fillRect(S - 2, 2, 1, S - 4);
    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(2, 2, S - 4, S - 4);
    // Top subtle highlight gradient
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(2, 2, S - 4, 8);
    // Bottom subtle shadow
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(2, S - 10, S - 4, 8);
  }

  // ─── Item Art ───

  private static drawPotion(ctx: CanvasRenderingContext2D, liquid: string): void {
    const x = 9, y = 3;
    // Cork
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(x + 4, y + 1, 6, 3);
    ctx.fillStyle = MEDIEVAL.woodLight;
    ctx.fillRect(x + 5, y + 1, 2, 2);
    // Neck
    ctx.fillStyle = '#778899';
    ctx.fillRect(x + 4, y + 4, 6, 3);
    ctx.fillStyle = '#8899aa';
    ctx.fillRect(x + 4, y + 4, 6, 1);
    // Body
    ctx.fillStyle = '#667788';
    ctx.fillRect(x + 2, y + 7, 10, 14);
    ctx.fillRect(x + 3, y + 21, 8, 2);
    // Body highlight (left edge)
    ctx.fillStyle = '#8899aa';
    ctx.fillRect(x + 2, y + 7, 1, 14);
    // Body top edge
    ctx.fillStyle = '#7788aa';
    ctx.fillRect(x + 2, y + 7, 10, 1);
    // Liquid fill
    ctx.fillStyle = liquid;
    ctx.fillRect(x + 3, y + 11, 8, 9);
    // Liquid highlight (left)
    ctx.fillStyle = lighten(liquid, 0.3);
    ctx.fillRect(x + 3, y + 11, 2, 6);
    // Liquid shadow (right)
    ctx.fillStyle = darken(liquid, 0.25);
    ctx.fillRect(x + 9, y + 13, 2, 6);
    // Glass shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 10, y + 8, 1, 8);
    // Bubbles
    ctx.fillStyle = lighten(liquid, 0.5);
    ctx.fillRect(x + 6, y + 13, 1, 1);
    ctx.fillRect(x + 8, y + 15, 1, 1);
    ctx.fillRect(x + 5, y + 17, 1, 1);
  }

  private static drawFeather(ctx: CanvasRenderingContext2D, color: string): void {
    const x = 7, y = 3;
    // Central shaft
    ctx.fillStyle = darken(color, 0.2);
    ctx.fillRect(x + 8, y + 2, 2, 22);
    // Feather vanes (left side)
    ctx.fillStyle = color;
    ctx.fillRect(x + 3, y + 4, 5, 3);
    ctx.fillRect(x + 2, y + 7, 6, 3);
    ctx.fillRect(x + 1, y + 10, 7, 3);
    ctx.fillRect(x + 2, y + 13, 6, 3);
    ctx.fillRect(x + 3, y + 16, 5, 3);
    ctx.fillRect(x + 5, y + 19, 3, 2);
    // Right side
    ctx.fillRect(x + 10, y + 5, 4, 3);
    ctx.fillRect(x + 10, y + 8, 5, 3);
    ctx.fillRect(x + 10, y + 11, 5, 3);
    ctx.fillRect(x + 10, y + 14, 4, 3);
    ctx.fillRect(x + 10, y + 17, 3, 2);
    // Highlights
    ctx.fillStyle = lighten(color, 0.3);
    ctx.fillRect(x + 4, y + 5, 4, 1);
    ctx.fillRect(x + 3, y + 8, 5, 1);
    ctx.fillRect(x + 2, y + 11, 6, 1);
    // Tip
    ctx.fillStyle = lighten(color, 0.4);
    ctx.fillRect(x + 8, y + 0, 2, 3);
    // Sparkle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 8, y + 1, 1, 1);
  }

  // ─── Equipment Art ───

  private static drawSword(ctx: CanvasRenderingContext2D, metal: string, hi: string): void {
    const x = 5, y = 3;
    // Blade (diagonal from top-right to center)
    ctx.fillStyle = metal;
    for (let i = 0; i < 11; i++) {
      ctx.fillRect(x + 14 - i, y + 1 + i, 3, 3);
    }
    // Blade edge highlight
    ctx.fillStyle = hi;
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(x + 15 - i, y + 1 + i, 1, 2);
    }
    // Blade shadow edge
    ctx.fillStyle = darken(metal, 0.3);
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(x + 14 - i, y + 3 + i, 1, 1);
    }
    // Guard
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(x + 2, y + 12, 8, 3);
    ctx.fillStyle = MEDIEVAL.goldLight;
    ctx.fillRect(x + 2, y + 12, 8, 1);
    ctx.fillStyle = MEDIEVAL.goldDark;
    ctx.fillRect(x + 2, y + 14, 8, 1);
    // Handle
    ctx.fillStyle = MEDIEVAL.woodDark;
    ctx.fillRect(x + 4, y + 15, 4, 6);
    ctx.fillStyle = MEDIEVAL.woodMedium;
    ctx.fillRect(x + 5, y + 15, 2, 6);
    // Grip wrapping
    ctx.fillStyle = MEDIEVAL.woodLight;
    ctx.fillRect(x + 4, y + 16, 4, 1);
    ctx.fillRect(x + 4, y + 19, 4, 1);
    // Pommel
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(x + 4, y + 21, 4, 3);
    ctx.fillStyle = MEDIEVAL.goldLight;
    ctx.fillRect(x + 5, y + 21, 2, 1);
  }

  private static drawHelmet(ctx: CanvasRenderingContext2D, metal: string, hi: string): void {
    const x = 5, y = 3;
    // Dome
    ctx.fillStyle = metal;
    ctx.fillRect(x + 4, y + 2, 14, 6);
    ctx.fillRect(x + 2, y + 5, 18, 6);
    ctx.fillRect(x + 3, y + 3, 16, 3);
    // Dome highlight (top)
    ctx.fillStyle = hi;
    ctx.fillRect(x + 5, y + 2, 10, 2);
    ctx.fillRect(x + 4, y + 3, 4, 2);
    // Dome shadow (bottom)
    ctx.fillStyle = darken(metal, 0.3);
    ctx.fillRect(x + 2, y + 10, 18, 1);
    // Visor
    ctx.fillStyle = darken(metal, 0.4);
    ctx.fillRect(x + 3, y + 11, 16, 4);
    ctx.fillRect(x + 5, y + 15, 12, 2);
    // Eye slits
    ctx.fillStyle = '#111111';
    ctx.fillRect(x + 5, y + 12, 4, 2);
    ctx.fillRect(x + 13, y + 12, 4, 2);
    // Nose guard
    ctx.fillStyle = darken(metal, 0.2);
    ctx.fillRect(x + 10, y + 11, 2, 5);
    // Crest
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(x + 9, y + 0, 4, 4);
    ctx.fillStyle = MEDIEVAL.goldLight;
    ctx.fillRect(x + 10, y + 0, 2, 2);
    // Side rivets
    ctx.fillStyle = hi;
    ctx.fillRect(x + 3, y + 8, 1, 1);
    ctx.fillRect(x + 18, y + 8, 1, 1);
  }

  private static drawArmor(ctx: CanvasRenderingContext2D, metal: string, hi: string): void {
    const x = 4, y = 2;
    // Shoulder pads
    ctx.fillStyle = metal;
    ctx.fillRect(x + 0, y + 4, 5, 5);
    ctx.fillRect(x + 19, y + 4, 5, 5);
    // Shoulder highlights
    ctx.fillStyle = hi;
    ctx.fillRect(x + 0, y + 4, 5, 1);
    ctx.fillRect(x + 19, y + 4, 5, 1);
    // Chest plate
    ctx.fillStyle = metal;
    ctx.fillRect(x + 5, y + 2, 14, 18);
    ctx.fillRect(x + 6, y + 20, 12, 4);
    // Neck opening
    ctx.fillStyle = darken(metal, 0.5);
    ctx.fillRect(x + 9, y + 1, 6, 2);
    // Chest highlight (left side light)
    ctx.fillStyle = hi;
    ctx.fillRect(x + 6, y + 3, 4, 8);
    ctx.fillRect(x + 5, y + 4, 1, 6);
    // Central ridge
    ctx.fillStyle = darken(metal, 0.15);
    ctx.fillRect(x + 11, y + 4, 2, 14);
    // Horizontal plate line
    ctx.fillRect(x + 6, y + 10, 12, 1);
    ctx.fillRect(x + 6, y + 15, 12, 1);
    // Lower plate shadow
    ctx.fillStyle = darken(metal, 0.25);
    ctx.fillRect(x + 6, y + 18, 12, 2);
    // Belt
    ctx.fillStyle = MEDIEVAL.woodDark;
    ctx.fillRect(x + 5, y + 19, 14, 2);
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(x + 10, y + 19, 4, 2);
    // Rivets
    ctx.fillStyle = hi;
    ctx.fillRect(x + 6, y + 5, 1, 1);
    ctx.fillRect(x + 17, y + 5, 1, 1);
    ctx.fillRect(x + 6, y + 12, 1, 1);
    ctx.fillRect(x + 17, y + 12, 1, 1);
  }

  private static drawShield(ctx: CanvasRenderingContext2D, metal: string, hi: string): void {
    const x = 5, y = 2;
    // Shield body
    ctx.fillStyle = metal;
    ctx.fillRect(x + 2, y + 1, 18, 12);
    ctx.fillRect(x + 3, y + 13, 16, 3);
    ctx.fillRect(x + 4, y + 16, 14, 2);
    ctx.fillRect(x + 5, y + 18, 12, 2);
    ctx.fillRect(x + 7, y + 20, 8, 2);
    ctx.fillRect(x + 9, y + 22, 4, 1);
    ctx.fillRect(x + 10, y + 23, 2, 1);
    // Highlight (top-left)
    ctx.fillStyle = hi;
    ctx.fillRect(x + 2, y + 1, 18, 1);
    ctx.fillRect(x + 2, y + 2, 1, 11);
    ctx.fillRect(x + 3, y + 2, 6, 4);
    // Shadow (bottom-right)
    ctx.fillStyle = darken(metal, 0.3);
    ctx.fillRect(x + 19, y + 2, 1, 11);
    ctx.fillRect(x + 18, y + 13, 1, 3);
    // Cross emblem
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(x + 9, y + 3, 4, 16);
    ctx.fillRect(x + 4, y + 8, 14, 4);
    // Cross highlight
    ctx.fillStyle = MEDIEVAL.goldLight;
    ctx.fillRect(x + 10, y + 3, 2, 16);
    ctx.fillRect(x + 4, y + 9, 14, 2);
    // Cross shadow
    ctx.fillStyle = MEDIEVAL.goldDark;
    ctx.fillRect(x + 9, y + 18, 4, 1);
    ctx.fillRect(x + 17, y + 8, 1, 4);
    // Rim
    ctx.fillStyle = darken(metal, 0.15);
    ctx.fillRect(x + 2, y + 0, 18, 1);
    ctx.fillRect(x + 1, y + 1, 1, 12);
    ctx.fillRect(x + 20, y + 1, 1, 12);
  }

  private static drawBoots(ctx: CanvasRenderingContext2D, metal: string, hi: string): void {
    const x = 5, y = 3;
    // Shaft
    ctx.fillStyle = metal;
    ctx.fillRect(x + 6, y + 1, 8, 10);
    ctx.fillRect(x + 5, y + 3, 1, 8);
    // Shaft highlight
    ctx.fillStyle = hi;
    ctx.fillRect(x + 7, y + 1, 3, 8);
    ctx.fillRect(x + 6, y + 1, 8, 1);
    // Shaft shadow
    ctx.fillStyle = darken(metal, 0.25);
    ctx.fillRect(x + 13, y + 2, 1, 9);
    // Ankle/heel
    ctx.fillStyle = metal;
    ctx.fillRect(x + 4, y + 11, 12, 4);
    // Foot
    ctx.fillRect(x + 2, y + 15, 16, 4);
    ctx.fillRect(x + 1, y + 17, 18, 2);
    // Toe
    ctx.fillRect(x + 0, y + 16, 3, 3);
    // Foot highlight
    ctx.fillStyle = hi;
    ctx.fillRect(x + 2, y + 15, 14, 1);
    ctx.fillRect(x + 1, y + 16, 1, 2);
    // Sole
    ctx.fillStyle = '#222222';
    ctx.fillRect(x + 0, y + 19, 19, 2);
    ctx.fillRect(x + 1, y + 21, 17, 2);
    // Sole highlight edge
    ctx.fillStyle = '#333333';
    ctx.fillRect(x + 0, y + 19, 19, 1);
    // Buckle
    ctx.fillStyle = MEDIEVAL.gold;
    ctx.fillRect(x + 7, y + 11, 4, 3);
    ctx.fillStyle = MEDIEVAL.goldLight;
    ctx.fillRect(x + 8, y + 11, 2, 1);
    // Top trim
    ctx.fillStyle = darken(metal, 0.3);
    ctx.fillRect(x + 5, y + 0, 10, 1);
  }

  // ─── Skill Art ───

  private static drawSlash(ctx: CanvasRenderingContext2D, c1: string, c2: string): void {
    // Diagonal slash effect
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = c1;
      ctx.fillRect(6 + i, 4 + i * 1.8, 4, 3);
      ctx.fillStyle = c2;
      ctx.fillRect(7 + i, 4 + i * 1.8, 2, 2);
    }
    // Motion lines
    ctx.fillStyle = c2;
    ctx.fillRect(4, 8, 6, 1);
    ctx.fillRect(6, 14, 5, 1);
    ctx.fillRect(8, 20, 4, 1);
    // Sparkle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(18, 4, 2, 2);
    ctx.fillRect(19, 3, 1, 1);
    ctx.fillRect(19, 6, 1, 1);
  }

  private static drawStar(ctx: CanvasRenderingContext2D, c1: string, c2: string): void {
    const cx = 16, cy = 16;
    // Star rays (8 directions)
    ctx.fillStyle = c1;
    // Vertical
    ctx.fillRect(cx - 1, cy - 10, 2, 20);
    // Horizontal
    ctx.fillRect(cx - 10, cy - 1, 20, 2);
    // Diagonal
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(cx - 7 + i, cy - 7 + i, 2, 2);
      ctx.fillRect(cx + 5 - i, cy - 7 + i, 2, 2);
    }
    // Center glow
    ctx.fillStyle = c2;
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
    ctx.fillRect(cx - 2, cy - 4, 4, 8);
    ctx.fillRect(cx - 4, cy - 2, 8, 4);
    // Core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
    // Sparkle particles
    ctx.fillStyle = c2;
    ctx.fillRect(cx - 8, cy - 5, 1, 1);
    ctx.fillRect(cx + 7, cy + 4, 1, 1);
    ctx.fillRect(cx + 5, cy - 8, 1, 1);
    ctx.fillRect(cx - 6, cy + 7, 1, 1);
  }

  private static drawCross(ctx: CanvasRenderingContext2D, c1: string, c2: string): void {
    // Heal cross
    ctx.fillStyle = c1;
    ctx.fillRect(12, 4, 8, 24);
    ctx.fillRect(4, 10, 24, 12);
    // Inner highlight
    ctx.fillStyle = c2;
    ctx.fillRect(13, 6, 6, 20);
    ctx.fillRect(6, 11, 20, 10);
    // Center glow
    ctx.fillStyle = lighten(c2, 0.4);
    ctx.fillRect(14, 12, 4, 8);
    ctx.fillRect(10, 14, 12, 4);
    // Core sparkle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 15, 2, 2);
    // Corner sparkles
    ctx.fillRect(6, 6, 1, 1);
    ctx.fillRect(25, 6, 1, 1);
    ctx.fillRect(6, 25, 1, 1);
    ctx.fillRect(25, 25, 1, 1);
  }

  private static drawArrowUp(ctx: CanvasRenderingContext2D, c1: string, c2: string): void {
    // Upward arrow (buff)
    ctx.fillStyle = c1;
    // Shaft
    ctx.fillRect(13, 10, 6, 16);
    // Arrowhead
    ctx.fillRect(10, 10, 12, 3);
    ctx.fillRect(11, 8, 10, 3);
    ctx.fillRect(12, 6, 8, 3);
    ctx.fillRect(13, 4, 6, 3);
    ctx.fillRect(14, 3, 4, 2);
    ctx.fillRect(15, 2, 2, 2);
    // Inner glow
    ctx.fillStyle = c2;
    ctx.fillRect(14, 12, 4, 12);
    ctx.fillRect(13, 8, 6, 4);
    ctx.fillRect(14, 6, 4, 3);
    ctx.fillRect(15, 4, 2, 3);
    // Sparkle dots
    ctx.fillStyle = lighten(c2, 0.5);
    ctx.fillRect(7, 12, 2, 2);
    ctx.fillRect(23, 12, 2, 2);
    ctx.fillRect(9, 18, 1, 1);
    ctx.fillRect(22, 18, 1, 1);
    // Core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 8, 2, 2);
  }

  private static drawArrowDown(ctx: CanvasRenderingContext2D, c1: string, c2: string): void {
    // Downward arrow (debuff)
    ctx.fillStyle = c1;
    // Shaft
    ctx.fillRect(13, 4, 6, 16);
    // Arrowhead
    ctx.fillRect(10, 18, 12, 3);
    ctx.fillRect(11, 20, 10, 3);
    ctx.fillRect(12, 22, 8, 3);
    ctx.fillRect(13, 24, 6, 2);
    ctx.fillRect(14, 25, 4, 2);
    ctx.fillRect(15, 27, 2, 1);
    // Inner
    ctx.fillStyle = c2;
    ctx.fillRect(14, 6, 4, 14);
    ctx.fillRect(13, 20, 6, 3);
    ctx.fillRect(14, 22, 4, 3);
    ctx.fillRect(15, 25, 2, 2);
    // Sparkles
    ctx.fillStyle = darken(c1, 0.2);
    ctx.fillRect(7, 18, 2, 2);
    ctx.fillRect(23, 18, 2, 2);
  }

  private static drawDiamond(ctx: CanvasRenderingContext2D, c1: string, c2: string): void {
    // Diamond shape (special skill)
    ctx.fillStyle = c1;
    ctx.fillRect(14, 3, 4, 2);
    ctx.fillRect(12, 5, 8, 2);
    ctx.fillRect(10, 7, 12, 2);
    ctx.fillRect(8, 9, 16, 2);
    ctx.fillRect(6, 11, 20, 2);
    ctx.fillRect(4, 13, 24, 4);
    ctx.fillRect(6, 17, 20, 2);
    ctx.fillRect(8, 19, 16, 2);
    ctx.fillRect(10, 21, 12, 2);
    ctx.fillRect(12, 23, 8, 2);
    ctx.fillRect(14, 25, 4, 2);
    // Inner glow
    ctx.fillStyle = c2;
    ctx.fillRect(13, 8, 6, 2);
    ctx.fillRect(10, 10, 12, 2);
    ctx.fillRect(8, 12, 16, 4);
    ctx.fillRect(10, 16, 12, 2);
    ctx.fillRect(13, 18, 6, 2);
    // Core
    ctx.fillStyle = lighten(c2, 0.4);
    ctx.fillRect(13, 13, 6, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 14, 2, 2);
    // Sparkles
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(16, 4, 1, 1);
    ctx.fillRect(4, 14, 1, 1);
    ctx.fillRect(27, 14, 1, 1);
    ctx.fillRect(16, 26, 1, 1);
  }
}
