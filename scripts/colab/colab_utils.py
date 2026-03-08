#!/usr/bin/env python3
"""
Shared Colab utilities for 勇者傳說 asset generation scripts.
Handles: Colab detection, Google Drive mount, progress tracking, VRAM monitoring.
"""

import json
import os
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Colab environment detection
# ---------------------------------------------------------------------------
def is_colab() -> bool:
    """Check if running inside Google Colab."""
    try:
        import google.colab  # noqa: F401
        return True
    except ImportError:
        return False


def mount_drive():
    """Mount Google Drive if on Colab (no-op otherwise)."""
    if not is_colab():
        return
    try:
        from google.colab import drive
        if not os.path.ismount("/content/drive"):
            drive.mount("/content/drive")
            print("[colab] Google Drive mounted")
        else:
            print("[colab] Google Drive already mounted")
    except Exception as e:
        print(f"[colab] Drive mount failed: {e}")


# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
# Google Drive base for Colab outputs
GDRIVE_BASE = Path("/content/drive/MyDrive/ai-rpg-game")
GDRIVE_OUTPUTS = GDRIVE_BASE / "outputs"
GDRIVE_MODELS = GDRIVE_BASE / "models"
GDRIVE_PROMPTS = GDRIVE_BASE / "prompts"

# Local paths (WSL / native)
LOCAL_MODELS = Path(os.environ.get("MODELS_DIR", "/mnt/c/writable/models"))


def get_output_base() -> Path:
    """Get the root output directory. On Colab → Google Drive, else → project's public/assets/ai."""
    if is_colab():
        return GDRIVE_OUTPUTS
    # Local: use project public dir
    script_dir = Path(__file__).parent
    return script_dir.parent.parent / "public" / "assets" / "ai"


def get_prompts_path(filename: str = "asset_prompts.json") -> Path:
    """Find prompts JSON file. Priority: Drive > project scripts/ dir."""
    # Check Google Drive first (uploaded by user)
    gdrive_path = GDRIVE_PROMPTS / filename
    if gdrive_path.exists():
        print(f"[prompts] Using Google Drive: {gdrive_path}")
        return gdrive_path

    # Fall back to project's scripts/ dir
    script_dir = Path(__file__).parent
    project_path = script_dir.parent / filename
    if project_path.exists():
        print(f"[prompts] Using local: {project_path}")
        return project_path

    raise FileNotFoundError(
        f"Prompts file '{filename}' not found.\n"
        f"  Expected at: {gdrive_path}\n"
        f"  Or at: {project_path}\n"
        f"  Upload it to Google Drive or clone the repo."
    )


def get_model_cache_path(model_name: str, hub_id: str) -> str:
    """Resolve model path: local dir > Google Drive cache > HuggingFace Hub ID."""
    # Local
    local = LOCAL_MODELS / model_name
    if local.exists() and (local / "model_index.json").exists():
        print(f"[model] Local: {local}")
        return str(local)

    # Google Drive cache
    gdrive = GDRIVE_MODELS / model_name
    if gdrive.exists() and (gdrive / "model_index.json").exists():
        print(f"[model] Google Drive cache: {gdrive}")
        return str(gdrive)

    # Download from Hub (HF caches in ~/.cache/huggingface/)
    print(f"[model] Downloading from HuggingFace: {hub_id}")
    return hub_id


# ---------------------------------------------------------------------------
# Progress tracking (resume on interrupt)
# ---------------------------------------------------------------------------
class ProgressTracker:
    """Track completed items in a JSON file so interrupted runs can resume.

    Usage:
        tracker = ProgressTracker("sprites", output_dir)
        for entry in entries:
            if tracker.is_done(entry["name"]):
                print(f"[skip] {entry['name']} (previously completed)")
                continue
            # ... generate ...
            tracker.mark_done(entry["name"])
        tracker.save()
    """

    def __init__(self, task_name: str, output_dir: Path):
        self.task_name = task_name
        self.file = output_dir / f"_progress_{task_name}.json"
        self.completed: set[str] = set()
        self.start_time = time.time()
        self._load()

    def _load(self):
        if self.file.exists():
            try:
                data = json.loads(self.file.read_text())
                self.completed = set(data.get("completed", []))
                print(f"[resume] Loaded progress: {len(self.completed)} items already done")
            except Exception:
                self.completed = set()

    def is_done(self, name: str) -> bool:
        return name in self.completed

    def mark_done(self, name: str):
        self.completed.add(name)
        self.save()  # Save after every item for crash safety

    def save(self):
        self.file.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "task": self.task_name,
            "completed": sorted(self.completed),
            "count": len(self.completed),
            "last_updated": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        self.file.write_text(json.dumps(data, indent=2))

    def summary(self, total: int) -> str:
        done = len(self.completed)
        elapsed = time.time() - self.start_time
        if done > 0:
            avg = elapsed / done
            remaining = (total - done) * avg
            return f"{done}/{total} done, ~{remaining/60:.0f} min remaining"
        return f"0/{total} done"


# ---------------------------------------------------------------------------
# GPU / VRAM monitoring
# ---------------------------------------------------------------------------
def print_gpu_info():
    """Print GPU info and estimated VRAM usage for T4."""
    try:
        import torch
        if not torch.cuda.is_available():
            print("[gpu] No CUDA GPU detected — will use CPU (very slow)")
            return

        name = torch.cuda.get_device_name(0)
        props = torch.cuda.get_device_properties(0)
        total = (getattr(props, 'total_memory', None) or getattr(props, 'total_mem', 0)) / 1024**3
        print(f"[gpu] {name} — {total:.1f} GB VRAM")

        # VRAM estimates for T4 (16 GB)
        print("[gpu] Estimated VRAM usage:")
        print("       SDXL fp16 + LoRA:      ~7 GB  (sprites, tiles)")
        print("       Flux.1-dev fp16+offload: ~12 GB (battle BGs, interiors)")
        print("       MusicGen Large fp16:    ~6 GB  (audio)")
        print("       rembg u2net:            ~0.5 GB (background removal)")

        if total < 14:
            print(f"[warn] Only {total:.1f} GB VRAM — Flux.1-dev may OOM, use SDXL instead")

    except Exception as e:
        print(f"[gpu] Could not detect GPU: {e}")


def print_vram_usage():
    """Print current VRAM usage."""
    try:
        import torch
        if torch.cuda.is_available():
            used = torch.cuda.memory_allocated(0) / 1024**3
            reserved = torch.cuda.memory_reserved(0) / 1024**3
            props = torch.cuda.get_device_properties(0)
            total = (getattr(props, 'total_memory', None) or getattr(props, 'total_mem', 0)) / 1024**3
            print(f"[vram] {used:.1f}/{total:.1f} GB allocated ({reserved:.1f} GB reserved)")
    except Exception:
        pass


def free_vram():
    """Free GPU memory cache."""
    import gc
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Colab setup helper (call at script start)
# ---------------------------------------------------------------------------
def setup_colab(task_name: str = ""):
    """One-call Colab setup: mount Drive, print GPU info, create dirs."""
    if is_colab():
        print(f"[colab] Running on Google Colab — {task_name}")
        mount_drive()
        # Create Drive directories
        for d in [GDRIVE_OUTPUTS, GDRIVE_MODELS, GDRIVE_PROMPTS]:
            d.mkdir(parents=True, exist_ok=True)
    else:
        print(f"[local] Running locally — {task_name}")

    print_gpu_info()
    print(f"[output] {get_output_base()}")
    return get_output_base()
