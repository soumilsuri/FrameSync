# Drift Testing & Verification Workflow

## Scenario 1: Baseline Synchronized Playback
- Launch Controller and 2 Displays.
- Trigger PLAY.
- Observe drift metrics on Controller and Display overlays.
- Target: Drift remains within +/- 100ms.

## Scenario 2: Artificial Network / CPU Latency Simulation
- Open Browser DevTools on Display 2 -> Throttling (Network/CPU).
- Trigger Play / Seek.
- Observe drift widening on Display 2.
- Verify automatic correction triggering:
  - If drift > 200ms & <= 1500ms -> Playback rate adjusts (1.05x / 0.95x).
  - If drift > 1500ms -> Hard seek triggered to expected position.

## Scenario 3: Disconnect & Reconnect Test
- Close Display 1 tab or disconnect network.
- Controller updates status to `Disconnected`.
- Re-open Display 1.
- Display 1 receives state, seeks to expected position, resumes playback, and restores telemetry.
