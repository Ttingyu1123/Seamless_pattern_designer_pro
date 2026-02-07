import { useEffect, useMemo, useState } from 'react'
import { uiText, type UILang } from '../i18n'
import type { RepeatBaseSize, RepeatMode } from '../utils/tilingEngine'

type ExportUnit = 'px' | 'in' | 'cm'
type ExportPreset = 'a4' | 'a5' | 'postcard' | 'square20'

type TabMode = 'inspection' | 'output'

interface NumberStepperProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
  decreaseLabel: string
  increaseLabel: string
}

interface PlainNumberInputProps {
  label: string
  value: number
  min?: number
  step?: number
  onChange: (value: number) => void
}

function NumberStepper({
  label,
  value,
  min = 1,
  max,
  step = 1,
  onChange,
  decreaseLabel,
  increaseLabel,
}: NumberStepperProps) {
  const clamp = (v: number) => {
    const low = Math.max(min, v)
    if (typeof max === 'number') {
      return Math.min(max, low)
    }
    return low
  }

  const dec = () => onChange(clamp(Number((value - step).toFixed(3))))
  const inc = () => onChange(clamp(Number((value + step).toFixed(3))))

  return (
    <label className="field">
      <span>{label}</span>
      <div className="stepper-wrap">
        <button type="button" className="stepper-btn" onClick={dec} aria-label={`${decreaseLabel} ${label}`}>
          -
        </button>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(clamp(Number(event.target.value) || min))}
        />
        <button type="button" className="stepper-btn" onClick={inc} aria-label={`${increaseLabel} ${label}`}>
          +
        </button>
      </div>
    </label>
  )
}

function PlainNumberInput({ label, value, min = 1, step = 1, onChange }: PlainNumberInputProps) {
  const next = Number.isFinite(value) ? value : min
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={next}
        onChange={(event) => onChange(Math.max(min, Number(event.target.value) || min))}
      />
    </label>
  )
}

interface ControlPanelProps {
  lang: UILang
  onToggleLanguage: () => void
  repeatMode: RepeatMode
  shiftPercent: number
  checkTilesX: number
  checkTilesY: number
  zoom: number
  showGrid: boolean
  mirrorEnabled: boolean
  showHeatmap: boolean
  showProblemSeams: boolean
  seamThresholdPercent: number
  offsetPreview: boolean
  basePreset: '1x1' | '1x2' | '2x1' | 'custom'
  customBaseWidth: number
  customBaseHeight: number
  hasImage: boolean
  imageSize: RepeatBaseSize | null
  sourceDpi: number
  exportUnit: ExportUnit
  exportDpi: number
  exportWidthInput: number
  exportHeightInput: number
  exportWidthPx: number
  exportHeightPx: number
  exportTilesX: number
  exportTilesY: number
  suggestedTilesX: number
  suggestedTilesY: number
  exportUpscale: number
  suggestedUpscale: number
  effectiveExportWidthPx: number
  effectiveExportHeightPx: number
  exportQualityRatio: number
  exportLimitRisk: boolean
  onUpload: (file: File) => void
  onRepeatModeChange: (mode: RepeatMode) => void
  onShiftChange: (value: number) => void
  onCheckTilesXChange: (value: number) => void
  onCheckTilesYChange: (value: number) => void
  onZoomChange: (value: number) => void
  onResetView: () => void
  onToggleGrid: (value: boolean) => void
  onToggleMirror: (value: boolean) => void
  onToggleHeatmap: (value: boolean) => void
  onToggleProblemSeams: (value: boolean) => void
  onSeamThresholdChange: (value: number) => void
  onToggleOffsetPreview: (value: boolean) => void
  onBasePresetChange: (value: '1x1' | '1x2' | '2x1' | 'custom') => void
  onCustomBaseWidthChange: (value: number) => void
  onCustomBaseHeightChange: (value: number) => void
  onExportUnitChange: (value: ExportUnit) => void
  onExportDpiChange: (value: number) => void
  onExportWidthInputChange: (value: number) => void
  onExportHeightInputChange: (value: number) => void
  onExportTilesXChange: (value: number) => void
  onExportUpscaleChange: (value: number) => void
  onAutoUpscale: () => void
  onApplyExportPreset: (preset: ExportPreset) => void
  onPreviewExport: () => void
  onExport: () => void
  onExportPdf: () => void
}

export function ControlPanel({
  lang,
  onToggleLanguage,
  repeatMode,
  shiftPercent,
  checkTilesX,
  checkTilesY,
  zoom,
  showGrid,
  mirrorEnabled,
  showHeatmap,
  showProblemSeams,
  seamThresholdPercent,
  offsetPreview,
  basePreset,
  customBaseWidth,
  customBaseHeight,
  hasImage,
  imageSize,
  sourceDpi,
  exportUnit,
  exportDpi,
  exportWidthInput,
  exportHeightInput,
  exportWidthPx,
  exportHeightPx,
  exportTilesX,
  exportTilesY,
  suggestedTilesX,
  suggestedTilesY,
  exportUpscale,
  suggestedUpscale,
  effectiveExportWidthPx,
  effectiveExportHeightPx,
  exportQualityRatio,
  exportLimitRisk,
  onUpload,
  onRepeatModeChange,
  onShiftChange,
  onCheckTilesXChange,
  onCheckTilesYChange,
  onZoomChange,
  onResetView,
  onToggleGrid,
  onToggleMirror,
  onToggleHeatmap,
  onToggleProblemSeams,
  onSeamThresholdChange,
  onToggleOffsetPreview,
  onBasePresetChange,
  onCustomBaseWidthChange,
  onCustomBaseHeightChange,
  onExportUnitChange,
  onExportDpiChange,
  onExportWidthInputChange,
  onExportHeightInputChange,
  onExportTilesXChange,
  onExportUpscaleChange,
  onAutoUpscale,
  onApplyExportPreset,
  onPreviewExport,
  onExport,
  onExportPdf,
}: ControlPanelProps) {
  const text = uiText[lang]
  const [inspectionOpen, setInspectionOpen] = useState(true)
  const [outputOpen, setOutputOpen] = useState(true)
  const [mobileTab, setMobileTab] = useState<TabMode>('inspection')
  const [previewToast, setPreviewToast] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('seamless-ui-panel-state')
      if (!raw) return
      const parsed = JSON.parse(raw) as { inspectionOpen?: boolean; outputOpen?: boolean }
      if (typeof parsed.inspectionOpen === 'boolean') setInspectionOpen(parsed.inspectionOpen)
      if (typeof parsed.outputOpen === 'boolean') setOutputOpen(parsed.outputOpen)
    } catch {
      // ignore malformed local storage
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'seamless-ui-panel-state',
        JSON.stringify({ inspectionOpen, outputOpen }),
      )
    } catch {
      // ignore write errors
    }
  }, [inspectionOpen, outputOpen])

  useEffect(() => {
    if (!previewToast) return
    const timer = window.setTimeout(() => setPreviewToast(false), 1600)
    return () => window.clearTimeout(timer)
  }, [previewToast])

  const effectiveBaseLabel = useMemo(() => {
    if (!imageSize) return text.noImage
    return `${imageSize.width} x ${imageSize.height}px`
  }, [imageSize, text.noImage])

  const handlePreview = () => {
    onPreviewExport()
    setPreviewToast(true)
  }

  return (
    <aside className="control-panel">
      <div className="panel-top">
        <h1>{text.appTitle}</h1>
        <button type="button" className="lang-btn" onClick={onToggleLanguage}>
          {text.languageButton}
        </button>
      </div>

      <div className="steps-row" aria-label="workflow">
        <span>{text.stepUpload}</span>
        <span>{text.stepInspect}</span>
        <span>{text.stepExport}</span>
      </div>

      <label className="field">
        <span>{text.upload}</span>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(file)
            event.currentTarget.value = ''
          }}
        />
      </label>

      <div className="mobile-tabs" role="tablist" aria-label="tool sections">
        <button
          type="button"
          className={mobileTab === 'inspection' ? 'tab-btn active' : 'tab-btn'}
          role="tab"
          aria-selected={mobileTab === 'inspection'}
          onClick={() => setMobileTab('inspection')}
        >
          {text.tabInspection}
        </button>
        <button
          type="button"
          className={mobileTab === 'output' ? 'tab-btn active' : 'tab-btn'}
          role="tab"
          aria-selected={mobileTab === 'output'}
          onClick={() => setMobileTab('output')}
        >
          {text.tabOutput}
        </button>
      </div>

      <section className={mobileTab === 'output' ? 'panel-section mobile-hide' : 'panel-section'}>
        <button
          type="button"
          className="section-toggle"
          onClick={() => setInspectionOpen((prev) => !prev)}
          aria-expanded={inspectionOpen}
          aria-label={inspectionOpen ? text.collapse : text.expand}
        >
          <h2>{text.inspectionSection}</h2>
          <span>{text.inspectionSummary(checkTilesX, checkTilesY)}</span>
        </button>

        {inspectionOpen ? (
          <>
            <label className="field">
              <span className="field-label">
                {text.repeatMode}
                <i className="tip-icon" title={text.tipRepeatMode} aria-label={text.tipRepeatMode}>
                  ?
                </i>
              </span>
              <select value={repeatMode} onChange={(event) => onRepeatModeChange(event.target.value as RepeatMode)}>
                <option value="grid">{text.grid}</option>
                <option value="half-drop-row">{text.halfDropRow}</option>
                <option value="half-drop-column">{text.halfDropColumn}</option>
              </select>
            </label>

            <label className="field">
              <span>
                {text.shift} {shiftPercent}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={shiftPercent}
                onChange={(event) => onShiftChange(Number(event.target.value))}
              />
            </label>

            <div className="field-row">
              <NumberStepper
                label={`${text.tilesX} *`}
                value={checkTilesX}
                min={1}
                max={12}
                onChange={onCheckTilesXChange}
                decreaseLabel={text.decrease}
                increaseLabel={text.increase}
              />
              <NumberStepper
                label={`${text.tilesY} *`}
                value={checkTilesY}
                min={1}
                max={12}
                onChange={onCheckTilesYChange}
                decreaseLabel={text.decrease}
                increaseLabel={text.increase}
              />
            </div>
            <p className="hint-text">* {text.tipCheckTiles}</p>

            <label className="field">
              <span>
                {text.zoom} {Math.round(zoom * 100)}%
              </span>
              <input
                type="range"
                min={0.1}
                max={8}
                step={0.01}
                value={zoom}
                onChange={(event) => onZoomChange(Number(event.target.value))}
              />
            </label>

            <details className="advanced-block" open>
              <summary>{text.advancedSettings}</summary>
              <div className="advanced-content">
                <div className="toggle-row">
                  <label>
                    <input type="checkbox" checked={showGrid} onChange={(event) => onToggleGrid(event.target.checked)} /> {text.grid}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={mirrorEnabled}
                      onChange={(event) => onToggleMirror(event.target.checked)}
                    />{' '}
                    {text.mirror}
                  </label>
                </div>

                <div className="toggle-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={showHeatmap}
                      onChange={(event) => onToggleHeatmap(event.target.checked)}
                    />{' '}
                    {text.showSeamHeatmap}
                  </label>
                </div>

                <div className="toggle-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={showProblemSeams}
                      onChange={(event) => onToggleProblemSeams(event.target.checked)}
                    />{' '}
                    {text.showProblemSeams}
                  </label>
                </div>

                <label className="field">
                  <span>
                    {text.seamThreshold} {seamThresholdPercent}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={seamThresholdPercent}
                    onChange={(event) => onSeamThresholdChange(Number(event.target.value))}
                  />
                </label>

                <div className="toggle-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={offsetPreview}
                      onChange={(event) => onToggleOffsetPreview(event.target.checked)}
                    />{' '}
                    {text.offsetPreview}
                  </label>
                </div>

                <button type="button" className="secondary-btn" onClick={onResetView} disabled={!hasImage}>
                  {text.resetView}
                </button>
              </div>
            </details>
          </>
        ) : null}
      </section>

      <section className={mobileTab === 'inspection' ? 'panel-section mobile-hide' : 'panel-section'}>
        <button
          type="button"
          className="section-toggle"
          onClick={() => setOutputOpen((prev) => !prev)}
          aria-expanded={outputOpen}
          aria-label={outputOpen ? text.collapse : text.expand}
        >
          <h2>{text.outputSection}</h2>
          <span>{text.outputSummary(effectiveExportWidthPx, effectiveExportHeightPx)}</span>
        </button>

        {outputOpen ? (
          <>
            <div className="meta-row">
              <span>{text.imageSize}</span>
              <strong>{effectiveBaseLabel}</strong>
            </div>
            <div className="meta-row">
              <span>{text.detectedDpi}</span>
              <strong>{sourceDpi}</strong>
            </div>

            <details className="advanced-block" open>
              <summary>{text.advancedSettings}</summary>
              <div className="advanced-content">
                <label className="field">
                  <span className="field-label">
                    {text.repeatBaseSize}
                    <i className="tip-icon" title={text.tipRepeatBaseSize} aria-label={text.tipRepeatBaseSize}>
                      ?
                    </i>
                  </span>
                  <select
                    value={basePreset}
                    onChange={(event) => onBasePresetChange(event.target.value as '1x1' | '1x2' | '2x1' | 'custom')}
                  >
                    <option value="1x1">{text.baseWH}</option>
                    <option value="1x2">{text.baseW2H}</option>
                    <option value="2x1">{text.base2WH}</option>
                    <option value="custom">{text.custom}</option>
                  </select>
                </label>

                {basePreset === 'custom' ? (
                  <div className="field-row">
                    <NumberStepper
                      label={text.baseW}
                      value={customBaseWidth}
                      min={1}
                      onChange={onCustomBaseWidthChange}
                      decreaseLabel={text.decrease}
                      increaseLabel={text.increase}
                    />
                    <NumberStepper
                      label={text.baseH}
                      value={customBaseHeight}
                      min={1}
                      onChange={onCustomBaseHeightChange}
                      decreaseLabel={text.decrease}
                      increaseLabel={text.increase}
                    />
                  </div>
                ) : null}
              </div>
            </details>

            <label className="field">
              <span>{text.exportUnit}</span>
              <select value={exportUnit} onChange={(event) => onExportUnitChange(event.target.value as ExportUnit)}>
                <option value="in">{text.inch}</option>
                <option value="cm">{text.cm}</option>
                <option value="px">{text.px}</option>
              </select>
            </label>

            <div className="preset-row">
              <span>{text.presets}</span>
              <div className="preset-buttons">
                <button type="button" className="secondary-btn" onClick={() => onApplyExportPreset('a4')}>
                  {text.presetA4}
                </button>
                <button type="button" className="secondary-btn" onClick={() => onApplyExportPreset('a5')}>
                  {text.presetA5}
                </button>
                <button type="button" className="secondary-btn" onClick={() => onApplyExportPreset('postcard')}>
                  {text.presetPostcard}
                </button>
                <button type="button" className="secondary-btn" onClick={() => onApplyExportPreset('square20')}>
                  {text.presetSquare20}
                </button>
              </div>
            </div>

            <div className="field-row">
              <PlainNumberInput
                label={`${text.exportW} (${exportUnit})`}
                value={exportWidthInput}
                min={1}
                step={0.1}
                onChange={onExportWidthInputChange}
              />
              <PlainNumberInput
                label={`${text.exportH} (${exportUnit})`}
                value={exportHeightInput}
                min={1}
                step={0.1}
                onChange={onExportHeightInputChange}
              />
            </div>

            <NumberStepper
              label={`${text.exportDpi} *`}
              value={exportDpi}
              min={1}
              step={1}
              onChange={onExportDpiChange}
              decreaseLabel={text.decrease}
              increaseLabel={text.increase}
            />

            <div className="field-row">
              <NumberStepper
                label={`${text.exportTilesX} *`}
                value={exportTilesX}
                min={1}
                step={1}
                onChange={onExportTilesXChange}
                decreaseLabel={text.decrease}
                increaseLabel={text.increase}
              />
              <label className="field">
                <span>
                  {text.exportTilesY} ({text.autoCalculated})
                </span>
                <input type="number" value={exportTilesY} readOnly />
              </label>
            </div>
            <p className="hint-text">* {text.tipExportTiles}</p>

            <div className="meta-row">
              <span>{text.suggestedTiles}</span>
              <strong>
                {suggestedTilesX} x {suggestedTilesY}
              </strong>
            </div>

            <label className="field">
              <span className="field-label">
                {text.outputUpscale} {exportUpscale.toFixed(2)}x
                <i className="tip-icon" title={text.tipUpscale} aria-label={text.tipUpscale}>
                  ?
                </i>
              </span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.05}
                value={exportUpscale}
                onChange={(event) => onExportUpscaleChange(Number(event.target.value))}
              />
            </label>

            <button type="button" className="secondary-btn" onClick={onAutoUpscale} disabled={!hasImage}>
              {text.autoUpscale} ({suggestedUpscale.toFixed(2)}x)
            </button>
            <p className="hint-text">* {text.tipExportDpi}</p>

            <div className="meta-row">
              <span>{text.targetPixels}</span>
              <strong>
                {exportWidthPx} x {exportHeightPx}px
              </strong>
            </div>
            <div className="meta-row">
              <span>{text.finalExportPixels}</span>
              <strong>
                {effectiveExportWidthPx} x {effectiveExportHeightPx}px
              </strong>
            </div>

            {exportQualityRatio > 1 ? <p className="warning-text">{text.qualityWarning(exportQualityRatio)}</p> : null}
            {exportLimitRisk ? <p className="warning-text">{text.limitWarning}</p> : null}
          </>
        ) : null}
      </section>

      <div className="action-sticky">
        <button type="button" className="secondary-btn" onClick={handlePreview} disabled={!hasImage}>
          {text.previewExport}
        </button>
        <button type="button" className="primary-btn" onClick={onExport} disabled={!hasImage}>
          {text.exportPng}
        </button>
        <button type="button" className="secondary-btn" onClick={onExportPdf} disabled={!hasImage}>
          {text.exportPdf}
        </button>
      </div>

      {previewToast ? <div className="toast">{text.previewApplied}</div> : null}
    </aside>
  )
}
