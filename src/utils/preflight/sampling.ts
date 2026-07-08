import type { PixelSource } from './types';

export interface Region {
    x: number;
    y: number;
    width: number;
    height: number;
}

const DEFAULT_REGION_SIZE = 512;

/**
 * Pick up to five square regions (center + four corners, inset 10%) so pixel
 * metrics stay O(regions × size²) regardless of image size. A small image
 * yields a single full-frame region.
 */
export function pickRegions(width: number, height: number, size = DEFAULT_REGION_SIZE): Region[] {
    if (width <= size * 2 && height <= size * 2) {
        return [{ x: 0, y: 0, width, height }];
    }
    const insetX = Math.round(width * 0.1);
    const insetY = Math.round(height * 0.1);
    const clamp = (v: number, max: number) => Math.min(Math.max(0, v), max);
    const candidates = [
        { x: (width - size) / 2, y: (height - size) / 2 },
        { x: insetX, y: insetY },
        { x: width - size - insetX, y: insetY },
        { x: insetX, y: height - size - insetY },
        { x: width - size - insetX, y: height - size - insetY },
    ];
    const seen = new Set<string>();
    const regions: Region[] = [];
    for (const c of candidates) {
        const x = clamp(Math.round(c.x), width - size);
        const y = clamp(Math.round(c.y), height - size);
        const key = `${x},${y}`;
        if (!seen.has(key)) {
            seen.add(key);
            regions.push({ x, y, width: size, height: size });
        }
    }
    return regions;
}

export interface LumaPatch {
    data: Float32Array;
    width: number;
    height: number;
}

/** Extract a grayscale (Rec.601 luma) patch for one region. */
export function lumaOf(src: PixelSource, region: Region): LumaPatch {
    const { data, width } = src;
    const out = new Float32Array(region.width * region.height);
    let i = 0;
    for (let y = region.y; y < region.y + region.height; y++) {
        let p = (y * width + region.x) * 4;
        for (let x = 0; x < region.width; x++, p += 4, i++) {
            out[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
        }
    }
    return { data: out, width: region.width, height: region.height };
}
