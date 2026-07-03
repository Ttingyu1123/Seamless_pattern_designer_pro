import { computeSeamMetrics, type SeamMetrics } from './seamMetrics'

// Seam math is O(width x height) and runs up to 2048x2048 - off the main
// thread so pan/zoom stays responsive during analysis.

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, (metrics: SeamMetrics) => void>()

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (!worker) {
    try {
      worker = new Worker(new URL('../workers/seamWorker.ts', import.meta.url), {
        type: 'module',
      })
      worker.onmessage = (event: MessageEvent<{ id: number; metrics: SeamMetrics }>) => {
        const resolve = pending.get(event.data.id)
        if (resolve) {
          pending.delete(event.data.id)
          resolve(event.data.metrics)
        }
      }
      worker.onerror = () => {
        // Fail every in-flight job over to the sync path on next call
        worker?.terminate()
        worker = null
        for (const resolve of pending.values()) resolve(null as unknown as SeamMetrics)
        pending.clear()
      }
    } catch {
      worker = null
    }
  }
  return worker
}

/**
 * Compute seam metrics off the main thread. The buffer is structured-cloned
 * (not transferred) so the caller's copy stays valid for the sync fallback
 * if the worker dies mid-job.
 */
export function computeSeamMetricsAsync(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<SeamMetrics> {
  const w = getWorker()
  if (!w) {
    return Promise.resolve(computeSeamMetrics(data, width, height))
  }
  const id = nextId++
  return new Promise((resolve) => {
    pending.set(id, (metrics) => {
      // null signals a worker crash - recompute synchronously
      resolve(metrics ?? computeSeamMetrics(data, width, height))
    })
    w.postMessage({ id, buffer: data.buffer, width, height })
  })
}
