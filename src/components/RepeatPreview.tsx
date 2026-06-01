import { useCallback, useEffect, useRef } from 'react'
import { useComposerStore } from '../store/composerStore'
import { flattenComposedTile } from '../utils/layerRenderer'
import { getTileOffset, shouldFlipX, shouldFlipY } from '../utils/tilingEngine'
import { getLayerImageCache } from '../hooks/useComposerEngine'
import type { UILang } from '../i18n'
import { composeText } from '../i18n-compose'

interface Props {
  lang: UILang
}

export function RepeatPreview({ lang }: Props) {
  const text = composeText[lang]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  const tileSizePx = useComposerStore((s) => s.tileSizePx)
  const backgroundColor = useComposerStore((s) => s.backgroundColor)
  const layers = useComposerStore((s) => s.layers)
  const repeatMode = useComposerStore((s) => s.repeatMode)
  const shiftPercent = useComposerStore((s) => s.shiftPercent)
  const tileDirection = useComposerStore((s) => s.tileDirection)
  const previewTilesX = useComposerStore((s) => s.previewTilesX)
  const previewTilesY = useComposerStore((s) => s.previewTilesY)

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

    if (layers.length === 0) return

    const imageCache = getLayerImageCache()
    const effectiveMode = tileDirection === 'horizontal' ? 'horizontal-only' as const : repeatMode
    const tile = flattenComposedTile(
      layers,
      tileSizePx.width,
      tileSizePx.height,
      backgroundColor,
      imageCache,
      effectiveMode,
      shiftPercent,
    )

    const tileW = tile.width
    const tileH = tile.height
    if (tileW < 1 || tileH < 1) return

    const tilesX = previewTilesX
    const tilesY = tileDirection === 'horizontal' ? 1 : previewTilesY

    const totalW = tileW * tilesX
    const totalH = tileH * tilesY
    const scale = Math.min((cw - 20) / totalW, (ch - 20) / totalH, 1)
    const drawW = totalW * scale
    const drawH = totalH * scale
    const oX = (cw - drawW) / 2
    const oY = (ch - drawH) / 2

    // For offset modes (half-drop, hex, diamond), draw extra tiles then clip
    const needsExtraCols = ['half-drop-row', 'half-brick', 'hexagonal', 'diamond'].includes(effectiveMode)
    const needsExtraRows = ['half-drop-column', 'diamond'].includes(effectiveMode)
    const extraCols = needsExtraCols ? 1 : 0
    const extraRows = needsExtraRows ? 1 : 0

    // Clip to the intended preview area
    ctx.save()
    ctx.beginPath()
    ctx.rect(oX, oY, drawW, drawH)
    ctx.clip()

    // Draw tiled preview (with overflow tiles for offset modes)
    for (let row = -extraRows; row < tilesY + extraRows; row++) {
      for (let col = -extraCols; col < tilesX + extraCols; col++) {
        const { offsetX, offsetY } = getTileOffset({
          row,
          col,
          repeatMode: effectiveMode,
          shiftPercent,
          tileWidth: tileW,
          tileHeight: tileH,
        })

        const dx = oX + (col * tileW + offsetX) * scale
        const dy = oY + (row * tileH + offsetY) * scale
        const dw = tileW * scale
        const dh = tileH * scale

        const flipX = shouldFlipX(row, col, effectiveMode)
        const flipY = shouldFlipY(row, col, effectiveMode)

        if (flipX || flipY) {
          ctx.save()
          ctx.translate(dx + dw / 2, dy + dh / 2)
          ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
          ctx.drawImage(tile, -dw / 2, -dh / 2, dw, dh)
          ctx.restore()
        } else {
          ctx.drawImage(tile, dx, dy, dw, dh)
        }
      }
    }

    ctx.restore() // unclip

    // Outer border
    ctx.strokeStyle = '#a186b4'
    ctx.lineWidth = 1
    ctx.strokeRect(oX, oY, drawW, drawH)
  }, [layers, tileSizePx, backgroundColor, repeatMode, shiftPercent, tileDirection, previewTilesX, previewTilesY])

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
      {layers.length === 0 && (
        <div className="repeat-preview-empty">
          <span>{text.repeatPreview}</span>
        </div>
      )}
    </div>
  )
}
