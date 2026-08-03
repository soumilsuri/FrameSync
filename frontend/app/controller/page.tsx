'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, MonitorPlay, Wifi, WifiOff,
  Radio, Tv2, ExternalLink, Plus, ScreenShare,
} from 'lucide-react';
import { getSocket } from '@/lib/socket';
import type { SessionState, DisplayRecord } from '@/types';
import { VIDEO_LIST } from '@/types';

// ---- Helpers ----

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getDriftClass(driftMs: number): string {
  const abs = Math.abs(driftMs);
  if (abs < 300) return 'drift-pill-synced';
  if (abs <= 1500) return 'drift-pill-warn';
  return 'drift-pill-error';
}

function getLedClass(status: DisplayRecord['connectionStatus']): string {
  if (status === 'connected') return 'led-green';
  if (status === 'reconnecting') return 'led-amber';
  return 'led-gray';
}

function getStateBadge(state: DisplayRecord['lastReportedState'], status: DisplayRecord['connectionStatus'], isReady?: boolean, isPreparingSession?: boolean) {
  if (status === 'disconnected') return { label: 'Offline', cls: 'drift-pill-neutral' };
  if (isPreparingSession && !isReady) return { label: 'Pre-buffering ⏳', cls: 'drift-pill-warn' };
  if (isReady && isPreparingSession) return { label: 'Buffered ✓', cls: 'drift-pill-synced' };
  if (state === 'playing') return { label: 'Playing', cls: 'drift-pill-synced' };
  if (state === 'loading') return { label: 'Buffering', cls: 'drift-pill-warn' };
  return { label: 'Paused', cls: 'drift-pill-neutral' };
}

// ============================================================
export default function ControllerPage() {
  const socketRef = useRef(getSocket());
  const [connected, setConnected] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [displays, setDisplays] = useState<DisplayRecord[]>([]);
  const [seekValue, setSeekValue] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState(VIDEO_LIST[0].id);

  // Local expected position for the scrub bar (derived from anchor)
  const [expectedPos, setExpectedPos] = useState(0);

  // Tick the expected position display
  useEffect(() => {
    const interval = setInterval(() => {
      if (!sessionState) return;
      if (!sessionState.isPlaying || sessionState.isPreparing) {
        setExpectedPos(sessionState.positionAtAnchor);
        if (!isDragging) setSeekValue(sessionState.positionAtAnchor);
        return;
      }
      const elapsed = (Date.now() - sessionState.anchorTimestamp) / 1000;
      const pos = sessionState.positionAtAnchor + elapsed;
      setExpectedPos(pos);
      if (!isDragging) setSeekValue(pos);
    }, 250);
    return () => clearInterval(interval);
  }, [sessionState, isDragging]);

  // Socket setup
  useEffect(() => {
    const socket = socketRef.current;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('controller:join');
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('state:update', (state: SessionState) => {
      setSessionState(state);
      setSelectedVideoId(state.videoId);
    });

    socket.on('displays:update', (data: DisplayRecord[]) => {
      setDisplays(data);
    });

    if (socket.connected) {
      setConnected(true);
      socket.emit('controller:join');
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('state:update');
      socket.off('displays:update');
    };
  }, []);

  const emit = useCallback((type: string, payload?: object) => {
    socketRef.current.emit('controller:command', { type, ...payload });
  }, []);

  const handlePlay = () => emit('PLAY');
  const handlePause = () => emit('PAUSE');
  const handleRestart = () => emit('RESTART');
  const handleSeekCommit = (value: number) => {
    emit('SEEK', { toPosition: value });
    setIsDragging(false);
  };
  const handleVideoSelect = (videoId: string) => {
    setSelectedVideoId(videoId);
    emit('SELECT_VIDEO', { videoId });
  };

  const openDisplayWindow = (displayId: string | number) => {
    window.open(`/display/${displayId}`, '_blank');
  };

  const currentVideo = VIDEO_LIST.find(v => v.id === selectedVideoId) ?? VIDEO_LIST[0];
  const isPlaying = sessionState?.isPlaying ?? false;
  const isPreparing = sessionState?.isPreparing ?? false;

  return (
    <div className="bg-mesh min-h-screen">
      <div style={{ maxWidth: 1150, margin: '0 auto', padding: '24px 20px' }}>

        {/* ---- Header ---- */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'var(--gradient-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
            }}>
              <Radio size={22} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                FrameSync
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Central Controller Console</p>
            </div>
          </div>

          {/* Quick Display Launchers in Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => openDisplayWindow(1)}
              className="btn-ghost"
              style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <ScreenShare size={14} color="var(--accent-indigo)" />
              + Display 1
            </button>
            <button
              onClick={() => openDisplayWindow(2)}
              className="btn-ghost"
              style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <ScreenShare size={14} color="var(--accent-cyan)" />
              + Display 2
            </button>
            <button
              onClick={() => openDisplayWindow(Math.floor(100 + Math.random() * 900))}
              className="btn-ghost"
              style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} />
              + Custom Display
            </button>

            <div style={{ height: 24, width: 1, background: 'var(--glass-border)', margin: '0 4px' }} />

            {/* Server Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 999, border: '1px solid var(--glass-border)' }}>
              <span className={connected ? 'led led-green' : 'led led-gray'} />
              {connected
                ? <Wifi size={14} color="var(--status-synced)" />
                : <WifiOff size={14} color="var(--status-neutral)" />}
              <span style={{ fontSize: '0.75rem', color: connected ? 'var(--status-synced)' : 'var(--text-muted)', fontWeight: 600 }}>
                {connected ? 'Server Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>

          {/* ---- Left: Playback Console ---- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Video Selector */}
            <div className="glass-panel" style={{ padding: '20px 24px' }}>
              <p className="label-caps" style={{ marginBottom: 10 }}>Select Video Source</p>
              <select
                className="glass-select"
                value={selectedVideoId}
                onChange={e => handleVideoSelect(e.target.value)}
              >
                {VIDEO_LIST.map(v => (
                  <option key={v.id} value={v.id} style={{ background: '#111827' }}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Playback Controls */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <p className="label-caps" style={{ marginBottom: 16 }}>Authoritative Playback Control</p>

              {/* Position + Status */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
                <span className="mono" style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                  {formatTime(Math.min(expectedPos, currentVideo.duration))}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isPreparing ? (
                    <><span className="led led-amber" style={{ animation: 'pulse 1s infinite' }} /><span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>Pre-buffering (Sync-on-Ready) ⏳</span></>
                  ) : isPlaying ? (
                    <><span className="led led-green" /><span style={{ fontSize: '0.75rem', color: 'var(--status-synced)', fontWeight: 600 }}>Playing Live</span></>
                  ) : (
                    <><span className="led led-gray" /><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Paused</span></>
                  )}
                </div>
              </div>

              {/* Seek bar */}
              <div style={{ marginBottom: 24 }}>
                <input
                  className="seek-slider"
                  type="range"
                  min={0}
                  max={currentVideo.duration}
                  step={0.5}
                  value={Math.min(seekValue, currentVideo.duration)}
                  style={{
                    background: `linear-gradient(to right, var(--accent-indigo) 0%, var(--accent-cyan) ${(Math.min(seekValue, currentVideo.duration) / currentVideo.duration) * 100}%, rgba(255,255,255,0.1) ${(Math.min(seekValue, currentVideo.duration) / currentVideo.duration) * 100}%)`,
                  }}
                  onMouseDown={() => setIsDragging(true)}
                  onChange={e => setSeekValue(Number(e.target.value))}
                  onMouseUp={e => handleSeekCommit(Number((e.target as HTMLInputElement).value))}
                  onTouchEnd={e => handleSeekCommit(Number((e.target as HTMLInputElement).value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>0:00</span>
                  <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatTime(currentVideo.duration)}</span>
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn-icon" onClick={handleRestart} title="Restart from 0:00">
                  <RotateCcw size={18} />
                </button>
                {isPlaying ? (
                  <button className="btn-primary" onClick={handlePause} style={{ flex: 1 }}>
                    <Pause size={18} />
                    Pause All Displays
                  </button>
                ) : (
                  <button className="btn-primary" onClick={handlePlay} style={{ flex: 1 }}>
                    <Play size={18} />
                    Play All Displays
                  </button>
                )}
              </div>
            </div>

            {/* Server State Debug Inspector */}
            {sessionState && (
              <div className="glass-panel" style={{ padding: '16px 20px' }}>
                <p className="label-caps" style={{ marginBottom: 10 }}>Authoritative Session State (Server Engine)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                  {[
                    ['Active Video', currentVideo.label],
                    ['Sequence Version', `#${sessionState.version}`],
                    ['Anchor Position', `${sessionState.positionAtAnchor.toFixed(2)}s`],
                    ['Derived Position', `${Math.min(expectedPos, currentVideo.duration).toFixed(2)}s`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{k}</span>
                      <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ---- Right: Display Network & Quick Launcher ---- */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', alignSelf: 'start' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tv2 size={16} color="var(--accent-cyan)" />
                <span className="label-caps" style={{ color: 'var(--text-secondary)' }}>Display Network</span>
              </div>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
                borderRadius: 999, background: 'rgba(6,182,212,0.12)', color: 'var(--accent-cyan)',
                border: '1px solid rgba(6,182,212,0.25)'
              }}>
                {displays.filter(d => d.connectionStatus === 'connected').length} Active
              </span>
            </div>

            {/* Quick Action Launch Bar inside Network Panel */}
            <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: 8 }}>
              <button
                onClick={() => openDisplayWindow(1)}
                className="btn-ghost"
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.72rem' }}
              >
                + Open Display 1
              </button>
              <button
                onClick={() => openDisplayWindow(2)}
                className="btn-ghost"
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.72rem' }}
              >
                + Open Display 2
              </button>
            </div>

            {displays.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <MonitorPlay size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>No active displays connected</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, marginBottom: 16 }}>
                  Click below to open display windows in new browser tabs
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 220, margin: '0 auto' }}>
                  <button
                    onClick={() => openDisplayWindow(1)}
                    className="btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                  >
                    Launch Display Client 1
                  </button>
                  <button
                    onClick={() => openDisplayWindow(2)}
                    className="btn-ghost"
                    style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                  >
                    Launch Display Client 2
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {displays.map((d, i) => {
                  const drift = d.driftMs;
                  const driftClass = d.connectionStatus === 'disconnected' ? 'drift-pill-neutral' : getDriftClass(drift);
                  const stateBadge = getStateBadge(d.lastReportedState, d.connectionStatus, d.isReady, isPreparing);
                  return (
                    <div key={d.clientId} style={{
                      padding: '14px 18px',
                      borderBottom: i < displays.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.2s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Row header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span className={`led ${getLedClass(d.connectionStatus)}`} />
                        <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {d.clientId.slice(0, 8)}
                        </span>
                        <span style={{ marginLeft: 'auto' }}>
                          <span className={`drift-pill ${stateBadge.cls}`}>{stateBadge.label}</span>
                        </span>
                      </div>

                      {/* Metrics row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignItems: 'center' }}>
                        <div>
                          <p className="label-caps" style={{ marginBottom: 2 }}>Position</p>
                          <p className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {formatTime(d.lastReportedPosition)}
                          </p>
                        </div>
                        <div>
                          <p className="label-caps" style={{ marginBottom: 2 }}>Estimated Drift</p>
                          <span className={`drift-pill ${driftClass}`}>
                            {d.connectionStatus === 'disconnected' ? '—' : `${drift >= 0 ? '+' : ''}${Math.round(drift)}ms`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
