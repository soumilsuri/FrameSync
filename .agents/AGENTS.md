# FrameSync - Project Rules & Guidelines

## Maintenance Rule (CRITICAL)
Whenever any architectural decision, state contract, event payload, drift algorithm, or file structure is modified during implementation, you MUST immediately update all relevant files in `.agents/` (`AGENTS.md`, `skills/`, `specs/`, `workflows/`) to ensure rules, specifications, and skill instructions never become stale or out-of-sync.

## Project Context
FrameSync is a real-time multi-display video playback synchronization system. A central **Controller Application** manages playback across multiple **Display Applications** synced via an authoritative **Server Coordination Layer**.

## Architecture & Tech Stack Rules
1. **Frontend**: Next.js (React, TypeScript, App Router) with `/controller` and `/display/[id]` routes.
2. **Real-time Server**: Fastify + Socket.IO (separate Node.js process) for low-latency WebSocket communication.
3. **State Management**: In-memory authoritative server-driven state engine (`SessionState` with `positionAtAnchor`, `anchorTimestamp`, and `version`). Clients treat server state as single source of truth.
4. **Transport & Protocol**: Socket.IO with shared TypeScript contracts (`types.ts`) imported across frontend and server.
5. **Drift Management**: Server-calculated drift with deadband (<300ms), soft rate correction (300-1500ms at 0.95x/1.05x), hard seek (>1500ms), and 3-5s cooldown.

## Code Style & Standards
- Enforce strict TypeScript interfaces for all Socket.IO event payloads (`controller:command`, `display:join`, `display:status`, `state:update`, `displays:update`, `correction:apply`).
- Maintain clean modular separation in the server (`/src/index.ts`, `state.ts`, `displays.ts`, `correction.ts`, `socketHandlers.ts`).
- Never store position as a ticking interval; store intent + anchor timestamp and derive expected position on-demand.
- Do not use a database for real-time playback state—in-memory state is required for performance.

## Testing & Verification Guidelines
- Verify multi-display synchronization with at least two concurrent Display clients.
- Simulate network latency / jitter to validate drift detection and auto-correction robustness.
- Ensure state consistency across reconnects and client joins using stable `localStorage` UUID client IDs.

## Customizations Directory Map
- **[AGENTS.md](file:///d:/coding_d/FrameSync/.agents/AGENTS.md)**: Global project rules, conventions, tech stack instructions, and maintenance rules.
- **Skills**:
  - `skills/frame-sync/SKILL.md`: Core system architecture, Fastify/Next.js setup, state machine, and socket event handlers.
  - `skills/drift-management/SKILL.md`: Quantitative drift calculation, threshold strategy (deadband, soft nudge, hard seek), and cooldown enforcement.
  - `skills/ui-design-system/SKILL.md`: Obsidian glassmorphism design tokens, micro-animations, and component aesthetics.
- **Specifications (`specs/`)**:
  - `specs/functional_requirements.md`: Functional requirement specs for Controller, Display, Server, and Sync.
  - `specs/non_functional_requirements.md`: NFR targets for latency, resilience, and modularity.
  - `specs/state_synchronization_spec.md`: Shared TypeScript event contracts, `SessionState`, and `DisplayRecord` schemas.
  - `specs/ui_design_system_spec.md`: Color tokens, glassmorphism CSS rules, and HUD overlay specs.
  - `specs/requirements_todo.md`: Workspace requirements checklist.
- **Workflows (`workflows/`)**:
  - `workflows/development_workflow.md`: Next.js & Fastify setup roadmap.
  - `workflows/drift_testing_workflow.md`: Test scenarios for sync, drift, and client reconnection.

