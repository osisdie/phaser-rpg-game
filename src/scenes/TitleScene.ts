import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { SaveLoadSystem } from '../systems/SaveLoadSystem';
import { TransitionEffect } from '../ui/TransitionEffect';
import { audioManager } from '../systems/AudioManager';

export class TitleScene extends Phaser.Scene {
  private menuItems: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    // Reset state on re-entry
    this.menuItems = [];
    this.selectedIndex = 0;

    // Dark sky background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1e);

    // Stars
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT * 0.6;
      const star = this.add.circle(x, y, Math.random() * 2 + 0.5, 0xffffff, Math.random() * 0.5 + 0.3);
      this.tweens.add({
        targets: star, alpha: { from: star.alpha, to: 0.1 },
        duration: 1000 + Math.random() * 2000, yoyo: true, repeat: -1,
      });
    }

    // Castle silhouette (if texture exists)
    if (this.textures.exists('title_castle')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 160, 'title_castle')
        .setAlpha(0.7);
    }

    // Ground silhouette
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 40, GAME_WIDTH, 80, 0x0a0a0a);

    // Torch-like glow effects on sides
    for (const tx of [GAME_WIDTH * 0.2, GAME_WIDTH * 0.8]) {
      const glow = this.add.circle(tx, GAME_HEIGHT - 100, 40, 0xff8844, 0.15);
      this.tweens.add({
        targets: glow, alpha: { from: 0.15, to: 0.08 }, scale: { from: 1, to: 1.2 },
        duration: 800 + Math.random() * 400, yoyo: true, repeat: -1,
      });
    }

    // Title
    this.add.text(GAME_WIDTH / 2, 160, t('title.game_name'), {
      fontFamily: FONT_FAMILY, fontSize: '56px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 220, t('title.subtitle'), {
      fontFamily: FONT_FAMILY, fontSize: '20px', color: COLORS.textSecondary,
    }).setOrigin(0.5);

    // Menu
    const hasSaves = SaveLoadSystem.hasSaves();
    const items = [
      { label: t('title.new_game'), action: () => this.startNewGame() },
    ];
    if (hasSaves) {
      items.push({ label: t('title.load_game'), action: () => this.loadGame() });
    }

    items.forEach((item, i) => {
      const y = 350 + i * 50;
      const text = this.add.text(GAME_WIDTH / 2, y, `  ${item.label}`, {
        fontFamily: FONT_FAMILY, fontSize: '24px', color: COLORS.textPrimary,
      }).setOrigin(0.5);
      text.setInteractive({ useHandCursor: true });
      text.on('pointerover', () => { this.selectedIndex = i; this.updateMenu(); });
      text.on('pointerdown', () => { audioManager.playSfx('select'); item.action(); });
      this.menuItems.push(text);
    });

    this.updateMenu();

    // Keyboard (delay to prevent key bleed-through from previous scene transitions)
    this.time.delayedCall(200, () => {
      this.input.keyboard?.on('keydown-UP', () => {
        this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
        this.updateMenu();
      });
      this.input.keyboard?.on('keydown-DOWN', () => {
        this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
        this.updateMenu();
      });
      this.input.keyboard?.on('keydown-ENTER', () => {
        audioManager.playSfx('select');
        if (this.selectedIndex === 0) this.startNewGame();
        else if (this.selectedIndex === 1 && hasSaves) this.loadGame();
      });
      this.input.keyboard?.on('keydown-SPACE', () => {
        audioManager.playSfx('select');
        if (this.selectedIndex === 0) this.startNewGame();
        else if (this.selectedIndex === 1 && hasSaves) this.loadGame();
      });
    });

    // Version
    this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'v0.1.0', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#666666',
    }).setOrigin(1, 1);

    // Fade in
    TransitionEffect.fadeIn(this);

    // Resume audio context on user interaction
    this.input.on('pointerdown', () => audioManager.resume());
  }

  private updateMenu(): void {
    this.menuItems.forEach((text, i) => {
      if (i === this.selectedIndex) {
        text.setText(`► ${text.text.trim().replace(/^► /, '')}`);
        text.setColor(COLORS.textHighlight);
      } else {
        text.setText(`  ${text.text.trim().replace(/^► /, '')}`);
        text.setColor(COLORS.textPrimary);
      }
    });
  }

  private startNewGame(): void {
    TransitionEffect.transition(this, 'NameInputScene');
  }

  private loadGame(): void {
    // Try loading first available save
    for (let i = 0; i < 3; i++) {
      const info = SaveLoadSystem.getSaveInfo(i);
      if (info.exists) {
        if (SaveLoadSystem.load(i)) {
          TransitionEffect.transition(this, 'WorldMapScene');
          return;
        }
      }
    }
    // Try auto save
    if (SaveLoadSystem.load(-1)) {
      TransitionEffect.transition(this, 'WorldMapScene');
    }
  }
}
