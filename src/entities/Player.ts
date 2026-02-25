import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { DEPTH } from '../utils/constants';

const SPEED = 160;

/** Player sprite with 4-directional walk animation */
export class Player extends Phaser.GameObjects.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private moving = false;
  private stepCallback?: () => void;
  private stepInterval = TILE_SIZE; // pixels per "step"
  private distanceSinceLastStep = 0;
  private textureKey: string;
  private facing: 'down' | 'left' | 'right' | 'up' = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string = 'char_hero') {
    super(scene, x, y, textureKey, 0);
    this.textureKey = textureKey;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.player);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    // Adjust body size to be slightly smaller than visual
    body.setSize(16, 16);
    body.setOffset(8, 30); // centered in 32×48 sprite: (32-16)/2=8, 48-16-2=30

    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = {
        up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }
  }

  onStep(callback: () => void): void {
    this.stepCallback = callback;
  }

  update(_time: number, delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    let vx = 0;
    let vy = 0;

    const left = this.cursors?.left.isDown || this.wasd?.left.isDown;
    const right = this.cursors?.right.isDown || this.wasd?.right.isDown;
    const up = this.cursors?.up.isDown || this.wasd?.up.isDown;
    const down = this.cursors?.down.isDown || this.wasd?.down.isDown;

    if (left) { vx = -SPEED; this.facing = 'left'; }
    else if (right) { vx = SPEED; this.facing = 'right'; }

    if (up) { vy = -SPEED; if (vx === 0) this.facing = 'up'; }
    else if (down) { vy = SPEED; if (vx === 0) this.facing = 'down'; }

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }

    body.setVelocity(vx, vy);
    this.moving = vx !== 0 || vy !== 0;

    // Animation
    const walkAnim = `${this.textureKey}_walk_${this.facing}`;
    const idleAnim = `${this.textureKey}_idle_${this.facing}`;

    if (this.moving) {
      if (this.anims.currentAnim?.key !== walkAnim) {
        this.play(walkAnim, true);
      }
    } else {
      if (!this.anims.currentAnim || this.anims.currentAnim.key !== idleAnim) {
        this.play(idleAnim, true);
      }
    }

    // Track steps
    if (this.moving) {
      const dist = Math.sqrt(vx * vx + vy * vy) * (delta / 1000);
      this.distanceSinceLastStep += dist;
      if (this.distanceSinceLastStep >= this.stepInterval) {
        this.distanceSinceLastStep -= this.stepInterval;
        this.stepCallback?.();
      }
    }
  }

  isMoving(): boolean {
    return this.moving;
  }

  setGridPosition(gx: number, gy: number): void {
    this.setPosition(gx * TILE_SIZE + TILE_SIZE / 2, gy * TILE_SIZE + TILE_SIZE / 2);
  }

  getGridPosition(): { gx: number; gy: number } {
    return {
      gx: Math.floor(this.x / TILE_SIZE),
      gy: Math.floor(this.y / TILE_SIZE),
    };
  }
}
