import { describe, expect, it } from 'vitest';
import {
    analyzeDpi,
    analyzeGamut,
    analyzeNoise,
    analyzeSharpness,
    runPreflight,
    type PixelSource,
    type PreflightSettings,
} from '../src/utils/preflight';

// Deterministic LCG so fixtures never flake (no Math.random).
function lcg(seed: number) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}

// Box-Muller gaussian from a seeded uniform source.
function gaussian(rand: () => number) {
    return () => {
        const u = Math.max(rand(), 1e-9);
        const v = rand();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
}

function makeImage(
    width: number,
    height: number,
    fill: (x: number, y: number) => [number, number, number, number?]
): PixelSource {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const [r, g, b, a = 255] = fill(x, y);
            const i = (y * width + x) * 4;
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = a;
        }
    }
    return { data, width, height };
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

const settings = (overrides: Partial<PreflightSettings> = {}): PreflightSettings => ({
    targetWidthMm: 297,
    targetHeightMm: 420,
    bleedMm: 3,
    viewingDistance: 'poster',
    hasFineDetail: false,
    ...overrides,
});

describe('analyzeDpi', () => {
    it('computes effective DPI for A3 poster with bleed', () => {
        // Print area 303 x 426 mm = 11.93 x 16.77 in
        // min(3000/11.93, 4200/16.77) ≈ 250
        const result = analyzeDpi(3000, 4200, settings());
        expect(result.effectiveDpi).toBe(250);
        expect(result.requiredDpi).toBe(150);
        expect(result.level).toBe('good');
        expect(result.rotated).toBe(false);
    });

    it('rotates the image when landscape source fits portrait target better', () => {
        const direct = analyzeDpi(3000, 4200, settings());
        const rotated = analyzeDpi(4200, 3000, settings());
        expect(rotated.rotated).toBe(true);
        expect(rotated.effectiveDpi).toBe(direct.effectiveDpi);
    });

    it('flags insufficient resolution as bad', () => {
        const result = analyzeDpi(800, 1132, settings());
        expect(result.effectiveDpi).toBeLessThan(100);
        expect(result.level).toBe('bad');
    });

    it('raises the DPI requirement for fine detail', () => {
        const base = analyzeDpi(3000, 4200, settings({ viewingDistance: 'handheld' }));
        const fine = analyzeDpi(3000, 4200, settings({ viewingDistance: 'handheld', hasFineDetail: true }));
        expect(base.requiredDpi).toBe(300);
        expect(fine.requiredDpi).toBe(375);
    });

    it('reports max print size at the required DPI', () => {
        const result = analyzeDpi(3000, 4200, settings({ bleedMm: 0 }));
        // 3000 px / 150 dpi * 25.4 = 508 mm
        expect(result.maxGoodWidthMm).toBe(508);
        expect(result.maxGoodHeightMm).toBe(711);
    });
});

describe('analyzeSharpness', () => {
    const noise = gaussian(lcg(42));
    const sharp = makeImage(256, 256, (x, y) => {
        const v = ((x >> 2) + (y >> 2)) % 2 === 0 ? 40 : 215;
        const n = clamp255(v + noise() * 4);
        return [n, n, n];
    });
    const noise2 = gaussian(lcg(43));
    const blurry = makeImage(256, 256, (x) => {
        const n = clamp255(x / 2 + 60 + noise2());
        return [n, n, n];
    });

    it('rates a checkerboard sharper than a smooth gradient', () => {
        const sharpResult = analyzeSharpness(sharp);
        const blurryResult = analyzeSharpness(blurry);
        expect(sharpResult.laplacianVariance).toBeGreaterThan(blurryResult.laplacianVariance);
        expect(sharpResult.level).toBe('good');
        expect(blurryResult.level).toBe('bad');
    });
});

describe('analyzeNoise', () => {
    it('estimates gaussian noise sigma within tolerance', () => {
        const noise = gaussian(lcg(7));
        const noisy = makeImage(256, 256, () => {
            const n = clamp255(128 + noise() * 8);
            return [n, n, n];
        });
        const result = analyzeNoise(noisy);
        expect(result.noiseSigma).toBeGreaterThan(5.5);
        expect(result.noiseSigma).toBeLessThan(10.5);
        expect(result.level).toBe('bad');
    });

    it('rates a clean textured gradient as good', () => {
        // Mild texture is required: a pure quantized gradient's rounding
        // pattern aligns with the 8px block grid and fakes blockiness.
        const texture = gaussian(lcg(21));
        const clean = makeImage(256, 256, (x, y) => {
            const v = clamp255(x / 2 + y / 4 + 30 + texture() * 1.5);
            return [v, v, v];
        });
        const result = analyzeNoise(clean);
        expect(result.noiseSigma).toBeLessThan(2.5);
        expect(result.level).toBe('good');
    });

    it('detects JPEG-style 8px block artifacts', () => {
        const blockValue = lcg(11);
        const blockLut: number[] = [];
        const texture = gaussian(lcg(12));
        const blocky = makeImage(256, 256, (x, y) => {
            const block = (y >> 3) * 32 + (x >> 3);
            if (blockLut[block] === undefined) blockLut[block] = 90 + blockValue() * 80;
            const n = clamp255(blockLut[block] + texture() * 1.5);
            return [n, n, n];
        });
        const result = analyzeNoise(blocky);
        expect(result.blockiness).toBeGreaterThan(1.4);
        expect(result.level).toBe('bad');
    });
});

describe('analyzeGamut', () => {
    it('flags a fully neon image as high risk', () => {
        const neon = makeImage(128, 128, (x) => (x % 2 === 0 ? [0, 60, 255] : [170, 0, 255]));
        const result = analyzeGamut(neon);
        expect(result.riskyRatio).toBeGreaterThan(0.5);
        expect(result.level).toBe('bad');
    });

    it('rates pastel colors as good', () => {
        const pastel = makeImage(128, 128, () => [205, 195, 215]);
        const result = analyzeGamut(pastel);
        expect(result.riskyRatio).toBeLessThanOrEqual(0.02);
        expect(result.level).toBe('good');
    });

    it('ignores transparent pixels', () => {
        const transparentNeon = makeImage(64, 64, () => [0, 60, 255, 0]);
        const result = analyzeGamut(transparentNeon);
        expect(result.riskyRatio).toBe(0);
    });
});

describe('runPreflight', () => {
    const noise = gaussian(lcg(99));
    const src = makeImage(512, 512, (x, y) => {
        const v = ((x >> 3) + (y >> 3)) % 2 === 0 ? 70 : 190;
        const n = clamp255(v + noise() * 3);
        return [n, n, n];
    });

    it('caps the overall score when DPI is insufficient', () => {
        // 512 px on a 297mm-wide poster ≈ 43 DPI → bad
        const report = runPreflight(src, settings());
        expect(report.dpi.level).toBe('bad');
        expect(report.overall.score).toBeLessThanOrEqual(39);
        expect(['D', 'F']).toContain(report.overall.grade);
    });

    it('uses true dimensions for DPI when analysis pixels were downscaled', () => {
        const report = runPreflight(src, settings({ bleedMm: 0 }), { trueWidth: 3000, trueHeight: 4200 });
        expect(report.imageWidth).toBe(3000);
        expect(report.dpi.effectiveDpi).toBe(254);
        expect(report.dpi.level).toBe('good');
    });

    it('scores a clean sharp image printed small as A grade', () => {
        // 512 px at 40mm ≈ 325 DPI at handheld distance
        const report = runPreflight(src, settings({
            targetWidthMm: 40,
            targetHeightMm: 40,
            bleedMm: 0,
            viewingDistance: 'handheld',
        }));
        expect(report.dpi.level).toBe('good');
        expect(report.overall.grade).toBe('A');
    });
});
