import { darken, lighten } from '../palettes';
import {
  fillGradientOval,
  fillGradientTriangle,
  fillGradientRect,
  addHighlight,
  drawEye,
  drawTexture,
} from '../utils/PixelArtUtils';

/** Base shape type for monster rendering */
export type MonsterShape =
  | 'slime' | 'bat' | 'wolf' | 'snake' | 'spider' | 'skeleton'
  | 'goblin' | 'ghost' | 'elemental' | 'gargoyle' | 'dragon'
  | 'insect' | 'fish' | 'bird' | 'bear' | 'turtle' | 'crab' | 'plant';

/** Shapes whose heads/eyes face RIGHT in canvas space — need flipX in diagonal battle layout */
export const RIGHT_FACING_SHAPES = new Set<MonsterShape>([
  'wolf', 'dragon', 'fish', 'bird', 'turtle',
]);

/** Monster visual config */
export interface MonsterVisual {
  shape: MonsterShape;
  baseColor: string;
  accentColor: string;
  size: number; // multiplier (1 = 32px, 2 = 64px for bosses)
  features?: string[]; // optional decorations: 'horns', 'wings', 'crown', 'ice', 'fire', 'poison'
  /** Slime appearance variant (0–2) for visual variety */
  slimeVariant?: number;
}

/** Draw a monster shape on canvas at the given offset */
export function drawMonsterShape(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number,
  w: number, h: number,
  visual: MonsterVisual,
): void {
  const { shape, baseColor, accentColor } = visual;

  switch (shape) {
    case 'slime': drawSlime(ctx, ox, oy, w, h, baseColor, accentColor, visual.slimeVariant ?? 0); break;
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

function drawSlime(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string, variant: number = 0): void {
  const cx = ox + w / 2;
  // Pudgy dome — 矮胖型 (short & fat, not teardrop)
  const bodyTop = oy + h * 0.22;
  const bodyBot = oy + h * 0.92;
  const bodyH = bodyBot - bodyTop;
  const maxR = w * 0.46;

  const eyeHalf = variant === 0 ? 0.11 : variant === 1 ? 0.095 : 0.13;
  const hlOffsetX = variant === 0 ? 0.28 : variant === 1 ? 0.22 : 0.32;
  const hlOffsetY = variant === 0 ? 0.18 : variant === 1 ? 0.22 : 0.15;
  const mouthW = variant === 0 ? 0.12 : variant === 1 ? 0.1 : 0.14;

  // Scanline pudgy dome body
  for (let py = Math.floor(bodyTop); py <= Math.ceil(bodyBot); py++) {
    const t = (py - bodyTop) / bodyH;
    let r: number;
    if (t < 0.05) {
      // Tiny tip at very top
      r = maxR * 0.08 + maxR * 0.12 * (t / 0.05);
    } else if (t < 0.3) {
      // Rapid dome expansion (sqrt curve for rounded top)
      const dt = (t - 0.05) / 0.25;
      r = maxR * (0.2 + 0.8 * Math.pow(dt, 0.45));
    } else if (t < 0.88) {
      // Wide belly — full width
      r = maxR;
    } else {
      // Bottom — very gentle inward curve
      const bt = (t - 0.88) / 0.12;
      r = maxR * (1 - bt * 0.06);
    }
    if (r < 0.5) continue;

    // Enhanced gradient: 3-zone shading (highlight → base → shadow)
    let shade: string;
    if (t < 0.25) {
      shade = lighten(base, 0.2 * (1 - t / 0.25));
    } else if (t < 0.6) {
      shade = base;
    } else {
      shade = darken(base, 0.15 * ((t - 0.6) / 0.4));
    }

    // Horizontal sub-gradient: lighter in center, darker at edges
    const x1 = Math.round(cx - r);
    const rw = Math.max(1, Math.round(r * 2));
    if (rw > 4) {
      const hGrad = ctx.createLinearGradient(x1, py, x1 + rw, py);
      hGrad.addColorStop(0, darken(shade, 0.12));
      hGrad.addColorStop(0.3, shade);
      hGrad.addColorStop(0.5, lighten(shade, 0.05));
      hGrad.addColorStop(0.7, shade);
      hGrad.addColorStop(1, darken(shade, 0.12));
      ctx.fillStyle = hGrad;
    } else {
      ctx.fillStyle = shade;
    }
    ctx.fillRect(x1, py, rw, 1);

    // Dark outline edges
    if (r > 3) {
      ctx.fillStyle = darken(base, 0.35);
      ctx.fillRect(x1, py, 1, 1);
      ctx.fillRect(x1 + rw - 1, py, 1, 1);
    }
  }

  // Top outline (tiny tip)
  ctx.fillStyle = darken(base, 0.35);
  const topPx = Math.round(bodyTop + bodyH * 0.01);
  ctx.fillRect(Math.round(cx), topPx, 1, 2);

  // Specular highlight (larger for pudgy body)
  const hlX = cx - maxR * hlOffsetX;
  const hlY = bodyTop + bodyH * hlOffsetY;
  addHighlight(ctx, hlX, hlY, w * 0.14, 0.55);
  // Small bright dot inside highlight
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(Math.round(hlX - w * 0.015), Math.round(hlY - h * 0.015), Math.max(2, w * 0.04), Math.max(2, h * 0.03));

  // Eyes — in the wide belly zone
  const eyeY = bodyTop + bodyH * 0.48;
  const eyeL = cx - w * eyeHalf;
  const eyeR = cx + w * eyeHalf;
  const eyeSize = w * 0.1;
  drawEye(ctx, eyeL, eyeY, eyeSize);
  drawEye(ctx, eyeR, eyeY, eyeSize);

  // Mouth (curved smile)
  ctx.fillStyle = darken(base, 0.35);
  const mouthY = eyeY + h * 0.1;
  const mw = w * mouthW;
  ctx.fillRect(Math.round(cx - mw / 2), Math.round(mouthY), Math.max(2, Math.round(mw)), 1);
  ctx.fillRect(Math.round(cx - mw / 2 - 1), Math.round(mouthY - 1), 1, 1);
  ctx.fillRect(Math.round(cx + mw / 2), Math.round(mouthY - 1), 1, 1);
}

function drawBat(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h / 2;

  // Wings (drawn first, behind body)
  const wingColor = darken(base, 0.1);
  // Left wing — multi-segment for membrane look
  fillGradientTriangle(ctx, cx - w * 0.1, cy, cx - w * 0.45, cy - h * 0.3, cx - w * 0.4, cy + h * 0.1, wingColor);
  fillGradientTriangle(ctx, cx - w * 0.3, cy - h * 0.15, cx - w * 0.42, cy - h * 0.35, cx - w * 0.45, cy - h * 0.1, darken(wingColor, 0.05));
  // Right wing
  fillGradientTriangle(ctx, cx + w * 0.1, cy, cx + w * 0.45, cy - h * 0.3, cx + w * 0.4, cy + h * 0.1, wingColor);
  fillGradientTriangle(ctx, cx + w * 0.3, cy - h * 0.15, cx + w * 0.42, cy - h * 0.35, cx + w * 0.45, cy - h * 0.1, darken(wingColor, 0.05));

  // Wing membrane lines
  ctx.strokeStyle = darken(base, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.1, cy); ctx.lineTo(cx - w * 0.42, cy - h * 0.28);
  ctx.moveTo(cx - w * 0.1, cy); ctx.lineTo(cx - w * 0.38, cy + h * 0.05);
  ctx.moveTo(cx + w * 0.1, cy); ctx.lineTo(cx + w * 0.42, cy - h * 0.28);
  ctx.moveTo(cx + w * 0.1, cy); ctx.lineTo(cx + w * 0.38, cy + h * 0.05);
  ctx.stroke();

  // Body
  fillGradientOval(ctx, cx - w * 0.15, cy - h * 0.15, w * 0.3, h * 0.35, base);

  // Fur texture on body
  drawTexture(ctx, cx - w * 0.12, cy - h * 0.1, w * 0.24, h * 0.25, 'fur', base, 0.4);

  // Ears (pointy)
  fillGradientTriangle(ctx, cx - w * 0.1, cy - h * 0.15, cx - w * 0.15, cy - h * 0.35, cx - w * 0.02, cy - h * 0.2, base);
  fillGradientTriangle(ctx, cx + w * 0.1, cy - h * 0.15, cx + w * 0.15, cy - h * 0.35, cx + w * 0.02, cy - h * 0.2, base);

  // Inner ear
  ctx.fillStyle = lighten(base, 0.2);
  ctx.fillRect(Math.round(cx - w * 0.1), Math.round(cy - h * 0.28), 2, 3);
  ctx.fillRect(Math.round(cx + w * 0.07), Math.round(cy - h * 0.28), 2, 3);

  // Eyes (glowing)
  drawEye(ctx, cx - w * 0.06, cy - h * 0.06, w * 0.07, accent, accent);
  drawEye(ctx, cx + w * 0.06, cy - h * 0.06, w * 0.07, accent, accent);

  // Small fangs
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(cx - w * 0.04), Math.round(cy + h * 0.05), 1, Math.max(2, h * 0.05));
  ctx.fillRect(Math.round(cx + w * 0.03), Math.round(cy + h * 0.05), 1, Math.max(2, h * 0.05));

  addHighlight(ctx, cx - w * 0.05, cy - h * 0.08, w * 0.06, 0.3);
}

function drawWolf(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;

  // Tail
  fillGradientRect(ctx, cx - w * 0.42, oy + h * 0.28, w * 0.12, h * 0.06, base);
  fillGradientRect(ctx, cx - w * 0.45, oy + h * 0.22, w * 0.08, h * 0.08, lighten(base, 0.1));

  // Body
  fillGradientOval(ctx, cx - w * 0.35, oy + h * 0.3, w * 0.5, h * 0.35, base);
  // Belly highlight
  fillGradientOval(ctx, cx - w * 0.2, oy + h * 0.4, w * 0.3, h * 0.18, lighten(base, 0.18), { outline: false });

  // Fur texture
  drawTexture(ctx, cx - w * 0.3, oy + h * 0.32, w * 0.45, h * 0.28, 'fur', base, 0.35);

  // Legs (gradient)
  const legColor = darken(base, 0.1);
  fillGradientRect(ctx, cx - w * 0.28, oy + h * 0.6, w * 0.07, h * 0.22, legColor);
  fillGradientRect(ctx, cx - w * 0.08, oy + h * 0.6, w * 0.07, h * 0.22, legColor);
  fillGradientRect(ctx, cx + w * 0.08, oy + h * 0.55, w * 0.07, h * 0.27, legColor);

  // Paws
  ctx.fillStyle = darken(base, 0.2);
  ctx.fillRect(Math.round(cx - w * 0.3), Math.round(oy + h * 0.8), Math.max(3, w * 0.1), 2);
  ctx.fillRect(Math.round(cx - w * 0.1), Math.round(oy + h * 0.8), Math.max(3, w * 0.1), 2);
  ctx.fillRect(Math.round(cx + w * 0.07), Math.round(oy + h * 0.8), Math.max(3, w * 0.1), 2);

  // Neck
  fillGradientOval(ctx, cx + w * 0.02, oy + h * 0.22, w * 0.2, h * 0.2, base, { outline: false });

  // Head
  fillGradientOval(ctx, cx + w * 0.05, oy + h * 0.12, w * 0.32, h * 0.28, base);

  // Snout
  fillGradientOval(ctx, cx + w * 0.28, oy + h * 0.26, w * 0.16, h * 0.12, lighten(base, 0.15));
  // Nose
  ctx.fillStyle = '#222222';
  ctx.fillRect(Math.round(cx + w * 0.38), Math.round(oy + h * 0.28), Math.max(2, w * 0.04), Math.max(2, h * 0.03));
  // Mouth line
  ctx.fillStyle = darken(base, 0.3);
  ctx.fillRect(Math.round(cx + w * 0.32), Math.round(oy + h * 0.35), Math.max(3, w * 0.1), 1);

  // Ears
  fillGradientTriangle(ctx, cx + w * 0.1, oy + h * 0.15, cx + w * 0.07, oy + h * 0.02, cx + w * 0.17, oy + h * 0.05, darken(base, 0.1));
  fillGradientTriangle(ctx, cx + w * 0.25, oy + h * 0.15, cx + w * 0.22, oy + h * 0.02, cx + w * 0.32, oy + h * 0.05, darken(base, 0.1));

  // Eye (fierce)
  drawEye(ctx, cx + w * 0.2, oy + h * 0.2, w * 0.06, accent, accent);

  addHighlight(ctx, cx + w * 0.12, oy + h * 0.18, w * 0.06, 0.25);
}

function drawSnake(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;

  // Thick coiled body — 矮胖型, wide overlapping segments (bottom-up)
  // Minimal horizontal oscillation avoids the bow-tie pinch
  const coils = 5;
  for (let i = coils - 1; i >= 0; i--) {
    const offset = Math.sin(i * 1.2) * w * 0.04;
    const sy = oy + h * 0.42 + i * h * 0.1;
    const segW = w * 0.48;
    const segH = h * 0.13;
    const segColor = i % 2 === 0 ? base : darken(base, 0.06);
    fillGradientOval(ctx, cx - segW / 2 + offset, sy, segW, segH, segColor, { lightOff: 0.15 });
  }

  // Scale pattern on coils
  for (let i = 0; i < coils; i++) {
    const offset = Math.sin(i * 1.2) * w * 0.04;
    const sy = oy + h * 0.44 + i * h * 0.1;
    drawTexture(ctx, cx - w * 0.15 + offset, sy, w * 0.3, h * 0.08, 'scales', base, 0.45);
  }

  // Tail tip curving out from bottom coil
  ctx.strokeStyle = darken(base, 0.1);
  ctx.lineWidth = Math.max(2, w * 0.03);
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.2, oy + h * 0.88);
  ctx.quadraticCurveTo(cx + w * 0.32, oy + h * 0.92, cx + w * 0.38, oy + h * 0.86);
  ctx.stroke();

  // Neck rising from top coil
  fillGradientRect(ctx, cx - w * 0.06, oy + h * 0.2, w * 0.12, h * 0.24, base);

  // Head (cobra)
  fillGradientOval(ctx, cx - w * 0.14, oy + h * 0.06, w * 0.28, h * 0.2, darken(base, 0.05));

  // Hood (cobra spread)
  fillGradientOval(ctx, cx - w * 0.18, oy + h * 0.12, w * 0.36, h * 0.12, lighten(base, 0.05), { lightOff: 0.1 });

  // Eyes (centered)
  drawEye(ctx, cx - w * 0.06, oy + h * 0.12, w * 0.05, accent);
  drawEye(ctx, cx + w * 0.06, oy + h * 0.12, w * 0.05, accent);

  // Forked tongue
  ctx.fillStyle = '#cc2222';
  const tongueX = Math.round(cx + w * 0.1);
  const tongueY = Math.round(oy + h * 0.18);
  ctx.fillRect(tongueX, tongueY, Math.max(3, Math.round(w * 0.06)), 1);
  ctx.fillRect(tongueX + Math.max(3, Math.round(w * 0.05)), tongueY - 1, 2, 1);
  ctx.fillRect(tongueX + Math.max(3, Math.round(w * 0.05)), tongueY + 1, 2, 1);

  addHighlight(ctx, cx - w * 0.06, oy + h * 0.1, w * 0.06, 0.3);
}

function drawSpider(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h / 2;
  const legColor = darken(base, 0.15);

  // Legs (8 — drawn first, behind body)
  ctx.strokeStyle = legColor;
  ctx.lineWidth = Math.max(1, w * 0.02);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const angle = (i - 1.5) * 0.4;
      const baseY = cy - h * 0.05 + i * h * 0.07;
      const midX = cx + side * w * 0.25;
      const midY = baseY - h * 0.1;
      const tipX = cx + side * w * 0.45;
      const tipY = baseY + h * 0.05;
      ctx.beginPath();
      ctx.moveTo(cx + side * w * 0.1, baseY);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();

      // Leg joint dot
      ctx.fillStyle = darken(base, 0.2);
      ctx.fillRect(Math.round(midX - 1), Math.round(midY - 1), 2, 2);
    }
  }

  // Abdomen (large, behind)
  fillGradientOval(ctx, cx - w * 0.17, cy + h * 0.02, w * 0.34, h * 0.28, base);
  // Abdomen markings
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.4;
  fillFlatOval(ctx, cx - w * 0.06, cy + h * 0.08, w * 0.12, h * 0.08);
  ctx.globalAlpha = 1;

  // Cephalothorax (front body)
  fillGradientOval(ctx, cx - w * 0.12, cy - h * 0.22, w * 0.24, h * 0.24, darken(base, 0.05));

  // Eyes (cluster of 4 pairs)
  const eyeS = w * 0.035;
  drawEye(ctx, cx - w * 0.06, cy - h * 0.18, eyeS, accent, accent);
  drawEye(ctx, cx + w * 0.03, cy - h * 0.18, eyeS, accent, accent);
  drawEye(ctx, cx - w * 0.04, cy - h * 0.13, eyeS * 0.8, accent);
  drawEye(ctx, cx + w * 0.02, cy - h * 0.13, eyeS * 0.8, accent);

  // Fangs (chelicerae)
  ctx.fillStyle = darken(base, 0.3);
  ctx.fillRect(Math.round(cx - w * 0.04), Math.round(cy - h * 0.06), 2, Math.max(2, h * 0.06));
  ctx.fillRect(Math.round(cx + w * 0.02), Math.round(cy - h * 0.06), 2, Math.max(2, h * 0.06));

  addHighlight(ctx, cx - w * 0.04, cy - h * 0.12, w * 0.05, 0.25);
}

function drawSkeleton(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;
  const boneColor = base;
  const jointColor = darken(base, 0.12);

  // Skull
  fillGradientOval(ctx, cx - w * 0.17, oy + h * 0.03, w * 0.34, h * 0.26, boneColor, { lightAmt: 0.2, darkAmt: 0.15 });

  // Eye sockets (dark hollows with glow)
  ctx.fillStyle = '#111111';
  fillFlatOval(ctx, cx - w * 0.12, oy + h * 0.1, w * 0.08, h * 0.08);
  fillFlatOval(ctx, cx + w * 0.04, oy + h * 0.1, w * 0.08, h * 0.08);
  // Glow in sockets
  addHighlight(ctx, cx - w * 0.08, oy + h * 0.13, w * 0.03, 0.6);
  addHighlight(ctx, cx + w * 0.08, oy + h * 0.13, w * 0.03, 0.6);
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx - w * 0.09), Math.round(oy + h * 0.13), 2, 2);
  ctx.fillRect(Math.round(cx + w * 0.07), Math.round(oy + h * 0.13), 2, 2);

  // Nose hole
  ctx.fillStyle = '#222222';
  ctx.fillRect(Math.round(cx - w * 0.02), Math.round(oy + h * 0.2), 2, 2);

  // Jaw
  fillGradientOval(ctx, cx - w * 0.12, oy + h * 0.22, w * 0.24, h * 0.06, jointColor, { darkAmt: 0.1 });
  // Teeth
  ctx.fillStyle = lighten(boneColor, 0.2);
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(Math.round(cx - w * 0.08 + i * w * 0.035), Math.round(oy + h * 0.21), 2, 2);
  }

  // Spine
  for (let i = 0; i < 5; i++) {
    const vy = oy + h * 0.3 + i * h * 0.06;
    fillGradientRect(ctx, cx - w * 0.03, vy, w * 0.06, h * 0.04, jointColor, { outline: false });
  }

  // Ribcage
  for (let i = 0; i < 3; i++) {
    const ry = oy + h * 0.32 + i * h * 0.07;
    fillGradientRect(ctx, cx - w * 0.14, ry, w * 0.28, h * 0.03, boneColor, { outline: false });
    // Rib curvature (darker center gap)
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(Math.round(cx - 1), Math.round(ry), 2, Math.max(1, h * 0.03));
  }

  // Arms
  fillGradientRect(ctx, cx - w * 0.2, oy + h * 0.34, w * 0.06, h * 0.2, jointColor);
  fillGradientRect(ctx, cx + w * 0.14, oy + h * 0.34, w * 0.06, h * 0.2, jointColor);

  // Legs
  fillGradientRect(ctx, cx - w * 0.1, oy + h * 0.58, w * 0.06, h * 0.26, jointColor);
  fillGradientRect(ctx, cx + w * 0.05, oy + h * 0.58, w * 0.06, h * 0.26, jointColor);

  // Weapon (sword with gradient)
  const swordColor = accent;
  fillGradientRect(ctx, cx + w * 0.22, oy + h * 0.18, w * 0.04, h * 0.42, swordColor);
  // Crossguard
  fillGradientRect(ctx, cx + w * 0.18, oy + h * 0.32, w * 0.12, h * 0.03, darken(swordColor, 0.2));

  drawTexture(ctx, cx - w * 0.15, oy + h * 0.3, w * 0.3, h * 0.3, 'bone', boneColor, 0.25);
  addHighlight(ctx, cx - w * 0.04, oy + h * 0.08, w * 0.06, 0.2);
}

function drawGoblin(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;

  // Body
  fillGradientOval(ctx, cx - w * 0.22, oy + h * 0.35, w * 0.44, h * 0.32, base);

  // Belly highlight
  fillGradientOval(ctx, cx - w * 0.1, oy + h * 0.4, w * 0.2, h * 0.15, lighten(base, 0.15), { outline: false });

  // Legs
  fillGradientRect(ctx, cx - w * 0.14, oy + h * 0.62, w * 0.09, h * 0.22, darken(base, 0.08));
  fillGradientRect(ctx, cx + w * 0.05, oy + h * 0.62, w * 0.09, h * 0.22, darken(base, 0.08));
  // Feet
  fillGradientOval(ctx, cx - w * 0.17, oy + h * 0.8, w * 0.12, h * 0.06, darken(base, 0.15), { outline: false });
  fillGradientOval(ctx, cx + w * 0.05, oy + h * 0.8, w * 0.12, h * 0.06, darken(base, 0.15), { outline: false });

  // Arms
  fillGradientRect(ctx, cx - w * 0.28, oy + h * 0.38, w * 0.08, h * 0.18, darken(base, 0.05));
  fillGradientRect(ctx, cx + w * 0.2, oy + h * 0.38, w * 0.08, h * 0.18, darken(base, 0.05));

  // Head (oversized)
  fillGradientOval(ctx, cx - w * 0.22, oy + h * 0.07, w * 0.44, h * 0.32, base);

  // Ears (large and pointy)
  fillGradientTriangle(ctx, cx - w * 0.22, oy + h * 0.18, cx - w * 0.42, oy + h * 0.12, cx - w * 0.17, oy + h * 0.25, base);
  fillGradientTriangle(ctx, cx + w * 0.22, oy + h * 0.18, cx + w * 0.42, oy + h * 0.12, cx + w * 0.17, oy + h * 0.25, base);
  // Inner ear pink
  ctx.fillStyle = lighten(base, 0.25);
  ctx.fillRect(Math.round(cx - w * 0.32), Math.round(oy + h * 0.15), 2, 3);
  ctx.fillRect(Math.round(cx + w * 0.3), Math.round(oy + h * 0.15), 2, 3);

  // Eyes (large, menacing)
  drawEye(ctx, cx - w * 0.08, oy + h * 0.18, w * 0.07, accent);
  drawEye(ctx, cx + w * 0.08, oy + h * 0.18, w * 0.07, accent);

  // Nose (bulbous)
  fillGradientOval(ctx, cx - w * 0.03, oy + h * 0.25, w * 0.06, h * 0.05, darken(base, 0.15), { outline: false });

  // Mouth (wide grin with fangs)
  ctx.fillStyle = '#331111';
  ctx.fillRect(Math.round(cx - w * 0.1), Math.round(oy + h * 0.3), Math.max(3, w * 0.2), Math.max(2, h * 0.03));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(cx - w * 0.08), Math.round(oy + h * 0.3), 2, 2);
  ctx.fillRect(Math.round(cx + w * 0.06), Math.round(oy + h * 0.3), 2, 2);

  // Club weapon
  fillGradientRect(ctx, cx + w * 0.28, oy + h * 0.25, w * 0.06, h * 0.35, '#6b4f3a');
  fillGradientOval(ctx, cx + w * 0.25, oy + h * 0.2, w * 0.12, h * 0.1, '#5a3f2a');

  addHighlight(ctx, cx - w * 0.06, oy + h * 0.12, w * 0.06, 0.25);
}

function drawGhost(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;

  // Ethereal glow aura (behind body)
  ctx.globalAlpha = 0.15;
  const auraGrad = ctx.createRadialGradient(cx, oy + h * 0.35, 0, cx, oy + h * 0.35, w * 0.4);
  auraGrad.addColorStop(0, base);
  auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(cx, oy + h * 0.35, w * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Translucent body with gradient
  ctx.globalAlpha = 0.7;
  fillGradientOval(ctx, cx - w * 0.27, oy + h * 0.08, w * 0.54, h * 0.42, base, { lightAmt: 0.35, darkAmt: 0.15 });

  // Body extension (flowing robe)
  const bodyGrad = ctx.createLinearGradient(cx, oy + h * 0.3, cx, oy + h * 0.75);
  bodyGrad.addColorStop(0, base);
  bodyGrad.addColorStop(0.7, darken(base, 0.1));
  bodyGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(Math.round(cx - w * 0.25), Math.round(oy + h * 0.3), Math.max(3, w * 0.5), Math.max(4, h * 0.4));

  // Wavy bottom (fade out)
  for (let i = 0; i < 5; i++) {
    const bx = cx - w * 0.25 + i * w * 0.12;
    const wave = (i % 2 === 0) ? 0 : h * 0.06;
    ctx.globalAlpha = 0.5 - i * 0.05;
    ctx.fillStyle = base;
    fillFlatOval(ctx, bx, oy + h * 0.66 + wave, w * 0.12, h * 0.1);
  }
  ctx.globalAlpha = 1;

  // Eyes (hollow, glowing)
  ctx.fillStyle = '#000000';
  fillFlatOval(ctx, cx - w * 0.14, oy + h * 0.22, w * 0.1, h * 0.1);
  fillFlatOval(ctx, cx + w * 0.04, oy + h * 0.22, w * 0.1, h * 0.1);
  // Eye glow
  addHighlight(ctx, cx - w * 0.09, oy + h * 0.26, w * 0.04, 0.8);
  addHighlight(ctx, cx + w * 0.09, oy + h * 0.26, w * 0.04, 0.8);
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx - w * 0.1), Math.round(oy + h * 0.26), 2, 2);
  ctx.fillRect(Math.round(cx + w * 0.08), Math.round(oy + h * 0.26), 2, 2);

  // Mouth (wailing O)
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.ellipse(cx, oy + h * 0.4, w * 0.06, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  addHighlight(ctx, cx - w * 0.1, oy + h * 0.14, w * 0.08, 0.35);
}

function drawElemental(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;

  // Swirling energy body (multiple overlapping gradient ovals)
  for (let i = 5; i >= 0; i--) {
    const r = w * 0.14 + i * w * 0.025;
    const ex = cx + Math.sin(i * 1.2) * w * 0.1;
    const ey = oy + h * 0.2 + i * h * 0.1;
    const layerColor = i % 2 === 0 ? base : lighten(base, 0.1);
    ctx.globalAlpha = 0.8 - i * 0.05;
    fillGradientOval(ctx, ex - r, ey, r * 2, h * 0.14, layerColor, { outline: false });
  }
  ctx.globalAlpha = 1;

  // Energy sparks
  ctx.fillStyle = lighten(accent, 0.4);
  for (let i = 0; i < 6; i++) {
    const hash = ((i * 7919) % 31);
    const sx = cx - w * 0.2 + (hash % 10) * w * 0.04;
    const sy = oy + h * 0.15 + Math.floor(hash / 5) * h * 0.12;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2);
  }
  ctx.globalAlpha = 1;

  // Core glow
  addHighlight(ctx, cx, oy + h * 0.35, w * 0.12, 0.7);
  fillGradientOval(ctx, cx - w * 0.1, oy + h * 0.28, w * 0.2, h * 0.15, accent, { lightAmt: 0.4 });

  // Eyes
  drawEye(ctx, cx - w * 0.06, oy + h * 0.28, w * 0.05, '#ffffff');
  drawEye(ctx, cx + w * 0.04, oy + h * 0.28, w * 0.05, '#ffffff');

  drawTexture(ctx, cx - w * 0.15, oy + h * 0.2, w * 0.3, h * 0.4, 'crystal', base, 0.3);
}

function drawGargoyle(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;

  // Wings (behind body)
  fillGradientTriangle(ctx, cx - w * 0.2, oy + h * 0.35, cx - w * 0.47, oy + h * 0.12, cx - w * 0.42, oy + h * 0.52, darken(base, 0.12));
  fillGradientTriangle(ctx, cx + w * 0.2, oy + h * 0.35, cx + w * 0.47, oy + h * 0.12, cx + w * 0.42, oy + h * 0.52, darken(base, 0.12));

  // Body (stone-like)
  fillGradientOval(ctx, cx - w * 0.22, oy + h * 0.3, w * 0.44, h * 0.36, base);
  drawTexture(ctx, cx - w * 0.18, oy + h * 0.33, w * 0.36, h * 0.28, 'cracks', base, 0.3);

  // Head
  fillGradientOval(ctx, cx - w * 0.17, oy + h * 0.08, w * 0.34, h * 0.27, base);

  // Horns (curved)
  fillGradientTriangle(ctx, cx - w * 0.14, oy + h * 0.12, cx - w * 0.23, oy - h * 0.02, cx - w * 0.06, oy + h * 0.06, darken(base, 0.25));
  fillGradientTriangle(ctx, cx + w * 0.14, oy + h * 0.12, cx + w * 0.23, oy - h * 0.02, cx + w * 0.06, oy + h * 0.06, darken(base, 0.25));

  // Eyes (glowing)
  drawEye(ctx, cx - w * 0.07, oy + h * 0.18, w * 0.06, accent, accent);
  drawEye(ctx, cx + w * 0.07, oy + h * 0.18, w * 0.06, accent, accent);

  // Mouth (snarling)
  ctx.fillStyle = '#222222';
  ctx.fillRect(Math.round(cx - w * 0.08), Math.round(oy + h * 0.28), Math.max(3, w * 0.16), 2);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(Math.round(cx - w * 0.06 + i * w * 0.05), Math.round(oy + h * 0.27), 1, 2);
  }

  // Legs (thick stone)
  fillGradientRect(ctx, cx - w * 0.14, oy + h * 0.62, w * 0.1, h * 0.2, darken(base, 0.08));
  fillGradientRect(ctx, cx + w * 0.05, oy + h * 0.62, w * 0.1, h * 0.2, darken(base, 0.08));

  // Clawed feet
  ctx.fillStyle = darken(base, 0.25);
  ctx.fillRect(Math.round(cx - w * 0.16), Math.round(oy + h * 0.8), Math.max(3, w * 0.14), 2);
  ctx.fillRect(Math.round(cx + w * 0.04), Math.round(oy + h * 0.8), Math.max(3, w * 0.14), 2);

  addHighlight(ctx, cx - w * 0.06, oy + h * 0.14, w * 0.06, 0.2);
}

function drawDragon(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;

  // Tail (behind everything)
  ctx.strokeStyle = darken(base, 0.1);
  ctx.lineWidth = Math.max(2, w * 0.04);
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.2, oy + h * 0.5);
  ctx.quadraticCurveTo(cx - w * 0.4, oy + h * 0.55, cx - w * 0.45, oy + h * 0.42);
  ctx.stroke();
  // Tail tip
  fillGradientTriangle(ctx, cx - w * 0.45, oy + h * 0.42, cx - w * 0.5, oy + h * 0.35, cx - w * 0.42, oy + h * 0.38, darken(base, 0.15));

  // Wings (large, bat-like)
  const wingC = darken(base, 0.12);
  fillGradientTriangle(ctx, cx - w * 0.12, oy + h * 0.28, cx - w * 0.42, oy + h * 0.02, cx - w * 0.38, oy + h * 0.5, wingC);
  fillGradientTriangle(ctx, cx + w * 0.08, oy + h * 0.28, cx + w * 0.42, oy + h * 0.02, cx + w * 0.38, oy + h * 0.5, wingC);
  // Wing membrane veins
  ctx.strokeStyle = darken(base, 0.25);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.12, oy + h * 0.3); ctx.lineTo(cx - w * 0.35, oy + h * 0.1);
  ctx.moveTo(cx - w * 0.12, oy + h * 0.32); ctx.lineTo(cx - w * 0.38, oy + h * 0.35);
  ctx.moveTo(cx + w * 0.08, oy + h * 0.3); ctx.lineTo(cx + w * 0.35, oy + h * 0.1);
  ctx.moveTo(cx + w * 0.08, oy + h * 0.32); ctx.lineTo(cx + w * 0.38, oy + h * 0.35);
  ctx.stroke();

  // Body
  fillGradientOval(ctx, cx - w * 0.28, oy + h * 0.28, w * 0.48, h * 0.38, base);
  // Belly (lighter)
  fillGradientOval(ctx, cx - w * 0.15, oy + h * 0.38, w * 0.28, h * 0.18, lighten(base, 0.2), { outline: false });

  // Scale texture
  drawTexture(ctx, cx - w * 0.22, oy + h * 0.3, w * 0.4, h * 0.3, 'scales', base, 0.35);

  // Legs
  fillGradientRect(ctx, cx - w * 0.18, oy + h * 0.6, w * 0.09, h * 0.22, darken(base, 0.1));
  fillGradientRect(ctx, cx + w * 0.06, oy + h * 0.58, w * 0.09, h * 0.24, darken(base, 0.1));
  // Claws
  ctx.fillStyle = darken(base, 0.3);
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(Math.round(cx - w * 0.2 + i * w * 0.03), Math.round(oy + h * 0.8), 1, 2);
    ctx.fillRect(Math.round(cx + w * 0.05 + i * w * 0.03), Math.round(oy + h * 0.8), 1, 2);
  }

  // Neck
  fillGradientRect(ctx, cx + w * 0.05, oy + h * 0.14, w * 0.12, h * 0.22, base, { outline: false });

  // Head
  fillGradientOval(ctx, cx + w * 0.02, oy + h * 0.02, w * 0.28, h * 0.2, darken(base, 0.05));
  // Snout
  fillGradientOval(ctx, cx + w * 0.2, oy + h * 0.06, w * 0.14, h * 0.1, darken(base, 0.08));

  // Horns
  fillGradientTriangle(ctx, cx + w * 0.08, oy + h * 0.06, cx + w * 0.03, oy - h * 0.06, cx + w * 0.14, oy - h * 0.02, darken(base, 0.25));
  fillGradientTriangle(ctx, cx + w * 0.22, oy + h * 0.06, cx + w * 0.2, oy - h * 0.06, cx + w * 0.28, oy - h * 0.02, darken(base, 0.25));

  // Eye
  drawEye(ctx, cx + w * 0.18, oy + h * 0.09, w * 0.06, accent, accent);

  // Nostril smoke
  ctx.fillStyle = 'rgba(100,100,100,0.3)';
  ctx.fillRect(Math.round(cx + w * 0.3), Math.round(oy + h * 0.08), 2, 1);
  ctx.fillRect(Math.round(cx + w * 0.32), Math.round(oy + h * 0.06), 1, 1);

  addHighlight(ctx, cx + w * 0.08, oy + h * 0.06, w * 0.06, 0.25);
}

function drawInsect(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h / 2;

  // Wings (translucent, behind body)
  ctx.globalAlpha = 0.35;
  fillGradientOval(ctx, cx - w * 0.38, cy - h * 0.28, w * 0.28, h * 0.25, lighten(base, 0.35), { outline: true, outlineColor: lighten(base, 0.2) });
  fillGradientOval(ctx, cx + w * 0.1, cy - h * 0.28, w * 0.28, h * 0.25, lighten(base, 0.35), { outline: true, outlineColor: lighten(base, 0.2) });
  ctx.globalAlpha = 1;

  // Abdomen (large segmented)
  fillGradientOval(ctx, cx - w * 0.16, cy - h * 0.05, w * 0.32, h * 0.32, base);
  // Segment lines
  ctx.strokeStyle = darken(base, 0.2);
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    const segY = cy + i * h * 0.07;
    ctx.moveTo(cx - w * 0.12, segY);
    ctx.lineTo(cx + w * 0.12, segY);
    ctx.stroke();
  }

  // Thorax
  fillGradientOval(ctx, cx - w * 0.12, cy - h * 0.25, w * 0.24, h * 0.22, darken(base, 0.05));

  // Legs (6, articulated)
  ctx.strokeStyle = darken(base, 0.18);
  ctx.lineWidth = Math.max(1, w * 0.02);
  for (let i = 0; i < 3; i++) {
    const ly = cy + i * h * 0.06;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * w * 0.1, ly);
      ctx.lineTo(cx + side * w * 0.3, ly - h * 0.05);
      ctx.lineTo(cx + side * w * 0.38, ly + h * 0.04);
      ctx.stroke();
    }
  }

  // Antennae
  ctx.strokeStyle = darken(base, 0.15);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.05, cy - h * 0.24);
  ctx.quadraticCurveTo(cx - w * 0.15, cy - h * 0.4, cx - w * 0.2, cy - h * 0.38);
  ctx.moveTo(cx + w * 0.05, cy - h * 0.24);
  ctx.quadraticCurveTo(cx + w * 0.15, cy - h * 0.4, cx + w * 0.2, cy - h * 0.38);
  ctx.stroke();

  // Eyes (compound)
  drawEye(ctx, cx - w * 0.06, cy - h * 0.22, w * 0.06, accent);
  drawEye(ctx, cx + w * 0.04, cy - h * 0.22, w * 0.06, accent);

  addHighlight(ctx, cx, cy - h * 0.15, w * 0.05, 0.25);
}

function drawFish(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h / 2;

  // Tail fin
  fillGradientTriangle(ctx, cx - w * 0.28, cy, cx - w * 0.45, cy - h * 0.22, cx - w * 0.45, cy + h * 0.22, darken(base, 0.1));
  // Tail fin rays
  ctx.strokeStyle = darken(base, 0.2);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.28, cy); ctx.lineTo(cx - w * 0.43, cy - h * 0.18);
  ctx.moveTo(cx - w * 0.28, cy); ctx.lineTo(cx - w * 0.43, cy + h * 0.18);
  ctx.stroke();

  // Body (main oval with gradient)
  fillGradientOval(ctx, cx - w * 0.3, cy - h * 0.17, w * 0.58, h * 0.34, base);

  // Belly (lighter underside)
  fillGradientOval(ctx, cx - w * 0.2, cy + h * 0.02, w * 0.35, h * 0.12, lighten(base, 0.2), { outline: false });

  // Scale texture
  drawTexture(ctx, cx - w * 0.2, cy - h * 0.12, w * 0.4, h * 0.22, 'scales', base, 0.4);

  // Dorsal fin
  fillGradientTriangle(ctx, cx - w * 0.05, cy - h * 0.17, cx - w * 0.1, cy - h * 0.33, cx + w * 0.12, cy - h * 0.17, darken(base, 0.12));

  // Pectoral fin
  fillGradientTriangle(ctx, cx - w * 0.05, cy + h * 0.05, cx - w * 0.15, cy + h * 0.2, cx + w * 0.05, cy + h * 0.1, darken(base, 0.08));

  // Eye (large)
  drawEye(ctx, cx + w * 0.12, cy - h * 0.04, w * 0.07);

  // Mouth
  ctx.strokeStyle = darken(base, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.25, cy - h * 0.02);
  ctx.lineTo(cx + w * 0.27, cy + h * 0.02);
  ctx.stroke();

  // Lateral line
  ctx.strokeStyle = darken(base, 0.15);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.15, cy);
  ctx.lineTo(cx + w * 0.2, cy - h * 0.02);
  ctx.stroke();

  addHighlight(ctx, cx, cy - h * 0.1, w * 0.06, 0.3);
}

function drawBird(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h * 0.4;

  // Wings (spread)
  fillGradientTriangle(ctx, cx - w * 0.1, cy + h * 0.02, cx - w * 0.47, cy - h * 0.12, cx - w * 0.32, cy + h * 0.18, darken(base, 0.1));
  fillGradientTriangle(ctx, cx + w * 0.1, cy + h * 0.02, cx + w * 0.47, cy - h * 0.12, cx + w * 0.32, cy + h * 0.18, darken(base, 0.1));
  // Wing feather tips
  fillGradientTriangle(ctx, cx - w * 0.35, cy - h * 0.02, cx - w * 0.48, cy - h * 0.18, cx - w * 0.42, cy - h * 0.08, darken(base, 0.18));
  fillGradientTriangle(ctx, cx + w * 0.35, cy - h * 0.02, cx + w * 0.48, cy - h * 0.18, cx + w * 0.42, cy - h * 0.08, darken(base, 0.18));

  // Body
  fillGradientOval(ctx, cx - w * 0.14, cy - h * 0.02, w * 0.28, h * 0.28, base);
  // Breast (lighter)
  fillGradientOval(ctx, cx - w * 0.08, cy + h * 0.06, w * 0.16, h * 0.12, lighten(base, 0.18), { outline: false });

  // Head
  fillGradientOval(ctx, cx - w * 0.12, cy - h * 0.18, w * 0.24, h * 0.2, base);

  // Beak
  fillGradientTriangle(ctx, cx + w * 0.1, cy - h * 0.1, cx + w * 0.22, cy - h * 0.08, cx + w * 0.1, cy - h * 0.04, accent);

  // Eye
  drawEye(ctx, cx + w * 0.03, cy - h * 0.12, w * 0.045);

  // Eye stripe (raptor marking)
  ctx.fillStyle = darken(base, 0.3);
  ctx.fillRect(Math.round(cx + w * 0.05), Math.round(cy - h * 0.1), 2, Math.max(2, h * 0.06));

  // Tail feathers
  fillGradientRect(ctx, cx - w * 0.16, cy + h * 0.2, w * 0.18, h * 0.08, darken(base, 0.15));
  // Tail feather lines
  ctx.strokeStyle = darken(base, 0.25);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const tx = cx - w * 0.14 + i * w * 0.06;
    ctx.beginPath();
    ctx.moveTo(tx, cy + h * 0.2);
    ctx.lineTo(tx, cy + h * 0.27);
    ctx.stroke();
  }

  // Talons
  ctx.fillStyle = darken(accent, 0.2);
  ctx.fillRect(Math.round(cx - w * 0.06), Math.round(cy + h * 0.24), 2, Math.max(2, h * 0.06));
  ctx.fillRect(Math.round(cx + w * 0.03), Math.round(cy + h * 0.24), 2, Math.max(2, h * 0.06));

  addHighlight(ctx, cx - w * 0.04, cy - h * 0.12, w * 0.05, 0.25);
}

function drawBear(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;

  // Body (large, bulky)
  fillGradientOval(ctx, cx - w * 0.32, oy + h * 0.25, w * 0.64, h * 0.42, base);
  // Fur texture
  drawTexture(ctx, cx - w * 0.28, oy + h * 0.28, w * 0.56, h * 0.35, 'fur', base, 0.35);

  // Legs (thick)
  fillGradientRect(ctx, cx - w * 0.25, oy + h * 0.6, w * 0.12, h * 0.22, darken(base, 0.1));
  fillGradientRect(ctx, cx + w * 0.12, oy + h * 0.58, w * 0.12, h * 0.24, darken(base, 0.1));
  // Paws with claws
  fillGradientOval(ctx, cx - w * 0.27, oy + h * 0.78, w * 0.14, h * 0.07, darken(base, 0.15), { outline: false });
  fillGradientOval(ctx, cx + w * 0.12, oy + h * 0.78, w * 0.14, h * 0.07, darken(base, 0.15), { outline: false });
  ctx.fillStyle = '#333333';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(Math.round(cx - w * 0.25 + i * w * 0.04), Math.round(oy + h * 0.82), 1, 2);
    ctx.fillRect(Math.round(cx + w * 0.14 + i * w * 0.04), Math.round(oy + h * 0.82), 1, 2);
  }

  // Head
  fillGradientOval(ctx, cx - w * 0.18, oy + h * 0.06, w * 0.38, h * 0.28, base);

  // Ears (round)
  fillGradientOval(ctx, cx - w * 0.2, oy + h * 0.04, w * 0.12, h * 0.1, darken(base, 0.05));
  fillGradientOval(ctx, cx + w * 0.1, oy + h * 0.04, w * 0.12, h * 0.1, darken(base, 0.05));
  // Inner ear
  fillGradientOval(ctx, cx - w * 0.17, oy + h * 0.06, w * 0.06, h * 0.05, lighten(base, 0.2), { outline: false });
  fillGradientOval(ctx, cx + w * 0.12, oy + h * 0.06, w * 0.06, h * 0.05, lighten(base, 0.2), { outline: false });

  // Snout
  fillGradientOval(ctx, cx + w * 0.02, oy + h * 0.2, w * 0.18, h * 0.1, lighten(base, 0.15));
  // Nose
  ctx.fillStyle = '#222222';
  fillFlatOval(ctx, cx + w * 0.07, oy + h * 0.21, w * 0.06, h * 0.04);

  // Eyes
  drawEye(ctx, cx - w * 0.06, oy + h * 0.15, w * 0.05);
  drawEye(ctx, cx + w * 0.1, oy + h * 0.15, w * 0.05);

  // Mouth
  ctx.fillStyle = darken(base, 0.3);
  ctx.fillRect(Math.round(cx + w * 0.08), Math.round(oy + h * 0.27), Math.max(2, w * 0.06), 1);

  addHighlight(ctx, cx - w * 0.06, oy + h * 0.12, w * 0.07, 0.2);
}

function drawTurtle(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h * 0.5;

  // Legs (underneath shell)
  fillGradientRect(ctx, cx - w * 0.22, cy + h * 0.14, w * 0.09, h * 0.12, accent);
  fillGradientRect(ctx, cx + w * 0.14, cy + h * 0.14, w * 0.09, h * 0.12, accent);
  // Rear leg
  fillGradientRect(ctx, cx - w * 0.12, cy + h * 0.16, w * 0.08, h * 0.1, darken(accent, 0.1));
  // Tail
  fillGradientTriangle(ctx, cx - w * 0.25, cy + h * 0.1, cx - w * 0.35, cy + h * 0.08, cx - w * 0.3, cy + h * 0.15, darken(accent, 0.1));

  // Shell (main dome)
  fillGradientOval(ctx, cx - w * 0.32, cy - h * 0.2, w * 0.64, h * 0.4, base, { lightOff: 0.35 });

  // Shell pattern (hexagonal plates)
  ctx.strokeStyle = darken(base, 0.2);
  ctx.lineWidth = 1;
  // Center plate
  ctx.beginPath();
  ctx.ellipse(cx, cy - h * 0.05, w * 0.1, h * 0.08, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Side plates
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const px = cx + Math.cos(angle) * w * 0.18;
    const py = cy - h * 0.05 + Math.sin(angle) * h * 0.1;
    ctx.beginPath();
    ctx.ellipse(px, py, w * 0.07, h * 0.05, angle, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Shell rim
  fillGradientOval(ctx, cx - w * 0.3, cy + h * 0.1, w * 0.6, h * 0.06, darken(base, 0.15), { outline: false });

  // Head (peeking out)
  fillGradientOval(ctx, cx + w * 0.2, cy - h * 0.12, w * 0.18, h * 0.16, accent);
  // Eye
  drawEye(ctx, cx + w * 0.3, cy - h * 0.08, w * 0.04);
  // Mouth
  ctx.fillStyle = darken(accent, 0.2);
  ctx.fillRect(Math.round(cx + w * 0.33), Math.round(cy - h * 0.02), Math.max(2, w * 0.04), 1);

  addHighlight(ctx, cx - w * 0.08, cy - h * 0.12, w * 0.08, 0.3);
  drawTexture(ctx, cx - w * 0.25, cy - h * 0.15, w * 0.5, h * 0.3, 'scales', base, 0.2);
}

function drawCrab(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2, cy = oy + h * 0.5;

  // Claw arms
  ctx.strokeStyle = darken(base, 0.15);
  ctx.lineWidth = Math.max(2, w * 0.03);
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.2, cy - h * 0.05);
  ctx.quadraticCurveTo(cx - w * 0.3, cy - h * 0.18, cx - w * 0.35, cy - h * 0.15);
  ctx.moveTo(cx + w * 0.2, cy - h * 0.05);
  ctx.quadraticCurveTo(cx + w * 0.3, cy - h * 0.18, cx + w * 0.35, cy - h * 0.15);
  ctx.stroke();

  // Claws (pincer shapes)
  fillGradientOval(ctx, cx - w * 0.44, cy - h * 0.24, w * 0.18, h * 0.17, darken(base, 0.08));
  fillGradientOval(ctx, cx + w * 0.26, cy - h * 0.24, w * 0.18, h * 0.17, darken(base, 0.08));
  // Pincer tips (V cut)
  ctx.fillStyle = darken(base, 0.25);
  ctx.fillRect(Math.round(cx - w * 0.37), Math.round(cy - h * 0.18), 1, Math.max(2, h * 0.08));
  ctx.fillRect(Math.round(cx + w * 0.36), Math.round(cy - h * 0.18), 1, Math.max(2, h * 0.08));

  // Body (carapace)
  fillGradientOval(ctx, cx - w * 0.24, cy - h * 0.12, w * 0.48, h * 0.28, base, { lightOff: 0.25 });
  drawTexture(ctx, cx - w * 0.18, cy - h * 0.08, w * 0.36, h * 0.2, 'cracks', base, 0.25);

  // Legs (4 pairs)
  ctx.strokeStyle = darken(base, 0.12);
  ctx.lineWidth = Math.max(1, w * 0.02);
  for (let i = 0; i < 3; i++) {
    const ly = cy + h * 0.05 + i * h * 0.06;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * w * 0.18, ly);
      ctx.lineTo(cx + side * w * 0.35, ly + h * 0.08);
      ctx.stroke();
    }
  }

  // Eye stalks
  ctx.strokeStyle = darken(base, 0.1);
  ctx.lineWidth = Math.max(1, w * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.06, cy - h * 0.1);
  ctx.lineTo(cx - w * 0.08, cy - h * 0.2);
  ctx.moveTo(cx + w * 0.06, cy - h * 0.1);
  ctx.lineTo(cx + w * 0.08, cy - h * 0.2);
  ctx.stroke();
  // Eyes
  drawEye(ctx, cx - w * 0.08, cy - h * 0.22, w * 0.04);
  drawEye(ctx, cx + w * 0.08, cy - h * 0.22, w * 0.04);

  addHighlight(ctx, cx - w * 0.06, cy - h * 0.06, w * 0.06, 0.25);
}

function drawPlant(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, base: string, accent: string): void {
  const cx = ox + w / 2;
  const stemColor = darken(base, 0.25);

  // Roots
  ctx.strokeStyle = darken(base, 0.35);
  ctx.lineWidth = Math.max(1, w * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx, oy + h * 0.78);
  ctx.quadraticCurveTo(cx - w * 0.15, oy + h * 0.85, cx - w * 0.2, oy + h * 0.88);
  ctx.moveTo(cx, oy + h * 0.78);
  ctx.quadraticCurveTo(cx + w * 0.12, oy + h * 0.82, cx + w * 0.18, oy + h * 0.86);
  ctx.moveTo(cx, oy + h * 0.78);
  ctx.lineTo(cx, oy + h * 0.85);
  ctx.stroke();

  // Main stem
  fillGradientRect(ctx, cx - w * 0.03, oy + h * 0.28, w * 0.06, h * 0.52, stemColor);
  // Thorns
  ctx.fillStyle = darken(stemColor, 0.2);
  for (let i = 0; i < 3; i++) {
    const ty = oy + h * 0.4 + i * h * 0.12;
    ctx.fillRect(Math.round(cx - w * 0.05), Math.round(ty), 2, 1);
    ctx.fillRect(Math.round(cx + w * 0.03), Math.round(ty + h * 0.04), 2, 1);
  }

  // Leaves (gradient filled)
  fillGradientOval(ctx, cx - w * 0.35, oy + h * 0.18, w * 0.3, h * 0.2, base);
  fillGradientOval(ctx, cx + w * 0.05, oy + h * 0.13, w * 0.3, h * 0.2, lighten(base, 0.05));
  fillGradientOval(ctx, cx - w * 0.25, oy + h * 0.4, w * 0.24, h * 0.16, darken(base, 0.05));
  fillGradientOval(ctx, cx + w * 0.03, oy + h * 0.38, w * 0.24, h * 0.16, base);

  // Leaf veins
  ctx.strokeStyle = darken(base, 0.15);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.2, oy + h * 0.28);
  ctx.lineTo(cx - w * 0.08, oy + h * 0.27);
  ctx.moveTo(cx + w * 0.2, oy + h * 0.23);
  ctx.lineTo(cx + w * 0.08, oy + h * 0.22);
  ctx.stroke();

  // Flower head (carnivorous)
  fillGradientOval(ctx, cx - w * 0.14, oy + h * 0.02, w * 0.28, h * 0.22, accent, { lightAmt: 0.35 });
  // Petal details
  ctx.strokeStyle = darken(accent, 0.2);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, oy + h * 0.13, w * 0.12, h * 0.09, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Inner mouth
  fillGradientOval(ctx, cx - w * 0.06, oy + h * 0.08, w * 0.12, h * 0.1, darken(accent, 0.3), { outline: false });

  // Eyes (on the flower)
  drawEye(ctx, cx - w * 0.05, oy + h * 0.08, w * 0.045, '#000000');
  drawEye(ctx, cx + w * 0.04, oy + h * 0.08, w * 0.045, '#000000');

  // Pollen/spore particles
  ctx.fillStyle = lighten(accent, 0.3);
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 4; i++) {
    const hash = ((i * 3571) % 17);
    ctx.fillRect(Math.round(cx - w * 0.2 + hash * w * 0.025), Math.round(oy + h * 0.02 + (hash % 5) * h * 0.04), 2, 2);
  }
  ctx.globalAlpha = 1;

  addHighlight(ctx, cx - w * 0.05, oy + h * 0.06, w * 0.05, 0.3);
  drawTexture(ctx, cx - w * 0.3, oy + h * 0.2, w * 0.6, h * 0.4, 'bark', stemColor, 0.2);
}

// ─── Feature overlays ──────────────────────────────────────────────

export function drawFeature(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, feat: string, accent: string): void {
  if (feat === 'horns') {
    fillGradientTriangle(ctx, ox + w * 0.2, oy + h * 0.15, ox + w * 0.1, oy - h * 0.05, ox + w * 0.25, oy + h * 0.05, darken(accent, 0.3));
    fillGradientTriangle(ctx, ox + w * 0.7, oy + h * 0.15, ox + w * 0.75, oy - h * 0.05, ox + w * 0.85, oy + h * 0.05, darken(accent, 0.3));
  } else if (feat === 'crown') {
    const crownColor = '#ffd700';
    fillGradientRect(ctx, ox + w * 0.2, oy + h * 0.02, w * 0.6, h * 0.04, crownColor);
    fillGradientTriangle(ctx, ox + w * 0.25, oy + h * 0.02, ox + w * 0.22, oy - h * 0.06, ox + w * 0.28, oy + h * 0.02, crownColor);
    fillGradientTriangle(ctx, ox + w * 0.45, oy + h * 0.02, ox + w * 0.42, oy - h * 0.08, ox + w * 0.48, oy + h * 0.02, crownColor);
    fillGradientTriangle(ctx, ox + w * 0.65, oy + h * 0.02, ox + w * 0.62, oy - h * 0.06, ox + w * 0.68, oy + h * 0.02, crownColor);
    // Jewels
    ctx.fillStyle = '#cc2222';
    ctx.fillRect(Math.round(ox + w * 0.44), Math.round(oy - h * 0.04), 2, 2);
    ctx.fillStyle = '#2222cc';
    ctx.fillRect(Math.round(ox + w * 0.24), Math.round(oy - h * 0.02), 2, 2);
    ctx.fillRect(Math.round(ox + w * 0.64), Math.round(oy - h * 0.02), 2, 2);
  } else if (feat === 'ice') {
    ctx.fillStyle = '#aaddff';
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 5; i++) {
      const hash = ((i * 2749) % 23);
      const ix = ox + w * 0.1 + (hash % 8) * w * 0.1;
      const iy = oy + h * 0.1 + Math.floor(hash / 4) * h * 0.15;
      fillGradientTriangle(ctx, ix, iy, ix - w * 0.02, iy + h * 0.06, ix + w * 0.02, iy + h * 0.06, '#aaddff', { outline: false });
    }
    ctx.globalAlpha = 1;
  } else if (feat === 'fire') {
    for (let i = 0; i < 4; i++) {
      const hash = ((i * 5113) % 19);
      const fx = ox + w * 0.25 + (hash % 6) * w * 0.08;
      const fy = oy + h * 0.05 + Math.floor(hash / 4) * h * 0.1;
      ctx.globalAlpha = 0.6;
      fillGradientTriangle(ctx, fx, fy + h * 0.08, fx - w * 0.02, fy + h * 0.12, fx + w * 0.02, fy + h * 0.12, '#ff6622', { outline: false });
      ctx.fillStyle = '#ffaa22';
      ctx.fillRect(Math.round(fx - 1), Math.round(fy + h * 0.06), 2, 2);
      ctx.fillStyle = '#ffdd44';
      ctx.fillRect(Math.round(fx), Math.round(fy + h * 0.08), 1, 1);
    }
    ctx.globalAlpha = 1;
  } else if (feat === 'poison') {
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 6; i++) {
      const hash = ((i * 4217) % 29);
      const px = ox + w * 0.1 + (hash % 9) * w * 0.09;
      const py = oy + h * 0.5 + Math.floor(hash / 5) * h * 0.08;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, w * 0.03);
      grad.addColorStop(0, '#88ff44');
      grad.addColorStop(1, 'rgba(136,255,68,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, w * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ─── Legacy flat helpers (used for small details) ────────────────────

function fillFlatOval(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
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
