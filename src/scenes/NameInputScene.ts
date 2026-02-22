import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { TransitionEffect } from '../ui/TransitionEffect';
import { audioManager } from '../systems/AudioManager';

export class NameInputScene extends Phaser.Scene {
  private inputElement?: HTMLInputElement;

  constructor() {
    super('NameInputScene');
  }

  create(): void {
    gameState.reset();

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1e);

    // Prompt (above input area)
    this.add.text(GAME_WIDTH / 2, 240, t('name.prompt'), {
      fontFamily: FONT_FAMILY, fontSize: '28px', color: COLORS.textPrimary,
    }).setOrigin(0.5);

    // HTML input overlay — positioned relative to the canvas
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.value = t('name.default');
    this.inputElement.maxLength = 8;

    // Calculate position based on canvas bounds
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const inputTop = rect.top + rect.height * 0.47;
    const inputLeft = rect.left + rect.width * 0.5;

    this.inputElement.style.cssText = `
      position: fixed;
      left: ${inputLeft}px;
      top: ${inputTop}px;
      transform: translate(-50%, -50%);
      width: 250px;
      padding: 12px 16px;
      font-size: 24px;
      font-family: ${FONT_FAMILY};
      background: #1a1a2e;
      color: #ffffff;
      border: 2px solid #4a4a6e;
      border-radius: 4px;
      text-align: center;
      outline: none;
      z-index: 100;
    `;
    document.body.appendChild(this.inputElement);
    this.inputElement.focus();
    this.inputElement.select();

    // Confirm button
    const confirmBtn = this.add.text(GAME_WIDTH / 2, 400, `► ${t('name.confirm')}`, {
      fontFamily: FONT_FAMILY, fontSize: '24px', color: COLORS.textHighlight,
      backgroundColor: '#333366',
      padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    confirmBtn.on('pointerdown', () => this.confirmName());
    confirmBtn.on('pointerover', () => confirmBtn.setScale(1.05));
    confirmBtn.on('pointerout', () => confirmBtn.setScale(1));

    // Enter key
    this.inputElement.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') this.confirmName();
    });

    // Character hint
    this.add.text(GAME_WIDTH / 2, 470, '（1-8 個字元）', {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textSecondary,
    }).setOrigin(0.5);

    TransitionEffect.fadeIn(this);
  }

  private confirmName(): void {
    const name = this.inputElement?.value.trim() || t('name.default');
    gameState.setHeroName(name);
    audioManager.playSfx('select');

    // Clean up HTML element
    if (this.inputElement) {
      document.body.removeChild(this.inputElement);
      this.inputElement = undefined;
    }

    // Start prologue
    gameState.setQuestStatus('quest_prologue', 'active');
    TransitionEffect.transition(this, 'WorldMapScene');
  }

  shutdown(): void {
    if (this.inputElement && this.inputElement.parentNode) {
      document.body.removeChild(this.inputElement);
      this.inputElement = undefined;
    }
  }
}
