import { uiText, type UILang } from '../i18n'
import { GRADE_COLORS } from '../utils/seamMetrics'
import { batchResultsToCsv, type BatchResult } from '../utils/batchAnalyzer'

interface BatchPanelProps {
  lang: UILang
  results: BatchResult[] | null
  progress: { done: number; total: number } | null
  onSelect: (file: File) => void
  onClose: () => void
}

function downloadCsv(results: BatchResult[]) {
  const blob = new Blob([batchResultsToCsv(results)], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T-]/g, '')
  link.download = `seam-batch-report_${ts}.csv`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

export function BatchPanel({ lang, results, progress, onSelect, onClose }: BatchPanelProps) {
  const text = uiText[lang]
  const analyzing = progress !== null && progress.done < progress.total

  if (!analyzing && (!results || results.length === 0)) return null

  const pass = results?.filter((r) => r.grade === 'S' || r.grade === 'A').length ?? 0
  const borderline = results?.filter((r) => r.grade === 'B').length ?? 0
  const fail = results?.filter((r) => r.grade === 'C' || r.grade === 'F').length ?? 0

  return (
    <div className="batch-panel" role="region" aria-label={text.batchTitle}>
      <div className="batch-panel-head">
        <h2>{text.batchTitle}</h2>
        <div className="batch-panel-actions">
          {results && results.length > 0 && (
            <button type="button" className="secondary-btn" onClick={() => downloadCsv(results)}>
              {text.batchExportCsv}
            </button>
          )}
          <button type="button" className="secondary-btn" onClick={onClose}>
            {text.batchClose}
          </button>
        </div>
      </div>

      {analyzing && (
        <p className="batch-progress" role="status" aria-live="polite">
          {text.batchAnalyzing(progress.done, progress.total)}
        </p>
      )}

      {results && results.length > 0 && (
        <>
          <p className="batch-summary">{text.batchSummary(pass, borderline, fail)}</p>
          <p className="batch-hint">{text.batchRowHint}</p>
          <div className="batch-table-wrap">
            <table className="batch-table">
              <thead>
                <tr>
                  <th>{text.batchColGrade}</th>
                  <th>{text.batchColRatio}</th>
                  <th>{text.batchColSize}</th>
                  <th>{text.batchColFile}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.name} onClick={() => !r.error && onSelect(r.file)} className={r.error ? 'batch-row-error' : ''}>
                    <td>
                      <span className="batch-grade" style={{ background: GRADE_COLORS[r.grade] }}>
                        {r.grade}
                      </span>
                    </td>
                    <td>{Number.isFinite(r.combinedRatio) ? r.combinedRatio.toFixed(2) : '—'}</td>
                    <td>{r.error ? text.batchDecodeError : `${r.width}×${r.height}`}</td>
                    <td className="batch-name" title={r.name}>{r.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
