"""Batch seamless pattern seam quality tester.

Uses Laplacian ratio (v3) as primary metric — measures structural continuity
at tile boundaries relative to interior texture.

Usage:
  python scripts/batch_seam_test.py <folder_path>
  python scripts/batch_seam_test.py D:/patterns

Grading (Laplacian ratio, 1.0 = perfect):
  S  <= 1.5  Pixel-perfect seamless
  A  <= 1.75 Seamless (passes human visual test)
  B  <= 2.5  Borderline (may pass at normal zoom)
  C  <= 4.0  Visible seams
  F  >  4.0  Not seamless

Also detects solid-color borders (white/black padding) as F.

Validated against 101 AI-generated patterns with human Procreate testing.
"""

import numpy as np
from PIL import Image
from pathlib import Path
import sys


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

    return {"W": W, "H": H, "lap_lr": lap_lr, "lap_tb": lap_tb, "lap": lap, "edge": edge_score, "border": border}


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

    results.sort(key=lambda r: r["lap"])

    print(f"\n{'='*90}")
    print(f"  Seamless Pattern Batch Test  ({len(results)} images)")
    print(f"  Primary: Laplacian ratio (1.0=perfect, >1.75=seam detected)")
    print(f"{'='*90}\n")

    print(f"  {'#':>2}  {'Grade':>3} {'Lap':>5}  {'LR':>5}  {'TB':>5}  {'Edge':>5}  {'Size':>11}  Name")
    print(f"  {'--':>2}  {'---':>3} {'-----':>5}  {'-----':>5}  {'-----':>5}  {'-----':>5}  {'-'*11}  {'-'*30}")

    counts = {"S": 0, "A": 0, "B": 0, "C": 0, "F": 0}

    for i, r in enumerate(results, 1):
        g = grade(r["lap"])
        letter = g[1]
        counts[letter] = counts.get(letter, 0) + 1

        short = r["name"]
        if len(short) > 45:
            short = short[:20] + "..." + short[-20:]

        mark = ""
        if r.get("border"):
            mark += " [BORDER]"
        if r["lap"] > 1.75:
            mark += " <<"
        print(
            f"  {i:>2}  {g:>3} {r['lap']:>5.2f}  {r['lap_lr']:>5.2f}  {r['lap_tb']:>5.2f}"
            f"  {r['edge']:>5.0f}  {r['W']:>4}x{r['H']:<4}  {short}{mark}"
        )

    n_pass = counts["S"] + counts["A"]
    n_border = counts["B"]
    n_fail = counts["C"] + counts["F"]

    print(f"\n  {'-'*80}")
    print(f"  PASS (S+A): {n_pass}  |  Borderline (B): {n_border}  |  FAIL (C+F): {n_fail}")
    print(f"  [S]={counts['S']}  [A]={counts['A']}  [B]={counts['B']}  [C]={counts['C']}  [F]={counts['F']}")
    print()


if __name__ == "__main__":
    main()
