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
  private menuContainer!: Phaser.GameObjects.Container;
  private bgmStarted = false;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    // Reset state on re-entry
    this.menuItems = [];
    this.selectedIndex = 0;
    this.bgmStarted = false;

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

    // Version
    this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'v0.1.0', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#666666',
    }).setOrigin(1, 1);

    // Menu container (swapped between main menu and settings)
    this.menuContainer = this.add.container(0, 0);

    this.showMainMenu();

    // Fade in
    TransitionEffect.fadeIn(this);

    // Start BGM on first user interaction (browser autoplay policy)
    this.input.on('pointerdown', () => this.ensureBgm());
    this.input.keyboard?.on('keydown', () => this.ensureBgm());
  }

  private ensureBgm(): void {
    audioManager.resume();
    if (!this.bgmStarted) {
      this.bgmStarted = true;
      audioManager.playBgm('title');
    }
  }

  // ─── Main Menu ───

  private showMainMenu(): void {
    this.clearMenu();

    const hasSaves = SaveLoadSystem.hasSaves();
    const items: { label: string; action: () => void }[] = [
      { label: t('title.new_game'), action: () => this.startNewGame() },
    ];
    if (hasSaves) {
      items.push({ label: t('title.load_game'), action: () => this.loadGame() });
    }
    items.push({ label: t('title.settings'), action: () => this.showSettings() });

    items.forEach((item, i) => {
      const y = 350 + i * 50;
      const text = this.add.text(GAME_WIDTH / 2, y, `  ${item.label}`, {
        fontFamily: FONT_FAMILY, fontSize: '24px', color: COLORS.textPrimary,
      }).setOrigin(0.5);
      text.setInteractive({ useHandCursor: true });
      text.on('pointerover', () => { this.selectedIndex = i; this.updateMenuHighlight(); });
      text.on('pointerdown', () => item.action());
      this.menuItems.push(text);
      this.menuContainer.add(text);
    });

    this.updateMenuHighlight();

    // Keyboard (delay to prevent key bleed-through from previous scene transitions)
    this.time.delayedCall(200, () => {
      this.input.keyboard?.on('keydown-UP', () => {
        this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
        this.updateMenuHighlight();
        audioManager.playSfx('select');
      });
      this.input.keyboard?.on('keydown-DOWN', () => {
        this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
        this.updateMenuHighlight();
        audioManager.playSfx('select');
      });
      this.input.keyboard?.on('keydown-ENTER', () => {
        items[this.selectedIndex]?.action();
      });
      this.input.keyboard?.on('keydown-SPACE', () => {
        items[this.selectedIndex]?.action();
      });
    });
  }

  // ─── Settings Panel ───

  private showSettings(): void {
    this.clearMenu();

    // Title
    this.menuContainer.add(
      this.add.text(GAME_WIDTH / 2, 310, t('title.settings'), {
        fontFamily: FONT_FAMILY, fontSize: '22px', color: COLORS.textHighlight,
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5)
    );

    // BGM volume row
    this.addVolumeRow(370, t('system.bgm_volume'), 'bgm');

    // SFX volume row
    this.addVolumeRow(420, t('system.sfx_volume'), 'sfx');

    // Back button
    const backBtn = this.add.text(GAME_WIDTH / 2, 500, `← ${t('menu.back')}`, {
      fontFamily: FONT_FAMILY, fontSize: '20px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.showMainMenu());
    backBtn.on('pointerover', () => backBtn.setScale(1.05));
    backBtn.on('pointerout', () => backBtn.setScale(1));
    this.menuContainer.add(backBtn);

    // ESC to go back
    this.input.keyboard?.once('keydown-ESC', () => this.showMainMenu());
  }

  private addVolumeRow(y: number, label: string, type: 'bgm' | 'sfx'): void {
    const isMuted = type === 'bgm' ? audioManager.isBgmMuted() : audioManager.isSfxMuted();
    const volume = type === 'bgm' ? audioManager.getBgmVolume() : audioManager.getSfxVolume();
    const pct = Math.round(volume * 100);
    const baseX = 230;

    // Label
    this.menuContainer.add(
      this.add.text(baseX, y, label, {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0, 0.5)
    );

    // ◄ decrease
    const decBtn = this.add.text(baseX + 150, y, '◄', {
      fontFamily: FONT_FAMILY, fontSize: '20px',
      color: isMuted || pct <= 0 ? '#555555' : COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    decBtn.on('pointerdown', () => {
      if (isMuted) return;
      const newVol = Math.max(0, volume - 0.1);
      if (type === 'bgm') audioManager.setBgmVolume(newVol);
      else audioManager.setSfxVolume(newVol);
      this.showSettings();
    });
    decBtn.on('pointerover', () => decBtn.setScale(1.2));
    decBtn.on('pointerout', () => decBtn.setScale(1));

    // Percentage
    const pctText = this.add.text(baseX + 210, y, isMuted ? '---' : `${pct}%`, {
      fontFamily: FONT_FAMILY, fontSize: '18px',
      color: isMuted ? '#555555' : COLORS.textPrimary,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    // ► increase
    const incBtn = this.add.text(baseX + 270, y, '►', {
      fontFamily: FONT_FAMILY, fontSize: '20px',
      color: isMuted || pct >= 100 ? '#555555' : COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    incBtn.on('pointerdown', () => {
      if (isMuted) return;
      const newVol = Math.min(1, volume + 0.1);
      if (type === 'bgm') audioManager.setBgmVolume(newVol);
      else audioManager.setSfxVolume(newVol);
      this.showSettings();
    });
    incBtn.on('pointerover', () => incBtn.setScale(1.2));
    incBtn.on('pointerout', () => incBtn.setScale(1));

    // Mute toggle
    const muteLabel = isMuted ? t('system.unmute') : t('system.mute');
    const muteBtn = this.add.text(baseX + 360, y, `[${muteLabel}]`, {
      fontFamily: FONT_FAMILY, fontSize: '16px',
      color: isMuted ? '#ff6666' : '#88ff88',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    muteBtn.on('pointerdown', () => {
      if (type === 'bgm') audioManager.toggleBgmMute();
      else audioManager.toggleSfxMute();
      this.showSettings();
    });
    muteBtn.on('pointerover', () => muteBtn.setScale(1.1));
    muteBtn.on('pointerout', () => muteBtn.setScale(1));

    this.menuContainer.add([decBtn, pctText, incBtn, muteBtn]);
  }

  // ─── Helpers ───

  private clearMenu(): void {
    this.menuContainer.removeAll(true);
    this.menuItems = [];
    this.selectedIndex = 0;
    this.input.keyboard?.removeAllListeners();
    // Re-attach BGM listener after clearing keyboard listeners
    this.input.keyboard?.on('keydown', () => this.ensureBgm());
  }

  private updateMenuHighlight(): void {
    this.menuItems.forEach((text, i) => {
      const label = text.text.replace(/^[► ] /, '');
      if (i === this.selectedIndex) {
        text.setText(`► ${label}`);
        text.setColor(COLORS.textHighlight);
      } else {
        text.setText(`  ${label}`);
        text.setColor(COLORS.textPrimary);
      }
    });
  }

  private startNewGame(): void {
    TransitionEffect.transition(this, 'NameInputScene');
  }

  private loadGame(): void {
    this.clearMenu();

    const allSaves = SaveLoadSystem.getAllSaves();
    if (allSaves.length === 0) {
      this.showMainMenu();
      return;
    }

    // Sort by timestamp (newest first)
    allSaves.sort((a, b) => b.timestamp - a.timestamp);

    // Title
    this.menuContainer.add(
      this.add.text(GAME_WIDTH / 2, 280, '讀取進度', {
        fontFamily: FONT_FAMILY, fontSize: '22px', color: COLORS.textHighlight,
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5)
    );

    const maxVisible = Math.min(allSaves.length, 6);
    const items: Phaser.GameObjects.Text[] = [];
    let selectedIdx = 0;
    let confirmingDelete = false;

    // Confirmation overlay elements (created lazily)
    let confirmBg: Phaser.GameObjects.Rectangle | null = null;
    let confirmText: Phaser.GameObjects.Text | null = null;
    let confirmHint: Phaser.GameObjects.Text | null = null;

    for (let i = 0; i < maxVisible; i++) {
      const save = allSaves[i];
      const slotLabel = save.slot === -1 ? '自動' : `${save.slot + 1}`;
      const completedMark = save.gameCompleted ? ' ★通關' : '';
      const label = `${save.heroName} [${slotLabel}]  Lv.${save.level}  ${save.playTime}${completedMark}`;
      const y = 330 + i * 40;
      const text = this.add.text(GAME_WIDTH / 2, y, `  ${label}`, {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      text.on('pointerover', () => {
        if (confirmingDelete) return;
        selectedIdx = i; updateHighlight();
      });
      text.on('pointerdown', () => {
        if (confirmingDelete) return;
        doLoad(i);
      });
      items.push(text);
      this.menuContainer.add(text);
    }

    const updateHighlight = () => {
      items.forEach((t, j) => {
        const raw = t.text.replace(/^[► ] /, '');
        t.setText(j === selectedIdx ? `► ${raw}` : `  ${raw}`);
        t.setColor(j === selectedIdx ? COLORS.textHighlight : COLORS.textPrimary);
      });
    };
    updateHighlight();

    const doLoad = (i: number) => {
      const save = allSaves[i];
      if (SaveLoadSystem.loadByKey(save.storageKey)) {
        TransitionEffect.transition(this, 'WorldMapScene');
      }
    };

    const showDeleteConfirm = () => {
      if (confirmingDelete) return;
      confirmingDelete = true;
      const save = allSaves[selectedIdx];
      const slotLabel = save.slot === -1 ? '自動' : `${save.slot + 1}`;

      confirmBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 420, 130, 0x000000, 0.85);
      confirmBg.setStrokeStyle(2, 0xff4444);
      confirmText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20,
        `確定刪除「${save.heroName} [${slotLabel}]」的紀錄嗎？`, {
          fontFamily: FONT_FAMILY, fontSize: '18px', color: '#ff6666',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5);
      confirmHint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20,
        'Enter 確認刪除 ｜ ESC 取消', {
          fontFamily: FONT_FAMILY, fontSize: '15px', color: '#dddddd',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
      this.menuContainer.add([confirmBg, confirmText, confirmHint]);
    };

    const hideDeleteConfirm = () => {
      confirmingDelete = false;
      if (confirmBg) { confirmBg.destroy(); confirmBg = null; }
      if (confirmText) { confirmText.destroy(); confirmText = null; }
      if (confirmHint) { confirmHint.destroy(); confirmHint = null; }
    };

    const executeDelete = () => {
      const save = allSaves[selectedIdx];
      SaveLoadSystem.deleteByKey(save.storageKey);
      hideDeleteConfirm();
      // Refresh the save list
      this.loadGame();
    };

    // Back button
    const backBtn = this.add.text(GAME_WIDTH / 2, 330 + maxVisible * 40 + 20, `← 返回`, {
      fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      if (confirmingDelete) return;
      this.showMainMenu();
    });
    this.menuContainer.add(backBtn);

    // Controls hint
    this.menuContainer.add(
      this.add.text(GAME_WIDTH / 2, 330 + maxVisible * 40 + 55, '↑↓ 選擇 ｜ Enter 讀取 ｜ D 刪除 ｜ ESC 返回', {
        fontFamily: FONT_FAMILY, fontSize: '13px', color: '#888888',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5)
    );

    // Keyboard navigation
    this.time.delayedCall(200, () => {
      this.input.keyboard?.on('keydown-UP', () => {
        if (confirmingDelete) return;
        selectedIdx = (selectedIdx - 1 + maxVisible) % maxVisible;
        updateHighlight();
        audioManager.playSfx('select');
      });
      this.input.keyboard?.on('keydown-DOWN', () => {
        if (confirmingDelete) return;
        selectedIdx = (selectedIdx + 1) % maxVisible;
        updateHighlight();
        audioManager.playSfx('select');
      });
      this.input.keyboard?.on('keydown-ENTER', () => {
        if (confirmingDelete) { executeDelete(); return; }
        doLoad(selectedIdx);
      });
      this.input.keyboard?.on('keydown-SPACE', () => {
        if (confirmingDelete) return;
        doLoad(selectedIdx);
      });
      this.input.keyboard?.on('keydown-D', () => {
        if (confirmingDelete) return;
        showDeleteConfirm();
      });
      this.input.keyboard?.on('keydown-DELETE', () => {
        if (confirmingDelete) return;
        showDeleteConfirm();
      });
      this.input.keyboard?.on('keydown-ESC', () => {
        if (confirmingDelete) { hideDeleteConfirm(); return; }
        this.showMainMenu();
      });
    });
  }
}
