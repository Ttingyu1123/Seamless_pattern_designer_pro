import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { computeSeamMetrics, gradeFromRatio } from '../src/utils/seamMetrics'

const FIXTURES = join(__dirname, 'fixtures')

interface Expected {
  grade: string
  combined: number
  lap: number
  ssim_ratio: number
  border: boolean
}

const expected: Record<string, Expected> = JSON.parse(
  readFileSync(join(FIXTURES, 'expected.json'), 'utf-8'),
)

function loadFixture(name: string): { data: Uint8Array; width: number; height: number } {
  const png = PNG.sync.read(readFileSync(join(FIXTURES, name)))
  return { data: new Uint8Array(png.data), width: png.width, height: png.height }
}

describe('seamMetrics agrees with the Python oracle (scripts/batch_seam_test.py)', () => {
  for (const [name, exp] of Object.entries(expected)) {
    it(`${name} -> grade ${exp.grade}`, () => {
      const { data, width, height } = loadFixture(name)
      const m = computeSeamMetrics(data, width, height)
      expect(gradeFromRatio(m.combinedRatio)).toBe(exp.grade)
    })
  }

  it('white-border triggers the solid-border rule (lapRatio forced >= 10)', () => {
    const { data, width, height } = loadFixture('white-border.png')
    const m = computeSeamMetrics(data, width, height)
    expect(m.lapRatio).toBeGreaterThanOrEqual(10)
  })

  it('combined ratios stay close to the Python implementation', () => {
    // The TS interior baseline samples 16 columns vs Python's full median,
    // so exact equality is not expected — but values must stay in the same
    // grade band with margin. 20% relative tolerance, skipping the border
    // fixture whose ratio is a forced constant.
    for (const [name, exp] of Object.entries(expected)) {
      if (exp.border) continue
      const { data, width, height } = loadFixture(name)
      const m = computeSeamMetrics(data, width, height)
      const rel = Math.abs(m.combinedRatio - exp.combined) / exp.combined
      expect(rel, `${name}: TS=${m.combinedRatio.toFixed(3)} PY=${exp.combined}`).toBeLessThan(0.2)
    }
  })
})

describe('gradeFromRatio thresholds', () => {
  it.each([
    [1.0, 'S'],
    [1.5, 'S'],
    [1.51, 'A'],
    [1.75, 'A'],
    [1.76, 'B'],
    [2.5, 'B'],
    [2.51, 'C'],
    [4.0, 'C'],
    [4.01, 'F'],
    [100, 'F'],
  ])('ratio %f -> %s', (ratio, grade) => {
    expect(gradeFromRatio(ratio)).toBe(grade)
  })
})
