# Functional Requirements Specification (FRS)

## 1. Controller Application Requirements
- **FR1.1 Video Selection**: Select a video from predefined list (e.g. static MP4s). Emits `SELECT_VIDEO` command to server.
- **FR1.2 Play / Resume**: Trigger playback play/resume across all displays simultaneously via `PLAY` command.
- **FR1.3 Pause**: Pause video globally across all displays via `PAUSE` command.
- **FR1.4 Seek**: Seek to specific position globally via `SEEK` command.
- **FR1.5 Restart**: Restart video from beginning (0:00) globally via `RESTART` command.
- **FR1.6 Connected Displays Table**: Live rendering of connected Display clients populated by server `displays:update` events.
- **FR1.7 Display Telemetry Visibility**: Display client rows render:
  - Client ID (`disp_xxxx`)
  - Connection status (`connected` / `reconnecting` / `disconnected`)
  - Current playback position (seconds / mm:ss)
  - Playback state (`playing` / `paused` / `loading`)
  - Calculated drift relative to server expected position (in ms)
- **FR1.8 Quick Display Launchers**: Header & Display Network card include 1-click launcher buttons (`+ Display 1`, `+ Display 2`, `+ Custom Display`) opening display windows in new tabs automatically without requiring manual URL typing.


## 2. Display Application Requirements
- **FR2.1 Identity & Persistence**: Generate stable UUID client ID in `localStorage` (`displayClientId`). Connect to Fastify + Socket.IO server emitting `display:join`.
- **FR2.2 Video Loading**: Synchronize video selection with `state:update` broadcasts.
- **FR2.3 Command Response**: Synchronize DOM `<video>` playback state with authoritative server state. Discard stale state updates using `version` checks (`incoming.version <= local.version`).
- **FR2.4 Periodic Status Telemetry**: Emit `display:status` heartbeats every ~1 second containing current position, state, and client ID.
- **FR2.5 On-Screen Debug HUD**: Transparent overlay div displaying Client ID, Connection status, Local current time, and Calculated drift.

## 3. Authoritative Playback State Requirements
- **FR3.1 Central State Repository**: Server holds in-memory `SessionState` (`videoId`, `isPlaying`, `positionAtAnchor`, `anchorTimestamp`, `version`).
- **FR3.2 Dynamic Position Calculation**: Server and clients compute expected playback position using:
  - Playing: `positionAtAnchor + (now - anchorTimestamp) / 1000`
  - Paused: `positionAtAnchor`
- **FR3.3 Single Source of Truth**: All client commands flow strictly through server; no direct peer-to-peer client communication.

## 4. Synchronization & Drift Correction Requirements
- **FR4.1 Server Drift Evaluation**: Server calculates `driftMs = (reportedPosition - expectedPosition) * 1000` on every status ping.
- **FR4.2 Controller Metric Streaming**: Server forwards display telemetry records to Controller.
- **FR4.3 Automated Correction Strategy**:
  - **Deadband (< 300ms)**: No action.
  - **Soft Correction (300ms – 1500ms)**: Targeted `correction:apply` with `rate-nudge` (`0.95x` or `1.05x`).
  - **Hard Correction (> 1500ms)**: Targeted `correction:apply` with `seek` (`currentTime = expectedPosition`).
- **FR4.4 Cooldown Enforcement**: Enforce a 3 to 5 second cooldown per client after applying corrections to prevent oscillation.
