import type { WeaveConfig } from '../../store/generateStore'

export function drawWeave(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  config: WeaveConfig,
): void {
  ctx.fillStyle = config.backgroundColor
  ctx.fillRect(0, 0, w, h)

  switch (config.weaveType) {
    case 'basket':
      drawBasketWeave(ctx, w, h, config)
      break
    case 'herringbone':
      drawHerringbone(ctx, w, h, config)
      break
    case 'y-hex':
      drawYHex(ctx, w, h, config)
      break
  }
}

function drawBasketWeave(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: WeaveConfig,
) {
  const cellSize = Math.min(w, h) / Math.max(2, config.scale)
  const { lineWidth, fillColors, depth } = config
  const gap = lineWidth * 0.5

  for (let row = -1; row * cellSize < h + cellSize; row++) {
    for (let col = -1; col * cellSize < w + cellSize; col++) {
      const x = col * cellSize
      const y = row * cellSize
      const isH = (row + col) % 2 === 0
      const colorIdx = isH ? 0 : 1

      ctx.fillStyle = fillColors[colorIdx]
      ctx.fillRect(x + gap, y + gap, cellSize - gap * 2, cellSize - gap * 2)

      // 3D shading
      const shade = depth * 0.3
      ctx.fillStyle = `rgba(255,255,255,${shade})`
      ctx.fillRect(x + gap, y + gap, cellSize - gap * 2, lineWidth)
      ctx.fillRect(x + gap, y + gap, lineWidth, cellSize - gap * 2)

      ctx.fillStyle = `rgba(0,0,0,${shade})`
      ctx.fillRect(x + gap, y + cellSize - gap - lineWidth, cellSize - gap * 2, lineWidth)
      ctx.fillRect(x + cellSize - gap - lineWidth, y + gap, lineWidth, cellSize - gap * 2)
    }
  }
}

function drawHerringbone(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: WeaveConfig,
) {
  const cellW = Math.min(w, h) / Math.max(2, config.scale)
  const cellH = cellW / 2
  const { lineWidth, lineColor, fillColors, depth } = config
  const gap = 1

  for (let row = -2; row * cellH < h + cellH * 2; row++) {
    for (let col = -2; col * cellW < w + cellW * 2; col++) {
      const baseX = col * cellW + (row % 2 === 0 ? 0 : cellW / 2)
      const baseY = row * cellH

      const colorIdx = (row + col) % 2 === 0 ? 0 : 1
      const shade = depth * 0.15

      // Top-right leaning brick
      ctx.save()
      ctx.translate(baseX + cellW / 2, baseY + cellH / 2)
      ctx.rotate(row % 2 === 0 ? Math.PI / 6 : -Math.PI / 6)

      ctx.fillStyle = fillColors[colorIdx]
      ctx.fillRect(-cellW / 2 + gap, -cellH / 2 + gap, cellW - gap * 2, cellH - gap * 2)

      ctx.fillStyle = `rgba(0,0,0,${shade})`
      ctx.fillRect(-cellW / 2 + gap, cellH / 2 - gap - 2, cellW - gap * 2, 2)

      ctx.strokeStyle = lineColor
      ctx.lineWidth = lineWidth * 0.5
      ctx.strokeRect(-cellW / 2 + gap, -cellH / 2 + gap, cellW - gap * 2, cellH - gap * 2)

      ctx.restore()
    }
  }
}

function drawYHex(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: WeaveConfig,
) {
  const r = Math.min(w, h) / (Math.max(2, config.scale) * 2)
  const { lineWidth, lineColor, fillColors, depth } = config
  const hexW = Math.sqrt(3) * r
  const hexH = 2 * r

  // Background hex grid
  for (let row = -2; row * (hexH * 0.75) < h + hexH; row++) {
    for (let col = -2; col * hexW < w + hexW; col++) {
      const cx = col * hexW + (row % 2 === 0 ? 0 : hexW / 2)
      const cy = row * (hexH * 0.75)

      ctx.fillStyle = fillColors[0]
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        const px = cx + r * Math.cos(angle)
        const py = cy + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
    }
  }

  // Y-shaped arms at each hex center
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let row = -2; row * (hexH * 0.75) < h + hexH; row++) {
    for (let col = -2; col * hexW < w + hexW; col++) {
      const cx = col * hexW + (row % 2 === 0 ? 0 : hexW / 2)
      const cy = row * (hexH * 0.75)
      const armLen = r * 0.75

      for (let arm = 0; arm < 3; arm++) {
        const angle = (Math.PI * 2 * arm) / 3 - Math.PI / 2
        const ex = cx + armLen * Math.cos(angle)
        const ey = cy + armLen * Math.sin(angle)

        // Shadow for depth
        const shadowShade = depth * 0.4 * ((arm + 1) / 3)
        ctx.strokeStyle = `rgba(0,0,0,${shadowShade})`
        ctx.lineWidth = lineWidth + 2
        ctx.beginPath()
        ctx.moveTo(cx + 1, cy + 1)
        ctx.lineTo(ex + 1, ey + 1)
        ctx.stroke()

        // Main arm
        ctx.strokeStyle = fillColors[1]
        ctx.lineWidth = lineWidth
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
      }

      // Center dot
      ctx.fillStyle = fillColors[1]
      ctx.beginPath()
      ctx.arc(cx, cy, lineWidth * 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Outline hex edges
  ctx.strokeStyle = lineColor
  ctx.lineWidth = lineWidth * 0.3
  for (let row = -2; row * (hexH * 0.75) < h + hexH; row++) {
    for (let col = -2; col * hexW < w + hexW; col++) {
      const cx = col * hexW + (row % 2 === 0 ? 0 : hexW / 2)
      const cy = row * (hexH * 0.75)
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        const px = cx + r * Math.cos(angle)
        const py = cy + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    }
  }
}
