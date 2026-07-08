import type { PixelSource, RiskLevel, SharpnessResult } from './types';
import { lumaOf, pickRegions, type LumaPatch } from './sampling';

// ponytail: fixed variance thresholds, no content-type calibration.
// Classic "variance of Laplacian" blur heuristic — flat art scores lower
// than photos by nature; revisit with per-genre calibration if complaints.
const GOOD_VARIANCE = 100;
const WARNING_VARIANCE = 30;

function laplacianVariance(patch: LumaPatch): number {
    const { data, width, height } = patch;
    if (width < 3 || height < 3) return 0;
    let sum = 0;
    let sumSq = 0;
    const n = (width - 2) * (height - 2);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            const v = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - width] - data[i + width];
            sum += v;
            sumSq += v * v;
        }
    }
    const mean = sum / n;
    return sumSq / n - mean * mean;
}

export function analyzeSharpness(src: PixelSource): SharpnessResult {
    const regions = pickRegions(src.width, src.height);
    // Max across regions: an image with one sharp subject and flat background
    // is still sharp; averaging would punish legitimate flat areas.
    let best = 0;
    for (const region of regions) {
        best = Math.max(best, laplacianVariance(lumaOf(src, region)));
    }
    const level: RiskLevel =
        best >= GOOD_VARIANCE ? 'good'
        : best >= WARNING_VARIANCE ? 'warning'
        : 'bad';
    const score = Math.round(Math.min(100, (best / GOOD_VARIANCE) * 100));
    return { level, score, laplacianVariance: Math.round(best * 10) / 10 };
}
