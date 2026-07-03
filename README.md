# Seamless Pattern Designer PRO

Open-source, browser-based tool for validating seamless repeat patterns before print or marketplace delivery.

Seamless Pattern Designer PRO helps pattern designers, AI artists, and textile creators inspect repeat tiles, detect visible seams, preview multiple repeat systems, and export print-ready PNG/PDF assets. It runs fully in the browser with no backend, so uploaded artwork stays local to the user's device.

## Why this project matters

AI image generators can create strong pattern concepts, but generated tiles often contain subtle edge mismatches, resolution issues, or repeat artifacts that only appear after tiling. This project provides an open-source quality-control step for that workflow:

- Visual seam inspection with heatmap and problem-seam overlays.
- Repeat previews for grid, half-drop row, half-drop column, mirror, and offset inspection.
- Print-oriented export settings with DPI, page size, and tile count controls.
- Local-first execution for artists who do not want to upload source artwork to a server.

## Project status

This is an actively maintained frontend OSS project built with Vite, React, TypeScript, and the Canvas API. The near-term roadmap is focused on improving accessibility, export reliability, contributor documentation, and automated validation for image-processing behavior.

## English quick start

```bash
npm install
npm run dev
```

Default local URL:

```text
http://localhost:5173/
```

Build and lint:

```bash
npm run lint
npm run build
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, development workflow, and the kinds of changes that are most useful for the project.

## License

MIT. See [LICENSE](LICENSE).

## 中文說明

專業的 seamless pattern 檢查與輸出工具，完全前端執行（無後端）。

- Tech stack: Vite + React + TypeScript + Canvas API
- 主要用途: pattern 拼接檢查、接縫偵測、列印輸出（PNG / PDF）
- 目標使用者: Pattern Designer / AI Artist

## 功能總覽

1. 圖片上傳與解析
- 支援 PNG / JPG
- 使用 `createImageBitmap` 載入
- 偵測原圖尺寸與 DPI（若無則預設 300）
- 預覽時自動建立效能友善縮圖，輸出時仍可用高品質來源

2. 拼接模式（Repeat Engine）
- `Grid`
- `Half-drop Row`
- `Half-drop Column`
- `Mirror`（交錯翻轉）
- `Offset Preview Mode`（四分位偏移檢查）

3. 接縫偵測
- `Show Seam Heatmap` 顯示接縫熱圖
- `Show Problem Seams` 僅標示超過門檻的問題接縫
- 可調整 `Seam Threshold`
- 接縫評級 S/A/B/C/F（Laplacian ratio + SSIM，與 `scripts/batch_seam_test.py` 同一套演算法）

3b. 批次評分（Batch Grading）
- 上傳多張圖片（或整個資料夾）一次評分
- 結果表依品質排序，顯示等級徽章、ratio、尺寸
- 點擊任一列即載入該圖進行詳細檢查
- 可匯出 CSV 報表

4. 檢查視圖
- 右側 Canvas 支援縮放 / 平移
- 滾輪縮放、拖曳平移、觸控手勢（pinch/drag）
- `Reset View` 一鍵回到預設檢視

5. 輸出設定
- 單位: px / in / cm
- 可設定輸出尺寸、DPI、拼接數
- 支援常用尺寸預設（A4、A5、明信片、20x20）
- 提供 Auto Upscale 建議，避免印刷解析度不足

6. 匯出
- 匯出 `PNG`
- 匯出 `PDF`（依 DPI 與尺寸建立正確頁面）
- PNG/PDF 共用檔名規則（含尺寸、DPI、時間戳）

## 快速開始

### 需求
- Node.js 18+（建議 20+）

### 安裝與啟動
```bash
npm install
npm run dev
```

預設網址:
- `http://localhost:5173/`

若要固定 5174:
```bash
npm run dev -- --port 5174
```

### 打包
```bash
npm run build
npm run preview
```

## 使用流程（建議）

1. 上傳 PNG/JPG 圖片。
2. 在「拼接檢查」選擇 repeat mode，調整檢查拼接數與縮放。
3. 開啟 `Show Problem Seams` 或 `Show Seam Heatmap` 進行接縫診斷。
4. 在「輸出設定」設定單位、寬高、DPI、輸出拼接數。
5. 先按 `Preview Export` 讓檢查區套用輸出拼接密度。
6. 匯出 `PNG` 或 `PDF`。

## 進階按鈕說明（Inspection）

- `Grid`: 顯示每塊 tile 邊界。
- `Mirror`: 交錯翻轉圖塊，檢查鏡像重複效果。
- `Show Seam Heatmap`: 以顏色強度呈現邊緣差異。
- `Show Problem Seams`: 只顯示超過門檻的接縫線。
- `Seam Threshold`: 越低越嚴格，越高越寬鬆。
- `Offset Preview Mode`: 快速檢查偏移拼接破綻。
- `Reset View`: 回到置中且適合檢視的縮放。

## 匯出規則

### 檔名格式（PNG / PDF 共用）
`seamless-pattern_{width}x{height}px_{dpi}dpi_{YYYYMMDD-HHMMSS}.{ext}`

範例:
- `seamless-pattern_2480x3508px_300dpi_20260207-161530.png`
- `seamless-pattern_2480x3508px_300dpi_20260207-161530.pdf`

### 品質與限制說明
- 若瀏覽器無法支援過大畫布，系統會自動縮小到安全尺寸並提示。
- PDF 內已做抗拼接縫處理（微重疊 + 無壓縮影像嵌入）。

## 快捷鍵

- `P`: Preview Export
- `E`: Export PNG
- `R`: Reset View

## 專案結構

```text
src/
  components/
    CanvasView.tsx
    ControlPanel.tsx
    HeatmapOverlay.tsx
  hooks/
    useCanvasEngine.ts
  utils/
    imageMetadata.ts
    seamDetector.ts
    tilingEngine.ts
  App.tsx
  App.css
  i18n.ts
```

## Git 提交工作流

本專案提供一鍵提交腳本：

```bash
npm run ship -- "feat: your message"
```

會依序執行:
1. `git status --short` 並**要求確認**（避免誤提交未預期的檔案）
2. `git add .`
3. `git commit -m "..."`
4. `git push`

Push 到 `main` 後 Vercel 會自動部署到
https://seamless-pattern-designer-pro.vercel.app 。

詳細請見 `WORKFLOW.md`。
