import Phaser from 'phaser';
import { DEPTH, FONT_FAMILY } from '../utils/constants';
import { gameState } from '../systems/GameStateManager';
import { getAllRegions } from '../data/regions';

/**
 * Progress display — 3 rows of indicator lights:
 * Row 1: 8 dark-green lights (all main kingdoms, including hero's own)
 * Row 2: 3 dark-blue lights (side quests)
 * Row 3: 1 dark-red light (demon king)
 * Each light up when the corresponding kingdom is liberated.
 */
export class ProgressUI extends Phaser.GameObjects.Container {
  private lights: Phaser.GameObjects.Arc[] = [];
  private glows: Phaser.GameObjects.Arc[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setDepth(DEPTH.ui);
    this.createLights();
  }

  private createLights(): void {
    const R = 5;       // light radius
    const gap = 14;    // horizontal gap between light centers
    const rowGap = 16; // vertical gap between rows
    const labelW = 34; // space reserved for row label
    const labelStyle = { fontFamily: FONT_FAMILY, fontSize: '12px', stroke: '#000000', strokeThickness: 3 };

    // Semi-transparent dark background for readability
    const panelW = labelW + 8 * gap + 10;
    const panelH = rowGap * 2 + 18;
    const bg = this.scene.add.rectangle(panelW / 2 - 6, panelH / 2 - 8, panelW + 8, panelH + 8, 0x000000, 0.5)
      .setOrigin(0.5);
    bg.setStrokeStyle(1, 0x333344);
    this.add(bg);

    // Row 1: Main kingdoms (8 green — includes hero kingdom)
    const r1 = this.scene.add.text(0, 0, '主線', { ...labelStyle, color: '#88cc88' }).setOrigin(0, 0.5);
    this.add(r1);
    for (let i = 0; i < 8; i++) {
      const lx = labelW + i * gap;
      const glow = this.scene.add.circle(lx, 0, R * 2, 0x44ff44, 0);
      const light = this.scene.add.circle(lx, 0, R, 0x1a331a).setStrokeStyle(1, 0x2a4a2a);
      this.add(glow);
      this.add(light);
      this.glows.push(glow);
      this.lights.push(light);
    }

    // Row 2: Side quests (3 blue)
    const r2 = this.scene.add.text(0, rowGap, '支線', { ...labelStyle, color: '#88aadd' }).setOrigin(0, 0.5);
    this.add(r2);
    for (let i = 0; i < 3; i++) {
      const lx = labelW + i * gap;
      const glow = this.scene.add.circle(lx, rowGap, R * 2, 0x4488ff, 0);
      const light = this.scene.add.circle(lx, rowGap, R, 0x1a1a33).setStrokeStyle(1, 0x2a2a4a);
      this.add(glow);
      this.add(light);
      this.glows.push(glow);
      this.lights.push(light);
    }

    // Row 3: Demon king (1 red)
    const r3 = this.scene.add.text(0, rowGap * 2, '魔王', { ...labelStyle, color: '#dd8888' }).setOrigin(0, 0.5);
    this.add(r3);
    const glow = this.scene.add.circle(labelW, rowGap * 2, R * 2, 0xff4444, 0);
    const light = this.scene.add.circle(labelW, rowGap * 2, R, 0x331a1a).setStrokeStyle(1, 0x4a2a2a);
    this.add(glow);
    this.add(light);
    this.glows.push(glow);
    this.lights.push(light);
  }

  refresh(): void {
    const state = gameState.getState();
    const regions = getAllRegions();
    const mainRegions = regions.filter(r => r.type === 'main');
    const sideRegions = regions.filter(r => r.type === 'side');
    const finalRegion = regions.find(r => r.type === 'final');

    // Main lights (indices 0–7)
    mainRegions.forEach((r, i) => {
      if (i >= 8) return;
      const lit = state.liberatedRegions.includes(r.id);
      this.lights[i].setFillStyle(lit ? 0x44ff44 : 0x1a331a);
      this.lights[i].setStrokeStyle(1, lit ? 0x88ff88 : 0x2a4a2a);
      this.glows[i].setAlpha(lit ? 0.25 : 0);
      if (lit) {
        this.scene.tweens.add({
          targets: this.lights[i],
          alpha: { from: 0.85, to: 1 },
          duration: 1500 + i * 100,
          yoyo: true,
          repeat: -1,
        });
      }
    });

    // Side lights (indices 8–10)
    sideRegions.forEach((r, i) => {
      const idx = 8 + i;
      if (idx >= 11) return;
      const lit = state.liberatedRegions.includes(r.id);
      this.lights[idx].setFillStyle(lit ? 0x4488ff : 0x1a1a33);
      this.lights[idx].setStrokeStyle(1, lit ? 0x88bbff : 0x2a2a4a);
      this.glows[idx].setAlpha(lit ? 0.25 : 0);
      if (lit) {
        this.scene.tweens.add({
          targets: this.lights[idx],
          alpha: { from: 0.85, to: 1 },
          duration: 1500 + i * 100,
          yoyo: true,
          repeat: -1,
        });
      }
    });

    // Demon light (index 11)
    if (finalRegion) {
      const lit = state.liberatedRegions.includes(finalRegion.id);
      this.lights[11].setFillStyle(lit ? 0xff4444 : 0x331a1a);
      this.lights[11].setStrokeStyle(1, lit ? 0xff8888 : 0x4a2a2a);
      this.glows[11].setAlpha(lit ? 0.3 : 0);
      if (lit) {
        this.scene.tweens.add({
          targets: this.lights[11],
          alpha: { from: 0.85, to: 1 },
          duration: 1500,
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }
}
