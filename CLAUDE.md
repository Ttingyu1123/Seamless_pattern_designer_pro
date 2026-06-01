# Seamless Pattern Designer PRO

## Overview

Client-side React SPA with dual-mode workflow: **Compose**（組合 motif → 建立 tile）and **Inspect**（檢視既有 tile → 預覽重複 → 匯出）. No backend. Deployed via GitHub Pages (`docs/` folder).

**Stack:** React 19 + TypeScript 5.9 + Vite 7 + HTML5 Canvas API + Zustand 5 + jsPDF

## Project Structure

```
src/
├── components/
│   ├── CanvasView.tsx              # Canvas container (thin wrapper, inspect mode)
│   ├── ControlPanel.tsx            # Inspect mode UI controls
│   ├── HeatmapOverlay.tsx          # Seam quality display
│   ├── ComposeCanvas.tsx           # Compose: edit canvas (drag-drop, pointer interaction)
│   ├── ComposePanel.tsx            # Compose: left sidebar (layers, export, save/load)
│   ├── ComposeTileConfig.tsx       # Compose: tile size config (px/mm/cm, print calculator, presets)
│   ├── RepeatPreview.tsx           # Compose: right-side tiled preview
│   └── ScatterDialog.tsx           # Compose: Poisson Disk scatter settings
├── hooks/
│   ├── useCanvasEngine.ts          # Inspect: tile memos, viewport, rendering, export
│   ├── useComposerEngine.ts        # Compose: edit canvas render loop, image cache
│   └── useGestureHandlers.ts       # Pointer/touch/wheel gesture handling
├── store/
│   └── composerStore.ts            # Zustand: layers, tile config, undo/redo (zundo)
├── utils/
│   ├── constants.ts                # Shared constants
│   ├── composeExport.ts            # Compose: single tile + tiled image export
│   ├── exportRenderer.ts           # Inspect: tiling render for PNG/PDF export
│   ├── hitTest.ts                  # Point-in-rotated-rect, handle detection
│   ├── imageMetadata.ts            # PNG/JPEG DPI binary parsing
│   ├── layerRenderer.ts            # flattenComposedTile() with lattice wrap-around
│   ├── projectFile.ts              # .spc JSON save/load + localStorage autosave
│   ├── scatterEngine.ts            # Poisson Disk Sampling auto-scatter
│   ├── seamDetector.ts             # Edge difference heatmap
│   ├── snapEngine.ts               # Smart Snap alignment (center/edge/motif)
│   └── tilingEngine.ts             # 10 repeat modes: grid, half-drop, mirror, hex, diamond
├── App.tsx                         # Dual-mode shell (compose/inspect)
├── App.css                         # All component styles
├── i18n.ts                         # Inspect mode EN/ZH translations
├── i18n-compose.ts                 # Compose mode EN/ZH translations
└── main.tsx                        # Entry point
```

## Key Architecture

### Dual Mode
- **Compose:** Zustand store (`composerStore.ts`) manages layers, tile size, repeat mode
- **Inspect:** All state in App.tsx via useState (original architecture)
- Mode switch via top nav tabs; both modes share `tilingEngine.ts`

### Compose Mode
- **State:** Zustand 5 with individual `(s) => s.field` selectors (React 19 compatible)
- **Undo/Redo:** zundo temporal middleware, 50-step history, Ctrl+Z/Y
- **Rendering:** Split view — left=edit canvas, right=tiled preview
- **Wrap-around:** Lattice vector math for correct half-drop/hexagonal/diamond seamless tiling
- **Interaction:** Figma-style handles (body=move, corner=scale, top-circle=rotate)
- **Image cache:** Global `Map<layerId, HTMLImageElement>`, auto-loads on duplicate/open
- **Export:** Single tile PNG + tiled repeat PNG
- **Print Size Calculator:** Physical size (cm/mm/in) + DPI → pixel canvas size; print presets (5/10/15/20cm @300dpi)
- **Tile units:** px, mm, cm — physical units show DPI and auto-convert; px mode shows cm equivalent hint

### Inspect Mode
- **Rendering:** requestAnimationFrame loop in useCanvasEngine
- **Gestures:** Extracted to useGestureHandlers (pan, pinch zoom, wheel zoom)
- **Export:** Shared `renderExportCanvas()` used by both PNG and PDF paths
- **DPI workflow:** Binary-parse source image DPI → preserve in export metadata
- **Motif size control:** Set desired motif physical size (cm/in) → auto-calculate tile count

## Repeat Modes (tilingEngine.ts)

`grid | half-drop-row | half-drop-column | half-brick | mirror-x | mirror-y | mirror-xy | hexagonal | diamond | horizontal-only`

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

- **i18n:** UI strings in `i18n.ts` (inspect) and `i18n-compose.ts` (compose), keyed by `en`/`zh`
- **Zustand selectors:** Always use `(s) => s.field` pattern, never destructure (React 19 batching)
- **Keyboard shortcuts (Compose):** Delete=remove layer, Ctrl+D=duplicate, Ctrl+Z/Y=undo/redo
- **Keyboard shortcuts (Inspect):** P=preview toggle, E=export PNG, R=reset view
- **Export filename format:** `seamless-pattern_{WxH}px_{DPI}dpi_{timestamp}.{ext}`
- **Project file:** `.spc` = JSON with base64 embedded images
- **Lattice wrap-around:** `getLatticeVectors()` defines periodicity per repeat mode; wrap offsets enumerate lattice points n×v1 + m×v2
