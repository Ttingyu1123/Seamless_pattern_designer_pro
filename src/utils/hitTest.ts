import type { MotifLayer } from '../store/composerStore'

export type HandleType = 'body' | 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br' | 'rotate' | null

const HANDLE_RADIUS = 10
const ROTATION_HANDLE_DISTANCE = 30

export function pointToLayerLocal(
  px: number,
  py: number,
  layer: MotifLayer,
): { localX: number; localY: number } {
  const dx = px - layer.x
  const dy = py - layer.y
  const cos = Math.cos(-layer.rotation)
  const sin = Math.sin(-layer.rotation)
  return {
    localX: dx * cos - dy * sin,
    localY: dx * sin + dy * cos,
  }
}

export function isPointInLayer(px: number, py: number, layer: MotifLayer): boolean {
  const { localX, localY } = pointToLayerLocal(px, py, layer)
  const halfW = (layer.naturalWidth * layer.scaleX) / 2
  const halfH = (layer.naturalHeight * layer.scaleY) / 2
  return Math.abs(localX) <= halfW && Math.abs(localY) <= halfH
}

export function hitTestHandle(
  px: number,
  py: number,
  layer: MotifLayer,
  viewScale: number,
): HandleType {
  const { localX, localY } = pointToLayerLocal(px, py, layer)
  const halfW = (layer.naturalWidth * layer.scaleX) / 2
  const halfH = (layer.naturalHeight * layer.scaleY) / 2
  const hr = HANDLE_RADIUS / viewScale

  // Rotation handle (above top center)
  const rotDist = ROTATION_HANDLE_DISTANCE / viewScale
  const rotDx = localX
  const rotDy = localY - (-halfH - rotDist)
  if (rotDx * rotDx + rotDy * rotDy <= hr * hr) {
    return 'rotate'
  }

  // Corner handles
  const corners: Array<{ type: HandleType; cx: number; cy: number }> = [
    { type: 'corner-tl', cx: -halfW, cy: -halfH },
    { type: 'corner-tr', cx: halfW, cy: -halfH },
    { type: 'corner-bl', cx: -halfW, cy: halfH },
    { type: 'corner-br', cx: halfW, cy: halfH },
  ]

  for (const c of corners) {
    const cdx = localX - c.cx
    const cdy = localY - c.cy
    if (cdx * cdx + cdy * cdy <= hr * hr) {
      return c.type
    }
  }

  // Body
  if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
    return 'body'
  }

  return null
}
