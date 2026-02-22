import Phaser from 'phaser';

/** Dialogue overlay scene — currently handled inline in TownScene */
export class DialogueScene extends Phaser.Scene {
  constructor() {
    super('DialogueScene');
  }

  create(): void {
    // Dialogue is handled as overlay in TownScene
    // This scene exists for future standalone dialogue needs
  }
}
