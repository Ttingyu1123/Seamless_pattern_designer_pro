import type { NoiseResult, PixelSource, RiskLevel } from './types';
import { lumaOf, pickRegions, type LumaPatch } from './sampling';

// Immerkær (1996) fast noise variance estimation: convolve with
// [1,-2,1; -2,4,-2; 1,-2,1] — the mask annihilates linear image structure,
// so its mean absolute response tracks gaussian noise sigma.
function immerkaerSigma(patch: LumaPatch): number {
    const { data, width, height } = patch;
    if (width < 3 || height < 3) return 0;
    let sumAbs = 0;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            const v =
                4 * data[i]
                - 2 * (data[i - 1] + data[i + 1] + data[i - width] + data[i + width])
                + data[i - width - 1] + data[i - width + 1]
                + data[i + width - 1] + data[i + width + 1];
            sumAbs += Math.abs(v);
        }
    }
    const n = (width - 2) * (height - 2);
    return Math.sqrt(Math.PI / 2) * (sumAbs / (6 * n));
}

// JPEG compression leaves gradient discontinuities on the 8px block grid.
// Compare mean |diff| across block boundaries vs interior columns/rows.
function blockinessRatio(patch: LumaPatch): number {
    const { data, width, height } = patch;
    if (width < 17 || height < 17) return 1;
    let boundarySum = 0, boundaryN = 0;
    let interiorSum = 0, interiorN = 0;
    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 1; x < width; x++) {
            const d = Math.abs(data[row + x] - data[row + x - 1]);
            if (x % 8 === 0) { boundarySum += d; boundaryN++; }
            else { interiorSum += d; interiorN++; }
        }
    }
    for (let x = 0; x < width; x++) {
        for (let y = 1; y < height; y++) {
            const d = Math.abs(data[y * width + x] - data[(y - 1) * width + x]);
            if (y % 8 === 0) { boundarySum += d; boundaryN++; }
            else { interiorSum += d; interiorN++; }
        }
    }
    const interiorMean = interiorSum / interiorN;
    if (interiorMean < 0.05) return 1; // essentially flat image, no signal
    return (boundarySum / boundaryN) / interiorMean;
}

// ponytail: fixed thresholds tuned by eye on a handful of samples.
const SIGMA_GOOD = 2.5;
const SIGMA_WARNING = 6;
const BLOCK_GOOD = 1.15;
const BLOCK_WARNING = 1.4;

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

export function analyzeNoise(src: PixelSource): NoiseResult {
    const regions = pickRegions(src.width, src.height);
    const sigmas: number[] = [];
    const blocks: number[] = [];
    for (const region of regions) {
        const patch = lumaOf(src, region);
        sigmas.push(immerkaerSigma(patch));
        blocks.push(blockinessRatio(patch));
    }
    // Median across regions: texture-heavy regions inflate the estimate, so
    // the middle value is a fairer read of global noise than the mean.
    const noiseSigma = Math.round(median(sigmas) * 100) / 100;
    const blockiness = Math.round(median(blocks) * 100) / 100;

    const sigmaLevel: RiskLevel =
        noiseSigma <= SIGMA_GOOD ? 'good' : noiseSigma <= SIGMA_WARNING ? 'warning' : 'bad';
    const blockLevel: RiskLevel =
        blockiness <= BLOCK_GOOD ? 'good' : blockiness <= BLOCK_WARNING ? 'warning' : 'bad';
    const rank = { good: 0, warning: 1, bad: 2 } as const;
    const level = rank[sigmaLevel] >= rank[blockLevel] ? sigmaLevel : blockLevel;

    const sigmaScore = Math.max(0, 100 - (noiseSigma / SIGMA_WARNING) * 50);
    const blockScore = Math.max(0, 100 - Math.max(0, blockiness - 1) / (BLOCK_WARNING - 1) * 50);
    const score = Math.round(Math.min(sigmaScore, blockScore));

    return { level, score, noiseSigma, blockiness };
}
