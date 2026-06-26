"""Batch seamless pattern seam quality tester.

Uses Laplacian ratio + SSIM structural similarity — measures both
edge continuity and structural coherence at tile boundaries.

Usage:
  python scripts/batch_seam_test.py <folder_path>
  python scripts/batch_seam_test.py D:/patterns

Grading (combined ratio = max(lap, ssim), 1.0 = perfect):
  S  <= 1.5  Pixel-perfect seamless
  A  <= 1.75 Seamless (passes human visual test)
  B  <= 2.5  Borderline (may pass at normal zoom)
  C  <= 4.0  Visible seams
  F  >  4.0  Not seamless

Also detects solid-color borders (white/black padding) as F.
SSIM catches toile-style blind spots where pixel diffs are low
but structural context breaks across the seam.
"""

import numpy as np
from PIL import Image
from pathlib import Path
import sys


SSIM_HALF = 8
SSIM_WIN = 8
SSIM_STEP = 4
SSIM_N_INTERIOR = 8


def _block_ssim(a: np.ndarray, b: np.ndarray) -> float:
    """SSIM between two luminance blocks (same shape)."""
    C1 = 6.5025   # (0.01 * 255)^2
    C2 = 58.5225  # (0.03 * 255)^2
    a = a.astype(np.float64)
    b = b.astype(np.float64)
    mu_a = a.mean()
    mu_b = b.mean()
    sig_aa = a.var()
    sig_bb = b.var()
    sig_ab = ((a - mu_a) * (b - mu_b)).mean()
    return float(
        ((2 * mu_a * mu_b + C1) * (2 * sig_ab + C2))
        / ((mu_a**2 + mu_b**2 + C1) * (sig_aa + sig_bb + C2))
    )


def _strip_mean_ssim(lum: np.ndarray, half: int, axis: str) -> float:
    """Mean SSIM between left/right (or top/bottom) halves of a strip."""
    vals = []
    if axis == "lr":
        for y in range(0, lum.shape[0] - SSIM_WIN + 1, SSIM_STEP):
            a = lum[y:y + SSIM_WIN, :half]
            b = lum[y:y + SSIM_WIN, half:]
            vals.append(_block_ssim(a, b))
    else:
        for x in range(0, lum.shape[1] - SSIM_WIN + 1, SSIM_STEP):
            a = lum[:half, x:x + SSIM_WIN]
            b = lum[half:, x:x + SSIM_WIN]
            vals.append(_block_ssim(a, b))
    return float(np.mean(vals)) if vals else 1.0


def compute_ssim_ratio(img: np.ndarray) -> tuple:
    """Returns (ssim_seam_lr, ssim_seam_tb, ssim_ratio)."""
    H, W, _ = img.shape
    if W < SSIM_HALF * 4 or H < SSIM_WIN * 2:
        return 1.0, 1.0, 1.0

    lum = (0.299 * img[:, :, 0] + 0.587 * img[:, :, 1] + 0.114 * img[:, :, 2]).astype(np.float64)

    # LR seam: stitch right edge + left edge
    seam_lr = np.hstack([lum[:, -SSIM_HALF:], lum[:, :SSIM_HALF]])
    ssim_seam_lr = _strip_mean_ssim(seam_lr, SSIM_HALF, "lr")

    # LR interior baseline
    int_ssims_lr = []
    for i in range(SSIM_N_INTERIOR):
        x = SSIM_HALF + int(i * (W - SSIM_HALF * 3) / SSIM_N_INTERIOR)
        strip = lum[:, x:x + SSIM_HALF * 2]
        int_ssims_lr.append(_strip_mean_ssim(strip, SSIM_HALF, "lr"))
    int_mean_lr = float(np.mean(int_ssims_lr)) if int_ssims_lr else 1.0
    ssim_ratio_lr = (1.0 - ssim_seam_lr) / max(1.0 - int_mean_lr, 0.05)

    # TB seam
    ssim_seam_tb = 1.0
    ssim_ratio_tb = 1.0
    if H >= SSIM_HALF * 4 and W >= SSIM_WIN * 2:
        seam_tb = np.vstack([lum[-SSIM_HALF:, :], lum[:SSIM_HALF, :]])
        ssim_seam_tb = _strip_mean_ssim(seam_tb, SSIM_HALF, "tb")

        int_ssims_tb = []
        for i in range(SSIM_N_INTERIOR):
            y = SSIM_HALF + int(i * (H - SSIM_HALF * 3) / SSIM_N_INTERIOR)
            strip = lum[y:y + SSIM_HALF * 2, :]
            int_ssims_tb.append(_strip_mean_ssim(strip, SSIM_HALF, "tb"))
        int_mean_tb = float(np.mean(int_ssims_tb)) if int_ssims_tb else 1.0
        ssim_ratio_tb = (1.0 - ssim_seam_tb) / max(1.0 - int_mean_tb, 0.05)

    return ssim_seam_lr, ssim_seam_tb, max(ssim_ratio_lr, ssim_ratio_tb)


def analyze(img_path: str) -> dict:
    img = np.array(Image.open(img_path).convert("RGB"), dtype=np.int16)
    H, W, _ = img.shape

    if W < 4 or H < 4:
        return {"W": W, "H": H, "lap_lr": 0, "lap_tb": 0, "lap": 0, "edge": 0}

    # --- Edge pixel diff (legacy metric) ---
    lr = np.abs(img[:, 0, :] - img[:, -1, :]).sum(axis=1).astype(float)
    tb = np.abs(img[0, :, :] - img[-1, :, :]).sum(axis=1).astype(float)
    edge_score = (lr.mean() + tb.mean()) / 2

    # --- Laplacian ratio (primary metric) ---
    N_SAMPLES = 16

    # LR: seam Laplacian at x=0 and x=W-1 (wrap-around second derivative)
    slap_lr = (
        np.abs(img[:, -1, :] + img[:, 1, :] - 2 * img[:, 0, :]).sum(axis=1).mean()
        + np.abs(img[:, -2, :] + img[:, 0, :] - 2 * img[:, -1, :]).sum(axis=1).mean()
    ) / 2

    ilap_lr = np.abs(img[:, :-2, :] + img[:, 2:, :] - 2 * img[:, 1:-1, :]).sum(axis=2)
    imed_lr = np.median(ilap_lr.mean(axis=0))
    lap_lr = slap_lr / max(imed_lr, 1.0)

    # TB: seam Laplacian at y=0 and y=H-1
    slap_tb = (
        np.abs(img[-1, :, :] + img[1, :, :] - 2 * img[0, :, :]).sum(axis=1).mean()
        + np.abs(img[-2, :, :] + img[0, :, :] - 2 * img[-1, :, :]).sum(axis=1).mean()
    ) / 2

    ilap_tb = np.abs(img[:-2, :, :] + img[2:, :, :] - 2 * img[1:-1, :, :]).sum(axis=2)
    imed_tb = np.median(ilap_tb.mean(axis=1))
    lap_tb = slap_tb / max(imed_tb, 1.0)

    BORDER_STD = 8.0
    border = False
    if np.std(img[:, 0, :].astype(float)) < BORDER_STD and np.std(img[:, -1, :].astype(float)) < BORDER_STD:
        lap_lr = max(lap_lr, 10.0)
        border = True
    if np.std(img[0, :, :].astype(float)) < BORDER_STD and np.std(img[-1, :, :].astype(float)) < BORDER_STD:
        lap_tb = max(lap_tb, 10.0)
        border = True

    lap = max(lap_lr, lap_tb)

    # --- SSIM structural similarity ---
    ssim_lr, ssim_tb, ssim_ratio = compute_ssim_ratio(img)
    combined = max(lap, ssim_ratio)

    return {
        "W": W, "H": H,
        "lap_lr": lap_lr, "lap_tb": lap_tb, "lap": lap,
        "ssim_lr": ssim_lr, "ssim_tb": ssim_tb, "ssim_ratio": ssim_ratio,
        "combined": combined, "edge": edge_score, "border": border,
    }


def grade(ratio: float) -> str:
    if ratio <= 1.5:
        return "[S]"
    elif ratio <= 1.75:
        return "[A]"
    elif ratio <= 2.5:
        return "[B]"
    elif ratio <= 4.0:
        return "[C]"
    return "[F]"


def grade_word(ratio: float) -> str:
    if ratio <= 1.5:
        return "Pixel-perfect"
    elif ratio <= 1.75:
        return "Seamless"
    elif ratio <= 2.5:
        return "Borderline"
    elif ratio <= 4.0:
        return "Visible seams"
    return "Not seamless"


def main():
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
    files = sorted(f for f in folder.iterdir() if f.suffix.lower() in exts)

    if not files:
        print(f"No image files found in {folder}")
        return

    results = []
    for f in files:
        try:
            r = analyze(str(f))
            r["name"] = f.name
            results.append(r)
        except Exception as e:
            print(f"  ERROR: {f.name}: {e}")

    results.sort(key=lambda r: r["combined"])

    print(f"\n{'='*105}")
    print(f"  Seamless Pattern Batch Test  ({len(results)} images)")
    print(f"  Grade = max(Laplacian ratio, SSIM ratio)  |  1.0 = perfect, >1.75 = seam detected")
    print(f"{'='*105}\n")

    hdr = f"  {'#':>2}  {'Grd':>3} {'Comb':>5}  {'Lap':>5}  {'SSIM':>5}  {'sLR':>4}  {'sTB':>4}  {'Edge':>5}  {'Size':>11}  Name"
    print(hdr)
    print(f"  {'--':>2}  {'---':>3} {'-----':>5}  {'-----':>5}  {'-----':>5}  {'----':>4}  {'----':>4}  {'-----':>5}  {'-'*11}  {'-'*30}")

    counts = {"S": 0, "A": 0, "B": 0, "C": 0, "F": 0}

    for i, r in enumerate(results, 1):
        g = grade(r["combined"])
        letter = g[1]
        counts[letter] = counts.get(letter, 0) + 1

        short = r["name"]
        if len(short) > 45:
            short = short[:20] + "..." + short[-20:]

        mark = ""
        if r.get("border"):
            mark += " [BORDER]"
        if r["combined"] > 1.75:
            mark += " <<"

        ssim_lr_pct = int(r.get("ssim_lr", 1) * 100)
        ssim_tb_pct = int(r.get("ssim_tb", 1) * 100)

        print(
            f"  {i:>2}  {g:>3} {r['combined']:>5.2f}  {r['lap']:>5.2f}  {r['ssim_ratio']:>5.2f}"
            f"  {ssim_lr_pct:>3}%  {ssim_tb_pct:>3}%  {r['edge']:>5.0f}"
            f"  {r['W']:>4}x{r['H']:<4}  {short}{mark}"
        )

    n_pass = counts["S"] + counts["A"]
    n_border = counts["B"]
    n_fail = counts["C"] + counts["F"]

    print(f"\n  {'-'*95}")
    print(f"  PASS (S+A): {n_pass}  |  Borderline (B): {n_border}  |  FAIL (C+F): {n_fail}")
    print(f"  [S]={counts['S']}  [A]={counts['A']}  [B]={counts['B']}  [C]={counts['C']}  [F]={counts['F']}")
    print()


if __name__ == "__main__":
    main()
