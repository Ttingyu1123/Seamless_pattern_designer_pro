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
import { extractPalette, type PaletteColor } from '../utils/colorPalette'
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
import { saveBlobImage } from '../utils/saveImage'

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
  pdfBleed: boolean
  showDimensions: boolean
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
  exportSpecSheet: () => void
  seamAnalysis: SeamAnalysis | null
  palette: PaletteColor[]
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
  pdfBleed,
  showDimensions,
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

  const [seamAnalysis, setSeamAnalysis] = useState<SeamAnalysis | null>(null)
  useEffect(() => {
    let cancelled = false
    const needSeam = showHeatmap || showProblemSeams
    const compute = previewBaseTileCanvas && needSeam
      ? detectSeams(
          previewBaseTileCanvas,
          previewBaseTileCanvas.width,
          previewBaseTileCanvas.height,
          showHeatmap,
        )
      : Promise.resolve(null)
    compute.then((analysis) => {
      if (!cancelled) setSeamAnalysis(analysis)
    })
    return () => {
      cancelled = true
    }
  }, [previewBaseTileCanvas, showHeatmap, showProblemSeams])

  const palette = useMemo(() => {
    if (!previewBaseTileCanvas) return []
    return extractPalette(previewBaseTileCanvas)
  }, [previewBaseTileCanvas])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const w = Math.max(1, Math.floor(entry.contentRect.width))
      const h = Math.max(1, Math.floor(entry.contentRect.height))
      setCanvasSize((prev) => (prev.width === w && prev.height === h) ? prev : { width: w, height: h })
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [previewImage])

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

    exportCanvas.toBlob(async (blob) => {
      if (!blob) {
        window.alert(text.exportFail(target.width, target.height))
        return
      }

      const filename = buildExportFilename('png', requestedBaseWidth, requestedBaseHeight, exportTarget.dpi)
      await saveBlobImage(blob, filename)

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

    const BLEED_MM = 3
    const bleedPx = pdfBleed ? Math.round((BLEED_MM / 25.4) * exportTarget.dpi) : 0
    const canvasW = requestedWidth + bleedPx * 2
    const canvasH = requestedHeight + bleedPx * 2
    const target = safeExportSize(canvasW, canvasH)

    const exportCanvas = renderExportCanvas(exportTile, {
      requestedWidth: canvasW,
      requestedHeight: canvasH,
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
      const dpi = Math.max(1, exportTarget.dpi)
      const pageWidthIn = canvasW / dpi
      const pageHeightIn = canvasH / dpi
      const pdf = new jsPDF({
        orientation: pageWidthIn >= pageHeightIn ? 'landscape' : 'portrait',
        unit: 'in',
        format: [pageWidthIn, pageHeightIn],
        compress: true,
      })
      const imageData = exportCanvas.toDataURL('image/png')
      pdf.addImage(imageData, 'PNG', 0, 0, pageWidthIn, pageHeightIn, undefined, 'NONE')

      if (pdfBleed) {
        const bleedIn = BLEED_MM / 25.4
        const trimMarkLen = 0.15
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.003)
        const trimLeft = bleedIn
        const trimTop = bleedIn
        const trimRight = pageWidthIn - bleedIn
        const trimBottom = pageHeightIn - bleedIn

        pdf.line(trimLeft, 0, trimLeft, trimMarkLen)
        pdf.line(trimLeft, pageHeightIn - trimMarkLen, trimLeft, pageHeightIn)
        pdf.line(trimRight, 0, trimRight, trimMarkLen)
        pdf.line(trimRight, pageHeightIn - trimMarkLen, trimRight, pageHeightIn)

        pdf.line(0, trimTop, trimMarkLen, trimTop)
        pdf.line(pageWidthIn - trimMarkLen, trimTop, pageWidthIn, trimTop)
        pdf.line(0, trimBottom, trimMarkLen, trimBottom)
        pdf.line(pageWidthIn - trimMarkLen, trimBottom, pageWidthIn, trimBottom)
      }

      pdf.save(buildExportFilename('pdf', requestedBaseWidth, requestedBaseHeight, exportTarget.dpi))

      if (target.scaled) {
        window.alert(
          text.exportScaled(target.width, target.height, canvasW, canvasH),
        )
      }
    } catch {
      window.alert(text.exportFail(target.width, target.height))
    }
  }, [
    resolveExportTile,
    exportTarget,
    pdfBleed,
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

  const exportSpecSheet = useCallback(() => {
    const resolved = resolveExportTile()
    if (!resolved) return

    const { exportTile, requestedBaseWidth, requestedBaseHeight } = resolved

    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
      const pageW = 210
      const margin = 15
      const contentW = pageW - margin * 2
      let y = margin

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('Pattern Spec Sheet', margin, y)
      y += 10

      pdf.setDrawColor(180)
      pdf.setLineWidth(0.3)
      pdf.line(margin, y, pageW - margin, y)
      y += 8

      const thumbMaxW = contentW * 0.45
      const thumbMaxH = 80
      const aspect = exportTile.width / Math.max(1, exportTile.height)
      let thumbW = thumbMaxW
      let thumbH = thumbW / aspect
      if (thumbH > thumbMaxH) { thumbH = thumbMaxH; thumbW = thumbH * aspect }
      const thumbData = exportTile.toDataURL('image/png')

      pdf.setDrawColor(200)
      pdf.setLineWidth(0.2)
      pdf.rect(margin, y, thumbW, thumbH)
      pdf.addImage(thumbData, 'PNG', margin, y, thumbW, thumbH)

      const tiledCanvas = renderExportCanvas(exportTile, {
        requestedWidth: exportTile.width * 3,
        requestedHeight: exportTile.height * 3,
        tilesX: 3,
        tilesY: 3,
        repeatMode,
        shiftPercent,
        mirrorEnabled,
        showGrid: false,
        showHeatmap: false,
        showProblemSeams: false,
        seamAnalysis: null,
        seamThresholdPercent: 0,
      })

      if (tiledCanvas) {
        const tiledX = margin + thumbW + 8
        const tiledMaxW = contentW - thumbW - 8
        const tiledAspect = tiledCanvas.width / Math.max(1, tiledCanvas.height)
        let tiledW = tiledMaxW
        let tiledH = tiledW / tiledAspect
        if (tiledH > thumbMaxH) { tiledH = thumbMaxH; tiledW = tiledH * tiledAspect }
        pdf.rect(tiledX, y, tiledW, tiledH)
        pdf.addImage(tiledCanvas.toDataURL('image/png'), 'PNG', tiledX, y, tiledW, tiledH)
        pdf.setFontSize(7)
        pdf.setFont('helvetica', 'normal')
        pdf.text('3x3 repeat preview', tiledX, y + tiledH + 3.5)
      }

      y += thumbH + 12

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Tile Specifications', margin, y)
      y += 6

      const dpi = exportTarget.dpi
      const tileWcm = ((requestedBaseWidth / dpi) * 2.54).toFixed(2)
      const tileHcm = ((requestedBaseHeight / dpi) * 2.54).toFixed(2)
      const tileWin = (requestedBaseWidth / dpi).toFixed(2)
      const tileHin = (requestedBaseHeight / dpi).toFixed(2)

      const specs = [
        ['Tile Size (px)', `${requestedBaseWidth} x ${requestedBaseHeight} px`],
        ['Tile Size (cm)', `${tileWcm} x ${tileHcm} cm`],
        ['Tile Size (in)', `${tileWin} x ${tileHin} in`],
        ['DPI', `${dpi}`],
        ['Repeat Mode', repeatMode],
        ['Shift', `${shiftPercent}%`],
      ]

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      for (const [label, value] of specs) {
        pdf.setFont('helvetica', 'bold')
        pdf.text(`${label}:`, margin, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(value, margin + 42, y)
        y += 5
      }

      y += 4

      if (palette.length > 0) {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        pdf.text(`Color Palette (${palette.length} colors)`, margin, y)
        y += 6

        const swatchSize = 10
        const gap = 3
        let sx = margin
        for (const c of palette) {
          if (sx + swatchSize > pageW - margin) {
            sx = margin
            y += swatchSize + gap + 5
          }
          const r = c.r / 255
          const g = c.g / 255
          const b = c.b / 255
          pdf.setFillColor(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255))
          pdf.rect(sx, y, swatchSize, swatchSize, 'F')
          pdf.setDrawColor(180)
          pdf.rect(sx, y, swatchSize, swatchSize, 'S')
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(6.5)
          pdf.setTextColor(60)
          pdf.text(c.hex, sx + swatchSize / 2, y + swatchSize + 3.5, { align: 'center' })
          pdf.text(`${c.percent}%`, sx + swatchSize / 2, y + swatchSize + 6.5, { align: 'center' })
          pdf.setTextColor(0)
          sx += swatchSize + gap + 6
        }
        y += swatchSize + 12
      }

      y += 4
      pdf.setDrawColor(180)
      pdf.line(margin, y, pageW - margin, y)
      y += 5
      pdf.setFontSize(7)
      pdf.setTextColor(130)
      pdf.text(`Generated by Seamless Pattern Designer PRO — ${new Date().toISOString().slice(0, 10)}`, margin, y)
      pdf.setTextColor(0)

      const stamp = formatTimestamp()
      pdf.save(`spec-sheet_${requestedBaseWidth}x${requestedBaseHeight}_${stamp}.pdf`)
    } catch {
      window.alert(text.exportFail(0, 0))
    }
  }, [
    resolveExportTile,
    exportTarget,
    mirrorEnabled,
    palette,
    repeatMode,
    shiftPercent,
    text,
  ])

  // --- Canvas preview rendering ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (canvasSize.width <= 1 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width > 1) {
        setCanvasSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) })
        return
      }
    }

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
      bg.addColorStop(0, '#FDFCF5')
      bg.addColorStop(0.55, '#F0EDE0')
      bg.addColorStop(1, '#E8E4D5')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)

      if (!drawTileCanvas) {
        ctx.fillStyle = '#745A86'
        ctx.font = '600 18px "Noto Sans TC", system-ui, sans-serif'
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

      if (showDimensions && exportTarget.dpi > 0) {
        const dpiVal = exportTarget.dpi
        const firstTileX = originX
        const firstTileY = originY
        const tileCm = (n: number) => ((n / dpiVal) * 2.54).toFixed(1)
        const lineW = 1.5 / viewport.scale
        const fontSize = Math.max(10, 13 / viewport.scale)
        const arrowLen = 6 / viewport.scale
        const gap = 8 / viewport.scale

        ctx.strokeStyle = '#745A86'
        ctx.fillStyle = '#745A86'
        ctx.lineWidth = lineW
        ctx.font = `600 ${fontSize}px "Noto Sans TC", system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const wLabel = `${tileCm(tileWidth)} cm`
        const hLabel = `${tileCm(tileHeight)} cm`

        const dimY = firstTileY - gap
        ctx.beginPath()
        ctx.moveTo(firstTileX, dimY)
        ctx.lineTo(firstTileX + tileWidth, dimY)
        ctx.moveTo(firstTileX, dimY - arrowLen)
        ctx.lineTo(firstTileX, dimY + arrowLen)
        ctx.moveTo(firstTileX + tileWidth, dimY - arrowLen)
        ctx.lineTo(firstTileX + tileWidth, dimY + arrowLen)
        ctx.stroke()
        ctx.fillText(wLabel, firstTileX + tileWidth / 2, dimY - gap)

        const dimX = firstTileX - gap
        ctx.beginPath()
        ctx.moveTo(dimX, firstTileY)
        ctx.lineTo(dimX, firstTileY + tileHeight)
        ctx.moveTo(dimX - arrowLen, firstTileY)
        ctx.lineTo(dimX + arrowLen, firstTileY)
        ctx.moveTo(dimX - arrowLen, firstTileY + tileHeight)
        ctx.lineTo(dimX + arrowLen, firstTileY + tileHeight)
        ctx.stroke()
        ctx.save()
        ctx.translate(dimX - gap, firstTileY + tileHeight / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(hLabel, 0, 0)
        ctx.restore()
      }

      ctx.restore()
    }

    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [
    canvasSize,
    drawTileCanvas,
    exportTarget,
    mirrorEnabled,
    repeatMode,
    seamAnalysis,
    shiftPercent,
    showDimensions,
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
    exportSpecSheet,
    seamAnalysis,
    palette,
    handlers,
  }
}
