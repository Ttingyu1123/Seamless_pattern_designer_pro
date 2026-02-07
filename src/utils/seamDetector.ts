export interface SeamAnalysis {
  heatmap: HTMLCanvasElement
  leftRightDiffs: number[]
  topBottomDiffs: number[]
  maxDiff: number
  avgLeftRight: number
  avgTopBottom: number
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

  return {
    heatmap,
    leftRightDiffs,
    topBottomDiffs,
    maxDiff,
    avgLeftRight,
    avgTopBottom,
  }
}
