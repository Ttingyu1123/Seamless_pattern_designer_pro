import type { MotifLayer } from '../store/composerStore'
import type { RepeatMode } from './tilingEngine'
import { getTileOffset, shouldFlipX, shouldFlipY } from './tilingEngine'
import { flattenComposedTile } from './layerRenderer'

export function exportSingleTile(
  layers: MotifLayer[],
  tileWidth: number,
  tileHeight: number,
  backgroundColor: string | null,
  imageCache: Map<string, HTMLImageElement>,
  repeatMode: RepeatMode = 'grid',
  shiftPercent: number = 50,
) {
  const tile = flattenComposedTile(layers, tileWidth, tileHeight, backgroundColor, imageCache, repeatMode, shiftPercent)
  downloadCanvas(tile, `tile_${tileWidth}x${tileHeight}`)
}

export function exportTiledImage(
  layers: MotifLayer[],
  tileWidth: number,
  tileHeight: number,
  backgroundColor: string | null,
  imageCache: Map<string, HTMLImageElement>,
  repeatMode: RepeatMode,
  shiftPercent: number,
  tilesX: number,
  tilesY: number,
) {
  const tile = flattenComposedTile(layers, tileWidth, tileHeight, backgroundColor, imageCache, repeatMode, shiftPercent)
  const tileW = tile.width
  const tileH = tile.height

  const canvas = document.createElement('canvas')
  canvas.width = tileW * tilesX
  canvas.height = tileH * tilesY
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // Clip to canvas bounds; offset modes need extra tiles drawn outside
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, canvas.width, canvas.height)
  ctx.clip()

  const needsExtraCols = ['half-drop-row', 'half-brick', 'hexagonal', 'diamond'].includes(repeatMode)
  const needsExtraRows = ['half-drop-column', 'diamond'].includes(repeatMode)
  const extraCols = needsExtraCols ? 1 : 0
  const extraRows = needsExtraRows ? 1 : 0

  for (let row = -extraRows; row < tilesY + extraRows; row++) {
    for (let col = -extraCols; col < tilesX + extraCols; col++) {
      const { offsetX, offsetY } = getTileOffset({
        row,
        col,
        repeatMode,
        shiftPercent,
        tileWidth: tileW,
        tileHeight: tileH,
      })

      const dx = col * tileW + offsetX
      const dy = row * tileH + offsetY
      const flipX = shouldFlipX(row, col, repeatMode)
      const flipY = shouldFlipY(row, col, repeatMode)

      if (flipX || flipY) {
        ctx.save()
        ctx.translate(dx + tileW / 2, dy + tileH / 2)
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
        ctx.drawImage(tile, -tileW / 2, -tileH / 2, tileW, tileH)
        ctx.restore()
      } else {
        ctx.drawImage(tile, dx, dy, tileW, tileH)
      }
    }
  }

  ctx.restore()

  const totalW = tileW * tilesX
  const totalH = tileH * tilesY
  downloadCanvas(canvas, `tiled_${totalW}x${totalH}_${repeatMode}`)
}

function downloadCanvas(canvas: HTMLCanvasElement, name: string) {
  const link = document.createElement('a')
  link.download = `${name}_${Date.now()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
