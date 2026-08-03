# State Synchronization & Protocol Specification

## 1. Authoritative State Schema (`SessionState`)
```typescript
export interface SessionState {
  videoId: string;
  isPlaying: boolean;
  isPreparing: boolean;       // True during Pre-Buffering / Sync-on-Ready state
  positionAtAnchor: number;   // seconds — position at state update moment
  anchorTimestamp: number;    // Unix timestamp (ms) from server Date.now()
  version: number;            // Monotonically increasing sequence number
}
```

## 2. Display Telemetry Record Schema (`DisplayRecord`)
```typescript
export interface DisplayRecord {
  clientId: string;
  socketId: string;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  lastReportedPosition: number;
  lastReportedState: 'playing' | 'paused' | 'loading';
  readyState: number;         // HTMLMediaElement.readyState (0..4)
  isReady: boolean;           // True if readyState >= 3 (HAVE_FUTURE_DATA)
  lastReportedAt: number;     // Server timestamp when ping arrived
  driftMs: number;            // Calculated drift in milliseconds
  lastCorrectionAt: number | null; // Timestamp of last applied correction
}
```

## 3. Dynamic Position Calculation Formula & Pre-Buffering Ceiling
```typescript
export function getExpectedPosition(state: SessionState, now: number): number {
  if (!state.isPlaying || state.isPreparing) {
    return state.positionAtAnchor;
  }
  const elapsedSeconds = (now - state.anchorTimestamp) / 1000;
  const rawExpected = state.positionAtAnchor + elapsedSeconds;
  
  const video = VIDEO_LIST.find(v => v.id === state.videoId);
  if (video && video.duration && rawExpected >= video.duration) {
    return video.duration;
  }
  return rawExpected;
}
```

## 4. Socket Event Contract (`types.ts`)

### Client → Server Events
- `controller:command`: `{ type: 'PLAY' | 'PAUSE' | 'SEEK' | 'RESTART' | 'SELECT_VIDEO' | 'PREPARE', videoId?: string, toPosition?: number }`
- `display:join`: `{ clientId: string }`
- `display:status`: `{ clientId: string, position: number, playbackState: 'playing' | 'paused' | 'loading', readyState: number, timestamp: number }`

### Server → Client Events
- `state:update`: `SessionState` (Broadcast to all clients in room on state change)
- `displays:update`: `DisplayRecord[]` (Emitted to Controller for dashboard table update)
- `correction:apply`: `{ action: 'seek' | 'rate-nudge', value: number, durationMs?: number }` (Targeted emit to specific display socket)

## 5. Pre-Buffering / Sync-on-Ready Protocol Flow
1. **Trigger**: When a video is selected (`SELECT_VIDEO`) or seeked (`SEEK`), `sessionState.isPreparing` is set to `true`.
2. **Pre-buffering**: Display clients load the video stream and seek to `positionAtAnchor`.
3. **Readiness Telemetry**: Displays send `display:status` with `readyState: video.readyState`. Displays with `readyState >= 3` are marked `isReady = true`.
4. **Sync-on-Ready Execution**: As soon as all active displays report `isReady === true`, the server clears `isPreparing: false`, sets `anchorTimestamp = Date.now()`, and broadcasts `state:update` for synchronous playback across screens.
