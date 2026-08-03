'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Wifi, WifiOff, AlertTriangle, CheckCircle2, Play } from 'lucide-react';

import { getSocket } from '@/lib/socket';
import type { SessionState, CorrectionCommandPayload } from '@/types';
import { VIDEO_LIST, DRIFT_THRESHOLDS } from '@/types';

// ---- Helpers ----

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00.000';
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toFixed(3);
  return `${m}:${s.padStart(6, '0')}`;
}

function getExpectedPosition(state: SessionState, now: number): number {
  if (!state.isPlaying) return state.positionAtAnchor;
  return state.positionAtAnchor + (now - state.anchorTimestamp) / 1000;
}

function getDriftColor(driftMs: number): string {
  const abs = Math.abs(driftMs);
  if (abs < DRIFT_THRESHOLDS.DEADBAND_MS) return 'var(--status-synced)';
  if (abs <= DRIFT_THRESHOLDS.SOFT_CORRECTION_MS) return 'var(--status-warn)';
  return 'var(--status-error)';
}

// ============================================================
export default function DisplayPage() {
  const params = useParams();
  const displayId = (params?.id as string) || 'unknown';

  const socketRef = useRef(getSocket());
  const videoRef = useRef<HTMLVideoElement>(null);

  // Stable client UUID stored in localStorage per specific display route
  const [clientId, setClientId] = useState<string>('');
  const clientIdRef = useRef<string>('');
  
  useEffect(() => {
    const storageKey = `displayClientId_${displayId}`;
    let id = localStorage.getItem(storageKey);
    if (!id) {
      id = `d${displayId}-${crypto.randomUUID().slice(0, 8)}`;
      localStorage.setItem(storageKey, id);
    }
    clientIdRef.current = id;
    
    // Defer setState to avoid React warnings about updating state during render in some StrictMode flows
    setTimeout(() => setClientId(id!), 0);
  }, [displayId]);

  const [connected, setConnected] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [localVersion, setLocalVersion] = useState(-1);
  const [localPosition, setLocalPosition] = useState(0);
  const [driftMs, setDriftMs] = useState(0);
  const [videoState, setVideoState] = useState<'playing' | 'paused' | 'loading'>('paused');
  const [isMuted, setIsMuted] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);

  const currentVideo = sessionState
    ? VIDEO_LIST.find(v => v.id === sessionState.videoId) ?? VIDEO_LIST[0]
    : VIDEO_LIST[0];

  // ---- Enable Audio on User Click ----
  const handleUserInteraction = () => {
    setUserInteracted(true);
    setIsMuted(false);
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      if (sessionState?.isPlaying && video.paused) {
        video.play().catch(() => {});
      }
    }
  };

  // ---- Apply server state to video element ----
  const applyState = useCallback((state: SessionState) => {
    const video = videoRef.current;
    if (!video) return;

    // Guard against stale / out-of-order messages
    if (state.version <= localVersion) return;
    setLocalVersion(state.version);
    setSessionState(state);

    const expected = getExpectedPosition(state, Date.now());

    // Sync src if video changed
    const targetUrl = VIDEO_LIST.find(v => v.id === state.videoId)?.url;
    if (targetUrl && video.src !== targetUrl) {
      video.src = targetUrl;
      video.load();
    }

    // Seek if position differs by more than 500ms
    try {
      if (Math.abs(video.currentTime - expected) > 0.5) {
        video.currentTime = expected;
      }
    } catch (err) {
      console.warn('Could not set currentTime (likely loading metadata):', err);
    }

    if (state.isPlaying && video.paused) {
      video.play().catch(() => {
        // Fallback for strict browser autoplay policies: play muted
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => {});
      });
    } else if (!state.isPlaying && !video.paused) {
      video.pause();
    }
  }, [localVersion]);

  // ---- Socket Setup ----
  useEffect(() => {
    if (!clientId) return; // Wait until client ID is loaded from storage

    const socket = socketRef.current;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('display:join', { clientId });
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('state:update', (state: SessionState) => {
      applyState(state);
    });

    socket.on('correction:apply', (cmd: CorrectionCommandPayload) => {
      const video = videoRef.current;
      if (!video) return;
      if (cmd.action === 'seek') {
        console.log(`[correction] hard seek → ${cmd.value.toFixed(2)}s`);
        video.currentTime = cmd.value;
      } else if (cmd.action === 'rate-nudge') {
        console.log(`[correction] rate-nudge → ${cmd.value}x for ${cmd.durationMs}ms`);
        video.playbackRate = cmd.value;
        if (cmd.durationMs) {
          setTimeout(() => { if (videoRef.current) videoRef.current.playbackRate = 1; }, cmd.durationMs);
        }
      }
    });

    if (socket.connected) {
      setConnected(true);
      socket.emit('display:join', { clientId });
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('state:update');
      socket.off('correction:apply');
    };
  }, [applyState, clientId]);

  // ---- Send immediate status update when readyState changes ----
  const emitStatus = useCallback(() => {
    const video = videoRef.current;
    const socket = socketRef.current;
    if (!video || !socket.connected || !clientIdRef.current) return;

    const position = video.currentTime;
    const playbackState = video.paused ? 'paused' : (video.readyState < 3 ? 'loading' : 'playing');

    socket.emit('display:status', {
      clientId: clientIdRef.current,
      position,
      playbackState,
      readyState: video.readyState,
      timestamp: Date.now(),
    });
  }, []);

  // Attach video event listeners for instant readyState reporting
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Immediately report current readyState if already loaded/cached
    if (video.readyState >= 3) {
      emitStatus();
    }

    video.addEventListener('canplay', emitStatus);
    video.addEventListener('canplaythrough', emitStatus);
    video.addEventListener('loadeddata', emitStatus);

    return () => {
      video.removeEventListener('canplay', emitStatus);
      video.removeEventListener('canplaythrough', emitStatus);
      video.removeEventListener('loadeddata', emitStatus);
    };
  }, [emitStatus]);

  // ---- Heartbeat: emit display:status every 1s ----
  useEffect(() => {
    const interval = setInterval(() => {
      emitStatus();
    }, 1000);
    return () => clearInterval(interval);
  }, [emitStatus]);

  // ---- Local HUD tick ----
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const pos = video.currentTime;
      setLocalPosition(pos);

      if (sessionState) {
        const expected = getExpectedPosition(sessionState, Date.now());
        setDriftMs((pos - expected) * 1000);
      }

      const state = video.paused ? 'paused' : (video.readyState < 3 ? 'loading' : 'playing');
      setVideoState(state);
    }, 100);
    return () => clearInterval(interval);
  }, [sessionState]);

  const driftAbs = Math.abs(driftMs);
  const driftColor = getDriftColor(driftMs);

  return (
    <div
      onClick={handleUserInteraction}
      style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
    >
      {/* ---- Video Element ---- */}
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        playsInline
        preload="auto"
        muted={isMuted}
        src={currentVideo.url}
      />

      {/* ---- Pre-Buffering Protocol Overlay ---- */}
      {sessionState?.isPreparing && (
        <div style={{
          position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 70,
          background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(16px)',
          border: '1px solid var(--accent-cyan)', borderRadius: 999,
          padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px rgba(6,182,212,0.3)',
        }}>
          <span className="led led-amber" style={{ animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Sync-on-Ready: Pre-buffering Stream…
          </span>
        </div>
      )}

      {/* ---- Mute/Unmute Overlay Alert for Browser Autoplay Policy ---- */}
      {!userInteracted && (
        <div style={{
          position: 'absolute', bottom: 24, right: 24, zIndex: 60,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)',
          border: '1px solid var(--accent-indigo)', borderRadius: 12,
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', animation: 'pulse 2s infinite',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="23" y1="9" x2="17" y2="15"></line>
            <line x1="17" y1="9" x2="23" y2="15"></line>
          </svg>

          <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            Click anywhere on screen to enable Unmuted Audio
          </span>
        </div>
      )}

      {/* ---- HUD Overlay (top-left) ---- */}
      <div className="hud-overlay" style={{ position: 'absolute', top: 16, left: 16 }}>

        {/* Client ID + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {connected
            ? <Wifi size={13} color="var(--status-synced)" />
            : <WifiOff size={13} color="var(--status-error)" />}
          <span className="mono" style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {clientId ? clientId.slice(0, 8) : '—'}
          </span>
          <span style={{
            fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px',
            borderRadius: 999,
            background: connected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: connected ? 'var(--status-synced)' : 'var(--status-error)',
            border: `1px solid ${connected ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--glass-border)', marginBottom: 10 }} />

        {/* Metrics grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <MetricRow label="Local Time" value={formatTime(localPosition)} mono />
          <MetricRow
            label="State"
            value={videoState === 'playing' ? 'Playing' : videoState === 'loading' ? 'Buffering' : 'Paused'}
          />
          <MetricRow
            label="Drift"
            value={`${driftMs >= 0 ? '+' : ''}${Math.round(driftMs)}ms`}
            mono
            color={driftColor}
          />
          {driftAbs >= DRIFT_THRESHOLDS.SOFT_CORRECTION_MS && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <AlertTriangle size={11} color="var(--status-error)" />
              <span style={{ fontSize: '0.62rem', color: 'var(--status-error)', fontWeight: 600 }}>Hard Seek Pending</span>
            </div>
          )}
          {driftAbs < DRIFT_THRESHOLDS.DEADBAND_MS && driftAbs > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <CheckCircle2 size={11} color="var(--status-synced)" />
              <span style={{ fontSize: '0.62rem', color: 'var(--status-synced)', fontWeight: 600 }}>Synced</span>
            </div>
          )}
          <MetricRow label="Version" value={sessionState ? `#${sessionState.version}` : '—'} mono />
          <MetricRow label="Video" value={currentVideo.label} />
        </div>
      </div>

      {/* ---- Waiting for Controller Overlay ---- */}
      {!sessionState && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          textAlign: 'center',
        }}>
          <div className="hud-overlay" style={{ position: 'static', padding: 24, minWidth: 280 }}>
            <Wifi size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              Waiting for Controller
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {connected ? 'Connected to server — awaiting playback state' : 'Connecting to server…'}
            </p>
            <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--accent-indigo)', marginTop: 12 }}>
              ID: {clientId?.slice(0, 8) || '…'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Mini sub-component ----
function MetricRow({ label, value, mono, color }: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{
        fontSize: '0.72rem',
        color: color ?? 'var(--text-secondary)',
        fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
        fontVariantNumeric: mono ? 'tabular-nums' : undefined,
        fontWeight: 500,
      }}>
        {value}
      </span>
    </div>
  );
}
