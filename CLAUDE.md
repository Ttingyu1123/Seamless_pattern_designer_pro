# Seamless Pattern Designer PRO

## Overview

Client-side React SPA for inspecting and exporting seamless tile patterns. No backend. Deployed via GitHub Pages (`docs/` folder).

**Stack:** React 19 + TypeScript 5.9 + Vite 7 + HTML5 Canvas API + jsPDF

## Project Structure

```
src/
├── components/
│   ├── CanvasView.tsx              # Canvas container (thin wrapper)
│   ├── ControlPanel.tsx            # All UI controls, wrapped with React.memo
│   └── HeatmapOverlay.tsx          # Seam quality display
├── hooks/
│   ├── useCanvasEngine.ts          # Orchestrator: tile memos, viewport, rendering, export
│   └── useGestureHandlers.ts       # Pointer/touch/wheel gesture handling
├── utils/
│   ├── constants.ts                # Shared constants (export limits, upload limits, panel sizes)
│   ├── exportRenderer.ts           # Shared tiling render logic for PNG/PDF export
│   ├── imageMetadata.ts            # PNG/JPEG DPI binary parsing
│   ├── seamDetector.ts             # Edge difference heatmap
│   └── tilingEngine.ts             # Grid/Half-drop/Mirror tile math
├── App.tsx                         # State orchestration, upload handling with validation
├── App.css                         # All component styles
├── i18n.ts                         # EN/ZH translations
└── main.tsx                        # Entry point
```

## Key Architecture

- **State:** All in App.tsx via useState (no Redux/Context)
- **Rendering:** requestAnimationFrame loop in useCanvasEngine
- **Gestures:** Extracted to useGestureHandlers (pan, pinch zoom, wheel zoom)
- **Export:** Shared `renderExportCanvas()` used by both PNG and PDF paths
- **Constants:** Single source of truth in `utils/constants.ts`
- **DPI workflow:** Binary-parse source image DPI → preserve in export metadata
- **Upload validation:** File type (PNG/JPEG only) and size (50 MB max) checked before processing

## Build & Deploy

```bash
npm run dev          # Dev server
npm run build        # Production build → dist/
npm run preview      # Preview production build
npm run lint         # ESLint (React Compiler rules enabled)
npm run ship "msg"   # Git add + commit + push (one command)
```

GitHub Pages serves from `docs/` — copy `dist/` to `docs/` for deploy.

## Conventions

- **i18n:** All UI strings go through `i18n.ts`, keyed by `en`/`zh`
- **Repeat modes:** `'grid' | 'half-drop-row' | 'half-drop-column'` — see `tilingEngine.ts`
- **Keyboard shortcuts:** P=preview toggle, E=export PNG, R=reset view
- **Export filename format:** `seamless-pattern_{WxH}px_{DPI}dpi_{timestamp}.{ext}`
- **React Compiler:** ESLint uses `react-hooks/recommended` with Compiler rules; use full objects (not `.property`) in dependency arrays
