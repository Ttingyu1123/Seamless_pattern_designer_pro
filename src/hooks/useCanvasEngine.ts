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

interface Viewport {
  scale: number
  offsetX: number
  offsetY: number
}

interface CanvasSize {
  width: number
  height: number
}

interface ViewportAnchor {
  centerX: number
  centerY: number
  fitWidth: number
  fitHeight: number
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

interface PointerState {
  x: number
  y: number
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

const MIN_ZOOM = 0.1
const MAX_ZOOM = 8
const MAX_EXPORT_EDGE = 8192
const MAX_EXPORT_AREA = 67_108_864

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

function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
}

function distance(a: PointerState, b: PointerState): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function midpoint(a: PointerState, b: PointerState): PointerState {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function safeExportSize(width: number, height: number): { width: number; height: number; scaled: boolean } {
  const edgeScale = Math.min(1, MAX_EXPORT_EDGE / Math.max(width, height))
  const areaScale = Math.min(1, Math.sqrt(MAX_EXPORT_AREA / Math.max(1, width * height)))
  const scale = Math.min(edgeScale, areaScale)

  if (scale >= 1) {
    return { width, height, scaled: false }
  }

  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scaled: true,
  }
}

function getViewportAnchor(canvasSize: CanvasSize): ViewportAnchor {
  const reserveRight = canvasSize.width > 1100 ? 300 : 0
  const fitWidth = Math.max(1, canvasSize.width - reserveRight)
  return {
    centerX: fitWidth / 2,
    centerY: canvasSize.height / 2,
    fitWidth,
    fitHeight: canvasSize.height,
  }
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

  const pointersRef = useRef<Map<number, PointerState>>(new Map())
  const panRef = useRef<{ id: number; lastX: number; lastY: number } | null>(null)
  const pinchRef = useRef<{
    startDistance: number
    startScale: number
    worldX: number
    worldY: number
  } | null>(null)

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
  }, [canvasSize.height, canvasSize.width, drawTileCanvas, tileCountX, tileCountY])

  useEffect(() => {
    fitView()
  }, [fitView, previewImage])

  const zoomAt = useCallback(
    (targetScale: number, pointX: number, pointY: number) => {
      setViewport((prev) => {
        const newScale = clampZoom(targetScale)
        const anchor = getViewportAnchor(canvasSize)
        const centerX = anchor.centerX
        const centerY = anchor.centerY
        const worldX = (pointX - centerX - prev.offsetX) / prev.scale
        const worldY = (pointY - centerY - prev.offsetY) / prev.scale

        return {
          scale: newScale,
          offsetX: pointX - centerX - worldX * newScale,
          offsetY: pointY - centerY - worldY * newScale,
        }
      })
    },
    [canvasSize.height, canvasSize.width],
  )

  const setZoom = useCallback(
    (value: number) => {
      const anchor = getViewportAnchor(canvasSize)
      zoomAt(value, anchor.centerX, anchor.centerY)
    },
    [canvasSize.height, canvasSize.width, zoomAt],
  )

  const resetView = useCallback(() => {
    fitView()
  }, [fitView])

  const exportPNG = useCallback(() => {
    if (!drawExportTileCanvas && !drawTileCanvas) return

    const seamThreshold = (Math.max(0, Math.min(100, seamThresholdPercent)) / 100) * 765
    const verticalSeamIssue = (seamAnalysis?.avgLeftRight ?? 0) >= seamThreshold
    const horizontalSeamIssue = (seamAnalysis?.avgTopBottom ?? 0) >= seamThreshold

    const requestedBaseWidth = Math.max(1, Math.round(exportTarget.widthPx))
    const requestedBaseHeight = Math.max(1, Math.round(exportTarget.heightPx))
    const upscale = Math.max(1, exportTarget.upscale)
    const requestedWidth = Math.max(1, Math.round(requestedBaseWidth * upscale))
    const requestedHeight = Math.max(1, Math.round(requestedBaseHeight * upscale))
    const target = safeExportSize(requestedWidth, requestedHeight)

    const tileRenderWidth = requestedWidth / Math.max(1, exportTarget.tilesX)
    const tileRenderHeight = requestedHeight / Math.max(1, exportTarget.tilesY)

    const sourceTile = drawExportTileCanvas
    const previewTile = drawTileCanvas
    const previewCanFit =
      Boolean(previewTile) &&
      tileRenderWidth <= (previewTile?.width ?? 0) &&
      tileRenderHeight <= (previewTile?.height ?? 0)
    const exportTile = previewCanFit ? previewTile : sourceTile ?? previewTile

    if (!exportTile) return

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = target.width
    exportCanvas.height = target.height
    const exportCtx = exportCanvas.getContext('2d')

    if (!exportCtx) return

    exportCtx.imageSmoothingEnabled = true
    const scaleX = target.width / requestedWidth
    const scaleY = target.height / requestedHeight
    exportCtx.scale(scaleX, scaleY)

    const rowCount = Math.ceil(requestedHeight / tileRenderHeight) + 4
    const colCount = Math.ceil(requestedWidth / tileRenderWidth) + 4
    const rowStart = -2
    const colStart = -2

    const overlap = 0.7
    for (let row = rowStart; row < rowStart + rowCount; row += 1) {
      for (let col = colStart; col < colStart + colCount; col += 1) {
        const baseX = col * tileRenderWidth
        const baseY = row * tileRenderHeight
        const offset = getTileOffset({
          row,
          col,
          repeatMode,
          shiftPercent,
          tileWidth: tileRenderWidth,
          tileHeight: tileRenderHeight,
        })

        const x = baseX + offset.offsetX
        const y = baseY + offset.offsetY

        if (x > requestedWidth || y > requestedHeight || x + tileRenderWidth < 0 || y + tileRenderHeight < 0) {
          continue
        }

        const mirrored = shouldMirrorTile(row, col, mirrorEnabled)
        if (mirrored) {
          exportCtx.save()
          exportCtx.translate(x + tileRenderWidth / 2, y + tileRenderHeight / 2)
          exportCtx.scale(-1, -1)
          exportCtx.drawImage(
            exportTile,
            -tileRenderWidth / 2 - overlap / 2,
            -tileRenderHeight / 2 - overlap / 2,
            tileRenderWidth + overlap,
            tileRenderHeight + overlap,
          )
          if (showHeatmap && seamAnalysis) {
            exportCtx.globalCompositeOperation = 'lighter'
            exportCtx.drawImage(
              seamAnalysis.heatmap,
              -tileRenderWidth / 2,
              -tileRenderHeight / 2,
              tileRenderWidth,
              tileRenderHeight,
            )
            exportCtx.globalCompositeOperation = 'source-over'
          }
          exportCtx.restore()
        } else {
          exportCtx.drawImage(
            exportTile,
            x - overlap / 2,
            y - overlap / 2,
            tileRenderWidth + overlap,
            tileRenderHeight + overlap,
          )
          if (showHeatmap && seamAnalysis) {
            exportCtx.save()
            exportCtx.globalCompositeOperation = 'lighter'
            exportCtx.drawImage(seamAnalysis.heatmap, x, y, tileRenderWidth, tileRenderHeight)
            exportCtx.restore()
          }
        }

        if (showProblemSeams) {
          exportCtx.strokeStyle = 'rgba(10, 21, 25, 0.92)'
          exportCtx.lineWidth = 1.5
          exportCtx.beginPath()
          if (verticalSeamIssue) {
            exportCtx.moveTo(x + tileRenderWidth, y)
            exportCtx.lineTo(x + tileRenderWidth, y + tileRenderHeight)
          }
          if (horizontalSeamIssue) {
            exportCtx.moveTo(x, y + tileRenderHeight)
            exportCtx.lineTo(x + tileRenderWidth, y + tileRenderHeight)
          }
          exportCtx.stroke()
        }

        if (showGrid) {
          exportCtx.strokeStyle = 'rgba(255,255,255,0.34)'
          exportCtx.lineWidth = 1
          exportCtx.strokeRect(x, y, tileRenderWidth, tileRenderHeight)
        }
      }
    }

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
    drawTileCanvas,
    drawExportTileCanvas,
    exportTarget.heightPx,
    exportTarget.dpi,
    exportTarget.tilesX,
    exportTarget.tilesY,
    exportTarget.upscale,
    exportTarget.widthPx,
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
    if (!drawExportTileCanvas && !drawTileCanvas) return

    const seamThreshold = (Math.max(0, Math.min(100, seamThresholdPercent)) / 100) * 765
    const verticalSeamIssue = (seamAnalysis?.avgLeftRight ?? 0) >= seamThreshold
    const horizontalSeamIssue = (seamAnalysis?.avgTopBottom ?? 0) >= seamThreshold

    const requestedBaseWidth = Math.max(1, Math.round(exportTarget.widthPx))
    const requestedBaseHeight = Math.max(1, Math.round(exportTarget.heightPx))
    const upscale = Math.max(1, exportTarget.upscale)
    const requestedWidth = Math.max(1, Math.round(requestedBaseWidth * upscale))
    const requestedHeight = Math.max(1, Math.round(requestedBaseHeight * upscale))
    const target = safeExportSize(requestedWidth, requestedHeight)

    const tileRenderWidth = requestedWidth / Math.max(1, exportTarget.tilesX)
    const tileRenderHeight = requestedHeight / Math.max(1, exportTarget.tilesY)

    const sourceTile = drawExportTileCanvas
    const previewTile = drawTileCanvas
    const previewCanFit =
      Boolean(previewTile) &&
      tileRenderWidth <= (previewTile?.width ?? 0) &&
      tileRenderHeight <= (previewTile?.height ?? 0)
    const exportTile = previewCanFit ? previewTile : sourceTile ?? previewTile
    if (!exportTile) return

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = target.width
    exportCanvas.height = target.height
    const exportCtx = exportCanvas.getContext('2d')
    if (!exportCtx) return

    exportCtx.imageSmoothingEnabled = true
    const scaleX = target.width / requestedWidth
    const scaleY = target.height / requestedHeight
    exportCtx.scale(scaleX, scaleY)

    const rowCount = Math.ceil(requestedHeight / tileRenderHeight) + 4
    const colCount = Math.ceil(requestedWidth / tileRenderWidth) + 4
    const rowStart = -2
    const colStart = -2

    const overlap = 0.7
    for (let row = rowStart; row < rowStart + rowCount; row += 1) {
      for (let col = colStart; col < colStart + colCount; col += 1) {
        const baseX = col * tileRenderWidth
        const baseY = row * tileRenderHeight
        const offset = getTileOffset({
          row,
          col,
          repeatMode,
          shiftPercent,
          tileWidth: tileRenderWidth,
          tileHeight: tileRenderHeight,
        })

        const x = baseX + offset.offsetX
        const y = baseY + offset.offsetY

        if (x > requestedWidth || y > requestedHeight || x + tileRenderWidth < 0 || y + tileRenderHeight < 0) {
          continue
        }

        const mirrored = shouldMirrorTile(row, col, mirrorEnabled)
        if (mirrored) {
          exportCtx.save()
          exportCtx.translate(x + tileRenderWidth / 2, y + tileRenderHeight / 2)
          exportCtx.scale(-1, -1)
          exportCtx.drawImage(
            exportTile,
            -tileRenderWidth / 2 - overlap / 2,
            -tileRenderHeight / 2 - overlap / 2,
            tileRenderWidth + overlap,
            tileRenderHeight + overlap,
          )
          if (showHeatmap && seamAnalysis) {
            exportCtx.globalCompositeOperation = 'lighter'
            exportCtx.drawImage(
              seamAnalysis.heatmap,
              -tileRenderWidth / 2,
              -tileRenderHeight / 2,
              tileRenderWidth,
              tileRenderHeight,
            )
            exportCtx.globalCompositeOperation = 'source-over'
          }
          exportCtx.restore()
        } else {
          exportCtx.drawImage(
            exportTile,
            x - overlap / 2,
            y - overlap / 2,
            tileRenderWidth + overlap,
            tileRenderHeight + overlap,
          )
          if (showHeatmap && seamAnalysis) {
            exportCtx.save()
            exportCtx.globalCompositeOperation = 'lighter'
            exportCtx.drawImage(seamAnalysis.heatmap, x, y, tileRenderWidth, tileRenderHeight)
            exportCtx.restore()
          }
        }

        if (showProblemSeams) {
          exportCtx.strokeStyle = 'rgba(10, 21, 25, 0.92)'
          exportCtx.lineWidth = 1.5
          exportCtx.beginPath()
          if (verticalSeamIssue) {
            exportCtx.moveTo(x + tileRenderWidth, y)
            exportCtx.lineTo(x + tileRenderWidth, y + tileRenderHeight)
          }
          if (horizontalSeamIssue) {
            exportCtx.moveTo(x, y + tileRenderHeight)
            exportCtx.lineTo(x + tileRenderWidth, y + tileRenderHeight)
          }
          exportCtx.stroke()
        }

        if (showGrid) {
          exportCtx.strokeStyle = 'rgba(255,255,255,0.34)'
          exportCtx.lineWidth = 1
          exportCtx.strokeRect(x, y, tileRenderWidth, tileRenderHeight)
        }
      }
    }

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
    drawExportTileCanvas,
    drawTileCanvas,
    exportTarget.heightPx,
    exportTarget.dpi,
    exportTarget.tilesX,
    exportTarget.tilesY,
    exportTarget.upscale,
    exportTarget.widthPx,
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
    canvasSize.height,
    canvasSize.width,
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

  const clearPointer = useCallback((pointerId: number) => {
    pointersRef.current.delete(pointerId)
    if (panRef.current?.id === pointerId) {
      panRef.current = null
    }

    if (pointersRef.current.size < 2) {
      pinchRef.current = null
    }
  }, [])

  const onPointerDown = useCallback<PointerEventHandler<HTMLCanvasElement>>(
    (event) => {
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.setPointerCapture(event.pointerId)
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (pointersRef.current.size === 1) {
        panRef.current = { id: event.pointerId, lastX: event.clientX, lastY: event.clientY }
      }

      if (pointersRef.current.size === 2) {
        const [a, b] = Array.from(pointersRef.current.values())
        const mid = midpoint(a, b)
        const startDistance = Math.max(1, distance(a, b))
        const anchor = getViewportAnchor(canvasSize)
        const centerX = anchor.centerX
        const centerY = anchor.centerY

        pinchRef.current = {
          startDistance,
          startScale: viewport.scale,
          worldX: (mid.x - centerX - viewport.offsetX) / viewport.scale,
          worldY: (mid.y - centerY - viewport.offsetY) / viewport.scale,
        }

        panRef.current = null
      }
    },
    [canvasSize.height, canvasSize.width, viewport.offsetX, viewport.offsetY, viewport.scale],
  )

  const onPointerMove = useCallback<PointerEventHandler<HTMLCanvasElement>>(
    (event) => {
      if (!pointersRef.current.has(event.pointerId)) return

      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (pointersRef.current.size === 2 && pinchRef.current) {
        const [a, b] = Array.from(pointersRef.current.values())
        const mid = midpoint(a, b)
        const ratio = distance(a, b) / pinchRef.current.startDistance
        const nextScale = clampZoom(pinchRef.current.startScale * ratio)
        const anchor = getViewportAnchor(canvasSize)
        const centerX = anchor.centerX
        const centerY = anchor.centerY

        setViewport((prev) => ({
          ...prev,
          scale: nextScale,
          offsetX: mid.x - centerX - pinchRef.current!.worldX * nextScale,
          offsetY: mid.y - centerY - pinchRef.current!.worldY * nextScale,
        }))
        return
      }

      if (pointersRef.current.size === 1 && panRef.current?.id === event.pointerId) {
        const dx = event.clientX - panRef.current.lastX
        const dy = event.clientY - panRef.current.lastY
        panRef.current.lastX = event.clientX
        panRef.current.lastY = event.clientY

        setViewport((prev) => ({ ...prev, offsetX: prev.offsetX + dx, offsetY: prev.offsetY + dy }))
      }
    },
    [canvasSize.height, canvasSize.width],
  )

  const onPointerUp = useCallback<PointerEventHandler<HTMLCanvasElement>>(
    (event) => {
      clearPointer(event.pointerId)
    },
    [clearPointer],
  )

  const onPointerCancel = useCallback<PointerEventHandler<HTMLCanvasElement>>(
    (event) => {
      clearPointer(event.pointerId)
    },
    [clearPointer],
  )

  const onWheel = useCallback<WheelEventHandler<HTMLCanvasElement>>(
    (event) => {
      event.preventDefault()
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const factor = event.deltaY < 0 ? 1.08 : 0.92
      zoomAt(viewport.scale * factor, x, y)
    },
    [viewport.scale, zoomAt],
  )

  return {
    containerRef,
    canvasRef,
    zoom: viewport.scale,
    setZoom,
    resetView,
    exportPNG,
    exportPDF,
    seamAnalysis,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onWheel,
    },
  }
}
