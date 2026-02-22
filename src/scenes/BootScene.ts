import Phaser from 'phaser';
import { ArtRegistry } from '../art/index';

/** Generate all game textures during boot, then proceed to title */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    // Generate all procedural art textures
    ArtRegistry.generateAll(this);
    this.scene.start('TitleScene');
  }
}
