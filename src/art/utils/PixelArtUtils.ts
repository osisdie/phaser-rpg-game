/**
 * PixelArtUtils — Shared pixel art rendering utilities.
 * Provides gradient fills, outlines, highlights, shadows, eyes, and texture
 * patterns for Canvas 2D rendering at sprite resolution (96-240 px).
 *
 * Design: uses Canvas 2D native gradients + ellipse. At game resolution with
 * Phaser NEAREST filtering the result reads as high-quality pixel art.
 */
import { darken, lighten, blendColors } from '../palettes';

export { darken, lighten, blendColors };

// ── Gradient Shape Fills ─────────────────────────────────────────────

/**
 * Fill an oval with a radial gradient (highlight → base → shadow) and a dark
 * outline stroke.  Light source is top-left by default.
 */
export function fillGradientOval(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  baseColor: string,
  opts?: { lightOff?: number; outline?: boolean; outlineColor?: string; lightAmt?: number; darkAmt?: number },
): void {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = Math.max(1, w / 2);
  const ry = Math.max(1, h / 2);
  const lo = opts?.lightOff ?? 0.3;
  const la = opts?.lightAmt ?? 0.3;
  const da = opts?.darkAmt ?? 0.3;

  const lightX = cx - rx * lo;
  const lightY = cy - ry * lo;
  const outerR = Math.max(rx, ry) * 1.1;

  const grad = ctx.createRadialGradient(lightX, lightY, outerR * 0.05, cx, cy, outerR);
  grad.addColorStop(0, lighten(baseColor, la));
  grad.addColorStop(0.5, baseColor);
  grad.addColorStop(1, darken(baseColor, da));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  if (opts?.outline !== false) {
    ctx.strokeStyle = opts?.outlineColor ?? darken(baseColor, 0.45);
    ctx.lineWidth = Math.max(1, Math.min(rx, ry) * 0.08);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Fill a triangle with a vertical linear gradient and outline.
 */
export function fillGradientTriangle(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  baseColor: string,
  opts?: { outline?: boolean; outlineColor?: string },
): void {
  const minY = Math.min(y1, y2, y3);
  const maxY = Math.max(y1, y2, y3);

  const grad = ctx.createLinearGradient(0, minY, 0, maxY);
  grad.addColorStop(0, lighten(baseColor, 0.2));
  grad.addColorStop(1, darken(baseColor, 0.2));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();

  if (opts?.outline !== false) {
    ctx.strokeStyle = opts?.outlineColor ?? darken(baseColor, 0.45);
    ctx.lineWidth = Math.max(1, Math.abs(maxY - minY) * 0.04);
    ctx.stroke();
  }
}

/**
 * Fill a rectangle with a vertical gradient and optional outline.
 */
export function fillGradientRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  baseColor: string,
  opts?: { outline?: boolean },
): void {
  const rw = Math.max(1, Math.round(w));
  const rh = Math.max(1, Math.round(h));
  const rx = Math.round(x);
  const ry = Math.round(y);

  const grad = ctx.createLinearGradient(rx, ry, rx, ry + rh);
  grad.addColorStop(0, lighten(baseColor, 0.15));
  grad.addColorStop(1, darken(baseColor, 0.15));

  ctx.fillStyle = grad;
  ctx.fillRect(rx, ry, rw, rh);

  if (opts?.outline !== false && rw > 3 && rh > 3) {
    ctx.strokeStyle = darken(baseColor, 0.4);
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
  }
}

// ── Highlights & Shadows ─────────────────────────────────────────────

/** Add a specular highlight (bright radial spot). */
export function addHighlight(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  intensity: number = 0.5,
): void {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, `rgba(255,255,255,${intensity})`);
  grad.addColorStop(0.5, `rgba(255,255,255,${intensity * 0.3})`);
  grad.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Add a ground shadow ellipse under a sprite. */
export function addGroundShadow(
  ctx: CanvasRenderingContext2D,
  cx: number, y: number, w: number, h: number,
  intensity: number = 0.25,
): void {
  const grad = ctx.createRadialGradient(cx, y, 0, cx, y, Math.max(w, h) / 2);
  grad.addColorStop(0, `rgba(0,0,0,${intensity})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ── Eyes ──────────────────────────────────────────────────────────────

/**
 * Draw a detailed eye: white sclera → pupil → highlight dot.
 * Optional glow ring for magical/undead creatures.
 */
export function drawEye(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number,
  pupilColor: string = '#000000',
  glowColor?: string,
): void {
  const r = Math.max(1, size / 2);

  // Sclera
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = Math.max(0.5, r * 0.12);
  ctx.stroke();

  // Pupil
  ctx.fillStyle = pupilColor;
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.1, cy + r * 0.1, r * 0.5, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight dot
  ctx.fillStyle = '#ffffff';
  const hlR = Math.max(1, r * 0.3);
  ctx.fillRect(Math.round(cx - r * 0.3), Math.round(cy - r * 0.3), Math.ceil(hlR), Math.ceil(hlR));

  // Optional glow
  if (glowColor) {
    ctx.globalAlpha = 0.3;
    const glowGrad = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 2.5);
    glowGrad.addColorStop(0, glowColor);
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ── Texture Patterns ─────────────────────────────────────────────────

/**
 * Draw surface texture dots (scales, fur, bone markings, bark, crystal).
 * Uses a deterministic pseudo-random based on position for consistency.
 */
export function drawTexture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  type: 'scales' | 'fur' | 'bone' | 'bark' | 'crystal' | 'cracks',
  baseColor: string,
  density: number = 0.3,
): void {
  const count = Math.max(3, Math.floor(w * h * density / 80));
  const seed = Math.round(x * 31 + y * 17);

  for (let i = 0; i < count; i++) {
    const hash = Math.abs(((seed + i * 1327) * 16807) % 2147483647);
    const px = x + (hash % Math.max(1, Math.floor(w)));
    const py = y + (Math.floor(hash / Math.max(1, Math.floor(w))) % Math.max(1, Math.floor(h)));

    switch (type) {
      case 'scales':
        ctx.fillStyle = darken(baseColor, 0.12 + (i % 3) * 0.04);
        ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
        ctx.fillStyle = lighten(baseColor, 0.08);
        ctx.fillRect(Math.round(px), Math.round(py - 1), 1, 1);
        break;
      case 'fur':
        ctx.fillStyle = i % 2 === 0 ? lighten(baseColor, 0.1) : darken(baseColor, 0.06);
        ctx.fillRect(Math.round(px), Math.round(py), 1, 3);
        break;
      case 'bone':
        ctx.fillStyle = lighten(baseColor, 0.18);
        ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        break;
      case 'bark':
        ctx.fillStyle = darken(baseColor, 0.18);
        ctx.fillRect(Math.round(px), Math.round(py), 1, Math.max(2, 4));
        break;
      case 'crystal':
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = lighten(baseColor, 0.4);
        ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
        ctx.globalAlpha = 1;
        break;
      case 'cracks':
        ctx.fillStyle = darken(baseColor, 0.25);
        ctx.fillRect(Math.round(px), Math.round(py), 1, 2);
        ctx.fillRect(Math.round(px + 1), Math.round(py + 1), 2, 1);
        break;
    }
  }
}
