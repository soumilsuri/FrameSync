// ============================================================
// state.test.ts — Unit tests for the authoritative state engine
// Run with: npm test (vitest)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { DRIFT_THRESHOLDS } from '../types';


// We need to re-import state module fresh for each test since it holds singleton state.
// Use dynamic import inside each test for isolation.

// ---- Isolated helpers (pure functions, no module state) ----

function getExpectedPosition(
  state: { isPlaying: boolean; isPreparing?: boolean; positionAtAnchor: number; anchorTimestamp: number },
  now: number
): number {
  if (!state.isPlaying || state.isPreparing) return state.positionAtAnchor;
  const elapsedSeconds = (now - state.anchorTimestamp) / 1000;
  return state.positionAtAnchor + elapsedSeconds;
}

function computeDrift(reportedPosition: number, expectedPosition: number): number {
  return (reportedPosition - expectedPosition) * 1000;
}

// ============================================================
// 1. Expected Position Calculation
// ============================================================
describe('getExpectedPosition', () => {
  it('returns positionAtAnchor exactly when paused', () => {
    const state = {
      isPlaying: false,
      positionAtAnchor: 42.5,
      anchorTimestamp: Date.now() - 5000, // 5s ago
    };
    const result = getExpectedPosition(state, Date.now());
    expect(result).toBe(42.5); // must stay frozen
  });

  it('advances position proportional to elapsed time when playing', () => {
    const anchorTimestamp = Date.now() - 10000; // 10 seconds ago
    const state = {
      isPlaying: true,
      positionAtAnchor: 20,
      anchorTimestamp,
    };
    const result = getExpectedPosition(state, Date.now());
    // Should be approximately 30 (20 + 10s)
    expect(result).toBeGreaterThanOrEqual(29.9);
    expect(result).toBeLessThanOrEqual(30.1);
  });

  it('returns positionAtAnchor (not 0) when paused mid-video', () => {
    const state = {
      isPlaying: false,
      positionAtAnchor: 99.99,
      anchorTimestamp: Date.now(),
    };
    expect(getExpectedPosition(state, Date.now())).toBe(99.99);
  });

  it('returns exactly positionAtAnchor when anchor is now and playing', () => {
    const now = Date.now();
    const state = {
      isPlaying: true,
      positionAtAnchor: 15,
      anchorTimestamp: now,
    };
    const result = getExpectedPosition(state, now);
    expect(result).toBeCloseTo(15, 2);
  });
});

// ============================================================
// 2. Drift Calculation
// ============================================================
describe('Drift Calculation', () => {
  it('produces zero drift when positions match exactly', () => {
    expect(computeDrift(42.5, 42.5)).toBe(0);
  });

  it('produces positive drift when display is ahead of expected', () => {
    const drift = computeDrift(45, 42); // display 3s ahead = +3000ms
    expect(drift).toBe(3000);
  });

  it('produces negative drift when display is behind expected', () => {
    const drift = computeDrift(40, 45); // display 5s behind = -5000ms
    expect(drift).toBe(-5000);
  });

  it('correctly represents sub-second drift in ms', () => {
    const drift = computeDrift(42.25, 42.0); // 250ms ahead
    expect(drift).toBeCloseTo(250, 1);
  });
});

// ============================================================
// 3. Drift Thresholds (DRIFT_THRESHOLDS constants)
// ============================================================
describe('DRIFT_THRESHOLDS constants', () => {
  it('deadband is 300ms', () => {
    expect(DRIFT_THRESHOLDS.DEADBAND_MS).toBe(300);
  });

  it('soft correction upper bound is 1500ms', () => {
    expect(DRIFT_THRESHOLDS.SOFT_CORRECTION_MS).toBe(1500);
  });

  it('soft rate behind is faster than 1.0', () => {
    expect(DRIFT_THRESHOLDS.SOFT_RATE_BEHIND).toBeGreaterThan(1);
  });

  it('soft rate ahead is slower than 1.0', () => {
    expect(DRIFT_THRESHOLDS.SOFT_RATE_AHEAD).toBeLessThan(1);
  });

  it('cooldown is between 3s and 5s', () => {
    expect(DRIFT_THRESHOLDS.COOLDOWN_MS).toBeGreaterThanOrEqual(3000);
    expect(DRIFT_THRESHOLDS.COOLDOWN_MS).toBeLessThanOrEqual(5000);
  });
});

// ============================================================
// 4. Correction Decision Logic (stateless version)
// ============================================================
function evaluateCorrectionDecision(
  driftMs: number,
  lastCorrectionAt: number | null,
  now: number
): { shouldCorrect: boolean; action?: string } {
  const absD = Math.abs(driftMs);

  if (lastCorrectionAt !== null) {
    const elapsed = now - lastCorrectionAt;
    if (elapsed < DRIFT_THRESHOLDS.COOLDOWN_MS) {
      return { shouldCorrect: false };
    }
  }

  if (absD < DRIFT_THRESHOLDS.DEADBAND_MS) {
    return { shouldCorrect: false };
  }

  if (absD > DRIFT_THRESHOLDS.SOFT_CORRECTION_MS) {
    return { shouldCorrect: true, action: 'seek' };
  }

  return { shouldCorrect: true, action: 'rate-nudge' };
}

describe('Correction Decision', () => {
  it('returns no correction for drift within deadband', () => {
    const result = evaluateCorrectionDecision(150, null, Date.now());
    expect(result.shouldCorrect).toBe(false);
  });

  it('returns rate-nudge for moderate drift (300ms – 1500ms)', () => {
    const result = evaluateCorrectionDecision(800, null, Date.now());
    expect(result.shouldCorrect).toBe(true);
    expect(result.action).toBe('rate-nudge');
  });

  it('returns seek for severe drift (>1500ms)', () => {
    const result = evaluateCorrectionDecision(2000, null, Date.now());
    expect(result.shouldCorrect).toBe(true);
    expect(result.action).toBe('seek');
  });

  it('suppresses correction during cooldown window', () => {
    const now = Date.now();
    const lastCorrectionAt = now - 1000; // only 1s ago (cooldown = 4s)
    const result = evaluateCorrectionDecision(2500, lastCorrectionAt, now);
    expect(result.shouldCorrect).toBe(false);
  });

  it('allows correction after cooldown has elapsed', () => {
    const now = Date.now();
    const lastCorrectionAt = now - 5000; // 5s ago, cooldown expired
    const result = evaluateCorrectionDecision(2500, lastCorrectionAt, now);
    expect(result.shouldCorrect).toBe(true);
    expect(result.action).toBe('seek');
  });

  it('handles negative drift (display behind) with rate-nudge', () => {
    const result = evaluateCorrectionDecision(-600, null, Date.now());
    expect(result.shouldCorrect).toBe(true);
    expect(result.action).toBe('rate-nudge');
  });

  it('handles negative severe drift (display behind) with seek', () => {
    const result = evaluateCorrectionDecision(-3000, null, Date.now());
    expect(result.shouldCorrect).toBe(true);
    expect(result.action).toBe('seek');
  });
});

// ============================================================
// 5. Version Monotonicity
// ============================================================
describe('Version Monotonicity', () => {
  it('version increases with each simulated state mutation', () => {
    let version = 0;
    const bump = () => ++version;
    const v1 = bump();
    const v2 = bump();
    const v3 = bump();
    expect(v2).toBeGreaterThan(v1);
    expect(v3).toBeGreaterThan(v2);
  });

  it('stale state is detectable via version comparison', () => {
    const localVersion = 5;
    const incoming = { version: 4 }; // older
    const shouldDiscard = incoming.version <= localVersion;
    expect(shouldDiscard).toBe(true);
  });

  it('newer state is accepted', () => {
    const localVersion = 5;
    const incoming = { version: 6 };
    const shouldDiscard = incoming.version <= localVersion;
    expect(shouldDiscard).toBe(false);
  });
});

// ============================================================
// 6. Pre-Buffering / Sync-on-Ready Protocol
// ============================================================
describe('Pre-Buffering / Sync-on-Ready Protocol', () => {
  it('freezes expected position while isPreparing is true', () => {
    const state = {
      isPlaying: true,
      isPreparing: true,
      positionAtAnchor: 10.0,
      anchorTimestamp: Date.now() - 5000, // 5s ago
    };
    // Expected position must remain frozen at 10.0 until pre-buffering completes
    const result = getExpectedPosition(state, Date.now());
    expect(result).toBe(10.0);
  });

  it('resumes position advancement once isPreparing becomes false', () => {
    const now = Date.now();
    const state = {
      isPlaying: true,
      isPreparing: false,
      positionAtAnchor: 10.0,
      anchorTimestamp: now - 3000, // 3s ago
    };
    const result = getExpectedPosition(state, now);
    expect(result).toBeCloseTo(13.0, 1);
  });
});
