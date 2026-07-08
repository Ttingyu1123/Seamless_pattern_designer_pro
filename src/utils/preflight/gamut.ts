import type { GamutResult, PixelSource, RiskLevel } from './types';

// ponytail: heuristic gamut check via HSL saturation bands, not a real
// ICC/CMYK conversion. Good enough to flag "this neon will dull in print";
// upgrade to a coated-FOGRA LUT if predictions need to be trustworthy.

const TARGET_SAMPLES = 120_000;

// Coated CMYK struggles most with vivid saturated mid-tones; vivid
// blues/purples and bright greens/oranges shift the hardest.
function isRiskyPixel(r: number, g: number, b: number): boolean {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 510; // 0..1
    if (l < 0.2 || l > 0.85) return false;
    const delta = max - min;
    if (delta === 0) return false;
    const s = delta / (255 - Math.abs(max + min - 255));

    let h: number;
    if (max === r) h = ((g - b) / delta + 6) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;

    const hardHue = (h >= 200 && h <= 300) || (h >= 80 && h <= 160) || (h >= 20 && h <= 45);
    return s > (hardHue ? 0.72 : 0.88);
}

const RATIO_GOOD = 0.02;
const RATIO_WARNING = 0.1;

export function analyzeGamut(src: PixelSource): GamutResult {
    const totalPixels = src.width * src.height;
    const stride = Math.max(1, Math.floor(totalPixels / TARGET_SAMPLES));
    const { data } = src;
    let sampled = 0;
    let risky = 0;
    for (let p = 0; p < totalPixels; p += stride) {
        const i = p * 4;
        if (data[i + 3] < 16) continue; // ignore transparent pixels
        sampled++;
        if (isRiskyPixel(data[i], data[i + 1], data[i + 2])) risky++;
    }
    const riskyRatio = sampled > 0 ? risky / sampled : 0;
    const level: RiskLevel =
        riskyRatio <= RATIO_GOOD ? 'good'
        : riskyRatio <= RATIO_WARNING ? 'warning'
        : 'bad';
    const score = Math.round(Math.max(0, 100 - (riskyRatio / RATIO_WARNING) * 50));
    return { level, score, riskyRatio: Math.round(riskyRatio * 1000) / 1000 };
}
