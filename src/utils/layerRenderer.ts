import type { MotifLayer } from '../store/composerStore'
import type { RepeatMode } from './tilingEngine'

export function flattenComposedTile(
  layers: MotifLayer[],
  tileWidth: number,
  tileHeight: number,
  backgroundColor: string | null,
  imageCache: Map<string, HTMLImageElement>,
  repeatMode: RepeatMode = 'grid',
  shiftPercent: number = 50,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(tileWidth))
  canvas.height = Math.max(1, Math.round(tileHeight))
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // Background
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // Draw layers with wrap-around
  for (const layer of layers) {
    if (!layer.visible) continue
    const img = imageCache.get(layer.id)
    if (!img) continue

    const wrapOffsets = getWrapOffsets(layer, tileWidth, tileHeight, repeatMode, shiftPercent)
    for (const [wx, wy] of wrapOffsets) {
      drawLayerOnTile(ctx, layer, img, layer.x + wx, layer.y + wy)
    }
  }

  return canvas
}

function drawLayerOnTile(
  ctx: CanvasRenderingContext2D,
  layer: MotifLayer,
  img: HTMLImageElement,
  x: number,
  y: number,
) {
  const lw = layer.naturalWidth * layer.scaleX
  const lh = layer.naturalHeight * layer.scaleY

  ctx.save()
  ctx.globalAlpha = layer.opacity

  const filterParts: string[] = []
  if (layer.hue !== 0) filterParts.push(`hue-rotate(${layer.hue}deg)`)
  if (layer.saturation !== 0) filterParts.push(`saturate(${100 + layer.saturation}%)`)
  if (layer.brightness !== 0) filterParts.push(`brightness(${100 + layer.brightness}%)`)
  if (filterParts.length > 0) ctx.filter = filterParts.join(' ')

  ctx.translate(x, y)
  ctx.rotate(layer.rotation)
  ctx.drawImage(img, -lw / 2, -lh / 2, lw, lh)
  ctx.restore()
}

function getLatticeVectors(
  tileW: number,
  tileH: number,
  repeatMode: RepeatMode,
  shiftPercent: number,
): { v1: [number, number]; v2: [number, number] } {
  const shift = shiftPercent / 100

  switch (repeatMode) {
    case 'half-drop-row':
      return { v1: [tileW, 0], v2: [shift * tileW, tileH] }
    case 'half-drop-column':
      return { v1: [tileW, shift * tileH], v2: [0, tileH] }
    case 'half-brick':
    case 'hexagonal':
      return { v1: [tileW, 0], v2: [0.5 * tileW, tileH] }
    case 'diamond':
      return { v1: [tileW, 0], v2: [0.5 * tileW, 0.5 * tileH] }
    default:
      return { v1: [tileW, 0], v2: [0, tileH] }
  }
}

function getWrapOffsets(
  layer: MotifLayer,
  tileW: number,
  tileH: number,
  repeatMode: RepeatMode,
  shiftPercent: number,
): Array<[number, number]> {
  const { v1, v2 } = getLatticeVectors(tileW, tileH, repeatMode, shiftPercent)

  const halfW = (layer.naturalWidth * Math.abs(layer.scaleX)) / 2
  const halfH = (layer.naturalHeight * Math.abs(layer.scaleY)) / 2
  const radius = Math.sqrt(halfW * halfW + halfH * halfH)

  const offsets: Array<[number, number]> = []

  for (let m = -3; m <= 3; m++) {
    for (let n = -3; n <= 3; n++) {
      const ox = n * v1[0] + m * v2[0]
      const oy = n * v1[1] + m * v2[1]

      const cx = layer.x + ox
      const cy = layer.y + oy

      if (cx + radius > 0 && cx - radius < tileW &&
          cy + radius > 0 && cy - radius < tileH) {
        offsets.push([ox, oy])
      }
    }
  }

  return offsets
}

export { getLatticeVectors }
