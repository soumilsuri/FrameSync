// ============================================================
// state.ts — Authoritative SessionState Store
// Uses the anchor model: store intent + timestamp, compute
// expected position on demand. Never tick a position counter.
// ============================================================

import type { SessionState } from './types';
import { VIDEO_LIST } from './types';


// Singleton in-memory authoritative state
let sessionState: SessionState = {
  videoId: VIDEO_LIST[0].id,
  isPlaying: false,
  isPreparing: false,
  positionAtAnchor: 0,
  anchorTimestamp: Date.now(),
  version: 0,
};

/**
 * Derive the expected playback position at any given moment.
 * While playing: advance from anchor using real wall-clock elapsed time.
 * While paused/preparing: frozen at positionAtAnchor.
 * Capped at video duration when playing.
 */
export function getExpectedPosition(state: SessionState, now: number): number {
  if (!state.isPlaying || state.isPreparing) {
    return state.positionAtAnchor;
  }
  const elapsedSeconds = (now - state.anchorTimestamp) / 1000;
  const rawExpected = state.positionAtAnchor + elapsedSeconds;

  const video = VIDEO_LIST.find(v => v.id === state.videoId);
  if (video && video.duration && rawExpected >= video.duration) {
    return video.duration;
  }
  return rawExpected;
}

export function checkAutoPause(): { didPause: boolean; state: SessionState } {
  if (!sessionState.isPlaying || sessionState.isPreparing) return { didPause: false, state: sessionState };

  const now = Date.now();
  const video = VIDEO_LIST.find(v => v.id === sessionState.videoId);
  if (!video || !video.duration) return { didPause: false, state: sessionState };

  const elapsedSeconds = (now - sessionState.anchorTimestamp) / 1000;
  if (sessionState.positionAtAnchor + elapsedSeconds >= video.duration) {
    sessionState = {
      ...sessionState,
      isPlaying: false,
      isPreparing: false,
      positionAtAnchor: video.duration,
      anchorTimestamp: now,
      version: sessionState.version + 1,
    };
    return { didPause: true, state: sessionState };
  }

  return { didPause: false, state: sessionState };
}

export function getState(): SessionState {
  return sessionState;
}

export function applyPlay(atPosition?: number): SessionState {
  const now = Date.now();
  sessionState = {
    ...sessionState,
    isPlaying: true,
    // If still preparing, keep isPreparing: true so socketHandlers unlocks it when all displays are ready
    isPreparing: sessionState.isPreparing,
    positionAtAnchor: atPosition ?? getExpectedPosition(sessionState, now),
    anchorTimestamp: now,
    version: sessionState.version + 1,
  };
  return sessionState;
}

export function applyPause(): SessionState {
  const now = Date.now();
  sessionState = {
    ...sessionState,
    isPlaying: false,
    isPreparing: false,
    positionAtAnchor: getExpectedPosition(sessionState, now),
    anchorTimestamp: now,
    version: sessionState.version + 1,
  };
  return sessionState;
}

export function applySeek(toPosition: number): SessionState {
  const wasPlaying = sessionState.isPlaying;
  sessionState = {
    ...sessionState,
    isPlaying: wasPlaying,
    isPreparing: true,
    positionAtAnchor: toPosition,
    anchorTimestamp: Date.now(),
    version: sessionState.version + 1,
  };
  return sessionState;
}

export function applyRestart(): SessionState {
  const wasPlaying = sessionState.isPlaying;
  sessionState = {
    ...sessionState,
    isPlaying: wasPlaying,
    isPreparing: true,
    positionAtAnchor: 0,
    anchorTimestamp: Date.now(),
    version: sessionState.version + 1,
  };
  return sessionState;
}

export function completePreBuffering(): SessionState {
  const now = Date.now();
  sessionState = {
    ...sessionState,
    isPreparing: false,
    anchorTimestamp: now,
    version: sessionState.version + 1,
  };
  return sessionState;
}

export function applySelectVideo(videoId: string): SessionState {
  sessionState = {
    ...sessionState,
    videoId,
    isPlaying: false,
    isPreparing: true,
    positionAtAnchor: 0,
    anchorTimestamp: Date.now(),
    version: sessionState.version + 1,
  };
  return sessionState;
}
