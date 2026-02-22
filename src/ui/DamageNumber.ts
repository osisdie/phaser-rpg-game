import Phaser from 'phaser';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';

/** Floating damage/heal number that pops up and fades out */
export function showDamageNumber(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: number,
  type: 'damage' | 'heal' | 'miss' = 'damage'
): void {
  const color = type === 'heal' ? COLORS.textHeal : type === 'miss' ? '#aaaaaa' : COLORS.textDamage;
  const prefix = type === 'heal' ? '+' : type === 'miss' ? '' : '-';
  const displayText = type === 'miss' ? 'MISS' : `${prefix}${value}`;

  const text = scene.add.text(x, y, displayText, {
    fontFamily: FONT_FAMILY,
    fontSize: type === 'miss' ? '16px' : '22px',
    color,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(DEPTH.ui + 20);

  scene.tweens.add({
    targets: text,
    y: y - 40,
    alpha: { from: 1, to: 0 },
    duration: 800,
    ease: 'Power2',
    onComplete: () => text.destroy(),
  });
}
