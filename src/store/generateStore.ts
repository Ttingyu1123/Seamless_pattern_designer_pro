import { create } from 'zustand'
import type { RepeatMode } from '../utils/tilingEngine'

export type GenerateSubMode = 'geometric' | 'kaleidoscope'
export type GeometricPatternType = 'islamic-star' | 'tessellation' | 'weave'
export type TessellationType = 'triangular' | 'square' | 'hexagonal' | '3.6.3.6' | '3.3.4.3.4'
export type WeaveType = 'y-hex' | 'basket' | 'herringbone'
export type WallpaperGroup = 'p4m' | 'p6m' | 'p3m1' | 'pm' | 'cmm'

export interface IslamicStarConfig {
  points: 6 | 8 | 12
  starAngle: number
  lineWidth: number
  lineColor: string
  fillColors: [string, string, string]
  backgroundColor: string
  scale: number
}

export interface TessellationConfig {
  tessType: TessellationType
  strokeWidth: number
  strokeColor: string
  fillColors: [string, string, string]
  backgroundColor: string
  scale: number
}

export interface WeaveConfig {
  weaveType: WeaveType
  lineWidth: number
  lineColor: string
  depth: number
  fillColors: [string, string]
  backgroundColor: string
  scale: number
}

export type GeometricConfig =
  | { patternType: 'islamic-star'; star: IslamicStarConfig }
  | { patternType: 'tessellation'; tessellation: TessellationConfig }
  | { patternType: 'weave'; weave: WeaveConfig }

export interface KaleidoscopeConfig {
  symmetryGroup: WallpaperGroup
  sourceImageDataUrl: string | null
  cropCenter: { x: number; y: number }
  cropRadius: number
  rotation: number
}

export interface GenerateState {
  subMode: GenerateSubMode
  tileSizePx: { width: number; height: number }

  geometric: GeometricConfig
  kaleidoscope: KaleidoscopeConfig

  generatedTileCanvas: HTMLCanvasElement | null

  repeatMode: RepeatMode
  shiftPercent: number
  previewTilesX: number
  previewTilesY: number
}

export interface GenerateActions {
  setSubMode: (mode: GenerateSubMode) => void
  setTileSize: (size: { width: number; height: number }) => void

  setGeometricPatternType: (type: GeometricPatternType) => void
  updateStarConfig: (partial: Partial<IslamicStarConfig>) => void
  updateTessellationConfig: (partial: Partial<TessellationConfig>) => void
  updateWeaveConfig: (partial: Partial<WeaveConfig>) => void

  setSymmetryGroup: (group: WallpaperGroup) => void
  setKaleidoscopeSource: (dataUrl: string) => void
  clearKaleidoscopeSource: () => void
  updateCrop: (partial: Partial<Pick<KaleidoscopeConfig, 'cropCenter' | 'cropRadius' | 'rotation'>>) => void

  setGeneratedTileCanvas: (canvas: HTMLCanvasElement | null) => void

  setRepeatMode: (mode: RepeatMode) => void
  setShiftPercent: (pct: number) => void
  setPreviewTilesX: (n: number) => void
  setPreviewTilesY: (n: number) => void
}

const defaultStar: IslamicStarConfig = {
  points: 6,
  starAngle: 0.5,
  lineWidth: 2,
  lineColor: '#1a1a2e',
  fillColors: ['#16a085', '#1abc9c', '#d4ac0d'],
  backgroundColor: '#ffffff',
  scale: 3,
}

const defaultTessellation: TessellationConfig = {
  tessType: 'hexagonal',
  strokeWidth: 2,
  strokeColor: '#2c3e50',
  fillColors: ['#3498db', '#2ecc71', '#e74c3c'],
  backgroundColor: '#ecf0f1',
  scale: 4,
}

const defaultWeave: WeaveConfig = {
  weaveType: 'y-hex',
  lineWidth: 4,
  lineColor: '#2c3e50',
  depth: 0.5,
  fillColors: ['#34495e', '#7f8c8d'],
  backgroundColor: '#ffffff',
  scale: 3,
}

const initialState: GenerateState = {
  subMode: 'geometric',
  tileSizePx: { width: 500, height: 500 },

  geometric: { patternType: 'islamic-star', star: { ...defaultStar } },
  kaleidoscope: {
    symmetryGroup: 'p6m',
    sourceImageDataUrl: null,
    cropCenter: { x: 0.5, y: 0.5 },
    cropRadius: 0.4,
    rotation: 0,
  },

  generatedTileCanvas: null,

  repeatMode: 'grid',
  shiftPercent: 50,
  previewTilesX: 3,
  previewTilesY: 3,
}

export const useGenerateStore = create<GenerateState & GenerateActions>()(
  (set) => ({
    ...initialState,

    setSubMode: (mode) => set({ subMode: mode }),
    setTileSize: (size) => set({ tileSizePx: size }),

    setGeometricPatternType: (type) =>
      set((s) => {
        if (type === 'islamic-star') return { geometric: { patternType: type, star: s.geometric.patternType === 'islamic-star' ? s.geometric.star : { ...defaultStar } } }
        if (type === 'tessellation') return { geometric: { patternType: type, tessellation: s.geometric.patternType === 'tessellation' ? s.geometric.tessellation : { ...defaultTessellation } } }
        return { geometric: { patternType: type, weave: s.geometric.patternType === 'weave' ? s.geometric.weave : { ...defaultWeave } } }
      }),

    updateStarConfig: (partial) =>
      set((s) => {
        if (s.geometric.patternType !== 'islamic-star') return s
        return { geometric: { patternType: 'islamic-star', star: { ...s.geometric.star, ...partial } } }
      }),

    updateTessellationConfig: (partial) =>
      set((s) => {
        if (s.geometric.patternType !== 'tessellation') return s
        return { geometric: { patternType: 'tessellation', tessellation: { ...s.geometric.tessellation, ...partial } } }
      }),

    updateWeaveConfig: (partial) =>
      set((s) => {
        if (s.geometric.patternType !== 'weave') return s
        return { geometric: { patternType: 'weave', weave: { ...s.geometric.weave, ...partial } } }
      }),

    setSymmetryGroup: (group) =>
      set((s) => ({ kaleidoscope: { ...s.kaleidoscope, symmetryGroup: group } })),

    setKaleidoscopeSource: (dataUrl) =>
      set((s) => ({ kaleidoscope: { ...s.kaleidoscope, sourceImageDataUrl: dataUrl } })),

    clearKaleidoscopeSource: () =>
      set((s) => ({ kaleidoscope: { ...s.kaleidoscope, sourceImageDataUrl: null } })),

    updateCrop: (partial) =>
      set((s) => ({ kaleidoscope: { ...s.kaleidoscope, ...partial } })),

    setGeneratedTileCanvas: (canvas) => set({ generatedTileCanvas: canvas }),

    setRepeatMode: (mode) => set({ repeatMode: mode }),
    setShiftPercent: (pct) => set({ shiftPercent: pct }),
    setPreviewTilesX: (n) => set({ previewTilesX: n }),
    setPreviewTilesY: (n) => set({ previewTilesY: n }),
  }),
)
