# 遊戲音樂本機生成 — Hugging Face 模型建議

> 透過本機 CPU/低 VRAM 環境生成遊戲 BGM、音效，無呼叫次數限制

---

## 模型總覽（Hugging Face，可下載）

| 模型 | 參數量 | 記憶體需求 | 特色 | HF 連結 |
|------|--------|------------|------|---------|
| **MusicGen Small** | 300M | CPU 16GB RAM 可跑 | 最輕量、Transformers 原生支援 | [facebook/musicgen-small](https://huggingface.co/facebook/musicgen-small) |
| **MusicGen Medium** | 1.5B | 建議 16GB+ RAM / 4GB VRAM | 品質較好 | [facebook/musicgen-medium](https://huggingface.co/facebook/musicgen-medium) |
| **Stable Audio Open Small** | 341M | 針對 Arm CPU 優化、手機可跑 | 音效、鼓組、環境音 | [stabilityai/stable-audio-open-small](https://huggingface.co/stabilityai/stable-audio-open-small) |
| **ACE-Step 1.5** | 3.5B | <4GB VRAM、支援 CPU offload | 可生成人聲、速度快、支援 LoRA | [ACE-Step/Ace-Step1.5](https://huggingface.co/ACE-Step/Ace-Step1.5) |
| **MusicLDM** | — | Diffusers、可 CPU offload | 466 小時音樂訓練、擴散模型 | [ucsd-reach/musicldm](https://huggingface.co/ucsd-reach/musicldm) |
| **MusicGen + OpenVINO** | 300M | Intel CPU 優化 | 預轉換、CPU 推理加速 | [Intel/musicgen-static-openvino](https://huggingface.co/Intel/musicgen-static-openvino) |

---

## 推薦方案（依硬體）

### 無 GPU、僅 CPU

| 方案 | 模型 | 說明 |
|------|------|------|
| **方案 A** | MusicGen Small + Transformers | 16GB RAM 可跑，最簡單 |
| **方案 B** | Intel MusicGen OpenVINO | Intel CPU 加速，需轉換或下載預轉換版 |
| **方案 C** | Stable Audio Open Small | 341M，適合音效、短 BGM（11 秒） |

### 有 GPU（4GB VRAM 以下）

| 方案 | 模型 | 說明 |
|------|------|------|
| **方案 D** | ACE-Step 1.5 | <4GB VRAM、支援 LoRA、人聲 |
| **方案 E** | MusicGen Small | 輕量、可加 LoRA |

### 有 GPU（8GB+ VRAM）

| 方案 | 模型 | 說明 |
|------|------|------|
| **方案 F** | MusicGen Large / Medium | 品質最佳 |
| **方案 G** | ACE-Step 1.5 + LoRA | 風格客製 |

---

## 安裝與使用

### 1. MusicGen Small（Transformers，CPU）

```bash
pip install transformers scipy
```

```python
from transformers import pipeline
import scipy

synthesiser = pipeline("text-to-audio", "facebook/musicgen-small")

# 遊戲 BGM 範例 prompt
music = synthesiser(
    "epic fantasy RPG battle music, orchestral, medieval, dramatic",
    forward_params={"do_sample": True, "max_new_tokens": 256}
)

scipy.io.wavfile.write(
    "battle_bgm.wav",
    rate=music["sampling_rate"],
    data=music["audio"][0]
)
```

**遊戲用 Prompt 範例：**

| 場景 | Prompt |
|------|--------|
| 標題 / 主選單 | `calm medieval fantasy theme, harp and flute, peaceful village` |
| 城鎮探索 | `cozy RPG town music, acoustic guitar, warm and nostalgic` |
| 戰鬥 | `epic fantasy battle music, orchestral, drums, intense` |
| Boss 戰 | `dark boss battle theme, dramatic, choir, heavy percussion` |
| 地下城 | `mysterious dungeon ambient, low strings, tension` |
| 勝利 | `victory fanfare, triumphant, brass, short` |

### 2. MusicGen + OpenVINO（Intel CPU 加速）

```bash
pip install openvino
# 或使用 Intel 提供的預轉換模型
```

預轉換模型：[Intel/musicgen-static-openvino](https://huggingface.co/Intel/musicgen-static-openvino)

### 3. ACE-Step 1.5（低 VRAM / CPU offload）

```bash
pip install ace-step  # 或依官方 GitHub 安裝
```

- GitHub: [ace-step/ACE-Step](https://github.com/ace-step/ACE-Step)
- 支援 LoRA、可生成人聲
- <4GB VRAM、有 CPU offload 選項

### 4. MusicLDM（Diffusers）

```python
from diffusers import MusicLDMPipeline
import torch
import scipy

pipe = MusicLDMPipeline.from_pretrained(
    "ucsd-reach/musicldm",
    torch_dtype=torch.float32  # CPU 用 float32
)
pipe.enable_model_cpu_offload()  # 省記憶體

audio = pipe(
    "medieval fantasy RPG village music, acoustic",
    num_inference_steps=100,
    audio_length_in_s=10.0
).audios[0]

scipy.io.wavfile.write("village.wav", rate=16000, data=audio)
```

### 5. Stable Audio Open Small（輕量、音效）

適合：鼓組、音效、短 BGM（約 11 秒）

- 針對 Arm CPU 優化，x86 也可跑
- [stabilityai/stable-audio-open-small](https://huggingface.co/stabilityai/stable-audio-open-small)

---

## MusicGen LoRA / 微調模型（遊戲風格）

以 `facebook/musicgen-small` 為 base 的 Adapter：

| LoRA / 微調 | 風格 | HF 連結 |
|-------------|------|---------|
| 80s New Wave | 復古電子 | [memepottaboah/musicgen-80snewwave-tiny](https://huggingface.co/memepottaboah/musicgen-80snewwave-tiny) |
| Afrobeat | 非洲節奏 | [ogbanugot/musicgen-small-lora-afrobeats](https://huggingface.co/ogbanugot/musicgen-small-lora-afrobeats) |
| Electronic | 電子樂 | [TruongScotl/musicgen-electronic](https://huggingface.co/TruongScotl/musicgen-electronic) |
| Punk | 龐克 | [hyeongii/musicgen-melody-lora-punk](https://huggingface.co/hyeongii/musicgen-melody-lora-punk) |
| Brostep | 電子重低音 | [programchild/musicgen_brostep](https://huggingface.co/programchild/musicgen_brostep) |

更多 Adapter：[MusicGen Small Adapters](https://huggingface.co/models?other=base_model:adapter:facebook/musicgen-small)

**自訓 LoRA**：可參考 [MusicGen LoRA 教學](https://huggingface.co/blog/theeseus-ai/musicgen-lora-large)，用遊戲 BGM 資料集微調。

---

## 限制與注意事項

| 項目 | 說明 |
|------|------|
| **MusicGen 長度** | 單次最長約 30 秒（1503 tokens），需分段或拼接 |
| **授權** | MusicGen 為 CC-BY-NC 4.0（非商業研究），商用請確認授權 |
| **Stable Audio Open** | Stability AI Community License，可商用 |
| **ACE-Step** | Apache 2.0，可商用 |
| **人聲** | MusicGen 主要為純音樂；ACE-Step 支援人聲 |
| **CPU 速度** | 比 GPU 慢很多，可考慮減少 `max_new_tokens` 或 `num_inference_steps` |

---

## 與遊戲整合

1. **預生成**：用上述腳本批次產出 BGM，匯出為 `.wav` / `.mp3`
2. **放入專案**：放到 `public/assets/audio/` 或對應資源目錄
3. **Phaser 載入**：沿用現有 `AudioManager` 或 `BootScene` 的 audio 載入邏輯

```typescript
// 範例：在 BootScene 或對應場景載入
this.load.audio('bgm_town', 'assets/audio/town_bgm.mp3');
this.load.audio('bgm_battle', 'assets/audio/battle_bgm.mp3');
```

---

## 參考連結

- [Hugging Face Text-to-Audio 模型列表](https://huggingface.co/models?pipeline_tag=text-to-audio&sort=likes)
- [MusicGen 文件](https://huggingface.co/docs/transformers/model_doc/musicgen)
- [MusicGen OpenVINO 教學](https://docs.openvino.ai/2024/notebooks/music-generation-with-output.html)
- [ACE-Step GitHub](https://github.com/ace-step/ACE-Step)
- [MusicLDM Diffusers](https://huggingface.co/docs/diffusers/api/pipelines/musicldm)
- [Stable Audio Open Small](https://huggingface.co/stabilityai/stable-audio-open-small)
