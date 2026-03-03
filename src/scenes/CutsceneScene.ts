import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';
import { TransitionEffect } from '../ui/TransitionEffect';

/** Enhanced slide with optional character art and layout */
export interface CutsceneSlide {
  text: string;
  duration: number;
  /** Character texture keys to show (e.g., 'char_hero_battle', 'char_companion_elf_battle') */
  characters?: string[];
  /** Layout for character placement */
  layout?: 'center' | 'sides' | 'gathering' | 'celebration';
  /** Background color override (default: black 0x000000) */
  bgColor?: number;
}

/** Simple cutscene player — shows text slides with fade transitions and character art */
export class CutsceneScene extends Phaser.Scene {
  private slides: CutsceneSlide[] = [];
  private currentSlide = 0;
  private textObj?: Phaser.GameObjects.Text;
  private nextScene = 'WorldMapScene';
  private nextData: object = {};
  private bgRect?: Phaser.GameObjects.Rectangle;
  private charSprites: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('CutsceneScene');
  }

  create(data: { slides: CutsceneSlide[]; nextScene: string; nextData?: object }): void {
    this.slides = data.slides || [{ text: '...', duration: 3000 }];
    this.nextScene = data.nextScene || 'WorldMapScene';
    this.nextData = data.nextData ?? {};
    this.currentSlide = 0;
    this.charSprites = [];

    this.bgRect = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000);

    this.textObj = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.78, '', {
      fontFamily: FONT_FAMILY, fontSize: '20px', color: COLORS.textPrimary,
      wordWrap: { width: GAME_WIDTH - 200 }, align: 'center', lineSpacing: 12,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0).setDepth(DEPTH.ui + 1);

    this.showSlide();

    // Skip
    this.input.keyboard?.on('keydown-ENTER', () => this.nextSlide());
    this.input.keyboard?.on('keydown-SPACE', () => this.nextSlide());
    this.input.on('pointerdown', () => this.nextSlide());
  }

  private showSlide(): void {
    if (this.currentSlide >= this.slides.length) {
      TransitionEffect.transition(this, this.nextScene, this.nextData);
      return;
    }

    const slide = this.slides[this.currentSlide];

    // Update background color
    const bgColor = slide.bgColor ?? 0x000000;
    this.bgRect?.setFillStyle(bgColor);

    // Clear old character sprites
    this.charSprites.forEach(s => s.destroy());
    this.charSprites = [];

    // Place character sprites if specified
    if (slide.characters && slide.characters.length > 0) {
      this.placeCharacters(slide.characters, slide.layout ?? 'center');
    }

    // Text position: lower when characters are shown, center when not
    const hasChars = slide.characters && slide.characters.length > 0;
    this.textObj?.setY(hasChars ? GAME_HEIGHT * 0.82 : GAME_HEIGHT / 2);

    this.textObj?.setText(slide.text);
    this.tweens.add({
      targets: [this.textObj, ...this.charSprites],
      alpha: 1,
      duration: 800,
      onComplete: () => {
        this.time.delayedCall(slide.duration, () => {
          this.tweens.add({
            targets: [this.textObj, ...this.charSprites],
            alpha: 0,
            duration: 500,
            onComplete: () => {
              this.currentSlide++;
              this.showSlide();
            },
          });
        });
      },
    });
  }

  /** Place character sprites based on layout */
  private placeCharacters(charKeys: string[], layout: string): void {
    const count = charKeys.length;
    const charY = GAME_HEIGHT * 0.42; // centered vertically in upper portion
    const charScale = count <= 2 ? 0.7 : count <= 4 ? 0.55 : 0.4;

    switch (layout) {
      case 'gathering': {
        // Semicircle arrangement
        const radius = Math.min(280, count * 60);
        const startAngle = Math.PI - Math.PI * 0.8;
        const endAngle = Math.PI + Math.PI * 0.8;
        charKeys.forEach((key, i) => {
          const angle = count === 1 ? Math.PI : startAngle + (endAngle - startAngle) * i / Math.max(1, count - 1);
          const x = GAME_WIDTH / 2 + Math.cos(angle) * radius;
          const y = charY + Math.sin(angle) * (radius * 0.3) - 20;
          this.addCharSprite(key, x, y, charScale);
        });
        break;
      }
      case 'celebration': {
        // Close together, slight overlap
        const totalW = count * 70;
        const startX = GAME_WIDTH / 2 - totalW / 2 + 35;
        charKeys.forEach((key, i) => {
          const x = startX + i * 70;
          const wobble = Math.sin(i * 1.5) * 8;
          this.addCharSprite(key, x, charY + wobble, charScale);
        });
        break;
      }
      case 'sides': {
        // Two groups facing each other
        const half = Math.ceil(count / 2);
        charKeys.forEach((key, i) => {
          const isLeft = i < half;
          const groupIdx = isLeft ? i : i - half;
          const groupSize = isLeft ? half : count - half;
          const baseX = isLeft ? GAME_WIDTH * 0.25 : GAME_WIDTH * 0.75;
          const spread = groupSize * 50;
          const x = baseX - spread / 2 + groupIdx * 50 + 25;
          this.addCharSprite(key, x, charY, charScale, !isLeft);
        });
        break;
      }
      default: {
        // 'center' — evenly spaced in a row
        const totalW = count * 90;
        const startX = GAME_WIDTH / 2 - totalW / 2 + 45;
        charKeys.forEach((key, i) => {
          this.addCharSprite(key, startX + i * 90, charY, charScale);
        });
        break;
      }
    }
  }

  /** Add a character sprite from battle sheet (frame 0 = front-facing 'down' direction) */
  private addCharSprite(textureKey: string, x: number, y: number, scale: number, flipX = false): void {
    if (!this.textures.exists(textureKey)) return;
    const img = this.add.image(x, y, textureKey, 0)
      .setScale(scale)
      .setFlipX(flipX)
      .setAlpha(0)
      .setDepth(DEPTH.ui);
    this.charSprites.push(img);
  }

  private nextSlide(): void {
    this.tweens.killAll();
    this.textObj?.setAlpha(0);
    this.charSprites.forEach(s => s.setAlpha(0));
    this.currentSlide++;
    this.showSlide();
  }
}
