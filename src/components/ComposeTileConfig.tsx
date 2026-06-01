import { useComposerStore } from '../store/composerStore'
import type { TileSizeUnit } from '../store/composerStore'
import type { UILang } from '../i18n'
import { composeText } from '../i18n-compose'

interface Props {
  lang: UILang
}

const PRESETS = [
  { label: { zh: '正方形 500', en: 'Square 500' }, w: 500, h: 500 },
  { label: { zh: '正方形 1000', en: 'Square 1000' }, w: 1000, h: 1000 },
  { label: { zh: '緞帶 1000×150', en: 'Ribbon 1000×150' }, w: 1000, h: 150 },
] as const

const HALFDROP_PRESETS = [
  { label: { zh: 'HD-Row 500×250', en: 'HD-Row 500×250' }, w: 500, h: 250 },
  { label: { zh: 'HD-Row 1000×500', en: 'HD-Row 1000×500' }, w: 1000, h: 500 },
  { label: { zh: 'HD-Col 250×500', en: 'HD-Col 250×500' }, w: 250, h: 500 },
] as const

export function ComposeTileConfig({ lang }: Props) {
  const text = composeText[lang]
  const tileSizePx = useComposerStore((s) => s.tileSizePx)
  const tileSizeUnit = useComposerStore((s) => s.tileSizeUnit)
  const tileDpi = useComposerStore((s) => s.tileDpi)
  const aspectLocked = useComposerStore((s) => s.aspectLocked)
  const backgroundColor = useComposerStore((s) => s.backgroundColor)
  const repeatMode = useComposerStore((s) => s.repeatMode)

  const setTileSize = useComposerStore((s) => s.setTileSize)
  const setTileSizeUnit = useComposerStore((s) => s.setTileSizeUnit)
  const setTileDpi = useComposerStore((s) => s.setTileDpi)
  const setAspectLocked = useComposerStore((s) => s.setAspectLocked)
  const setBackgroundColor = useComposerStore((s) => s.setBackgroundColor)

  const aspect = tileSizePx.width / tileSizePx.height

  const handleWidthChange = (value: number) => {
    const w = Math.max(10, Math.round(value))
    const h = aspectLocked ? Math.max(10, Math.round(w / aspect)) : tileSizePx.height
    setTileSize({ width: w, height: h })
  }

  const handleHeightChange = (value: number) => {
    const h = Math.max(10, Math.round(value))
    const w = aspectLocked ? Math.max(10, Math.round(h * aspect)) : tileSizePx.width
    setTileSize({ width: w, height: h })
  }

  const displayWidth = tileSizeUnit === 'mm'
    ? Number(((tileSizePx.width / tileDpi) * 25.4).toFixed(1))
    : tileSizePx.width

  const displayHeight = tileSizeUnit === 'mm'
    ? Number(((tileSizePx.height / tileDpi) * 25.4).toFixed(1))
    : tileSizePx.height

  const handleDisplayWidthChange = (val: number) => {
    if (tileSizeUnit === 'mm') {
      handleWidthChange((val / 25.4) * tileDpi)
    } else {
      handleWidthChange(val)
    }
  }

  const handleDisplayHeightChange = (val: number) => {
    if (tileSizeUnit === 'mm') {
      handleHeightChange((val / 25.4) * tileDpi)
    } else {
      handleHeightChange(val)
    }
  }

  return (
    <div className="compose-tile-config">
      <h4 className="section-title">{text.tileConfig}</h4>

      {/* Presets */}
      <div className="preset-row">
        {PRESETS.map((p) => (
          <button
            key={p.label.en}
            className="preset-btn"
            onClick={() => setTileSize({ width: p.w, height: p.h })}
            title={`${p.w}×${p.h}px`}
          >
            {p.label[lang]}
          </button>
        ))}
      </div>

      {/* Half-drop presets */}
      {(repeatMode === 'half-drop-row' || repeatMode === 'half-drop-column' || repeatMode === 'half-brick' || repeatMode === 'hexagonal') && (
        <>
          <div className="preset-row">
            {HALFDROP_PRESETS.map((p) => (
              <button
                key={p.label.en}
                className="preset-btn"
                onClick={() => setTileSize({ width: p.w, height: p.h })}
                title={`${p.w}×${p.h}px`}
              >
                {p.label[lang]}
              </button>
            ))}
          </div>
          <p className="tile-hint">
            {lang === 'zh'
              ? `💡 Half-drop 的重複週期 = ${repeatMode === 'half-drop-column' ? '2W' : 'W'} × ${repeatMode === 'half-drop-column' ? 'H' : '2H'}。建議 tile 用${repeatMode === 'half-drop-column' ? '直長' : '橫寬'}矩形（如 2:1），偏移後才接近正方形。`
              : `💡 Half-drop repeat cycle = ${repeatMode === 'half-drop-column' ? '2W' : 'W'} × ${repeatMode === 'half-drop-column' ? 'H' : '2H'}. Use a ${repeatMode === 'half-drop-column' ? 'tall' : 'wide'} rectangle (e.g. 2:1) so the shifted repeat is ~square.`}
          </p>
        </>
      )}

      {/* Unit selector */}
      <div className="ctrl-row">
        <label>{text.unit}</label>
        <select
          value={tileSizeUnit}
          onChange={(e) => setTileSizeUnit(e.target.value as TileSizeUnit)}
        >
          <option value="px">px</option>
          <option value="mm">mm</option>
        </select>
      </div>

      {/* Width / Height */}
      <div className="ctrl-row">
        <label>{text.width}</label>
        <input
          type="number"
          min={tileSizeUnit === 'mm' ? 1 : 10}
          step={tileSizeUnit === 'mm' ? 0.5 : 10}
          value={displayWidth}
          onChange={(e) => handleDisplayWidthChange(Number(e.target.value))}
        />
        <button
          className={`lock-btn ${aspectLocked ? 'locked' : ''}`}
          onClick={() => setAspectLocked(!aspectLocked)}
          title={text.lockAspect}
        >
          {aspectLocked ? '🔒' : '🔓'}
        </button>
        <label>{text.height}</label>
        <input
          type="number"
          min={tileSizeUnit === 'mm' ? 1 : 10}
          step={tileSizeUnit === 'mm' ? 0.5 : 10}
          value={displayHeight}
          onChange={(e) => handleDisplayHeightChange(Number(e.target.value))}
        />
      </div>

      {/* DPI (only shown for mm) */}
      {tileSizeUnit === 'mm' && (
        <div className="ctrl-row">
          <label>DPI</label>
          <input
            type="number"
            min={72}
            max={600}
            step={1}
            value={tileDpi}
            onChange={(e) => setTileDpi(Math.max(72, Number(e.target.value)))}
          />
          <span className="hint">({tileSizePx.width}×{tileSizePx.height}px)</span>
        </div>
      )}

      {/* Background color */}
      <div className="ctrl-row">
        <label>{text.bgColor}</label>
        <div className="bg-color-controls">
          <button
            className={`bg-btn ${backgroundColor === null ? 'active' : ''}`}
            onClick={() => setBackgroundColor(null)}
          >
            {text.transparent}
          </button>
          <input
            type="color"
            value={backgroundColor ?? '#ffffff'}
            onChange={(e) => setBackgroundColor(e.target.value)}
          />
          {backgroundColor && (
            <span className="color-value">{backgroundColor}</span>
          )}
        </div>
      </div>
    </div>
  )
}
