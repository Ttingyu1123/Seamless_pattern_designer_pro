import type { DpiResult, PreflightSettings, RiskLevel } from './types';
import { MM_PER_INCH, VIEWING_DISTANCES } from './presets';

// Small text / thin lines need extra resolution headroom to stay legible.
const FINE_DETAIL_FACTOR = 1.25;

export function analyzeDpi(
    imageWidth: number,
    imageHeight: number,
    settings: PreflightSettings
): DpiResult {
    const distance = VIEWING_DISTANCES.find(v => v.id === settings.viewingDistance) ?? VIEWING_DISTANCES[0];
    const factor = settings.hasFineDetail ? FINE_DETAIL_FACTOR : 1;
    const requiredDpi = Math.round(distance.requiredDpi * factor);
    const acceptableDpi = Math.round(distance.acceptableDpi * factor);

    const printWidthIn = (settings.targetWidthMm + settings.bleedMm * 2) / MM_PER_INCH;
    const printHeightIn = (settings.targetHeightMm + settings.bleedMm * 2) / MM_PER_INCH;

    // The image fills the whole sheet; effective DPI is limited by the
    // tighter axis. Try both orientations and keep the better one.
    const directDpi = Math.min(imageWidth / printWidthIn, imageHeight / printHeightIn);
    const rotatedDpi = Math.min(imageHeight / printWidthIn, imageWidth / printHeightIn);
    const rotated = rotatedDpi > directDpi;
    const effectiveDpi = Math.round(Math.max(directDpi, rotatedDpi));

    const level: RiskLevel =
        effectiveDpi >= requiredDpi ? 'good'
        : effectiveDpi >= acceptableDpi ? 'warning'
        : 'bad';
    const score = Math.round(Math.min(100, Math.max(0, (effectiveDpi / requiredDpi) * 100)));

    const [alignedW, alignedH] = rotated ? [imageHeight, imageWidth] : [imageWidth, imageHeight];
    const maxGoodWidthMm = Math.floor((alignedW / requiredDpi) * MM_PER_INCH);
    const maxGoodHeightMm = Math.floor((alignedH / requiredDpi) * MM_PER_INCH);

    return {
        level,
        score,
        effectiveDpi,
        requiredDpi,
        acceptableDpi,
        rotated,
        maxGoodWidthMm,
        maxGoodHeightMm,
    };
}
