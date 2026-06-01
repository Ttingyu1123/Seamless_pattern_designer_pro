import type { MotifLayer } from '../store/composerStore'

export interface SnapResult {
  x: number
  y: number
  snapLinesX: number[]
  snapLinesY: number[]
}

const SNAP_THRESHOLD = 8

export function computeSnap(
  x: number,
  y: number,
  currentLayerId: string,
  layers: MotifLayer[],
  tileW: number,
  tileH: number,
  viewScale: number,
): SnapResult {
  const threshold = SNAP_THRESHOLD / viewScale
  const candidatesX: number[] = []
  const candidatesY: number[] = []

  // Tile boundaries and center
  candidatesX.push(0, tileW / 2, tileW, tileW / 4, (tileW * 3) / 4)
  candidatesY.push(0, tileH / 2, tileH, tileH / 4, (tileH * 3) / 4)

  // Other layers' centers and edges
  for (const layer of layers) {
    if (layer.id === currentLayerId || !layer.visible) continue
    const halfW = (layer.naturalWidth * layer.scaleX) / 2
    const halfH = (layer.naturalHeight * layer.scaleY) / 2
    candidatesX.push(layer.x, layer.x - halfW, layer.x + halfW)
    candidatesY.push(layer.y, layer.y - halfH, layer.y + halfH)
  }

  let snappedX = x
  let snappedY = y
  const snapLinesX: number[] = []
  const snapLinesY: number[] = []

  let bestDistX = threshold
  for (const cx of candidatesX) {
    const dist = Math.abs(x - cx)
    if (dist < bestDistX) {
      bestDistX = dist
      snappedX = cx
      snapLinesX.length = 0
      snapLinesX.push(cx)
    } else if (dist === bestDistX && cx === snappedX) {
      snapLinesX.push(cx)
    }
  }

  let bestDistY = threshold
  for (const cy of candidatesY) {
    const dist = Math.abs(y - cy)
    if (dist < bestDistY) {
      bestDistY = dist
      snappedY = cy
      snapLinesY.length = 0
      snapLinesY.push(cy)
    } else if (dist === bestDistY && cy === snappedY) {
      snapLinesY.push(cy)
    }
  }

  return { x: snappedX, y: snappedY, snapLinesX, snapLinesY }
}
