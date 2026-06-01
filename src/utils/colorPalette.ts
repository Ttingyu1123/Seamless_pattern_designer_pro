export interface PaletteColor {
  r: number
  g: number
  b: number
  hex: string
  percent: number
}

type RGB = [number, number, number]
interface Hsv { h: number; s: number; v: number }
interface Candidate { rgb: RGB; score: number; hsv: Hsv; bucket: string; pixelCount: number }

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rr = r / 255, gg = g / 255, bb = b / 255
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d + 6) % 6 / 6
    else if (max === gg) h = ((bb - rr) / d + 2) / 6
    else h = ((rr - gg) / d + 4) / 6
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

const HUE_BUCKETS: { name: string; test: (h: number, s: number, v: number) => boolean }[] = [
  { name: 'neutral', test: (_h, s) => s < 0.06 },
  { name: 'pink',    test: (h, s, v) => s >= 0.06 && v > 0.55 && (h > 0.9 || h < 0.05) },
  { name: 'warm',    test: (h, s, v) => s >= 0.06 && (h < 0.12 || h >= 0.9) && !(v > 0.55 && (h > 0.9 || h < 0.05)) },
  { name: 'yellow',  test: (h, s) => s >= 0.06 && h >= 0.12 && h < 0.22 },
  { name: 'green',   test: (h, s) => s >= 0.06 && h >= 0.22 && h < 0.47 },
  { name: 'cyan',    test: (h, s) => s >= 0.06 && h >= 0.47 && h < 0.55 },
  { name: 'blue',    test: (h, s) => s >= 0.06 && h >= 0.55 && h < 0.72 },
  { name: 'purple',  test: (h, s) => s >= 0.06 && h >= 0.72 && h < 0.9 },
]

function distSq(a: number[], b: number[]): number {
  let d = 0
  for (let i = 0; i < a.length; i++) d += (a[i] - b[i]) ** 2
  return d
}

function kmeansHsv(pixelRgbs: RGB[], pixelHsvs: Hsv[], k: number, maxIter = 20) {
  const n = pixelRgbs.length
  if (n === 0 || k === 0) return []
  k = Math.min(k, n)

  const features = pixelHsvs.map(({ h, s, v }) => [h * 360, s * 200, v * 255])

  const centers: number[][] = []
  const pick = (seed: number) => Math.abs(seed) % n
  centers.push([...features[pick(n * 7 + 3)]])
  for (let c = 1; c < k; c++) {
    const dists = features.map(f => {
      let minD = Infinity
      for (const ctr of centers) minD = Math.min(minD, distSq(f, ctr))
      return minD
    })
    const total = dists.reduce((a, b) => a + b, 0)
    let r = (((c * 2654435761) >>> 0) / 4294967296) * total
    for (let i = 0; i < n; i++) {
      r -= dists[i]
      if (r <= 0) { centers.push([...features[i]]); break }
    }
    if (centers.length <= c) centers.push([...features[pick(c * 31 + 17)]])
  }

  const labels = new Int32Array(n)

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false
    for (let i = 0; i < n; i++) {
      let best = 0, bestDist = Infinity
      for (let c = 0; c < k; c++) {
        const d = distSq(features[i], centers[c])
        if (d < bestDist) { bestDist = d; best = c }
      }
      if (labels[i] !== best) { labels[i] = best; changed = true }
    }
    if (!changed) break

    const sums = Array.from({ length: k }, () => [0, 0, 0])
    const counts = new Int32Array(k)
    for (let i = 0; i < n; i++) {
      const c = labels[i]
      sums[c][0] += features[i][0]
      sums[c][1] += features[i][1]
      sums[c][2] += features[i][2]
      counts[c]++
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centers[c] = [sums[c][0] / counts[c], sums[c][1] / counts[c], sums[c][2] / counts[c]]
      }
    }
  }

  const groups: { center: RGB; indices: number[] }[] = []
  for (let c = 0; c < k; c++) {
    const indices: number[] = []
    let rSum = 0, gSum = 0, bSum = 0
    for (let i = 0; i < n; i++) {
      if (labels[i] === c) {
        indices.push(i)
        rSum += pixelRgbs[i][0]
        gSum += pixelRgbs[i][1]
        bSum += pixelRgbs[i][2]
      }
    }
    const cnt = indices.length || 1
    groups.push({ center: [Math.round(rSum / cnt), Math.round(gSum / cnt), Math.round(bSum / cnt)], indices })
  }
  return groups
}

export function extractPalette(canvas: HTMLCanvasElement, maxColors = 8): PaletteColor[] {
  const sampleSize = 300
  const sample = document.createElement('canvas')
  const sw = Math.min(sampleSize, canvas.width)
  const sh = Math.round(canvas.height * (sw / canvas.width))
  sample.width = sw
  sample.height = sh
  const ctx = sample.getContext('2d')
  if (!ctx) return []

  ctx.drawImage(canvas, 0, 0, sw, sh)
  const imageData = ctx.getImageData(0, 0, sw, sh)
  const { data } = imageData
  const totalPixels = sw * sh

  const rgbs: RGB[] = new Array(totalPixels)
  const hsvs: Hsv[] = new Array(totalPixels)
  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4
    if (data[off + 3] < 128) {
      rgbs[i] = [255, 255, 255]
      hsvs[i] = { h: 0, s: 0, v: 1 }
      continue
    }
    const r = data[off], g = data[off + 1], b = data[off + 2]
    rgbs[i] = [r, g, b]
    hsvs[i] = rgbToHsv(r, g, b)
  }

  const buckets: Record<string, number[]> = {}
  for (const { name } of HUE_BUCKETS) buckets[name] = []
  for (let i = 0; i < totalPixels; i++) {
    const { h, s, v } = hsvs[i]
    for (const { name, test } of HUE_BUCKETS) {
      if (test(h, s, v)) { buckets[name].push(i); break }
    }
  }

  const candidates: Candidate[] = []
  for (const { name } of HUE_BUCKETS) {
    const indices = buckets[name]
    if (indices.length < 20) continue
    const bRgbs = indices.map(i => rgbs[i])
    const bHsvs = indices.map(i => hsvs[i])
    const nSub = Math.min(5, Math.max(2, Math.floor(indices.length / 300)))
    const groups = kmeansHsv(bRgbs, bHsvs, nSub)
    for (const g of groups) {
      const hsv = rgbToHsv(g.center[0], g.center[1], g.center[2])
      const area = g.indices.length / totalPixels
      const brightBonus = name === 'pink' ? hsv.v * 0.15 : 0
      const score = area + hsv.s * 0.15 + brightBonus
      candidates.push({ rgb: g.center, score, hsv, bucket: name, pixelCount: g.indices.length })
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  const activeBuckets = Object.entries(buckets).filter(([, v]) => v.length >= 20)
  const avgBucketSize = totalPixels / Math.max(1, activeBuckets.length)

  const selected: Candidate[] = []
  const bucketCounts: Record<string, number> = {}

  for (const cand of candidates) {
    if (selected.length >= maxColors) break
    const used = bucketCounts[cand.bucket] || 0
    const maxPer = (buckets[cand.bucket]?.length || 0) > avgBucketSize * 1.5 ? 2 : 1
    if (used < maxPer) {
      if (used > 0) {
        const tooClose = selected.some(s =>
          s.bucket === cand.bucket &&
          Math.abs(cand.rgb[0] - s.rgb[0]) + Math.abs(cand.rgb[1] - s.rgb[1]) + Math.abs(cand.rgb[2] - s.rgb[2]) < 60
        )
        if (tooClose) continue
      }
      selected.push(cand)
      bucketCounts[cand.bucket] = used + 1
    }
  }

  for (const cand of candidates) {
    if (selected.length >= maxColors) break
    if (selected.includes(cand)) continue
    const tooClose = selected.some(s =>
      Math.abs(cand.rgb[0] - s.rgb[0]) + Math.abs(cand.rgb[1] - s.rgb[1]) + Math.abs(cand.rgb[2] - s.rgb[2]) < 40
    )
    if (!tooClose) selected.push(cand)
  }

  for (const cand of candidates) {
    if (selected.length >= maxColors) break
    if (!selected.includes(cand)) selected.push(cand)
  }

  const totalSelected = selected.reduce((sum, c) => sum + c.pixelCount, 0)
  const result: PaletteColor[] = selected
    .map(c => ({
      r: c.rgb[0], g: c.rgb[1], b: c.rgb[2],
      hex: rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]),
      percent: Math.max(1, Math.round((c.pixelCount / totalSelected) * 100)),
    }))

  result.sort((a, b) => b.percent - a.percent)
  return result
}
