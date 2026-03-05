/** Shared message types for the monitoring WebSocket protocol */

// --- Message Envelope ---
export interface MonitorMessage {
  type: string;
  clientId?: string;
  timestamp: number;
  payload: unknown;
}

// --- Roles ---
export type ClientRole = 'game' | 'dashboard';

// --- Game → Server ---
export interface RegisterPayload {
  role: ClientRole;
  clientId: string;
  heroName?: string;
}

export interface GameStateSnapshot {
  heroName: string;
  heroLevel: number;
  hp: number;
  maxHP: number;
  mp: number;
  maxMP: number;
  partyMembers: PartyMemberInfo[];
  gold: number;
  currentRegion: string;
  currentScene: string;
  liberatedCount: number;
  liberatedRegions: string[];
  totalRegions: number;
  playTimeFormatted: string;
  difficulty: string;
  fps: number;
  thumbnail?: string | null;
}

export interface PartyMemberInfo {
  name: string;
  level: number;
  hp: number;
  maxHP: number;
  mp: number;
  maxMP: number;
}

export interface BattleStateSnapshot {
  turn: number;
  phase: string;
  party: { name: string; hp: number; maxHP: number; mp: number; maxMP: number }[];
  enemies: { name: string; hp: number; maxHP: number }[];
  log: string[];
}

export interface ScreenshotResponsePayload {
  requestId: string;
  dataUrl: string;
}

export interface RecordingStatusPayload {
  recording: boolean;
  duration?: number;
}

export interface RecordingDataPayload {
  requestId: string;
  dataUrl: string;
}

// --- Server → Game (commands) ---
export interface RequestScreenshotPayload {
  requestId: string;
}

export interface StartRecordingPayload {
  requestId: string;
  maxDuration?: number;
}

export interface StopRecordingPayload {
  requestId: string;
}

export interface SetUpdateRatePayload {
  intervalMs: number;
}

// --- Server → Dashboard ---
export interface GameClientInfo {
  clientId: string;
  heroName: string;
  connectedAt: number;
  lastSnapshot?: GameStateSnapshot;
  lastBattle?: BattleStateSnapshot;
}
