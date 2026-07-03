import { uiText, type UILang } from '../i18n'
import { gradeFromRatio, type SeamGrade } from '../utils/seamMetrics'

interface HeatmapOverlayProps {
  lang: UILang
  visible: boolean
  avgLeftRight: number
  avgTopBottom: number
  maxDiff: number
  combinedRatio: number
  ssimSeamLR: number
  ssimSeamTB: number
}

function scoreFromDiff(diff: number, maxDiff: number): number {
  const normalized = Math.min(1, Math.max(0, diff / maxDiff))
  return Math.round((1 - normalized) * 100)
}

const GRADE_COLORS: Record<SeamGrade, string> = {
  S: '#22c55e',
  A: '#84cc16',
  B: '#eab308',
  C: '#f97316',
  F: '#ef4444',
}

export function HeatmapOverlay({ lang, visible, avgLeftRight, avgTopBottom, maxDiff, combinedRatio, ssimSeamLR, ssimSeamTB }: HeatmapOverlayProps) {
  if (!visible) return null
  const text = uiText[lang]

  const horizontalScore = scoreFromDiff(avgLeftRight, maxDiff)
  const verticalScore = scoreFromDiff(avgTopBottom, maxDiff)
  const grade = gradeFromRatio(combinedRatio)
  const gradeColor = GRADE_COLORS[grade]
  const ssimPct = Math.round(Math.min(ssimSeamLR, ssimSeamTB) * 100)

  return (
    <div className="heatmap-overlay" role="status" aria-live="polite">
      <h2>{text.seamDetector}</h2>
      <div className="seam-grade">
        <span>{text.seamGrade}</span>
        <strong className="grade-letter" style={{ color: gradeColor }}>{grade}</strong>
      </div>
      <p className="seam-hint">{text.seamHint}</p>
      <div className="metric">
        <span>{text.leftRight}</span>
        <strong>{horizontalScore}%</strong>
      </div>
      <div className="bar">
        <i style={{ width: `${horizontalScore}%` }} />
      </div>
      <div className="metric">
        <span>{text.topBottom}</span>
        <strong>{verticalScore}%</strong>
      </div>
      <div className="bar">
        <i style={{ width: `${verticalScore}%` }} />
      </div>
      <div className="metric">
        <span>{text.ssimLabel}</span>
        <strong>{ssimPct}%</strong>
      </div>
      <div className="bar">
        <i style={{ width: `${ssimPct}%` }} />
      </div>
    </div>
  )
}
