# FrameSync Requirements Checklist & TODO Tracker

## Maintenance Guideline
- [x] **Maintenance Rule**: Keep all `.agents/` files updated when architecture or state schemas change.

## 1. Controller Application Requirements (`/controller`)
- [ ] **FR1.1**: Video selection picker emitting `SELECT_VIDEO` command.
- [ ] **FR1.2**: Global Play / Resume button emitting `PLAY` command.
- [ ] **FR1.3**: Global Pause button emitting `PAUSE` command.
- [ ] **FR1.4**: Global Seek scrub bar emitting `SEEK` command.
- [ ] **FR1.5**: Global Restart button emitting `RESTART` command.
- [ ] **FR1.6**: Display table rendering all active client connections.
- [ ] **FR1.7**: Real-time display telemetry view (Client ID, Connection status, Position, State, Drift in ms).

## 2. Display Application Requirements (`/display/[id]`)
- [ ] **FR2.1**: Persistent client identity (`localStorage` UUID `displayClientId`) & socket connection via `display:join`.
- [ ] **FR2.2**: Synchronized HTML5 video element loading selected video.
- [ ] **FR2.3**: Dynamic state resync on `state:update` with sequence version check (`incoming.version > local.version`).
- [ ] **FR2.4**: Periodic status heartbeat (`display:status`) sent every 1 second.
- [ ] **FR2.5**: On-screen debug HUD overlay rendering Client ID, status, local position, and calculated drift.

## 3. Authoritative Playback State Engine (Fastify + Socket.IO Server)
- [ ] **FR3.1**: In-memory `SessionState` store (`videoId`, `isPlaying`, `positionAtAnchor`, `anchorTimestamp`, `version`).
- [ ] **FR3.2**: Dynamic expected position calculation formula: `positionAtAnchor + (now - anchorTimestamp) / 1000`.
- [ ] **FR3.3**: Strictly server-authoritative state propagation; no direct P2P client communication.

## 4. Synchronisation & Drift Correction Requirements
- [ ] **FR4.1**: Quantitative server-side drift calculation `(reportedPosition - expectedPosition) * 1000`.
- [ ] **FR4.2**: Real-time telemetry streaming to Controller table (`displays:update`).
- [ ] **FR4.3**: Automated correction execution via targeted `correction:apply` events:
  - Deadband (< 300ms): No action
  - Soft Nudge (300ms – 1500ms): `playbackRate` adjustment (`0.95x` or `1.05x`)
  - Hard Seek (> 1500ms): Direct `video.currentTime` seek
- [ ] **FR4.4**: 3 to 5 second per-client cooldown mechanism to prevent threshold flapping.

## 5. System Architecture & Quality Requirements
- [ ] **NFR1**: Low latency Socket.IO transport & in-memory state engine.
- [ ] **NFR2**: Network fault tolerance, auto-reconnect, and out-of-order packet protection.
- [ ] **NFR3**: Clean Next.js + Fastify monorepo/folder separation with shared `types.ts`.
- [ ] **NFR4**: Debug HUD & server log observability.
- [ ] **NFR5**: Documented trade-offs (Fastify vs Express, in-memory vs DB, scale path with Redis).
