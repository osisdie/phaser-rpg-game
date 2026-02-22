import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { DEPTH } from '../utils/constants';

/** Scene transition effects (fade in/out) */
export class TransitionEffect {
  static fadeOut(scene: Phaser.Scene, duration: number = 500): Promise<void> {
    return new Promise(resolve => {
      const rect = scene.add.rectangle(
        GAME_WIDTH / 2, GAME_HEIGHT / 2,
        GAME_WIDTH, GAME_HEIGHT,
        0x000000, 0
      ).setDepth(DEPTH.transition);

      scene.tweens.add({
        targets: rect,
        alpha: 1,
        duration,
        onComplete: () => resolve(),
      });
    });
  }

  static fadeIn(scene: Phaser.Scene, duration: number = 500): Promise<void> {
    return new Promise(resolve => {
      const rect = scene.add.rectangle(
        GAME_WIDTH / 2, GAME_HEIGHT / 2,
        GAME_WIDTH, GAME_HEIGHT,
        0x000000, 1
      ).setDepth(DEPTH.transition);

      scene.tweens.add({
        targets: rect,
        alpha: 0,
        duration,
        onComplete: () => {
          rect.destroy();
          resolve();
        },
      });
    });
  }

  static async transition(fromScene: Phaser.Scene, toSceneKey: string, data?: object, duration: number = 400): Promise<void> {
    await this.fadeOut(fromScene, duration);
    fromScene.scene.start(toSceneKey, data);
  }
}
