import Phaser from 'phaser';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';

/** Floating damage/heal number that pops up and fades out */
export function showDamageNumber(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: number | string,
  type: 'damage' | 'heal' | 'miss' | 'status' = 'damage'
): void {
  const color = type === 'heal' ? COLORS.textHeal
    : type === 'miss' ? '#aaaaaa'
    : type === 'status' ? '#cc66ff'
    : COLORS.textDamage;
  const prefix = type === 'heal' ? '+' : type === 'miss' ? '' : type === 'status' ? '' : '-';
  const displayText = type === 'miss' ? 'MISS'
    : type === 'status' ? String(value)
    : `${prefix}${value}`;

  // Clamp Y so damage numbers don't go off-screen above viewport (tall monster sprites)
  const clampedY = Math.max(30, y);

  const text = scene.add.text(x, clampedY, displayText, {
    fontFamily: FONT_FAMILY,
    fontSize: type === 'miss' ? '16px' : type === 'status' ? '18px' : '22px',
    color,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(DEPTH.ui + 20);

  scene.tweens.add({
    targets: text,
    y: clampedY - 40,
    alpha: { from: 1, to: 0 },
    duration: 800,
    ease: 'Power2',
    onComplete: () => text.destroy(),
  });
}
