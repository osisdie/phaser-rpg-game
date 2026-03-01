import Phaser from 'phaser';
import { MEDIEVAL, lighten } from '../palettes';
import { ArtRegistry } from '../index';

/** Generates battle effect textures and provides runtime effect methods */
export class BattleEffects {

  static generateAll(scene: Phaser.Scene): void {
    this.generateSlashEffect(scene);
    this.generateMagicParticle(scene);
    this.generateHealParticle(scene);
    this.generateFireParticle(scene);
    this.generateIceParticle(scene);
    this.generateLightningParticle(scene);
    this.generateHitSpark(scene);
    this.generateEnvironmentParticles(scene);
  }

  private static generateSlashEffect(scene: Phaser.Scene): void {
    const key = 'fx_slash';
    if (scene.textures.exists(key)) return;
    const S = 48;
    const { canvas, ctx } = ArtRegistry.createCanvas(S * 2, S * 2);
    ctx.scale(2, 2);

    // Slash arc (bright white-yellow)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.35, -Math.PI * 0.3, Math.PI * 0.8);
    ctx.stroke();

    ctx.strokeStyle = '#ffdd88';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.3, -Math.PI * 0.2, Math.PI * 0.7);
    ctx.stroke();

    // Sparkles along the arc
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI * 0.3 + i * 0.5;
      const r = S * 0.35;
      const px = S / 2 + Math.cos(angle) * r;
      const py = S / 2 + Math.sin(angle) * r;
      ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
    }

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateMagicParticle(scene: Phaser.Scene): void {
    const key = 'fx_magic';
    if (scene.textures.exists(key)) return;
    const S = 8;
    const { canvas, ctx } = ArtRegistry.createCanvas(S * 2, S * 2);
    ctx.scale(2, 2);

    ctx.fillStyle = '#aabbff';
    ctx.fillRect(3, 1, 2, 6);
    ctx.fillRect(1, 3, 6, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 3, 2, 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateHealParticle(scene: Phaser.Scene): void {
    const key = 'fx_heal';
    if (scene.textures.exists(key)) return;
    const S = 8;
    const { canvas, ctx } = ArtRegistry.createCanvas(S * 2, S * 2);
    ctx.scale(2, 2);

    ctx.fillStyle = '#44ff88';
    ctx.fillRect(3, 0, 2, 8);
    ctx.fillRect(0, 3, 8, 2);
    ctx.fillStyle = '#88ffbb';
    ctx.fillRect(3, 3, 2, 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateFireParticle(scene: Phaser.Scene): void {
    const key = 'fx_fire';
    if (scene.textures.exists(key)) return;
    const S = 8;
    const { canvas, ctx } = ArtRegistry.createCanvas(S * 2, S * 2);
    ctx.scale(2, 2);

    ctx.fillStyle = '#ff4422';
    ctx.fillRect(2, 3, 4, 4);
    ctx.fillRect(3, 1, 2, 6);
    ctx.fillStyle = '#ff8844';
    ctx.fillRect(3, 2, 2, 3);
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(3, 3, 2, 1);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateIceParticle(scene: Phaser.Scene): void {
    const key = 'fx_ice';
    if (scene.textures.exists(key)) return;
    const S = 8;
    const { canvas, ctx } = ArtRegistry.createCanvas(S * 2, S * 2);
    ctx.scale(2, 2);

    ctx.fillStyle = '#88ccff';
    ctx.fillRect(3, 0, 2, 8);
    ctx.fillRect(0, 3, 8, 2);
    ctx.fillRect(1, 1, 2, 2);
    ctx.fillRect(5, 1, 2, 2);
    ctx.fillRect(1, 5, 2, 2);
    ctx.fillRect(5, 5, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 3, 2, 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateLightningParticle(scene: Phaser.Scene): void {
    const key = 'fx_lightning';
    if (scene.textures.exists(key)) return;
    const S = 8;
    const { canvas, ctx } = ArtRegistry.createCanvas(S * 2, S * 2);
    ctx.scale(2, 2);

    ctx.fillStyle = '#ffff44';
    // Lightning bolt shape
    ctx.fillRect(4, 0, 2, 3);
    ctx.fillRect(2, 3, 4, 1);
    ctx.fillRect(3, 4, 2, 3);
    ctx.fillRect(3, 7, 3, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, 1, 1, 2);
    ctx.fillRect(3, 4, 1, 2);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateHitSpark(scene: Phaser.Scene): void {
    const key = 'fx_hit';
    if (scene.textures.exists(key)) return;
    const S = 16;
    const { canvas, ctx } = ArtRegistry.createCanvas(S * 2, S * 2);
    ctx.scale(2, 2);

    // Starburst
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7, 2, 2, 12);
    ctx.fillRect(2, 7, 12, 2);
    ctx.fillStyle = '#ffdd88';
    ctx.fillRect(4, 4, 2, 2);
    ctx.fillRect(10, 4, 2, 2);
    ctx.fillRect(4, 10, 2, 2);
    ctx.fillRect(10, 10, 2, 2);
    // Center
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(6, 6, 4, 4);

    ArtRegistry.registerTexture(scene, key, canvas);
  }

  private static generateEnvironmentParticles(scene: Phaser.Scene): void {
    // Firefly (2×2 yellow glow)
    this.genSmallParticle(scene, 'fx_firefly', '#88ff44', '#44cc22');
    // Snowflake
    this.genSmallParticle(scene, 'fx_snow', '#ffffff', '#ccddee');
    // Bubble
    this.genSmallParticle(scene, 'fx_bubble', '#88ccff', '#aaddff');
    // Ash/ember
    this.genSmallParticle(scene, 'fx_ash', '#ff8844', '#cc4422');
    // Leaf
    this.genSmallParticle(scene, 'fx_leaf', '#44aa22', '#228811');
    // Dark mote (undead)
    this.genSmallParticle(scene, 'fx_dark_mote', '#664488', '#442266');
  }

  private static genSmallParticle(scene: Phaser.Scene, key: string, color: string, edgeColor: string): void {
    if (scene.textures.exists(key)) return;
    const S = 4;
    const { canvas, ctx } = ArtRegistry.createCanvas(S * 2, S * 2);
    ctx.scale(2, 2);
    ctx.fillStyle = edgeColor;
    ctx.fillRect(0, 1, 4, 2);
    ctx.fillRect(1, 0, 2, 4);
    ctx.fillStyle = color;
    ctx.fillRect(1, 1, 2, 2);
    ArtRegistry.registerTexture(scene, key, canvas);
  }

  // ─── Runtime effect methods (called from BattleScene) ──────────────

  /** Play a physical attack effect on the target sprite */
  static playAttackEffect(scene: Phaser.Scene, targetX: number, targetY: number): void {
    // Slash image
    const slash = scene.add.image(targetX, targetY, 'fx_slash')
      .setDepth(200).setAlpha(0.8).setScale(0.5);

    scene.tweens.add({
      targets: slash,
      scale: 1.2,
      alpha: 0,
      angle: 45,
      duration: 300,
      onComplete: () => slash.destroy(),
    });

    // Hit sparks
    for (let i = 0; i < 3; i++) {
      const spark = scene.add.image(
        targetX + (Math.random() - 0.5) * 20,
        targetY + (Math.random() - 0.5) * 20,
        'fx_hit',
      ).setDepth(200).setAlpha(0.9).setScale(0.3);

      scene.tweens.add({
        targets: spark,
        x: spark.x + (Math.random() - 0.5) * 30,
        y: spark.y - 10 - Math.random() * 20,
        alpha: 0,
        scale: 0,
        duration: 200 + Math.random() * 200,
        delay: i * 50,
        onComplete: () => spark.destroy(),
      });
    }
  }

  /** Play a magic effect (particles rising from target) */
  static playMagicEffect(scene: Phaser.Scene, targetX: number, targetY: number, element: string): void {
    const particleKey = element === 'fire' ? 'fx_fire'
      : element === 'ice' ? 'fx_ice'
      : element === 'lightning' ? 'fx_lightning'
      : 'fx_magic';

    for (let i = 0; i < 8; i++) {
      const px = targetX + (Math.random() - 0.5) * 40;
      const py = targetY + (Math.random() - 0.5) * 20;
      const particle = scene.add.image(px, py, particleKey)
        .setDepth(200).setAlpha(0.9);

      scene.tweens.add({
        targets: particle,
        y: py - 30 - Math.random() * 30,
        x: px + (Math.random() - 0.5) * 20,
        alpha: 0,
        scale: { from: 1, to: 0.3 },
        duration: 400 + Math.random() * 400,
        delay: i * 60,
        onComplete: () => particle.destroy(),
      });
    }
  }

  /** Play a healing effect (green particles rising) */
  static playHealEffect(scene: Phaser.Scene, targetX: number, targetY: number): void {
    for (let i = 0; i < 6; i++) {
      const px = targetX + (Math.random() - 0.5) * 30;
      const py = targetY + 10;
      const particle = scene.add.image(px, py, 'fx_heal')
        .setDepth(200).setAlpha(0.9);

      scene.tweens.add({
        targets: particle,
        y: py - 40 - Math.random() * 20,
        alpha: 0,
        duration: 600 + Math.random() * 300,
        delay: i * 80,
        onComplete: () => particle.destroy(),
      });
    }
  }

  /** Spawn environment particles for a region */
  static spawnEnvironmentParticles(scene: Phaser.Scene, regionId: string, bounds: { width: number; height: number }): void {
    const config = getEnvironmentConfig(regionId);
    if (!config) return;

    const spawnParticle = () => {
      const x = Math.random() * bounds.width;
      const y = Math.random() * bounds.height;
      const p = scene.add.image(x, y, config.particleKey)
        .setDepth(15).setAlpha(0.6);

      scene.tweens.add({
        targets: p,
        x: x + config.dx * (0.5 + Math.random()),
        y: y + config.dy * (0.5 + Math.random()),
        alpha: 0,
        duration: config.duration + Math.random() * 1000,
        onComplete: () => p.destroy(),
      });
    };

    // Spawn particles periodically
    scene.time.addEvent({
      delay: config.interval,
      callback: spawnParticle,
      loop: true,
    });
    // Initial burst
    for (let i = 0; i < 5; i++) spawnParticle();
  }
}

interface EnvironmentConfig {
  particleKey: string;
  dx: number;
  dy: number;
  duration: number;
  interval: number;
}

function getEnvironmentConfig(regionId: string): EnvironmentConfig | null {
  switch (regionId) {
    case 'region_elf':
    case 'region_treant':
      return { particleKey: 'fx_firefly', dx: 20, dy: -15, duration: 3000, interval: 800 };
    case 'region_mountain':
      return { particleKey: 'fx_snow', dx: -10, dy: 30, duration: 4000, interval: 500 };
    case 'region_merfolk':
    case 'region_hotspring':
      return { particleKey: 'fx_bubble', dx: 5, dy: -25, duration: 2500, interval: 700 };
    case 'region_volcano':
      return { particleKey: 'fx_ash', dx: -8, dy: -20, duration: 3000, interval: 600 };
    case 'region_undead':
    case 'region_demon':
      return { particleKey: 'fx_dark_mote', dx: 10, dy: -10, duration: 3500, interval: 900 };
    default:
      return { particleKey: 'fx_leaf', dx: 15, dy: 20, duration: 4000, interval: 1500 };
  }
}
