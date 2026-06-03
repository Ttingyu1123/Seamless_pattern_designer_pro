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

function drawSquareTessellation(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: TessellationConfig,
) {
  const cellSize = Math.min(w, h) / Math.max(2, config.scale)
  const { strokeWidth, strokeColor, fillColors } = config

  for (let row = -1; row * cellSize < h + cellSize; row++) {
    for (let col = -1; col * cellSize < w + cellSize; col++) {
      const x = col * cellSize
      const y = row * cellSize
      ctx.fillStyle = fillColors[((col % 2 + 2) % 2 + (row % 2 + 2) % 2) % fillColors.length]
      ctx.fillRect(x, y, cellSize, cellSize)
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.strokeRect(x, y, cellSize, cellSize)
    }
  }
}

function drawHexTessellation(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: TessellationConfig,
) {
  const r = Math.min(w, h) / (Math.max(2, config.scale) * 2)
  const { strokeWidth, strokeColor, fillColors } = config
  const hexW = Math.sqrt(3) * r
  const hexH = 2 * r

  let colorIdx = 0
  for (let row = -2; row * (hexH * 0.75) < h + hexH; row++) {
    for (let col = -2; col * hexW < w + hexW; col++) {
      const cx = col * hexW + (row % 2 === 0 ? 0 : hexW / 2)
      const cy = row * (hexH * 0.75)

      ctx.fillStyle = fillColors[colorIdx % fillColors.length]
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth

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
      ctx.stroke()
      colorIdx++
    }
  }
}

function drawTriangleTessellation(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: TessellationConfig,
) {
  const cellSize = Math.min(w, h) / Math.max(2, config.scale)
  const triH = cellSize * Math.sqrt(3) / 2
  const { strokeWidth, strokeColor, fillColors } = config

  for (let row = -1; row * triH < h + triH; row++) {
    for (let col = -2; (col * cellSize / 2) < w + cellSize; col++) {
      const x0 = col * (cellSize / 2)
      const y0 = row * triH
      const up = (row + col) % 2 === 0

      ctx.fillStyle = fillColors[up ? 0 : 1 % fillColors.length]
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth

      ctx.beginPath()
      if (up) {
        ctx.moveTo(x0, y0 + triH)
        ctx.lineTo(x0 + cellSize / 2, y0)
        ctx.lineTo(x0 + cellSize, y0 + triH)
      } else {
        ctx.moveTo(x0, y0)
        ctx.lineTo(x0 + cellSize, y0)
        ctx.lineTo(x0 + cellSize / 2, y0 + triH)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }
}

function drawTriHexTessellation(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: TessellationConfig,
) {
  const r = Math.min(w, h) / (Math.max(2, config.scale) * 2)
  const { strokeWidth, strokeColor, fillColors } = config
  const hexW = Math.sqrt(3) * r
  const hexH = 2 * r

  for (let row = -2; row * (hexH * 0.75) < h + hexH; row++) {
    for (let col = -2; col * hexW < w + hexW; col++) {
      const cx = col * hexW + (row % 2 === 0 ? 0 : hexW / 2)
      const cy = row * (hexH * 0.75)

      // Hexagon
      const hexVerts: { x: number; y: number }[] = []
      ctx.fillStyle = fillColors[0]
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        const px = cx + r * 0.7 * Math.cos(angle)
        const py = cy + r * 0.7 * Math.sin(angle)
        hexVerts.push({ x: px, y: py })
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Triangles between hexagons
      for (let i = 0; i < 6; i++) {
        const outerAngle = (Math.PI / 3) * i - Math.PI / 6
        const tipX = cx + r * Math.cos(outerAngle)
        const tipY = cy + r * Math.sin(outerAngle)

        ctx.fillStyle = fillColors[(i + 1) % fillColors.length]
        ctx.beginPath()
        ctx.moveTo(hexVerts[i].x, hexVerts[i].y)
        ctx.lineTo(hexVerts[(i + 1) % 6].x, hexVerts[(i + 1) % 6].y)
        ctx.lineTo(tipX, tipY)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
    }
  }
}

function drawSnubSquareTessellation(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  config: TessellationConfig,
) {
  const cellSize = Math.min(w, h) / Math.max(2, config.scale)
  const { strokeWidth, strokeColor, fillColors } = config
  const s = cellSize
  const triOffset = s * 0.28

  for (let row = -1; row * s < h + s; row++) {
    for (let col = -1; col * s < w + s; col++) {
      const x = col * s
      const y = row * s
      const rotated = (row + col) % 2 !== 0

      // Square
      ctx.fillStyle = fillColors[0]
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth

      if (rotated) {
        ctx.save()
        ctx.translate(x + s / 2, y + s / 2)
        ctx.rotate(Math.PI / 6)
        ctx.fillRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7)
        ctx.strokeRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7)
        ctx.restore()
      } else {
        ctx.fillRect(x + triOffset, y + triOffset, s - triOffset * 2, s - triOffset * 2)
        ctx.strokeRect(x + triOffset, y + triOffset, s - triOffset * 2, s - triOffset * 2)
      }

      // Corner triangles
      ctx.fillStyle = fillColors[1 % fillColors.length]
      const corners = [
        [x, y], [x + s, y], [x + s, y + s], [x, y + s],
      ]
      for (const [cx, cy] of corners) {
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + (cx === x ? triOffset : -triOffset), cy)
        ctx.lineTo(cx, cy + (cy === y ? triOffset : -triOffset))
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
    }
  }
}
