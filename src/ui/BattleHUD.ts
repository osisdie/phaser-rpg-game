import Phaser from 'phaser';
import type { CombatantState } from '../types';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';

interface BarDisplay {
  frame: Phaser.GameObjects.Image | null;
  bg: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

const STATUS_LABELS: Record<string, { symbol: string; color: string }> = {
  poison: { symbol: '毒', color: '#cc66ff' },
  paralysis: { symbol: '痺', color: '#ffee44' },
  confusion: { symbol: '混', color: '#ff88cc' },
};

/** Battle HUD showing HP/MP bars for party and enemy info */
export class BattleHUD extends Phaser.GameObjects.Container {
  private partyBars: { name: Phaser.GameObjects.Text; hp: BarDisplay; mp: BarDisplay; statusText: Phaser.GameObjects.Text }[] = [];
  private enemyTexts: Phaser.GameObjects.Text[] = [];
  /** Smooth display ratios — lerp toward target for per-hit animation */
  private displayRatios = new Map<BarDisplay, number>();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(DEPTH.ui);
  }

  setupParty(party: CombatantState[]): void {
    // Clear existing
    this.partyBars.forEach(b => {
      b.name.destroy(); b.hp.bg.destroy(); b.hp.fill.destroy(); b.hp.text.destroy();
      b.hp.frame?.destroy();
      b.mp.bg.destroy(); b.mp.fill.destroy(); b.mp.text.destroy();
      b.mp.frame?.destroy();
      b.statusText.destroy();
    });
    this.partyBars = [];
    this.displayRatios.clear();

    const startX = GAME_WIDTH - 290;
    const startY = GAME_HEIGHT - 185;

    party.forEach((member, i) => {
      const y = startY + i * 58;
      const name = this.scene.add.text(startX, y, member.name, {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      });

      const hp = this.createBar(startX, y + 18, 170, 12, COLORS.hpBar);
      const mp = this.createBar(startX, y + 34, 170, 8, COLORS.mpBar);

      // Status effect text next to name
      const statusText = this.scene.add.text(startX + 85, y, '', {
        fontFamily: FONT_FAMILY, fontSize: '12px', color: '#cc66ff',
        stroke: '#000000', strokeThickness: 2,
      });

      // Initialize display ratios to current values
      this.displayRatios.set(hp, member.stats.hp / member.stats.maxHP);
      this.displayRatios.set(mp, member.stats.mp / member.stats.maxMP);

      const children: Phaser.GameObjects.GameObject[] = [name, hp.bg, hp.fill, hp.text, mp.bg, mp.fill, mp.text, statusText];
      if (hp.frame) children.push(hp.frame);
      if (mp.frame) children.push(mp.frame);
      this.add(children);
      this.partyBars.push({ name, hp, mp, statusText });
    });
  }

  setupEnemies(_enemies: CombatantState[]): void {
    // Enemy HP now displayed as floating bars in BattleScene
    this.enemyTexts.forEach(t => t.destroy());
    this.enemyTexts = [];
  }

  updateDisplay(party: CombatantState[], _enemies: CombatantState[], _turn: number): void {

    party.forEach((member, i) => {
      if (!this.partyBars[i]) return;
      const bar = this.partyBars[i];
      bar.name.setText(member.name);
      this.updateBar(bar.hp, member.stats.hp, member.stats.maxHP, `HP ${member.stats.hp}/${member.stats.maxHP}`);
      this.updateBar(bar.mp, member.stats.mp, member.stats.maxMP, `MP ${member.stats.mp}/${member.stats.maxMP}`);

      // Status effects display
      const statusLabels = member.statusEffects
        .map(eff => STATUS_LABELS[eff.type])
        .filter(Boolean);
      if (statusLabels.length > 0) {
        bar.statusText.setText(statusLabels.map(s => s!.symbol).join(' '));
        bar.statusText.setColor(statusLabels[0]!.color);
        bar.statusText.setVisible(true);
      } else {
        bar.statusText.setVisible(false);
      }

      // Dim dead members
      const alive = member.stats.hp > 0;
      bar.name.setAlpha(alive ? 1 : 0.4);
    });

    // Enemy HP bars are managed by BattleScene (floating above sprites)
  }

  private createBar(x: number, y: number, width: number, height: number, color: number): BarDisplay {
    const bg = this.scene.add.rectangle(x + width / 2, y + height / 2, width, height, 0x2a2a3a)
      .setStrokeStyle(1, 0x555566);
    const fill = this.scene.add.rectangle(x + width / 2, y + height / 2, width, height, color);

    // Use metal bar frame texture if available
    let frame: Phaser.GameObjects.Image | null = null;
    const frameKey = height >= 10 ? 'ui_bar_frame_hp' : 'ui_bar_frame_mp';
    if (this.scene.textures.exists(frameKey)) {
      frame = this.scene.add.image(x + width / 2, y + height / 2, frameKey)
        .setDisplaySize(width + 4, height + 4);
    }

    const text = this.scene.add.text(x + width + 8, y - 2, '', {
      fontFamily: FONT_FAMILY, fontSize: '12px', color: COLORS.textSecondary,
      stroke: '#000000', strokeThickness: 2,
    }).setResolution(2);
    return { frame, bg, fill, text };
  }

  private updateBar(bar: BarDisplay, current: number, max: number, label: string): void {
    const targetRatio = Math.max(0, current / max);
    const barWidth = bar.bg.width;

    // Smooth lerp: display ratio moves toward target at a fixed rate
    const prevRatio = this.displayRatios.get(bar) ?? targetRatio;
    const lerpSpeed = 0.025; // ~2.5% per frame ≈ 0.7s for full bar drain at 60fps
    let newRatio: number;
    if (Math.abs(prevRatio - targetRatio) <= lerpSpeed) {
      newRatio = targetRatio;
    } else {
      newRatio = prevRatio + (targetRatio < prevRatio ? -lerpSpeed : lerpSpeed);
    }
    this.displayRatios.set(bar, newRatio);

    const width = barWidth * newRatio;
    bar.fill.setSize(Math.max(0, width), bar.fill.height);
    bar.fill.setX(bar.bg.x - barWidth / 2 + width / 2);
    bar.text.setText(label);
  }
}
