'use client';

import Link from 'next/link';
import { Radio, Tv2, MonitorPlay, ExternalLink, Play, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="bg-mesh min-h-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: 850, width: '100%' }}>

        {/* ---- Header Title ---- */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 16,
            background: 'var(--gradient-brand)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(99,102,241,0.4)', marginBottom: 16,
          }}>
            <Radio size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 8 }}>
            FrameSync
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto' }}>
            Real-time multi-display video playback synchronization system with server-authoritative drift correction.
          </p>
        </div>

        {/* ---- Cards Grid ---- */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 32 }}>

          {/* Controller Card */}
          <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(99,102,241,0.15)', color: 'var(--accent-indigo)' }}>
                  <Radio size={20} />
                </div>
                <span className="label-caps" style={{ fontSize: '0.75rem', color: 'var(--accent-indigo)' }}>Control Center</span>
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Controller Dashboard
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Manage video selection, playback state, seeking, and monitor active connected displays in real-time.
              </p>
            </div>
            <Link
              href="/controller"
              className="btn-primary"
              style={{ marginTop: 20, textDecoration: 'none', width: '100%' }}
            >
              Open Controller Dashboard
            </Link>
          </div>

          {/* Display Client 1 Card */}
          <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)' }}>
                  <Tv2 size={20} />
                </div>
                <span className="label-caps" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>Display Client 1</span>
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Display Window 1
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Syncs playback with the Controller and reports telemetry heartbeats and on-screen debug HUD.
              </p>
            </div>
            <a
              href="/display/1"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
              style={{ marginTop: 20, textDecoration: 'none', width: '100%', justifyContent: 'center' }}
            >
              Launch Display 1 (New Tab) <ExternalLink size={14} />
            </a>
          </div>

          {/* Display Client 2 Card */}
          <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(16,185,129,0.15)', color: 'var(--status-synced)' }}>
                  <MonitorPlay size={20} />
                </div>
                <span className="label-caps" style={{ fontSize: '0.75rem', color: 'var(--status-synced)' }}>Display Client 2</span>
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Display Window 2
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Open a second concurrent display window to verify multi-screen real-time synchronization.
              </p>
            </div>
            <a
              href="/display/2"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
              style={{ marginTop: 20, textDecoration: 'none', width: '100%', justifyContent: 'center' }}
            >
              Launch Display 2 (New Tab) <ExternalLink size={14} />
            </a>
          </div>

        </div>

        {/* Footer tip */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            💡 Tip: Open 1 Controller tab and 2+ Display tabs side-by-side to observe real-time sync & drift correction!
          </p>
        </div>

      </div>
    </div>
  );
}
