import { useEffect, useRef } from 'react'
import { useGenerateStore } from '../store/generateStore'
import { renderGeometricTile } from '../utils/generate/renderGeometric'
import { renderKaleidoscopeTile } from '../utils/generate/renderKaleidoscope'

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

export function useGenerateEngine() {
  const subMode = useGenerateStore((s) => s.subMode)
  const geometric = useGenerateStore((s) => s.geometric)
  const kaleidoscope = useGenerateStore((s) => s.kaleidoscope)
  const tileSizePx = useGenerateStore((s) => s.tileSizePx)
  const setGeneratedTileCanvas = useGenerateStore((s) => s.setGeneratedTileCanvas)
  const sourceImgRef = useRef<HTMLImageElement | null>(null)
  const lastSrcUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const timer = setTimeout(async () => {
      const { width, height } = tileSizePx
      if (width < 1 || height < 1) return

      if (subMode === 'geometric') {
        const canvas = renderGeometricTile(geometric, width, height)
        if (!cancelled) setGeneratedTileCanvas(canvas)
      } else if (subMode === 'kaleidoscope' && kaleidoscope.sourceImageDataUrl) {
        if (lastSrcUrlRef.current !== kaleidoscope.sourceImageDataUrl) {
          try {
            sourceImgRef.current = await loadImage(kaleidoscope.sourceImageDataUrl)
            lastSrcUrlRef.current = kaleidoscope.sourceImageDataUrl
          } catch {
            sourceImgRef.current = null
            lastSrcUrlRef.current = null
          }
        }
        if (sourceImgRef.current && !cancelled) {
          const canvas = renderKaleidoscopeTile(kaleidoscope, sourceImgRef.current, width, height)
          setGeneratedTileCanvas(canvas)
        }
      } else {
        if (!cancelled) setGeneratedTileCanvas(null)
      }
    }, 100)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [subMode, geometric, kaleidoscope, tileSizePx, setGeneratedTileCanvas])
}
