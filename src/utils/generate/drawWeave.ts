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

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

// ── Basket ──

function drawBasketWeave(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: WeaveConfig,
) {
  const cols = Math.max(2, config.scale)
  const cellW = w / cols
  const rows = Math.max(1, Math.round(h / cellW))
  const cellH = h / rows
  const { lineWidth, fillColors, depth } = config
  const gap = lineWidth * 0.5

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellW
      const y = row * cellH
      const isH = mod(row + col, 2) === 0

      ctx.fillStyle = fillColors[isH ? 0 : 1]
      ctx.fillRect(x + gap, y + gap, cellW - gap * 2, cellH - gap * 2)

      const shade = depth * 0.3
      ctx.fillStyle = `rgba(255,255,255,${shade})`
      ctx.fillRect(x + gap, y + gap, cellW - gap * 2, lineWidth)
      ctx.fillRect(x + gap, y + gap, lineWidth, cellH - gap * 2)

      ctx.fillStyle = `rgba(0,0,0,${shade})`
      ctx.fillRect(x + gap, y + cellH - gap - lineWidth, cellW - gap * 2, lineWidth)
      ctx.fillRect(x + cellW - gap - lineWidth, y + gap, lineWidth, cellH - gap * 2)
    }
  }
}

// ── Herringbone ──

function drawHerringbone(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: WeaveConfig,
) {
  const cols = Math.max(2, config.scale)
  const cellW = w / cols
  const cellH = cellW / 2
  const rows = Math.max(1, Math.round(h / cellH))
  const actualCellH = h / rows
  const { lineWidth, lineColor, fillColors, depth } = config
  const gap = 1

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols + 1; col++) {
      const baseX = col * cellW + (mod(row, 2) === 0 ? 0 : cellW / 2)
      const baseY = row * actualCellH

      const colorIdx = mod(row + col, 2)
      const shade = depth * 0.15

      ctx.save()
      ctx.translate(baseX + cellW / 2, baseY + actualCellH / 2)
      ctx.rotate(mod(row, 2) === 0 ? Math.PI / 6 : -Math.PI / 6)

      ctx.fillStyle = fillColors[colorIdx]
      ctx.fillRect(-cellW / 2 + gap, -actualCellH / 2 + gap, cellW - gap * 2, actualCellH - gap * 2)

      ctx.fillStyle = `rgba(0,0,0,${shade})`
      ctx.fillRect(-cellW / 2 + gap, actualCellH / 2 - gap - 2, cellW - gap * 2, 2)

      ctx.strokeStyle = lineColor
      ctx.lineWidth = lineWidth * 0.5
      ctx.strokeRect(-cellW / 2 + gap, -actualCellH / 2 + gap, cellW - gap * 2, actualCellH - gap * 2)

      ctx.restore()
    }
  }
}

// ── Y-Hex ──

function drawYHex(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: WeaveConfig,
) {
  const { lineWidth, lineColor, fillColors, depth } = config
  const colCount = Math.max(2, config.scale)
  const hexW = w / colCount
  const r = hexW / Math.sqrt(3)

  const naturalPairs = h / (3 * r)
  const rowPairs = Math.max(1, Math.round(naturalPairs))
  const totalRows = rowPairs * 2
  const rowSpacing = h / totalRows
  const rY = rowSpacing / 1.5

  // Collect all hex centers
  const allCenters: { cx: number; cy: number }[] = []
  for (let row = -1; row <= totalRows; row++) {
    const isOdd = mod(row, 2) === 1
    const cols = colCount + (isOdd ? 1 : 0)
    for (let col = -1; col <= cols; col++) {
      const cx = col * hexW + (isOdd ? -hexW / 2 : 0)
      const cy = row * rowSpacing
      allCenters.push({ cx, cy })
    }
  }

  // Pass 1: fill hex backgrounds
  for (const { cx, cy } of allCenters) {
    ctx.fillStyle = fillColors[0]
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6
      const px = cx + r * Math.cos(angle)
      const py = cy + rY * Math.sin(angle)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  }

  // Pass 2: Y-shaped arms
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const armLen = Math.min(r, rY) * 0.72

  for (const { cx, cy } of allCenters) {
    for (let arm = 0; arm < 3; arm++) {
      const angle = (Math.PI * 2 * arm) / 3 - Math.PI / 2
      const ex = cx + armLen * Math.cos(angle)
      const ey = cy + armLen * Math.sin(angle)

      const shadowShade = depth * 0.4 * ((arm + 1) / 3)
      ctx.strokeStyle = `rgba(0,0,0,${shadowShade})`
      ctx.lineWidth = lineWidth + 2
      ctx.beginPath()
      ctx.moveTo(cx + 1, cy + 1)
      ctx.lineTo(ex + 1, ey + 1)
      ctx.stroke()

      ctx.strokeStyle = fillColors[1]
      ctx.lineWidth = lineWidth
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
    }

    ctx.fillStyle = fillColors[1]
    ctx.beginPath()
    ctx.arc(cx, cy, lineWidth * 0.8, 0, Math.PI * 2)
    ctx.fill()
  }

  // Pass 3: hex outlines
  ctx.strokeStyle = lineColor
  ctx.lineWidth = lineWidth * 0.3
  for (const { cx, cy } of allCenters) {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6
      const px = cx + r * Math.cos(angle)
      const py = cy + rY * Math.sin(angle)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
  }
}
