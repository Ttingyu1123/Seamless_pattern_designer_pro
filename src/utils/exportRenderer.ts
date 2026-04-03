import { getTileOffset, shouldMirrorTile, type RepeatMode } from './tilingEngine'
import { MAX_EXPORT_EDGE, MAX_EXPORT_AREA } from './constants'
import type { SeamAnalysis } from './seamDetector'

export interface ExportRenderConfig {
  requestedWidth: number
  requestedHeight: number
  tilesX: number
  tilesY: number
  repeatMode: RepeatMode
  shiftPercent: number
  mirrorEnabled: boolean
  showGrid: boolean
  showHeatmap: boolean
  showProblemSeams: boolean
  seamAnalysis: SeamAnalysis | null
  seamThresholdPercent: number
}

export function safeExportSize(
  width: number,
  height: number,
): { width: number; height: number; scaled: boolean } {
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

export function renderExportCanvas(
  exportTile: HTMLCanvasElement,
  config: ExportRenderConfig,
): HTMLCanvasElement | null {
  const target = safeExportSize(config.requestedWidth, config.requestedHeight)

  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.imageSmoothingEnabled = true
  const scaleX = target.width / config.requestedWidth
  const scaleY = target.height / config.requestedHeight
  ctx.scale(scaleX, scaleY)

  const tileRenderWidth = config.requestedWidth / Math.max(1, config.tilesX)
  const tileRenderHeight = config.requestedHeight / Math.max(1, config.tilesY)

  const seamThreshold = (Math.max(0, Math.min(100, config.seamThresholdPercent)) / 100) * 765
  const verticalSeamIssue = (config.seamAnalysis?.avgLeftRight ?? 0) >= seamThreshold
  const horizontalSeamIssue = (config.seamAnalysis?.avgTopBottom ?? 0) >= seamThreshold

  const rowCount = Math.ceil(config.requestedHeight / tileRenderHeight) + 4
  const colCount = Math.ceil(config.requestedWidth / tileRenderWidth) + 4
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
        repeatMode: config.repeatMode,
        shiftPercent: config.shiftPercent,
        tileWidth: tileRenderWidth,
        tileHeight: tileRenderHeight,
      })

      const x = baseX + offset.offsetX
      const y = baseY + offset.offsetY

      if (
        x > config.requestedWidth ||
        y > config.requestedHeight ||
        x + tileRenderWidth < 0 ||
        y + tileRenderHeight < 0
      ) {
        continue
      }

      const mirrored = shouldMirrorTile(row, col, config.mirrorEnabled)
      if (mirrored) {
        ctx.save()
        ctx.translate(x + tileRenderWidth / 2, y + tileRenderHeight / 2)
        ctx.scale(-1, -1)
        ctx.drawImage(
          exportTile,
          -tileRenderWidth / 2 - overlap / 2,
          -tileRenderHeight / 2 - overlap / 2,
          tileRenderWidth + overlap,
          tileRenderHeight + overlap,
        )
        if (config.showHeatmap && config.seamAnalysis) {
          ctx.globalCompositeOperation = 'lighter'
          ctx.drawImage(
            config.seamAnalysis.heatmap,
            -tileRenderWidth / 2,
            -tileRenderHeight / 2,
            tileRenderWidth,
            tileRenderHeight,
          )
          ctx.globalCompositeOperation = 'source-over'
        }
        ctx.restore()
      } else {
        ctx.drawImage(
          exportTile,
          x - overlap / 2,
          y - overlap / 2,
          tileRenderWidth + overlap,
          tileRenderHeight + overlap,
        )
        if (config.showHeatmap && config.seamAnalysis) {
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.drawImage(config.seamAnalysis.heatmap, x, y, tileRenderWidth, tileRenderHeight)
          ctx.restore()
        }
      }

      if (config.showProblemSeams) {
        ctx.strokeStyle = 'rgba(10, 21, 25, 0.92)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        if (verticalSeamIssue) {
          ctx.moveTo(x + tileRenderWidth, y)
          ctx.lineTo(x + tileRenderWidth, y + tileRenderHeight)
        }
        if (horizontalSeamIssue) {
          ctx.moveTo(x, y + tileRenderHeight)
          ctx.lineTo(x + tileRenderWidth, y + tileRenderHeight)
        }
        ctx.stroke()
      }

      if (config.showGrid) {
        ctx.strokeStyle = 'rgba(255,255,255,0.34)'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, tileRenderWidth, tileRenderHeight)
      }
    }
  }

  return canvas
}
