/**
 * MonitoringClient — WebSocket client for streaming game state to the monitor dashboard.
 * Completely optional, zero coupling. Game is never affected by monitoring failures.
 *
 * Enable via: ?monitor=true (default ws://localhost:9473)
 *           or ?monitor=ws://host:port
 *           or localStorage 'rpg_monitor_url'
 */

import { gameState } from './GameStateManager';

interface MonitorMessage {
  type: string;
  clientId?: string;
  timestamp: number;
  payload: unknown;
}

class MonitoringClient {
  private ws: WebSocket | null = null;
  private clientId: string;
  private url: string | null = null;
  private enabled = false;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private readonly MAX_RECONNECT_DELAY = 30000;
  private updateRate = 2000;
  private thumbCanvas: HTMLCanvasElement | null = null;
  private thumbCtx: CanvasRenderingContext2D | null = null;
  private static readonly THUMB_WIDTH = 256;
  private static readonly THUMB_QUALITY = 0.5;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingChunks: Blob[] = [];
  private recordingRequestId: string | null = null;
  private recordingStart = 0;

  constructor() {
    this.clientId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Call once after Phaser game is created */
  init(): void {
    try {
      this.url = this.resolveUrl();
      if (!this.url) return;
      this.enabled = true;
      console.log(`[Monitor] Enabled → ${this.url}`);
      this.connect();
    } catch {
      // Silently fail
    }
  }

  private resolveUrl(): string | null {
    try {
      const params = new URLSearchParams(window.location.search);
      const monitorParam = params.get('monitor');

      if (monitorParam) {
        if (monitorParam.startsWith('ws://') || monitorParam.startsWith('wss://')) {
          localStorage.setItem('rpg_monitor_url', monitorParam);
          return monitorParam;
        }
        if (monitorParam === 'true' || monitorParam === '1') {
          return localStorage.getItem('rpg_monitor_url') || 'ws://localhost:9473';
        }
      }

      // Check localStorage for previously set URL
      const stored = localStorage.getItem('rpg_monitor_url');
      if (stored && params.has('monitor')) {
        return stored;
      }
    } catch {
      // localStorage unavailable
    }
    return null;
  }

  private connect(): void {
    if (!this.enabled || !this.url) return;
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[Monitor] Connected');
        this.reconnectDelay = 1000;
        this.register();
        this.startStreaming();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: MonitorMessage = JSON.parse(event.data as string);
          this.handleServerMessage(msg);
        } catch {
          // Ignore malformed
        }
      };

      this.ws.onclose = () => {
        console.log('[Monitor] Disconnected');
        this.stopStreaming();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // onclose will fire after this
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private register(): void {
    const state = gameState.getState();
    this.send({
      type: 'register',
      clientId: this.clientId,
      timestamp: Date.now(),
      payload: {
        role: 'game',
        clientId: this.clientId,
        heroName: state.heroName,
      },
    });
  }

  private startStreaming(): void {
    this.stopStreaming();
    // Send immediately, then at interval
    this.sendStateUpdate();
    this.updateInterval = setInterval(() => {
      this.sendStateUpdate();
    }, this.updateRate);
  }

  private stopStreaming(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private sendStateUpdate(): void {
    try {
      const state = gameState.getState();
      const game = (window as any).__GAME__ as Phaser.Game | undefined;
      const hero = state.hero;
      const party = gameState.getParty();

      const snapshot = {
        heroName: state.heroName,
        heroLevel: hero.level,
        hp: hero.stats.hp,
        maxHP: hero.stats.maxHP,
        mp: hero.stats.mp,
        maxMP: hero.stats.maxMP,
        partyMembers: party.map((m) => ({
          name: m.name,
          level: m.level,
          hp: m.stats.hp,
          maxHP: m.stats.maxHP,
          mp: m.stats.mp,
          maxMP: m.stats.maxMP,
        })),
        gold: state.gold,
        currentRegion: state.currentRegion,
        currentScene: state.currentScene,
        liberatedCount: state.liberatedRegions.length,
        liberatedRegions: state.liberatedRegions.slice(),
        totalRegions: 12,
        playTimeFormatted: gameState.getPlayTimeFormatted(),
        difficulty: state.difficulty,
        fps: game ? Math.round(game.loop.actualFps) : 0,
        thumbnail: game ? this.captureThumbnail(game.canvas) : null,
      };

      this.send({
        type: 'state_update',
        clientId: this.clientId,
        timestamp: Date.now(),
        payload: snapshot,
      });

      // If in battle, also send battle state
      if (state.currentScene === 'BattleScene' && game) {
        this.sendBattleUpdate(game);
      }
    } catch {
      // Never let monitoring errors affect the game
    }
  }

  private sendBattleUpdate(game: Phaser.Game): void {
    try {
      const battleScene = game.scene.getScene('BattleScene') as any;
      if (!battleScene?.combat) return;
      const bs = battleScene.combat.getState();
      if (!bs) return;

      this.send({
        type: 'battle_update',
        clientId: this.clientId,
        timestamp: Date.now(),
        payload: {
          turn: bs.turn,
          phase: bs.phase,
          party: bs.party.map((c: any) => ({
            name: c.name,
            hp: c.stats.hp,
            maxHP: c.stats.maxHP,
            mp: c.stats.mp,
            maxMP: c.stats.maxMP,
          })),
          enemies: bs.enemies.map((e: any) => ({
            name: e.name,
            hp: e.stats.hp,
            maxHP: e.stats.maxHP,
          })),
          log: bs.log.slice(-5),
        },
      });
    } catch {
      // Silently fail
    }
  }

  private handleServerMessage(msg: MonitorMessage): void {
    try {
      switch (msg.type) {
        case 'ping':
          this.send({ type: 'pong', clientId: this.clientId, timestamp: Date.now(), payload: {} });
          break;

        case 'request_screenshot':
          this.handleScreenshotRequest(msg.payload as { requestId: string });
          break;

        case 'start_recording':
          this.handleStartRecording(msg.payload as { requestId: string; maxDuration?: number });
          break;

        case 'stop_recording':
          this.handleStopRecording(msg.payload as { requestId: string });
          break;

        case 'set_update_rate':
          this.updateRate = Math.max(500, (msg.payload as { intervalMs: number }).intervalMs);
          if (this.updateInterval) this.startStreaming();
          break;
      }
    } catch {
      // Silently fail
    }
  }

  private captureThumbnail(canvas: HTMLCanvasElement): string | null {
    try {
      const tw = MonitoringClient.THUMB_WIDTH;
      const th = Math.round((canvas.height / canvas.width) * tw);
      if (!this.thumbCanvas) {
        this.thumbCanvas = document.createElement('canvas');
        this.thumbCtx = this.thumbCanvas.getContext('2d');
      }
      this.thumbCanvas.width = tw;
      this.thumbCanvas.height = th;
      if (!this.thumbCtx) return null;
      this.thumbCtx.drawImage(canvas, 0, 0, tw, th);
      return this.thumbCanvas.toDataURL('image/jpeg', MonitoringClient.THUMB_QUALITY);
    } catch {
      return null;
    }
  }

  private handleScreenshotRequest(payload: { requestId: string }): void {
    try {
      const game = (window as any).__GAME__ as Phaser.Game | undefined;
      if (!game) return;
      const dataUrl = game.canvas.toDataURL('image/png');
      this.send({
        type: 'screenshot_response',
        clientId: this.clientId,
        timestamp: Date.now(),
        payload: { requestId: payload.requestId, dataUrl },
      });
    } catch {
      // Silently fail
    }
  }

  private handleStartRecording(payload: { requestId: string; maxDuration?: number }): void {
    try {
      if (this.mediaRecorder) return; // Already recording
      const game = (window as any).__GAME__ as Phaser.Game | undefined;
      if (!game) return;

      const stream = game.canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.recordingChunks = [];
      this.recordingRequestId = payload.requestId;
      this.recordingStart = Date.now();

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordingChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        this.finalizeRecording();
      };

      this.mediaRecorder.start(1000); // Collect chunks every 1s

      // Auto-stop after maxDuration
      const maxMs = (payload.maxDuration || 60) * 1000;
      setTimeout(() => {
        if (this.mediaRecorder?.state === 'recording') {
          this.mediaRecorder.stop();
        }
      }, maxMs);

      this.send({
        type: 'recording_status',
        clientId: this.clientId,
        timestamp: Date.now(),
        payload: { recording: true },
      });
    } catch {
      // Silently fail
    }
  }

  private handleStopRecording(_payload: { requestId: string }): void {
    try {
      if (this.mediaRecorder?.state === 'recording') {
        this.mediaRecorder.stop();
      }
    } catch {
      // Silently fail
    }
  }

  private finalizeRecording(): void {
    try {
      const blob = new Blob(this.recordingChunks, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        this.send({
          type: 'recording_data',
          clientId: this.clientId,
          timestamp: Date.now(),
          payload: {
            requestId: this.recordingRequestId,
            dataUrl: reader.result as string,
          },
        });
        this.send({
          type: 'recording_status',
          clientId: this.clientId,
          timestamp: Date.now(),
          payload: { recording: false, duration: Date.now() - this.recordingStart },
        });
      };
      reader.readAsDataURL(blob);
    } catch {
      // Silently fail
    } finally {
      this.mediaRecorder = null;
      this.recordingChunks = [];
      this.recordingRequestId = null;
    }
  }

  private send(msg: MonitorMessage): void {
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
    } catch {
      // Silently fail
    }
  }

  private scheduleReconnect(): void {
    if (!this.enabled) return;
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log(`[Monitor] Reconnecting (delay: ${this.reconnectDelay}ms)...`);
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.MAX_RECONNECT_DELAY);
  }

  destroy(): void {
    this.enabled = false;
    this.stopStreaming();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const monitoringClient = new MonitoringClient();
