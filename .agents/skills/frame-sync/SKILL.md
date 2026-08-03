---
name: frame-sync
description: Framework and guidance for building, running, and maintaining the FrameSync real-time video synchronization system using Next.js, Fastify, and Socket.IO.
---

# FrameSync Core System Skill

## Architecture Overview
FrameSync uses a Next.js frontend (`/controller`, `/display/[id]`) and a Fastify + Socket.IO server. Communication is strictly server-mediated; the Controller never talks directly to Displays.

## 1. Project Directory Structure
```
/frontend                 (Next.js App Router)
  /app
    /controller/page.tsx   (Controller Dashboard UI)
    /display/[id]/page.tsx (Display Client UI + Debug HUD)
  /lib/socket.ts           (Socket.IO client singleton)
  /lib/types.ts            (Shared event contract)

/server                    (Fastify + Socket.IO)
  /src
    index.ts               (Fastify bootstrap & Socket.IO initialization)
    state.ts               (In-memory SessionState & getExpectedPosition)
    displays.ts            (DisplayRecord map & drift calculations)
    correction.ts          (Threshold evaluation & cooldown manager)
    socketHandlers.ts      (Event listeners for controller/display sockets)
  /types.ts                (Shared event contract)
```

## 2. Server State Engine (`state.ts`)
The server maintains an anchor point rather than broadcasting a ticking position:

```ts
interface SessionState {
  videoId: string;
  isPlaying: boolean;
  isPreparing: boolean;       // True during Pre-Buffering / Sync-on-Ready state
  positionAtAnchor: number;   // seconds — position when state was set
  anchorTimestamp: number;    // server Date.now() (ms) when state was set
  version: number;            // monotonically increasing sequence number
}

function getExpectedPosition(state: SessionState, now: number): number {
  if (!state.isPlaying || state.isPreparing) return state.positionAtAnchor;
  const elapsedSeconds = (now - state.anchorTimestamp) / 1000;
  return state.positionAtAnchor + elapsedSeconds;
}
```

## 3. Versioning & Out-of-Order Defense
Every discrete event (`PLAY`, `PAUSE`, `SEEK`, `RESTART`, `SELECT_VIDEO`) increments `state.version`.
Clients must check `if (incoming.version <= local.version) return;` to discard stale or out-of-order broadcasts.

## 4. Display Identity Management
Display clients generate a persistent UUID stored in `localStorage` (`displayClientId`). On connection or reconnection, the client emits `display:join` with this ID so the server updates the existing display record rather than creating a duplicate row.
