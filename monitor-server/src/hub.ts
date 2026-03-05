import { WebSocket } from 'ws';
import type {
  MonitorMessage,
  RegisterPayload,
  GameClientInfo,
  GameStateSnapshot,
  BattleStateSnapshot,
} from './types.js';

interface GameConnection {
  ws: WebSocket;
  info: GameClientInfo;
}

export class Hub {
  private games = new Map<string, GameConnection>();
  private dashboards = new Set<WebSocket>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    // Heartbeat: ping games every 15s, clean up dead connections every 30s
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, conn] of this.games) {
        if (conn.ws.readyState !== WebSocket.OPEN) {
          this.removeGame(clientId);
          continue;
        }
        this.send(conn.ws, { type: 'ping', timestamp: now, payload: {} });
      }
      for (const ws of this.dashboards) {
        if (ws.readyState !== WebSocket.OPEN) {
          this.dashboards.delete(ws);
        }
      }
    }, 15000);
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  handleConnection(ws: WebSocket): void {
    ws.on('message', (raw) => {
      try {
        const msg: MonitorMessage = JSON.parse(raw.toString());
        this.handleMessage(ws, msg);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', () => {
      this.handleDisconnect(ws);
    });
  }

  private handleMessage(ws: WebSocket, msg: MonitorMessage): void {
    switch (msg.type) {
      case 'register':
        this.handleRegister(ws, msg.payload as RegisterPayload);
        break;

      case 'state_update':
        this.handleStateUpdate(msg.clientId!, msg.payload as GameStateSnapshot);
        break;

      case 'battle_update':
        this.handleBattleUpdate(msg.clientId!, msg.payload as BattleStateSnapshot);
        break;

      case 'screenshot_response':
      case 'recording_status':
      case 'recording_data':
        // Forward to all dashboards
        this.broadcastDashboards(msg);
        break;

      case 'pong':
        // Heartbeat ack — nothing to do
        break;

      // Commands from dashboard → forward to specific game client
      case 'request_screenshot':
      case 'start_recording':
      case 'stop_recording':
      case 'set_update_rate':
        this.forwardToGame(msg);
        break;
    }
  }

  private handleRegister(ws: WebSocket, payload: RegisterPayload): void {
    if (payload.role === 'dashboard') {
      this.dashboards.add(ws);
      // Send current client list
      const clients = Array.from(this.games.values()).map((g) => g.info);
      this.send(ws, {
        type: 'client_list',
        timestamp: Date.now(),
        payload: clients,
      });
      console.log(`[Hub] Dashboard connected (total: ${this.dashboards.size})`);
    } else if (payload.role === 'game') {
      const info: GameClientInfo = {
        clientId: payload.clientId,
        heroName: payload.heroName || '???',
        connectedAt: Date.now(),
      };
      this.games.set(payload.clientId, { ws, info });
      // Notify dashboards
      this.broadcastDashboards({
        type: 'client_connected',
        timestamp: Date.now(),
        payload: info,
      });
      console.log(`[Hub] Game "${info.heroName}" (${info.clientId}) connected (total: ${this.games.size})`);
    }
  }

  private handleStateUpdate(clientId: string, snapshot: GameStateSnapshot): void {
    const conn = this.games.get(clientId);
    if (conn) {
      // Store snapshot without thumbnail to save memory
      const { thumbnail, ...rest } = snapshot as GameStateSnapshot & { thumbnail?: string };
      conn.info.lastSnapshot = rest as GameStateSnapshot;
      conn.info.heroName = snapshot.heroName;
    }
    // Forward full snapshot (with thumbnail) to dashboards
    this.broadcastDashboards({
      type: 'state_update',
      clientId,
      timestamp: Date.now(),
      payload: snapshot,
    });
  }

  private handleBattleUpdate(clientId: string, snapshot: BattleStateSnapshot): void {
    const conn = this.games.get(clientId);
    if (conn) {
      conn.info.lastBattle = snapshot;
    }
    this.broadcastDashboards({
      type: 'battle_update',
      clientId,
      timestamp: Date.now(),
      payload: snapshot,
    });
  }

  private forwardToGame(msg: MonitorMessage): void {
    const clientId = msg.clientId;
    if (!clientId) return;
    const conn = this.games.get(clientId);
    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      this.send(conn.ws, msg);
    }
  }

  private removeGame(clientId: string): void {
    const conn = this.games.get(clientId);
    if (!conn) return;
    this.games.delete(clientId);
    this.broadcastDashboards({
      type: 'client_disconnected',
      timestamp: Date.now(),
      payload: { clientId },
    });
    console.log(`[Hub] Game "${conn.info.heroName}" (${clientId}) disconnected (total: ${this.games.size})`);
  }

  private handleDisconnect(ws: WebSocket): void {
    // Check dashboards
    if (this.dashboards.delete(ws)) {
      console.log(`[Hub] Dashboard disconnected (total: ${this.dashboards.size})`);
      return;
    }
    // Check games
    for (const [clientId, conn] of this.games) {
      if (conn.ws === ws) {
        this.removeGame(clientId);
        return;
      }
    }
  }

  private broadcastDashboards(msg: Omit<MonitorMessage, 'timestamp'> & { timestamp?: number }): void {
    const data = JSON.stringify({ ...msg, timestamp: msg.timestamp ?? Date.now() });
    for (const ws of this.dashboards) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  private send(ws: WebSocket, msg: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  getStats(): { games: number; dashboards: number } {
    return { games: this.games.size, dashboards: this.dashboards.size };
  }
}
