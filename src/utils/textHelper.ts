import { FONT_FAMILY } from './constants';

/**
 * Creates a readable text style config for Phaser text objects.
 * Ensures minimum stroke, shadow, and consistent font across the game.
 *
 * @param fontSize - Font size in px (number or string like '14px')
 * @param color - Text color (hex string)
 * @param options - Optional overrides
 */
export function readableTextStyle(
  fontSize: number | string,
  color: string = '#ffffff',
  options: {
    align?: 'left' | 'center' | 'right';
    wordWrapWidth?: number;
    bold?: boolean;
  } = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  const sizeNum = typeof fontSize === 'number' ? fontSize : parseInt(fontSize, 10);
  const sizeStr = typeof fontSize === 'number' ? `${fontSize}px` : fontSize;

  // Minimum stroke thickness based on text size
  const strokeThickness = sizeNum >= 18 ? 4 : 3;

  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT_FAMILY,
    fontSize: sizeStr,
    color,
    stroke: '#000000',
    strokeThickness,
    shadow: {
      offsetX: 1,
      offsetY: 1,
      color: '#000000',
      blur: 2,
      fill: true,
    },
  };

  if (options.align) style.align = options.align;
  if (options.wordWrapWidth) style.wordWrap = { width: options.wordWrapWidth };
  if (options.bold) style.fontStyle = 'bold';

  return style;
}

/**
 * Creates a Phaser text object with guaranteed readability.
 * Shorthand for scene.add.text() with readableTextStyle().
 */
export function createReadableText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  fontSize: number | string,
  color: string = '#ffffff',
  options: {
    align?: 'left' | 'center' | 'right';
    wordWrapWidth?: number;
    bold?: boolean;
    origin?: { x: number; y: number };
  } = {},
): Phaser.GameObjects.Text {
  const style = readableTextStyle(fontSize, color, options);
  const textObj = scene.add.text(x, y, text, style);

  if (options.origin) {
    textObj.setOrigin(options.origin.x, options.origin.y);
  }

  return textObj;
}
