export interface PaletteColor {
  r: number
  g: number
  b: number
  hex: string
  percent: number
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}

function colorDistance(a: number[], b: number[]): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

function kMeans(pixels: number[][], k: number, maxIter = 20): number[][] {
  const centers = pixels.slice(0, k).map(p => [...p])

  for (let iter = 0; iter < maxIter; iter++) {
    const clusters: number[][][] = Array.from({ length: k }, () => [])
    for (const px of pixels) {
      let minDist = Infinity
      let closest = 0
      for (let i = 0; i < k; i++) {
        const d = colorDistance(px, centers[i])
        if (d < minDist) { minDist = d; closest = i }
      }
      clusters[closest].push(px)
    }

    let converged = true
    for (let i = 0; i < k; i++) {
      const cl = clusters[i]
      if (cl.length === 0) continue
      const avg = [0, 0, 0]
      for (const px of cl) { avg[0] += px[0]; avg[1] += px[1]; avg[2] += px[2] }
      const newCenter = [Math.round(avg[0] / cl.length), Math.round(avg[1] / cl.length), Math.round(avg[2] / cl.length)]
      if (colorDistance(newCenter, centers[i]) > 4) converged = false
      centers[i] = newCenter
    }
    if (converged) break
  }

  return centers
}

export function extractPalette(canvas: HTMLCanvasElement, maxColors = 8): PaletteColor[] {
  const sampleSize = 128
  const sample = document.createElement('canvas')
  sample.width = sampleSize
  sample.height = sampleSize
  const ctx = sample.getContext('2d')
  if (!ctx) return []

  ctx.drawImage(canvas, 0, 0, sampleSize, sampleSize)
  const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize)
  const data = imageData.data

  const pixels: number[][] = []
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    pixels.push([data[i], data[i + 1], data[i + 2]])
  }

  if (pixels.length === 0) return []

  const shuffled = pixels.slice()
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (i * 16807 + 1) % (i + 1)
    const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp
  }

  const k = Math.min(maxColors, Math.max(2, Math.ceil(Math.sqrt(pixels.length / 100))))
  const centers = kMeans(shuffled.slice(0, 2000), k)

  const counts = new Array(k).fill(0)
  for (const px of pixels) {
    let minDist = Infinity
    let closest = 0
    for (let i = 0; i < centers.length; i++) {
      const d = colorDistance(px, centers[i])
      if (d < minDist) { minDist = d; closest = i }
    }
    counts[closest]++
  }

  const total = pixels.length
  const result: PaletteColor[] = centers
    .map((c, i) => ({
      r: c[0], g: c[1], b: c[2],
      hex: rgbToHex(c[0], c[1], c[2]),
      percent: Math.round((counts[i] / total) * 100),
    }))
    .filter(c => c.percent >= 1)
    .sort((a, b) => b.percent - a.percent)

  return result
}
