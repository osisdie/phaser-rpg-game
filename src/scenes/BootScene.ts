import Phaser from 'phaser';
import { ArtRegistry } from '../art/index';
import type { AIAssetManifest } from '../art/index';
import { audioManager } from '../systems/AudioManager';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

interface AudioManifestEntry {
  name: string;
  file: string;
}

interface AudioManifest {
  bgm: AudioManifestEntry[];
  sfx: AudioManifestEntry[];
}

// Loading phases with approximate weight (summing to 1.0)
const PHASE_MANIFEST = 0.05;
const PHASE_AI_IMAGES = 0.35;
const PHASE_AI_AUDIO = 0.25;
const PHASE_PROCEDURAL = 0.35;

/**
 * BootScene — Load AI assets (if available) then generate procedural textures.
 *
 * Flow:
 * 1. preload(): Fetch manifest.json, queue AI images into Phaser loader
 * 2. Load AI audio files (fetch + decodeAudioData)
 * 3. create():  Run procedural generators (skip keys already loaded from AI)
 * 4. Transition to TitleScene
 */
export class BootScene extends Phaser.Scene {
  private aiManifest: AIAssetManifest | null = null;

  // Progress bar UI
  private progressBar!: Phaser.GameObjects.Rectangle;
  private progressBg!: Phaser.GameObjects.Rectangle;
  private phaseText!: Phaser.GameObjects.Text;
  private percentText!: Phaser.GameObjects.Text;
  private overallProgress = 0;
  private currentPhaseBase = 0;

  constructor() {
    super('BootScene');
  }

  create(): void {
    // Build progress bar UI (create() runs before preload listeners fire)
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 + 60;
    const barW = 360;
    const barH = 16;

    this.add.text(cx, cy - 60, '勇者傳說', {
      fontFamily: 'serif', fontSize: '36px', color: '#ccaa66',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    this.progressBg = this.add.rectangle(cx, cy, barW, barH, 0x222233)
      .setStrokeStyle(1, 0x556677);
    this.progressBar = this.add.rectangle(cx - barW / 2, cy, 0, barH - 4, 0x66aadd)
      .setOrigin(0, 0.5);

    this.phaseText = this.add.text(cx, cy + 20, '讀取中...', {
      fontFamily: 'serif', fontSize: '13px', color: '#8899aa',
    }).setOrigin(0.5);

    this.percentText = this.add.text(cx + barW / 2 + 12, cy, '0%', {
      fontFamily: 'serif', fontSize: '13px', color: '#aabbcc',
    }).setOrigin(0, 0.5);

    // Start the loading pipeline
    this.startLoading();
  }

  private setProgress(value: number, phaseLabel?: string): void {
    this.overallProgress = Math.min(1, Math.max(0, value));
    const barW = 360;
    this.progressBar.width = barW * this.overallProgress;
    this.percentText.setText(Math.round(this.overallProgress * 100) + '%');
    if (phaseLabel) this.phaseText.setText(phaseLabel);
  }

  private startLoading(): void {
    this.setProgress(0, '讀取資源清單...');

    // Phase 1: Load manifest
    this.load.json('ai_manifest', 'assets/ai/manifest.json');
    this.load.once('complete', () => {
      this.setProgress(PHASE_MANIFEST, '載入圖像資源...');

      const manifest = this.cache.json.get('ai_manifest') as AIAssetManifest | undefined;
      if (manifest && typeof manifest === 'object' && !('_error' in manifest)) {
        this.aiManifest = manifest;
        ArtRegistry.loadAIAssets(this, manifest);

        // Phase 2: AI images — track per-file progress
        this.currentPhaseBase = PHASE_MANIFEST;
        this.load.on('progress', (p: number) => {
          this.setProgress(this.currentPhaseBase + p * PHASE_AI_IMAGES);
        });
        this.load.once('complete', () => {
          this.load.off('progress');
          this.setProgress(PHASE_MANIFEST + PHASE_AI_IMAGES, '載入音效資源...');
          this.loadAIAudio();
        });
        this.load.start();
      } else {
        // No AI images — skip to audio
        this.setProgress(PHASE_MANIFEST + PHASE_AI_IMAGES, '載入音效資源...');
        this.loadAIAudio();
      }
    });
    this.load.start();
  }

  private async loadAIAudio(): Promise<void> {
    const audioPhaseStart = PHASE_MANIFEST + PHASE_AI_IMAGES;
    try {
      const resp = await fetch('assets/ai/audio/manifest.json');
      if (!resp.ok) {
        this.setProgress(audioPhaseStart + PHASE_AI_AUDIO);
        this.onAllAssetsReady();
        return;
      }

      const manifest: AudioManifest = await resp.json();
      const audioCtx = new AudioContext();

      const allEntries: { name: string; url: string }[] = [];
      for (const category of ['bgm', 'sfx'] as const) {
        for (const entry of manifest[category] ?? []) {
          allEntries.push({ name: entry.name, url: `assets/ai/audio/${entry.file}` });
        }
      }

      let loaded = 0;
      const total = allEntries.length || 1;

      const loadPromises = allEntries.map(entry =>
        fetch(entry.url)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
          .then(buf => audioCtx.decodeAudioData(buf))
          .then(audioBuffer => {
            audioManager.registerPreRecorded(entry.name, audioBuffer);
          })
          .catch(() => { /* silent fail */ })
          .finally(() => {
            loaded++;
            this.setProgress(audioPhaseStart + (loaded / total) * PHASE_AI_AUDIO);
          }),
      );

      await Promise.all(loadPromises);
    } catch {
      // No audio manifest or fetch error — proceed silently
    }

    this.setProgress(audioPhaseStart + PHASE_AI_AUDIO, '生成程序紋理...');
    this.onAllAssetsReady();
  }

  private onAllAssetsReady(): void {
    // Generate procedural textures (skips any keys already loaded from AI)
    this.setProgress(PHASE_MANIFEST + PHASE_AI_IMAGES + PHASE_AI_AUDIO, '生成程序紋理...');
    ArtRegistry.generateAll(this);
    this.setProgress(1, '完成！');

    // Brief delay so user sees 100%, then transition
    this.time.delayedCall(300, () => {
      this.scene.start('TitleScene');
    });
  }
}
