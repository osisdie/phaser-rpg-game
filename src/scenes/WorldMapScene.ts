import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { buildWorldMapNodes, getWorldConnections } from '../maps/WorldMapData';
import type { WorldNode } from '../maps/WorldMapData';
import { TransitionEffect } from '../ui/TransitionEffect';
import { ProgressUI } from '../ui/ProgressUI';
import { audioManager } from '../systems/AudioManager';
import { getNodeIconKey } from '../art/worldmap/WorldMapRenderer';
import { COLORS as COLOR_HEX, FONT_FAMILY as FONT } from '../utils/constants';

/** Demon Lord taunts shown when ≥1 kingdom liberated */
const DEMON_TAUNTS = [
  '哈哈哈...你以為解放幾個王國就能打敗我？',
  '可笑的勇者...你們的反抗毫無意義！',
  '黑暗永遠不會消失...我在魔王城等著你們！',
  '越來越近了嗎？來吧...我會讓你後悔的！',
  '區區凡人...也敢挑戰我的權威？',
  '你的同伴們...最終都會倒在我腳下！',
  '這個世界已經屬於我...你改變不了什麼！',
  '盡管掙扎吧...結局早已註定！',
];

export class WorldMapScene extends Phaser.Scene {
  private nodes: WorldNode[] = [];
  private nodeSprites: Phaser.GameObjects.Container[] = [];
  private selectedIndex = 0;
  private cursor!: Phaser.GameObjects.Triangle;
  private infoText!: Phaser.GameObjects.Text;
  private progressUI!: ProgressUI;
  private tauntTimer?: Phaser.Time.TimerEvent;
  private demonNode?: WorldNode;

  constructor() {
    super('WorldMapScene');
  }

  create(): void {
    // Reset state on re-entry
    this.nodeSprites = [];
    this.selectedIndex = 0;

    gameState.setCurrentScene('WorldMapScene');

    // Parchment background
    if (this.textures.exists('worldmap_bg')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'worldmap_bg');
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a2a1a);
    }

    // Title
    this.add.text(GAME_WIDTH / 2, 20, t('world.title'), {
      fontFamily: FONT_FAMILY, fontSize: '20px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0);

    // Build nodes
    this.nodes = buildWorldMapNodes();
    const connections = getWorldConnections();

    // Draw connections — aged ink style on parchment
    const graphics = this.add.graphics();
    for (const conn of connections) {
      const from = this.nodes.find(n => n.region.id === conn.from.id);
      const to = this.nodes.find(n => n.region.id === conn.to.id);
      if (from && to) {
        // Dashed road-style line
        graphics.lineStyle(3, 0x8a7a5a, 0.6);
        graphics.lineBetween(from.screenX, from.screenY, to.screenX, to.screenY);
        graphics.lineStyle(1, 0x6a5a3a, 0.4);
        graphics.lineBetween(from.screenX + 1, from.screenY + 1, to.screenX + 1, to.screenY + 1);
      }
    }

    // Draw landscape decorations around each node (before nodes so they appear behind)
    this.nodes.forEach((node) => {
      const rid = node.region.id;
      const sx = node.screenX;
      const sy = node.screenY;

      // Small thematic decorations around each node
      const decoCount = 3 + Math.floor(Math.random() * 3);
      for (let d = 0; d < decoCount; d++) {
        const angle = (d / decoCount) * Math.PI * 2 + Math.random() * 0.8;
        const dist = 28 + Math.random() * 20;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;

        let decoKey = 'deco_bush_green';
        if (rid.includes('elf') || rid.includes('treant')) decoKey = Math.random() > 0.5 ? `deco_tree_${rid}` : `deco_bush_${rid}`;
        else if (rid.includes('merfolk') || rid.includes('hotspring')) decoKey = Math.random() > 0.4 ? 'deco_water' : 'deco_rock';
        else if (rid.includes('volcano')) decoKey = Math.random() > 0.4 ? 'deco_rock_dark' : 'deco_large_rock';
        else if (rid.includes('undead') || rid.includes('demon')) decoKey = Math.random() > 0.5 ? 'deco_stump' : 'deco_rock_dark';
        else if (rid.includes('mountain') || rid.includes('giant')) decoKey = Math.random() > 0.5 ? 'deco_large_rock' : 'deco_rock';
        else if (rid.includes('dwarf')) decoKey = Math.random() > 0.5 ? 'deco_rock' : 'deco_large_rock';
        else decoKey = Math.random() > 0.5 ? `deco_tree_${rid}` : 'deco_flowers';

        if (this.textures.exists(decoKey)) {
          this.add.image(sx + dx, sy + dy, decoKey)
            .setScale(0.35 + Math.random() * 0.2)
            .setAlpha(node.accessible ? 0.7 : 0.2);
        }
      }
    });

    // Draw nodes with visual status indicators (no text labels for status)
    this.nodes.forEach((node, i) => {
      const container = this.add.container(node.screenX, node.screenY);

      // ── Visual status: determine node state ──
      const isLiberated = node.liberated;
      const isOccupied = node.visited && !node.liberated;
      const isUnexplored = !node.accessible;
      const isAccessibleNew = node.accessible && !node.visited && !node.liberated;

      // Region node icon
      const iconKey = getNodeIconKey(node.region.id);
      let nodeVisual: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;

      if (this.textures.exists(iconKey)) {
        nodeVisual = this.add.image(0, 0, iconKey);
        if (isUnexplored) {
          // Greyed out + fog overlay
          nodeVisual.setTint(0x555555).setAlpha(0.35);
        } else if (isOccupied) {
          // Dark red tint + desaturated
          nodeVisual.setTint(0xcc4444).setAlpha(0.85);
        } else if (isLiberated) {
          // Full color, bright
          nodeVisual.setAlpha(1);
        } else {
          nodeVisual.setAlpha(node.accessible ? 1 : 0.3);
        }
      } else {
        const size = node.region.type === 'final' ? 20 : node.region.type === 'side' ? 12 : 16;
        const color = isUnexplored ? 0x444444 : isOccupied ? 0x882222 : (node.visited || isLiberated) ? node.region.color : 0x666666;
        const alpha = isUnexplored ? 0.35 : node.accessible ? 1 : 0.3;
        nodeVisual = this.add.circle(0, 0, size, color, alpha);
      }

      // ── Occupied overlay: dark red ring + subtle skull-like cross mark ──
      if (isOccupied) {
        const occGfx = this.add.graphics();
        occGfx.lineStyle(2, 0xcc2222, 0.7);
        occGfx.strokeCircle(0, 0, 22);
        // Small cross/chain marks around node
        occGfx.lineStyle(1, 0x882222, 0.5);
        occGfx.lineBetween(-6, -6, 6, 6);
        occGfx.lineBetween(6, -6, -6, 6);
        container.add(occGfx);
      }

      // ── Unexplored overlay: fog circle ──
      if (isUnexplored) {
        const fogGfx = this.add.graphics();
        fogGfx.fillStyle(0x222222, 0.4);
        fogGfx.fillCircle(0, 0, 24);
        container.add(fogGfx);
      }

      // ── Liberated: golden glow ring + pulse ──
      if (isLiberated) {
        const glowRing = this.add.circle(0, 0, 24, 0xffdd44, 0).setStrokeStyle(2, 0xffcc22, 0.6);
        container.add(glowRing);
        this.tweens.add({
          targets: glowRing,
          alpha: { from: 0.3, to: 0.8 },
          scale: { from: 0.95, to: 1.1 },
          duration: 1800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      // ── Accessible but not visited: beacon pulse to draw attention ──
      if (isAccessibleNew) {
        const beacon = this.add.circle(0, 0, 18, 0xffffff, 0).setStrokeStyle(2, 0x88ccff, 0.5);
        container.add(beacon);
        this.tweens.add({
          targets: beacon,
          scale: { from: 0.8, to: 1.4 },
          alpha: { from: 0.6, to: 0 },
          duration: 1500,
          repeat: -1,
          ease: 'Cubic.easeOut',
        });
      }

      // Floating animation — each node bobs gently at its own phase
      if (node.accessible) {
        const phase = i * 400;
        this.tweens.add({
          targets: nodeVisual,
          y: { from: -2, to: 3 },
          duration: 1500 + Math.random() * 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: phase,
        });
        // Stronger scale pulse for liberated nodes
        if (isLiberated || node.region.type === 'final') {
          this.tweens.add({
            targets: nodeVisual,
            scaleX: { from: 1.0, to: 1.08 },
            scaleY: { from: 1.0, to: 1.08 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: phase + 200,
          });
        }
      }

      // Label (kept — short, necessary for navigation)
      const labelColor = isUnexplored ? '#666666' : isOccupied ? '#cc8888' : isLiberated ? '#ffffcc' : '#ffffff';
      const label = this.add.text(0, 26, node.region.name, {
        fontFamily: FONT_FAMILY, fontSize: '15px', color: labelColor,
        stroke: '#000000', strokeThickness: 4,
        shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true },
      }).setOrigin(0.5, 0);

      // Level range (kept — small, useful)
      const levelColor = isUnexplored ? '#777766' : isOccupied ? '#cc9977' : '#ddddaa';
      const levelText = this.add.text(0, 44, `Lv.${node.region.levelRange[0]}-${node.region.levelRange[1]}`, {
        fontFamily: FONT_FAMILY, fontSize: '13px', color: levelColor,
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 0);

      container.add([nodeVisual, label, levelText]);

      // Alliance flag for liberated kingdoms (kingdom color + hero color)
      if (isLiberated && node.region.type !== 'final' && node.region.id !== 'region_hero') {
        const heroColor = 0x8888cc;
        const flagGfx = this.add.graphics();
        const poleX = 14, poleY = -20;
        flagGfx.lineStyle(1, 0xaaaaaa);
        flagGfx.lineBetween(poleX, poleY, poleX, poleY + 18);
        flagGfx.fillStyle(node.region.color);
        flagGfx.fillRect(poleX + 1, poleY, 10, 5);
        flagGfx.fillStyle(heroColor);
        flagGfx.fillRect(poleX + 1, poleY + 5, 10, 5);
        flagGfx.lineStyle(1, 0xddaa44, 0.6);
        flagGfx.strokeRect(poleX + 1, poleY, 10, 10);
        container.add(flagGfx);
      }

      // Interactivity
      nodeVisual.setInteractive({ useHandCursor: node.accessible });
      nodeVisual.on('pointerdown', () => {
        if (node.accessible) {
          this.selectedIndex = i;
          this.updateCursor();
          this.enterRegion();
        }
      });
      nodeVisual.on('pointerover', () => {
        if (node.accessible) {
          this.selectedIndex = i;
          this.updateCursor();
        }
      });

      this.nodeSprites.push(container);
    });

    // Cursor
    this.cursor = this.add.triangle(0, 0, 0, 0, 10, -16, 20, 0, COLORS.gold);
    this.cursor.setOrigin(0.5, 0);

    // Info text with background for readability
    this.infoText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 65, '', {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: '#ffffff',
      wordWrap: { width: 600 }, align: 'center',
      stroke: '#000000', strokeThickness: 4,
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 3, fill: true },
    }).setOrigin(0.5);

    // Progress
    this.progressUI = new ProgressUI(this, 24, GAME_HEIGHT - 74);
    this.progressUI.refresh();


    // Keyboard
    this.input.keyboard?.on('keydown-LEFT', () => this.navigate(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.navigate(1));
    this.input.keyboard?.on('keydown-UP', () => this.navigate(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.navigate(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.enterRegion());
    this.input.keyboard?.on('keydown-SPACE', () => this.enterRegion());
    this.input.keyboard?.on('keydown-M', () => this.openMenu());
    this.input.keyboard?.on('keydown-ESC', () => this.openMenu());

    // Find initial selection (current region)
    const currentIdx = this.nodes.findIndex(n => n.region.id === gameState.getState().currentRegion);
    if (currentIdx >= 0) this.selectedIndex = currentIdx;

    this.updateCursor();

    // ─── World Map Enhancements ───
    const liberatedCount = gameState.getState().liberatedRegions.length;
    this.demonNode = this.nodes.find(n => n.region.type === 'final');

    // 7A. Slow background particles
    this.spawnBackgroundParticles(liberatedCount);

    // 7B. Demon lord taunts (≥1 kingdom liberated)
    if (this.demonNode && liberatedCount >= 1) {
      this.startDemonTaunts();
    }

    // 7D. Final stage visuals (11 kingdoms liberated)
    if (liberatedCount >= 11) {
      this.applyFinalStageVisuals();
    }

    TransitionEffect.fadeIn(this);

    // 7C. Progressive BGM based on liberation progress
    if (liberatedCount >= 11) {
      audioManager.playBgm('world_dark');
    } else if (liberatedCount >= 8) {
      audioManager.playBgm('world_epic');
    } else if (liberatedCount >= 4) {
      audioManager.playBgm('world_rising');
    } else {
      audioManager.playBgm('field');
    }
  }

  // ─── 7A: Background Particles ───
  private spawnBackgroundParticles(liberatedCount: number): void {
    const isLate = liberatedCount >= 8;
    const particleColor = isLate ? 0xcc6644 : 0xddcc88;

    for (let i = 0; i < 20; i++) {
      const px = Math.random() * GAME_WIDTH;
      const py = Math.random() * GAME_HEIGHT;
      const r = 1 + Math.random();
      const dot = this.add.circle(px, py, r, particleColor, 0.1 + Math.random() * 0.15);
      dot.setDepth(0.5);

      // Gentle sinusoidal drift
      const duration = 8000 + Math.random() * 7000;
      const xAmp = 30 + Math.random() * 50;
      this.tweens.add({
        targets: dot,
        x: { from: px - xAmp, to: px + xAmp },
        y: dot.y - GAME_HEIGHT - 20,
        duration,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * duration,
        onRepeat: () => {
          dot.setPosition(Math.random() * GAME_WIDTH, GAME_HEIGHT + 10);
        },
      });
    }
  }

  // ─── 7B: Demon Lord Taunts (typewriter + darken map + eerie music) ───
  private startDemonTaunts(): void {
    let isTaunting = false;

    const showTaunt = () => {
      if (!this.demonNode || isTaunting) return;
      isTaunting = true;
      const taunt = DEMON_TAUNTS[Math.floor(Math.random() * DEMON_TAUNTS.length)] + '...';
      const dx = Phaser.Math.Clamp(this.demonNode.screenX, 180, GAME_WIDTH - 180);
      const dy = this.demonNode.screenY - 50;

      // Darken the entire map
      const darkOverlay = this.add.rectangle(
        GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0,
      ).setDepth(140);

      // Demon face icon — dark purple silhouette with red eyes
      const iconSize = 28;
      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = iconSize; iconCanvas.height = iconSize;
      const ictx = iconCanvas.getContext('2d')!;
      // Face silhouette
      ictx.fillStyle = '#5511aa';
      ictx.beginPath();
      ictx.ellipse(14, 16, 10, 11, 0, 0, Math.PI * 2);
      ictx.fill();
      // Horns
      ictx.fillStyle = '#440088';
      ictx.beginPath();
      ictx.moveTo(4, 12); ictx.lineTo(1, 2); ictx.lineTo(9, 10); ictx.fill();
      ictx.beginPath();
      ictx.moveTo(24, 12); ictx.lineTo(27, 2); ictx.lineTo(19, 10); ictx.fill();
      // Red eyes
      ictx.fillStyle = '#ff2222';
      ictx.fillRect(9, 14, 3, 2);
      ictx.fillRect(17, 14, 3, 2);
      // Eye glow
      ictx.fillStyle = '#ff6644';
      ictx.fillRect(10, 14, 1, 1);
      ictx.fillRect(18, 14, 1, 1);
      // Mouth
      ictx.fillStyle = '#220044';
      ictx.fillRect(11, 20, 6, 2);
      const demonIconKey = '__demon_taunt_icon';
      if (!this.textures.exists(demonIconKey)) {
        this.textures.addCanvas(demonIconKey, iconCanvas);
      }
      const demonIcon = this.add.image(dx - 160, dy, demonIconKey).setDepth(151).setAlpha(0);
      this.tweens.add({ targets: demonIcon, alpha: 1, duration: 600 });

      // Typewriter text — no box, just floating purple text with stroke
      const text = this.add.text(dx - 130, dy, '', {
        fontFamily: FONT_FAMILY, fontSize: '20px', color: '#cc44ff',
        stroke: '#000000', strokeThickness: 4,
        wordWrap: { width: 400 }, align: 'center',
      }).setOrigin(0, 0.5).setDepth(151);

      // Phase 1: Darken map
      this.tweens.add({
        targets: darkOverlay,
        alpha: 0.5,
        duration: 800,
        ease: 'Sine.easeIn',
      });

      // Fade in eerie music
      audioManager.playBgm('world_dark');

      // Phase 2: Typewriter reveal (character by character)
      let charIndex = 0;
      const typeTimer = this.time.addEvent({
        delay: 80,
        callback: () => {
          charIndex++;
          text.setText(taunt.substring(0, charIndex));
          if (charIndex >= taunt.length) {
            typeTimer.destroy();
            // Phase 3: Hold 2.5s, then fade out
            this.time.delayedCall(2500, () => {
              this.tweens.add({
                targets: [darkOverlay, text, demonIcon],
                alpha: 0,
                duration: 1200,
                onComplete: () => {
                  darkOverlay.destroy();
                  text.destroy();
                  demonIcon.destroy();
                  isTaunting = false;
                  // Restore normal BGM
                  const libCount = gameState.getState().liberatedRegions.length;
                  if (libCount >= 11) audioManager.playBgm('world_dark');
                  else if (libCount >= 8) audioManager.playBgm('world_epic');
                  else if (libCount >= 4) audioManager.playBgm('world_rising');
                  else audioManager.playBgm('field');
                },
              });
            });
          }
        },
        repeat: taunt.length - 1,
      });
    };

    // First taunt after 60s, then every 5–10 min
    this.time.delayedCall(60000, showTaunt);
    this.tauntTimer = this.time.addEvent({
      delay: 300000 + Math.random() * 300000,
      callback: showTaunt,
      loop: true,
    });
  }

  // ─── 7D: Final Stage Visuals ───
  private applyFinalStageVisuals(): void {
    // Dark overlay
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a0a2a, 0.4)
      .setDepth(0.2);

    // Vignette effect (dark gradient at edges)
    const vignette = this.add.graphics().setDepth(0.3);
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.5, 0.5, 0, 0);
    vignette.fillRect(0, 0, GAME_WIDTH, 80);
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.5, 0.5);
    vignette.fillRect(0, GAME_HEIGHT - 80, GAME_WIDTH, 80);

    // Red particle emanation from demon castle
    if (this.demonNode) {
      const dx = this.demonNode.screenX;
      const dy = this.demonNode.screenY;

      // Dark purple aura behind demon castle
      const aura = this.add.circle(dx, dy, 40, 0x440066, 0.3).setDepth(0.4);
      this.tweens.add({
        targets: aura,
        scale: { from: 0.8, to: 1.3 },
        alpha: { from: 0.3, to: 0.1 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
      });

      // Red pulsing particles
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const p = this.add.circle(dx, dy, 2, 0xff2244, 0.6).setDepth(0.5);
        this.tweens.add({
          targets: p,
          x: dx + Math.cos(angle) * 60,
          y: dy + Math.sin(angle) * 60,
          alpha: 0,
          duration: 2000 + Math.random() * 1000,
          repeat: -1,
          delay: i * 200,
          onRepeat: () => p.setPosition(dx, dy).setAlpha(0.6),
        });
      }
    }
  }

  private navigate(dir: number): void {
    const accessible = this.nodes.map((n, i) => ({ n, i })).filter(x => x.n.accessible);
    if (accessible.length === 0) return;

    const currentAccessibleIdx = accessible.findIndex(x => x.i === this.selectedIndex);
    const nextIdx = (currentAccessibleIdx + dir + accessible.length) % accessible.length;
    this.selectedIndex = accessible[nextIdx].i;
    this.updateCursor();
  }

  private updateCursor(): void {
    const node = this.nodes[this.selectedIndex];
    if (!node) return;
    this.cursor.setPosition(node.screenX, node.screenY - 30);

    const desc = node.region.description;
    this.infoText.setText(`${node.region.name}\n${desc}\n${t('world.press_enter')}`);
  }

  private enterRegion(): void {
    const node = this.nodes[this.selectedIndex];
    if (!node?.accessible) return;

    gameState.setCurrentRegion(node.region.id);

    // Demon kingdom: confirmation dialog + cutscene → direct to field
    if (node.region.type === 'final') {
      this.showDemonConfirm(node.region.id);
      return;
    }

    // Enter town first, then player can go to field
    TransitionEffect.transition(this, 'TownScene', { regionId: node.region.id, fromWorldMap: true });
  }

  private showDemonConfirm(regionId: string): void {
    // Overlay
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setDepth(200);
    const panel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 420, 200, 0x1a1a2e, 0.95).setDepth(201);
    const border = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 424, 204, 0x4a4a6e).setDepth(200);

    const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, t('world.demon_confirm'), {
      fontFamily: FONT_FAMILY, fontSize: '18px', color: '#ffffff',
      align: 'center', lineSpacing: 8,
    }).setOrigin(0.5).setDepth(202);

    let selectedBtn = 0;
    const btnLabels = [t('world.demon_confirm_yes'), t('world.demon_confirm_no')];
    const btns = btnLabels.map((label, i) => {
      const btn = this.add.text(GAME_WIDTH / 2 - 80 + i * 160, GAME_HEIGHT / 2 + 50, label, {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: i === 0 ? COLOR_HEX.textHighlight : '#ffffff',
      }).setOrigin(0.5).setDepth(202).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => { selectedBtn = i; updateBtns(); });
      btn.on('pointerdown', () => confirm(i));
      return btn;
    });

    const updateBtns = () => {
      btns.forEach((b, i) => b.setColor(i === selectedBtn ? COLOR_HEX.textHighlight : '#ffffff'));
    };

    const cleanup = () => {
      overlay.destroy(); panel.destroy(); border.destroy(); msg.destroy();
      btns.forEach(b => b.destroy());
      this.input.keyboard?.off('keydown-LEFT', onLeft);
      this.input.keyboard?.off('keydown-RIGHT', onRight);
      this.input.keyboard?.off('keydown-ENTER', onConfirm);
      this.input.keyboard?.off('keydown-SPACE', onConfirm);
      this.input.keyboard?.off('keydown-ESC', onCancel);
    };

    const confirm = (i: number) => {
      cleanup();
      if (i === 0) {
        // Confirmed — play enhanced alliance cutscene with character art
        const heroName = gameState.getState().heroName;
        const state = gameState.getState();
        const partyKeys = ['char_hero_battle', ...state.party.map(id => `char_${id}_battle`)];
        const allCompanionKeys = [
          'char_hero_battle',
          'char_companion_elf_battle', 'char_companion_treant_battle',
          'char_companion_beast_battle', 'char_companion_merfolk_battle',
          'char_companion_giant_battle', 'char_companion_dwarf_battle',
          'char_companion_undead_battle',
        ];
        TransitionEffect.transition(this, 'CutsceneScene', {
          slides: [
            { text: `${heroName}：「是時候了…」`, duration: 3000,
              characters: ['char_hero_battle'], layout: 'center' },
            { text: '夥伴們紛紛趕來…', duration: 3000,
              characters: partyKeys, layout: 'gathering' },
            { text: '七大王國的勇士齊聚一堂', duration: 4000,
              characters: allCompanionKeys, layout: 'gathering' },
            { text: `在 ${heroName} 的帶領下，七國聯軍向魔王城進發！`, duration: 3500,
              characters: allCompanionKeys, layout: 'celebration' },
            { text: '魔王城就在前方…', duration: 3000,
              bgColor: 0x110011 },
            { text: `${heroName}：「讓我們終結這一切！」`, duration: 3000,
              characters: partyKeys, layout: 'center', bgColor: 0x110011 },
          ],
          nextScene: 'FieldScene',
          nextData: { regionId },
        });
      } else {
        audioManager.playSfx('cancel');
      }
    };

    const onLeft = () => { selectedBtn = 0; updateBtns(); audioManager.playSfx('select'); };
    const onRight = () => { selectedBtn = 1; updateBtns(); audioManager.playSfx('select'); };
    const onConfirm = () => confirm(selectedBtn);
    const onCancel = () => { cleanup(); audioManager.playSfx('cancel'); };

    this.input.keyboard?.on('keydown-LEFT', onLeft);
    this.input.keyboard?.on('keydown-RIGHT', onRight);
    this.input.keyboard?.on('keydown-ENTER', onConfirm);
    this.input.keyboard?.on('keydown-SPACE', onConfirm);
    this.input.keyboard?.on('keydown-ESC', onCancel);
  }

  private openMenu(): void {
    this.scene.launch('MenuScene');
    this.scene.pause();
  }
}
