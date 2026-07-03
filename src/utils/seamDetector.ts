export interface SeamAnalysis {
  heatmap: HTMLCanvasElement
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

export function detectSeams(
  source: CanvasImageSource,
  width: number,
  height: number,
  withHeatmap: boolean,
): SeamAnalysis {
  const leftRightDiffs = new Array<number>(height)
  const topBottomDiffs = new Array<number>(width)
  const maxDiff = 255 * 3
  const lrCanvas = document.createElement('canvas')
  lrCanvas.width = 2
  lrCanvas.height = height
  const lrCtx = lrCanvas.getContext('2d', { willReadFrequently: true })
  const tbCanvas = document.createElement('canvas')
  tbCanvas.width = width
  tbCanvas.height = 2
  const tbCtx = tbCanvas.getContext('2d', { willReadFrequently: true })

  if (!lrCtx || !tbCtx) {
    const empty = document.createElement('canvas')
    empty.width = Math.max(1, withHeatmap ? width : 1)
    empty.height = Math.max(1, withHeatmap ? height : 1)
    return {
      heatmap: empty,
      leftRightDiffs: new Array(height).fill(0),
      topBottomDiffs: new Array(width).fill(0),
      maxDiff,
      avgLeftRight: 0,
      avgTopBottom: 0,
      lapRatioLR: 0,
      lapRatioTB: 0,
      lapRatio: 0,
      ssimSeamLR: 1,
      ssimSeamTB: 1,
      ssimRatio: 1,
      combinedRatio: 0,
    }
  }

  lrCtx.drawImage(source, 0, 0, 1, height, 0, 0, 1, height)
  lrCtx.drawImage(source, width - 1, 0, 1, height, 1, 0, 1, height)
  const lrData = lrCtx.getImageData(0, 0, 2, height).data

  for (let y = 0; y < height; y += 1) {
    const left = (y * 2 + 0) * 4
    const right = (y * 2 + 1) * 4
    leftRightDiffs[y] =
      Math.abs(lrData[left] - lrData[right]) +
      Math.abs(lrData[left + 1] - lrData[right + 1]) +
      Math.abs(lrData[left + 2] - lrData[right + 2])
  }

  tbCtx.drawImage(source, 0, 0, width, 1, 0, 0, width, 1)
  tbCtx.drawImage(source, 0, height - 1, width, 1, 0, 1, width, 1)
  const tbData = tbCtx.getImageData(0, 0, width, 2).data

  for (let x = 0; x < width; x += 1) {
    const top = (0 * width + x) * 4
    const bottom = (1 * width + x) * 4
    topBottomDiffs[x] =
      Math.abs(tbData[top] - tbData[bottom]) +
      Math.abs(tbData[top + 1] - tbData[bottom + 1]) +
      Math.abs(tbData[top + 2] - tbData[bottom + 2])
  }

  const heatmap = document.createElement('canvas')
  heatmap.width = Math.max(1, withHeatmap ? width : 1)
  heatmap.height = Math.max(1, withHeatmap ? height : 1)

  if (withHeatmap) {
    const heatCtx = heatmap.getContext('2d')
    if (heatCtx) {
      const image = heatCtx.createImageData(width, height)
      const px = image.data
      const setPixel = (x: number, y: number, r: number, g: number, b: number, strength: number) => {
        const i = (y * width + x) * 4
        px[i] = r
        px[i + 1] = g
        px[i + 2] = b
        px[i + 3] = Math.round(255 * (0.12 + 0.82 * strength))
      }

      for (let y = 0; y < height; y += 1) {
        const strength = leftRightDiffs[y] / maxDiff
        setPixel(0, y, 255, 84, 84, strength)
        setPixel(width - 1, y, 255, 84, 84, strength)
      }

      for (let x = 0; x < width; x += 1) {
        const strength = topBottomDiffs[x] / maxDiff
        setPixel(x, 0, 255, 191, 64, strength)
        setPixel(x, height - 1, 255, 191, 64, strength)
      }

      heatCtx.putImageData(image, 0, 0)
    }
  }

  const avgLeftRight = leftRightDiffs.reduce((sum, value) => sum + value, 0) / Math.max(1, leftRightDiffs.length)
  const avgTopBottom = topBottomDiffs.reduce((sum, value) => sum + value, 0) / Math.max(1, topBottomDiffs.length)

  const { lapRatioLR, lapRatioTB } = computeLaplacianRatio(source, width, height)
  const lapRatio = Math.max(lapRatioLR, lapRatioTB)

  const { ssimSeamLR, ssimSeamTB, ssimRatio } = computeSSIMRatio(source, width, height)
  const combinedRatio = Math.max(lapRatio, ssimRatio)

  return {
    heatmap,
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

const N_INTERIOR_SAMPLES = 16

function computeLaplacianRatio(
  source: CanvasImageSource,
  width: number,
  height: number,
): { lapRatioLR: number; lapRatioTB: number } {
  if (width < 4 || height < 4) return { lapRatioLR: 0, lapRatioTB: 0 }

  // --- Left-Right seam Laplacian ---
  // Draw cols [W-2, W-1, 0, 1] into a 4px strip
  const seamLr = document.createElement('canvas')
  seamLr.width = 4
  seamLr.height = height
  const seamLrCtx = seamLr.getContext('2d', { willReadFrequently: true })
  if (!seamLrCtx) return { lapRatioLR: 0, lapRatioTB: 0 }
  seamLrCtx.drawImage(source, width - 2, 0, 2, height, 0, 0, 2, height)
  seamLrCtx.drawImage(source, 0, 0, 2, height, 2, 0, 2, height)
  const slrData = seamLrCtx.getImageData(0, 0, 4, height).data
  // Layout per row: px0=col(W-2), px1=col(W-1), px2=col(0), px3=col(1)

  let seamLapSumLR = 0
  for (let y = 0; y < height; y += 1) {
    const base = y * 4 * 4
    let lap0 = 0
    let lap1 = 0
    for (let c = 0; c < 3; c += 1) {
      // Laplacian at x=0: |col(W-1) + col(1) - 2*col(0)|
      lap0 += Math.abs(slrData[base + 1 * 4 + c] + slrData[base + 3 * 4 + c] - 2 * slrData[base + 2 * 4 + c])
      // Laplacian at x=W-1: |col(W-2) + col(0) - 2*col(W-1)|
      lap1 += Math.abs(slrData[base + 0 * 4 + c] + slrData[base + 2 * 4 + c] - 2 * slrData[base + 1 * 4 + c])
    }
    seamLapSumLR += (lap0 + lap1) / 2
  }
  const seamLapAvgLR = seamLapSumLR / height

  // Interior LR: sample columns, draw 3px-wide strips
  const intLr = document.createElement('canvas')
  intLr.width = 3 * N_INTERIOR_SAMPLES
  intLr.height = height
  const intLrCtx = intLr.getContext('2d', { willReadFrequently: true })
  let lapRatioLR = seamLapAvgLR
  if (intLrCtx) {
    for (let i = 0; i < N_INTERIOR_SAMPLES; i += 1) {
      const x = Math.floor((i + 1) * width / (N_INTERIOR_SAMPLES + 1))
      const sx = Math.max(1, Math.min(x, width - 2))
      intLrCtx.drawImage(source, sx - 1, 0, 3, height, i * 3, 0, 3, height)
    }
    const intLrData = intLrCtx.getImageData(0, 0, 3 * N_INTERIOR_SAMPLES, height).data
    const stride = 3 * N_INTERIOR_SAMPLES * 4
    const colAvgs: number[] = []
    for (let i = 0; i < N_INTERIOR_SAMPLES; i += 1) {
      let colSum = 0
      for (let y = 0; y < height; y += 1) {
        const base = y * stride + i * 3 * 4
        let lap = 0
        for (let c = 0; c < 3; c += 1) {
          lap += Math.abs(intLrData[base + 0 * 4 + c] + intLrData[base + 2 * 4 + c] - 2 * intLrData[base + 1 * 4 + c])
        }
        colSum += lap
      }
      colAvgs.push(colSum / height)
    }
    colAvgs.sort((a, b) => a - b)
    const medianLR = colAvgs[Math.floor(colAvgs.length / 2)] || 1
    lapRatioLR = seamLapAvgLR / Math.max(medianLR, 1)
  }

  // --- Top-Bottom seam Laplacian ---
  const seamTb = document.createElement('canvas')
  seamTb.width = width
  seamTb.height = 4
  const seamTbCtx = seamTb.getContext('2d', { willReadFrequently: true })
  if (!seamTbCtx) return { lapRatioLR, lapRatioTB: 0 }
  seamTbCtx.drawImage(source, 0, height - 2, width, 2, 0, 0, width, 2)
  seamTbCtx.drawImage(source, 0, 0, width, 2, 0, 2, width, 2)
  const stbData = seamTbCtx.getImageData(0, 0, width, 4).data
  // Layout per col: row0=row(H-2), row1=row(H-1), row2=row(0), row3=row(1)

  let seamLapSumTB = 0
  for (let x = 0; x < width; x += 1) {
    let lap0 = 0
    let lap1 = 0
    for (let c = 0; c < 3; c += 1) {
      // Laplacian at y=0: |row(H-1) + row(1) - 2*row(0)|
      lap0 += Math.abs(stbData[(1 * width + x) * 4 + c] + stbData[(3 * width + x) * 4 + c] - 2 * stbData[(2 * width + x) * 4 + c])
      // Laplacian at y=H-1: |row(H-2) + row(0) - 2*row(H-1)|
      lap1 += Math.abs(stbData[(0 * width + x) * 4 + c] + stbData[(2 * width + x) * 4 + c] - 2 * stbData[(1 * width + x) * 4 + c])
    }
    seamLapSumTB += (lap0 + lap1) / 2
  }
  const seamLapAvgTB = seamLapSumTB / width

  // Interior TB: sample rows
  const intTb = document.createElement('canvas')
  intTb.width = width
  intTb.height = 3 * N_INTERIOR_SAMPLES
  const intTbCtx = intTb.getContext('2d', { willReadFrequently: true })
  let lapRatioTB = seamLapAvgTB
  if (intTbCtx) {
    for (let i = 0; i < N_INTERIOR_SAMPLES; i += 1) {
      const y = Math.floor((i + 1) * height / (N_INTERIOR_SAMPLES + 1))
      const sy = Math.max(1, Math.min(y, height - 2))
      intTbCtx.drawImage(source, 0, sy - 1, width, 3, 0, i * 3, width, 3)
    }
    const intTbData = intTbCtx.getImageData(0, 0, width, 3 * N_INTERIOR_SAMPLES).data
    const rowAvgs: number[] = []
    for (let i = 0; i < N_INTERIOR_SAMPLES; i += 1) {
      let rowSum = 0
      for (let x = 0; x < width; x += 1) {
        const r0 = ((i * 3 + 0) * width + x) * 4
        const r1 = ((i * 3 + 1) * width + x) * 4
        const r2 = ((i * 3 + 2) * width + x) * 4
        let lap = 0
        for (let c = 0; c < 3; c += 1) {
          lap += Math.abs(intTbData[r0 + c] + intTbData[r2 + c] - 2 * intTbData[r1 + c])
        }
        rowSum += lap
      }
      rowAvgs.push(rowSum / width)
    }
    rowAvgs.sort((a, b) => a - b)
    const medianTB = rowAvgs[Math.floor(rowAvgs.length / 2)] || 1
    lapRatioTB = seamLapAvgTB / Math.max(medianTB, 1)
  }

  const BORDER_STD_THRESH = 8
  let sumLC = 0, sumSqLC = 0, sumRC = 0, sumSqRC = 0
  for (let y = 0; y < height; y += 1) {
    const base = y * 4 * 4
    for (let c = 0; c < 3; c += 1) {
      const lv = slrData[base + 2 * 4 + c]
      const rv = slrData[base + 1 * 4 + c]
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
      const tv = stbData[(2 * width + x) * 4 + c]
      const bv = stbData[(1 * width + x) * 4 + c]
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

const SSIM_HALF = 8
const SSIM_WIN = 8
const SSIM_STEP = 4
const SSIM_N_INTERIOR = 8

function windowSSIM(
  data: Uint8ClampedArray,
  stride: number,
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
      const i1 = ((y1 + dy) * stride + (x1 + dx)) * 4
      const i2 = ((y2 + dy) * stride + (x2 + dx)) * 4
      const v1 = 0.299 * data[i1] + 0.587 * data[i1 + 1] + 0.114 * data[i1 + 2]
      const v2 = 0.299 * data[i2] + 0.587 * data[i2 + 1] + 0.114 * data[i2 + 2]
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

function meanSSIMOverStrip(
  data: Uint8ClampedArray,
  stride: number,
  half: number,
  length: number,
  horizontal: boolean,
): number {
  let sum = 0, count = 0
  if (horizontal) {
    for (let x = 0; x <= length - SSIM_WIN; x += SSIM_STEP) {
      sum += windowSSIM(data, stride, x, 0, x, half, SSIM_WIN, half)
      count++
    }
  } else {
    for (let y = 0; y <= length - SSIM_WIN; y += SSIM_STEP) {
      sum += windowSSIM(data, stride, 0, y, half, y, half, SSIM_WIN)
      count++
    }
  }
  return count > 0 ? sum / count : 1
}

function computeSSIMRatio(
  source: CanvasImageSource,
  width: number,
  height: number,
): { ssimSeamLR: number; ssimSeamTB: number; ssimRatio: number } {
  const minLR = SSIM_HALF * 4
  const minTB = SSIM_HALF * 4
  if (width < minLR || height < SSIM_WIN * 2) {
    return { ssimSeamLR: 1, ssimSeamTB: 1, ssimRatio: 1 }
  }

  // --- LR seam SSIM ---
  const seamLrC = document.createElement('canvas')
  seamLrC.width = SSIM_HALF * 2
  seamLrC.height = height
  const seamLrCtx = seamLrC.getContext('2d', { willReadFrequently: true })
  if (!seamLrCtx) return { ssimSeamLR: 1, ssimSeamTB: 1, ssimRatio: 1 }
  seamLrCtx.drawImage(source, width - SSIM_HALF, 0, SSIM_HALF, height, 0, 0, SSIM_HALF, height)
  seamLrCtx.drawImage(source, 0, 0, SSIM_HALF, height, SSIM_HALF, 0, SSIM_HALF, height)
  const seamLrData = seamLrCtx.getImageData(0, 0, SSIM_HALF * 2, height).data
  const ssimSeamLR = meanSSIMOverStrip(seamLrData, SSIM_HALF * 2, SSIM_HALF, height, false)

  // Interior LR baseline
  const intLrC = document.createElement('canvas')
  intLrC.width = SSIM_HALF * 2
  intLrC.height = height * SSIM_N_INTERIOR
  const intLrCtx = intLrC.getContext('2d', { willReadFrequently: true })
  let intMeanLR = 1
  if (intLrCtx) {
    for (let i = 0; i < SSIM_N_INTERIOR; i++) {
      const x = SSIM_HALF + Math.floor(i * (width - SSIM_HALF * 3) / SSIM_N_INTERIOR)
      intLrCtx.drawImage(source, x, 0, SSIM_HALF * 2, height, 0, i * height, SSIM_HALF * 2, height)
    }
    const intLrData = intLrCtx.getImageData(0, 0, SSIM_HALF * 2, height * SSIM_N_INTERIOR).data
    const intLrStride = SSIM_HALF * 2
    let intSum = 0, intCount = 0
    for (let i = 0; i < SSIM_N_INTERIOR; i++) {
      const yOff = i * height
      for (let y = 0; y <= height - SSIM_WIN; y += SSIM_STEP) {
        intSum += windowSSIM(intLrData, intLrStride, 0, yOff + y, SSIM_HALF, yOff + y, SSIM_HALF, SSIM_WIN)
        intCount++
      }
    }
    if (intCount > 0) intMeanLR = intSum / intCount
  }

  const ssimRatioLR = (1 - ssimSeamLR) / Math.max(1 - intMeanLR, 0.05)

  // --- TB seam SSIM ---
  let ssimSeamTB = 1
  let ssimRatioTB = 1
  if (height >= minTB && width >= SSIM_WIN * 2) {
    const seamTbC = document.createElement('canvas')
    seamTbC.width = width
    seamTbC.height = SSIM_HALF * 2
    const seamTbCtx = seamTbC.getContext('2d', { willReadFrequently: true })
    if (seamTbCtx) {
      seamTbCtx.drawImage(source, 0, height - SSIM_HALF, width, SSIM_HALF, 0, 0, width, SSIM_HALF)
      seamTbCtx.drawImage(source, 0, 0, width, SSIM_HALF, 0, SSIM_HALF, width, SSIM_HALF)
      const seamTbData = seamTbCtx.getImageData(0, 0, width, SSIM_HALF * 2).data
      ssimSeamTB = meanSSIMOverStrip(seamTbData, width, SSIM_HALF, width, true)

      const intTbC = document.createElement('canvas')
      intTbC.width = width
      intTbC.height = SSIM_HALF * 2 * SSIM_N_INTERIOR
      const intTbCtx = intTbC.getContext('2d', { willReadFrequently: true })
      if (intTbCtx) {
        for (let i = 0; i < SSIM_N_INTERIOR; i++) {
          const y = SSIM_HALF + Math.floor(i * (height - SSIM_HALF * 3) / SSIM_N_INTERIOR)
          intTbCtx.drawImage(source, 0, y, width, SSIM_HALF * 2, 0, i * SSIM_HALF * 2, width, SSIM_HALF * 2)
        }
        const intTbData = intTbCtx.getImageData(0, 0, width, SSIM_HALF * 2 * SSIM_N_INTERIOR).data
        let intSum = 0, intCount = 0
        for (let i = 0; i < SSIM_N_INTERIOR; i++) {
          const yOff = i * SSIM_HALF * 2
          for (let x = 0; x <= width - SSIM_WIN; x += SSIM_STEP) {
            intSum += windowSSIM(intTbData, width, x, yOff, x, yOff + SSIM_HALF, SSIM_WIN, SSIM_HALF)
            intCount++
          }
        }
        const intMeanTB = intCount > 0 ? intSum / intCount : 1
        ssimRatioTB = (1 - ssimSeamTB) / Math.max(1 - intMeanTB, 0.05)
      }
    }
  }

  return {
    ssimSeamLR,
    ssimSeamTB,
    ssimRatio: Math.max(ssimRatioLR, ssimRatioTB),
  }
}
