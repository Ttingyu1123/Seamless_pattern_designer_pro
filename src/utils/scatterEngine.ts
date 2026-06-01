export interface ScatterConfig {
  count: number
  minDistance: number
  rotationRange: [number, number]
  scaleRange: [number, number]
  seed: number
}

export interface ScatterPosition {
  x: number
  y: number
  rotation: number
  scale: number
}

export function generateScatterPositions(
  config: ScatterConfig,
  tileWidth: number,
  tileHeight: number,
): ScatterPosition[] {
  const rng = createSeededRandom(config.seed)
  const positions: ScatterPosition[] = []
  const cellSize = config.minDistance / Math.SQRT2
  const gridW = Math.ceil(tileWidth / cellSize)
  const gridH = Math.ceil(tileHeight / cellSize)
  const grid: (ScatterPosition | null)[] = new Array(gridW * gridH).fill(null)

  const active: ScatterPosition[] = []
  const maxAttempts = 30

  const firstPoint: ScatterPosition = {
    x: rng() * tileWidth,
    y: rng() * tileHeight,
    rotation: lerp(config.rotationRange[0], config.rotationRange[1], rng()),
    scale: lerp(config.scaleRange[0], config.scaleRange[1], rng()),
  }
  positions.push(firstPoint)
  active.push(firstPoint)
  insertIntoGrid(grid, gridW, firstPoint, cellSize)

  while (active.length > 0 && positions.length < config.count) {
    const idx = Math.floor(rng() * active.length)
    const point = active[idx]
    let found = false

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = rng() * Math.PI * 2
      const dist = config.minDistance + rng() * config.minDistance
      let nx = point.x + Math.cos(angle) * dist
      let ny = point.y + Math.sin(angle) * dist

      // Wrap around for seamless tiling
      nx = ((nx % tileWidth) + tileWidth) % tileWidth
      ny = ((ny % tileHeight) + tileHeight) % tileHeight

      if (!hasNeighborInRange(grid, gridW, gridH, nx, ny, cellSize, config.minDistance, tileWidth, tileHeight)) {
        const newPoint: ScatterPosition = {
          x: nx,
          y: ny,
          rotation: lerp(config.rotationRange[0], config.rotationRange[1], rng()),
          scale: lerp(config.scaleRange[0], config.scaleRange[1], rng()),
        }
        positions.push(newPoint)
        active.push(newPoint)
        insertIntoGrid(grid, gridW, newPoint, cellSize)
        found = true
        break
      }
    }

    if (!found) {
      active.splice(idx, 1)
    }
  }

  return positions.slice(0, config.count)
}

function insertIntoGrid(
  grid: (ScatterPosition | null)[],
  gridW: number,
  point: ScatterPosition,
  cellSize: number,
) {
  const gx = Math.floor(point.x / cellSize)
  const gy = Math.floor(point.y / cellSize)
  if (gx >= 0 && gx < gridW && gy >= 0) {
    const gridH = grid.length / gridW
    if (gy < gridH) {
      grid[gy * gridW + gx] = point
    }
  }
}

function hasNeighborInRange(
  grid: (ScatterPosition | null)[],
  gridW: number,
  gridH: number,
  x: number,
  y: number,
  cellSize: number,
  minDist: number,
  tileW: number,
  tileH: number,
): boolean {
  const gx = Math.floor(x / cellSize)
  const gy = Math.floor(y / cellSize)

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = ((gx + dx) % gridW + gridW) % gridW
      const ny = ((gy + dy) % gridH + gridH) % gridH
      const neighbor = grid[ny * gridW + nx]
      if (!neighbor) continue

      // Toroidal distance for seamless wrapping
      const ddx = Math.min(
        Math.abs(x - neighbor.x),
        Math.abs(x - neighbor.x + tileW),
        Math.abs(x - neighbor.x - tileW),
      )
      const ddy = Math.min(
        Math.abs(y - neighbor.y),
        Math.abs(y - neighbor.y + tileH),
        Math.abs(y - neighbor.y - tileH),
      )

      if (ddx * ddx + ddy * ddy < minDist * minDist) {
        return true
      }
    }
  }
  return false
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function createSeededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 4294967296
  }
}
