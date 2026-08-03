# FrameSync: Real-Time Multi-Display Video Synchronization System

## Executive Summary

FrameSync is an enterprise-grade real-time multi-display video playback synchronization system. It enforces frame-accurate synchronization across multiple independent display clients controlled via a central command dashboard.

The system is designed around a server-authoritative architecture that eliminates position drift, handles imperfect network conditions gracefully, and prevents playback stutter using mathematical state anchor calculations and multi-tiered drift correction algorithms.

---

## Table of Contents

- [1. Core Objective and Architecture Overview](#1-core-objective-and-architecture-overview)
- [2. System Requirements and Architecture Trade-offs](#2-system-requirements-and-architecture-trade-offs)
- [3. Authoritative Playback State Engine](#3-authoritative-playback-state-engine)
  - [3.1 Timestamp Anchor Calculation Model](#31-timestamp-anchor-calculation-model)
  - [3.2 Monotonic Sequence Versioning](#32-monotonic-sequence-versioning)
- [4. Synchronization and Drift Correction Engine](#4-synchronization-and-drift-correction-engine)
  - [4.1 Quantitative Drift Telemetry Math](#41-quantitative-drift-telemetry-math)
  - [4.2 Multi-Tier Correction Strategy](#42-multi-tier-correction-strategy)
  - [4.3 Hysteresis Cooldown Enforcement](#43-hysteresis-cooldown-enforcement)
  - [4.4 Buffering Stall Auto-Recovery](#44-buffering-stall-auto-recovery)
- [5. Pre-Buffering and Sync-on-Ready Protocol](#5-pre-buffering-and-sync-on-ready-protocol)
  - [5.1 Protocol Flow](#51-protocol-flow)
  - [5.2 Edge-Case Protection](#52-edge-case-protection)
- [6. Client Identity and Resilience Layer](#6-client-identity-and-resilience-layer)
- [7. Requirements Traceability Matrix](#7-requirements-traceability-matrix)
- [8. Directory and File Structure](#8-directory-and-file-structure)
- [9. Setup and Verification Guide](#9-setup-and-verification-guide)
  - [9.1 Prerequisites](#91-prerequisites)
  - [9.2 Installation](#92-installation)
  - [9.3 Running locally](#93-running-locally)
  - [9.4 Running Automated Test Suite](#94-running-automated-test-suite)

---

## 1. Core Objective and Architecture Overview

The system consists of three distinct operational tiers:

1. **Controller Application (`/controller`)**: A web-based management dashboard allowing operators to select videos, trigger playback actions (Play, Pause, Seek, Restart), and monitor real-time health telemetry across all connected display clients.
2. **Display Application (`/display/[id]`)**: Independent playback clients opened in separate browser windows or tabs. Displays render high-definition video streams, emit status heartbeats, and adjust playback dynamically based on server correction commands.
3. **Authoritative Server Coordination Layer (`/server`)**: A Fastify + Socket.IO real-time server maintaining the single source of truth for session playback state, client telemetry, and automated synchronization logic.

```
+------------------------+             +----------------------------------+
| Controller Application |             |  Authoritative Coordination      |
|  (Next.js Dashboard)   |             |  Server (Fastify + Socket.IO)    |
+-----------+------------+             +----------------+-----------------+
            |                                           |                  
            | controller:command                        | state:update     
            v                                           v                  
+-----------+-------------------------------------------+-----------------+
|                        WebSocket Event Mesh                             |
+-----------+-------------------------------------------+-----------------+
            ^                                           ^                  
            | display:status (1s Heartbeat)             | correction:apply 
            |                                           |                  
+-----------+------------+             +----------------+-----------------+
|   Display Client 1     |             |        Display Client 2          |
|  (HTML5 Video + HUD)   |             |       (HTML5 Video + HUD)        |
+------------------------+             +----------------------------------+
```

---

## 2. System Requirements and Architecture Trade-offs

### Tech Stack Choices
- **Frontend Framework**: Next.js (TypeScript, React, App Router, Vanilla CSS Modules) for robust component structure and server/client render boundaries.
- **Backend Framework**: Fastify + Socket.IO (TypeScript) running as a dedicated Node.js process for low-overhead WebSocket event dispatching.
- **State Management**: In-memory state engine on the coordination server.

### Architecture Rationale
1. **In-Memory Authoritative State**: Video synchronization demands sub-millisecond state updates. Storing state in disk-bound databases introduces IO latency that degrades sync performance. In-memory data structures provide immediate deterministic state computation.
2. **Anchor Model vs. Ticking Counters**: Server-side `setInterval` ticking timers accumulate event loop jitter and drift over time. FrameSync stores intention and timestamp anchors, calculating expected playback positions on-demand.
3. **Decoupled Architecture**: Socket.IO transport layer utilizes shared TypeScript contracts (`shared/types.ts`), guaranteeing compile-time type safety across both client and server codebases.

---

## 3. Authoritative Playback State Engine

### 3.1 Timestamp Anchor Calculation Model

Rather than continuously updating a ticking position counter, the coordination server stores session intent alongside an anchor point:

```typescript
export interface SessionState {
  videoId: string;
  isPlaying: boolean;
  isPreparing: boolean;
  positionAtAnchor: number;  // Position in seconds when anchor was locked
  anchorTimestamp: number;   // Server Date.now() in ms when anchor was locked
  version: number;           // Monotonically increasing sequence version
}
```

The expected playback position at any arbitrary server timestamp `now` is calculated dynamically:

$$\text{Expected Position} = 
\begin{cases} 
\text{positionAtAnchor} & \text{if } \neg\text{isPlaying} \lor \text{isPreparing} \\ 
\min(\text{positionAtAnchor} + \frac{\text{now} - \text{anchorTimestamp}}{1000}, \text{VideoDuration}) & \text{if } \text{isPlaying} 
\end{cases}$$

### 3.2 Monotonic Sequence Versioning

To defend against out-of-order network packets or transient latency spikes over WebSocket connections, every state mutation increments `sessionState.version`. 

Client browsers maintain a `localVersion` counter and immediately drop any incoming state broadcast where `incoming.version <= localVersion`.

---

## 4. Synchronization and Drift Correction Engine

### 4.1 Quantitative Drift Telemetry Math

Every 1000ms, each display client reports its exact `currentTime` and `playbackState` via `display:status`. The server calculates the client's current drift relative to the authoritative expected position:

$$\text{driftMs} = (\text{reportedPosition} - \text{expectedPosition}) \times 1000$$

- $\text{driftMs} > 0$: Display client is running ahead of authoritative timeline.
- $\text{driftMs} < 0$: Display client is running behind authoritative timeline.

### 4.2 Multi-Tier Correction Strategy

The server evaluates drift using a three-tier threshold strategy designed to balance visual smoothness against synchronization accuracy:

| Tier | Drift Boundary | Action Taken | Rationale |
| :--- | :--- | :--- | :--- |
| **Deadband** | $\left\vert\text{driftMs}\right\vert < 300\text{ms}$ | No Action | Micro-drifts below 300ms are imperceptible to human viewers. Suppressing corrections avoids video stutter. |
| **Soft Rate Nudge** | $300\text{ms} \le \left\vert\text{driftMs}\right\vert \le 1500\text{ms}$ | Playback Rate Nudge (0.95x / 1.05x) | Adjusts HTML5 `<video>.playbackRate` dynamically for 4000ms. Eliminates drift seamlessly without audio popping or visual frame jumps. |
| **Hard Seek** | $\left\vert\text{driftMs}\right\vert > 1500\text{ms}$ | Immediate Hard Seek | Corrects severe desynchronization (e.g. initial connection or tab background throttling) by forcing `<video>.currentTime`. |

### 4.3 Hysteresis Cooldown Enforcement

To prevent rapid oscillation between thresholds on boundary values, the server enforces a 4000ms cooldown window per client (`lastCorrectionAt`). Subsequent corrections for a given display are suppressed until the cooldown window expires.

### 4.4 Buffering Stall Auto-Recovery

If a display client experiences network degradation and drops into a buffering state (`lastReportedState === 'loading'`), the server suspends drift penalties for that client. When the client resumes playback (`recoveredFromStall`), the server re-anchors the global session to the client's position, preserving multi-display harmony without forcing hard seeks.

---

## 5. Pre-Buffering and Sync-on-Ready Protocol

### 5.1 Protocol Flow

Cold video loads or seeking can cause variable buffering delays across clients depending on hardware and network speed. FrameSync resolves this using a **Sync-on-Ready Protocol**:

1. **Trigger**: When a video is selected (`SELECT_VIDEO`) or seeked (`SEEK`), the server sets `isPreparing = true`.
2. **Pre-Buffering**: Expected position calculations remain frozen at `positionAtAnchor`. Display clients initialize the media pipeline and seek to target position.
3. **Readiness Reporting**: Display clients emit `display:status` containing their media readiness state (`readyState`). A display reporting `readyState >= 3` (`HAVE_FUTURE_DATA`) is flagged as `isReady = true`.
4. **Synchronized Release**: As soon as all connected displays report `isReady === true`, the server calls `completePreBuffering()`, clearing `isPreparing = false` and locking `anchorTimestamp = Date.now()`. All displays begin playing simultaneously at the exact same millisecond.

### 5.2 Edge-Case Protection

- **Cached Media Readiness**: Displays instantly evaluate `video.readyState >= 3` on mount and emit status updates without waiting for the heartbeat interval.
- **Tab Disconnections**: If a display tab is closed during pre-buffering, the server re-evaluates `areAllDisplaysReady()`, releasing remaining displays immediately.
- **Playback Intent Preservation**: Seeking while a video is playing maintains `isPlaying = true`, ensuring playback resumes automatically as soon as pre-buffering finishes.

---

## 6. Client Identity and Resilience Layer

- **Persistent Client UUID**: Display clients generate a unique client ID stored in browser `localStorage` (`displayClientId_[id]`). Reloading or reconnecting a display tab reuses the same client ID, preventing duplicate server records.
- **Autoplay Policy Handling**: Displays feature an overlay warning informing users to interact with the page to enable unmuted audio, falling back to muted playback if blocked by browser policy.
- **Visual Diagnostics HUD**: Each display client renders an on-screen HUD detailing Client ID, Connection Status, Local Position, Calculated Drift, Version Number, and Active Video Title.

---

## 7. Requirements Traceability Matrix

| Section Requirement | System Implementation | Verification Status |
| :--- | :--- | :---: |
| **Controller Interface** | `/controller` dashboard with play, pause, seek slider, restart, video selector, and live display telemetry grid. | Verified |
| **Concurrent Displays** | `/display/[id]` supporting arbitrary concurrent displays in separate windows or tabs. | Verified |
| **Authoritative Coordination Server** | Node.js Fastify + Socket.IO server maintaining authoritative session state. | Verified |
| **Authoritative Position Calculation** | Server timestamp anchor model calculating position on-demand. | Verified |
| **Drift Measurement & Visual Display** | Real-time drift telemetry calculated in server and rendered on Controller & Display HUDs. | Verified |
| **Automated Correction Strategy** | Three-tier drift correction (Deadband, Soft Rate Nudge 0.95x/1.05x, Hard Seek). | Verified |
| **Identifiable Display Clients** | Persistent `localStorage` client UUID identification across reconnects. | Verified |
| **Pre-Buffering Sync** | Sync-on-Ready protocol preventing initial buffering drift on video loads. | Verified |

---

## 8. Directory and File Structure

```
FrameSync/
├── shared/
│   └── types.ts                 # Shared TypeScript event payloads and interfaces
├── server/
│   ├── src/
│   │   ├── __tests__/
│   │   │   └── state.test.ts    # Vitest unit test suite (25 tests)
│   │   ├── index.ts             # Fastify server bootstrap & Socket.IO initialization
│   │   ├── state.ts             # Authoritative state store & anchor calculations
│   │   ├── displays.ts          # Display registry & drift computation
│   │   ├── correction.ts        # Threshold evaluator & cooldown manager
│   │   ├── socketHandlers.ts    # Socket.IO event listeners & protocol wiring
│   │   └── types.ts             # Shared type re-exports
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── app/
│   │   ├── controller/
│   │   │   └── page.tsx         # Controller dashboard UI
│   │   ├── display/[id]/
│   │   │   └── page.tsx         # Display client page & HUD overlay
│   │   ├── globals.css          # Design system CSS design tokens
│   │   ├── layout.tsx           # Main application root layout
│   │   └── page.tsx             # Landing navigation page
│   ├── lib/
│   │   └── socket.ts            # Socket.IO client singleton
│   ├── types/
│   │   └── index.ts             # Frontend type re-exports
│   ├── package.json
│   └── tsconfig.json
├── .agents/                     # Architectural specs, rules, and workflows
└── README.md                    # System documentation
```

---

## 9. Setup and Verification Guide

### 9.1 Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 9.2 Installation

Clone the repository and install dependencies for both server and frontend applications:

```bash
# Install root / shared dependencies (if applicable)
npm install

# Install server dependencies
cd server
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 9.3 Running Locally

Start the Fastify coordination server and Next.js frontend in separate terminal windows:

#### Terminal 1: Start Coordination Server
```bash
cd server
npm run dev
```
The server will initialize on `http://localhost:4000`.

#### Terminal 2: Start Next.js Frontend
```bash
cd frontend
npm run dev
```
The application will be accessible at `http://localhost:3000`.

### 9.4 Running Automated Test Suite

To run the Vitest unit test suite covering state math, drift calculations, threshold boundaries, cooldowns, and version monotonicity:

```bash
cd server
npm test
```

### 9.5 Multi-Display Sync Verification Procedure

1. Open `http://localhost:3000/controller` in Browser Tab 1 (Controller Dashboard).
2. Open `http://localhost:3000/display/1` in Browser Tab 2 (Display Client 1).
3. Open `http://localhost:3000/display/2` in Browser Tab 3 (Display Client 2).
4. Arrange the tabs side-by-side to observe playback synchronization across windows.
5. Trigger **Play**, **Pause**, **Seek**, or **Select Video** from the Controller Dashboard. Observe the Sync-on-Ready pre-buffering state and real-time drift telemetry on both Controller and Display HUDs.