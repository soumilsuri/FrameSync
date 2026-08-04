# FrameSync Development Workflow

## Step 1: Shared Event Contract (`types.ts`)
- Define `SessionState`, `DisplayRecord`, `ControllerCommandPayload`, `DisplayStatusPayload`, and `CorrectionApplyPayload`.
- Share interfaces across `/frontend` and `/server`.

## Step 2: Server Coordination Engine (Fastify + Socket.IO)
- Setup Fastify HTTP server and attach Socket.IO.
- Implement `state.ts` module with `SessionState` store and `getExpectedPosition()` anchor formula.
- Implement `displays.ts` for tracking connected displays map and computing `driftMs`.
- Implement `correction.ts` for evaluating thresholds (<300ms deadband, 300-1500ms soft nudge, >1500ms hard seek) and managing 3-5s cooldowns.
- Wire event listeners in `socketHandlers.ts`.

## Step 3: Controller UI (`/frontend/app/controller/page.tsx`)
- Build video selector dropdown, play/pause/seek/restart control buttons.
- Connect via Socket.IO client singleton (`lib/socket.ts`).
- Render live display status table listening to `displays:update`.

## Step 4: Display UI & HUD (`/frontend/app/display/[id]/page.tsx`)
- Generate/retrieve `displayClientId` from `localStorage`.
- Connect to socket server, emit `display:join`.
- Sync HTML5 `<video>` element on `state:update` events (verifying `version > localVersion`).
- Handle `correction:apply` events (`seek` or `rate-nudge`).
- Emit `display:status` heartbeats every ~1 second.
- Render debug HUD overlay.

## Step 5: End-to-End Verification
- Launch server and frontend. Open 1 Controller tab and 2 Display tabs.
- Verify playback synchronization and drift correction behavior.

## Step 6: Deployment (Render / Cloud)
- Configured npm `workspaces: ["frontend", "server"]` in root `package.json` so `npm install` at root installs all monorepo dependencies (including `next` and `tsc`).
- Root scripts added: `npm run build:server`, `npm run start:server`, `npm run build:frontend`, `npm run start:frontend`.
- Deploy using `render.yaml` Blueprint (which provisions `framesync-server` and `framesync-frontend` using `fromService: property: host` for automatic inter-service linking) or configure two Web Services with repository root directory.
- Environment variables: `FRONTEND_URL` on Server, `NEXT_PUBLIC_SERVER_URL` on Frontend (automatically normalized with `https://` if protocol is omitted).
