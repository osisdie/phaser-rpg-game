import Phaser from 'phaser';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';
import { gameState } from '../systems/GameStateManager';
import { t } from '../systems/i18n';

/** Progress display showing liberated kingdoms */
export class ProgressUI extends Phaser.GameObjects.Container {
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setDepth(DEPTH.ui);

    this.text = scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: COLORS.textHighlight,
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.add(this.text);
  }

  refresh(): void {
    const count = gameState.getState().liberatedRegions.length;
    this.text.setText(t('progress.kingdoms', count));
  }
}
