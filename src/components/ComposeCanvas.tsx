import { useCallback, useEffect, useRef, useState } from 'react'
import { useComposerStore } from '../store/composerStore'
import type { MotifLayer } from '../store/composerStore'
import { useComposerEngine, loadLayerImage } from '../hooks/useComposerEngine'
import { hitTestHandle, type HandleType } from '../utils/hitTest'
import { computeSnap } from '../utils/snapEngine'
import { autoSave } from '../utils/projectFile'
import type { UILang } from '../i18n'
import { composeText } from '../i18n-compose'

interface Props {
  lang: UILang
}

interface DragState {
  handle: HandleType
  startClientX: number
  startClientY: number
  layerSnapshot: { x: number; y: number; scaleX: number; scaleY: number; rotation: number }
}

export function ComposeCanvas({ lang }: Props) {
  const text = composeText[lang]
  const { canvasRef, containerRef, getViewState } = useComposerEngine()
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCountRef = useRef(0)
  const dragState = useRef<DragState | null>(null)
  const spaceHeld = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const tileSizePx = useComposerStore((s) => s.tileSizePx)
  const layers = useComposerStore((s) => s.layers)
  const selectedLayerId = useComposerStore((s) => s.selectedLayerId)
  const snapEnabled = useComposerStore((s) => s.snapEnabled)
  const addLayer = useComposerStore((s) => s.addLayer)
  const selectLayer = useComposerStore((s) => s.selectLayer)
  const updateLayer = useComposerStore((s) => s.updateLayer)
  const removeLayer = useComposerStore((s) => s.removeLayer)
  const duplicateLayer = useComposerStore((s) => s.duplicateLayer)
  const setActiveSnapLines = useComposerStore((s) => s.setActiveSnapLines)

  // Auto-save (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const s = useComposerStore.getState()
      if (s.layers.length > 0) {
        autoSave({
          tileSizePx: s.tileSizePx,
          tileSizeUnit: s.tileSizeUnit,
          tileDpi: s.tileDpi,
          aspectLocked: s.aspectLocked,
          backgroundColor: s.backgroundColor,
          repeatMode: s.repeatMode,
          shiftPercent: s.shiftPercent,
          tileDirection: s.tileDirection,
          showGuides: s.showGuides,
          guideType: s.guideType,
          snapEnabled: s.snapEnabled,
          previewTilesX: s.previewTilesX,
          previewTilesY: s.previewTilesY,
          layers: s.layers,
        })
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [layers, tileSizePx])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        spaceHeld.current = true
        return
      }

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerId) {
        e.preventDefault()
        removeLayer(selectedLayerId)
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedLayerId) {
        e.preventDefault()
        duplicateLayer(selectedLayerId)
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        useComposerStore.temporal.getState().undo()
      }
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault()
        useComposerStore.temporal.getState().redo()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') spaceHeld.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [selectedLayerId, removeLayer, duplicateLayer])

  // File drag-drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current++
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current--
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current = 0
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (!files.length) return

    const view = getViewState()
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const dataUrl = await readFileAsDataUrl(file)
      const dims = await getImageDimensions(dataUrl)

      const rect = containerRef.current?.getBoundingClientRect()
      let tileX = tileSizePx.width / 2
      let tileY = tileSizePx.height / 2
      if (rect && view.scale > 0) {
        tileX = (e.clientX - rect.left - view.offsetX) / view.scale
        tileY = (e.clientY - rect.top - view.offsetY) / view.scale
      }

      const fitScale = Math.min(
        tileSizePx.width * 0.7 / dims.width,
        tileSizePx.height * 0.7 / dims.height,
        1,
      )

      const layer: MotifLayer = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ''),
        imageDataUrl: dataUrl,
        naturalWidth: dims.width,
        naturalHeight: dims.height,
        x: tileX,
        y: tileY,
        rotation: 0,
        scaleX: fitScale,
        scaleY: fitScale,
        opacity: 1,
        hue: 0,
        saturation: 0,
        brightness: 0,
        visible: true,
        locked: false,
      }
      await loadLayerImage(layer)
      addLayer(layer)
    }
  }, [addLayer, getViewState, containerRef, tileSizePx])

  // Pointer events for layer interaction
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (spaceHeld.current) return // pan mode (future)

    const view = getViewState()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || view.scale <= 0) return

    const tileX = (e.clientX - rect.left - view.offsetX) / view.scale
    const tileY = (e.clientY - rect.top - view.offsetY) / view.scale

    // If selected, check handles first
    if (selectedLayerId) {
      const selectedLayer = layers.find((l) => l.id === selectedLayerId)
      if (selectedLayer && !selectedLayer.locked) {
        const handle = hitTestHandle(tileX, tileY, selectedLayer, view.scale)
        if (handle) {
          dragState.current = {
            handle,
            startClientX: e.clientX,
            startClientY: e.clientY,
            layerSnapshot: {
              x: selectedLayer.x,
              y: selectedLayer.y,
              scaleX: selectedLayer.scaleX,
              scaleY: selectedLayer.scaleY,
              rotation: selectedLayer.rotation,
            },
          }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          return
        }
      }
    }

    // Hit test all layers (top first)
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      if (!layer.visible || layer.locked) continue
      const handle = hitTestHandle(tileX, tileY, layer, view.scale)
      if (handle) {
        selectLayer(layer.id)
        dragState.current = {
          handle: 'body',
          startClientX: e.clientX,
          startClientY: e.clientY,
          layerSnapshot: {
            x: layer.x,
            y: layer.y,
            scaleX: layer.scaleX,
            scaleY: layer.scaleY,
            rotation: layer.rotation,
          },
        }
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        return
      }
    }

    selectLayer(null)
  }, [layers, selectedLayerId, selectLayer, getViewState, containerRef])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current || !selectedLayerId) return

    const view = getViewState()
    if (view.scale <= 0) return

    const ds = dragState.current
    const snap = ds.layerSnapshot

    if (ds.handle === 'body') {
      const dx = (e.clientX - ds.startClientX) / view.scale
      const dy = (e.clientY - ds.startClientY) / view.scale
      let newX = snap.x + dx
      let newY = snap.y + dy

      if (snapEnabled && !e.altKey) {
        const result = computeSnap(
          newX, newY, selectedLayerId, layers,
          tileSizePx.width, tileSizePx.height, view.scale,
        )
        newX = result.x
        newY = result.y
        setActiveSnapLines(result.snapLinesX, result.snapLinesY)
      } else {
        setActiveSnapLines([], [])
      }

      updateLayer(selectedLayerId, { x: newX, y: newY })
    } else if (ds.handle === 'rotate') {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = rect.left + view.offsetX + snap.x * view.scale
      const cy = rect.top + view.offsetY + snap.y * view.scale
      const startAngle = Math.atan2(ds.startClientY - cy, ds.startClientX - cx)
      const currentAngle = Math.atan2(e.clientY - cy, e.clientX - cx)
      let newRotation = snap.rotation + (currentAngle - startAngle)
      // Snap to 15° increments when shift held
      if (e.shiftKey) {
        const deg15 = Math.PI / 12
        newRotation = Math.round(newRotation / deg15) * deg15
      }
      updateLayer(selectedLayerId, { rotation: newRotation })
    } else if (ds.handle?.startsWith('corner')) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = rect.left + view.offsetX + snap.x * view.scale
      const cy = rect.top + view.offsetY + snap.y * view.scale
      const startDist = Math.hypot(ds.startClientX - cx, ds.startClientY - cy)
      const currentDist = Math.hypot(e.clientX - cx, e.clientY - cy)
      if (startDist < 1) return
      const ratio = currentDist / startDist
      updateLayer(selectedLayerId, {
        scaleX: snap.scaleX * ratio,
        scaleY: snap.scaleY * ratio,
      })
    }
  }, [selectedLayerId, updateLayer, getViewState, containerRef, layers, tileSizePx, snapEnabled])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragState.current) {
      dragState.current = null
      setActiveSnapLines([], [])
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }
  }, [setActiveSnapLines])

  return (
    <section className="viewer-area compose-viewer">
      <div
        className={`compose-canvas-container ${isDragOver ? 'drag-over' : ''}`}
        ref={containerRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} />
        {isDragOver && (
          <div className="drop-overlay">
            <span>{text.noLayers}</span>
          </div>
        )}
        {layers.length === 0 && !isDragOver && (
          <div className="empty-canvas-hint clickable" onClick={() => fileRef.current?.click()}>
            <span>{text.noLayers}</span>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) {
              const files = e.target.files
              const view = getViewState()
              for (const file of Array.from(files)) {
                if (!file.type.startsWith('image/')) continue
                readFileAsDataUrl(file).then(dataUrl =>
                  getImageDimensions(dataUrl).then(dims => {
                    const fitScale = Math.min(
                      tileSizePx.width * 0.7 / dims.width,
                      tileSizePx.height * 0.7 / dims.height,
                      1,
                    )
                    const layer: MotifLayer = {
                      id: crypto.randomUUID(),
                      name: file.name.replace(/\.[^.]+$/, ''),
                      imageDataUrl: dataUrl,
                      naturalWidth: dims.width,
                      naturalHeight: dims.height,
                      x: tileSizePx.width / 2,
                      y: tileSizePx.height / 2,
                      rotation: 0,
                      scaleX: fitScale,
                      scaleY: fitScale,
                      opacity: 1,
                      hue: 0,
                      saturation: 0,
                      brightness: 0,
                      visible: true,
                      locked: false,
                    }
                    loadLayerImage(layer).then(() => addLayer(layer))
                  })
                )
              }
            }
            e.target.value = ''
          }}
        />
      </div>
    </section>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 100, height: 100 })
    img.src = dataUrl
  })
}
