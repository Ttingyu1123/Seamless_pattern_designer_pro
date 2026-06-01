const isTouchDevice = () =>
  'ontouchstart' in window || navigator.maxTouchPoints > 0

async function canShareFile(blob: Blob, filename: string): Promise<boolean> {
  if (!navigator.share || !navigator.canShare) return false
  try {
    const file = new File([blob], filename, { type: blob.type })
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export async function saveCanvasImage(
  canvas: HTMLCanvasElement,
  filename: string,
  onError?: (w: number, h: number) => void,
): Promise<void> {
  const blob = await canvasToBlob(canvas)
  if (!blob) {
    onError?.(canvas.width, canvas.height)
    return
  }

  if (isTouchDevice() && await canShareFile(blob, filename)) {
    const file = new File([blob], filename, { type: 'image/png' })
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export async function saveBlobImage(
  blob: Blob,
  filename: string,
): Promise<void> {
  if (isTouchDevice() && await canShareFile(blob, filename)) {
    const file = new File([blob], filename, { type: blob.type })
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}
