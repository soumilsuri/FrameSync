// ============================================================
// FrameSync - Shared TypeScript Event Contract
// Imported by both /frontend and /server for compile-time safety
// ============================================================

export interface SessionState {
  videoId: string;
  isPlaying: boolean;
  isPreparing: boolean;      // True during Pre-Buffering / Sync-on-Ready state
  positionAtAnchor: number;  // seconds at the moment state was last set
  anchorTimestamp: number;   // server Date.now() (ms) when anchor was set
  version: number;           // monotonically increasing
}

export interface DisplayRecord {
  clientId: string;
  socketId: string;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  lastReportedPosition: number;             // seconds
  lastReportedState: 'playing' | 'paused' | 'loading';
  readyState: number;                       // HTMLMediaElement.readyState (0..4)
  isReady: boolean;                         // True if readyState >= 3 (HAVE_FUTURE_DATA)
  lastReportedAt: number;                   // server timestamp when ping arrived (ms)
  driftMs: number;                          // (lastReportedPosition - expectedPosition) * 1000
  lastCorrectionAt: number | null;          // for 3-5s cooldown enforcement
}

export type ControllerCommandType = 'PLAY' | 'PAUSE' | 'SEEK' | 'RESTART' | 'SELECT_VIDEO' | 'PREPARE';

export interface ControllerCommandPayload {
  type: ControllerCommandType;
  videoId?: string;
  toPosition?: number;
}

export interface DisplayStatusPayload {
  clientId: string;
  position: number;
  playbackState: 'playing' | 'paused' | 'loading';
  readyState: number;                       // HTMLMediaElement.readyState (0..4)
  timestamp: number;
}

export interface DisplayJoinPayload {
  clientId: string;
}

export interface CorrectionCommandPayload {
  action: 'seek' | 'rate-nudge';
  value: number;
  durationMs?: number;
}

export interface VideoItem {
  id: string;
  label: string;
  url: string;
  duration: number; // Duration in seconds
}

export const VIDEO_LIST: VideoItem[] = [
  {
    id: 'flower-sample',
    label: 'MDN Flower (Short)',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    duration: 5.055,
  },
  {
    id: 'friday-sample',
    label: 'MDN Friday (Short)',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
    duration: 6.166,
  },
  {
    id: 'big-buck-bunny-4k',
    label: 'Big Buck Bunny (10m)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c0/Big_Buck_Bunny_4K.webm',
    duration: 634.553,
  },
  {
    id: 'sintel',
    label: 'Sintel (14m)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Sintel_movie_4K.webm',
    duration: 888.035,
  }
];

export const DRIFT_THRESHOLDS = {
  DEADBAND_MS: 300,
  SOFT_CORRECTION_MS: 1500,
  SOFT_RATE_BEHIND: 1.05,
  SOFT_RATE_AHEAD: 0.95,
  SOFT_NUDGE_DURATION_MS: 4000,
  COOLDOWN_MS: 4000,
} as const;
