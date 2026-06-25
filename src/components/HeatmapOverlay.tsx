import { uiText, type UILang } from '../i18n'

interface HeatmapOverlayProps {
  lang: UILang
  visible: boolean
  avgLeftRight: number
  avgTopBottom: number
  maxDiff: number
  lapRatio: number
}

function scoreFromDiff(diff: number, maxDiff: number): number {
  const normalized = Math.min(1, Math.max(0, diff / maxDiff))
  return Math.round((1 - normalized) * 100)
}

function gradeFromLapRatio(ratio: number): { letter: string; color: string } {
  if (ratio <= 1.5) return { letter: 'S', color: '#22c55e' }
  if (ratio <= 1.75) return { letter: 'A', color: '#84cc16' }
  if (ratio <= 2.5) return { letter: 'B', color: '#eab308' }
  if (ratio <= 4.0) return { letter: 'C', color: '#f97316' }
  return { letter: 'F', color: '#ef4444' }
}

export function HeatmapOverlay({ lang, visible, avgLeftRight, avgTopBottom, maxDiff, lapRatio }: HeatmapOverlayProps) {
  if (!visible) return null
  const text = uiText[lang]

  const horizontalScore = scoreFromDiff(avgLeftRight, maxDiff)
  const verticalScore = scoreFromDiff(avgTopBottom, maxDiff)
  const grade = gradeFromLapRatio(lapRatio)

  return (
    <div className="heatmap-overlay" role="status" aria-live="polite">
      <h2>{text.seamDetector}</h2>
      <div className="seam-grade">
        <span>{text.seamGrade}</span>
        <strong className="grade-letter" style={{ color: grade.color }}>{grade.letter}</strong>
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
    </div>
  )
}
