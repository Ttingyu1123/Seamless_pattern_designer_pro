import type { MotifLayer } from '../store/composerStore'
import type { RepeatMode } from './tilingEngine'
import type { TileDirection, GuideType } from '../store/composerStore'

interface ProjectData {
  version: 1
  tileSizePx: { width: number; height: number }
  tileSizeUnit: 'px' | 'mm' | 'cm'
  tileDpi: number
  aspectLocked: boolean
  backgroundColor: string | null
  repeatMode: RepeatMode
  shiftPercent: number
  tileDirection: TileDirection
  showGuides: boolean
  guideType: GuideType
  snapEnabled: boolean
  previewTilesX: number
  previewTilesY: number
  layers: MotifLayer[]
}

export function serializeProject(state: {
  tileSizePx: { width: number; height: number }
  tileSizeUnit: 'px' | 'mm' | 'cm'
  tileDpi: number
  aspectLocked: boolean
  backgroundColor: string | null
  repeatMode: RepeatMode
  shiftPercent: number
  tileDirection: TileDirection
  showGuides: boolean
  guideType: GuideType
  snapEnabled: boolean
  previewTilesX: number
  previewTilesY: number
  layers: MotifLayer[]
}): string {
  const data: ProjectData = {
    version: 1,
    ...state,
  }
  return JSON.stringify(data)
}

const VALID_REPEAT_MODES = new Set<string>([
  'grid', 'half-drop-row', 'half-drop-column', 'half-brick',
  'mirror-x', 'mirror-y', 'mirror-xy', 'hexagonal', 'diamond', 'horizontal-only',
])
const VALID_UNITS = new Set<string>(['px', 'mm', 'cm'])
const VALID_DIRECTIONS = new Set<string>(['both', 'horizontal'])
const VALID_GUIDE_TYPES = new Set<string>(['center', 'thirds', 'quadrants', 'mode-specific'])

function isFinitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function isFiniteNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

export function deserializeProject(json: string): ProjectData | null {
  try {
    const data = JSON.parse(json)
    if (data.version !== 1) return null
    if (!data.tileSizePx || !Array.isArray(data.layers)) return null

    if (!isFinitePositive(data.tileSizePx.width) || !isFinitePositive(data.tileSizePx.height)) return null
    data.tileSizePx.width = clamp(Math.round(data.tileSizePx.width), 1, 10000)
    data.tileSizePx.height = clamp(Math.round(data.tileSizePx.height), 1, 10000)

    if (!VALID_REPEAT_MODES.has(data.repeatMode)) data.repeatMode = 'grid'
    if (!VALID_UNITS.has(data.tileSizeUnit)) data.tileSizeUnit = 'px'
    if (!VALID_DIRECTIONS.has(data.tileDirection)) data.tileDirection = 'both'
    if (!VALID_GUIDE_TYPES.has(data.guideType)) data.guideType = 'center'

    if (!isFinitePositive(data.tileDpi)) data.tileDpi = 300
    data.tileDpi = clamp(data.tileDpi, 72, 1200)

    if (!isFiniteNum(data.shiftPercent)) data.shiftPercent = 50
    data.shiftPercent = clamp(data.shiftPercent, 0, 100)

    if (!isFiniteNum(data.previewTilesX)) data.previewTilesX = 3
    if (!isFiniteNum(data.previewTilesY)) data.previewTilesY = 3
    data.previewTilesX = clamp(Math.round(data.previewTilesX), 2, 8)
    data.previewTilesY = clamp(Math.round(data.previewTilesY), 2, 8)

    data.aspectLocked = !!data.aspectLocked
    data.showGuides = !!data.showGuides
    data.snapEnabled = data.snapEnabled !== false

    if (data.backgroundColor !== null && typeof data.backgroundColor !== 'string') {
      data.backgroundColor = null
    }

    const validLayers: MotifLayer[] = []
    for (const l of data.layers) {
      if (!l || typeof l !== 'object') continue
      if (!l.id || typeof l.id !== 'string') continue
      if (!l.imageDataUrl || typeof l.imageDataUrl !== 'string') continue
      if (l.imageDataUrl.length > 50_000_000) continue

      validLayers.push({
        id: l.id,
        name: typeof l.name === 'string' ? l.name : 'Untitled',
        imageDataUrl: l.imageDataUrl,
        naturalWidth: isFinitePositive(l.naturalWidth) ? l.naturalWidth : 100,
        naturalHeight: isFinitePositive(l.naturalHeight) ? l.naturalHeight : 100,
        x: isFiniteNum(l.x) ? l.x : 0,
        y: isFiniteNum(l.y) ? l.y : 0,
        rotation: isFiniteNum(l.rotation) ? l.rotation : 0,
        scaleX: isFiniteNum(l.scaleX) ? clamp(l.scaleX, 0.01, 100) : 1,
        scaleY: isFiniteNum(l.scaleY) ? clamp(l.scaleY, 0.01, 100) : 1,
        opacity: isFiniteNum(l.opacity) ? clamp(l.opacity, 0, 1) : 1,
        hue: isFiniteNum(l.hue) ? l.hue : 0,
        saturation: isFiniteNum(l.saturation) ? l.saturation : 0,
        brightness: isFiniteNum(l.brightness) ? l.brightness : 0,
        visible: l.visible !== false,
        locked: !!l.locked,
      })
    }
    data.layers = validLayers

    return data as ProjectData
  } catch {
    return null
  }
}

export function downloadProject(state: Parameters<typeof serializeProject>[0]) {
  const json = serializeProject(state)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const w = state.tileSizePx.width
  const h = state.tileSizePx.height
  link.download = `pattern_${w}x${h}_${Date.now()}.spc`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

export function openProjectFile(): Promise<ProjectData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.spc,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      const text = await file.text()
      resolve(deserializeProject(text))
    }
    input.click()
  })
}

const AUTOSAVE_KEY = 'seamless-pattern-composer-autosave'

export function autoSave(state: Parameters<typeof serializeProject>[0]) {
  try {
    const json = serializeProject(state)
    localStorage.setItem(AUTOSAVE_KEY, json)
  } catch {
    // localStorage full or unavailable
  }
}

export function loadAutoSave(): ProjectData | null {
  try {
    const json = localStorage.getItem(AUTOSAVE_KEY)
    if (!json) return null
    return deserializeProject(json)
  } catch {
    return null
  }
}

export function clearAutoSave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    // ignore
  }
}
