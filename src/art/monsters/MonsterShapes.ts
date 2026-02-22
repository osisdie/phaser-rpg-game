import { darken, lighten, varyColor } from '../palettes';

/** Base shape type for monster rendering */
export type MonsterShape =
  | 'slime' | 'bat' | 'wolf' | 'snake' | 'spider' | 'skeleton'
  | 'goblin' | 'ghost' | 'elemental' | 'gargoyle' | 'dragon'
  | 'insect' | 'fish' | 'bird' | 'bear' | 'turtle' | 'crab' | 'plant';

/** Monster visual config */
export interface MonsterVisual {
  shape: MonsterShape;
  baseColor: string;
  accentColor: string;
  size: number; // multiplier (1 = 32px, 2 = 64px for bosses)
  features?: string[]; // optional decorations: 'horns', 'wings', 'crown', 'ice', 'fire', 'poison'
}

/** Draw a monster shape on canvas at the given offset */
export function drawMonsterShape(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number, // offset in canvas
  w: number, h: number,   // bounding box
  visual: MonsterVisual,
): void {
  const { shape, baseColor, accentColor } = visual;

  switch (shape) {
    case 'slime': drawSlime(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'bat': drawBat(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'wolf': drawWolf(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'snake': drawSnake(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'spider': drawSpider(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'skeleton': drawSkeleton(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'goblin': drawGoblin(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'ghost': drawGhost(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'elemental': drawElemental(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'gargoyle': drawGargoyle(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'dragon': drawDragon(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'insect': drawInsect(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'fish': drawFish(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'bird': drawBird(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'bear': drawBear(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'turtle': drawTurtle(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'crab': drawCrab(ctx, ox, oy, w, h, baseColor, accentColor); break;
    case 'plant': drawPlant(ctx, ox, oy, w, h, baseColor, accentColor); break;
  }

  // Feature decorations
  if (visual.features) {
    for (const feat of visual.features) {
      drawFeature(ctx, ox, oy, w, h, feat, accentColor);
    }
  }
}

// ─── Individual shape drawing functions ─────────────────────────────

function drawSlime(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  // Blob body
  const cx = ox + w / 2, cy = oy + h * 0.6;
  ctx.fillStyle = base;
  // Bottom oval
  fillOval(ctx, cx - w * 0.4, cy - h * 0.2, w * 0.8, h * 0.45);
  // Top dome
  fillOval(ctx, cx - w * 0.3, cy - h * 0.4, w * 0.6, h * 0.35);
  // Highlight
  ctx.fillStyle = lighten(base, 0.3);
  ctx.fillRect(Math.round(cx - w * 0.15), Math.round(cy - h * 0.3), Math.max(2, w * 0.12), Math.max(2, h * 0.1));
  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(cx - w * 0.15), Math.round(cy - h * 0.15), Math.max(2, w * 0.1), Math.max(2, h * 0.1));
  ctx.fillRect(Math.round(cx + w * 0.05), Math.round(cy - h * 0.15), Math.max(2, w * 0.1), Math.max(2, h * 0.1));
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.round(cx - w * 0.12), Math.round(cy - h * 0.12), Math.max(1, w * 0.06), Math.max(1, h * 0.06));
  ctx.fillRect(Math.round(cx + w * 0.08), Math.round(cy - h * 0.12), Math.max(1, w * 0.06), Math.max(1, h * 0.06));
}

function drawBat(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h / 2;
  // Body
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.15, cy - h * 0.15, w * 0.3, h * 0.35);
  // Wings
  ctx.fillStyle = darken(base, 0.1);
  // Left wing
  fillTriangle(ctx, cx - w * 0.1, cy, cx - w * 0.45, cy - h * 0.3, cx - w * 0.4, cy + h * 0.1);
  // Right wing
  fillTriangle(ctx, cx + w * 0.1, cy, cx + w * 0.45, cy - h * 0.3, cx + w * 0.4, cy + h * 0.1);
  // Eyes
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx - w * 0.08), Math.round(cy - h * 0.1), 2, 2);
  ctx.fillRect(Math.round(cx + w * 0.04), Math.round(cy - h * 0.1), 2, 2);
  // Ears
  ctx.fillStyle = base;
  fillTriangle(ctx, cx - w * 0.1, cy - h * 0.15, cx - w * 0.15, cy - h * 0.35, cx - w * 0.02, cy - h * 0.2);
  fillTriangle(ctx, cx + w * 0.1, cy - h * 0.15, cx + w * 0.15, cy - h * 0.35, cx + w * 0.02, cy - h * 0.2);
}

function drawWolf(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;
  // Body
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.35, oy + h * 0.3, w * 0.5, h * 0.35);
  // Head
  fillOval(ctx, cx + w * 0.05, oy + h * 0.15, w * 0.3, h * 0.3);
  // Snout
  ctx.fillStyle = lighten(base, 0.15);
  ctx.fillRect(Math.round(cx + w * 0.3), Math.round(oy + h * 0.3), Math.max(2, w * 0.12), Math.max(2, h * 0.1));
  // Ears
  ctx.fillStyle = darken(base, 0.1);
  fillTriangle(ctx, cx + w * 0.1, oy + h * 0.18, cx + w * 0.07, oy + h * 0.05, cx + w * 0.17, oy + h * 0.08);
  fillTriangle(ctx, cx + w * 0.25, oy + h * 0.18, cx + w * 0.22, oy + h * 0.05, cx + w * 0.32, oy + h * 0.08);
  // Legs
  ctx.fillStyle = darken(base, 0.1);
  ctx.fillRect(Math.round(cx - w * 0.25), Math.round(oy + h * 0.6), 3, Math.max(3, h * 0.2));
  ctx.fillRect(Math.round(cx - w * 0.05), Math.round(oy + h * 0.6), 3, Math.max(3, h * 0.2));
  ctx.fillRect(Math.round(cx + w * 0.1), Math.round(oy + h * 0.55), 3, Math.max(3, h * 0.25));
  // Eye
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx + w * 0.2), Math.round(oy + h * 0.22), 2, 2);
  // Tail
  ctx.fillStyle = base;
  ctx.fillRect(Math.round(cx - w * 0.4), Math.round(oy + h * 0.3), Math.max(2, w * 0.1), 3);
}

function drawSnake(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  ctx.fillStyle = base;
  // Coiled body
  for (let i = 0; i < 8; i++) {
    const sx = ox + w * 0.3 + Math.sin(i * 0.8) * w * 0.2;
    const sy = oy + h * 0.3 + i * h * 0.07;
    ctx.fillRect(Math.round(sx), Math.round(sy), Math.max(3, w * 0.25), Math.max(3, h * 0.1));
  }
  // Head (raised)
  ctx.fillStyle = darken(base, 0.1);
  fillOval(ctx, ox + w * 0.35, oy + h * 0.1, w * 0.25, h * 0.2);
  // Eyes
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(ox + w * 0.42), Math.round(oy + h * 0.15), 2, 2);
  // Tongue
  ctx.fillStyle = '#cc2222';
  ctx.fillRect(Math.round(ox + w * 0.55), Math.round(oy + h * 0.22), 3, 1);
  // Pattern
  ctx.fillStyle = darken(base, 0.2);
  for (let i = 1; i < 7; i += 2) {
    const sx = ox + w * 0.35 + Math.sin(i * 0.8) * w * 0.2;
    const sy = oy + h * 0.32 + i * h * 0.07;
    ctx.fillRect(Math.round(sx + w * 0.05), Math.round(sy), 2, 2);
  }
}

function drawSpider(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h / 2;
  // Body
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.15, cy, w * 0.3, h * 0.25);
  fillOval(ctx, cx - w * 0.1, cy - h * 0.2, w * 0.2, h * 0.2);
  // Legs (4 each side)
  ctx.fillStyle = darken(base, 0.1);
  for (let i = 0; i < 4; i++) {
    const ly = cy - h * 0.05 + i * h * 0.08;
    ctx.fillRect(Math.round(cx - w * 0.45), Math.round(ly), Math.max(3, w * 0.35), 1);
    ctx.fillRect(Math.round(cx + w * 0.1), Math.round(ly), Math.max(3, w * 0.35), 1);
  }
  // Eyes
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx - w * 0.06), Math.round(cy - h * 0.18), 2, 2);
  ctx.fillRect(Math.round(cx + w * 0.02), Math.round(cy - h * 0.18), 2, 2);
}

function drawSkeleton(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;
  // Skull
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.15, oy + h * 0.05, w * 0.3, h * 0.25);
  // Eye sockets
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.round(cx - w * 0.1), Math.round(oy + h * 0.12), 2, 2);
  ctx.fillRect(Math.round(cx + w * 0.04), Math.round(oy + h * 0.12), 2, 2);
  // Jaw
  ctx.fillStyle = darken(base, 0.1);
  ctx.fillRect(Math.round(cx - w * 0.1), Math.round(oy + h * 0.22), Math.max(3, w * 0.2), 2);
  // Ribcage
  ctx.fillStyle = base;
  for (let i = 0; i < 3; i++) {
    const ry = oy + h * 0.32 + i * h * 0.08;
    ctx.fillRect(Math.round(cx - w * 0.12), Math.round(ry), Math.max(3, w * 0.24), 2);
  }
  // Spine
  ctx.fillRect(Math.round(cx - 1), Math.round(oy + h * 0.28), 2, Math.max(4, h * 0.3));
  // Legs
  ctx.fillRect(Math.round(cx - w * 0.1), Math.round(oy + h * 0.58), 2, Math.max(3, h * 0.25));
  ctx.fillRect(Math.round(cx + w * 0.06), Math.round(oy + h * 0.58), 2, Math.max(3, h * 0.25));
  // Weapon
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx + w * 0.2), Math.round(oy + h * 0.2), 2, Math.max(4, h * 0.4));
}

function drawGoblin(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;
  // Body
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.2, oy + h * 0.35, w * 0.4, h * 0.3);
  // Head (big)
  fillOval(ctx, cx - w * 0.2, oy + h * 0.1, w * 0.4, h * 0.3);
  // Ears (pointy)
  fillTriangle(ctx, cx - w * 0.2, oy + h * 0.2, cx - w * 0.4, oy + h * 0.15, cx - w * 0.15, oy + h * 0.25);
  fillTriangle(ctx, cx + w * 0.2, oy + h * 0.2, cx + w * 0.4, oy + h * 0.15, cx + w * 0.15, oy + h * 0.25);
  // Eyes
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx - w * 0.1), Math.round(oy + h * 0.2), 2, 2);
  ctx.fillRect(Math.round(cx + w * 0.06), Math.round(oy + h * 0.2), 2, 2);
  // Nose
  ctx.fillStyle = darken(base, 0.15);
  ctx.fillRect(Math.round(cx), Math.round(oy + h * 0.26), 2, 2);
  // Legs
  ctx.fillStyle = darken(base, 0.1);
  ctx.fillRect(Math.round(cx - w * 0.12), Math.round(oy + h * 0.6), 3, Math.max(3, h * 0.2));
  ctx.fillRect(Math.round(cx + w * 0.06), Math.round(oy + h * 0.6), 3, Math.max(3, h * 0.2));
}

function drawGhost(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;
  // Translucent body
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.25, oy + h * 0.1, w * 0.5, h * 0.4);
  ctx.fillRect(Math.round(cx - w * 0.25), Math.round(oy + h * 0.3), Math.max(3, w * 0.5), Math.max(4, h * 0.4));
  // Wavy bottom
  for (let i = 0; i < 4; i++) {
    const bx = cx - w * 0.25 + i * w * 0.15;
    const wave = (i % 2 === 0) ? 0 : h * 0.06;
    ctx.fillRect(Math.round(bx), Math.round(oy + h * 0.65 + wave), Math.max(2, w * 0.12), Math.max(2, h * 0.08));
  }
  ctx.globalAlpha = 1;
  // Eyes
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx - w * 0.1), Math.round(oy + h * 0.25), 3, 3);
  ctx.fillRect(Math.round(cx + w * 0.05), Math.round(oy + h * 0.25), 3, 3);
  // Mouth
  ctx.fillStyle = '#000000';
  fillOval(ctx, cx - w * 0.06, oy + h * 0.38, w * 0.12, h * 0.08);
}

function drawElemental(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;
  // Swirling body
  ctx.fillStyle = base;
  for (let i = 0; i < 6; i++) {
    const r = w * 0.15 + i * w * 0.03;
    const ex = cx + Math.sin(i * 1.2) * w * 0.1;
    const ey = oy + h * 0.2 + i * h * 0.1;
    fillOval(ctx, ex - r, ey, r * 2, h * 0.12);
  }
  // Core glow
  ctx.fillStyle = accent;
  fillOval(ctx, cx - w * 0.1, oy + h * 0.3, w * 0.2, h * 0.15);
  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(cx - w * 0.08), Math.round(oy + h * 0.28), 2, 2);
  ctx.fillRect(Math.round(cx + w * 0.04), Math.round(oy + h * 0.28), 2, 2);
}

function drawGargoyle(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;
  // Body
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.2, oy + h * 0.3, w * 0.4, h * 0.35);
  // Head
  fillOval(ctx, cx - w * 0.15, oy + h * 0.1, w * 0.3, h * 0.25);
  // Horns
  ctx.fillStyle = darken(base, 0.2);
  fillTriangle(ctx, cx - w * 0.12, oy + h * 0.12, cx - w * 0.2, oy, cx - w * 0.05, oy + h * 0.08);
  fillTriangle(ctx, cx + w * 0.12, oy + h * 0.12, cx + w * 0.2, oy, cx + w * 0.05, oy + h * 0.08);
  // Wings
  ctx.fillStyle = darken(base, 0.1);
  fillTriangle(ctx, cx - w * 0.2, oy + h * 0.35, cx - w * 0.45, oy + h * 0.15, cx - w * 0.4, oy + h * 0.5);
  fillTriangle(ctx, cx + w * 0.2, oy + h * 0.35, cx + w * 0.45, oy + h * 0.15, cx + w * 0.4, oy + h * 0.5);
  // Eyes
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx - w * 0.08), Math.round(oy + h * 0.18), 2, 2);
  ctx.fillRect(Math.round(cx + w * 0.04), Math.round(oy + h * 0.18), 2, 2);
  // Legs
  ctx.fillStyle = darken(base, 0.1);
  ctx.fillRect(Math.round(cx - w * 0.12), Math.round(oy + h * 0.6), 3, Math.max(3, h * 0.2));
  ctx.fillRect(Math.round(cx + w * 0.06), Math.round(oy + h * 0.6), 3, Math.max(3, h * 0.2));
}

function drawDragon(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;
  // Body
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.3, oy + h * 0.3, w * 0.5, h * 0.35);
  // Long neck + head
  ctx.fillRect(Math.round(cx + w * 0.05), Math.round(oy + h * 0.15), Math.max(3, w * 0.12), Math.max(4, h * 0.25));
  fillOval(ctx, cx + w * 0.05, oy + h * 0.05, w * 0.25, h * 0.18);
  // Horns
  ctx.fillStyle = darken(base, 0.2);
  fillTriangle(ctx, cx + w * 0.1, oy + h * 0.08, cx + w * 0.05, oy - h * 0.05, cx + w * 0.15, oy);
  fillTriangle(ctx, cx + w * 0.22, oy + h * 0.08, cx + w * 0.2, oy - h * 0.05, cx + w * 0.3, oy);
  // Wings
  ctx.fillStyle = darken(base, 0.1);
  fillTriangle(ctx, cx - w * 0.1, oy + h * 0.3, cx - w * 0.4, oy + h * 0.05, cx - w * 0.35, oy + h * 0.5);
  fillTriangle(ctx, cx + w * 0.05, oy + h * 0.3, cx + w * 0.4, oy + h * 0.05, cx + w * 0.35, oy + h * 0.5);
  // Eye
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx + w * 0.18), Math.round(oy + h * 0.1), 2, 2);
  // Tail
  ctx.fillStyle = base;
  ctx.fillRect(Math.round(cx - w * 0.35), Math.round(oy + h * 0.45), Math.max(3, w * 0.15), 3);
  ctx.fillRect(Math.round(cx - w * 0.45), Math.round(oy + h * 0.43), Math.max(2, w * 0.1), 3);
  // Legs
  ctx.fillStyle = darken(base, 0.1);
  ctx.fillRect(Math.round(cx - w * 0.15), Math.round(oy + h * 0.6), 3, Math.max(3, h * 0.2));
  ctx.fillRect(Math.round(cx + w * 0.08), Math.round(oy + h * 0.58), 3, Math.max(3, h * 0.22));
  // Belly highlight
  ctx.fillStyle = lighten(base, 0.2);
  fillOval(ctx, cx - w * 0.15, oy + h * 0.4, w * 0.25, h * 0.15);
}

function drawInsect(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h / 2;
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.15, cy - h * 0.05, w * 0.3, h * 0.3);
  fillOval(ctx, cx - w * 0.1, cy - h * 0.25, w * 0.2, h * 0.2);
  // Wings
  ctx.fillStyle = lighten(base, 0.3);
  ctx.globalAlpha = 0.5;
  fillOval(ctx, cx - w * 0.35, cy - h * 0.25, w * 0.25, h * 0.2);
  fillOval(ctx, cx + w * 0.1, cy - h * 0.25, w * 0.25, h * 0.2);
  ctx.globalAlpha = 1;
  // Legs
  ctx.fillStyle = darken(base, 0.15);
  for (let i = 0; i < 3; i++) {
    const ly = cy + i * h * 0.06;
    ctx.fillRect(Math.round(cx - w * 0.35), Math.round(ly), Math.max(3, w * 0.25), 1);
    ctx.fillRect(Math.round(cx + w * 0.1), Math.round(ly), Math.max(3, w * 0.25), 1);
  }
  // Eyes
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx - w * 0.06), Math.round(cy - h * 0.22), 2, 2);
  ctx.fillRect(Math.round(cx + w * 0.02), Math.round(cy - h * 0.22), 2, 2);
}

function drawFish(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h / 2;
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.3, cy - h * 0.15, w * 0.55, h * 0.3);
  // Tail
  fillTriangle(ctx, cx - w * 0.3, cy, cx - w * 0.45, cy - h * 0.2, cx - w * 0.45, cy + h * 0.2);
  // Fin
  ctx.fillStyle = darken(base, 0.1);
  fillTriangle(ctx, cx, cy - h * 0.15, cx - w * 0.05, cy - h * 0.3, cx + w * 0.1, cy - h * 0.15);
  // Eye
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(cx + w * 0.1), Math.round(cy - h * 0.05), 3, 3);
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.round(cx + w * 0.12), Math.round(cy - h * 0.03), 1, 1);
  // Scales pattern
  ctx.fillStyle = lighten(base, 0.1);
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(Math.round(cx - w * 0.1 + i * w * 0.08), Math.round(cy - h * 0.03), 2, 2);
  }
}

function drawBird(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h * 0.4;
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.12, cy, w * 0.24, h * 0.25);
  fillOval(ctx, cx - w * 0.1, cy - h * 0.15, w * 0.2, h * 0.18);
  // Wings
  ctx.fillStyle = darken(base, 0.1);
  fillTriangle(ctx, cx - w * 0.1, cy + h * 0.05, cx - w * 0.45, cy - h * 0.1, cx - w * 0.3, cy + h * 0.15);
  fillTriangle(ctx, cx + w * 0.1, cy + h * 0.05, cx + w * 0.45, cy - h * 0.1, cx + w * 0.3, cy + h * 0.15);
  // Beak
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx + w * 0.08), Math.round(cy - h * 0.08), 3, 2);
  // Eye
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.round(cx + w * 0.02), Math.round(cy - h * 0.1), 2, 2);
  // Tail feathers
  ctx.fillStyle = darken(base, 0.15);
  ctx.fillRect(Math.round(cx - w * 0.15), Math.round(cy + h * 0.18), Math.max(3, w * 0.15), 3);
}

function drawBear(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.3, oy + h * 0.25, w * 0.6, h * 0.4);
  fillOval(ctx, cx - w * 0.15, oy + h * 0.08, w * 0.35, h * 0.25);
  // Ears
  fillOval(ctx, cx - w * 0.18, oy + h * 0.05, w * 0.1, h * 0.1);
  fillOval(ctx, cx + w * 0.1, oy + h * 0.05, w * 0.1, h * 0.1);
  // Snout
  ctx.fillStyle = lighten(base, 0.15);
  fillOval(ctx, cx + w * 0.02, oy + h * 0.2, w * 0.15, h * 0.1);
  // Nose
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.round(cx + w * 0.07), Math.round(oy + h * 0.22), 2, 2);
  // Eyes
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.round(cx - w * 0.06), Math.round(oy + h * 0.16), 2, 2);
  ctx.fillRect(Math.round(cx + w * 0.1), Math.round(oy + h * 0.16), 2, 2);
  // Legs
  ctx.fillStyle = darken(base, 0.15);
  ctx.fillRect(Math.round(cx - w * 0.22), Math.round(oy + h * 0.6), 4, Math.max(4, h * 0.2));
  ctx.fillRect(Math.round(cx + w * 0.1), Math.round(oy + h * 0.58), 4, Math.max(4, h * 0.22));
}

function drawTurtle(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h * 0.5;
  // Shell
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.3, cy - h * 0.15, w * 0.6, h * 0.35);
  // Shell pattern
  ctx.fillStyle = darken(base, 0.15);
  ctx.fillRect(Math.round(cx - 1), Math.round(cy - h * 0.1), 2, Math.max(3, h * 0.2));
  ctx.fillRect(Math.round(cx - w * 0.2), Math.round(cy), Math.max(3, w * 0.4), 2);
  // Head
  ctx.fillStyle = accent;
  fillOval(ctx, cx + w * 0.2, cy - h * 0.1, w * 0.15, h * 0.12);
  // Eye
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.round(cx + w * 0.3), Math.round(cy - h * 0.06), 1, 1);
  // Legs
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx - w * 0.2), Math.round(cy + h * 0.15), 3, Math.max(2, h * 0.1));
  ctx.fillRect(Math.round(cx + w * 0.15), Math.round(cy + h * 0.15), 3, Math.max(2, h * 0.1));
}

function drawCrab(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h * 0.5;
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.2, cy - h * 0.1, w * 0.4, h * 0.25);
  // Claws
  ctx.fillStyle = darken(base, 0.1);
  fillOval(ctx, cx - w * 0.4, cy - h * 0.2, w * 0.15, h * 0.15);
  fillOval(ctx, cx + w * 0.25, cy - h * 0.2, w * 0.15, h * 0.15);
  // Arms to claws
  ctx.fillRect(Math.round(cx - w * 0.3), Math.round(cy - h * 0.1), Math.max(2, w * 0.12), 2);
  ctx.fillRect(Math.round(cx + w * 0.18), Math.round(cy - h * 0.1), Math.max(2, w * 0.12), 2);
  // Legs
  for (let i = 0; i < 3; i++) {
    const lx = cx - w * 0.15 + i * w * 0.1;
    ctx.fillRect(Math.round(lx), Math.round(cy + h * 0.1), 2, Math.max(2, h * 0.12));
  }
  // Eyes
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx - w * 0.06), Math.round(cy - h * 0.15), 2, 3);
  ctx.fillRect(Math.round(cx + w * 0.04), Math.round(cy - h * 0.15), 2, 3);
}

function drawPlant(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;
  // Stem
  ctx.fillStyle = darken(base, 0.2);
  ctx.fillRect(Math.round(cx - 1), Math.round(oy + h * 0.3), 3, Math.max(4, h * 0.5));
  // Leaves
  ctx.fillStyle = base;
  fillOval(ctx, cx - w * 0.3, oy + h * 0.2, w * 0.25, h * 0.2);
  fillOval(ctx, cx + w * 0.05, oy + h * 0.15, w * 0.25, h * 0.2);
  fillOval(ctx, cx - w * 0.2, oy + h * 0.4, w * 0.2, h * 0.15);
  fillOval(ctx, cx + w * 0.05, oy + h * 0.38, w * 0.2, h * 0.15);
  // Flower/eye
  ctx.fillStyle = accent;
  fillOval(ctx, cx - w * 0.08, oy + h * 0.05, w * 0.16, h * 0.15);
  // Eye dots
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.round(cx - w * 0.04), Math.round(oy + h * 0.1), 2, 2);
  ctx.fillRect(Math.round(cx + w * 0.02), Math.round(oy + h * 0.1), 2, 2);
  // Roots
  ctx.fillStyle = darken(base, 0.3);
  ctx.fillRect(Math.round(cx - w * 0.1), Math.round(oy + h * 0.75), Math.max(3, w * 0.2), 2);
}

// ─── Feature overlays ──────────────────────────────────────────────

function drawFeature(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, feat: string, accent: string): void {
  if (feat === 'horns') {
    ctx.fillStyle = darken(accent, 0.3);
    fillTriangle(ctx, ox + w * 0.2, oy + h * 0.15, ox + w * 0.1, oy - h * 0.05, ox + w * 0.25, oy + h * 0.05);
    fillTriangle(ctx, ox + w * 0.7, oy + h * 0.15, ox + w * 0.75, oy - h * 0.05, ox + w * 0.85, oy + h * 0.05);
  } else if (feat === 'crown') {
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(Math.round(ox + w * 0.2), Math.round(oy + h * 0.02), Math.max(3, w * 0.6), 3);
    ctx.fillRect(Math.round(ox + w * 0.25), Math.round(oy - h * 0.02), 2, 3);
    ctx.fillRect(Math.round(ox + w * 0.45), Math.round(oy - h * 0.05), 2, 5);
    ctx.fillRect(Math.round(ox + w * 0.65), Math.round(oy - h * 0.02), 2, 3);
  } else if (feat === 'ice') {
    ctx.fillStyle = '#aaddff';
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 4; i++) {
      const ix = ox + Math.random() * w;
      const iy = oy + Math.random() * h;
      ctx.fillRect(Math.round(ix), Math.round(iy), 2, 3);
    }
    ctx.globalAlpha = 1;
  } else if (feat === 'fire') {
    ctx.fillStyle = '#ff6622';
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 3; i++) {
      const fx = ox + w * 0.3 + Math.random() * w * 0.4;
      const fy = oy + h * 0.1 + Math.random() * h * 0.3;
      ctx.fillRect(Math.round(fx), Math.round(fy), 2, 3);
      ctx.fillStyle = '#ffaa22';
      ctx.fillRect(Math.round(fx), Math.round(fy - 2), 1, 2);
    }
    ctx.globalAlpha = 1;
  } else if (feat === 'poison') {
    ctx.fillStyle = '#88ff44';
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 5; i++) {
      const px = ox + Math.random() * w;
      const py = oy + h * 0.5 + Math.random() * h * 0.4;
      ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}

// ─── Canvas shape helpers ───────────────────────────────────────────

function fillOval(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // Pixel-art oval using rectangles (no anti-aliasing)
  const cx = x + w / 2, cy = y + h / 2;
  const rx = w / 2, ry = h / 2;
  for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
    const dy = (py + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const dx = Math.sqrt(1 - dy * dy) * rx;
    const x1 = Math.round(cx - dx);
    const x2 = Math.round(cx + dx);
    ctx.fillRect(x1, py, Math.max(1, x2 - x1), 1);
  }
}

function fillTriangle(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
  // Simple triangle fill using scanline
  const minY = Math.floor(Math.min(y1, y2, y3));
  const maxY = Math.ceil(Math.max(y1, y2, y3));
  const edges = [[x1, y1, x2, y2], [x2, y2, x3, y3], [x3, y3, x1, y1]];

  for (let y = minY; y <= maxY; y++) {
    let minX = Infinity, maxX = -Infinity;
    for (const [ex1, ey1, ex2, ey2] of edges) {
      if ((ey1 <= y && ey2 > y) || (ey2 <= y && ey1 > y)) {
        const t = (y - ey1) / (ey2 - ey1);
        const ix = ex1 + t * (ex2 - ex1);
        minX = Math.min(minX, ix);
        maxX = Math.max(maxX, ix);
      }
    }
    if (minX <= maxX) {
      ctx.fillRect(Math.round(minX), y, Math.max(1, Math.round(maxX - minX)), 1);
    }
  }
}
