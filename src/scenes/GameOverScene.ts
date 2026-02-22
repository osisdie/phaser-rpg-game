import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { SaveLoadSystem } from '../systems/SaveLoadSystem';
import { TransitionEffect } from '../ui/TransitionEffect';

export class GameOverScene extends Phaser.Scene {
  private menuItems: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private transitioning = false;
  private regionId = '';

  constructor() {
    super('GameOverScene');
  }

  create(data: { returnScene?: string; returnData?: object; regionId?: string }): void {
    // Reset state on re-entry
    this.menuItems = [];
    this.selectedIndex = 0;
    this.transitioning = false;
    this.regionId = data.regionId || gameState.getState().currentRegion;

    // Dark blood-red background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0000);

    // Ominous particles
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT;
      const texKey = this.textures.exists('fx_dark_mote') ? 'fx_dark_mote' : null;
      if (texKey) {
        const p = this.add.image(x, y, texKey).setAlpha(0.4);
        this.tweens.add({
          targets: p, y: y - 60, alpha: 0,
          duration: 3000 + Math.random() * 2000,
          delay: Math.random() * 2000,
          repeat: -1,
          onRepeat: () => { p.setPosition(Math.random() * GAME_WIDTH, GAME_HEIGHT + 20).setAlpha(0.4); },
        });
      }
    }

    // GAME OVER text with dramatic effect
    const title = this.add.text(GAME_WIDTH / 2, 200, t('gameover.title'), {
      fontFamily: FONT_FAMILY, fontSize: '64px', color: '#cc0000',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: title, alpha: 1, duration: 2000, ease: 'Power2',
    });

    // Skull icon if available
    if (this.textures.exists('node_skull')) {
      const skull = this.add.image(GAME_WIDTH / 2, 280, 'node_skull').setAlpha(0).setScale(2);
      this.tweens.add({
        targets: skull, alpha: 0.6, duration: 2000, delay: 500, ease: 'Power2',
      });
    }

    // Options (appear after delay)
    this.time.delayedCall(2000, () => {
      const options = [
        { label: t('gameover.return_town') },
        { label: t('gameover.load') },
        { label: t('gameover.title_screen') },
      ];

      options.forEach((opt, i) => {
        const btn = this.add.text(GAME_WIDTH / 2, 360 + i * 50, `  ${opt.label}`, {
          fontFamily: FONT_FAMILY, fontSize: '22px', color: COLORS.textPrimary,
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

        this.tweens.add({ targets: btn, alpha: 1, duration: 500, delay: i * 200 });
        btn.on('pointerover', () => { this.selectedIndex = i; this.updateMenu(); });
        btn.on('pointerdown', () => this.confirmSelection(i));
        this.menuItems.push(btn);
      });

      this.updateMenu();

      // Keyboard support
      this.input.keyboard?.on('keydown-UP', () => {
        this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
        this.updateMenu();
      });
      this.input.keyboard?.on('keydown-DOWN', () => {
        this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
        this.updateMenu();
      });
      this.input.keyboard?.on('keydown-ENTER', () => this.confirmSelection(this.selectedIndex));
      this.input.keyboard?.on('keydown-SPACE', () => this.confirmSelection(this.selectedIndex));
      this.input.keyboard?.on('keydown-Z', () => this.confirmSelection(this.selectedIndex));
    });
  }

  private updateMenu(): void {
    this.menuItems.forEach((text, i) => {
      const label = text.text.trim().replace(/^► /, '');
      if (i === this.selectedIndex) {
        text.setText(`► ${label}`);
        text.setColor(COLORS.textHighlight);
      } else {
        text.setText(`  ${label}`);
        text.setColor(COLORS.textPrimary);
      }
    });
  }

  private confirmSelection(index: number): void {
    if (this.transitioning) return;
    this.transitioning = true;

    switch (index) {
      case 0: this.returnToTown(); break;
      case 1: this.loadSave(); break;
      case 2: this.goToTitle(); break;
    }
  }

  /** Revive party to 1 HP, lose 50% gold, return to current region's town */
  private returnToTown(): void {
    // Revive all party members to 1 HP
    const party = gameState.getParty();
    for (const member of party) {
      if (member.stats.hp <= 0) {
        member.stats.hp = 1;
      }
    }

    // Lose 50% gold as penalty
    const currentGold = gameState.getState().gold;
    const goldLost = Math.floor(currentGold * 0.5);
    if (goldLost > 0) {
      gameState.addGold(-goldLost);
    }

    TransitionEffect.transition(this, 'TownScene', { regionId: this.regionId });
  }

  private loadSave(): void {
    // Try auto save first
    if (SaveLoadSystem.load(-1)) {
      TransitionEffect.transition(this, 'WorldMapScene');
      return;
    }
    for (let i = 0; i < 3; i++) {
      if (SaveLoadSystem.load(i)) {
        TransitionEffect.transition(this, 'WorldMapScene');
        return;
      }
    }
    // No save found — fall back to town
    this.transitioning = false;
    this.returnToTown();
  }

  private goToTitle(): void {
    TransitionEffect.transition(this, 'TitleScene');
  }
}
