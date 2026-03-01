#!/usr/bin/env python3
"""Monitor monster sprite generation, validate each image, retry failures."""
import os, sys, json, time, subprocess
from pathlib import Path

MONSTERS_DIR = Path("public/assets/ai/monsters")
PROMPTS_FILE = Path("scripts/asset_prompts.json")
VENV_ACTIVATE = "source /mnt/c/writable/models/sd-venv/bin/activate"
MAX_CONSECUTIVE_FAILS = 3
POLL_INTERVAL = 30  # seconds

def load_expected():
    with open(PROMPTS_FILE) as f:
        data = json.load(f)
    return {m["name"]: m["size"] for m in data["monsters"]}

def validate_image(path, expected_size):
    """Validate a single monster sprite. Returns (ok, issues_list)."""
    from PIL import Image
    issues = []
    fsize = os.path.getsize(path)

    try:
        img = Image.open(path)
        w, h = img.size
        mode = img.mode

        if w != expected_size or h != expected_size:
            issues.append(f"size {w}x{h} != expected {expected_size}x{expected_size}")

        has_alpha = mode in ("RGBA", "LA", "PA")
        if not has_alpha:
            issues.append("no alpha channel")
        else:
            alpha = img.split()[-1]
            pixels = list(alpha.getdata())
            total = len(pixels)
            transparent = sum(1 for p in pixels if p == 0)
            opaque = sum(1 for p in pixels if p > 200)
            bg_pct = transparent / total * 100
            content_pct = opaque / total * 100

            if bg_pct < 20:
                issues.append(f"bg removal failed ({bg_pct:.0f}% transparent)")
            if content_pct < 5:
                issues.append(f"nearly blank ({content_pct:.0f}% opaque)")

        if fsize < 5000:
            issues.append(f"suspiciously small ({fsize} bytes)")

    except Exception as e:
        issues.append(f"corrupt: {e}")

    return (len(issues) == 0, issues)


def regenerate_single(name):
    """Regenerate a single monster sprite with --force."""
    cmd = f"{VENV_ACTIVATE} && python scripts/generate_assets.py --name {name} --mode pixelsprite --force"
    print(f"  [regen] Regenerating {name}...")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=900)
    if result.returncode != 0:
        print(f"  [regen] FAILED: {result.stderr[-200:]}")
        return False
    print(f"  [regen] Done.")
    return True


def main():
    expected = load_expected()
    validated = set()
    consecutive_fails = 0

    # Pre-validate existing files
    for f in sorted(MONSTERS_DIR.glob("*.png")):
        name = f.stem
        if name in expected:
            validated.add(name)

    print(f"[monitor] {len(validated)}/{len(expected)} already generated")
    print(f"[monitor] Waiting for {len(expected) - len(validated)} remaining...")
    print(f"[monitor] Polling every {POLL_INTERVAL}s, max {MAX_CONSECUTIVE_FAILS} consecutive fails\n")

    while len(validated) < len(expected):
        time.sleep(POLL_INTERVAL)

        # Check for new files
        current_files = {f.stem for f in MONSTERS_DIR.glob("*.png") if f.stem in expected}
        new_files = current_files - validated

        if not new_files:
            # Check if generation process is still alive
            ps = subprocess.run("pgrep -f generate_assets", shell=True, capture_output=True)
            if ps.returncode != 0:
                print("[monitor] Generation process ended. Checking for missing sprites...")
                break
            continue

        for name in sorted(new_files):
            path = MONSTERS_DIR / f"{name}.png"
            exp_size = expected[name]
            ok, issues = validate_image(str(path), exp_size)

            if ok:
                print(f"  OK   | {name} ({exp_size}px)")
                validated.add(name)
                consecutive_fails = 0
            else:
                print(f"  FAIL | {name}: {', '.join(issues)}")
                consecutive_fails += 1

                if consecutive_fails >= MAX_CONSECUTIVE_FAILS:
                    print(f"\n[monitor] {MAX_CONSECUTIVE_FAILS} CONSECUTIVE FAILURES — stopping batch!")
                    print("[monitor] Killing generation process...")
                    subprocess.run("pkill -f generate_assets", shell=True)
                    print("[monitor] Analyze prompts/model before retrying.")
                    sys.exit(1)

                # Try regenerating the failed image
                if regenerate_single(name):
                    ok2, issues2 = validate_image(str(path), exp_size)
                    if ok2:
                        print(f"  OK   | {name} (retry succeeded)")
                        validated.add(name)
                        consecutive_fails = 0
                    else:
                        print(f"  FAIL | {name} (retry also failed): {', '.join(issues2)}")

    # Final summary
    missing = set(expected.keys()) - validated
    if missing:
        print(f"\n[monitor] === {len(missing)} MISSING sprites ===")
        for name in sorted(missing):
            print(f"  - {name} ({expected[name]}px)")

        # Attempt to generate missing ones
        for name in sorted(missing):
            print(f"\n[monitor] Generating missing: {name}")
            if regenerate_single(name):
                path = MONSTERS_DIR / f"{name}.png"
                ok, issues = validate_image(str(path), expected[name])
                if ok:
                    print(f"  OK   | {name}")
                    validated.add(name)
                else:
                    print(f"  FAIL | {name}: {', '.join(issues)}")

    # Update manifest
    print(f"\n[monitor] Updating manifest...")
    subprocess.run(
        f"{VENV_ACTIVATE} && python scripts/generate_assets.py --manifest-only",
        shell=True
    )

    final_missing = set(expected.keys()) - validated
    if final_missing:
        print(f"\n[monitor] === FINAL: {len(final_missing)} still missing ===")
        for n in sorted(final_missing):
            print(f"  - {n}")
        sys.exit(1)
    else:
        print(f"\n[monitor] === ALL {len(expected)} SPRITES COMPLETE AND VALIDATED ===")


if __name__ == "__main__":
    main()
