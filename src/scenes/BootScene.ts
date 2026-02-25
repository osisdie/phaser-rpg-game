import Phaser from 'phaser';
import { ArtRegistry } from '../art/index';
import type { AIAssetManifest } from '../art/index';
import { audioManager } from '../systems/AudioManager';

interface AudioManifestEntry {
  name: string;
  file: string;
}

interface AudioManifest {
  bgm: AudioManifestEntry[];
  sfx: AudioManifestEntry[];
}

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

  constructor() {
    super('BootScene');
  }

  preload(): void {
    // Try to load the AI asset manifest; if it doesn't exist, proceed without it
    this.load.json('ai_manifest', 'assets/ai/manifest.json');

    // On load complete, check if manifest loaded and queue AI images
    this.load.once('complete', () => {
      const manifest = this.cache.json.get('ai_manifest') as AIAssetManifest | undefined;
      if (manifest && typeof manifest === 'object' && !('_error' in manifest)) {
        this.aiManifest = manifest;
        ArtRegistry.loadAIAssets(this, manifest);

        // Start a second load pass for the AI images we just queued
        this.load.once('complete', () => {
          this.loadAIAudio();
        });
        this.load.start();
      } else {
        // No manifest or invalid — skip AI loading entirely
        this.loadAIAudio();
      }
    });
  }

  private async loadAIAudio(): Promise<void> {
    try {
      const resp = await fetch('assets/ai/audio/manifest.json');
      if (!resp.ok) {
        this.onAllAssetsReady();
        return;
      }

      const manifest: AudioManifest = await resp.json();
      const audioCtx = new AudioContext();

      // Load all audio files in parallel
      const loadPromises: Promise<void>[] = [];

      for (const category of ['bgm', 'sfx'] as const) {
        for (const entry of manifest[category] ?? []) {
          const url = `assets/ai/audio/${entry.file}`;
          const promise = fetch(url)
            .then(r => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.arrayBuffer();
            })
            .then(buf => audioCtx.decodeAudioData(buf))
            .then(audioBuffer => {
              audioManager.registerPreRecorded(entry.name, audioBuffer);
            })
            .catch(() => {
              // Silent fail — procedural fallback will handle this
            });
          loadPromises.push(promise);
        }
      }

      await Promise.all(loadPromises);
    } catch {
      // No audio manifest or fetch error — proceed silently
    }

    this.onAllAssetsReady();
  }

  private onAllAssetsReady(): void {
    // Generate procedural textures (skips any keys already loaded from AI)
    ArtRegistry.generateAll(this);
    this.scene.start('TitleScene');
  }
}
