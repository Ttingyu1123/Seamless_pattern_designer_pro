import { useState } from 'react'
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

type CalcUnit = 'cm' | 'mm' | 'in'

const PRINT_PRESETS: { label: { zh: string; en: string }; sizeCm: number; dpi: number }[] = [
  { label: { zh: '5cm @300', en: '5cm @300' }, sizeCm: 5, dpi: 300 },
  { label: { zh: '10cm @300', en: '10cm @300' }, sizeCm: 10, dpi: 300 },
  { label: { zh: '15cm @300', en: '15cm @300' }, sizeCm: 15, dpi: 300 },
  { label: { zh: '20cm @300', en: '20cm @300' }, sizeCm: 20, dpi: 300 },
  { label: { zh: '10cm @150', en: '10cm @150' }, sizeCm: 10, dpi: 150 },
]

function cmToPx(cm: number, dpi: number) {
  return Math.round((cm / 2.54) * dpi)
}

function physicalToPx(val: number, unit: CalcUnit, dpi: number) {
  if (unit === 'cm') return Math.round((val / 2.54) * dpi)
  if (unit === 'mm') return Math.round((val / 25.4) * dpi)
  return Math.round(val * dpi)
}

function pxToPhysical(px: number, unit: CalcUnit, dpi: number) {
  if (unit === 'cm') return Number(((px / dpi) * 2.54).toFixed(2))
  if (unit === 'mm') return Number(((px / dpi) * 25.4).toFixed(1))
  return Number((px / dpi).toFixed(2))
}

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

  const [calcOpen, setCalcOpen] = useState(false)
  const [calcUnit, setCalcUnit] = useState<CalcUnit>('cm')
  const [calcW, setCalcW] = useState(10)
  const [calcH, setCalcH] = useState(10)
  const [calcDpi, setCalcDpi] = useState(300)

  const calcResultW = physicalToPx(calcW, calcUnit, calcDpi)
  const calcResultH = physicalToPx(calcH, calcUnit, calcDpi)

  const aspect = tileSizePx.width / tileSizePx.height
  const isPhysical = tileSizeUnit === 'mm' || tileSizeUnit === 'cm'

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

  const unitFactor = tileSizeUnit === 'cm' ? 2.54 : 25.4

  const displayWidth = isPhysical
    ? Number(((tileSizePx.width / tileDpi) * unitFactor).toFixed(tileSizeUnit === 'cm' ? 2 : 1))
    : tileSizePx.width

  const displayHeight = isPhysical
    ? Number(((tileSizePx.height / tileDpi) * unitFactor).toFixed(tileSizeUnit === 'cm' ? 2 : 1))
    : tileSizePx.height

  const handleDisplayWidthChange = (val: number) => {
    if (isPhysical) {
      handleWidthChange((val / unitFactor) * tileDpi)
    } else {
      handleWidthChange(val)
    }
  }

  const handleDisplayHeightChange = (val: number) => {
    if (isPhysical) {
      handleHeightChange((val / unitFactor) * tileDpi)
    } else {
      handleHeightChange(val)
    }
  }

  const applyCalcResult = () => {
    setTileDpi(calcDpi)
    setTileSize({ width: calcResultW, height: calcResultH })
    setTileSizeUnit('cm')
  }

  const applyPrintPreset = (sizeCm: number, dpi: number) => {
    const px = cmToPx(sizeCm, dpi)
    setTileDpi(dpi)
    setTileSize({ width: px, height: px })
    setTileSizeUnit('cm')
  }

  return (
    <div className="compose-tile-config">
      <h4 className="section-title">{text.tileConfig}</h4>

      {/* Pixel presets */}
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

      {/* Print presets */}
      <div className="print-presets-section">
        <span className="print-presets-label">{text.printPresets}</span>
        <div className="preset-row">
          {PRINT_PRESETS.map((p) => {
            const px = cmToPx(p.sizeCm, p.dpi)
            return (
              <button
                key={p.label.en}
                className="preset-btn preset-btn--print"
                onClick={() => applyPrintPreset(p.sizeCm, p.dpi)}
                title={`${p.sizeCm}cm × ${p.sizeCm}cm @ ${p.dpi}dpi = ${px}×${px}px`}
              >
                {p.label[lang]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Print Size Calculator */}
      <details className="calc-section" open={calcOpen} onToggle={(e) => setCalcOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="calc-summary">{text.printCalc}</summary>
        <div className="calc-body">
          <div className="ctrl-row">
            <label>{text.unit}</label>
            <select value={calcUnit} onChange={(e) => setCalcUnit(e.target.value as CalcUnit)}>
              <option value="cm">cm</option>
              <option value="mm">mm</option>
              <option value="in">inch</option>
            </select>
            <label>{text.dpi}</label>
            <input
              type="number"
              min={72}
              max={1200}
              step={1}
              value={calcDpi}
              onChange={(e) => setCalcDpi(Math.max(72, Number(e.target.value)))}
            />
          </div>
          <div className="ctrl-row">
            <label>{text.width}</label>
            <input
              type="number"
              min={0.1}
              step={calcUnit === 'mm' ? 1 : 0.5}
              value={calcW}
              onChange={(e) => setCalcW(Math.max(0.1, Number(e.target.value)))}
            />
            <label>{text.height}</label>
            <input
              type="number"
              min={0.1}
              step={calcUnit === 'mm' ? 1 : 0.5}
              value={calcH}
              onChange={(e) => setCalcH(Math.max(0.1, Number(e.target.value)))}
            />
          </div>
          <div className="calc-result">
            <span className="calc-result-label">{text.resultPx}</span>
            <strong>{calcResultW} × {calcResultH} px</strong>
            <button className="preset-btn preset-btn--apply" onClick={applyCalcResult}>
              {text.applySize}
            </button>
          </div>
        </div>
      </details>

      {/* Unit selector */}
      <div className="ctrl-row">
        <label>{text.unit}</label>
        <select
          value={tileSizeUnit}
          onChange={(e) => setTileSizeUnit(e.target.value as TileSizeUnit)}
        >
          <option value="px">px</option>
          <option value="mm">mm</option>
          <option value="cm">cm</option>
        </select>
      </div>

      {/* Width / Height */}
      <div className="ctrl-row">
        <label>{text.width}</label>
        <input
          type="number"
          min={isPhysical ? 0.1 : 10}
          step={isPhysical ? (tileSizeUnit === 'cm' ? 0.5 : 1) : 10}
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
          min={isPhysical ? 0.1 : 10}
          step={isPhysical ? (tileSizeUnit === 'cm' ? 0.5 : 1) : 10}
          value={displayHeight}
          onChange={(e) => handleDisplayHeightChange(Number(e.target.value))}
        />
      </div>

      {/* DPI (shown for physical units) */}
      {isPhysical && (
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

      {/* Physical size info when in px mode */}
      {tileSizeUnit === 'px' && (
        <p className="tile-hint">
          {lang === 'zh'
            ? `@${tileDpi}dpi = ${pxToPhysical(tileSizePx.width, 'cm', tileDpi)} × ${pxToPhysical(tileSizePx.height, 'cm', tileDpi)} cm`
            : `@${tileDpi}dpi = ${pxToPhysical(tileSizePx.width, 'cm', tileDpi)} × ${pxToPhysical(tileSizePx.height, 'cm', tileDpi)} cm`}
        </p>
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
