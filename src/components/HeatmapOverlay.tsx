import { uiText, type UILang } from '../i18n'

interface HeatmapOverlayProps {
  lang: UILang
  visible: boolean
  avgLeftRight: number
  avgTopBottom: number
  maxDiff: number
}

function scoreFromDiff(diff: number, maxDiff: number): number {
  const normalized = Math.min(1, Math.max(0, diff / maxDiff))
  return Math.round((1 - normalized) * 100)
}

export function HeatmapOverlay({ lang, visible, avgLeftRight, avgTopBottom, maxDiff }: HeatmapOverlayProps) {
  if (!visible) return null
  const text = uiText[lang]

  const horizontalScore = scoreFromDiff(avgLeftRight, maxDiff)
  const verticalScore = scoreFromDiff(avgTopBottom, maxDiff)

  return (
    <div className="heatmap-overlay" role="status" aria-live="polite">
      <h2>{text.seamDetector}</h2>
      <p>{text.seamHint}</p>
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
