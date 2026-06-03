import type { TessellationConfig } from '../../store/generateStore'

export function drawTessellation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  config: TessellationConfig,
): void {
  ctx.fillStyle = config.backgroundColor
  ctx.fillRect(0, 0, w, h)

  switch (config.tessType) {
    case 'square':
      drawSquareTessellation(ctx, w, h, config)
      break
    case 'hexagonal':
      drawHexTessellation(ctx, w, h, config)
      break
    case 'triangular':
      drawTriangleTessellation(ctx, w, h, config)
      break
    case '3.6.3.6':
      drawTriHexTessellation(ctx, w, h, config)
      break
    case '3.3.4.3.4':
      drawSnubSquareTessellation(ctx, w, h, config)
      break
  }
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

function lcm(a: number, b: number): number {
  const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y))
  return (a * b) / gcd(a, b)
}

function snapToMultiple(value: number, multiple: number, min: number): number {
  return Math.max(min, Math.round(value / multiple) * multiple)
}

function drawHexAt(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, rY: number,
  fillStyle: string, strokeStyle: string, lineWidth: number,
) {
  ctx.fillStyle = fillStyle
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
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
  ctx.stroke()
}

// ── Square ──

function drawSquareTessellation(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: TessellationConfig,
) {
  const N = config.fillColors.length
  const cols = snapToMultiple(Math.max(2, config.scale), N, N)
  const cellW = w / cols
  const rows = snapToMultiple(Math.max(1, Math.round(h / cellW)), N, N)
  const cellH = h / rows
  const { strokeWidth, strokeColor, fillColors } = config

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillStyle = fillColors[mod(col + row, N)]
      ctx.fillRect(col * cellW, row * cellH, cellW + 0.5, cellH + 0.5)
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.strokeRect(col * cellW, row * cellH, cellW, cellH)
    }
  }
}

// ── Hexagonal ──

function drawHexTessellation(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: TessellationConfig,
) {
  const { strokeWidth, strokeColor, fillColors } = config
  const N = fillColors.length

  // colCount must be multiple of N so column-based coloring wraps
  const colCount = snapToMultiple(Math.max(2, config.scale), N, N)
  const hexW = w / colCount
  const r = hexW / Math.sqrt(3)

  // totalRows must be even (hex grid) AND multiple of N
  const period = lcm(2, N)
  const naturalPairs = h / (3 * r)
  const totalRows = snapToMultiple(Math.max(1, Math.round(naturalPairs)) * 2, period, period)
  const rowSpacing = h / totalRows
  const rY = rowSpacing / 1.5

  for (let row = -1; row <= totalRows; row++) {
    const isOddRow = mod(row, 2) === 1
    for (let col = -1; col <= colCount; col++) {
      const cx = col * hexW + (isOddRow ? hexW / 2 : 0)
      const cy = row * rowSpacing

      // Seamless color: mod(canonicalRow + canonicalCol, N)
      const cr = mod(row, totalRows)
      const cc = mod(col, colCount)
      const colorIdx = mod(cr + cc, N)

      drawHexAt(ctx, cx, cy, r, rY, fillColors[colorIdx], strokeColor, strokeWidth)
    }
  }
}

// ── Triangular ──

function drawTriangleTessellation(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: TessellationConfig,
) {
  const { strokeWidth, strokeColor, fillColors } = config
  const N = fillColors.length
  const cols = snapToMultiple(Math.max(2, config.scale) * 2, N, N)
  const halfW = w / cols
  const naturalRows = h / (halfW * Math.sqrt(3))
  const rows = snapToMultiple(Math.max(1, Math.round(naturalRows)), N, N)
  const triH = h / rows

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * halfW
      const y0 = row * triH
      const up = mod(row + col, 2) === 0

      ctx.fillStyle = fillColors[mod(row + col, N)]
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth

      ctx.beginPath()
      if (up) {
        ctx.moveTo(x0, y0 + triH)
        ctx.lineTo(x0 + halfW, y0)
        ctx.lineTo(x0 + halfW * 2, y0 + triH)
      } else {
        ctx.moveTo(x0, y0)
        ctx.lineTo(x0 + halfW * 2, y0)
        ctx.lineTo(x0 + halfW, y0 + triH)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }
}

// ── 3.6.3.6 (Trihexagonal) ──

function drawTriHexTessellation(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: TessellationConfig,
) {
  const { strokeWidth, strokeColor, fillColors } = config
  const N = fillColors.length
  const colCount = snapToMultiple(Math.max(2, config.scale), N, N)
  const hexW = w / colCount
  const r = hexW / Math.sqrt(3)

  const period = lcm(2, N)
  const naturalPairs = h / (3 * r)
  const totalRows = snapToMultiple(Math.max(1, Math.round(naturalPairs)) * 2, period, period)
  const rowSpacing = h / totalRows
  const rY = rowSpacing / 1.5

  const innerScale = 0.7
  const rInner = r * innerScale
  const rYInner = rY * innerScale

  for (let row = -1; row <= totalRows; row++) {
    const isOddRow = mod(row, 2) === 1
    for (let col = -1; col <= colCount; col++) {
      const cx = col * hexW + (isOddRow ? hexW / 2 : 0)
      const cy = row * rowSpacing

      drawHexAt(ctx, cx, cy, rInner, rYInner, fillColors[0], strokeColor, strokeWidth)

      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        const nextAngle = (Math.PI / 3) * ((i + 1) % 6) - Math.PI / 6
        const tipAngle = (angle + nextAngle) / 2

        const ix = cx + rInner * Math.cos(angle)
        const iy = cy + rYInner * Math.sin(angle)
        const inx = cx + rInner * Math.cos(nextAngle)
        const iny = cy + rYInner * Math.sin(nextAngle)
        const tx = cx + r * Math.cos(tipAngle)
        const ty = cy + rY * Math.sin(tipAngle)

        ctx.fillStyle = fillColors[(i + 1) % N]
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = strokeWidth
        ctx.beginPath()
        ctx.moveTo(ix, iy)
        ctx.lineTo(inx, iny)
        ctx.lineTo(tx, ty)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
    }
  }
}

// ── 3.3.4.3.4 (Snub Square) ──

function drawSnubSquareTessellation(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: TessellationConfig,
) {
  const N = config.fillColors.length
  const cols = snapToMultiple(Math.max(2, config.scale), lcm(2, N), lcm(2, N))
  const cellW = w / cols
  const rows = snapToMultiple(Math.max(1, Math.round(h / cellW)), lcm(2, N), lcm(2, N))
  const cellH = h / rows
  const { strokeWidth, strokeColor, fillColors } = config
  const triOff = cellW * 0.22

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellW
      const y = row * cellH
      const rotated = mod(row + col, 2) !== 0

      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth

      if (rotated) {
        ctx.save()
        ctx.translate(x + cellW / 2, y + cellH / 2)
        ctx.rotate(Math.PI / 6)
        ctx.fillStyle = fillColors[2 % N]
        ctx.fillRect(-cellW * 0.3, -cellH * 0.3, cellW * 0.6, cellH * 0.6)
        ctx.strokeRect(-cellW * 0.3, -cellH * 0.3, cellW * 0.6, cellH * 0.6)
        ctx.restore()
      } else {
        ctx.fillStyle = fillColors[0]
        ctx.fillRect(x + triOff, y + triOff, cellW - triOff * 2, cellH - triOff * 2)
        ctx.strokeRect(x + triOff, y + triOff, cellW - triOff * 2, cellH - triOff * 2)
      }

      ctx.fillStyle = fillColors[1 % N]
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + triOff, y)
      ctx.lineTo(x, y + triOff)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }
}
