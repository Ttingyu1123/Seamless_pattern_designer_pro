import { useEffect, useRef } from 'react'
import { useGenerateStore } from '../store/generateStore'
import { useGenerateEngine } from '../hooks/useGenerateEngine'

export function GenerateCanvas() {
  useGenerateEngine()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  const generatedTileCanvas = useGenerateStore((s) => s.generatedTileCanvas)
  const tileSizePx = useGenerateStore((s) => s.tileSizePx)

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

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

      // Checkerboard background
      const checkSize = 8
      for (let y = 0; y < ch; y += checkSize) {
        for (let x = 0; x < cw; x += checkSize) {
          ctx.fillStyle = (Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0 ? '#f0f0f0' : '#ddd'
          ctx.fillRect(x, y, checkSize, checkSize)
        }
      }

      if (!generatedTileCanvas) return

      const tw = tileSizePx.width
      const th = tileSizePx.height
      const scale = Math.min((cw - 40) / tw, (ch - 40) / th, 1)
      const drawW = tw * scale
      const drawH = th * scale
      const oX = (cw - drawW) / 2
      const oY = (ch - drawH) / 2

      ctx.drawImage(generatedTileCanvas, oX, oY, drawW, drawH)

      // Tile boundary
      ctx.strokeStyle = '#a186b4'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.strokeRect(oX, oY, drawW, drawH)
      ctx.setLineDash([])
    }

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [generatedTileCanvas, tileSizePx])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const canvas = canvasRef.current
        if (canvas) {
          canvas.dispatchEvent(new Event('resize'))
        }
      })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="generate-canvas" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  )
}
