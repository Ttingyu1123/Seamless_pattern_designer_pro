import type { ViewingDistanceId } from './types';

export const MM_PER_INCH = 25.4;

// The only file adapted during the port from Sticker_Universe: labelKey
// values point at this project's i18n.ts entries, and SIZE_PRESETS target
// this product's print scenarios (fabric / wallpaper / wrapping paper).
export type PreflightLabelKey =
    | 'preflightDistanceHandheld'
    | 'preflightDistanceWall'
    | 'preflightDistancePoster'
    | 'preflightDistanceLarge'
    | 'preflightPresetFabricFatQuarter'
    | 'preflightPresetFabricMeter'
    | 'preflightPresetWallpaperMeter'
    | 'preflightPresetWrappingPaper'
    | 'preflightPresetSwatchA4';

export interface ViewingDistancePreset {
    id: ViewingDistanceId;
    labelKey: PreflightLabelKey;
    requiredDpi: number;
    acceptableDpi: number;
}

// Required DPI drops with viewing distance; values follow common print-shop
// guidance (300 close-up, ~150 posters, ~100 large format).
export const VIEWING_DISTANCES: ViewingDistancePreset[] = [
    { id: 'handheld', labelKey: 'preflightDistanceHandheld', requiredDpi: 300, acceptableDpi: 240 },
    { id: 'wall', labelKey: 'preflightDistanceWall', requiredDpi: 200, acceptableDpi: 150 },
    { id: 'poster', labelKey: 'preflightDistancePoster', requiredDpi: 150, acceptableDpi: 100 },
    { id: 'large', labelKey: 'preflightDistanceLarge', requiredDpi: 100, acceptableDpi: 70 },
];

export interface SizePreset {
    id: string;
    labelKey: PreflightLabelKey;
    widthMm: number;
    heightMm: number;
    viewingDistance: ViewingDistanceId;
}

// Whole-output target sizes; the UI divides by tile count before judging
// per-tile DPI. Textile/wallpaper digital print standard is ~150 DPI, so
// fabric presets map to the 'poster' distance tier.
export const SIZE_PRESETS: SizePreset[] = [
    { id: 'fabricFatQuarter', labelKey: 'preflightPresetFabricFatQuarter', widthMm: 530, heightMm: 500, viewingDistance: 'poster' },
    { id: 'fabricMeter', labelKey: 'preflightPresetFabricMeter', widthMm: 1400, heightMm: 1000, viewingDistance: 'poster' },
    { id: 'wallpaperMeter', labelKey: 'preflightPresetWallpaperMeter', widthMm: 530, heightMm: 1000, viewingDistance: 'poster' },
    { id: 'wrappingPaper', labelKey: 'preflightPresetWrappingPaper', widthMm: 700, heightMm: 500, viewingDistance: 'wall' },
    { id: 'swatchA4', labelKey: 'preflightPresetSwatchA4', widthMm: 210, heightMm: 297, viewingDistance: 'handheld' },
];
