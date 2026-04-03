import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEventHandler,
  type RefObject,
  type WheelEventHandler,
} from 'react'
import { jsPDF } from 'jspdf'
import { detectSeams, type SeamAnalysis } from '../utils/seamDetector'
import {
  createBaseTileCanvas,
  createOffsetPreviewTile,
  getTileOffset,
  shouldMirrorTile,
  type RepeatBaseSize,
  type RepeatMode,
} from '../utils/tilingEngine'
import { uiText, type UILang } from '../i18n'
import {
  useGestureHandlers,
  getViewportAnchor,
  clampZoom,
  type Viewport,
} from './useGestureHandlers'
import { renderExportCanvas, safeExportSize } from '../utils/exportRenderer'

interface CanvasSize {
  width: number
  height: number
}

interface UseCanvasEngineInput {
  lang: UILang
  previewImage: ImageBitmap | null
  exportImage: ImageBitmap | null
  repeatMode: RepeatMode
  shiftPercent: number
  tileCountX: number
  tileCountY: number
  mirrorEnabled: boolean
  showGrid: boolean
  showHeatmap: boolean
  showProblemSeams: boolean
  seamThresholdPercent: number
  offsetPreview: boolean
  previewRepeatBase: RepeatBaseSize
  exportRepeatBase: RepeatBaseSize
  exportTarget: {
    widthPx: number
    heightPx: number
    tilesX: number
    tilesY: number
    upscale: number
    dpi: number
  }
}

interface UseCanvasEngineResult {
  containerRef: RefObject<HTMLDivElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  zoom: number
  setZoom: (value: number) => void
  resetView: () => void
  exportPNG: () => void
  exportPDF: () => void
  seamAnalysis: SeamAnalysis | null
  handlers: {
    onPointerDown: PointerEventHandler<HTMLCanvasElement>
    onPointerMove: PointerEventHandler<HTMLCanvasElement>
    onPointerUp: PointerEventHandler<HTMLCanvasElement>
    onPointerCancel: PointerEventHandler<HTMLCanvasElement>
    onWheel: WheelEventHandler<HTMLCanvasElement>
  }
}

function formatTimestamp(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}${m}${d}-${hh}${mm}${ss}`
}

function buildExportFilename(
  ext: 'png' | 'pdf',
  widthPx: number,
  heightPx: number,
  dpi: number,
): string {
  const stamp = formatTimestamp()
  return `seamless-pattern_${widthPx}x${heightPx}px_${dpi}dpi_${stamp}.${ext}`
}

export function useCanvasEngine({
  lang,
  previewImage,
  exportImage,
  repeatMode,
  shiftPercent,
  tileCountX,
  tileCountY,
  mirrorEnabled,
  showGrid,
  showHeatmap,
  showProblemSeams,
  seamThresholdPercent,
  offsetPreview,
  previewRepeatBase,
  exportRepeatBase,
  exportTarget,
}: UseCanvasEngineInput): UseCanvasEngineResult {
  const text = uiText[lang]
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 1, height: 1 })
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, offsetX: 0, offsetY: 0 })

  const { handlers, zoomAt } = useGestureHandlers(canvasRef, canvasSize, viewport, setViewport)

  const previewBaseTileCanvas = useMemo(() => {
    if (!previewImage) return null
    return createBaseTileCanvas(previewImage, previewRepeatBase)
  }, [previewImage, previewRepeatBase])

  const exportBaseTileCanvas = useMemo(() => {
    if (!exportImage) return null
    return createBaseTileCanvas(exportImage, exportRepeatBase)
  }, [exportImage, exportRepeatBase])

  const previewTileCanvas = useMemo(() => {
    if (!previewBaseTileCanvas) return null
    return createOffsetPreviewTile(previewBaseTileCanvas)
  }, [previewBaseTileCanvas])

  const exportOffsetTileCanvas = useMemo(() => {
    if (!exportBaseTileCanvas) return null
    return createOffsetPreviewTile(exportBaseTileCanvas)
  }, [exportBaseTileCanvas])

  const drawTileCanvas = offsetPreview ? previewTileCanvas : previewBaseTileCanvas
  const drawExportTileCanvas = offsetPreview ? exportOffsetTileCanvas : exportBaseTileCanvas

  const seamAnalysis = useMemo(() => {
    if (!previewBaseTileCanvas) return null
    const needSeam = showHeatmap || showProblemSeams
    if (!needSeam) return null
    return detectSeams(
      previewBaseTileCanvas,
      previewBaseTileCanvas.width,
      previewBaseTileCanvas.height,
      showHeatmap,
    )
  }, [previewBaseTileCanvas, showHeatmap, showProblemSeams])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setCanvasSize({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height)),
      })
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const fitView = useCallback(() => {
    if (!drawTileCanvas) {
      setViewport({ scale: 1, offsetX: 0, offsetY: 0 })
      return
    }

    const anchor = getViewportAnchor(canvasSize)
    const worldWidth = drawTileCanvas.width * tileCountX
    const worldHeight = drawTileCanvas.height * tileCountY
    const fitScale = Math.min(
      (anchor.fitWidth * 0.82) / Math.max(1, worldWidth),
      (anchor.fitHeight * 0.82) / Math.max(1, worldHeight),
    )

    setViewport({ scale: clampZoom(fitScale || 1), offsetX: 0, offsetY: 0 })
  }, [canvasSize, drawTileCanvas, tileCountX, tileCountY])

  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    fitView()
  }, [fitView, previewImage])
  /* eslint-enable react-hooks/set-state-in-effect */

  const setZoom = useCallback(
    (value: number) => {
      const anchor = getViewportAnchor(canvasSize)
      zoomAt(value, anchor.centerX, anchor.centerY)
    },
    [canvasSize, zoomAt],
  )

  const resetView = useCallback(() => {
    fitView()
  }, [fitView])

  const resolveExportTile = useCallback(() => {
    if (!drawExportTileCanvas && !drawTileCanvas) return null

    const requestedBaseWidth = Math.max(1, Math.round(exportTarget.widthPx))
    const requestedBaseHeight = Math.max(1, Math.round(exportTarget.heightPx))
    const upscale = Math.max(1, exportTarget.upscale)
    const requestedWidth = Math.max(1, Math.round(requestedBaseWidth * upscale))
    const requestedHeight = Math.max(1, Math.round(requestedBaseHeight * upscale))

    const tileRenderWidth = requestedWidth / Math.max(1, exportTarget.tilesX)
    const tileRenderHeight = requestedHeight / Math.max(1, exportTarget.tilesY)

    const sourceTile = drawExportTileCanvas
    const previewTile = drawTileCanvas
    const previewCanFit =
      Boolean(previewTile) &&
      tileRenderWidth <= (previewTile?.width ?? 0) &&
      tileRenderHeight <= (previewTile?.height ?? 0)
    const exportTile = previewCanFit ? previewTile : sourceTile ?? previewTile
    if (!exportTile) return null

    return { exportTile, requestedBaseWidth, requestedBaseHeight, requestedWidth, requestedHeight }
  }, [drawExportTileCanvas, drawTileCanvas, exportTarget])

  const exportPNG = useCallback(() => {
    const resolved = resolveExportTile()
    if (!resolved) return

    const { exportTile, requestedBaseWidth, requestedBaseHeight, requestedWidth, requestedHeight } = resolved
    const target = safeExportSize(requestedWidth, requestedHeight)

    const exportCanvas = renderExportCanvas(exportTile, {
      requestedWidth,
      requestedHeight,
      tilesX: exportTarget.tilesX,
      tilesY: exportTarget.tilesY,
      repeatMode,
      shiftPercent,
      mirrorEnabled,
      showGrid,
      showHeatmap,
      showProblemSeams,
      seamAnalysis,
      seamThresholdPercent,
    })

    if (!exportCanvas) return

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        window.alert(text.exportFail(target.width, target.height))
        return
      }

      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = buildExportFilename('png', requestedBaseWidth, requestedBaseHeight, exportTarget.dpi)
      link.href = blobUrl
      link.click()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 0)

      if (target.scaled) {
        window.alert(
          text.exportScaled(target.width, target.height, requestedWidth, requestedHeight),
        )
      }
    }, 'image/png')
  }, [
    resolveExportTile,
    exportTarget,
    mirrorEnabled,
    repeatMode,
    seamAnalysis,
    seamThresholdPercent,
    shiftPercent,
    showGrid,
    showHeatmap,
    showProblemSeams,
    text,
  ])

  const exportPDF = useCallback(() => {
    const resolved = resolveExportTile()
    if (!resolved) return

    const { exportTile, requestedBaseWidth, requestedBaseHeight, requestedWidth, requestedHeight } = resolved
    const target = safeExportSize(requestedWidth, requestedHeight)

    const exportCanvas = renderExportCanvas(exportTile, {
      requestedWidth,
      requestedHeight,
      tilesX: exportTarget.tilesX,
      tilesY: exportTarget.tilesY,
      repeatMode,
      shiftPercent,
      mirrorEnabled,
      showGrid,
      showHeatmap,
      showProblemSeams,
      seamAnalysis,
      seamThresholdPercent,
    })

    if (!exportCanvas) return

    try {
      const pageWidthIn = requestedWidth / Math.max(1, exportTarget.dpi)
      const pageHeightIn = requestedHeight / Math.max(1, exportTarget.dpi)
      const pdf = new jsPDF({
        orientation: pageWidthIn >= pageHeightIn ? 'landscape' : 'portrait',
        unit: 'in',
        format: [pageWidthIn, pageHeightIn],
        compress: true,
      })
      const imageData = exportCanvas.toDataURL('image/png')
      pdf.addImage(imageData, 'PNG', 0, 0, pageWidthIn, pageHeightIn, undefined, 'NONE')
      pdf.save(buildExportFilename('pdf', requestedBaseWidth, requestedBaseHeight, exportTarget.dpi))

      if (target.scaled) {
        window.alert(
          text.exportScaled(target.width, target.height, requestedWidth, requestedHeight),
        )
      }
    } catch {
      window.alert(text.exportFail(target.width, target.height))
    }
  }, [
    resolveExportTile,
    exportTarget,
    mirrorEnabled,
    repeatMode,
    seamAnalysis,
    seamThresholdPercent,
    shiftPercent,
    showGrid,
    showHeatmap,
    showProblemSeams,
    text,
  ])

  // --- Canvas preview rendering ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(canvasSize.width * dpr)
    canvas.height = Math.floor(canvasSize.height * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0

    const render = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const bg = ctx.createLinearGradient(0, 0, canvasSize.width, canvasSize.height)
      bg.addColorStop(0, '#fdf6f6')
      bg.addColorStop(0.55, '#f1e4e6')
      bg.addColorStop(1, '#e8d8db')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)

      if (!drawTileCanvas) {
        ctx.fillStyle = '#7a525a'
        ctx.font = '600 18px "Space Grotesk", sans-serif'
        ctx.fillText(text.uploadHint, 24, 48)
        return
      }

      const tileWidth = drawTileCanvas.width
      const tileHeight = drawTileCanvas.height
      const originX = -(tileCountX * tileWidth) / 2
      const originY = -(tileCountY * tileHeight) / 2
      const anchor = getViewportAnchor(canvasSize)
      const overlap = 0.7 / Math.max(0.001, viewport.scale)
      const seamThreshold = (Math.max(0, Math.min(100, seamThresholdPercent)) / 100) * 765
      const verticalSeamIssue = (seamAnalysis?.avgLeftRight ?? 0) >= seamThreshold
      const horizontalSeamIssue = (seamAnalysis?.avgTopBottom ?? 0) >= seamThreshold

      ctx.save()
      ctx.translate(anchor.centerX + viewport.offsetX, anchor.centerY + viewport.offsetY)
      ctx.scale(viewport.scale, viewport.scale)

      for (let row = 0; row < tileCountY; row += 1) {
        for (let col = 0; col < tileCountX; col += 1) {
          const baseX = originX + col * tileWidth
          const baseY = originY + row * tileHeight
          const offset = getTileOffset({
            row,
            col,
            repeatMode,
            shiftPercent,
            tileWidth,
            tileHeight,
          })

          const x = baseX + offset.offsetX
          const y = baseY + offset.offsetY
          const mirrored = shouldMirrorTile(row, col, mirrorEnabled)

          if (mirrored) {
            ctx.save()
            ctx.translate(x + tileWidth / 2, y + tileHeight / 2)
            ctx.scale(-1, -1)
            ctx.drawImage(
              drawTileCanvas,
              -tileWidth / 2 - overlap / 2,
              -tileHeight / 2 - overlap / 2,
              tileWidth + overlap,
              tileHeight + overlap,
            )
            if (showHeatmap && seamAnalysis) {
              ctx.globalCompositeOperation = 'lighter'
              ctx.drawImage(seamAnalysis.heatmap, -tileWidth / 2, -tileHeight / 2, tileWidth, tileHeight)
              ctx.globalCompositeOperation = 'source-over'
            }
            ctx.restore()
          } else {
            ctx.drawImage(
              drawTileCanvas,
              x - overlap / 2,
              y - overlap / 2,
              tileWidth + overlap,
              tileHeight + overlap,
            )
            if (showHeatmap && seamAnalysis) {
              ctx.save()
              ctx.globalCompositeOperation = 'lighter'
              ctx.drawImage(seamAnalysis.heatmap, x, y, tileWidth, tileHeight)
              ctx.restore()
            }
          }

          if (showProblemSeams) {
            ctx.strokeStyle = 'rgba(10, 21, 25, 0.92)'
            ctx.lineWidth = 1.5 / viewport.scale
            ctx.beginPath()
            if (verticalSeamIssue) {
              ctx.moveTo(x + tileWidth, y)
              ctx.lineTo(x + tileWidth, y + tileHeight)
            }
            if (horizontalSeamIssue) {
              ctx.moveTo(x, y + tileHeight)
              ctx.lineTo(x + tileWidth, y + tileHeight)
            }
            ctx.stroke()
          }

          if (showGrid) {
            ctx.strokeStyle = 'rgba(255,255,255,0.34)'
            ctx.lineWidth = 1 / viewport.scale
            ctx.strokeRect(x, y, tileWidth, tileHeight)
          }
        }
      }

      ctx.restore()
    }

    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [
    canvasSize,
    drawTileCanvas,
    mirrorEnabled,
    repeatMode,
    seamAnalysis,
    shiftPercent,
    showGrid,
    showHeatmap,
    showProblemSeams,
    seamThresholdPercent,
    text,
    tileCountX,
    tileCountY,
    viewport,
  ])

  return {
    containerRef,
    canvasRef,
    zoom: viewport.scale,
    setZoom,
    resetView,
    exportPNG,
    exportPDF,
    seamAnalysis,
    handlers,
  }
}
