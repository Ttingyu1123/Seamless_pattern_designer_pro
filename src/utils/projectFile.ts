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

export function deserializeProject(json: string): ProjectData | null {
  try {
    const data = JSON.parse(json)
    if (data.version !== 1) return null
    if (!data.tileSizePx || !Array.isArray(data.layers)) return null
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
