// ============================================================
// displays.ts — DisplayRecord Registry & Drift Calculation
// ============================================================

import type { DisplayRecord, DisplayStatusPayload } from './types';

import { getExpectedPosition, getState } from './state';

// Client ID → DisplayRecord map
const displayRegistry = new Map<string, DisplayRecord>();

export function getDisplayRegistry(): Map<string, DisplayRecord> {
  return displayRegistry;
}

export function getAllDisplays(): DisplayRecord[] {
  return Array.from(displayRegistry.values());
}

export function registerDisplay(clientId: string, socketId: string): DisplayRecord {
  const existing = displayRegistry.get(clientId);
  const record: DisplayRecord = {
    clientId,
    socketId,
    connectionStatus: 'connected',
    lastReportedPosition: existing?.lastReportedPosition ?? 0,
    lastReportedState: existing?.lastReportedState ?? 'paused',
    readyState: existing?.readyState ?? 0,
    isReady: existing?.isReady ?? false,
    lastReportedAt: Date.now(),
    driftMs: existing?.driftMs ?? 0,
    lastCorrectionAt: existing?.lastCorrectionAt ?? null,
  };
  displayRegistry.set(clientId, record);
  return record;
}

export function markDisconnected(socketId: string): DisplayRecord | null {
  for (const [clientId, record] of displayRegistry.entries()) {
    if (record.socketId === socketId) {
      record.connectionStatus = 'disconnected';
      displayRegistry.delete(clientId);
      return record;
    }
  }
  return null;
}

export function findBySocketId(socketId: string): DisplayRecord | null {
  for (const record of displayRegistry.values()) {
    if (record.socketId === socketId) return record;
  }
  return null;
}

export function areAllDisplaysReady(): boolean {
  const connectedDisplays = Array.from(displayRegistry.values()).filter(
    d => d.connectionStatus === 'connected'
  );
  if (connectedDisplays.length === 0) return true;
  return connectedDisplays.every(d => d.isReady);
}

export interface ProcessStatusResult {
  record: DisplayRecord;
  recoveredFromStall: boolean;
}

/**
 * Process a status heartbeat from a Display client.
 * Computes drift relative to authoritative expected position.
 * driftMs > 0 → Display is ahead
 * driftMs < 0 → Display is behind
 */
export function processStatusUpdate(payload: DisplayStatusPayload): ProcessStatusResult | null {
  const record = displayRegistry.get(payload.clientId);
  if (!record) return null;

  const wasLoading = record.lastReportedState === 'loading';
  const isNowPlaying = payload.playbackState === 'playing';
  const recoveredFromStall = wasLoading && isNowPlaying;

  const expectedPosition = getExpectedPosition(getState(), Date.now());
  const driftMs = (payload.position - expectedPosition) * 1000;

  record.lastReportedPosition = payload.position;
  record.lastReportedState = payload.playbackState;
  record.readyState = payload.readyState ?? 0;
  record.isReady = (payload.readyState ?? 0) >= 3;
  record.lastReportedAt = Date.now();
  record.driftMs = driftMs;

  return { record, recoveredFromStall };
}
