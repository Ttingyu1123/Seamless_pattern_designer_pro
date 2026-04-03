import {
  useCallback,
  useRef,
  type Dispatch,
  type PointerEventHandler,
  type SetStateAction,
  type WheelEventHandler,
} from 'react'
import { CONTROL_PANEL_WIDTH, PANEL_BREAKPOINT } from '../utils/constants'

export interface Viewport {
  scale: number
  offsetX: number
  offsetY: number
}

interface CanvasSize {
  width: number
  height: number
}

interface PointerState {
  x: number
  y: number
}

interface ViewportAnchor {
  centerX: number
  centerY: number
  fitWidth: number
  fitHeight: number
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 8

export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
}

export function getViewportAnchor(canvasSize: CanvasSize): ViewportAnchor {
  const reserveRight = canvasSize.width > PANEL_BREAKPOINT ? CONTROL_PANEL_WIDTH : 0
  const fitWidth = Math.max(1, canvasSize.width - reserveRight)
  return {
    centerX: fitWidth / 2,
    centerY: canvasSize.height / 2,
    fitWidth,
    fitHeight: canvasSize.height,
  }
}

function distance(a: PointerState, b: PointerState): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function midpoint(a: PointerState, b: PointerState): PointerState {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export interface GestureHandlers {
  onPointerDown: PointerEventHandler<HTMLCanvasElement>
  onPointerMove: PointerEventHandler<HTMLCanvasElement>
  onPointerUp: PointerEventHandler<HTMLCanvasElement>
  onPointerCancel: PointerEventHandler<HTMLCanvasElement>
  onWheel: WheelEventHandler<HTMLCanvasElement>
}

export function useGestureHandlers(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  canvasSize: CanvasSize,
  viewport: Viewport,
  setViewport: Dispatch<SetStateAction<Viewport>>,
): { handlers: GestureHandlers; zoomAt: (targetScale: number, pointX: number, pointY: number) => void } {
  const pointersRef = useRef<Map<number, PointerState>>(new Map())
  const panRef = useRef<{ id: number; lastX: number; lastY: number } | null>(null)
  const pinchRef = useRef<{
    startDistance: number
    startScale: number
    worldX: number
    worldY: number
  } | null>(null)

  const clearPointer = useCallback((pointerId: number) => {
    pointersRef.current.delete(pointerId)
    if (panRef.current?.id === pointerId) {
      panRef.current = null
    }
    if (pointersRef.current.size < 2) {
      pinchRef.current = null
    }
  }, [])

  const zoomAt = useCallback(
    (targetScale: number, pointX: number, pointY: number) => {
      setViewport((prev) => {
        const newScale = clampZoom(targetScale)
        const anchor = getViewportAnchor(canvasSize)
        const worldX = (pointX - anchor.centerX - prev.offsetX) / prev.scale
        const worldY = (pointY - anchor.centerY - prev.offsetY) / prev.scale
        return {
          scale: newScale,
          offsetX: pointX - anchor.centerX - worldX * newScale,
          offsetY: pointY - anchor.centerY - worldY * newScale,
        }
      })
    },
    [canvasSize, setViewport],
  )

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

        pinchRef.current = {
          startDistance,
          startScale: viewport.scale,
          worldX: (mid.x - anchor.centerX - viewport.offsetX) / viewport.scale,
          worldY: (mid.y - anchor.centerY - viewport.offsetY) / viewport.scale,
        }

        panRef.current = null
      }
    },
    [canvasRef, canvasSize, viewport],
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

        setViewport((prev) => ({
          ...prev,
          scale: nextScale,
          offsetX: mid.x - anchor.centerX - pinchRef.current!.worldX * nextScale,
          offsetY: mid.y - anchor.centerY - pinchRef.current!.worldY * nextScale,
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
    [canvasSize, setViewport],
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
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onWheel },
    zoomAt,
  }
}
