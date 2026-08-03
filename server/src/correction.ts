// ============================================================
// correction.ts — Drift Threshold Evaluator & Cooldown Manager
//
// Thresholds (with reasoning):
//   < DEADBAND_MS (300ms):         No action — imperceptible to human viewer
//   300ms – 1500ms (SOFT):        Rate nudge (0.95x/1.05x) — invisible correction
//   > 1500ms (HARD):              Direct seek — best UX at severe desync
//
// Cooldown: 3-5s per client prevents oscillation at threshold boundaries.
// ============================================================

import type { DisplayRecord, CorrectionCommandPayload } from './types';
import { DRIFT_THRESHOLDS } from './types';

import { getExpectedPosition, getState } from './state';

export interface CorrectionDecision {
  shouldCorrect: boolean;
  payload?: CorrectionCommandPayload;
}

/**
 * Evaluate whether a given display needs a drift correction and what kind.
 * Returns a decision object. The caller is responsible for emitting the event.
 */
export function evaluateCorrection(record: DisplayRecord): CorrectionDecision {
  const now = Date.now();
  const absD = Math.abs(record.driftMs);

  // Cooldown check — don't re-correct a client that was just corrected
  if (record.lastCorrectionAt !== null) {
    const elapsed = now - record.lastCorrectionAt;
    if (elapsed < DRIFT_THRESHOLDS.COOLDOWN_MS) {
      return { shouldCorrect: false };
    }
  }

  // Do not correct if the client is actively buffering/loading
  if (record.lastReportedState === 'loading') {
    return { shouldCorrect: false };
  }

  // Deadband — no correction needed
  if (absD < DRIFT_THRESHOLDS.DEADBAND_MS) {
    return { shouldCorrect: false };
  }

  const expectedPosition = getExpectedPosition(getState(), now);

  // Hard seek for severe desync
  if (absD > DRIFT_THRESHOLDS.SOFT_CORRECTION_MS) {
    record.lastCorrectionAt = now;
    return {
      shouldCorrect: true,
      payload: {
        action: 'seek',
        value: expectedPosition,
      },
    };
  }

  // Soft rate nudge for moderate drift
  const rate = record.driftMs < 0
    ? DRIFT_THRESHOLDS.SOFT_RATE_BEHIND   // behind → speed up
    : DRIFT_THRESHOLDS.SOFT_RATE_AHEAD;   // ahead  → slow down

  record.lastCorrectionAt = now;
  return {
    shouldCorrect: true,
    payload: {
      action: 'rate-nudge',
      value: rate,
      durationMs: DRIFT_THRESHOLDS.SOFT_NUDGE_DURATION_MS,
    },
  };
}
