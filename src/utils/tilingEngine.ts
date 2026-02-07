export type RepeatMode = 'grid' | 'half-drop-row' | 'half-drop-column'

export interface RepeatBaseSize {
  width: number
  height: number
}

export interface TileOffsetInput {
  row: number
  col: number
  repeatMode: RepeatMode
  shiftPercent: number
  tileWidth: number
  tileHeight: number
}

export interface TileOffset {
  offsetX: number
  offsetY: number
}

export function getTileOffset({
  row,
  col,
  repeatMode,
  shiftPercent,
  tileWidth,
  tileHeight,
}: TileOffsetInput): TileOffset {
  const shift = Math.min(1, Math.max(0, shiftPercent / 100))
  const rowIsOdd = Math.abs(row) % 2 === 1
  const colIsOdd = Math.abs(col) % 2 === 1

  if (repeatMode === 'half-drop-row' && rowIsOdd) {
    return { offsetX: tileWidth * shift, offsetY: 0 }
  }

  if (repeatMode === 'half-drop-column' && colIsOdd) {
    return { offsetX: 0, offsetY: tileHeight * shift }
  }

  return { offsetX: 0, offsetY: 0 }
}

export function shouldMirrorTile(row: number, col: number, mirrorEnabled: boolean): boolean {
  return mirrorEnabled && Math.abs(row + col) % 2 === 1
}

export function createBaseTileCanvas(
  source: ImageBitmap,
  repeatBase: RepeatBaseSize,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(repeatBase.width))
  canvas.height = Math.max(1, Math.round(repeatBase.height))
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return canvas
  }

  const cols = Math.ceil(canvas.width / source.width)
  const rows = Math.ceil(canvas.height / source.height)

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      ctx.drawImage(source, col * source.width, row * source.height)
    }
  }

  return canvas
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  offsetX: number,
  offsetY: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(dx, dy, dw, dh)
  ctx.clip()

  const normalizedX = ((offsetX % source.width) + source.width) % source.width
  const normalizedY = ((offsetY % source.height) + source.height) % source.height

  for (let y = -source.height; y <= dh + source.height; y += source.height) {
    for (let x = -source.width; x <= dw + source.width; x += source.width) {
      ctx.drawImage(source, dx - normalizedX + x, dy - normalizedY + y)
    }
  }

  ctx.restore()
}

export function createOffsetPreviewTile(baseTile: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = baseTile.width
  canvas.height = baseTile.height
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return canvas
  }

  const halfW = canvas.width / 2
  const halfH = canvas.height / 2

  drawWrapped(ctx, baseTile, 0, 0, 0, 0, halfW, halfH)
  drawWrapped(ctx, baseTile, canvas.width / 2, 0, halfW, 0, halfW, halfH)
  drawWrapped(ctx, baseTile, 0, canvas.height / 2, 0, halfH, halfW, halfH)
  drawWrapped(
    ctx,
    baseTile,
    canvas.width / 2,
    canvas.height / 2,
    halfW,
    halfH,
    halfW,
    halfH,
  )

  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(halfW, 0)
  ctx.lineTo(halfW, canvas.height)
  ctx.moveTo(0, halfH)
  ctx.lineTo(canvas.width, halfH)
  ctx.stroke()

  return canvas
}
