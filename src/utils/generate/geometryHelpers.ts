export interface Point {
  x: number
  y: number
}

export function rotatePoint(p: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = p.x - center.x
  const dy = p.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function normalize(v: Point): Point {
  const len = Math.sqrt(v.x * v.x + v.y * v.y)
  if (len < 1e-10) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y
}

export function rotateVec(v: Point, angle: number): Point {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos }
}

export function lineIntersection(
  p1: Point, d1: Point,
  p2: Point, d2: Point,
): Point | null {
  const cross = d1.x * d2.y - d1.y * d2.x
  if (Math.abs(cross) < 1e-10) return null
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const t = (dx * d2.y - dy * d2.x) / cross
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y }
}

export function regularPolygonVertices(center: Point, radius: number, n: number, startAngle = -Math.PI / 2): Point[] {
  const vertices: Point[] = []
  for (let i = 0; i < n; i++) {
    const angle = startAngle + (2 * Math.PI * i) / n
    vertices.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    })
  }
  return vertices
}

export function generateHexGrid(
  width: number,
  height: number,
  cellRadius: number,
): Point[] {
  const centers: Point[] = []
  const dx = cellRadius * Math.sqrt(3)
  const dy = cellRadius * 1.5
  const colCount = Math.ceil(width / dx) + 4
  const rowCount = Math.ceil(height / dy) + 4

  for (let row = -2; row < rowCount; row++) {
    for (let col = -2; col < colCount; col++) {
      const x = col * dx + (row % 2 === 0 ? 0 : dx / 2)
      const y = row * dy
      centers.push({ x, y })
    }
  }
  return centers
}

export function generateSquareGrid(
  width: number,
  height: number,
  cellSize: number,
): Point[] {
  const centers: Point[] = []
  const count = Math.ceil(Math.max(width, height) / cellSize) + 4
  for (let row = -2; row < count; row++) {
    for (let col = -2; col < count; col++) {
      centers.push({ x: col * cellSize, y: row * cellSize })
    }
  }
  return centers
}

export function drawPolygon(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  fillStyle?: string,
  strokeStyle?: string,
  lineWidth?: number,
): void {
  if (points.length < 3) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.closePath()
  if (fillStyle) {
    ctx.fillStyle = fillStyle
    ctx.fill()
  }
  if (strokeStyle && lineWidth) {
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
}
