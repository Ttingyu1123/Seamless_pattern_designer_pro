import { useCallback, useEffect, useRef } from 'react'
import { useComposerStore } from '../store/composerStore'
import type { MotifLayer } from '../store/composerStore'
import { getLatticeVectors } from '../utils/layerRenderer'
import type { RepeatMode } from '../utils/tilingEngine'

const CHECKER_SIZE = 12

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#e8e8e8'
  const cols = Math.ceil(w / CHECKER_SIZE)
  const rows = Math.ceil(h / CHECKER_SIZE)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2 === 1) {
        ctx.fillRect(c * CHECKER_SIZE, r * CHECKER_SIZE, CHECKER_SIZE, CHECKER_SIZE)
      }
    }
  }
}

function drawLayerAtPosition(
  ctx: CanvasRenderingContext2D,
  layer: MotifLayer,
  img: HTMLImageElement,
  x: number,
  y: number,
  scale: number,
) {
  const lw = layer.naturalWidth * layer.scaleX * scale
  const lh = layer.naturalHeight * layer.scaleY * scale

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

export function useComposerEngine() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const viewStateRef = useRef({ offsetX: 0, offsetY: 0, scale: 1, drawW: 0, drawH: 0 })

  const tileSizePx = useComposerStore((s) => s.tileSizePx)
  const backgroundColor = useComposerStore((s) => s.backgroundColor)
  const layers = useComposerStore((s) => s.layers)
  const selectedLayerId = useComposerStore((s) => s.selectedLayerId)
  const showGuides = useComposerStore((s) => s.showGuides)
  const guideType = useComposerStore((s) => s.guideType)
  const repeatMode = useComposerStore((s) => s.repeatMode)
  const shiftPercent = useComposerStore((s) => s.shiftPercent)
  const activeSnapLinesX = useComposerStore((s) => s.activeSnapLinesX)
  const activeSnapLinesY = useComposerStore((s) => s.activeSnapLinesY)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const container = containerRef.current
    if (!container) return

    const dpr = Math.ceil(window.devicePixelRatio || 1)
    const rect = container.getBoundingClientRect()
    const cw = Math.round(rect.width)
    const ch = Math.round(rect.height)

    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr
      canvas.height = ch * dpr
      canvas.style.width = `${cw}px`
      canvas.style.height = `${ch}px`
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cw, ch)

    const tileW = tileSizePx.width
    const tileH = tileSizePx.height
    const scale = Math.min((cw - 40) / tileW, (ch - 40) / tileH, 1)
    const drawW = tileW * scale
    const drawH = tileH * scale
    const oX = (cw - drawW) / 2
    const oY = (ch - drawH) / 2

    viewStateRef.current = { offsetX: oX, offsetY: oY, scale, drawW, drawH }

    // Tile background
    ctx.save()
    ctx.beginPath()
    ctx.rect(oX, oY, drawW, drawH)
    ctx.clip()

    if (backgroundColor) {
      ctx.fillStyle = backgroundColor
      ctx.fillRect(oX, oY, drawW, drawH)
    } else {
      ctx.save()
      ctx.translate(oX, oY)
      drawCheckerboard(ctx, drawW, drawH)
      ctx.restore()
    }

    // Draw layers with wrap-around
    for (const layer of layers) {
      if (!layer.visible) continue
      const img = layerImageCache.get(layer.id)
      if (!img) continue

      const wrapOffsets = getWrapOffsets(layer, tileW, tileH, repeatMode, shiftPercent)
      for (const [wx, wy] of wrapOffsets) {
        const screenX = oX + (layer.x + wx) * scale
        const screenY = oY + (layer.y + wy) * scale
        drawLayerAtPosition(ctx, layer, img, screenX, screenY, scale)
      }
    }

    ctx.restore() // clip

    // Tile boundary
    ctx.strokeStyle = '#a186b4'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(oX, oY, drawW, drawH)
    ctx.setLineDash([])

    // Guide lines
    if (showGuides) {
      drawGuides(ctx, oX, oY, drawW, drawH, guideType)
    }

    // Selection handles (outside clip so they're always visible)
    const selectedLayer = layers.find((l) => l.id === selectedLayerId)
    if (selectedLayer) {
      drawSelectionHandles(ctx, selectedLayer, oX, oY, scale)
    }

    // Snap lines
    if (activeSnapLinesX.length > 0 || activeSnapLinesY.length > 0) {
      ctx.strokeStyle = '#4a90d9'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      for (const sx of activeSnapLinesX) {
        const screenX = oX + sx * scale
        ctx.moveTo(screenX, oY)
        ctx.lineTo(screenX, oY + drawH)
      }
      for (const sy of activeSnapLinesY) {
        const screenY = oY + sy * scale
        ctx.moveTo(oX, screenY)
        ctx.lineTo(oX + drawW, screenY)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Size label
    ctx.fillStyle = '#666'
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${tileW} × ${tileH} px`, oX + drawW / 2, oY + drawH + 18)
  }, [tileSizePx, backgroundColor, layers, selectedLayerId, showGuides, guideType, repeatMode, shiftPercent, activeSnapLinesX, activeSnapLinesY])

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [render])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(render)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [render])

  useEffect(() => {
    let loaded = false
    const currentIds = new Set(layers.map(l => l.id))
    for (const cachedId of layerImageCache.keys()) {
      if (!currentIds.has(cachedId)) {
        layerImageCache.delete(cachedId)
      }
    }
    for (const layer of layers) {
      if (!layerImageCache.has(layer.id) && layer.imageDataUrl) {
        loadLayerImage(layer).then(() => {
          if (!loaded) {
            loaded = true
            cancelAnimationFrame(rafRef.current)
            rafRef.current = requestAnimationFrame(render)
          }
        })
      }
    }
  }, [layers, render])

  const getViewState = useCallback(() => viewStateRef.current, [])

  return { canvasRef, containerRef, getViewState }
}

// === Wrap-around logic (lattice-based) ===

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

// === Guide drawing ===

function drawGuides(
  ctx: CanvasRenderingContext2D,
  oX: number,
  oY: number,
  drawW: number,
  drawH: number,
  guideType: string,
) {
  ctx.strokeStyle = 'rgba(161, 134, 180, 0.5)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])

  if (guideType === 'center' || guideType === 'quadrants') {
    ctx.beginPath()
    ctx.moveTo(oX + drawW / 2, oY)
    ctx.lineTo(oX + drawW / 2, oY + drawH)
    ctx.moveTo(oX, oY + drawH / 2)
    ctx.lineTo(oX + drawW, oY + drawH / 2)
    ctx.stroke()
  }

  if (guideType === 'thirds') {
    ctx.beginPath()
    for (let i = 1; i <= 2; i++) {
      ctx.moveTo(oX + (drawW * i) / 3, oY)
      ctx.lineTo(oX + (drawW * i) / 3, oY + drawH)
      ctx.moveTo(oX, oY + (drawH * i) / 3)
      ctx.lineTo(oX + drawW, oY + (drawH * i) / 3)
    }
    ctx.stroke()
  }

  if (guideType === 'quadrants') {
    ctx.beginPath()
    ctx.moveTo(oX + drawW / 4, oY)
    ctx.lineTo(oX + drawW / 4, oY + drawH)
    ctx.moveTo(oX + (drawW * 3) / 4, oY)
    ctx.lineTo(oX + (drawW * 3) / 4, oY + drawH)
    ctx.moveTo(oX, oY + drawH / 4)
    ctx.lineTo(oX + drawW, oY + drawH / 4)
    ctx.moveTo(oX, oY + (drawH * 3) / 4)
    ctx.lineTo(oX + drawW, oY + (drawH * 3) / 4)
    ctx.stroke()
  }

  ctx.setLineDash([])
}

// === Selection handles ===

function drawSelectionHandles(
  ctx: CanvasRenderingContext2D,
  layer: MotifLayer,
  oX: number,
  oY: number,
  scale: number,
) {
  const lx = oX + layer.x * scale
  const ly = oY + layer.y * scale
  const lw = layer.naturalWidth * layer.scaleX * scale
  const lh = layer.naturalHeight * layer.scaleY * scale

  ctx.save()
  ctx.translate(lx, ly)
  ctx.rotate(layer.rotation)

  ctx.strokeStyle = '#4a90d9'
  ctx.lineWidth = 1.5
  ctx.strokeRect(-lw / 2, -lh / 2, lw, lh)

  const hs = 8
  ctx.fillStyle = '#ffffff'
  const corners = [[-lw / 2, -lh / 2], [lw / 2, -lh / 2], [-lw / 2, lh / 2], [lw / 2, lh / 2]]
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs)
    ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs)
  }

  const rotY = -lh / 2 - 24
  ctx.beginPath()
  ctx.moveTo(0, -lh / 2)
  ctx.lineTo(0, rotY)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, rotY, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.stroke()

  ctx.restore()
}

// === Image cache ===

const layerImageCache = new Map<string, HTMLImageElement>()

export function getLayerImageCache(): Map<string, HTMLImageElement> {
  return layerImageCache
}

export function loadLayerImage(layer: { id: string; imageDataUrl: string }): Promise<void> {
  return new Promise((resolve) => {
    if (layerImageCache.has(layer.id)) {
      resolve()
      return
    }
    const img = new Image()
    img.onload = () => {
      layerImageCache.set(layer.id, img)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = layer.imageDataUrl
  })
}

export function removeLayerImage(id: string) {
  layerImageCache.delete(id)
}
