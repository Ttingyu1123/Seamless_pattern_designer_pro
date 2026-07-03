import { describe, expect, it } from 'vitest'
import { getTileOffset, shouldFlipX, shouldFlipY, shouldMirrorTile } from '../src/utils/tilingEngine'

const base = { shiftPercent: 50, tileWidth: 100, tileHeight: 80 }

describe('getTileOffset', () => {
  it('grid mode never offsets', () => {
    for (const [row, col] of [[0, 0], [1, 2], [-3, 5]]) {
      expect(getTileOffset({ ...base, row, col, repeatMode: 'grid' })).toEqual({ offsetX: 0, offsetY: 0 })
    }
  })

  it('half-drop-row shifts odd rows horizontally by shift percent', () => {
    expect(getTileOffset({ ...base, row: 1, col: 0, repeatMode: 'half-drop-row' })).toEqual({ offsetX: 50, offsetY: 0 })
    expect(getTileOffset({ ...base, row: 2, col: 0, repeatMode: 'half-drop-row' })).toEqual({ offsetX: 0, offsetY: 0 })
    expect(getTileOffset({ ...base, row: -1, col: 0, repeatMode: 'half-drop-row' })).toEqual({ offsetX: 50, offsetY: 0 })
  })

  it('half-drop-column shifts odd columns vertically', () => {
    expect(getTileOffset({ ...base, row: 0, col: 1, repeatMode: 'half-drop-column' })).toEqual({ offsetX: 0, offsetY: 40 })
    expect(getTileOffset({ ...base, row: 0, col: 2, repeatMode: 'half-drop-column' })).toEqual({ offsetX: 0, offsetY: 0 })
  })

  it('half-brick always uses 50% regardless of shiftPercent', () => {
    expect(getTileOffset({ ...base, shiftPercent: 30, row: 1, col: 0, repeatMode: 'half-brick' })).toEqual({ offsetX: 50, offsetY: 0 })
  })

  it('shiftPercent is clamped to 0..100', () => {
    expect(getTileOffset({ ...base, shiftPercent: 150, row: 1, col: 0, repeatMode: 'half-drop-row' })).toEqual({ offsetX: 100, offsetY: 0 })
    expect(getTileOffset({ ...base, shiftPercent: -10, row: 1, col: 0, repeatMode: 'half-drop-row' })).toEqual({ offsetX: 0, offsetY: 0 })
  })

  it('diamond offsets accumulate per row and column', () => {
    expect(getTileOffset({ ...base, row: 2, col: 3, repeatMode: 'diamond' })).toEqual({ offsetX: 150, offsetY: 80 })
  })
})

describe('mirror flips', () => {
  it('mirror-x flips odd columns only', () => {
    expect(shouldFlipX(0, 1, 'mirror-x')).toBe(true)
    expect(shouldFlipX(5, 2, 'mirror-x')).toBe(false)
    expect(shouldFlipY(1, 0, 'mirror-x')).toBe(false)
  })

  it('mirror-y flips odd rows only', () => {
    expect(shouldFlipY(1, 0, 'mirror-y')).toBe(true)
    expect(shouldFlipY(2, 0, 'mirror-y')).toBe(false)
    expect(shouldFlipX(0, 1, 'mirror-y')).toBe(false)
  })

  it('mirror-xy flips both axes independently', () => {
    expect(shouldFlipX(0, -1, 'mirror-xy')).toBe(true)
    expect(shouldFlipY(-1, 0, 'mirror-xy')).toBe(true)
  })

  it('negative indices behave like positive ones', () => {
    expect(shouldFlipX(0, -3, 'mirror-x')).toBe(true)
    expect(shouldFlipY(-2, 0, 'mirror-y')).toBe(false)
  })
})

describe('shouldMirrorTile (checkerboard mirror)', () => {
  it('mirrors when row+col is odd and mirror is enabled', () => {
    expect(shouldMirrorTile(0, 1, true)).toBe(true)
    expect(shouldMirrorTile(1, 1, true)).toBe(false)
    expect(shouldMirrorTile(0, 1, false)).toBe(false)
    expect(shouldMirrorTile(-1, 0, true)).toBe(true)
  })
})
