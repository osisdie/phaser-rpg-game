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

    // ── HD Background ──
    this.drawHDBackground();

    // Version
    this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'v0.1.0', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: '#666666',
    }).setOrigin(1, 1);

    // Menu container
    this.menuContainer = this.add.container(0, 0);
    this.showMainMenu();

    // Fade in
    TransitionEffect.fadeIn(this);

    // Start BGM on first user interaction (browser autoplay policy)
    this.input.on('pointerdown', () => this.ensureBgm());
    this.input.keyboard?.on('keydown', () => this.ensureBgm());
  }

  // ─── HD Background ───

  private drawHDBackground(): void {
    // ── Multi-layer gradient sky ──
    // Deep space at top → dark blue → purple → warm amber at horizon
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = GAME_WIDTH;
    skyCanvas.height = GAME_HEIGHT;
    const skyCtx = skyCanvas.getContext('2d')!;

    const skyGrad = skyCtx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    skyGrad.addColorStop(0, '#050510');     // deep space
    skyGrad.addColorStop(0.2, '#0a0a2e');   // dark blue
    skyGrad.addColorStop(0.45, '#151540');   // midnight blue
    skyGrad.addColorStop(0.65, '#2a1a3a');   // dark purple
    skyGrad.addColorStop(0.82, '#3a2030');   // warm purple
    skyGrad.addColorStop(0.92, '#4a2a28');   // warm amber
    skyGrad.addColorStop(1, '#0a0a0a');      // dark ground
    skyCtx.fillStyle = skyGrad;
    skyCtx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // ── Aurora / nebula color patches ──
    const nebulae = [
      { x: 200, y: 120, rx: 180, ry: 60, color: '40,80,120', alpha: 0.06 },
      { x: 700, y: 80, rx: 150, ry: 50, color: '60,30,80', alpha: 0.05 },
      { x: 400, y: 200, rx: 200, ry: 40, color: '30,50,100', alpha: 0.04 },
      { x: 150, y: 300, rx: 120, ry: 80, color: '50,20,60', alpha: 0.04 },
    ];
    for (const n of nebulae) {
      const ng = skyCtx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.rx);
      ng.addColorStop(0, `rgba(${n.color},${n.alpha})`);
      ng.addColorStop(1, `rgba(${n.color},0)`);
      skyCtx.fillStyle = ng;
      skyCtx.fillRect(n.x - n.rx, n.y - n.ry, n.rx * 2, n.ry * 2);
    }

    // ── Moon ──
    const moonX = 780, moonY = 100, moonR = 35;
    // Moon glow
    const moonGlow = skyCtx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 3);
    moonGlow.addColorStop(0, 'rgba(200,210,240,0.12)');
    moonGlow.addColorStop(0.5, 'rgba(150,160,200,0.04)');
    moonGlow.addColorStop(1, 'rgba(100,100,150,0)');
    skyCtx.fillStyle = moonGlow;
    skyCtx.fillRect(moonX - moonR * 3, moonY - moonR * 3, moonR * 6, moonR * 6);
    // Moon body
    skyCtx.fillStyle = '#dde0f0';
    skyCtx.beginPath();
    skyCtx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    skyCtx.fill();
    // Moon craters (subtle)
    skyCtx.fillStyle = 'rgba(180,185,210,0.5)';
    skyCtx.beginPath();
    skyCtx.arc(moonX - 8, moonY - 5, 8, 0, Math.PI * 2);
    skyCtx.fill();
    skyCtx.beginPath();
    skyCtx.arc(moonX + 10, moonY + 8, 5, 0, Math.PI * 2);
    skyCtx.fill();
    skyCtx.beginPath();
    skyCtx.arc(moonX + 2, moonY - 12, 4, 0, Math.PI * 2);
    skyCtx.fill();

    // ── Distant mountains (layered silhouettes) ──
    // Far mountains (lighter)
    skyCtx.fillStyle = '#12102a';
    this.drawMountainRange(skyCtx, GAME_HEIGHT - 260, 0.4, 80, 60);
    // Mid mountains (darker)
    skyCtx.fillStyle = '#0e0c22';
    this.drawMountainRange(skyCtx, GAME_HEIGHT - 210, 0.6, 100, 70);
    // Near mountains (darkest)
    skyCtx.fillStyle = '#0a0a1a';
    this.drawMountainRange(skyCtx, GAME_HEIGHT - 170, 0.8, 120, 50);

    // ── Horizon glow (beneath mountains) ──
    const horizonGlow = skyCtx.createLinearGradient(0, GAME_HEIGHT - 200, 0, GAME_HEIGHT - 130);
    horizonGlow.addColorStop(0, 'rgba(180,100,60,0)');
    horizonGlow.addColorStop(0.5, 'rgba(180,100,60,0.05)');
    horizonGlow.addColorStop(1, 'rgba(180,100,60,0)');
    skyCtx.fillStyle = horizonGlow;
    skyCtx.fillRect(0, GAME_HEIGHT - 200, GAME_WIDTH, 70);

    // Register and display the sky texture
    if (!this.textures.exists('title_sky_bg')) {
      const tex = this.textures.addCanvas('title_sky_bg', skyCanvas);
      tex?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'title_sky_bg');

    // ── Stars (layered: many dim, some medium, few bright) ──
    // Dim stars
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT * 0.55;
      const size = Math.random() * 1.2 + 0.3;
      const alpha = Math.random() * 0.3 + 0.15;
      const star = this.add.circle(x, y, size, 0xffffff, alpha);
      this.tweens.add({
        targets: star, alpha: { from: alpha, to: alpha * 0.3 },
        duration: 1500 + Math.random() * 3000, yoyo: true, repeat: -1,
      });
    }
    // Bright stars (with glow)
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT * 0.4;
      // Glow halo
      this.add.circle(x, y, 4, 0xaabbff, 0.08);
      // Star core
      const star = this.add.circle(x, y, 1.5, 0xffffff, 0.7 + Math.random() * 0.3);
      this.tweens.add({
        targets: star, alpha: { from: star.alpha, to: 0.3 },
        duration: 800 + Math.random() * 1500, yoyo: true, repeat: -1,
      });
    }

    // ── Castle silhouette (HD version) ──
    if (this.textures.exists('title_castle')) {
      const castle = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 175, 'title_castle').setAlpha(0.85);
      castle.setScale(1.0);
    }

    // ── Foreground ground with grass detail ──
    const ground = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 25, GAME_WIDTH, 50, 0x0a0a0a);
    ground.setAlpha(1);

    // Grass tufts along the ground line
    for (let i = 0; i < 80; i++) {
      const gx = Math.random() * GAME_WIDTH;
      const gy = GAME_HEIGHT - 48 - Math.random() * 8;
      const gh = 3 + Math.random() * 6;
      const grass = this.add.rectangle(gx, gy, 1, gh, 0x0a0a0a, 0.7);
      grass.setOrigin(0.5, 1);
    }

    // ── Torch / fire glow effects on sides ──
    for (const tx of [GAME_WIDTH * 0.15, GAME_WIDTH * 0.85]) {
      // Wide ambient glow
      const ambientGlow = this.add.circle(tx, GAME_HEIGHT - 120, 60, 0xff8844, 0.06);
      this.tweens.add({
        targets: ambientGlow, alpha: { from: 0.06, to: 0.03 }, scale: { from: 1, to: 1.15 },
        duration: 700 + Math.random() * 400, yoyo: true, repeat: -1,
      });
      // Tight bright glow
      const coreGlow = this.add.circle(tx, GAME_HEIGHT - 120, 20, 0xffcc66, 0.12);
      this.tweens.add({
        targets: coreGlow, alpha: { from: 0.12, to: 0.06 }, scale: { from: 1, to: 0.85 },
        duration: 500 + Math.random() * 300, yoyo: true, repeat: -1,
      });
    }

    // ── Floating particles (fireflies / dust motes) ──
    for (let i = 0; i < 20; i++) {
      const px = Math.random() * GAME_WIDTH;
      const py = GAME_HEIGHT * 0.35 + Math.random() * GAME_HEIGHT * 0.45;
      const size = Math.random() * 1.5 + 0.5;
      const color = Math.random() > 0.5 ? 0xffdd88 : 0xaaccff;
      const particle = this.add.circle(px, py, size, color, 0);
      this.tweens.add({
        targets: particle,
        alpha: { from: 0, to: 0.15 + Math.random() * 0.15 },
        x: px + (Math.random() - 0.5) * 40,
        y: py - 10 - Math.random() * 20,
        duration: 3000 + Math.random() * 4000,
        yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // ── Title text ──
    // Title glow (behind text)
    this.add.text(GAME_WIDTH / 2, 161, t('title.game_name'), {
      fontFamily: FONT_FAMILY, fontSize: '56px', color: '#332200',
      stroke: '#000000', strokeThickness: 12,
    }).setOrigin(0.5).setAlpha(0.3);

    // Title text
    const titleText = this.add.text(GAME_WIDTH / 2, 160, t('title.game_name'), {
      fontFamily: FONT_FAMILY, fontSize: '56px', color: '#ffeedd',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    // Gentle floating animation on title
    this.tweens.add({
      targets: titleText, y: 158,
      duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Subtitle
    this.add.text(GAME_WIDTH / 2, 220, t('title.subtitle'), {
      fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8888aa',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
  }

  /** Draw a procedural mountain range silhouette */
  private drawMountainRange(
    ctx: CanvasRenderingContext2D, baseY: number, roughness: number,
    maxPeakH: number, spacing: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(0, GAME_HEIGHT);

    let x = 0;
    while (x < GAME_WIDTH) {
      const peakH = maxPeakH * (0.4 + Math.random() * 0.6) * roughness;
      const peakX = x + spacing * (0.5 + Math.random() * 0.5);
      const nextX = peakX + spacing * (0.5 + Math.random() * 0.5);

      ctx.lineTo(x, baseY);
      ctx.lineTo(peakX, baseY - peakH);
      ctx.lineTo(nextX, baseY - peakH * (0.2 + Math.random() * 0.3));

      x = nextX;
    }
    ctx.lineTo(GAME_WIDTH, baseY);
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT);
    ctx.closePath();
    ctx.fill();
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
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
      text.setInteractive({ useHandCursor: true });
      text.on('pointerover', () => { this.selectedIndex = i; this.updateMenuHighlight(); });
      text.on('pointerdown', () => item.action());
      this.menuItems.push(text);
      this.menuContainer.add(text);
    });

    this.updateMenuHighlight();

    // Keyboard
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

    const delBtns: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < maxVisible; i++) {
      const save = allSaves[i];
      const slotLabel = save.slot === -1 ? '自動' : `${save.slot + 1}`;
      const completedMark = save.gameCompleted ? ' ★通關' : '';
      const label = `${save.heroName} [${slotLabel}]  Lv.${save.level}  ${save.playTime}${completedMark}`;
      const y = 330 + i * 40;
      const text = this.add.text(180, y, `  ${label}`, {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

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

      // Visible [刪除] button
      const delBtn = this.add.text(790, y, '[刪除]', {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: '#aa6666',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      delBtn.on('pointerover', () => { delBtn.setColor('#ff6666'); });
      delBtn.on('pointerout', () => { delBtn.setColor('#aa6666'); });
      delBtn.on('pointerdown', () => {
        if (confirmingDelete) return;
        selectedIdx = i; updateHighlight(); showDeleteConfirm();
      });
      delBtns.push(delBtn);
      this.menuContainer.add(delBtn);
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

    let deletePhase = 0; // 0=not confirming, 1=first confirm, 2=final confirm
    let deleteReady = false; // Prevents immediate confirm in phase 2

    const showDeleteConfirm = () => {
      if (confirmingDelete) return;
      confirmingDelete = true;
      deletePhase = 1;
      const save = allSaves[selectedIdx];
      const slotLabel = save.slot === -1 ? '自動' : `${save.slot + 1}`;

      confirmBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 440, 140, 0x000000, 0.9);
      confirmBg.setStrokeStyle(2, 0xff4444);
      confirmText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25,
        `確定刪除「${save.heroName} [${slotLabel}]」的紀錄嗎？`, {
          fontFamily: FONT_FAMILY, fontSize: '18px', color: '#ff6666',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5);
      confirmHint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 15,
        'Enter 確認 ｜ ESC 取消', {
          fontFamily: FONT_FAMILY, fontSize: '15px', color: '#dddddd',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
      this.menuContainer.add([confirmBg, confirmText, confirmHint]);
    };

    const showFinalConfirm = () => {
      deletePhase = 2;
      deleteReady = false;
      if (confirmText) confirmText.setText('⚠ 此操作不可復原！');
      if (confirmHint) {
        confirmHint.setText('請稍候…');
        confirmHint.setColor('#888888');
      }
      // Delay before enabling final confirm
      this.time.delayedCall(1500, () => {
        deleteReady = true;
        if (confirmHint) {
          confirmHint.setText('Enter 確認刪除 ｜ ESC 取消');
          confirmHint.setColor('#ff8888');
        }
      });
    };

    const hideDeleteConfirm = () => {
      confirmingDelete = false;
      deletePhase = 0;
      deleteReady = false;
      if (confirmBg) { confirmBg.destroy(); confirmBg = null; }
      if (confirmText) { confirmText.destroy(); confirmText = null; }
      if (confirmHint) { confirmHint.destroy(); confirmHint = null; }
    };

    const executeDelete = () => {
      const save = allSaves[selectedIdx];
      SaveLoadSystem.deleteByKey(save.storageKey);
      hideDeleteConfirm();
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
        if (confirmingDelete) {
          if (deletePhase === 1) { showFinalConfirm(); return; }
          if (deletePhase === 2 && deleteReady) { executeDelete(); return; }
          return;
        }
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
