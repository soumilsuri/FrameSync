---
name: drift-management
description: Guidance on calculating, telemetry monitoring, and executing automated drift correction strategies across video displays.
---

# Drift Management Skill

## 1. Quantitative Drift Calculation Formula
Drift is computed on every `display:status` ping received by the server:

```ts
const expectedPosition = getExpectedPosition(sessionState, Date.now());
const driftMs = (reportedPosition - expectedPosition) * 1000;
```
- **Positive Drift (> 0ms)**: Display is ahead of authoritative server position.
- **Negative Drift (< 0ms)**: Display is behind authoritative server position.

## 2. Tiered Automated Drift Correction Thresholds

| Drift Magnitude | Action | Execution Details | Reasoning |
|---|---|---|---|
| **< 300ms** | **No action (Deadband)** | Maintain `playbackRate = 1.0` | Imperceptible to human viewers; prevents micro-stuttering. |
| **300ms – 1500ms** | **Soft Correction** | Set `playbackRate = 1.05` (behind) or `0.95` (ahead) until drift < 100ms or ~4s duration | Smooth gap closure without visible video jump cuts. |
| **> 1500ms** | **Hard Correction** | Direct seek: `video.currentTime = expectedPosition` | Eliminates severe lag immediately. |

## 3. Cooldown & Oscillation Prevention
- After executing any correction on a Display, enforce a **3 to 5 second cooldown** before evaluating that specific Display for further corrections.
- This prevents flapping/oscillation caused by temporary playback buffering immediately after seeking or rate adjustment.

## 4. Correction Event Payload (`correction:apply`)
The server evaluates threshold logic and emits targeted commands to the specific display socket:

```ts
interface CorrectionCommand {
  action: 'seek' | 'rate-nudge';
  value: number;       // Target currentTime position or target playbackRate (0.95 / 1.05)
  durationMs?: number; // Optional duration for rate nudge before returning to 1.0
}
```
The Display client executes the DOM video element mutation upon receiving this event.
