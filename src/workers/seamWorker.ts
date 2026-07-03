import { computeSeamMetrics } from '../utils/seamMetrics'

interface SeamJob {
  id: number
  buffer: ArrayBuffer
  width: number
  height: number
}

self.onmessage = (event: MessageEvent<SeamJob>) => {
  const { id, buffer, width, height } = event.data
  const metrics = computeSeamMetrics(new Uint8ClampedArray(buffer), width, height)
  self.postMessage({ id, metrics })
}
