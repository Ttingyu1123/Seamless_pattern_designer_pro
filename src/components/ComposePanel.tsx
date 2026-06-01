import { useCallback, useRef, useState } from 'react'
import { useComposerStore } from '../store/composerStore'
import type { MotifLayer } from '../store/composerStore'
import { ComposeTileConfig } from './ComposeTileConfig'
import { ScatterDialog } from './ScatterDialog'
import { composeText } from '../i18n-compose'
import { loadLayerImage, getLayerImageCache } from '../hooks/useComposerEngine'
import { exportSingleTile, exportTiledImage } from '../utils/composeExport'
import { downloadProject, openProjectFile } from '../utils/projectFile'
import type { UILang } from '../i18n'
import type { RepeatMode } from '../utils/tilingEngine'

interface Props {
  lang: UILang
}

export function ComposePanel({ lang }: Props) {
  const text = composeText[lang]
  const fileRef = useRef<HTMLInputElement>(null)

  const layers = useComposerStore((s) => s.layers)
  const selectedLayerId = useComposerStore((s) => s.selectedLayerId)
  const repeatMode = useComposerStore((s) => s.repeatMode)
  const shiftPercent = useComposerStore((s) => s.shiftPercent)
  const showGuides = useComposerStore((s) => s.showGuides)
  const snapEnabled = useComposerStore((s) => s.snapEnabled)
  const backgroundColor = useComposerStore((s) => s.backgroundColor)
  const tileDirection = useComposerStore((s) => s.tileDirection)
  const tileSizePx = useComposerStore((s) => s.tileSizePx)

  const addLayer = useComposerStore((s) => s.addLayer)
  const removeLayer = useComposerStore((s) => s.removeLayer)
  const selectLayer = useComposerStore((s) => s.selectLayer)
  const duplicateLayer = useComposerStore((s) => s.duplicateLayer)
  const updateLayer = useComposerStore((s) => s.updateLayer)
  const reorderLayer = useComposerStore((s) => s.reorderLayer)
  const guideType = useComposerStore((s) => s.guideType)
  const setShowGuides = useComposerStore((s) => s.setShowGuides)
  const setGuideType = useComposerStore((s) => s.setGuideType)
  const setSnapEnabled = useComposerStore((s) => s.setSnapEnabled)
  const previewTilesX = useComposerStore((s) => s.previewTilesX)
  const previewTilesY = useComposerStore((s) => s.previewTilesY)
  const setRepeatMode = useComposerStore((s) => s.setRepeatMode)
  const setShiftPercent = useComposerStore((s) => s.setShiftPercent)
  const setTileDirection = useComposerStore((s) => s.setTileDirection)
  const setPreviewTilesX = useComposerStore((s) => s.setPreviewTilesX)
  const setPreviewTilesY = useComposerStore((s) => s.setPreviewTilesY)

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const dataUrl = await readFileAsDataUrl(file)
      const { width, height } = await getImageDimensions(dataUrl)
      const fitScale = Math.min(
        tileSizePx.width * 0.7 / width,
        tileSizePx.height * 0.7 / height,
        1,
      )

      const layer: MotifLayer = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ''),
        imageDataUrl: dataUrl,
        naturalWidth: width,
        naturalHeight: height,
        x: tileSizePx.width / 2,
        y: tileSizePx.height / 2,
        rotation: 0,
        scaleX: fitScale,
        scaleY: fitScale,
        opacity: 1,
        hue: 0,
        saturation: 0,
        brightness: 0,
        visible: true,
        locked: false,
      }
      await loadLayerImage(layer)
      addLayer(layer)
    }
  }, [addLayer, tileSizePx])

  const handleUploadClick = () => fileRef.current?.click()

  const handleExportTile = useCallback(() => {
    if (layers.length === 0) return
    const imageCache = getLayerImageCache()
    const effectiveMode = tileDirection === 'horizontal' ? 'horizontal-only' as const : repeatMode
    exportSingleTile(layers, tileSizePx.width, tileSizePx.height, backgroundColor, imageCache, effectiveMode, shiftPercent)
  }, [layers, tileSizePx, backgroundColor, repeatMode, shiftPercent, tileDirection])

  const handleExportTiled = useCallback(() => {
    if (layers.length === 0) return
    const imageCache = getLayerImageCache()
    const effectiveMode = tileDirection === 'horizontal' ? 'horizontal-only' as const : repeatMode
    const tilesY = tileDirection === 'horizontal' ? 1 : previewTilesY
    exportTiledImage(
      layers, tileSizePx.width, tileSizePx.height, backgroundColor, imageCache,
      effectiveMode, shiftPercent, previewTilesX, tilesY,
    )
  }, [layers, tileSizePx, backgroundColor, repeatMode, shiftPercent, tileDirection, previewTilesX, previewTilesY])

  const handleSave = useCallback(() => {
    const s = useComposerStore.getState()
    downloadProject({
      tileSizePx: s.tileSizePx,
      tileSizeUnit: s.tileSizeUnit,
      tileDpi: s.tileDpi,
      aspectLocked: s.aspectLocked,
      backgroundColor: s.backgroundColor,
      repeatMode: s.repeatMode,
      shiftPercent: s.shiftPercent,
      tileDirection: s.tileDirection,
      showGuides: s.showGuides,
      guideType: s.guideType,
      snapEnabled: s.snapEnabled,
      previewTilesX: s.previewTilesX,
      previewTilesY: s.previewTilesY,
      layers: s.layers,
    })
  }, [])

  const handleLoad = useCallback(async () => {
    const data = await openProjectFile()
    if (!data) return
    const s = useComposerStore.getState()
    s.setTileSize(data.tileSizePx)
    s.setTileSizeUnit(data.tileSizeUnit)
    s.setTileDpi(data.tileDpi)
    s.setAspectLocked(data.aspectLocked)
    s.setBackgroundColor(data.backgroundColor)
    s.setRepeatMode(data.repeatMode)
    s.setShiftPercent(data.shiftPercent)
    s.setTileDirection(data.tileDirection)
    s.setShowGuides(data.showGuides)
    s.setGuideType(data.guideType)
    s.setSnapEnabled(data.snapEnabled)
    s.setPreviewTilesX(data.previewTilesX)
    s.setPreviewTilesY(data.previewTilesY)
    // Restore layers: clear existing, add new
    for (const existing of useComposerStore.getState().layers) {
      s.removeLayer(existing.id)
    }
    for (const layer of data.layers) {
      await loadLayerImage(layer)
      s.addLayer(layer)
    }
  }, [])

  const [scatterLayer, setScatterLayer] = useState<MotifLayer | null>(null)
  const selectedLayer = layers.find((l) => l.id === selectedLayerId)

  return (
    <>
    <aside className="compose-panel">
      <div className="compose-panel-scroll">
        <ComposeTileConfig lang={lang} />

        {/* Layer list */}
        <div className="compose-section">
          <h4 className="section-title">{text.layers}</h4>
          {layers.length === 0 && (
            <p className="empty-hint">{text.noLayers}</p>
          )}
          <div className="layer-list">
            {[...layers].reverse().map((layer) => {
              const realIdx = layers.findIndex((l) => l.id === layer.id)
              return (
              <div
                key={layer.id}
                className={`layer-item ${layer.id === selectedLayerId ? 'selected' : ''}`}
                onClick={() => selectLayer(layer.id)}
              >
                <button
                  className="layer-vis-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    updateLayer(layer.id, { visible: !layer.visible })
                  }}
                  title={layer.visible ? text.layerVisible : text.layerHidden}
                >
                  {layer.visible ? '👁' : '👁‍🗨'}
                </button>
                <div className="layer-reorder-btns">
                  <button
                    className="layer-reorder-btn"
                    disabled={realIdx >= layers.length - 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      reorderLayer(realIdx, realIdx + 1)
                    }}
                    title={lang === 'zh' ? '上移' : 'Move Up'}
                  >
                    ▲
                  </button>
                  <button
                    className="layer-reorder-btn"
                    disabled={realIdx <= 0}
                    onClick={(e) => {
                      e.stopPropagation()
                      reorderLayer(realIdx, realIdx - 1)
                    }}
                    title={lang === 'zh' ? '下移' : 'Move Down'}
                  >
                    ▼
                  </button>
                </div>
                <span className="layer-name">{layer.name}</span>
                <button
                  className="layer-action-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setScatterLayer(layer)
                  }}
                  title={lang === 'zh' ? '散佈' : 'Scatter'}
                >
                  ✦
                </button>
                <button
                  className="layer-action-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    duplicateLayer(layer.id)
                  }}
                  title={text.duplicate}
                >
                  ⊕
                </button>
                <button
                  className="layer-action-btn danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeLayer(layer.id)
                  }}
                  title={text.delete}
                >
                  ✕
                </button>
              </div>
              )
            })}
          </div>
          <button className="upload-btn" onClick={handleUploadClick}>
            {text.upload}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {/* Color controls for selected layer */}
        {selectedLayer && (
          <div className="compose-section">
            <h4 className="section-title">{text.colorAdjust}</h4>
            <SliderRow
              label={text.hue} min={-180} max={180} value={selectedLayer.hue}
              onChange={(v) => updateLayer(selectedLayer.id, { hue: v })}
            />
            <SliderRow
              label={text.saturation} min={-100} max={100} value={selectedLayer.saturation}
              onChange={(v) => updateLayer(selectedLayer.id, { saturation: v })}
            />
            <SliderRow
              label={text.brightness} min={-100} max={100} value={selectedLayer.brightness}
              onChange={(v) => updateLayer(selectedLayer.id, { brightness: v })}
            />
            <SliderRow
              label={text.opacity} min={0} max={100} value={Math.round(selectedLayer.opacity * 100)}
              onChange={(v) => updateLayer(selectedLayer.id, { opacity: v / 100 })}
            />
          </div>
        )}

        {/* Guides & Snap */}
        <div className="compose-section">
          <h4 className="section-title">{text.guides}</h4>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={showGuides}
              onChange={(e) => setShowGuides(e.target.checked)}
            />
            {text.guides}
          </label>
          {showGuides && (
            <div className="ctrl-row">
              <select
                value={guideType}
                onChange={(e) => setGuideType(e.target.value as 'center' | 'thirds' | 'quadrants')}
              >
                <option value="center">{text.guideCenter}</option>
                <option value="thirds">{text.guideThirds}</option>
                <option value="quadrants">{text.guideQuadrants}</option>
              </select>
            </div>
          )}
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(e) => setSnapEnabled(e.target.checked)}
            />
            {text.snap}
          </label>
        </div>

        {/* Repeat mode & preview */}
        <div className="compose-section">
          <h4 className="section-title">{text.repeatPreview}</h4>
          <div className="ctrl-row">
            <label>{text.tileDirection}</label>
            <select
              value={tileDirection}
              onChange={(e) => setTileDirection(e.target.value as 'both' | 'horizontal')}
            >
              <option value="both">{text.dirBoth}</option>
              <option value="horizontal">{text.dirHorizontal}</option>
            </select>
          </div>
          {tileDirection === 'both' && (
            <div className="ctrl-row">
              <label>{lang === 'zh' ? '重複模式' : 'Repeat'}</label>
              <select
                value={repeatMode}
                onChange={(e) => setRepeatMode(e.target.value as RepeatMode)}
              >
                <option value="grid">Grid</option>
                <option value="half-drop-row">Half Drop (Row)</option>
                <option value="half-drop-column">Half Drop (Col)</option>
                <option value="half-brick">Half Brick</option>
                <option value="mirror-x">Mirror X</option>
                <option value="mirror-y">Mirror Y</option>
                <option value="mirror-xy">Mirror XY</option>
                <option value="hexagonal">Hexagonal</option>
                <option value="diamond">Diamond</option>
              </select>
            </div>
          )}
          {tileDirection === 'both' && (repeatMode === 'half-drop-row' || repeatMode === 'half-drop-column') && (
            <SliderRow
              label={lang === 'zh' ? '偏移%' : 'Shift%'}
              min={0} max={100} value={shiftPercent}
              onChange={(v) => setShiftPercent(v)}
            />
          )}
          <div className="ctrl-row">
            <label>{text.previewTiles}</label>
            <input
              type="number"
              min={2}
              max={8}
              value={previewTilesX}
              onChange={(e) => setPreviewTilesX(Math.max(2, Math.min(8, Number(e.target.value))))}
              style={{ width: 48 }}
            />
            {tileDirection === 'both' && (
              <>
                <span>×</span>
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={previewTilesY}
                  onChange={(e) => setPreviewTilesY(Math.max(2, Math.min(8, Number(e.target.value))))}
                  style={{ width: 48 }}
                />
              </>
            )}
          </div>
        </div>

        {/* Export & Save */}
        <div className="compose-section">
          <button
            className="upload-btn"
            disabled={layers.length === 0}
            onClick={handleExportTile}
          >
            {text.exportTile}
          </button>
          <button
            className="upload-btn"
            disabled={layers.length === 0}
            onClick={handleExportTiled}
          >
            {text.exportTiled}
          </button>
          <div className="ctrl-row" style={{ marginTop: 8 }}>
            <button className="upload-btn" onClick={handleSave}>
              {lang === 'zh' ? '存檔 (.spc)' : 'Save (.spc)'}
            </button>
            <button className="upload-btn" onClick={handleLoad}>
              {lang === 'zh' ? '開啟' : 'Open'}
            </button>
          </div>
        </div>
      </div>
    </aside>
    {scatterLayer && (
      <ScatterDialog lang={lang} sourceLayer={scatterLayer} onClose={() => setScatterLayer(null)} />
    )}
    </>
  )
}

function SliderRow({ label, min, max, value, onChange }: {
  label: string; min: number; max: number; value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="slider-row">
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider-value">{value}</span>
    </div>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 100, height: 100 })
    img.src = dataUrl
  })
}
