import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { SaveLoadSystem } from '../systems/SaveLoadSystem';
import { TransitionEffect } from '../ui/TransitionEffect';
import { audioManager } from '../systems/AudioManager';

export class EndingScene extends Phaser.Scene {
  private buttonsShown = false;

  constructor() {
    super('EndingScene');
  }

  create(): void {
    this.buttonsShown = false;

    // Use parchment background if available, otherwise black
    if (this.textures.exists('worldmap_bg')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'worldmap_bg').setAlpha(0.3);
    }
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);

    // Castle silhouette at bottom
    if (this.textures.exists('title_castle')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 80, 'title_castle').setAlpha(0.3);
    }

    // Mark game as completed and auto-save
    gameState.setGameCompleted();
    SaveLoadSystem.autoSave();

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
      `${heroName} 成為了人人敬重的英雄`,
      '帶領各族共建美好的未來',
      '',
      '— 完 —',
      '',
      t('ending.playtime', playTime),
      '',
      '感謝遊玩！',
      '',
      '— 勇者傳說 ～七國的傳說～ —',
      '',
      '',
      t('ending.thank_you'),
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
      duration: 25000,
      ease: 'Linear',
      onComplete: () => {
        this.showEndButtons();
      },
    });

    // Skip
    this.input.keyboard?.on('keydown-ENTER', () => this.showEndButtons());
    this.input.keyboard?.on('keydown-SPACE', () => this.showEndButtons());
    this.input.keyboard?.on('keydown-ESC', () => this.showEndButtons());

    audioManager.playBgm('victory');
  }

  private showEndButtons(): void {
    if (this.buttonsShown) return;
    this.buttonsShown = true;

    this.tweens.killAll();
    this.children.removeAll();

    // Parchment background
    if (this.textures.exists('worldmap_bg')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'worldmap_bg').setAlpha(0.4);
    }
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);

    // "Thank you for playing. The End"
    this.add.text(GAME_WIDTH / 2, 180, t('ending.thank_you'), {
      fontFamily: FONT_FAMILY, fontSize: '36px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 4, align: 'center',
    }).setOrigin(0.5);

    // Completion star
    this.add.text(GAME_WIDTH / 2, 280, '★', {
      fontFamily: FONT_FAMILY, fontSize: '48px', color: '#ffdd44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Auto-save notification
    this.add.text(GAME_WIDTH / 2, 330, '（進度已自動儲存）', {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: '#aaaacc',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    // Buttons
    const options = [
      { label: t('ending.continue'), y: 420, action: () => this.continueGame() },
      { label: t('gameover.title_screen'), y: 470, action: () => TransitionEffect.transition(this, 'TitleScene') },
    ];

    let selectedIdx = 0;
    const btns: Phaser.GameObjects.Text[] = [];

    options.forEach((opt, i) => {
      const btn = this.add.text(GAME_WIDTH / 2, opt.y, opt.label, {
        fontFamily: FONT_FAMILY, fontSize: '22px',
        color: i === 0 ? COLORS.textHighlight : COLORS.textPrimary,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => { selectedIdx = i; updateBtns(); });
      btn.on('pointerdown', () => opt.action());
      btns.push(btn);
    });

    const updateBtns = () => {
      btns.forEach((b, i) => b.setColor(i === selectedIdx ? COLORS.textHighlight : COLORS.textPrimary));
    };

    this.input.keyboard?.on('keydown-UP', () => { selectedIdx = (selectedIdx - 1 + options.length) % options.length; updateBtns(); audioManager.playSfx('select'); });
    this.input.keyboard?.on('keydown-DOWN', () => { selectedIdx = (selectedIdx + 1) % options.length; updateBtns(); audioManager.playSfx('select'); });
    this.input.keyboard?.on('keydown-ENTER', () => options[selectedIdx].action());
    this.input.keyboard?.on('keydown-SPACE', () => options[selectedIdx].action());
  }

  private continueGame(): void {
    // Continue playing from the world map
    TransitionEffect.transition(this, 'WorldMapScene');
  }
}
