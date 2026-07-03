# Seamless Pattern Designer PRO

## Overview

Client-side React SPA for **seam quality inspection**: upload a pattern tile, preview repeats, detect visible seams (Laplacian + SSIM grading), and export print-ready PNG/PDF. No backend — artwork never leaves the browser.

**Stack:** React 19 + TypeScript 5.9 + Vite 7 + HTML5 Canvas API + jsPDF

## Project Structure

```
src/
├── components/
│   ├── BatchPanel.tsx        # Batch grading results table (multi-file upload)
│   ├── CanvasView.tsx        # Canvas container (thin wrapper)
│   ├── ControlPanel.tsx      # Left sidebar: upload, repeat config, export settings
│   └── HeatmapOverlay.tsx    # Seam grade (S/A/B/C/F) + metrics panel
├── hooks/
│   ├── useCanvasEngine.ts    # Tile memos, viewport, render loop, PNG/PDF export
│   └── useGestureHandlers.ts # Pointer/touch/wheel gestures (pan, pinch, wheel zoom)
├── utils/
│   ├── batchAnalyzer.ts      # Multi-file seam grading + CSV report
│   ├── constants.ts          # Shared constants (export limits, upload limits)
│   ├── colorPalette.ts       # Hue-bucketed HSV k-means color extraction
│   ├── exportRenderer.ts     # Tiling render shared by PNG and PDF export
│   ├── imageMetadata.ts      # PNG/JPEG DPI binary parsing
│   ├── saveImage.ts          # Download / iOS Web Share save
│   ├── seamDetector.ts       # Canvas wrapper: pixels -> seamMetrics + heatmap (async)
│   ├── seamMetrics.ts        # PURE seam math (no DOM) - unit-tested vs Python oracle
│   ├── seamWorkerClient.ts   # Off-thread analysis via Web Worker (sync fallback)
│   └── tilingEngine.ts       # Repeat modes: grid, half-drop, mirror, hex, diamond
├── workers/
│   └── seamWorker.ts         # Runs computeSeamMetrics off the main thread
├── App.tsx                   # App shell + all inspect state (useState)
├── App.css                   # All component styles
├── i18n.ts                   # EN/ZH translations
└── main.tsx                  # Entry point
scripts/
├── batch_seam_test.py        # Offline batch grader (same algorithm as seamMetrics.ts)
├── make_test_fixtures.py     # Regenerate tests/fixtures/ + expected.json oracle
└── ship.ps1                  # One-command commit + push (with confirmation gate)
tests/
├── fixtures/                 # Deterministic PNGs + expected.json (Python-graded)
├── seamMetrics.test.ts       # TS grades must match Python oracle
└── tilingEngine.test.ts      # Offset/flip math
```

> Compose and Generate modes were removed in 2026-07 (commit 0e379c7) to focus
> the product on seam inspection. Their code (Zustand stores, layer compositing,
> pattern generators) lives in git history if ever needed.

## Key Architecture

- **State:** All in App.tsx via useState, threaded into ControlPanel by props.
- **Rendering:** requestAnimationFrame-driven redraw in useCanvasEngine; preview uses a ≤2048px downscaled bitmap, exports use the full-resolution source.
- **Seam grading:** `detectSeams()` computes edge pixel diff + Laplacian ratio + SSIM ratio; `combinedRatio = max(lap, ssim)` maps to S/A/B/C/F. Math runs in a Web Worker (`seamWorkerClient.ts`) with a synchronous fallback; thresholds live in `seamMetrics.ts` (keep `batch_seam_test.py` in sync).
- **DPI workflow:** Binary-parse source image DPI → preserve in export metadata.
- **PDF:** Optional 3mm bleed with trim marks; one-page A4 spec sheet with thumbnail, 3x3 preview, specs, color palette.

## Repeat Modes (tilingEngine.ts)

`grid | half-drop-row | half-drop-column | half-brick | mirror-x | mirror-y | mirror-xy | hexagonal | diamond | horizontal-only`

(Note: hexagonal currently uses the same lattice as half-brick.)

## Build & Deploy

```bash
npm run dev          # Dev server
npm run build        # tsc + vite build → dist/
npm run preview      # Preview production build
npm run lint         # ESLint (React Compiler rules enabled)
npm run ship "msg"   # Git add + commit + push (asks for confirmation first)
```

**Deploy: Vercel.** Pushing to `main` auto-deploys to
https://seamless-pattern-designer-pro.vercel.app — there is no manual deploy step.
(GitHub Pages is NOT used; `docs/` holds project documents, not build output.)

## Conventions

- **i18n:** All UI strings in `i18n.ts`, keyed by `en`/`zh`. No inline `lang === 'zh' ? ... : ...` ternaries.
- **Keyboard shortcuts:** P=preview toggle, E=export PNG, R=reset view
- **Export filename format:** `seamless-pattern_{WxH}px_{DPI}dpi_{timestamp}.{ext}`

## Algorithm Maintenance Rules（改 seam 演算法/門檻必讀）

`src/utils/seamMetrics.ts`（TS，唯一門檻來源）和 `scripts/batch_seam_test.py`（Python oracle）是**同一演算法的兩份實作**，tests/ 用 fixture 把兩邊鎖定。固定流程：

1. 兩份實作**一起改**（TS 改了 Python 也要改，反之亦然）。
2. 跑 `python scripts/make_test_fixtures.py` 重生 fixtures + `tests/fixtures/expected.json`（oracle 分級）。
3. 跑 `npm test` — parity 測試斷言 TS 分級 == Python 分級、ratio 相對差 <20%。
4. 改渲染輸出（heatmap 等）時用 Playwright 像素 diff 驗證，不能只看 code——heatmap 曾因零長度 stroke 全空白數月無人發現。

已知指標特性（不是 bug）：
- 無紋理平滑圖會誤判 F（SSIM interior baseline 趨近零）→ 合成測試圖必須加紋理（fixtures 全部含 σ=12 噪聲）。
- 純噪點圖評 S 是正確行為（噪點拼接人眼本來就看不出縫，ratio-based 設計即為此）。
- Grade thresholds: S≤1.5, A≤1.75, B≤2.5, C≤4.0, F>4.0。
