import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { TransitionEffect } from '../ui/TransitionEffect';
import { audioManager } from '../systems/AudioManager';

export class EndingScene extends Phaser.Scene {
  constructor() {
    super('EndingScene');
  }

  create(): void {
    // Use parchment background if available, otherwise black
    if (this.textures.exists('worldmap_bg')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'worldmap_bg').setAlpha(0.3);
    }
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);

    // Castle silhouette at bottom
    if (this.textures.exists('title_castle')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 80, 'title_castle').setAlpha(0.3);
    }

    const heroName = gameState.getState().heroName;
    const playTime = gameState.getPlayTimeFormatted();

    // Scrolling credits
    const lines = [
      t('ending.congratulations'),
      '',
      `勇者 ${heroName} 帶領盟友打敗了大魔王`,
      '王國終於迎來了和平',
      '',
      '在各族人的幫助下',
      '王國逐漸恢復往日的繁榮',
      '',
      `${heroName} 成為了人人敬重的國王`,
      '帶領各族共建美好的未來',
      '',
      '— 完 —',
      '',
      t('ending.playtime', playTime),
      '',
      '感謝遊玩！',
      '',
      '— 勇者傳說 ～七國的傳說～ —',
    ];

    const fullText = lines.join('\n');
    const credits = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT + 50, fullText, {
      fontFamily: FONT_FAMILY, fontSize: '22px', color: COLORS.textPrimary,
      align: 'center', lineSpacing: 16,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0);

    // Scroll up
    this.tweens.add({
      targets: credits,
      y: -credits.height,
      duration: 20000,
      ease: 'Linear',
      onComplete: () => {
        this.showEndButtons();
      },
    });

    // Skip
    this.input.keyboard?.on('keydown-ENTER', () => this.showEndButtons());
    this.input.keyboard?.on('keydown-SPACE', () => this.showEndButtons());

    audioManager.playBgm('victory');
  }

  private showEndButtons(): void {
    this.tweens.killAll();
    this.children.removeAll();

    // Parchment background
    if (this.textures.exists('worldmap_bg')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'worldmap_bg').setAlpha(0.4);
    }
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);

    this.add.text(GAME_WIDTH / 2, 200, '— 完 —', {
      fontFamily: FONT_FAMILY, fontSize: '48px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    const options = [
      { label: t('gameover.title_screen'), y: 350 },
    ];

    options.forEach(opt => {
      const btn = this.add.text(GAME_WIDTH / 2, opt.y, opt.label, {
        fontFamily: FONT_FAMILY, fontSize: '22px', color: COLORS.textPrimary,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor(COLORS.textHighlight));
      btn.on('pointerout', () => btn.setColor(COLORS.textPrimary));
      btn.on('pointerdown', () => {
        TransitionEffect.transition(this, 'TitleScene');
      });
    });
  }
}
