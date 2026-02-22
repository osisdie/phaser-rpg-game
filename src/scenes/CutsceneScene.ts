import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, FONT_FAMILY } from '../utils/constants';
import { TransitionEffect } from '../ui/TransitionEffect';

/** Simple cutscene player — shows text slides with fade transitions */
export class CutsceneScene extends Phaser.Scene {
  private slides: { text: string; duration: number }[] = [];
  private currentSlide = 0;
  private textObj?: Phaser.GameObjects.Text;
  private nextScene = 'WorldMapScene';
  private nextData: object = {};

  constructor() {
    super('CutsceneScene');
  }

  create(data: { slides: { text: string; duration: number }[]; nextScene: string; nextData?: object }): void {
    this.slides = data.slides || [{ text: '...', duration: 3000 }];
    this.nextScene = data.nextScene || 'WorldMapScene';
    this.nextData = data.nextData ?? {};
    this.currentSlide = 0;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000);

    this.textObj = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      fontFamily: FONT_FAMILY, fontSize: '20px', color: COLORS.textPrimary,
      wordWrap: { width: GAME_WIDTH - 200 }, align: 'center', lineSpacing: 12,
    }).setOrigin(0.5).setAlpha(0);

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
    this.textObj?.setText(slide.text);
    this.tweens.add({
      targets: this.textObj, alpha: 1, duration: 800,
      onComplete: () => {
        this.time.delayedCall(slide.duration, () => {
          this.tweens.add({
            targets: this.textObj, alpha: 0, duration: 500,
            onComplete: () => {
              this.currentSlide++;
              this.showSlide();
            },
          });
        });
      },
    });
  }

  private nextSlide(): void {
    this.tweens.killAll();
    this.textObj?.setAlpha(0);
    this.currentSlide++;
    this.showSlide();
  }
}
