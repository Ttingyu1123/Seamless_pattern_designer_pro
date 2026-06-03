import type { GeometricConfig } from '../../store/generateStore'
import { drawIslamicStar } from './drawIslamicStar'
import { drawTessellation } from './drawTessellation'
import { drawWeave } from './drawWeave'

export function renderGeometricTile(
  config: GeometricConfig,
  tileWidth: number,
  tileHeight: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = tileWidth
  canvas.height = tileHeight
  const ctx = canvas.getContext('2d')!

  switch (config.patternType) {
    case 'islamic-star':
      drawIslamicStar(ctx, tileWidth, tileHeight, config.star)
      break
    case 'tessellation':
      drawTessellation(ctx, tileWidth, tileHeight, config.tessellation)
      break
    case 'weave':
      drawWeave(ctx, tileWidth, tileHeight, config.weave)
      break
  }

  return canvas
}
