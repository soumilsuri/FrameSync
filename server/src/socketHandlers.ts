// ============================================================
// socketHandlers.ts — All Socket.IO event wiring
// ============================================================

import { Server, Socket } from 'socket.io';
import type { ControllerCommandPayload, DisplayStatusPayload, DisplayJoinPayload } from './types';

import {
  getState, applyPlay, applyPause, applySeek, applyRestart, applySelectVideo, checkAutoPause, completePreBuffering,
} from './state';
import {
  registerDisplay, markDisconnected, processStatusUpdate,
  getAllDisplays, findBySocketId, areAllDisplaysReady,
} from './displays';
import { evaluateCorrection } from './correction';

// Track controller socket IDs for targeted telemetry pushes
const controllerSockets = new Set<string>();

export function registerSocketHandlers(io: Server, socket: Socket): void {
  const { id } = socket;
  console.log(`[socket] connect → ${id}`);

  // ----------------------------------
  // Controller: register as controller
  // ----------------------------------
  socket.on('controller:join', () => {
    controllerSockets.add(id);
    console.log(`[controller] registered → ${id}`);
    // Send current state immediately
    socket.emit('state:update', getState());
    socket.emit('displays:update', getAllDisplays());
  });

  // ----------------------------------
  // Controller → Server commands
  // ----------------------------------
  socket.on('controller:command', (payload: ControllerCommandPayload) => {
    console.log(`[controller:command] ${payload.type}`, payload);
    let newState;

    switch (payload.type) {
      case 'PLAY':
        newState = applyPlay(payload.toPosition);
        break;
      case 'PAUSE':
        newState = applyPause();
        break;
      case 'SEEK':
        if (payload.toPosition !== undefined) {
          newState = applySeek(payload.toPosition);
        }
        break;
      case 'RESTART':
        newState = applyRestart();
        break;
      case 'SELECT_VIDEO':
        if (payload.videoId) {
          newState = applySelectVideo(payload.videoId);
        }
        break;
    }

    if (newState) {
      // Broadcast updated state to everyone (controller + all displays)
      io.emit('state:update', newState);
    }
  });

  // ----------------------------------
  // Display → Server: join / register
  // ----------------------------------
  socket.on('display:join', (payload: DisplayJoinPayload) => {
    const { clientId } = payload;
    const record = registerDisplay(clientId, id);
    console.log(`[display:join] clientId=${clientId} socketId=${id}`);

    // Send current authoritative state so display can sync immediately
    socket.emit('state:update', getState());

    // Notify all controllers about the updated display list
    broadcastDisplays(io);
  });

  // ----------------------------------
  // Display → Server: status heartbeat
  // ----------------------------------
  socket.on('display:status', (payload: DisplayStatusPayload) => {
    const autoPause = checkAutoPause();
    if (autoPause.didPause) {
      console.log(`[state] Video reached end duration → Auto-pausing session`);
      io.emit('state:update', autoPause.state);
    }

    const result = processStatusUpdate(payload);
    if (!result) return;

    const { record, recoveredFromStall } = result;
    const currentState = getState();

    // Check Pre-Buffering / Sync-on-Ready trigger
    if (currentState.isPreparing && areAllDisplaysReady()) {
      console.log(`[sync-on-ready] All displays report readyState >= 3 → Completing pre-buffering!`);
      const newState = completePreBuffering();
      io.emit('state:update', newState);
    }

    // If a display just recovered from a buffering stall, re-anchor the session
    // to its position so it doesn't get forced into a hard seek to an unbuffered position.
    if (recoveredFromStall && currentState.isPlaying && !currentState.isPreparing) {
      console.log(`[sync] Client ${record.clientId} recovered from buffering stall → Re-anchoring to ${payload.position.toFixed(2)}s`);
      const newState = applyPlay(payload.position);
      record.driftMs = 0;
      io.emit('state:update', newState);
    } else if (!currentState.isPreparing) {
      // Evaluate drift correction normally (only when not preparing)
      const decision = evaluateCorrection(record);
      if (decision.shouldCorrect && decision.payload) {
        console.log(`[correction] clientId=${record.clientId} action=${decision.payload.action} driftMs=${record.driftMs.toFixed(0)}`);
        socket.emit('correction:apply', decision.payload);
      }
    }

    // Push updated telemetry to all controllers
    broadcastDisplays(io);
  });

  // ----------------------------------
  // Disconnect
  // ----------------------------------
  socket.on('disconnect', () => {
    console.log(`[socket] disconnect → ${id}`);

    if (controllerSockets.has(id)) {
      controllerSockets.delete(id);
      return;
    }

    const record = markDisconnected(id);
    if (record) {
      console.log(`[display:disconnect] clientId=${record.clientId}`);
      const currentState = getState();
      if (currentState.isPreparing && areAllDisplaysReady()) {
        console.log(`[sync-on-ready] Remaining displays report ready after disconnect → Completing pre-buffering!`);
        const newState = completePreBuffering();
        io.emit('state:update', newState);
      }
      broadcastDisplays(io);
    }
  });
}

function broadcastDisplays(io: Server): void {
  const displays = getAllDisplays();
  // Only emit to controllers
  for (const ctrlId of controllerSockets) {
    io.to(ctrlId).emit('displays:update', displays);
  }
}
