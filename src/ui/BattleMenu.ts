import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { audioManager } from '../systems/AudioManager';

export type MenuAction = 'attack' | 'skill' | 'item' | 'defend' | 'flee';

/** Battle command menu (攻擊/技能/道具/防禦/逃跑) with medieval panel */
export class BattleMenu extends Phaser.GameObjects.Container {
  private buttons: Phaser.GameObjects.Text[] = [];
  private icons: Phaser.GameObjects.Image[] = [];
  private selectedIndex = 0;
  private onSelectCallback?: (action: MenuAction) => void;
  private bg: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private border: Phaser.GameObjects.Rectangle | null = null;
  private enabled = false;
  private autoHint!: Phaser.GameObjects.Text;

  private readonly actions: { key: MenuAction; label: string; icon: string }[] = [
    { key: 'attack', label: t('battle.attack'), icon: 'icon_sword' },
    { key: 'skill', label: t('battle.skill'), icon: 'icon_star' },
    { key: 'item', label: t('battle.item'), icon: 'icon_bag' },
    { key: 'defend', label: t('battle.defend'), icon: 'icon_shield' },
    { key: 'flee', label: t('battle.flee'), icon: 'icon_boot' },
  ];

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(DEPTH.ui + 5);

    const menuX = 110;
    const menuY = GAME_HEIGHT - 210;
    const menuW = 180;
    const menuH = 200;

    // Use battle menu panel texture if available
    if (scene.textures.exists('ui_panel_battle_menu')) {
      this.bg = scene.add.image(menuX, menuY + menuH / 2, 'ui_panel_battle_menu');
      this.add([this.bg]);
    } else {
      this.border = scene.add.rectangle(menuX, menuY + menuH / 2, menuW + 4, menuH + 4, COLORS.panelBorder);
      this.bg = scene.add.rectangle(menuX, menuY + menuH / 2, menuW, menuH, COLORS.panel, 0.95);
      this.add([this.border, this.bg]);
    }

    this.actions.forEach((action, i) => {
      const textX = menuX - menuW / 2 + 36;
      const textY = menuY + 12 + i * 36;

      // Icon next to label
      if (scene.textures.exists(action.icon)) {
        const icon = scene.add.image(menuX - menuW / 2 + 20, textY + 9, action.icon);
        this.icons.push(icon);
        this.add(icon);
      }

      const text = scene.add.text(textX, textY, `  ${action.label}`, {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textPrimary,
      });
      text.setInteractive({ useHandCursor: true });
      text.on('pointerover', () => { this.selectedIndex = i; this.updateDisplay(); });
      text.on('pointerdown', () => { if (this.enabled) this.confirm(); });
      this.buttons.push(text);
      this.add(text);
    });

    // Auto-attack hint below the menu
    this.autoHint = scene.add.text(menuX, menuY + menuH + 8, 'A: 自動攻擊', {
      fontFamily: FONT_FAMILY, fontSize: '11px', color: '#888899',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5, 0);
    this.add(this.autoHint);

    // Keyboard
    scene.input.keyboard?.on('keydown-UP', () => { if (this.enabled) { this.selectedIndex = (this.selectedIndex - 1 + this.actions.length) % this.actions.length; this.updateDisplay(); audioManager.playSfx('select'); } });
    scene.input.keyboard?.on('keydown-DOWN', () => { if (this.enabled) { this.selectedIndex = (this.selectedIndex + 1) % this.actions.length; this.updateDisplay(); audioManager.playSfx('select'); } });
    scene.input.keyboard?.on('keydown-ENTER', () => { if (this.enabled) this.confirm(); });
    scene.input.keyboard?.on('keydown-SPACE', () => { if (this.enabled) this.confirm(); });

    this.setVisible(false);
  }

  show(onSelect: (action: MenuAction) => void): void {
    this.onSelectCallback = onSelect;
    this.selectedIndex = 0;
    this.enabled = true;
    this.setVisible(true);
    this.updateDisplay();
  }

  hide(): void {
    this.enabled = false;
    this.setVisible(false);
  }

  private updateDisplay(): void {
    this.buttons.forEach((btn, i) => {
      if (i === this.selectedIndex) {
        btn.setText(`► ${this.actions[i].label}`);
        btn.setColor(COLORS.textHighlight);
      } else {
        btn.setText(`  ${this.actions[i].label}`);
        btn.setColor(COLORS.textPrimary);
      }
    });
  }

  private confirm(): void {
    this.enabled = false;
    this.onSelectCallback?.(this.actions[this.selectedIndex].key);
  }
}
