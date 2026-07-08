import type { Grade, OverallResult, PixelSource, PreflightReport, PreflightSettings, RiskLevel } from './types';
import { analyzeDpi } from './dpi';
import { analyzeSharpness } from './sharpness';
import { analyzeNoise } from './noise';
import { analyzeGamut } from './gamut';

export interface RunPreflightOptions {
    /**
     * True source dimensions when `src` pixels were downscaled for analysis
     * (DPI must be judged on the original resolution).
     */
    trueWidth?: number;
    trueHeight?: number;
}

const rank: Record<RiskLevel, number> = { good: 0, warning: 1, bad: 2 };

function worst(levels: RiskLevel[]): RiskLevel {
    return levels.reduce((a, b) => (rank[b] > rank[a] ? b : a), 'good');
}

function toGrade(score: number): Grade {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
}

export function runPreflight(
    src: PixelSource,
    settings: PreflightSettings,
    options: RunPreflightOptions = {}
): PreflightReport {
    const imageWidth = options.trueWidth ?? src.width;
    const imageHeight = options.trueHeight ?? src.height;

    const dpi = analyzeDpi(imageWidth, imageHeight, settings);
    const sharpness = analyzeSharpness(src);
    const noise = analyzeNoise(src);
    const gamut = analyzeGamut(src);

    let score = Math.round(
        dpi.score * 0.45 + sharpness.score * 0.25 + noise.score * 0.15 + gamut.score * 0.15
    );
    // Resolution is the one non-negotiable: a sharp, clean image still prints
    // blurry if the pixels aren't there, so insufficient DPI caps the total.
    if (dpi.level === 'bad') score = Math.min(score, 39);
    else if (dpi.level === 'warning') score = Math.min(score, 69);

    const overall: OverallResult = {
        score,
        level: worst([dpi.level, sharpness.level, noise.level, gamut.level]),
        grade: toGrade(score),
    };

    return { imageWidth, imageHeight, settings, dpi, sharpness, noise, gamut, overall };
}
