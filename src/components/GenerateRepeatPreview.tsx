import { useCallback, useEffect, useRef } from 'react'
import { useGenerateStore } from '../store/generateStore'
import { getTileOffset, shouldFlipX, shouldFlipY } from '../utils/tilingEngine'
import type { UILang } from '../i18n'
import { generateText } from '../i18n-generate'

interface Props {
  lang: UILang
}

export function GenerateRepeatPreview({ lang }: Props) {
  const text = generateText[lang]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  const generatedTileCanvas = useGenerateStore((s) => s.generatedTileCanvas)
  const repeatMode = useGenerateStore((s) => s.repeatMode)
  const shiftPercent = useGenerateStore((s) => s.shiftPercent)
  const previewTilesX = useGenerateStore((s) => s.previewTilesX)
  const previewTilesY = useGenerateStore((s) => s.previewTilesY)

  const render = useCallback(() => {
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

    if (!generatedTileCanvas) return

    const tileW = generatedTileCanvas.width
    const tileH = generatedTileCanvas.height
    if (tileW < 1 || tileH < 1) return

    const totalW = tileW * previewTilesX
    const totalH = tileH * previewTilesY
    const scale = Math.min((cw - 20) / totalW, (ch - 20) / totalH, 1)
    const drawW = totalW * scale
    const drawH = totalH * scale
    const oX = (cw - drawW) / 2
    const oY = (ch - drawH) / 2

    const needsExtraCols = ['half-drop-row', 'half-brick', 'hexagonal', 'diamond'].includes(repeatMode)
    const needsExtraRows = ['half-drop-column', 'diamond'].includes(repeatMode)
    const extraCols = needsExtraCols ? 1 : 0
    const extraRows = needsExtraRows ? 1 : 0

    ctx.save()
    ctx.beginPath()
    ctx.rect(oX, oY, drawW, drawH)
    ctx.clip()

    for (let row = -extraRows; row < previewTilesY + extraRows; row++) {
      for (let col = -extraCols; col < previewTilesX + extraCols; col++) {
        const { offsetX, offsetY } = getTileOffset({
          row,
          col,
          repeatMode,
          shiftPercent,
          tileWidth: tileW,
          tileHeight: tileH,
        })

        const dx = oX + (col * tileW + offsetX) * scale
        const dy = oY + (row * tileH + offsetY) * scale
        const dw = tileW * scale
        const dh = tileH * scale

        const flipX = shouldFlipX(row, col, repeatMode)
        const flipY = shouldFlipY(row, col, repeatMode)

        if (flipX || flipY) {
          ctx.save()
          ctx.translate(dx + dw / 2, dy + dh / 2)
          ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
          ctx.drawImage(generatedTileCanvas, -dw / 2, -dh / 2, dw, dh)
          ctx.restore()
        } else {
          ctx.drawImage(generatedTileCanvas, dx, dy, dw, dh)
        }
      }
    }

    ctx.restore()

    ctx.strokeStyle = '#a186b4'
    ctx.lineWidth = 1
    ctx.strokeRect(oX, oY, drawW, drawH)
  }, [generatedTileCanvas, repeatMode, shiftPercent, previewTilesX, previewTilesY])

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

  return (
    <div className="repeat-preview" ref={containerRef}>
      <canvas ref={canvasRef} />
      {!generatedTileCanvas && (
        <div className="repeat-preview-empty">
          <span>{text.repeatPreview}</span>
        </div>
      )}
    </div>
  )
}
