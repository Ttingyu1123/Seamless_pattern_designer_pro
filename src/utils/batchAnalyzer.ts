import { ACCEPTED_IMAGE_TYPES } from './constants'
import { gradeFromRatio, type SeamGrade } from './seamMetrics'
import { computeSeamMetricsAsync } from './seamWorkerClient'

export interface BatchResult {
  file: File
  name: string
  width: number
  height: number
  grade: SeamGrade
  combinedRatio: number
  lapRatio: number
  ssimRatio: number
  error?: string
}

// Analyze at the same downscale cap the inspect preview uses, so batch
// grades match what the user sees when opening a file individually.
const MAX_ANALYZE_EDGE = 2048

export function isAnalyzableImage(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type as typeof ACCEPTED_IMAGE_TYPES[number])
}

async function analyzeOne(file: File): Promise<BatchResult> {
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_ANALYZE_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('canvas 2d context unavailable')
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(bitmap, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)

    const m = await computeSeamMetricsAsync(data, w, h)
    return {
      file,
      name: file.name,
      width: bitmap.width,
      height: bitmap.height,
      grade: gradeFromRatio(m.combinedRatio),
      combinedRatio: m.combinedRatio,
      lapRatio: m.lapRatio,
      ssimRatio: m.ssimRatio,
    }
  } catch (err) {
    return {
      file,
      name: file.name,
      width: 0,
      height: 0,
      grade: 'F',
      combinedRatio: Infinity,
      lapRatio: Infinity,
      ssimRatio: Infinity,
      error: err instanceof Error ? err.message : 'failed to decode',
    }
  } finally {
    bitmap?.close()
  }
}

export async function analyzeBatch(
  files: File[],
  onProgress: (done: number, total: number, current: string) => void,
): Promise<BatchResult[]> {
  const images = files.filter(isAnalyzableImage)
  const results: BatchResult[] = []
  for (let i = 0; i < images.length; i += 1) {
    onProgress(i, images.length, images[i].name)
    results.push(await analyzeOne(images[i]))
    // yield to the event loop so the progress UI can paint between files
    await new Promise((r) => setTimeout(r, 0))
  }
  onProgress(images.length, images.length, '')
  results.sort((a, b) => a.combinedRatio - b.combinedRatio)
  return results
}

export function batchResultsToCsv(results: BatchResult[]): string {
  const header = 'name,grade,combined_ratio,laplacian_ratio,ssim_ratio,width,height,error'
  const rows = results.map((r) =>
    [
      `"${r.name.replace(/"/g, '""')}"`,
      r.grade,
      Number.isFinite(r.combinedRatio) ? r.combinedRatio.toFixed(3) : '',
      Number.isFinite(r.lapRatio) ? r.lapRatio.toFixed(3) : '',
      Number.isFinite(r.ssimRatio) ? r.ssimRatio.toFixed(3) : '',
      r.width,
      r.height,
      r.error ? `"${r.error.replace(/"/g, '""')}"` : '',
    ].join(','),
  )
  return [header, ...rows].join('\n')
}
