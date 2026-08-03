# Non-Functional Requirements Specification (NFRS)

## 1. Performance & Latency (NFR1)
- **Low-Latency Transport**: Socket.IO over WebSockets with sub-50ms local event transmission.
- **In-Memory State**: Server holds ephemeral session state in memory (no DB network latency in hot loop).
- **Efficient Heartbeats**: Display telemetry updates sent at 1-second intervals without frame drops on video rendering.

## 2. Network Resilience & Fault Tolerance (NFR2)
- **Persistent Client Identity**: `localStorage` UUID prevents client duplicate creation during socket reconnects.
- **State Resynchronization**: Reconnecting displays issue full state fetch (`display:join`) and resync from scratch.
- **Out-of-Order Packet Defense**: Monotonically increasing `version` sequence counter discards stale state events.

## 3. System Architecture & Modularity (NFR3)
- **Server-Authoritative Pattern**: Server is sole source of truth; Controller and Displays act as clients.
- **Separation of Concerns**:
  - `/frontend` (Next.js App Router for routes `/controller` and `/display/[id]`)
  - `/server` (Fastify + Socket.IO server with isolated state, display, and correction modules)
  - Shared TypeScript contract (`types.ts`) for compile-time safety.

## 4. Observability & Debuggability (NFR4)
- **On-Screen Debug HUD**: Live telemetry overlay on Display clients.
- **Controller Dashboard**: Real-time table displaying client health, position, and drift metrics.
- **Console Logging**: Explicit server logs for state transitions and correction commands.

## 5. Scalability & Extensibility (NFR5)
- **Documented Horizontal Scale Path**: Standardized migration path to Redis adapter (`@socket.io/redis-adapter`) for multi-node deployments.
- **Zero Heavy Tooling**: Plain React state (`useState`/`useReducer`) for UI state; no unnecessary state management bloat.
