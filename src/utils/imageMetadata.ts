export type ImageKind = 'png' | 'jpeg' | 'unknown'

export interface ImageMetadata {
  kind: ImageKind
  dpi: number | null
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]
}

function parsePngDpi(bytes: Uint8Array): number | null {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10]
  for (let i = 0; i < sig.length; i += 1) {
    if (bytes[i] !== sig[i]) return null
  }

  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = readUInt32BE(bytes, offset)
    const typeOffset = offset + 4
    const dataOffset = offset + 8
    const chunkType = String.fromCharCode(
      bytes[typeOffset],
      bytes[typeOffset + 1],
      bytes[typeOffset + 2],
      bytes[typeOffset + 3],
    )

    if (chunkType === 'pHYs' && length >= 9 && dataOffset + length <= bytes.length) {
      const ppmX = readUInt32BE(bytes, dataOffset)
      const ppmY = readUInt32BE(bytes, dataOffset + 4)
      const unit = bytes[dataOffset + 8]
      if (unit === 1) {
        const dpiX = ppmX * 0.0254
        const dpiY = ppmY * 0.0254
        return (dpiX + dpiY) / 2
      }
      return null
    }

    offset = dataOffset + length + 4
  }

  return null
}

function parseJpegDpi(bytes: Uint8Array): number | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null
  }

  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = bytes[offset + 1]
    if (marker === 0xd9 || marker === 0xda) break

    const size = (bytes[offset + 2] << 8) + bytes[offset + 3]
    if (size < 2 || offset + 2 + size > bytes.length) break

    if (marker === 0xe0) {
      const start = offset + 4
      if (
        start + 14 <= bytes.length &&
        bytes[start] === 0x4a &&
        bytes[start + 1] === 0x46 &&
        bytes[start + 2] === 0x49 &&
        bytes[start + 3] === 0x46 &&
        bytes[start + 4] === 0x00
      ) {
        const units = bytes[start + 7]
        const densityX = (bytes[start + 8] << 8) + bytes[start + 9]
        const densityY = (bytes[start + 10] << 8) + bytes[start + 11]

        if (units === 1) {
          return (densityX + densityY) / 2
        }

        if (units === 2) {
          return ((densityX + densityY) / 2) * 2.54
        }
      }
    }

    offset += 2 + size
  }

  return null
}

export async function readImageMetadata(file: File): Promise<ImageMetadata> {
  const kind = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpeg' : 'unknown'
  const bytes = new Uint8Array(await file.arrayBuffer())

  if (kind === 'png') {
    return { kind, dpi: parsePngDpi(bytes) }
  }

  if (kind === 'jpeg') {
    return { kind, dpi: parseJpegDpi(bytes) }
  }

  return { kind, dpi: null }
}

export function convertToPixels(value: number, unit: 'px' | 'in' | 'cm', dpi: number): number {
  const safeValue = Math.max(1, value)
  const safeDpi = Math.max(1, dpi)

  if (unit === 'px') return Math.round(safeValue)
  if (unit === 'in') return Math.round(safeValue * safeDpi)
  return Math.round((safeValue / 2.54) * safeDpi)
}
