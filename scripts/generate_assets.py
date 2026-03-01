#!/usr/bin/env python3
"""
AI Asset Generator for 勇者傳說 (Hero's Legend)
Supports multiple SD 1.5 pipelines on CPU.

Usage:
    # Generate with All-In-One-Pixel-Model (default, best for sprites)
    python scripts/generate_assets.py --category monsters --force
    python scripts/generate_assets.py --name mon_slime --force

    # img2img from procedural init images (best composition)
    python scripts/generate_assets.py --model pixelsprite_i2i --category monsters --force
    python scripts/generate_assets.py --model pixelsprite_i2i --name mon_slime --strength 0.6 --force

    # SDXL (highest detail but very slow on CPU)
    python scripts/generate_assets.py --model sdxl --all --force

    # Legacy SD 1.5 modes
    python scripts/generate_assets.py --model sd15hq --test
    python scripts/generate_assets.py --model sd15 --test
"""

import argparse
import gc
import json
import os
import subprocess
import sys
import time
from pathlib import Path

# Fix: transformers 5.x removed MT5Tokenizer; HunyuanDiT in diffusers requires it.
# Inject T5Tokenizer as MT5Tokenizer before any diffusers import.
def _patch_mt5_tokenizer():
    import transformers
    if not hasattr(transformers, "MT5Tokenizer"):
        from transformers import T5Tokenizer
        transformers.MT5Tokenizer = T5Tokenizer


_patch_mt5_tokenizer()

# ---------------------------------------------------------------------------
# Background removal (RMBG-2.0 primary, rembg/u2net fallback)
# ---------------------------------------------------------------------------
_rembg_session = None
_rembg_available = None
_rmbg2_model = None
_rmbg2_available = None

def _check_rmbg2() -> bool:
    """Check if RMBG-2.0 dependencies are available (transformers + kornia)."""
    global _rmbg2_available
    if _rmbg2_available is None:
        try:
            import kornia  # noqa: F401
            from transformers import AutoModelForImageSegmentation  # noqa: F401
            _rmbg2_available = True
        except ImportError:
            _rmbg2_available = False
    return _rmbg2_available


def _check_rembg() -> bool:
    """Check if rembg is available."""
    global _rembg_available
    if _rembg_available is None:
        try:
            import rembg  # noqa: F401
            _rembg_available = True
        except ImportError:
            _rembg_available = False
    return _rembg_available


def remove_background_rmbg2(img: "Image") -> "Image":
    """Remove background using RMBG-2.0 (briaai/RMBG-2.0).

    State-of-the-art bg removal, significantly better than rembg u2net.
    Auto-downloads the ~170MB model on first use.
    """
    global _rmbg2_model
    import torch
    from PIL import Image as PILImage
    from transformers import AutoModelForImageSegmentation
    from torchvision import transforms

    if _rmbg2_model is None:
        print("[rmbg2] Loading RMBG-2.0 model (first time, ~170MB download)...")
        _rmbg2_model = AutoModelForImageSegmentation.from_pretrained(
            "briaai/RMBG-2.0", trust_remote_code=True,
        )
        _rmbg2_model.to("cpu")
        print("[rmbg2] Model loaded")

    # Preprocess: resize to 1024x1024 for model input
    orig_size = img.size
    transform = transforms.Compose([
        transforms.Resize((1024, 1024)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    input_rgb = img.convert("RGB")
    input_tensor = transform(input_rgb).unsqueeze(0)

    with torch.no_grad():
        preds = _rmbg2_model(input_tensor)[-1].sigmoid().cpu()

    # Post-process: resize mask back to original size
    pred_mask = preds[0].squeeze()
    mask_pil = transforms.ToPILImage()(pred_mask)
    mask_pil = mask_pil.resize(orig_size, PILImage.LANCZOS)

    # Apply mask as alpha channel
    result = img.convert("RGBA")
    result.putalpha(mask_pil)
    return result


def remove_background_rembg(img: "Image") -> "Image":
    """Remove background using rembg/u2net (legacy fallback)."""
    global _rembg_session
    from rembg import remove, new_session

    if _rembg_session is None:
        print("[rembg] Loading u2net model (first time)...")
        _rembg_session = new_session("u2net")
        print("[rembg] Model loaded")

    return remove(img, session=_rembg_session)


def remove_background(img: "Image") -> "Image":
    """Remove background: try RMBG-2.0 first, fallback to rembg u2net."""
    if _check_rmbg2():
        try:
            return remove_background_rmbg2(img)
        except Exception as e:
            print(f"[warn] RMBG-2.0 failed ({e}), falling back to rembg u2net")
    return remove_background_rembg(img)


# Categories that need transparent backgrounds
NEEDS_ALPHA = {"monsters", "buildings", "decorations", "characters"}

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
PROMPTS_FILE = SCRIPT_DIR / "asset_prompts.json"
OUTPUT_DIR = PROJECT_DIR / "public" / "assets" / "ai"
MODELS_DIR = Path("/mnt/c/writable/models")

# Model paths — SD 1.5 (legacy)
SD15_MODEL = MODELS_DIR / "stable-diffusion-v1-5"
LCM_LORA = MODELS_DIR / "lcm-lora-sdv1-5"
PIXEL_LORA_DIR = MODELS_DIR / "loras" / "pixelart-redmond-15v"
SD_TURBO_MODEL = MODELS_DIR / "sd-turbo"

# Model paths — All-In-One-Pixel-Model (DreamBooth fine-tune, recommended for sprites)
PIXELSPRITE_MODEL = MODELS_DIR / "all-in-one-pixel-model"
INIT_IMAGES_DIR = SCRIPT_DIR / "init_images"

# Model paths — SDXL (primary, high quality)
SDXL_MODEL = MODELS_DIR / "stable-diffusion-xl-base-1.0"
SDXL_HUB_ID = "stabilityai/stable-diffusion-xl-base-1.0"
PIXEL_ART_XL_LORA_DIR = MODELS_DIR / "loras" / "pixel-art-xl"
PIXEL_ART_XL_HUB_ID = "nerijs/pixel-art-xl"

# ---------------------------------------------------------------------------
# Slack notification
# ---------------------------------------------------------------------------
def slack_notify(message: str):
    """Send Slack notification using webhook URL from .env file."""
    env_file = PROJECT_DIR / ".env"
    webhook_url = None
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("SLACK_WEBHOOK_URL"):
                webhook_url = line.split("=", 1)[1].strip().strip("\"'")
                break
    if not webhook_url:
        print(f"[slack] No webhook URL, skipping: {message}")
        return
    try:
        subprocess.run(
            [
                "curl", "-s", "-X", "POST",
                "-H", "Content-type: application/json",
                "--data", json.dumps({"text": message}),
                webhook_url,
            ],
            timeout=15,
            capture_output=True,
        )
        print(f"[slack] Sent: {message}")
    except Exception as e:
        print(f"[slack] Failed: {e}")


# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------
def load_prompts() -> dict:
    with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def build_prompt(asset: dict, meta: dict, model_type: str = "sdxl") -> str:
    """Compose the full positive prompt from style prefix + subject + technical suffix.

    SDXL has a 77x2 token capacity (two CLIP encoders) so longer prompts are fine.
    SD 1.5 CLIP truncates at 77 tokens — subject description MUST come first.
    """
    suffix_key = asset.get("_suffix_key", "style_suffix_pixel")

    if model_type in ("pixelsprite", "pixelsprite_i2i"):
        # All-In-One-Pixel-Model: subject-first + pixelsprite trigger word
        # DreamBooth model, 77-token CLIP limit — keep prompts concise
        prompt_text = asset.get("prompt_pixelsprite", asset.get("prompt_hq", asset["prompt"]))
        parts = [prompt_text, "pixelsprite"]
        return ", ".join(p for p in parts if p)

    elif model_type == "sdxl":
        # SDXL: full prefix + subject + suffix (dual CLIP handles ~154 tokens)
        sdxl_suffix_key = suffix_key + "_xl"
        suffix = meta.get(sdxl_suffix_key, meta.get(suffix_key, ""))
        prefix = meta.get("style_prefix_xl", meta.get("style_prefix", ""))
        prompt_text = asset.get("prompt_xl", asset["prompt"])
        parts = [prefix, prompt_text, suffix]

    elif model_type == "sd15hq":
        # SD 1.5 HQ: SUBJECT FIRST, then short style tag (77 token CLIP limit)
        # Use prompt_hq (concise) > prompt (short) — skip prompt_xl (too long for 77 tokens)
        prompt_text = asset.get("prompt_hq", asset["prompt"])
        short_style = "pixel art sprite, centered, black background"
        parts = [prompt_text, short_style]

    else:
        # SD 1.5 LCM (legacy fast) — shorter prefix for monsters
        if suffix_key == "style_suffix_monster":
            prefix = meta.get("style_prefix_monster", "fantasy")
        else:
            prefix = meta["style_prefix"]
        suffix = meta.get(suffix_key, "")
        prompt_text = asset["prompt"]
        parts = [prefix, prompt_text, suffix]

    return ", ".join(p for p in parts if p)


def get_negative_prompt(meta: dict, model_type: str = "sdxl") -> str:
    if model_type in ("pixelsprite", "pixelsprite_i2i"):
        return meta.get("negative_prompt_pixelsprite", meta.get("negative_prompt_xl", meta["negative_prompt"]))
    if model_type in ("sdxl", "sd15hq"):
        return meta.get("negative_prompt_xl", meta["negative_prompt"])
    return meta["negative_prompt"]


# ---------------------------------------------------------------------------
# Pipeline loader
# ---------------------------------------------------------------------------
_pipe = None


def load_pipeline(model: str = "sdxl"):
    """Load the Stable Diffusion pipeline (cached across calls).

    model: 'sdxl', 'pixelsprite' (txt2img), 'pixelsprite_i2i' (img2img),
           'sd15hq', 'sd15' (legacy), 'turbo' (fast/low)
    """
    global _pipe
    if _pipe is not None:
        return _pipe

    import torch

    print(f"[pipeline] Loading model: {model}")
    t0 = time.time()

    if model == "sdxl":
        _pipe = _load_sdxl_pipeline(torch)

    elif model == "pixelsprite":
        _pipe = _load_pixelsprite_pipeline(torch)

    elif model == "pixelsprite_i2i":
        _pipe = _load_pixelsprite_img2img_pipeline(torch)

    elif model == "turbo":
        _pipe = _load_turbo_pipeline(torch)

    elif model == "sd15hq":
        _pipe = _load_sd15_pipeline(torch, high_quality=True)

    elif model == "sd15":
        _pipe = _load_sd15_pipeline(torch)

    else:
        print(f"[error] Unknown model: {model}")
        sys.exit(1)

    # CPU optimizations
    _pipe = _pipe.to("cpu")
    if hasattr(_pipe, "enable_attention_slicing"):
        _pipe.enable_attention_slicing()
    if hasattr(_pipe, "enable_vae_tiling"):
        _pipe.enable_vae_tiling()

    print(f"[pipeline] {model.upper()} pipeline ready in {time.time() - t0:.1f}s")
    return _pipe


def _load_sdxl_pipeline(torch):
    """Load SDXL pipeline with pixel-art-xl LoRA. Auto-downloads if needed."""
    from diffusers import StableDiffusionXLPipeline, EulerDiscreteScheduler

    # --- Load base model ---
    # Check if local save has a complete model_index.json (incomplete saves lack it or key dirs)
    local_ok = SDXL_MODEL.exists() and (SDXL_MODEL / "model_index.json").exists() and (SDXL_MODEL / "unet").exists()
    if local_ok:
        print(f"[pipeline] Loading SDXL from local: {SDXL_MODEL}")
        pipe = StableDiffusionXLPipeline.from_pretrained(
            str(SDXL_MODEL),
            torch_dtype=torch.bfloat16,
            use_safetensors=True,
            local_files_only=True,
        )
    else:
        print(f"[pipeline] SDXL not found locally, downloading from HuggingFace...")
        print(f"[pipeline] This is a ~6.5 GB download, may take a while...")
        print(f"[pipeline] Model will be cached by HuggingFace Hub (no extra save_pretrained to save RAM)")
        slack_notify("[勇者傳說] 📥 Downloading SDXL base model (~6.5 GB)...")
        pipe = StableDiffusionXLPipeline.from_pretrained(
            SDXL_HUB_ID,
            torch_dtype=torch.bfloat16,
            use_safetensors=True,
            variant="fp16",
        )
        # NOTE: We skip save_pretrained() to avoid OOM on low-RAM systems.
        # HuggingFace Hub caches the model in ~/.cache/huggingface/hub/
        # which serves the same purpose for future offline loading.
        slack_notify("[勇者傳說] ✅ SDXL model downloaded (cached by HF Hub)")

    # Use Euler scheduler for good quality/speed balance on CPU
    pipe.scheduler = EulerDiscreteScheduler.from_config(pipe.scheduler.config)

    # --- Load pixel-art-xl LoRA ---
    pixel_lora_file = find_lora_file(PIXEL_ART_XL_LORA_DIR)
    if pixel_lora_file:
        print(f"[pipeline] Loading pixel-art-xl LoRA: {pixel_lora_file.name}")
        pipe.load_lora_weights(
            str(pixel_lora_file.parent),
            weight_name=pixel_lora_file.name,
            adapter_name="pixel_xl",
        )
        pipe.set_adapters(["pixel_xl"], adapter_weights=[0.85])
        print("[pipeline]   pixel-art-xl LoRA loaded")
    else:
        print(f"[pipeline] pixel-art-xl LoRA not found locally, downloading...")
        try:
            pipe.load_lora_weights(PIXEL_ART_XL_HUB_ID, adapter_name="pixel_xl")
            pipe.set_adapters(["pixel_xl"], adapter_weights=[0.85])
            print("[pipeline]   pixel-art-xl LoRA downloaded and loaded")
            # Try to save LoRA locally
            try:
                PIXEL_ART_XL_LORA_DIR.mkdir(parents=True, exist_ok=True)
                # LoRA is cached in HF hub cache, just note the path
                print(f"[pipeline]   LoRA cached by HuggingFace Hub")
            except Exception:
                pass
        except Exception as e:
            print(f"[warn] Could not load pixel-art-xl LoRA: {e}")
            print("[warn] Generating without pixel art style LoRA")

    pipe._model_type = "sdxl"
    pipe._turbo = False
    pipe._use_lcm = False
    return pipe


def _load_pixelsprite_pipeline(torch):
    """Load All-In-One-Pixel-Model for txt2img.

    DreamBooth fine-tune of SD 1.5 — no LoRA needed, uses 'pixelsprite' trigger word.
    """
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler

    if not PIXELSPRITE_MODEL.exists():
        print(f"[error] All-In-One-Pixel-Model not found at {PIXELSPRITE_MODEL}")
        print("  Run: huggingface-cli download PublicPrompts/All-In-One-Pixel-Model \\")
        print(f"       --local-dir {PIXELSPRITE_MODEL}")
        sys.exit(1)

    pipe = StableDiffusionPipeline.from_pretrained(
        str(PIXELSPRITE_MODEL),
        torch_dtype=torch.float32,
        safety_checker=None,
        requires_safety_checker=False,
        local_files_only=True,
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe._turbo = False
    pipe._use_lcm = False
    pipe._model_type = "pixelsprite"
    print("[pipeline] All-In-One-Pixel-Model (txt2img): DPMSolver++, 20 steps, guidance 7.5")
    return pipe


def _load_pixelsprite_img2img_pipeline(torch):
    """Load All-In-One-Pixel-Model for img2img (refines procedural init images).

    Same model as txt2img but loaded as StableDiffusionImg2ImgPipeline.
    """
    from diffusers import StableDiffusionImg2ImgPipeline, DPMSolverMultistepScheduler

    if not PIXELSPRITE_MODEL.exists():
        print(f"[error] All-In-One-Pixel-Model not found at {PIXELSPRITE_MODEL}")
        print("  Run: huggingface-cli download PublicPrompts/All-In-One-Pixel-Model \\")
        print(f"       --local-dir {PIXELSPRITE_MODEL}")
        sys.exit(1)

    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        str(PIXELSPRITE_MODEL),
        torch_dtype=torch.float32,
        safety_checker=None,
        requires_safety_checker=False,
        local_files_only=True,
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe._turbo = False
    pipe._use_lcm = False
    pipe._model_type = "pixelsprite_i2i"
    print("[pipeline] All-In-One-Pixel-Model (img2img): DPMSolver++, 20 steps")
    return pipe


def _load_turbo_pipeline(torch):
    """Load SD Turbo pipeline (1-step, fast)."""
    from diffusers import AutoPipelineForText2Image

    if not SD_TURBO_MODEL.exists():
        print(f"[error] SD Turbo model not found at {SD_TURBO_MODEL}")
        print("  Run: huggingface-cli download stabilityai/sd-turbo \\")
        print(f"       --local-dir {SD_TURBO_MODEL}")
        sys.exit(1)

    pipe = AutoPipelineForText2Image.from_pretrained(
        str(SD_TURBO_MODEL),
        torch_dtype=torch.float32,
        local_files_only=True,
    )
    pipe._turbo = True
    pipe._use_lcm = False
    pipe._model_type = "turbo"
    return pipe


def _load_sd15_pipeline(torch, high_quality: bool = False):
    """Load SD 1.5 pipeline.

    high_quality=False (legacy): LCM-LoRA + 4 steps (fast, low quality)
    high_quality=True  (sd15hq): DPMSolver++ + 20 steps + guidance 7.5 (slower, much better)
    """
    from diffusers import (
        StableDiffusionPipeline,
        LCMScheduler,
        DPMSolverMultistepScheduler,
    )

    if not SD15_MODEL.exists():
        print(f"[error] SD 1.5 model not found at {SD15_MODEL}")
        sys.exit(1)

    pipe = StableDiffusionPipeline.from_pretrained(
        str(SD15_MODEL),
        torch_dtype=torch.float32,
        safety_checker=None,
        requires_safety_checker=False,
        local_files_only=True,
    )

    if high_quality:
        # HQ mode: DPMSolver++ (no LCM), 20 steps, guidance 7.5
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
        pipe._use_lcm = False
        print("[pipeline] SD 1.5 HQ mode: DPMSolver++, 20 steps, guidance 7.5")
    else:
        # Legacy LCM mode: 4 steps fast
        if LCM_LORA.exists() and (LCM_LORA / "pytorch_lora_weights.safetensors").exists():
            pipe.load_lora_weights(
                str(LCM_LORA),
                weight_name="pytorch_lora_weights.safetensors",
                adapter_name="lcm",
            )
            pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
            pipe._use_lcm = True
        else:
            pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
            pipe._use_lcm = False

    # Load PixelArt LoRA
    pixel_lora_file = find_lora_file(PIXEL_LORA_DIR)
    if pixel_lora_file:
        pipe.load_lora_weights(
            str(pixel_lora_file.parent),
            weight_name=pixel_lora_file.name,
            adapter_name="pixel",
        )
        if pipe._use_lcm:
            pipe.set_adapters(["lcm", "pixel"], adapter_weights=[1.0, 0.8])
        else:
            pipe.set_adapters(["pixel"], adapter_weights=[0.8])

    pipe._turbo = False
    pipe._model_type = "sd15hq" if high_quality else "sd15"
    return pipe


def find_lora_file(directory: Path) -> Path | None:
    """Find a .safetensors LoRA file in a directory."""
    if not directory.exists():
        return None
    for f in directory.rglob("*.safetensors"):
        return f
    for f in directory.rglob("*.bin"):
        return f
    return None


# ---------------------------------------------------------------------------
# Image generation with OOM protection
# ---------------------------------------------------------------------------
def generate_image(
    pipe,
    prompt: str,
    negative_prompt: str,
    size: int = 512,
    seed: int | None = None,
    steps: int | None = None,
    guidance: float | None = None,
) -> "Image":
    """Generate a single image with OOM retry and hold (no fallback).

    On MemoryError/OOM RuntimeError, sends Slack notification and waits
    for memory to become available. Never falls back to a lower-quality model.
    """
    import torch

    generator = torch.Generator("cpu")
    if seed is not None:
        generator.manual_seed(seed)
    else:
        generator.manual_seed(int(time.time()) % (2**32))

    model_type = getattr(pipe, "_model_type", "sd15")

    # Build kwargs based on model type
    if model_type == "sdxl":
        kwargs = dict(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=steps or 20,
            guidance_scale=guidance or 7.0,
            width=size,
            height=size,
            generator=generator,
        )
    elif getattr(pipe, "_turbo", False):
        kwargs = dict(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=1,
            guidance_scale=0.0,
            width=size,
            height=size,
            generator=generator,
        )
    elif getattr(pipe, "_use_lcm", False):
        kwargs = dict(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=steps or 4,
            guidance_scale=guidance or 1.5,
            width=size,
            height=size,
            generator=generator,
        )
    else:
        kwargs = dict(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=steps or 20,
            guidance_scale=guidance or 7.5,
            width=size,
            height=size,
            generator=generator,
        )

    # OOM retry loop — hold and Slack notify, NEVER fallback
    notified = False
    attempt = 0
    while True:
        try:
            gc.collect()
            result = pipe(**kwargs)
            if notified:
                slack_notify("[勇者傳說] ✅ Memory available, SDXL generation resumed")
            return result.images[0]
        except (MemoryError, RuntimeError) as e:
            err_str = str(e).lower()
            is_oom = (
                isinstance(e, MemoryError)
                or "out of memory" in err_str
                or "cannot allocate" in err_str
                or "alloc" in err_str
            )
            if not is_oom:
                raise  # Re-raise non-OOM RuntimeErrors

            attempt += 1
            gc.collect()

            if not notified:
                slack_notify(
                    f"[勇者傳說] ⚠️ SDXL OOM (attempt {attempt}, need ~8GB free RAM). "
                    f"Holding until memory is available. "
                    f"Free up memory or wait for other processes to finish. "
                    f"Will NOT fallback to SD 1.5."
                )
                notified = True

            wait_min = 5
            print(f"[OOM] Attempt {attempt} — waiting {wait_min} min for memory...")
            print(f"[OOM] Current free RAM: ", end="", flush=True)
            try:
                mem_info = subprocess.run(
                    ["free", "-h"], capture_output=True, text=True, timeout=5
                )
                # Extract "available" column from the Mem: row
                for line in mem_info.stdout.splitlines():
                    if line.startswith("Mem:"):
                        print(line.split()[-1], "available")
                        break
            except Exception:
                print("(unknown)")
            time.sleep(wait_min * 60)


def generate_image_i2i(
    pipe,
    prompt: str,
    negative_prompt: str,
    init_image: "Image",
    strength: float = 0.55,
    seed: int | None = None,
    steps: int | None = None,
    guidance: float | None = None,
) -> "Image":
    """Generate image via img2img pipeline with OOM retry.

    strength: how much to deviate from init_image (0=keep original, 1=ignore it).
    """
    import torch
    from PIL import Image as PILImage

    generator = torch.Generator("cpu")
    if seed is not None:
        generator.manual_seed(seed)
    else:
        generator.manual_seed(int(time.time()) % (2**32))

    # Resize init image to 512x512 (SD 1.5 native)
    init_resized = init_image.convert("RGB").resize((512, 512), PILImage.LANCZOS)

    kwargs = dict(
        prompt=prompt,
        negative_prompt=negative_prompt,
        image=init_resized,
        strength=strength,
        num_inference_steps=steps or 20,
        guidance_scale=guidance or 7.5,
        generator=generator,
    )

    notified = False
    attempt = 0
    while True:
        try:
            gc.collect()
            result = pipe(**kwargs)
            if notified:
                slack_notify("[勇者傳說] Memory available, img2img generation resumed")
            return result.images[0]
        except (MemoryError, RuntimeError) as e:
            err_str = str(e).lower()
            is_oom = (
                isinstance(e, MemoryError)
                or "out of memory" in err_str
                or "cannot allocate" in err_str
                or "alloc" in err_str
            )
            if not is_oom:
                raise

            attempt += 1
            gc.collect()
            if not notified:
                slack_notify(f"[勇者傳說] img2img OOM (attempt {attempt}). Waiting for memory...")
                notified = True
            print(f"[OOM] img2img attempt {attempt} — waiting 5 min...")
            time.sleep(300)


def downscale_nearest(img: "Image", target_size: int) -> "Image":
    """Downscale using nearest-neighbor to preserve pixel art crispness."""
    from PIL import Image

    return img.resize((target_size, target_size), Image.NEAREST)


# ---------------------------------------------------------------------------
# Asset generation
# ---------------------------------------------------------------------------
def generate_asset(
    pipe,
    asset: dict,
    meta: dict,
    output_base: Path,
    category: str,
    use_rembg: bool = True,
    model_type: str = "sdxl",
    i2i_strength: float | None = None,
):
    """Generate a single asset image, optionally remove background, downscale, and save."""
    name = asset["name"]
    target_size = asset["size"]

    # Determine output subdirectory
    subdir_map = {
        "tiles": "tiles",
        "buildings": "buildings",
        "characters": "characters",
        "monsters": "monsters",
        "decorations": "tiles",
    }
    subdir = subdir_map.get(category, category)
    out_dir = output_base / subdir
    out_dir.mkdir(parents=True, exist_ok=True)

    out_path = out_dir / f"{name}.png"
    if out_path.exists():
        print(f"  [skip] {out_path} already exists")
        return

    # Build prompt
    suffix_map = {
        "tiles": "style_suffix_pixel",
        "buildings": "style_suffix_building",
        "characters": "style_suffix_char",
        "monsters": "style_suffix_monster",
        "decorations": "style_suffix_deco",
    }
    asset["_suffix_key"] = suffix_map.get(category, "style_suffix_pixel")
    prompt = build_prompt(asset, meta, model_type)
    negative = get_negative_prompt(meta, model_type)
    if asset.get("negative_prompt"):
        negative = negative + ", " + asset["negative_prompt"]

    print(f"  [gen] {name} ({target_size}x{target_size})")
    print(f"        prompt: {prompt[:100]}...")

    t0 = time.time()

    # Per-asset quality overrides
    if model_type in ("pixelsprite", "pixelsprite_i2i"):
        asset_steps = None  # Use defaults
        asset_guidance = None
    elif model_type == "sdxl":
        asset_steps = asset.get("steps_xl")
        asset_guidance = asset.get("guidance_xl")
    elif model_type == "sd15hq":
        asset_steps = asset.get("steps_xl")
        asset_guidance = None
    else:
        asset_steps = asset.get("steps")
        asset_guidance = asset.get("guidance")

    # Generation size depends on model
    if model_type in ("pixelsprite", "pixelsprite_i2i"):
        gen_size = 512  # SD 1.5 native resolution
        default_steps = 20
        default_guidance = 7.5
        if asset.get("size", 0) >= 96:
            default_steps = 25
            default_guidance = 8.0
        print(f"        PixelSprite: {default_steps} steps, guidance={default_guidance}")
    elif model_type == "sdxl":
        gen_size = 512
        default_steps = 20
        default_guidance = 7.0
        if asset.get("size", 0) >= 96:
            default_steps = 25
            default_guidance = 7.5
        print(f"        SDXL: {asset_steps or default_steps} steps, guidance={asset_guidance or default_guidance}")
    elif model_type == "sd15hq":
        gen_size = 384
        default_steps = 20
        default_guidance = 5.0
        if asset.get("size", 0) >= 96:
            gen_size = 512
            default_steps = 25
            default_guidance = 5.5
        print(f"        SD1.5-HQ: {asset_steps or default_steps} steps, guidance={default_guidance}")
    else:
        gen_size = 512
        default_steps = None
        default_guidance = None

    # img2img mode: load init image and generate via img2img pipeline
    if model_type == "pixelsprite_i2i":
        from PIL import Image as PILImage
        init_path = INIT_IMAGES_DIR / f"{name}.png"
        if not init_path.exists():
            print(f"        [warn] No init image at {init_path}, falling back to txt2img")
            img = generate_image(
                pipe, prompt, negative,
                size=gen_size,
                seed=None,
                steps=asset_steps or default_steps,
                guidance=asset_guidance or default_guidance,
            )
        else:
            # Determine denoising strength
            is_boss = asset.get("size", 0) >= 96
            strength = i2i_strength or (0.60 if is_boss else 0.55)
            print(f"        img2img: init={init_path.name}, strength={strength:.2f}")
            init_img = PILImage.open(init_path)
            img = generate_image_i2i(
                pipe, prompt, negative,
                init_image=init_img,
                strength=strength,
                seed=None,
                steps=asset_steps or default_steps,
                guidance=asset_guidance or default_guidance,
            )
    else:
        img = generate_image(
            pipe, prompt, negative,
            size=gen_size,
            seed=None,
            steps=asset_steps or default_steps,
            guidance=asset_guidance or default_guidance,
        )

    # Remove background for categories that need transparency
    if use_rembg and category in NEEDS_ALPHA and (_check_rmbg2() or _check_rembg()):
        print(f"        removing background...")
        t_bg = time.time()
        img_nobg = remove_background(img)
        alpha = img_nobg.getchannel("A")
        total_pixels = alpha.size[0] * alpha.size[1]
        opaque_pixels = sum(1 for p in alpha.get_flattened_data() if p > 128)
        coverage = opaque_pixels / total_pixels
        if coverage < 0.01:
            # rembg removed EVERYTHING — keep original image, skip bg removal
            print(f"        rembg removed all ({coverage:.1%}) — keeping original (no bg removal)")
            img = img.convert("RGBA")
        elif coverage < 0.15:
            # Low but some content — use rembg result
            print(f"        rembg low coverage ({coverage:.1%}) — using rembg result")
            img = img_nobg
        else:
            img = img_nobg
            print(f"        background removed ({time.time() - t_bg:.1f}s, {coverage:.0%} opaque)")

        # Auto-crop to content bounding box + pad, so creature fills the frame
        bbox = img.getbbox()
        if bbox:
            from PIL import Image as PILImage
            x0, y0, x1, y1 = bbox
            cw, ch = x1 - x0, y1 - y0
            # Add 10% padding
            pad = max(int(max(cw, ch) * 0.1), 2)
            x0 = max(0, x0 - pad)
            y0 = max(0, y0 - pad)
            x1 = min(img.width, x1 + pad)
            y1 = min(img.height, y1 + pad)
            # Make square (use the larger dimension)
            side = max(x1 - x0, y1 - y0)
            # Center the content in the square
            cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
            sq_x0 = max(0, cx - side // 2)
            sq_y0 = max(0, cy - side // 2)
            sq_x1 = min(img.width, sq_x0 + side)
            sq_y1 = min(img.height, sq_y0 + side)
            cropped = img.crop((sq_x0, sq_y0, sq_x1, sq_y1))
            # Resize back to gen_size to preserve quality before final downscale
            img = cropped.resize((gen_size, gen_size), PILImage.LANCZOS)
            print(f"        auto-cropped {cw}x{ch} → {side}x{side} square")

    # Downscale to target size
    if target_size != gen_size:
        from PIL import Image as PILImage
        # Use LANCZOS for AI images (smooth downscale), NEAREST for pixel art tiles
        resample = PILImage.NEAREST if category == "tiles" else PILImage.LANCZOS
        img = img.resize((target_size, target_size), resample)

    img.save(out_path, "PNG")
    elapsed = time.time() - t0
    print(f"        saved: {out_path} ({elapsed:.1f}s)")


def generate_category(
    pipe, data: dict, category: str, output_base: Path,
    use_rembg: bool = True, model_type: str = "sdxl",
    i2i_strength: float | None = None,
):
    """Generate all assets in a category with progress tracking and ETA."""
    meta = data["_meta"]
    assets = data.get(category, [])
    if not assets:
        print(f"[warn] No assets found for category '{category}'")
        return

    print(f"\n{'='*60}")
    print(f"  Generating {len(assets)} {category} ({model_type.upper()})")
    print(f"{'='*60}")

    times = []
    for i, asset in enumerate(assets):
        # Progress and ETA
        if times:
            avg_time = sum(times) / len(times)
            remaining = (len(assets) - i) * avg_time
            eta_min = remaining / 60
            print(f"\n  [{i+1}/{len(assets)}] (avg {avg_time:.0f}s/image, ETA ~{eta_min:.0f} min)")
        else:
            print(f"\n  [{i+1}/{len(assets)}]")

        t0 = time.time()
        generate_asset(pipe, asset, meta, output_base, category, use_rembg=use_rembg, model_type=model_type, i2i_strength=i2i_strength)
        times.append(time.time() - t0)


def regen_alpha_existing(output_base: Path):
    """Reprocess existing images through rembg to add alpha channel."""
    from PIL import Image

    dirs_to_process = {
        "monsters": "monsters",
        "buildings": "buildings",
    }

    processed = 0
    for category, subdir in dirs_to_process.items():
        dir_path = output_base / subdir
        if not dir_path.exists():
            continue
        for png_file in sorted(dir_path.glob("*.png")):
            print(f"  [rembg] {png_file.name}...", end="", flush=True)
            img = Image.open(png_file)
            if img.mode == "RGBA":
                alpha = img.getchannel("A")
                if alpha.getextrema()[0] < 250:
                    print(" already has alpha, skip")
                    continue
            img_rgba = remove_background(img)
            img_rgba.save(png_file, "PNG")
            processed += 1
            print(" done")

    # Process decoration files in tiles/ dir
    tiles_dir = output_base / "tiles"
    if tiles_dir.exists():
        for png_file in sorted(tiles_dir.glob("deco_*.png")):
            print(f"  [rembg] {png_file.name}...", end="", flush=True)
            img = Image.open(png_file)
            if img.mode == "RGBA":
                alpha = img.getchannel("A")
                if alpha.getextrema()[0] < 250:
                    print(" already has alpha, skip")
                    continue
            img_rgba = remove_background(img)
            img_rgba.save(png_file, "PNG")
            processed += 1
            print(" done")

    print(f"\n[regen-alpha] Processed {processed} images")


# ---------------------------------------------------------------------------
# Manifest generation
# ---------------------------------------------------------------------------
def generate_manifest(output_base: Path):
    """Scan output directory and generate manifest.json for the game to load."""
    manifest = {}
    for subdir in ["tiles", "characters", "monsters", "buildings"]:
        dir_path = output_base / subdir
        if dir_path.exists():
            files = sorted(f.stem for f in dir_path.glob("*.png"))
            manifest[subdir] = files

    manifest_path = output_base / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n[manifest] Written to {manifest_path}")
    print(f"  tiles: {len(manifest.get('tiles', []))}")
    print(f"  characters: {len(manifest.get('characters', []))}")
    print(f"  monsters: {len(manifest.get('monsters', []))}")
    print(f"  buildings: {len(manifest.get('buildings', []))}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="AI Asset Generator for 勇者傳說"
    )
    parser.add_argument("--test", action="store_true",
                        help="Generate 2-3 test images to verify quality")
    parser.add_argument("--all", action="store_true",
                        help="Generate all assets")
    parser.add_argument("--category", type=str,
                        choices=["tiles", "buildings", "characters", "monsters", "decorations"],
                        help="Generate a specific category")
    parser.add_argument("--name", type=str,
                        help="Generate a single asset by name")
    parser.add_argument("--model", type=str, default="pixelsprite",
                        choices=["pixelsprite", "pixelsprite_i2i", "sdxl", "sd15hq", "sd15", "turbo"],
                        help="Model: pixelsprite (default, DreamBooth sprite model), pixelsprite_i2i (img2img from procedural), sdxl (SDXL+LoRA), sd15hq (SD1.5 DPMSolver++), sd15 (4-step LCM), turbo (fastest)")
    parser.add_argument("--strength", type=float, default=None,
                        help="img2img denoising strength (0.0-1.0, default: 0.55 regular / 0.60 boss)")
    parser.add_argument("--output", type=str, default=str(OUTPUT_DIR),
                        help=f"Output directory (default: {OUTPUT_DIR})")
    parser.add_argument("--seed", type=int, default=None,
                        help="Random seed for reproducibility")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite existing images")
    parser.add_argument("--manifest-only", action="store_true",
                        help="Only regenerate the manifest.json without generating images")
    parser.add_argument("--no-rembg", action="store_true",
                        help="Disable rembg background removal")
    parser.add_argument("--regen-alpha", action="store_true",
                        help="Reprocess existing images through rembg (no generation)")

    args = parser.parse_args()
    output_base = Path(args.output)

    # Backward compatibility: --turbo flag
    model_type = args.model

    # Load prompt definitions
    data = load_prompts()

    # Manifest-only mode
    if args.manifest_only:
        generate_manifest(output_base)
        return

    use_rembg = not args.no_rembg

    # Regen-alpha mode
    if args.regen_alpha:
        if not _check_rembg():
            print("[error] rembg not installed. Run: pip install rembg[cpu]")
            sys.exit(1)
        regen_alpha_existing(output_base)
        generate_manifest(output_base)
        return

    # Must specify at least one action
    if not (args.test or args.all or args.category or args.name):
        parser.print_help()
        sys.exit(1)

    # Check background removal availability once
    if use_rembg:
        if _check_rmbg2():
            print("[bg-remove] RMBG-2.0 available (primary)")
        elif _check_rembg():
            print("[bg-remove] rembg/u2net available (fallback)")
        else:
            print("[warn] No background removal available — generating without bg removal")
            print("       Install: pip install kornia  (for RMBG-2.0)")
            print("       Or:      pip install rembg[cpu]  (legacy)")
            use_rembg = False

    # Load pipeline
    pipe = load_pipeline(model=model_type)

    if args.test:
        meta = data["_meta"]
        test_assets = [
            (data["tiles"][0], "tiles"),
            (data["monsters"][0], "monsters"),
        ]
        if len(data["buildings"]) > 0:
            test_assets.append((data["buildings"][0], "buildings"))

        print(f"\n[test] Generating {len(test_assets)} test images ({model_type.upper()})...")
        slack_notify(f"[勇者傳說] 🧪 Starting {model_type.upper()} test generation ({len(test_assets)} images)")
        for asset, cat in test_assets:
            if args.force:
                out_path = output_base / ("tiles" if cat == "decorations" else cat) / f"{asset['name']}.png"
                if out_path.exists():
                    out_path.unlink()
            generate_asset(pipe, asset, meta, output_base, cat, use_rembg=use_rembg, model_type=model_type, i2i_strength=args.strength)

    elif args.name:
        meta = data["_meta"]
        found = False
        for cat in ["tiles", "buildings", "characters", "monsters", "decorations"]:
            for asset in data.get(cat, []):
                if asset["name"] == args.name:
                    if args.force:
                        subdir = "tiles" if cat == "decorations" else cat
                        out_path = output_base / subdir / f"{asset['name']}.png"
                        if out_path.exists():
                            out_path.unlink()
                    generate_asset(pipe, asset, meta, output_base, cat, use_rembg=use_rembg, model_type=model_type, i2i_strength=args.strength)
                    found = True
                    break
            if found:
                break
        if not found:
            print(f"[error] Asset '{args.name}' not found in prompt definitions")
            sys.exit(1)

    elif args.category:
        if args.force:
            subdir = "tiles" if args.category == "decorations" else args.category
            dir_path = output_base / subdir
            if dir_path.exists():
                for f in dir_path.glob("*.png"):
                    f.unlink()
        slack_notify(f"[勇者傳說] 🎨 Starting {model_type.upper()} generation: {args.category}")
        generate_category(pipe, data, args.category, output_base, use_rembg=use_rembg, model_type=model_type, i2i_strength=args.strength)

    elif args.all:
        total_assets = sum(len(data.get(c, [])) for c in ["tiles", "buildings", "characters", "monsters", "decorations"])
        slack_notify(f"[勇者傳說] 🎨 Starting {model_type.upper()} full generation ({total_assets} assets)")
        for cat in ["tiles", "buildings", "characters", "monsters", "decorations"]:
            if args.force:
                subdir = "tiles" if cat == "decorations" else cat
                dir_path = output_base / subdir
                if dir_path.exists():
                    pattern = "deco_*.png" if cat == "decorations" else "*.png"
                    for f in dir_path.glob(pattern):
                        f.unlink()
            generate_category(pipe, data, cat, output_base, use_rembg=use_rembg, model_type=model_type, i2i_strength=args.strength)

    # Generate manifest
    generate_manifest(output_base)

    print("\n[done] Asset generation complete!")
    slack_notify(f"[勇者傳說] ✅ {model_type.upper()} asset generation complete!")


if __name__ == "__main__":
    main()
