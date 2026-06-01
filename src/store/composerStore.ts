import { create } from 'zustand'
import { temporal } from 'zundo'
import type { RepeatMode } from '../utils/tilingEngine'

export type TileSizeUnit = 'px' | 'mm'
export type TileDirection = 'both' | 'horizontal'
export type GuideType = 'center' | 'thirds' | 'quadrants' | 'mode-specific'
export type ComposeTool = 'select' | 'pan'

export interface MotifLayer {
  id: string
  name: string
  imageDataUrl: string
  naturalWidth: number
  naturalHeight: number
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  opacity: number
  hue: number
  saturation: number
  brightness: number
  visible: boolean
  locked: boolean
}

export interface ComposerState {
  tileSizePx: { width: number; height: number }
  tileSizeUnit: TileSizeUnit
  tileDpi: number
  aspectLocked: boolean
  backgroundColor: string | null

  layers: MotifLayer[]
  selectedLayerId: string | null
  activeTool: ComposeTool

  repeatMode: RepeatMode
  shiftPercent: number
  tileDirection: TileDirection
  showGuides: boolean
  guideType: GuideType
  snapEnabled: boolean
  activeSnapLinesX: number[]
  activeSnapLinesY: number[]

  previewTilesX: number
  previewTilesY: number
}

export interface ComposerActions {
  setTileSize: (size: { width: number; height: number }) => void
  setTileSizeUnit: (unit: TileSizeUnit) => void
  setTileDpi: (dpi: number) => void
  setAspectLocked: (locked: boolean) => void
  setBackgroundColor: (color: string | null) => void

  addLayer: (layer: MotifLayer) => void
  removeLayer: (id: string) => void
  updateLayer: (id: string, partial: Partial<MotifLayer>) => void
  reorderLayer: (fromIdx: number, toIdx: number) => void
  duplicateLayer: (id: string) => void
  selectLayer: (id: string | null) => void
  setActiveTool: (tool: ComposeTool) => void

  setRepeatMode: (mode: RepeatMode) => void
  setShiftPercent: (percent: number) => void
  setTileDirection: (dir: TileDirection) => void
  setShowGuides: (show: boolean) => void
  setGuideType: (type: GuideType) => void
  setSnapEnabled: (enabled: boolean) => void

  setPreviewTilesX: (n: number) => void
  setPreviewTilesY: (n: number) => void
  setActiveSnapLines: (x: number[], y: number[]) => void
}

const initialState: ComposerState = {
  tileSizePx: { width: 500, height: 500 },
  tileSizeUnit: 'px',
  tileDpi: 300,
  aspectLocked: false,
  backgroundColor: null,

  layers: [],
  selectedLayerId: null,
  activeTool: 'select',

  repeatMode: 'grid',
  shiftPercent: 50,
  tileDirection: 'both',
  showGuides: false,
  guideType: 'center',
  snapEnabled: true,
  activeSnapLinesX: [],
  activeSnapLinesY: [],

  previewTilesX: 3,
  previewTilesY: 3,
}

export const useComposerStore = create<ComposerState & ComposerActions>()(
  temporal(
    (set) => ({
      ...initialState,

      setTileSize: (size) => set({ tileSizePx: size }),
      setTileSizeUnit: (unit) => set({ tileSizeUnit: unit }),
      setTileDpi: (dpi) => set({ tileDpi: dpi }),
      setAspectLocked: (locked) => set({ aspectLocked: locked }),
      setBackgroundColor: (color) => set({ backgroundColor: color }),

      addLayer: (layer) =>
        set((s) => ({ layers: [...s.layers, layer], selectedLayerId: layer.id })),

      removeLayer: (id) =>
        set((s) => ({
          layers: s.layers.filter((l) => l.id !== id),
          selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
        })),

      updateLayer: (id, partial) =>
        set((s) => ({
          layers: s.layers.map((l) => (l.id === id ? { ...l, ...partial } : l)),
        })),

      reorderLayer: (fromIdx, toIdx) =>
        set((s) => {
          const next = [...s.layers]
          const [moved] = next.splice(fromIdx, 1)
          next.splice(toIdx, 0, moved)
          return { layers: next }
        }),

      duplicateLayer: (id) =>
        set((s) => {
          const source = s.layers.find((l) => l.id === id)
          if (!source) return s
          const dup: MotifLayer = {
            ...source,
            id: crypto.randomUUID(),
            name: `${source.name} copy`,
            x: source.x + 20,
            y: source.y + 20,
          }
          const idx = s.layers.findIndex((l) => l.id === id)
          const next = [...s.layers]
          next.splice(idx + 1, 0, dup)
          return { layers: next, selectedLayerId: dup.id }
        }),

      selectLayer: (id) => set({ selectedLayerId: id }),
      setActiveTool: (tool) => set({ activeTool: tool }),

      setRepeatMode: (mode) => set({ repeatMode: mode }),
      setShiftPercent: (percent) => set({ shiftPercent: percent }),
      setTileDirection: (dir) => set({ tileDirection: dir }),
      setShowGuides: (show) => set({ showGuides: show }),
      setGuideType: (type) => set({ guideType: type }),
      setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),

      setPreviewTilesX: (n) => set({ previewTilesX: n }),
      setPreviewTilesY: (n) => set({ previewTilesY: n }),
      setActiveSnapLines: (x, y) => set({ activeSnapLinesX: x, activeSnapLinesY: y }),
    }),
    { limit: 50 },
  ),
)
