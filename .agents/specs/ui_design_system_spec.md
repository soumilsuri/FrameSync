# UI & Aesthetics Design System Specification

## 1. Design Vision
FrameSync delivers a futuristic, high-end broadcast control room aesthetic. It prioritizes dark-mode legibility, crisp data visualization, and glassmorphism micro-interactions to avoid generic template appearances.

## 2. Color Palette & Semantic Tokens
- **Background Core**: `#070A11` (Deep Space Dark)
- **Card / Surface Background**: `rgba(15, 23, 42, 0.70)` (Dark Slate Glass)
- **Border Surface**: `rgba(255, 255, 255, 0.08)`
- **Primary Brand Gradient**: `linear-gradient(135deg, #6366F1 0%, #06B6D4 100%)`
- **Synced Green**: `#10B981` (Emerald)
- **Drift Amber**: `#F59E0B` (Warm Gold)
- **Drift Red**: `#EF4444` (Crimson)
- **Text Primary**: `#F8FAFC` (Off-white)
- **Text Secondary**: `#94A3B8` (Muted Slate)

## 3. Component Design Rules
1. **Glassmorphism Panels**: Every container uses `backdrop-filter: blur(16px)` and subtle inset top highlights (`rgba(255, 255, 255, 0.08)`).
2. **Tabular Telemetry Data**: All numerical values (drift in ms, currentTime, timestamps, sequence numbers) use monospaced fonts (`font-mono`) to prevent layout jitter during updates.
3. **Interactive Controls**: Buttons, scrub bars, and video selectors feature hover lift animations (`transform: translateY(-2px)`), glow shadows, and smooth transitions (`transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)`).
4. **Display HUD Overlay**: Floating top-left HUD on `/display/[id]` with `backdrop-filter: blur(12px)` and semi-transparent background (`rgba(8, 12, 20, 0.75)`).
