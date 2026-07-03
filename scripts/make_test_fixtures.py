"""Generate deterministic seam-test fixture images + expected grades.

Creates PNGs in tests/fixtures/ and runs batch_seam_test.analyze() on each
to pin the expected grade in tests/fixtures/expected.json. The vitest suite
asserts that the TypeScript implementation (src/utils/seamMetrics.ts)
produces the same letter grades — keeping the two implementations in sync.

Usage: python scripts/make_test_fixtures.py
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from batch_seam_test import analyze  # noqa: E402

SIZE = 256
OUT = Path(__file__).parent.parent / "tests" / "fixtures"


def grade_letter(ratio: float) -> str:
    if ratio <= 1.5:
        return "S"
    if ratio <= 1.75:
        return "A"
    if ratio <= 2.5:
        return "B"
    if ratio <= 4.0:
        return "C"
    return "F"


def _waves_float() -> np.ndarray:
    """Integer-frequency sinusoids (perfectly periodic) plus seeded texture.
    The texture matters: on untextured smooth images the SSIM interior
    baseline collapses toward zero and the ratio explodes into false F."""
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float64)
    t = 2 * np.pi / SIZE
    r = 127 + 60 * np.sin(3 * t * x) + 40 * np.cos(5 * t * y)
    g = 127 + 50 * np.sin(4 * t * x + 1.0) + 45 * np.cos(2 * t * y + 0.5)
    b = 127 + 55 * np.sin(2 * t * (x + y)) + 35 * np.cos(6 * t * y)
    img = np.dstack([r, g, b])
    rng = np.random.default_rng(7)
    img += rng.normal(0, 12, img.shape)
    return img


def tileable_waves() -> np.ndarray:
    """Periodic waves + texture -> grade S."""
    return np.clip(_waves_float(), 0, 255).astype(np.uint8)


def gradient_seam() -> np.ndarray:
    """Smooth horizontal gradient -> massive LR seam, near-zero interior
    Laplacian (grade F)."""
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float64)
    r = 255 * x / (SIZE - 1)
    g = 128 + 100 * x / (SIZE - 1)
    b = 200 - 150 * x / (SIZE - 1)
    return np.clip(np.dstack([r, g, b]), 0, 255).astype(np.uint8)


def white_border() -> np.ndarray:
    """Tileable pattern wrapped in solid white padding -> border rule fires
    (grade F)."""
    img = tileable_waves().copy()
    img[:6, :, :] = 255
    img[-6:, :, :] = 255
    img[:, :6, :] = 255
    img[:, -6:, :] = 255
    return img


def _ramped(amplitude: float) -> np.ndarray:
    """Tileable base plus a horizontal ramp: the ramp's wrap discontinuity
    creates a seam whose strength scales with amplitude."""
    x = np.arange(SIZE, dtype=np.float64)
    ramp = (amplitude * x / (SIZE - 1))[None, :, None]
    return np.clip(_waves_float() + ramp, 0, 255).astype(np.uint8)


def subtle_seam() -> np.ndarray:
    """Moderate seam over textured interior -> grade B."""
    return _ramped(50)


def visible_seam() -> np.ndarray:
    """Strong seam over textured interior -> grade C."""
    return _ramped(90)


def uniform_noise() -> np.ndarray:
    """Seeded uniform noise: seams are statistically invisible, ratio ~1
    (grade S)."""
    rng = np.random.default_rng(20260703)
    return rng.integers(0, 256, (SIZE, SIZE, 3), dtype=np.uint8)


FIXTURES = {
    "tileable-waves.png": tileable_waves,
    "gradient-seam.png": gradient_seam,
    "white-border.png": white_border,
    "subtle-seam.png": subtle_seam,
    "visible-seam.png": visible_seam,
    "uniform-noise.png": uniform_noise,
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    expected = {}
    for name, fn in FIXTURES.items():
        path = OUT / name
        Image.fromarray(fn()).save(path)
        r = analyze(str(path))
        expected[name] = {
            "grade": grade_letter(r["combined"]),
            "combined": round(r["combined"], 4),
            "lap": round(r["lap"], 4),
            "ssim_ratio": round(r["ssim_ratio"], 4),
            "border": bool(r.get("border", False)),
        }
        print(f"{name:24} grade={expected[name]['grade']}  combined={r['combined']:.3f}  "
              f"lap={r['lap']:.3f}  ssim={r['ssim_ratio']:.3f}  border={r.get('border')}")

    with open(OUT / "expected.json", "w", encoding="utf-8") as f:
        json.dump(expected, f, indent=2)
    print(f"\nWrote {OUT / 'expected.json'}")


if __name__ == "__main__":
    main()
