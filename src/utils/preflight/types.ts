// Pure analysis core — no DOM/canvas/React dependencies.
// Ported verbatim from Sticker_Universe src/pages/PrintPreflight/core
// (single source of truth); callers hand in raw RGBA pixels, the core
// hands back plain data.

export interface PixelSource {
    /** RGBA, 4 bytes per pixel, row-major (ImageData-compatible) */
    data: Uint8ClampedArray;
    width: number;
    height: number;
}

export type RiskLevel = 'good' | 'warning' | 'bad';

export type ViewingDistanceId = 'handheld' | 'wall' | 'poster' | 'large';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface PreflightSettings {
    targetWidthMm: number;
    targetHeightMm: number;
    bleedMm: number;
    viewingDistance: ViewingDistanceId;
    /** Image contains small text or thin lines → stricter DPI requirement */
    hasFineDetail: boolean;
}

export interface DpiResult {
    level: RiskLevel;
    /** 0–100, ratio of effective vs required DPI */
    score: number;
    effectiveDpi: number;
    requiredDpi: number;
    acceptableDpi: number;
    /** true when rotating the image 90° gives a better fit to the target */
    rotated: boolean;
    /** Largest print size (same aspect as image) that still meets requiredDpi */
    maxGoodWidthMm: number;
    maxGoodHeightMm: number;
}

export interface SharpnessResult {
    level: RiskLevel;
    score: number;
    /** Variance of 3x3 Laplacian response on the sharpest sampled region */
    laplacianVariance: number;
}

export interface NoiseResult {
    level: RiskLevel;
    score: number;
    /** Estimated gaussian noise sigma (Immerkær method), 0–255 luma scale */
    noiseSigma: number;
    /** Gradient energy at 8px JPEG block boundaries vs interior; 1.0 = none */
    blockiness: number;
}

export interface GamutResult {
    level: RiskLevel;
    score: number;
    /** Fraction (0–1) of sampled pixels at risk of visible CMYK color shift */
    riskyRatio: number;
}

export interface OverallResult {
    score: number;
    level: RiskLevel;
    grade: Grade;
}

export interface PreflightReport {
    /** True source pixel dimensions (may differ from analyzed pixels if downscaled) */
    imageWidth: number;
    imageHeight: number;
    settings: PreflightSettings;
    dpi: DpiResult;
    sharpness: SharpnessResult;
    noise: NoiseResult;
    gamut: GamutResult;
    overall: OverallResult;
}
