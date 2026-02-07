import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { CanvasView } from './components/CanvasView'
import { ControlPanel } from './components/ControlPanel'
import { HeatmapOverlay } from './components/HeatmapOverlay'
import { useCanvasEngine } from './hooks/useCanvasEngine'
import { convertToPixels, readImageMetadata } from './utils/imageMetadata'
import { uiText, type UILang } from './i18n'
import type { RepeatMode } from './utils/tilingEngine'

type BasePreset = '1x1' | '1x2' | '2x1' | 'custom'
type ExportUnit = 'px' | 'in' | 'cm'
type ExportPreset = 'a4' | 'a5' | 'postcard' | 'square20'
const MAX_EXPORT_EDGE = 8192
const MAX_EXPORT_AREA = 67_108_864

function App() {
  const [lang, setLang] = useState<UILang>('zh')
  const text = uiText[lang]
  const [sourceImage, setSourceImage] = useState<ImageBitmap | null>(null)
  const [previewImage, setPreviewImage] = useState<ImageBitmap | null>(null)
  const [previewScale, setPreviewScale] = useState(1)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('grid')
  const [shiftPercent, setShiftPercent] = useState(50)
  const [checkTilesX, setCheckTilesX] = useState(5)
  const [checkTilesY, setCheckTilesY] = useState(5)
  const [mirrorEnabled, setMirrorEnabled] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showProblemSeams, setShowProblemSeams] = useState(true)
  const [seamThresholdPercent, setSeamThresholdPercent] = useState(12)
  const [offsetPreview, setOffsetPreview] = useState(false)

  const [basePreset, setBasePreset] = useState<BasePreset>('1x1')
  const [customBaseWidth, setCustomBaseWidth] = useState(1024)
  const [customBaseHeight, setCustomBaseHeight] = useState(1024)
  const [sourceDpi, setSourceDpi] = useState<number>(300)

  const [exportUnit, setExportUnit] = useState<ExportUnit>('in')
  const [exportDpi, setExportDpi] = useState(300)
  const [exportWidthInput, setExportWidthInput] = useState(24)
  const [exportHeightInput, setExportHeightInput] = useState(24)
  const [exportTilesX, setExportTilesX] = useState(6)
  const [exportUpscale, setExportUpscale] = useState(1)

  const repeatBase = useMemo(() => {
    if (!sourceImage) {
      return { width: customBaseWidth, height: customBaseHeight }
    }

    if (basePreset === '1x2') {
      return { width: sourceImage.width, height: sourceImage.height * 2 }
    }

    if (basePreset === '2x1') {
      return { width: sourceImage.width * 2, height: sourceImage.height }
    }

    if (basePreset === 'custom') {
      return {
        width: Math.max(1, Math.round(customBaseWidth)),
        height: Math.max(1, Math.round(customBaseHeight)),
      }
    }

    return { width: sourceImage.width, height: sourceImage.height }
  }, [basePreset, customBaseHeight, customBaseWidth, sourceImage])

  const previewRepeatBase = useMemo(
    () => ({
      width: Math.max(1, Math.round(repeatBase.width * previewScale)),
      height: Math.max(1, Math.round(repeatBase.height * previewScale)),
    }),
    [previewScale, repeatBase.height, repeatBase.width],
  )

  const exportWidthPx = useMemo(
    () => convertToPixels(exportWidthInput, exportUnit, exportDpi),
    [exportDpi, exportUnit, exportWidthInput],
  )
  const exportHeightPx = useMemo(
    () => convertToPixels(exportHeightInput, exportUnit, exportDpi),
    [exportDpi, exportUnit, exportHeightInput],
  )

  const suggestedTilesX = useMemo(
    () => Math.max(1, Math.ceil(exportWidthPx / Math.max(1, repeatBase.width))),
    [exportWidthPx, repeatBase.width],
  )
  const tileAspect = useMemo(() => Math.max(0.0001, repeatBase.height / Math.max(1, repeatBase.width)), [repeatBase.height, repeatBase.width])
  const autoExportTilesY = useMemo(() => {
    const tileW = exportWidthPx / Math.max(1, exportTilesX)
    const tileH = tileW * tileAspect
    return Math.max(1, Math.ceil(exportHeightPx / Math.max(1, tileH)))
  }, [exportHeightPx, exportTilesX, exportWidthPx, tileAspect])
  const suggestedTilesY = useMemo(() => {
    const tileW = exportWidthPx / Math.max(1, suggestedTilesX)
    const tileH = tileW * tileAspect
    return Math.max(1, Math.ceil(exportHeightPx / Math.max(1, tileH)))
  }, [exportHeightPx, exportWidthPx, suggestedTilesX, tileAspect])

  const effectiveExportPx = useMemo(
    () => ({
      width: Math.max(1, Math.round(exportWidthPx * Math.max(1, exportUpscale))),
      height: Math.max(1, Math.round(exportHeightPx * Math.max(1, exportUpscale))),
    }),
    [exportHeightPx, exportUpscale, exportWidthPx],
  )

  const densityRatio = useMemo(() => {
    const perTileX = exportWidthPx / Math.max(1, exportTilesX)
    const perTileY = exportHeightPx / Math.max(1, autoExportTilesY)
    const ratioX = perTileX / Math.max(1, repeatBase.width)
    const ratioY = perTileY / Math.max(1, repeatBase.height)
    return Math.max(ratioX, ratioY)
  }, [autoExportTilesY, exportHeightPx, exportTilesX, exportWidthPx, repeatBase.height, repeatBase.width])

  const suggestedUpscale = useMemo(() => Math.max(1, Number(densityRatio.toFixed(2))), [densityRatio])
  const exportLimitRisk = useMemo(
    () =>
      effectiveExportPx.width > MAX_EXPORT_EDGE ||
      effectiveExportPx.height > MAX_EXPORT_EDGE ||
      effectiveExportPx.width * effectiveExportPx.height > MAX_EXPORT_AREA,
    [effectiveExportPx.height, effectiveExportPx.width],
  )

  const engine = useCanvasEngine({
    lang,
    previewImage,
    exportImage: sourceImage,
    repeatMode,
    shiftPercent,
    tileCountX: checkTilesX,
    tileCountY: checkTilesY,
    mirrorEnabled,
    showGrid,
    showHeatmap,
    showProblemSeams,
    seamThresholdPercent,
    offsetPreview,
    previewRepeatBase,
    exportRepeatBase: repeatBase,
    exportTarget: {
      widthPx: exportWidthPx,
      heightPx: exportHeightPx,
      tilesX: exportTilesX,
      tilesY: autoExportTilesY,
      upscale: exportUpscale,
      dpi: exportDpi,
    },
  })

  const handleUpload = async (file: File) => {
    const metadata = await readImageMetadata(file)
    const bitmap = await createImageBitmap(file)

    const maxPreviewEdge = 2048
    const scale = Math.min(1, maxPreviewEdge / Math.max(bitmap.width, bitmap.height))
    const previewW = Math.max(1, Math.round(bitmap.width * scale))
    const previewH = Math.max(1, Math.round(bitmap.height * scale))
    const previewCanvas = document.createElement('canvas')
    previewCanvas.width = previewW
    previewCanvas.height = previewH
    const previewCtx = previewCanvas.getContext('2d')
    if (previewCtx) {
      previewCtx.imageSmoothingEnabled = true
      previewCtx.drawImage(bitmap, 0, 0, previewW, previewH)
    }
    const preview = await createImageBitmap(previewCanvas)

    setSourceImage((prev) => {
      prev?.close()
      return bitmap
    })
    setPreviewImage((prev) => {
      prev?.close()
      return preview
    })
    setPreviewScale(scale)
    setCustomBaseWidth(bitmap.width)
    setCustomBaseHeight(bitmap.height)

    const detectedDpi = metadata.dpi ? Math.max(1, Math.round(metadata.dpi)) : 300
    setSourceDpi(detectedDpi)
    setExportDpi(detectedDpi)

    const nextTilesX = Math.max(1, Math.ceil(exportWidthPx / Math.max(1, bitmap.width)))
    setExportTilesX(nextTilesX)
    const nextTileH = (exportWidthPx / Math.max(1, nextTilesX)) * (bitmap.height / Math.max(1, bitmap.width))
    const nextTilesY = Math.max(1, Math.ceil(exportHeightPx / Math.max(1, nextTileH)))
    setCheckTilesX(Math.min(12, nextTilesX))
    setCheckTilesY(Math.min(12, nextTilesY))
  }

  const handlePreviewExport = useCallback(() => {
    setCheckTilesX(Math.max(1, exportTilesX))
    setCheckTilesY(Math.max(1, autoExportTilesY))
    engine.resetView()
  }, [autoExportTilesY, engine.resetView, exportTilesX])

  const handleAutoUpscale = () => {
    setExportUpscale(Math.max(1, suggestedUpscale))
  }

  const handleApplyExportPreset = useCallback((preset: ExportPreset) => {
    setExportUnit('cm')
    if (preset === 'a4') {
      setExportWidthInput(21)
      setExportHeightInput(29.7)
      return
    }
    if (preset === 'a5') {
      setExportWidthInput(14.8)
      setExportHeightInput(21)
      return
    }
    if (preset === 'postcard') {
      setExportWidthInput(10)
      setExportHeightInput(15)
      return
    }
    setExportWidthInput(20)
    setExportHeightInput(20)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName.toLowerCase()
        const editing = tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
        if (editing) return
      }

      const key = event.key.toLowerCase()
      if (key === 'p') {
        event.preventDefault()
        handlePreviewExport()
      } else if (key === 'e') {
        event.preventDefault()
        engine.exportPNG()
      } else if (key === 'r') {
        event.preventDefault()
        engine.resetView()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [engine.exportPNG, engine.resetView, handlePreviewExport])

  useEffect(() => {
    return () => {
      sourceImage?.close()
      previewImage?.close()
    }
  }, [previewImage, sourceImage])

  return (
    <main className="app-shell">
      <ControlPanel
        lang={lang}
        onToggleLanguage={() => setLang((prev) => (prev === 'zh' ? 'en' : 'zh'))}
        repeatMode={repeatMode}
        shiftPercent={shiftPercent}
        checkTilesX={checkTilesX}
        checkTilesY={checkTilesY}
        zoom={engine.zoom}
        showGrid={showGrid}
        mirrorEnabled={mirrorEnabled}
        showHeatmap={showHeatmap}
        showProblemSeams={showProblemSeams}
        seamThresholdPercent={seamThresholdPercent}
        offsetPreview={offsetPreview}
        basePreset={basePreset}
        customBaseWidth={customBaseWidth}
        customBaseHeight={customBaseHeight}
        hasImage={Boolean(sourceImage)}
        imageSize={sourceImage ? { width: sourceImage.width, height: sourceImage.height } : null}
        sourceDpi={sourceDpi}
        exportUnit={exportUnit}
        exportDpi={exportDpi}
        exportWidthInput={exportWidthInput}
        exportHeightInput={exportHeightInput}
        exportWidthPx={exportWidthPx}
        exportHeightPx={exportHeightPx}
        exportTilesX={exportTilesX}
        exportTilesY={autoExportTilesY}
        suggestedTilesX={suggestedTilesX}
        suggestedTilesY={suggestedTilesY}
        exportUpscale={exportUpscale}
        suggestedUpscale={suggestedUpscale}
        effectiveExportWidthPx={effectiveExportPx.width}
        effectiveExportHeightPx={effectiveExportPx.height}
        exportQualityRatio={densityRatio}
        exportLimitRisk={exportLimitRisk}
        onUpload={handleUpload}
        onRepeatModeChange={setRepeatMode}
        onShiftChange={setShiftPercent}
        onCheckTilesXChange={setCheckTilesX}
        onCheckTilesYChange={setCheckTilesY}
        onZoomChange={engine.setZoom}
        onResetView={engine.resetView}
        onToggleGrid={setShowGrid}
        onToggleMirror={setMirrorEnabled}
        onToggleHeatmap={setShowHeatmap}
        onToggleProblemSeams={setShowProblemSeams}
        onSeamThresholdChange={setSeamThresholdPercent}
        onToggleOffsetPreview={setOffsetPreview}
        onBasePresetChange={setBasePreset}
        onCustomBaseWidthChange={setCustomBaseWidth}
        onCustomBaseHeightChange={setCustomBaseHeight}
        onExportUnitChange={setExportUnit}
        onExportDpiChange={setExportDpi}
        onExportWidthInputChange={setExportWidthInput}
        onExportHeightInputChange={setExportHeightInput}
        onExportTilesXChange={setExportTilesX}
        onExportUpscaleChange={setExportUpscale}
        onAutoUpscale={handleAutoUpscale}
        onApplyExportPreset={handleApplyExportPreset}
        onPreviewExport={handlePreviewExport}
        onExport={engine.exportPNG}
        onExportPdf={engine.exportPDF}
      />

      <section className="viewer-area">
        <CanvasView
          containerRef={engine.containerRef}
          canvasRef={engine.canvasRef}
          onPointerDown={engine.handlers.onPointerDown}
          onPointerMove={engine.handlers.onPointerMove}
          onPointerUp={engine.handlers.onPointerUp}
          onPointerCancel={engine.handlers.onPointerCancel}
          onWheel={engine.handlers.onWheel}
        />

        <HeatmapOverlay
          lang={lang}
          visible={showHeatmap && Boolean(engine.seamAnalysis)}
          avgLeftRight={engine.seamAnalysis?.avgLeftRight ?? 0}
          avgTopBottom={engine.seamAnalysis?.avgTopBottom ?? 0}
          maxDiff={engine.seamAnalysis?.maxDiff ?? 765}
        />

        <aside className="usage-hint" aria-label={text.guideTitle}>
          <h3>{text.guideTitle}</h3>
          <p>{text.guide1}</p>
          <p>{text.guide2}</p>
          <p>{text.guide3}</p>
          <p>{text.guide4}</p>
        </aside>

        <aside className="inspect-help-hint" aria-label={text.inspectHelpTitle}>
          <h3>{text.inspectHelpTitle}</h3>
          <p>{text.inspectHelpGrid}</p>
          <p>{text.inspectHelpMirror}</p>
          <p>{text.inspectHelpHeatmap}</p>
          <p>{text.inspectHelpProblem}</p>
          <p>{text.inspectHelpThreshold}</p>
          <p>{text.inspectHelpOffset}</p>
          <p>{text.inspectHelpReset}</p>
        </aside>

        <aside className="shortcut-hint" aria-label={text.shortcutsTitle}>
          <h3>{text.shortcutsTitle}</h3>
          <p>{text.shortcutPreview}</p>
          <p>{text.shortcutExport}</p>
          <p>{text.shortcutReset}</p>
        </aside>
      </section>
    </main>
  )
}

export default App
