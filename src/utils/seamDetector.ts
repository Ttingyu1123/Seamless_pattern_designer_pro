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
      for (let y = 0; y < height; y += 1) {
        const strength = leftRightDiffs[y] / maxDiff
        heatCtx.strokeStyle = `rgba(255,84,84,${0.12 + 0.82 * strength})`
        heatCtx.beginPath()
        heatCtx.moveTo(0, y + 0.5)
        heatCtx.lineTo(0, y + 0.5)
        heatCtx.moveTo(width - 1, y + 0.5)
        heatCtx.lineTo(width - 1, y + 0.5)
        heatCtx.stroke()
      }

      for (let x = 0; x < width; x += 1) {
        const strength = topBottomDiffs[x] / maxDiff
        heatCtx.strokeStyle = `rgba(255,191,64,${0.12 + 0.82 * strength})`
        heatCtx.beginPath()
        heatCtx.moveTo(x + 0.5, 0)
        heatCtx.lineTo(x + 0.5, 0)
        heatCtx.moveTo(x + 0.5, height - 1)
        heatCtx.lineTo(x + 0.5, height - 1)
        heatCtx.stroke()
      }
    }
  }

  const avgLeftRight = leftRightDiffs.reduce((sum, value) => sum + value, 0) / Math.max(1, leftRightDiffs.length)
  const avgTopBottom = topBottomDiffs.reduce((sum, value) => sum + value, 0) / Math.max(1, topBottomDiffs.length)

  const { lapRatioLR, lapRatioTB } = computeLaplacianRatio(source, width, height)
  const lapRatio = Math.max(lapRatioLR, lapRatioTB)

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

  return { lapRatioLR, lapRatioTB }
}
