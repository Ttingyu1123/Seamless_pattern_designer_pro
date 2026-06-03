import type { UILang } from '../i18n'
import { generateText } from '../i18n-generate'
import { useGenerateStore } from '../store/generateStore'
import type { GeometricPatternType, TessellationType, WeaveType, WallpaperGroup } from '../store/generateStore'
import { useComposerStore } from '../store/composerStore'
import { loadLayerImage } from '../hooks/useComposerEngine'
import type { RepeatMode } from '../utils/tilingEngine'
import { getTileOffset, shouldFlipX, shouldFlipY } from '../utils/tilingEngine'
import { saveCanvasImage } from '../utils/saveImage'

interface Props {
  lang: UILang
  onSwitchToCompose: () => void
}

export function GeneratePanel({ lang, onSwitchToCompose }: Props) {
  const text = generateText[lang]

  const subMode = useGenerateStore((s) => s.subMode)
  const setSubMode = useGenerateStore((s) => s.setSubMode)
  const tileSizePx = useGenerateStore((s) => s.tileSizePx)
  const setTileSize = useGenerateStore((s) => s.setTileSize)
  const geometric = useGenerateStore((s) => s.geometric)
  const setGeometricPatternType = useGenerateStore((s) => s.setGeometricPatternType)
  const updateStarConfig = useGenerateStore((s) => s.updateStarConfig)
  const updateTessellationConfig = useGenerateStore((s) => s.updateTessellationConfig)
  const updateWeaveConfig = useGenerateStore((s) => s.updateWeaveConfig)
  const kaleidoscope = useGenerateStore((s) => s.kaleidoscope)
  const setSymmetryGroup = useGenerateStore((s) => s.setSymmetryGroup)
  const setKaleidoscopeSource = useGenerateStore((s) => s.setKaleidoscopeSource)
  const updateCrop = useGenerateStore((s) => s.updateCrop)
  const repeatMode = useGenerateStore((s) => s.repeatMode)
  const setRepeatMode = useGenerateStore((s) => s.setRepeatMode)
  const shiftPercent = useGenerateStore((s) => s.shiftPercent)
  const setShiftPercent = useGenerateStore((s) => s.setShiftPercent)
  const previewTilesX = useGenerateStore((s) => s.previewTilesX)
  const setPreviewTilesX = useGenerateStore((s) => s.setPreviewTilesX)
  const previewTilesY = useGenerateStore((s) => s.previewTilesY)
  const setPreviewTilesY = useGenerateStore((s) => s.setPreviewTilesY)
  const generatedTileCanvas = useGenerateStore((s) => s.generatedTileCanvas)

  const handleExportTile = () => {
    if (!generatedTileCanvas) return
    const { width, height } = tileSizePx
    saveCanvasImage(generatedTileCanvas, `tile_${width}x${height}_${Date.now()}.png`)
  }

  const handleExportTiled = () => {
    if (!generatedTileCanvas) return
    const tileW = generatedTileCanvas.width
    const tileH = generatedTileCanvas.height
    const canvas = document.createElement('canvas')
    canvas.width = tileW * previewTilesX
    canvas.height = tileH * previewTilesY
    const expCtx = canvas.getContext('2d')
    if (!expCtx) return

    const needsExtraCols = ['half-drop-row', 'half-brick', 'hexagonal', 'diamond'].includes(repeatMode)
    const needsExtraRows = ['half-drop-column', 'diamond'].includes(repeatMode)

    expCtx.save()
    expCtx.beginPath()
    expCtx.rect(0, 0, canvas.width, canvas.height)
    expCtx.clip()

    for (let row = -(needsExtraRows ? 1 : 0); row < previewTilesY + (needsExtraRows ? 1 : 0); row++) {
      for (let col = -(needsExtraCols ? 1 : 0); col < previewTilesX + (needsExtraCols ? 1 : 0); col++) {
        const { offsetX, offsetY } = getTileOffset({ row, col, repeatMode, shiftPercent, tileWidth: tileW, tileHeight: tileH })
        const dx = col * tileW + offsetX
        const dy = row * tileH + offsetY
        const fx = shouldFlipX(row, col, repeatMode)
        const fy = shouldFlipY(row, col, repeatMode)
        if (fx || fy) {
          expCtx.save()
          expCtx.translate(dx + tileW / 2, dy + tileH / 2)
          expCtx.scale(fx ? -1 : 1, fy ? -1 : 1)
          expCtx.drawImage(generatedTileCanvas, -tileW / 2, -tileH / 2, tileW, tileH)
          expCtx.restore()
        } else {
          expCtx.drawImage(generatedTileCanvas, dx, dy, tileW, tileH)
        }
      }
    }
    expCtx.restore()

    saveCanvasImage(canvas, `tiled_${canvas.width}x${canvas.height}_${repeatMode}_${Date.now()}.png`)
  }

  const handleSendToCompose = () => {
    if (!generatedTileCanvas) return
    const dataUrl = generatedTileCanvas.toDataURL('image/png')
    const w = generatedTileCanvas.width
    const h = generatedTileCanvas.height

    const store = useComposerStore.getState()

    store.setTileSize({ width: w, height: h })

    const layer = {
      id: crypto.randomUUID(),
      name: `Generated ${new Date().toLocaleTimeString()}`,
      imageDataUrl: dataUrl,
      naturalWidth: w,
      naturalHeight: h,
      x: w / 2,
      y: h / 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      hue: 0,
      saturation: 0,
      brightness: 0,
      visible: true,
      locked: false,
    }

    loadLayerImage(layer)
    store.addLayer(layer)
    onSwitchToCompose()
  }

  const handleUploadSource = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setKaleidoscopeSource(reader.result)
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const showShift = ['half-drop-row', 'half-drop-column'].includes(repeatMode)

  return (
    <aside className="compose-panel generate-panel">
      {/* Sub-mode tabs */}
      <div className="generate-sub-tabs">
        <button
          className={`generate-sub-tab ${subMode === 'geometric' ? 'active' : ''}`}
          onClick={() => setSubMode('geometric')}
        >
          {text.subGeometric}
        </button>
        <button
          className={`generate-sub-tab ${subMode === 'kaleidoscope' ? 'active' : ''}`}
          onClick={() => setSubMode('kaleidoscope')}
        >
          {text.subKaleidoscope}
        </button>
      </div>

      {/* Tile size */}
      <fieldset className="panel-section">
        <legend>{text.tileConfig}</legend>
        <div className="size-row">
          <label>{text.width}
            <input
              type="number"
              min={50}
              max={4000}
              value={tileSizePx.width}
              onChange={(e) => setTileSize({ ...tileSizePx, width: Math.max(50, +e.target.value || 50) })}
            />
          </label>
          <span>×</span>
          <label>{text.height}
            <input
              type="number"
              min={50}
              max={4000}
              value={tileSizePx.height}
              onChange={(e) => setTileSize({ ...tileSizePx, height: Math.max(50, +e.target.value || 50) })}
            />
          </label>
        </div>
      </fieldset>

      {/* Geometric controls */}
      {subMode === 'geometric' && (
        <fieldset className="panel-section">
          <legend>{text.patternType}</legend>
          <select
            value={geometric.patternType}
            onChange={(e) => setGeometricPatternType(e.target.value as GeometricPatternType)}
          >
            <option value="islamic-star">{text.islamicStar}</option>
            <option value="tessellation">{text.tessellation}</option>
            <option value="weave">{text.weave}</option>
          </select>

          {geometric.patternType === 'islamic-star' && (
            <div className="param-group">
              <label>{text.points}
                <div className="radio-group">
                  {([6, 8, 12] as const).map((n) => (
                    <label key={n} className="radio-label">
                      <input
                        type="radio"
                        name="star-points"
                        value={n}
                        checked={geometric.star.points === n}
                        onChange={() => updateStarConfig({ points: n })}
                      />
                      {n}
                    </label>
                  ))}
                </div>
              </label>
              <label>{text.starDepth}
                <input type="range" min={0} max={100} value={Math.round(geometric.star.starAngle * 100)}
                  onChange={(e) => updateStarConfig({ starAngle: +e.target.value / 100 })} />
              </label>
              <label>{text.lineWidth}
                <input type="range" min={1} max={8} value={geometric.star.lineWidth}
                  onChange={(e) => updateStarConfig({ lineWidth: +e.target.value })} />
              </label>
              <label>{text.scale}
                <input type="range" min={1} max={8} value={geometric.star.scale}
                  onChange={(e) => updateStarConfig({ scale: +e.target.value })} />
              </label>
              <label>{text.lineColor}
                <input type="color" value={geometric.star.lineColor}
                  onChange={(e) => updateStarConfig({ lineColor: e.target.value })} />
              </label>
              {geometric.star.fillColors.map((c, i) => (
                <label key={i}>{text.fillColor} {i + 1}
                  <input type="color" value={c}
                    onChange={(e) => {
                      const next = [...geometric.star.fillColors] as [string, string, string]
                      next[i] = e.target.value
                      updateStarConfig({ fillColors: next })
                    }} />
                </label>
              ))}
              <label>{text.backgroundColor}
                <input type="color" value={geometric.star.backgroundColor}
                  onChange={(e) => updateStarConfig({ backgroundColor: e.target.value })} />
              </label>
            </div>
          )}

          {geometric.patternType === 'tessellation' && (
            <div className="param-group">
              <label>{text.tessType}
                <select value={geometric.tessellation.tessType}
                  onChange={(e) => updateTessellationConfig({ tessType: e.target.value as TessellationType })}>
                  <option value="triangular">{text.triangular}</option>
                  <option value="square">{text.square}</option>
                  <option value="hexagonal">{text.hexagonal}</option>
                  <option value="3.6.3.6">3.6.3.6</option>
                  <option value="3.3.4.3.4">3.3.4.3.4</option>
                </select>
              </label>
              <label>{text.strokeWidth}
                <input type="range" min={1} max={8} value={geometric.tessellation.strokeWidth}
                  onChange={(e) => updateTessellationConfig({ strokeWidth: +e.target.value })} />
              </label>
              <label>{text.scale}
                <input type="range" min={2} max={12} value={geometric.tessellation.scale}
                  onChange={(e) => updateTessellationConfig({ scale: +e.target.value })} />
              </label>
              <label>{text.strokeColor}
                <input type="color" value={geometric.tessellation.strokeColor}
                  onChange={(e) => updateTessellationConfig({ strokeColor: e.target.value })} />
              </label>
              {geometric.tessellation.fillColors.map((c, i) => (
                <label key={i}>{text.fillColor} {i + 1}
                  <input type="color" value={c}
                    onChange={(e) => {
                      const next = [...geometric.tessellation.fillColors] as [string, string, string]
                      next[i] = e.target.value
                      updateTessellationConfig({ fillColors: next })
                    }} />
                </label>
              ))}
              <label>{text.backgroundColor}
                <input type="color" value={geometric.tessellation.backgroundColor}
                  onChange={(e) => updateTessellationConfig({ backgroundColor: e.target.value })} />
              </label>
            </div>
          )}

          {geometric.patternType === 'weave' && (
            <div className="param-group">
              <label>{text.weaveType}
                <select value={geometric.weave.weaveType}
                  onChange={(e) => updateWeaveConfig({ weaveType: e.target.value as WeaveType })}>
                  <option value="y-hex">{text.yHex}</option>
                  <option value="basket">{text.basket}</option>
                  <option value="herringbone">{text.herringbone}</option>
                </select>
              </label>
              <label>{text.lineWidth}
                <input type="range" min={1} max={12} value={geometric.weave.lineWidth}
                  onChange={(e) => updateWeaveConfig({ lineWidth: +e.target.value })} />
              </label>
              <label>{text.depth3d}
                <input type="range" min={0} max={100} value={Math.round(geometric.weave.depth * 100)}
                  onChange={(e) => updateWeaveConfig({ depth: +e.target.value / 100 })} />
              </label>
              <label>{text.scale}
                <input type="range" min={2} max={8} value={geometric.weave.scale}
                  onChange={(e) => updateWeaveConfig({ scale: +e.target.value })} />
              </label>
              <label>{text.strandColorA}
                <input type="color" value={geometric.weave.fillColors[0]}
                  onChange={(e) => updateWeaveConfig({ fillColors: [e.target.value, geometric.weave.fillColors[1]] })} />
              </label>
              <label>{text.strandColorB}
                <input type="color" value={geometric.weave.fillColors[1]}
                  onChange={(e) => updateWeaveConfig({ fillColors: [geometric.weave.fillColors[0], e.target.value] })} />
              </label>
              <label>{text.lineColor}
                <input type="color" value={geometric.weave.lineColor}
                  onChange={(e) => updateWeaveConfig({ lineColor: e.target.value })} />
              </label>
              <label>{text.backgroundColor}
                <input type="color" value={geometric.weave.backgroundColor}
                  onChange={(e) => updateWeaveConfig({ backgroundColor: e.target.value })} />
              </label>
            </div>
          )}
        </fieldset>
      )}

      {/* Kaleidoscope controls */}
      {subMode === 'kaleidoscope' && (
        <fieldset className="panel-section">
          <legend>{text.subKaleidoscope}</legend>
          <button className="upload-btn" onClick={handleUploadSource}>{text.uploadSource}</button>

          {kaleidoscope.sourceImageDataUrl && (
            <div className="kaleidoscope-thumb">
              <img src={kaleidoscope.sourceImageDataUrl} alt="source" />
            </div>
          )}

          {!kaleidoscope.sourceImageDataUrl && (
            <p className="hint-text">{text.noSource}</p>
          )}

          <label>{text.symmetryGroup}
            <select value={kaleidoscope.symmetryGroup}
              onChange={(e) => setSymmetryGroup(e.target.value as WallpaperGroup)}>
              <option value="p6m">p6m (6-fold)</option>
              <option value="p4m">p4m (4-fold)</option>
              <option value="p3m1">p3m1 (3-fold)</option>
              <option value="pm">pm (mirror)</option>
              <option value="cmm">cmm (2-fold)</option>
            </select>
          </label>

          <label>{text.cropSize}
            <input type="range" min={10} max={100} value={Math.round(kaleidoscope.cropRadius * 100)}
              onChange={(e) => updateCrop({ cropRadius: +e.target.value / 100 })} />
          </label>

          <label>{text.rotation}
            <input type="range" min={0} max={360} value={Math.round(kaleidoscope.rotation * 180 / Math.PI)}
              onChange={(e) => updateCrop({ rotation: +e.target.value * Math.PI / 180 })} />
          </label>
        </fieldset>
      )}

      {/* Repeat preview config */}
      <fieldset className="panel-section">
        <legend>{text.repeatPreview}</legend>
        <label>{text.repeatMode}
          <select value={repeatMode} onChange={(e) => setRepeatMode(e.target.value as RepeatMode)}>
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
        </label>

        {showShift && (
          <label>{text.shiftPercent}
            <input type="range" min={0} max={100} value={shiftPercent}
              onChange={(e) => setShiftPercent(+e.target.value)} />
          </label>
        )}

        <div className="size-row">
          <label>{text.previewTiles}
            <input type="number" min={1} max={12} value={previewTilesX}
              onChange={(e) => setPreviewTilesX(Math.max(1, +e.target.value || 1))} />
          </label>
          <span>×</span>
          <label>&nbsp;
            <input type="number" min={1} max={12} value={previewTilesY}
              onChange={(e) => setPreviewTilesY(Math.max(1, +e.target.value || 1))} />
          </label>
        </div>
      </fieldset>

      {/* Actions */}
      <div className="panel-actions">
        <button className="action-btn primary" onClick={handleSendToCompose} disabled={!generatedTileCanvas}>
          {text.sendToCompose}
        </button>
        <button className="action-btn" onClick={handleExportTile} disabled={!generatedTileCanvas}>
          {text.exportTile}
        </button>
        <button className="action-btn" onClick={handleExportTiled} disabled={!generatedTileCanvas}>
          {text.exportTiled}
        </button>
      </div>
    </aside>
  )
}
