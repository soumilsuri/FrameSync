---
name: ui-design-system
description: Design system guidelines, CSS design tokens, glassmorphism aesthetics, typography, and micro-animation patterns for FrameSync UI.
---

# FrameSync Premium UI Design System

## 1. Aesthetic Philosophy
To avoid generic, "boilerplate" AI design aesthetics, FrameSync adopts an **Obsidian Glassmorphism** design language inspired by modern broadcast monitors and sleek dark-mode control panels.

### Key Design Principles:
- **Obsidian Dark Surface**: Avoid harsh pure black (`#000000`). Use layered deep navy-charcoal shades (`#080C14`, `#0F172A`, `#1E293B`).
- **Layered Frosted Glass**: Use `backdrop-filter: blur(16px)` with subtle 1px semi-transparent borders (`rgba(255, 255, 255, 0.08)`) and inset top highlights (`rgba(255, 255, 255, 0.05)`).
- **Vibrant Neon Accent Palette**: High-contrast semantic colors for telemetry status:
  - **Synced / Healthy**: Emerald Green (`#10B981`, `glow: 0 0 12px rgba(16, 185, 129, 0.4)`)
  - **Soft Correction / Warning**: Amber Gold (`#F59E0B`, `glow: 0 0 12px rgba(245, 158, 11, 0.4)`)
  - **Hard Seek / Severe Drift**: Crimson Red (`#EF4444`, `glow: 0 0 12px rgba(239, 68, 68, 0.4)`)
  - **Active Control Accent**: Electric Indigo / Cyan (`#6366F1`, `#06B6D4`)
- **Typography & Hierarchy**: Use Google Fonts **Inter** or **Plus Jakarta Sans** with clean letter-spacing, uppercase section tags (`text-xs font-semibold tracking-wider uppercase text-slate-400`), and tabular numbers (`font-mono`) for timestamps and drift meters.

---

## 2. CSS Design Tokens & Classes

```css
/* Glass Card Utility */
.glass-panel {
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

/* Glass Interactive Buttons */
.btn-glass-primary {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(14, 165, 233, 0.9));
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.btn-glass-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5);
}

/* Pulsing Status LED Indicator */
@keyframes status-pulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}
.led-indicator-synced {
  background: #10B981;
  box-shadow: 0 0 10px #10B981;
  animation: status-pulse 2s infinite ease-in-out;
}
```

---

## 3. UI Component Specs

### A. Controller Dashboard Layout
- **Hero Video Control Console**: Sleek playback controls, scrub slider with progress gradient, playback status badge, and video selector dropdown with custom arrow and hover states.
- **Display Network Status Table**: Glass grid displaying connected clients, animated status indicators, mono-font timestamps, and color-coded drift pills (Green <300ms, Yellow 300-1500ms, Red >1500ms).

### B. Display HUD Overlay
- Translucent floating HUD in top-left corner of `<video>` viewport.
- Contains Client ID badge, connection dot, local time counter, and live drift monitor.
