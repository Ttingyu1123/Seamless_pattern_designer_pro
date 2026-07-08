import { useMemo, useState } from 'react'
import { uiText, type UILang } from '../i18n'
import {
  runPreflight,
  SIZE_PRESETS,
  VIEWING_DISTANCES,
  type RiskLevel,
  type SizePreset,
  type ViewingDistanceId,
} from '../utils/preflight'

interface PreflightPanelProps {
  lang: UILang
  /** Downscaled preview pixels of the source tile (analysis input) */
  pixels: ImageData | null
  /** True source tile dimensions in px (DPI is judged on these) */
  trueWidth: number
  trueHeight: number
  /** Whole-output physical size derived from the export settings */
  targetWidthMm: number
  targetHeightMm: number
  tilesX: number
  tilesY: number
  onApplySizePreset: (preset: SizePreset) => void
}

// Dark enough to stay readable on the app's light pastel panels.
const LEVEL_COLORS: Record<RiskLevel, string> = {
  good: '#15803d',
  warning: '#b45309',
  bad: '#b91c1c',
}

function MetricRow({ label, level, value }: { label: string; level: RiskLevel; value: string }) {
  return (
    <div className="meta-row preflight-metric">
      <span>
        <i className="level-dot" style={{ backgroundColor: LEVEL_COLORS[level] }} />
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  )
}

export function PreflightPanel({
  lang,
  pixels,
  trueWidth,
  trueHeight,
  targetWidthMm,
  targetHeightMm,
  tilesX,
  tilesY,
  onApplySizePreset,
}: PreflightPanelProps) {
  const text = uiText[lang]
  const [open, setOpen] = useState(false)
  const [viewingDistance, setViewingDistance] = useState<ViewingDistanceId>('poster')
  const [hasFineDetail, setHasFineDetail] = useState(false)

  const report = useMemo(() => {
    if (!open || !pixels || trueWidth < 1 || trueHeight < 1) return null
    // Judge one repeat unit: its printed size is the output size divided by
    // tile count, its pixels are the source tile. Output upscale adds no real
    // detail, so it is ignored on purpose.
    // ponytail: sync compute (~50ms on a 2048px preview); move to a worker
    // like seamWorkerClient if the panel feels laggy while editing sizes.
    return runPreflight(
      { data: pixels.data, width: pixels.width, height: pixels.height },
      {
        targetWidthMm: targetWidthMm / Math.max(1, tilesX),
        targetHeightMm: targetHeightMm / Math.max(1, tilesY),
        bleedMm: 0,
        viewingDistance,
        hasFineDetail,
      },
      { trueWidth, trueHeight },
    )
  }, [open, pixels, trueWidth, trueHeight, targetWidthMm, targetHeightMm, tilesX, tilesY, viewingDistance, hasFineDetail])

  const handlePreset = (preset: SizePreset) => {
    setViewingDistance(preset.viewingDistance)
    onApplySizePreset(preset)
  }

  const maxOutputCm = report
    ? {
        w: Math.round((report.dpi.maxGoodWidthMm * Math.max(1, tilesX)) / 10),
        h: Math.round((report.dpi.maxGoodHeightMm * Math.max(1, tilesY)) / 10),
      }
    : null

  return (
    <details className="advanced-block preflight-block" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{text.preflightSection}</summary>
      <div className="advanced-content">
        <p className="hint-text">{text.preflightHint}</p>

        <div className="preset-row">
          <span>{text.preflightTargetSize}</span>
          <div className="preset-buttons">
            {SIZE_PRESETS.map((preset) => (
              <button key={preset.id} type="button" className="secondary-btn" onClick={() => handlePreset(preset)}>
                {text[preset.labelKey]}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>{text.preflightViewingDistance}</span>
          <select
            value={viewingDistance}
            onChange={(event) => setViewingDistance(event.target.value as ViewingDistanceId)}
          >
            {VIEWING_DISTANCES.map((distance) => (
              <option key={distance.id} value={distance.id}>
                {text[distance.labelKey]}
              </option>
            ))}
          </select>
        </label>

        <label className="bleed-toggle">
          <input
            type="checkbox"
            checked={hasFineDetail}
            onChange={(event) => setHasFineDetail(event.target.checked)}
          />
          {text.preflightFineDetail}
        </label>

        {!pixels ? <p className="hint-text">{text.preflightUploadFirst}</p> : null}

        {report ? (
          <>
            <div className="meta-row preflight-overall">
              <span>{text.preflightOverall}</span>
              <strong style={{ color: LEVEL_COLORS[report.overall.level] }}>
                {report.overall.grade} · {report.overall.score}
              </strong>
            </div>
            <MetricRow
              label={text.preflightEffectiveDpi}
              level={report.dpi.level}
              value={text.preflightDpiDetail(report.dpi.effectiveDpi, report.dpi.requiredDpi)}
            />
            <MetricRow label={text.preflightSharpness} level={report.sharpness.level} value={`${report.sharpness.score}`} />
            <MetricRow label={text.preflightNoise} level={report.noise.level} value={`${report.noise.score}`} />
            <MetricRow label={text.preflightGamut} level={report.gamut.level} value={`${report.gamut.score}`} />

            {report.dpi.level === 'bad' ? <p className="warning-text">{text.preflightDpiBad}</p> : null}
            {report.dpi.level === 'warning' ? <p className="warning-text">{text.preflightDpiBorderline}</p> : null}
            {report.dpi.level !== 'good' && maxOutputCm ? (
              <p className="warning-text">{text.preflightMaxSize(maxOutputCm.w, maxOutputCm.h)}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </details>
  )
}
