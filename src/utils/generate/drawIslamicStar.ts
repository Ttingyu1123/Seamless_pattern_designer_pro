import type { IslamicStarConfig } from '../../store/generateStore'
import {
  type Point,
  midpoint,
  normalize,
  rotateVec,
  lineIntersection,
  drawPolygon,
} from './geometryHelpers'

interface StarGeometry {
  petals: Point[][]
  strapLines: Point[][]
}

function computeStarGeometry(
  center: Point,
  radius: number,
  radiusY: number,
  n: number,
  angleParam: number,
): StarGeometry {
  const maxTheta = Math.PI / 2 - Math.PI / n
  const theta = angleParam * maxTheta * 0.95

  const vertices: Point[] = []
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
    vertices.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radiusY * Math.sin(angle),
    })
  }

  const midpoints: Point[] = []
  for (let i = 0; i < n; i++) {
    midpoints.push(midpoint(vertices[i], vertices[(i + 1) % n]))
  }

  const rays: { origin: Point; dirA: Point; dirB: Point }[] = []
  for (let i = 0; i < n; i++) {
    const edge = {
      x: vertices[(i + 1) % n].x - vertices[i].x,
      y: vertices[(i + 1) % n].y - vertices[i].y,
    }
    let inward = normalize({ x: -edge.y, y: edge.x })
    const toCenter = { x: center.x - midpoints[i].x, y: center.y - midpoints[i].y }
    if (inward.x * toCenter.x + inward.y * toCenter.y < 0) {
      inward = { x: -inward.x, y: -inward.y }
    }
    rays.push({
      origin: midpoints[i],
      dirA: rotateVec(inward, theta),
      dirB: rotateVec(inward, -theta),
    })
  }

  const intersections: (Point | null)[] = []
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    intersections.push(
      lineIntersection(rays[i].origin, rays[i].dirB, rays[next].origin, rays[next].dirA),
    )
  }

  const petals: Point[][] = []
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n
    const ip = intersections[prev]
    const ic = intersections[i]
    if (ip && ic) {
      petals.push([midpoints[prev], ip, vertices[i], ic, midpoints[i]])
    }
  }

  const strapLines: Point[][] = []
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n
    const ip = intersections[prev]
    if (ip) {
      strapLines.push([midpoints[prev], ip, midpoints[i]])
    }
  }

  return { petals, strapLines }
}

export function drawIslamicStar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  config: IslamicStarConfig,
): void {
  const { points, starAngle, lineWidth, lineColor, fillColors, backgroundColor, scale } = config

  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, w, h)

  const isHex = points === 6 || points === 12
  const cellsAcross = Math.max(1, scale)

  let colCount: number
  let dx: number
  let dy: number
  let totalRows: number
  let polyRadius: number
  let polyRadiusY: number

  if (isHex) {
    colCount = cellsAcross
    dx = w / colCount
    const r = dx / Math.sqrt(3)
    const naturalPairs = h / (3 * r)
    const rowPairs = Math.max(1, Math.round(naturalPairs))
    totalRows = rowPairs * 2
    dy = h / totalRows
    polyRadius = r * 0.98
    polyRadiusY = (dy / 1.5) * 0.98
  } else {
    colCount = cellsAcross
    dx = w / colCount
    const naturalRows = h / dx
    const rows = Math.max(1, Math.round(naturalRows))
    totalRows = rows
    dy = h / rows
    polyRadius = dx * 0.48
    polyRadiusY = dy * 0.48
  }

  // Generate grid centers with seamless alignment
  const centers: Point[] = []
  if (isHex) {
    for (let row = -1; row <= totalRows; row++) {
      const isOdd = ((row % 2) + 2) % 2 === 1
      const cols = colCount + (isOdd ? 1 : 0)
      for (let col = -1; col <= cols; col++) {
        const cx = col * dx + (isOdd ? -dx / 2 : 0)
        const cy = row * dy
        centers.push({ x: cx, y: cy })
      }
    }
  } else {
    for (let row = -1; row <= totalRows; row++) {
      for (let col = -1; col <= colCount; col++) {
        centers.push({ x: col * dx + dx / 2, y: row * dy + dy / 2 })
      }
    }
  }

  // Pass 1: fill petals
  for (const center of centers) {
    const geo = computeStarGeometry(center, polyRadius, polyRadiusY, points, starAngle)
    for (let i = 0; i < geo.petals.length; i++) {
      drawPolygon(ctx, geo.petals[i], fillColors[i % fillColors.length])
    }
  }

  // Pass 2: rosette centers
  for (const center of centers) {
    const innerR = polyRadius * (0.25 + starAngle * 0.15)
    const innerRY = polyRadiusY * (0.25 + starAngle * 0.15)
    const innerVerts: Point[] = []
    for (let i = 0; i < points; i++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / points
      innerVerts.push({
        x: center.x + innerR * Math.cos(angle),
        y: center.y + innerRY * Math.sin(angle),
      })
    }
    drawPolygon(ctx, innerVerts, fillColors[2 % fillColors.length])
  }

  // Pass 3: stroke strap lines
  ctx.strokeStyle = lineColor
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  for (const center of centers) {
    const geo = computeStarGeometry(center, polyRadius, polyRadiusY, points, starAngle)
    for (const line of geo.strapLines) {
      ctx.beginPath()
      ctx.moveTo(line[0].x, line[0].y)
      for (let j = 1; j < line.length; j++) ctx.lineTo(line[j].x, line[j].y)
      ctx.stroke()
    }
  }

  // Pass 4: polygon outlines
  for (const center of centers) {
    const verts: Point[] = []
    for (let i = 0; i < points; i++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / points
      verts.push({
        x: center.x + polyRadius * Math.cos(angle),
        y: center.y + polyRadiusY * Math.sin(angle),
      })
    }
    ctx.beginPath()
    ctx.moveTo(verts[0].x, verts[0].y)
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y)
    ctx.closePath()
    ctx.stroke()
  }
}
