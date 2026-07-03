import { computeSeamMetrics, type SeamMetrics } from './seamMetrics'

export interface SeamAnalysis extends SeamMetrics {
  heatmap: HTMLCanvasElement
}

const EMPTY_METRICS: SeamMetrics = {
  leftRightDiffs: [],
  topBottomDiffs: [],
  maxDiff: 255 * 3,
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

export function detectSeams(
  source: CanvasImageSource,
  width: number,
  height: number,
  withHeatmap: boolean,
): SeamAnalysis {
  const heatmap = document.createElement('canvas')
  heatmap.width = Math.max(1, withHeatmap ? width : 1)
  heatmap.height = Math.max(1, withHeatmap ? height : 1)

  const work = document.createElement('canvas')
  work.width = width
  work.height = height
  const workCtx = work.getContext('2d', { willReadFrequently: true })
  if (!workCtx) {
    return {
      ...EMPTY_METRICS,
      leftRightDiffs: new Array(height).fill(0),
      topBottomDiffs: new Array(width).fill(0),
      heatmap,
    }
  }

  workCtx.drawImage(source, 0, 0)
  const { data } = workCtx.getImageData(0, 0, width, height)
  const metrics = computeSeamMetrics(data, width, height)

  if (withHeatmap) {
    drawHeatmap(heatmap, metrics, width, height)
  }

  return { ...metrics, heatmap }
}

function drawHeatmap(
  heatmap: HTMLCanvasElement,
  metrics: SeamMetrics,
  width: number,
  height: number,
): void {
  const heatCtx = heatmap.getContext('2d')
  if (!heatCtx) return

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
    const strength = metrics.leftRightDiffs[y] / metrics.maxDiff
    setPixel(0, y, 255, 84, 84, strength)
    setPixel(width - 1, y, 255, 84, 84, strength)
  }

  for (let x = 0; x < width; x += 1) {
    const strength = metrics.topBottomDiffs[x] / metrics.maxDiff
    setPixel(x, 0, 255, 191, 64, strength)
    setPixel(x, height - 1, 255, 191, 64, strength)
  }

  heatCtx.putImageData(image, 0, 0)
}
