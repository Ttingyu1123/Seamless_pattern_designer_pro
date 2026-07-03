// Pure seam-quality math over a raw RGBA buffer. No DOM/canvas dependency,
// so it runs identically in the browser and in Node tests.
// scripts/batch_seam_test.py implements the same algorithm in Python;
// tests/fixtures/expected.json pins both to the same grades.

export interface SeamMetrics {
  leftRightDiffs: number[]
  topBottomDiffs: number[]
  maxDiff: number
  avgLeftRight: number
  avgTopBottom: number
  lapRatioLR: number
  lapRatioTB: number
  lapRatio: number
  ssimSeamLR: number
  ssimSeamTB: number
  ssimRatio: number
  combinedRatio: number
}

export type SeamGrade = 'S' | 'A' | 'B' | 'C' | 'F'

// Keep in sync with scripts/batch_seam_test.py
export const SEAM_GRADE_THRESHOLDS: Array<{ grade: SeamGrade; max: number }> = [
  { grade: 'S', max: 1.5 },
  { grade: 'A', max: 1.75 },
  { grade: 'B', max: 2.5 },
  { grade: 'C', max: 4.0 },
  { grade: 'F', max: Infinity },
]

export function gradeFromRatio(ratio: number): SeamGrade {
  for (const { grade, max } of SEAM_GRADE_THRESHOLDS) {
    if (ratio <= max) return grade
  }
  return 'F'
}

const N_INTERIOR_SAMPLES = 16
const BORDER_STD_THRESH = 8

const SSIM_HALF = 8
const SSIM_WIN = 8
const SSIM_STEP = 4
const SSIM_N_INTERIOR = 8

type Rgba = Uint8ClampedArray | Uint8Array

function px(data: Rgba, width: number, x: number, y: number, c: number): number {
  return data[(y * width + x) * 4 + c]
}

export function computeSeamMetrics(data: Rgba, width: number, height: number): SeamMetrics {
  const maxDiff = 255 * 3

  const leftRightDiffs = new Array<number>(height)
  for (let y = 0; y < height; y += 1) {
    leftRightDiffs[y] =
      Math.abs(px(data, width, 0, y, 0) - px(data, width, width - 1, y, 0)) +
      Math.abs(px(data, width, 0, y, 1) - px(data, width, width - 1, y, 1)) +
      Math.abs(px(data, width, 0, y, 2) - px(data, width, width - 1, y, 2))
  }

  const topBottomDiffs = new Array<number>(width)
  for (let x = 0; x < width; x += 1) {
    topBottomDiffs[x] =
      Math.abs(px(data, width, x, 0, 0) - px(data, width, x, height - 1, 0)) +
      Math.abs(px(data, width, x, 0, 1) - px(data, width, x, height - 1, 1)) +
      Math.abs(px(data, width, x, 0, 2) - px(data, width, x, height - 1, 2))
  }

  const avgLeftRight = leftRightDiffs.reduce((s, v) => s + v, 0) / Math.max(1, height)
  const avgTopBottom = topBottomDiffs.reduce((s, v) => s + v, 0) / Math.max(1, width)

  const { lapRatioLR, lapRatioTB } = computeLaplacianRatios(data, width, height)
  const lapRatio = Math.max(lapRatioLR, lapRatioTB)

  const { ssimSeamLR, ssimSeamTB, ssimRatio } = computeSSIMRatios(data, width, height)
  const combinedRatio = Math.max(lapRatio, ssimRatio)

  return {
    leftRightDiffs,
    topBottomDiffs,
    maxDiff,
    avgLeftRight,
    avgTopBottom,
    lapRatioLR,
    lapRatioTB,
    lapRatio,
    ssimSeamLR,
    ssimSeamTB,
    ssimRatio,
    combinedRatio,
  }
}

function computeLaplacianRatios(
  data: Rgba,
  width: number,
  height: number,
): { lapRatioLR: number; lapRatioTB: number } {
  if (width < 4 || height < 4) return { lapRatioLR: 0, lapRatioTB: 0 }

  // Laplacian across the LR seam, treating the image as horizontally periodic
  let seamLapSumLR = 0
  for (let y = 0; y < height; y += 1) {
    let lap0 = 0
    let lap1 = 0
    for (let c = 0; c < 3; c += 1) {
      // at x=0: |col(W-1) + col(1) - 2*col(0)|
      lap0 += Math.abs(
        px(data, width, width - 1, y, c) + px(data, width, 1, y, c) - 2 * px(data, width, 0, y, c),
      )
      // at x=W-1: |col(W-2) + col(0) - 2*col(W-1)|
      lap1 += Math.abs(
        px(data, width, width - 2, y, c) + px(data, width, 0, y, c) - 2 * px(data, width, width - 1, y, c),
      )
    }
    seamLapSumLR += (lap0 + lap1) / 2
  }
  const seamLapAvgLR = seamLapSumLR / height

  // Interior baseline: median Laplacian over sampled columns
  const colAvgs: number[] = []
  for (let i = 0; i < N_INTERIOR_SAMPLES; i += 1) {
    const x = Math.floor(((i + 1) * width) / (N_INTERIOR_SAMPLES + 1))
    const sx = Math.max(1, Math.min(x, width - 2))
    let colSum = 0
    for (let y = 0; y < height; y += 1) {
      let lap = 0
      for (let c = 0; c < 3; c += 1) {
        lap += Math.abs(
          px(data, width, sx - 1, y, c) + px(data, width, sx + 1, y, c) - 2 * px(data, width, sx, y, c),
        )
      }
      colSum += lap
    }
    colAvgs.push(colSum / height)
  }
  colAvgs.sort((a, b) => a - b)
  const medianLR = colAvgs[Math.floor(colAvgs.length / 2)] || 1
  let lapRatioLR = seamLapAvgLR / Math.max(medianLR, 1)

  // Laplacian across the TB seam
  let seamLapSumTB = 0
  for (let x = 0; x < width; x += 1) {
    let lap0 = 0
    let lap1 = 0
    for (let c = 0; c < 3; c += 1) {
      lap0 += Math.abs(
        px(data, width, x, height - 1, c) + px(data, width, x, 1, c) - 2 * px(data, width, x, 0, c),
      )
      lap1 += Math.abs(
        px(data, width, x, height - 2, c) + px(data, width, x, 0, c) - 2 * px(data, width, x, height - 1, c),
      )
    }
    seamLapSumTB += (lap0 + lap1) / 2
  }
  const seamLapAvgTB = seamLapSumTB / width

  const rowAvgs: number[] = []
  for (let i = 0; i < N_INTERIOR_SAMPLES; i += 1) {
    const y = Math.floor(((i + 1) * height) / (N_INTERIOR_SAMPLES + 1))
    const sy = Math.max(1, Math.min(y, height - 2))
    let rowSum = 0
    for (let x = 0; x < width; x += 1) {
      let lap = 0
      for (let c = 0; c < 3; c += 1) {
        lap += Math.abs(
          px(data, width, x, sy - 1, c) + px(data, width, x, sy + 1, c) - 2 * px(data, width, x, sy, c),
        )
      }
      rowSum += lap
    }
    rowAvgs.push(rowSum / width)
  }
  rowAvgs.sort((a, b) => a - b)
  const medianTB = rowAvgs[Math.floor(rowAvgs.length / 2)] || 1
  let lapRatioTB = seamLapAvgTB / Math.max(medianTB, 1)

  // Solid-color borders (white/black padding) defeat the ratio test:
  // both edges are flat so the seam Laplacian is ~0. Force a fail instead.
  let sumLC = 0, sumSqLC = 0, sumRC = 0, sumSqRC = 0
  for (let y = 0; y < height; y += 1) {
    for (let c = 0; c < 3; c += 1) {
      const lv = px(data, width, 0, y, c)
      const rv = px(data, width, width - 1, y, c)
      sumLC += lv; sumSqLC += lv * lv
      sumRC += rv; sumSqRC += rv * rv
    }
  }
  const nLR = height * 3
  const stdL = Math.sqrt(Math.max(0, sumSqLC / nLR - (sumLC / nLR) ** 2))
  const stdR = Math.sqrt(Math.max(0, sumSqRC / nLR - (sumRC / nLR) ** 2))
  if (stdL < BORDER_STD_THRESH && stdR < BORDER_STD_THRESH) lapRatioLR = Math.max(lapRatioLR, 10)

  let sumTC = 0, sumSqTC = 0, sumBC = 0, sumSqBC = 0
  for (let x = 0; x < width; x += 1) {
    for (let c = 0; c < 3; c += 1) {
      const tv = px(data, width, x, 0, c)
      const bv = px(data, width, x, height - 1, c)
      sumTC += tv; sumSqTC += tv * tv
      sumBC += bv; sumSqBC += bv * bv
    }
  }
  const nTB = width * 3
  const stdT = Math.sqrt(Math.max(0, sumSqTC / nTB - (sumTC / nTB) ** 2))
  const stdB = Math.sqrt(Math.max(0, sumSqBC / nTB - (sumBC / nTB) ** 2))
  if (stdT < BORDER_STD_THRESH && stdB < BORDER_STD_THRESH) lapRatioTB = Math.max(lapRatioTB, 10)

  return { lapRatioLR, lapRatioTB }
}

function luminance(data: Rgba, width: number, x: number, y: number): number {
  const i = (y * width + x) * 4
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
}

/** SSIM between two same-size windows given by their top-left corners. */
function windowSSIM(
  data: Rgba,
  width: number,
  x1: number, y1: number,
  x2: number, y2: number,
  w: number, h: number,
): number {
  const C1 = 6.5025   // (0.01 * 255)^2
  const C2 = 58.5225  // (0.03 * 255)^2
  const n = w * h
  let s1 = 0, s2 = 0, s11 = 0, s22 = 0, s12 = 0
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const v1 = luminance(data, width, x1 + dx, y1 + dy)
      const v2 = luminance(data, width, x2 + dx, y2 + dy)
      s1 += v1; s2 += v2
      s11 += v1 * v1; s22 += v2 * v2; s12 += v1 * v2
    }
  }
  const mu1 = s1 / n, mu2 = s2 / n
  const sig11 = s11 / n - mu1 * mu1
  const sig22 = s22 / n - mu2 * mu2
  const sig12 = s12 / n - mu1 * mu2
  return ((2 * mu1 * mu2 + C1) * (2 * sig12 + C2)) /
         ((mu1 * mu1 + mu2 * mu2 + C1) * (sig11 + sig22 + C2))
}

function computeSSIMRatios(
  data: Rgba,
  width: number,
  height: number,
): { ssimSeamLR: number; ssimSeamTB: number; ssimRatio: number } {
  if (width < SSIM_HALF * 4 || height < SSIM_WIN * 2) {
    return { ssimSeamLR: 1, ssimSeamTB: 1, ssimRatio: 1 }
  }

  // LR seam: compare the last SSIM_HALF columns against the first SSIM_HALF
  let seamSumLR = 0, seamCountLR = 0
  for (let y = 0; y <= height - SSIM_WIN; y += SSIM_STEP) {
    seamSumLR += windowSSIM(data, width, width - SSIM_HALF, y, 0, y, SSIM_HALF, SSIM_WIN)
    seamCountLR++
  }
  const ssimSeamLR = seamCountLR > 0 ? seamSumLR / seamCountLR : 1

  // Interior LR baseline: adjacent 8px-wide column bands
  let intSumLR = 0, intCountLR = 0
  for (let i = 0; i < SSIM_N_INTERIOR; i++) {
    const x = SSIM_HALF + Math.floor((i * (width - SSIM_HALF * 3)) / SSIM_N_INTERIOR)
    for (let y = 0; y <= height - SSIM_WIN; y += SSIM_STEP) {
      intSumLR += windowSSIM(data, width, x, y, x + SSIM_HALF, y, SSIM_HALF, SSIM_WIN)
      intCountLR++
    }
  }
  const intMeanLR = intCountLR > 0 ? intSumLR / intCountLR : 1
  const ssimRatioLR = (1 - ssimSeamLR) / Math.max(1 - intMeanLR, 0.05)

  // TB seam
  let ssimSeamTB = 1
  let ssimRatioTB = 1
  if (height >= SSIM_HALF * 4 && width >= SSIM_WIN * 2) {
    let seamSumTB = 0, seamCountTB = 0
    for (let x = 0; x <= width - SSIM_WIN; x += SSIM_STEP) {
      seamSumTB += windowSSIM(data, width, x, height - SSIM_HALF, x, 0, SSIM_WIN, SSIM_HALF)
      seamCountTB++
    }
    ssimSeamTB = seamCountTB > 0 ? seamSumTB / seamCountTB : 1

    let intSumTB = 0, intCountTB = 0
    for (let i = 0; i < SSIM_N_INTERIOR; i++) {
      const y = SSIM_HALF + Math.floor((i * (height - SSIM_HALF * 3)) / SSIM_N_INTERIOR)
      for (let x = 0; x <= width - SSIM_WIN; x += SSIM_STEP) {
        intSumTB += windowSSIM(data, width, x, y, x, y + SSIM_HALF, SSIM_WIN, SSIM_HALF)
        intCountTB++
      }
    }
    const intMeanTB = intCountTB > 0 ? intSumTB / intCountTB : 1
    ssimRatioTB = (1 - ssimSeamTB) / Math.max(1 - intMeanTB, 0.05)
  }

  return { ssimSeamLR, ssimSeamTB, ssimRatio: Math.max(ssimRatioLR, ssimRatioTB) }
}
