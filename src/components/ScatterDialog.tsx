import { useState } from 'react'
import { useComposerStore } from '../store/composerStore'
import type { MotifLayer } from '../store/composerStore'
import { generateScatterPositions } from '../utils/scatterEngine'
import { loadLayerImage } from '../hooks/useComposerEngine'
import type { UILang } from '../i18n'

interface Props {
  lang: UILang
  sourceLayer: MotifLayer
  onClose: () => void
}

export function ScatterDialog({ lang, sourceLayer, onClose }: Props) {
  const tileSizePx = useComposerStore((s) => s.tileSizePx)
  const addLayer = useComposerStore((s) => s.addLayer)

  const [count, setCount] = useState(12)
  const [minDistance, setMinDistance] = useState(60)
  const [rotMin, setRotMin] = useState(0)
  const [rotMax, setRotMax] = useState(360)
  const [scaleMin, setScaleMin] = useState(0.7)
  const [scaleMax, setScaleMax] = useState(1.3)
  const [seed, setSeed] = useState(Math.floor(Math.random() * 10000))

  const handleApply = async () => {
    const positions = generateScatterPositions(
      {
        count,
        minDistance,
        rotationRange: [(rotMin * Math.PI) / 180, (rotMax * Math.PI) / 180],
        scaleRange: [scaleMin, scaleMax],
        seed,
      },
      tileSizePx.width,
      tileSizePx.height,
    )

    for (const pos of positions) {
      const layer: MotifLayer = {
        id: crypto.randomUUID(),
        name: `${sourceLayer.name} scatter`,
        imageDataUrl: sourceLayer.imageDataUrl,
        naturalWidth: sourceLayer.naturalWidth,
        naturalHeight: sourceLayer.naturalHeight,
        x: pos.x,
        y: pos.y,
        rotation: pos.rotation,
        scaleX: pos.scale,
        scaleY: pos.scale,
        opacity: sourceLayer.opacity,
        hue: sourceLayer.hue,
        saturation: sourceLayer.saturation,
        brightness: sourceLayer.brightness,
        visible: true,
        locked: false,
      }
      await loadLayerImage(layer)
      addLayer(layer)
    }

    onClose()
  }

  const zh = lang === 'zh'

  return (
    <div className="scatter-dialog-backdrop" onClick={onClose}>
      <div className="scatter-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{zh ? '自動散佈' : 'Scatter'}</h3>
        <p className="scatter-source">{zh ? '來源' : 'Source'}: {sourceLayer.name}</p>

        <div className="scatter-row">
          <label>{zh ? '數量' : 'Count'}</label>
          <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </div>

        <div className="scatter-row">
          <label>{zh ? '最小間距 (px)' : 'Min Distance (px)'}</label>
          <input type="number" min={10} max={500} value={minDistance} onChange={(e) => setMinDistance(Number(e.target.value))} />
        </div>

        <div className="scatter-row">
          <label>{zh ? '旋轉範圍 (°)' : 'Rotation (°)'}</label>
          <input type="number" min={0} max={360} value={rotMin} onChange={(e) => setRotMin(Number(e.target.value))} style={{ width: 50 }} />
          <span>~</span>
          <input type="number" min={0} max={360} value={rotMax} onChange={(e) => setRotMax(Number(e.target.value))} style={{ width: 50 }} />
        </div>

        <div className="scatter-row">
          <label>{zh ? '縮放範圍' : 'Scale'}</label>
          <input type="number" min={0.1} max={3} step={0.1} value={scaleMin} onChange={(e) => setScaleMin(Number(e.target.value))} style={{ width: 50 }} />
          <span>~</span>
          <input type="number" min={0.1} max={3} step={0.1} value={scaleMax} onChange={(e) => setScaleMax(Number(e.target.value))} style={{ width: 50 }} />
        </div>

        <div className="scatter-row">
          <label>{zh ? '隨機種子' : 'Seed'}</label>
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} style={{ width: 70 }} />
          <button className="scatter-reseed" onClick={() => setSeed(Math.floor(Math.random() * 10000))}>
            {zh ? '重新' : 'Re-roll'}
          </button>
        </div>

        <div className="scatter-actions">
          <button className="scatter-cancel" onClick={onClose}>{zh ? '取消' : 'Cancel'}</button>
          <button className="scatter-apply" onClick={handleApply}>{zh ? '套用' : 'Apply'}</button>
        </div>
      </div>
    </div>
  )
}
