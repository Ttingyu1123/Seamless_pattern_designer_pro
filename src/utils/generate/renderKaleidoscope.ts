import type { KaleidoscopeConfig } from '../../store/generateStore'

export function renderKaleidoscopeTile(
  config: KaleidoscopeConfig,
  sourceImage: HTMLImageElement,
  tileWidth: number,
  tileHeight: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = tileWidth
  canvas.height = tileHeight
  const ctx = canvas.getContext('2d')!

  switch (config.symmetryGroup) {
    case 'p4m':
      applyP4m(ctx, sourceImage, config, tileWidth, tileHeight)
      break
    case 'p6m':
      applyP6m(ctx, sourceImage, config, tileWidth, tileHeight)
      break
    case 'p3m1':
      applyP3m1(ctx, sourceImage, config, tileWidth, tileHeight)
      break
    case 'pm':
      applyPm(ctx, sourceImage, config, tileWidth, tileHeight)
      break
    case 'cmm':
      applyCmm(ctx, sourceImage, config, tileWidth, tileHeight)
      break
  }

  return canvas
}

function extractDomain(
  sourceImage: HTMLImageElement,
  config: KaleidoscopeConfig,
  domainW: number,
  domainH: number,
  clipPath?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): HTMLCanvasElement {
  const domain = document.createElement('canvas')
  domain.width = domainW
  domain.height = domainH
  const ctx = domain.getContext('2d')!

  if (clipPath) {
    clipPath(ctx, domainW, domainH)
    ctx.clip()
  }

  const srcW = sourceImage.naturalWidth || sourceImage.width
  const srcH = sourceImage.naturalHeight || sourceImage.height
  const cx = config.cropCenter.x * srcW
  const cy = config.cropCenter.y * srcH
  const cropSize = config.cropRadius * Math.min(srcW, srcH)

  ctx.save()
  ctx.translate(domainW / 2, domainH / 2)
  ctx.rotate(config.rotation)
  ctx.drawImage(
    sourceImage,
    cx - cropSize, cy - cropSize, cropSize * 2, cropSize * 2,
    -domainW / 2, -domainH / 2, domainW, domainH,
  )
  ctx.restore()

  return domain
}

function applyP4m(
  ctx: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  config: KaleidoscopeConfig,
  w: number, h: number,
) {
  const size = Math.min(w, h)
  const half = size / 2

  const domain = extractDomain(sourceImage, config, half, half,
    (dCtx, dw, dh) => {
      dCtx.beginPath()
      dCtx.moveTo(0, 0)
      dCtx.lineTo(dw, 0)
      dCtx.lineTo(0, dh)
      dCtx.closePath()
    },
  )

  for (let rot = 0; rot < 4; rot++) {
    for (const flip of [1, -1]) {
      ctx.save()
      ctx.translate(half, half)
      ctx.rotate((rot * Math.PI) / 2)
      ctx.scale(flip, 1)
      ctx.drawImage(domain, 0, 0)
      ctx.restore()
    }
  }
}

function applyP6m(
  ctx: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  config: KaleidoscopeConfig,
  w: number, h: number,
) {
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) / 2

  const triW = r
  const triH = r * Math.sin(Math.PI / 3)

  const domain = extractDomain(sourceImage, config, Math.ceil(triW), Math.ceil(triH),
    (dCtx, dw, dh) => {
      dCtx.beginPath()
      dCtx.moveTo(0, 0)
      dCtx.lineTo(dw, 0)
      dCtx.lineTo(dw / 2, dh)
      dCtx.closePath()
    },
  )

  for (let rot = 0; rot < 6; rot++) {
    for (const flip of [1, -1]) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((rot * Math.PI) / 3)
      ctx.scale(flip, 1)
      ctx.drawImage(domain, 0, 0)
      ctx.restore()
    }
  }
}

function applyP3m1(
  ctx: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  config: KaleidoscopeConfig,
  w: number, h: number,
) {
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) / 2

  const triW = r
  const triH = r * Math.sin(Math.PI / 3)

  const domain = extractDomain(sourceImage, config, Math.ceil(triW), Math.ceil(triH),
    (dCtx, dw, dh) => {
      dCtx.beginPath()
      dCtx.moveTo(0, 0)
      dCtx.lineTo(dw, 0)
      dCtx.lineTo(dw / 2, dh)
      dCtx.closePath()
    },
  )

  for (let rot = 0; rot < 3; rot++) {
    for (const flip of [1, -1]) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((rot * Math.PI * 2) / 3)
      ctx.scale(flip, 1)
      ctx.drawImage(domain, 0, 0)
      ctx.restore()
    }
  }
}

function applyPm(
  ctx: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  config: KaleidoscopeConfig,
  w: number, h: number,
) {
  const halfW = w / 2

  const domain = extractDomain(sourceImage, config, halfW, h)

  ctx.drawImage(domain, 0, 0)

  ctx.save()
  ctx.translate(w, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(domain, 0, 0)
  ctx.restore()
}

function applyCmm(
  ctx: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  config: KaleidoscopeConfig,
  w: number, h: number,
) {
  const halfW = w / 2
  const halfH = h / 2

  const domain = extractDomain(sourceImage, config, halfW, halfH)

  // Top-left (original)
  ctx.drawImage(domain, 0, 0)

  // Top-right (mirror X)
  ctx.save()
  ctx.translate(w, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(domain, 0, 0)
  ctx.restore()

  // Bottom-left (mirror Y)
  ctx.save()
  ctx.translate(0, h)
  ctx.scale(1, -1)
  ctx.drawImage(domain, 0, 0)
  ctx.restore()

  // Bottom-right (rotate 180)
  ctx.save()
  ctx.translate(w, h)
  ctx.scale(-1, -1)
  ctx.drawImage(domain, 0, 0)
  ctx.restore()
}
