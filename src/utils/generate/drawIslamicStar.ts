import type { IslamicStarConfig } from '../../store/generateStore'
import {
  type Point,
  regularPolygonVertices,
  midpoint,
  normalize,
  rotateVec,
  lineIntersection,
  generateHexGrid,
  generateSquareGrid,
  drawPolygon,
} from './geometryHelpers'

interface StarGeometry {
  petals: Point[][]
  strapLines: Point[][]
}

function computeStarGeometry(
  center: Point,
  radius: number,
  n: number,
  angleParam: number,
): StarGeometry {
  const maxTheta = Math.PI / 2 - Math.PI / n
  const theta = angleParam * maxTheta * 0.95

  const vertices = regularPolygonVertices(center, radius, n)
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

  let centers: Point[]
  let cellRadius: number

  if (isHex) {
    cellRadius = w / (cellsAcross * Math.sqrt(3))
    centers = generateHexGrid(w, h, cellRadius)
  } else {
    cellRadius = w / (cellsAcross * 2)
    centers = generateSquareGrid(w, h, cellRadius * 2)
  }

  const polyRadius = isHex ? cellRadius * 0.98 : cellRadius * 0.98

  // Pass 1: fill petals
  for (const center of centers) {
    const geo = computeStarGeometry(center, polyRadius, points, starAngle)

    for (let i = 0; i < geo.petals.length; i++) {
      const colorIdx = i % fillColors.length
      drawPolygon(ctx, geo.petals[i], fillColors[colorIdx])
    }
  }

  // Pass 2: fill rosette centers
  for (const center of centers) {
    const innerR = polyRadius * (0.25 + starAngle * 0.15)
    const innerVerts = regularPolygonVertices(center, innerR, points)
    drawPolygon(ctx, innerVerts, fillColors[2 % fillColors.length])
  }

  // Pass 3: stroke all strap lines
  ctx.strokeStyle = lineColor
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  for (const center of centers) {
    const geo = computeStarGeometry(center, polyRadius, points, starAngle)

    for (const line of geo.strapLines) {
      ctx.beginPath()
      ctx.moveTo(line[0].x, line[0].y)
      for (let j = 1; j < line.length; j++) {
        ctx.lineTo(line[j].x, line[j].y)
      }
      ctx.stroke()
    }
  }

  // Pass 4: outline each polygon
  for (const center of centers) {
    const verts = regularPolygonVertices(center, polyRadius, points)
    ctx.beginPath()
    ctx.moveTo(verts[0].x, verts[0].y)
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x, verts[i].y)
    }
    ctx.closePath()
    ctx.stroke()
  }
}
