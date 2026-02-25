# 視覺升級方案 — Harry Potter 中世紀歐洲風格

> 讓地圖、角色、裝備、NPC、怪物、Boss、戰鬥、招式更精緻，畫風一致（哈利波特 × 中世紀歐洲農村、城堡、莊園）

---

## 現況分析

目前專案使用 **全程式生成美術**（Canvas 2D 即時繪製）：

| 模組 | 檔案 | 現況 |
|------|------|------|
| 地磚 | `TileRenderer.ts` | 簡單幾何 + 色塊 |
| 角色 | `CharacterRenderer.ts` | 24×32 像素，矩形/圓形組合 |
| 怪物 | `MonsterRenderer.ts` + `MonsterShapes.ts` | 形狀映射 + 區域色板 |
| 建築 | `BuildingRenderer.ts` | Tudor 木架構、石頭、樹木 |
| UI | `PanelRenderer.ts`, `IconRenderer.ts` | 木紋、金屬邊框 |
| 世界地圖 | `WorldMapRenderer.ts` | 區域色塊 |
| 戰鬥特效 | `BattleEffects.ts` | 簡單動畫 |

**優點**：無外部資源、載入快、可動態變色
**缺點**：視覺粗糙、缺乏細節、風格較單調

---

## 方案一：Ludo.ai（推薦入門）

**適合**：想快速產出、不想自己架模型

### 特色
- 專為遊戲設計，支援 2D、像素、卡通、等距視角
- **Asset 模式**（2024 新增）：精準生成角色、物品、UI 元件
- 可上傳參考圖維持風格
- 可選參考遊戲（如 Harry Potter 系列）作為風格基準

### 建議 Prompt 範本（Harry Potter 中世紀風格）

```
Medieval European village, Tudor-style half-timbered house,
Harry Potter aesthetic, warm lighting, fantasy RPG,
2D game asset, top-down view, 32x32 pixels
```

```
Fantasy RPG character sprite sheet, medieval wizard,
cloak and robes, Hogwarts style, 4-direction walk cycle,
consistent lighting, game asset, transparent background
```

```
Medieval castle interior, stone walls, torches,
Harry Potter dungeon aesthetic, 2D tile asset,
top-down RPG view
```

### 實作流程
1. 在 Ludo.ai 生成一組「風格基準圖」（建築、角色、怪物各 1–2 張）
2. 匯出 PNG，放入 `public/assets/` 或 `src/assets/`
3. 修改 `BootScene` / `ArtRegistry`：改為載入圖片 texture，而非呼叫 `generateAll`
4. 或採 **混合模式**：AI 圖當底，程式生成疊加（如裝備、狀態效果）

---

## 方案二：AI 圖像模型（SDXL / LoRA）

**適合**：要高度客製、願意花時間調教

### 2.1 現成 LoRA（Civitai 等）

- **Game Character Sprites LoRA**：像素風角色、sprite sheet
- 搜尋關鍵字：`RPG sprite`, `medieval fantasy`, `Harry Potter style`, `2D game asset`

### 2.2 自訓 LoRA（風格一致）

1. 準備 8–15 張風格一致的參考圖（同一畫風、同一比例）
2. 用 Draw Things / Easy Diffusion / ComfyUI 做 LoRA 微調
3. 產出時用 trigger word + 固定 prompt 維持一致性

### 2.3 專用 Sprite 工具

| 工具 | 特色 | 網址 |
|------|------|------|
| **AISpriteSheet** | 自動對齊網格、透明背景、sprite sheet | aispritesheet.com |
| **GenSprite** | SDXL + 去背 + 8 方向旋轉 | gensprite.ai |
| **SpriteCook** | 30 秒內產出、風格一致 | spritecook.ai |

### 建議 Prompt 結構（維持一致）

```
[Base style] medieval European fantasy, Harry Potter aesthetic,
warm candlelight, stone and wood, British countryside

[Subject] [specific description]

[Technical] 2D game asset, top-down/isometric/side view,
transparent background, consistent lighting,
sprite sheet format, 32x32 or 64x64
```

---

## 方案三：混合架構（推薦長期）

保留程式生成的彈性，用 AI 圖當「基底材質」：

```
┌─────────────────────────────────────────────────────────┐
│  AI 生成圖層（Ludo / SDXL）                              │
│  - 建築紋理、角色底圖、怪物造型、地磚材質                 │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  程式疊加層（現有 Canvas 2D）                            │
│  - 裝備、狀態效果、區域色調、動畫                        │
└─────────────────────────────────────────────────────────┘
```

### 實作要點

1. **預載 AI 圖**：在 `BootScene` 用 `scene.load.image()` 載入
2. **擴充 ArtRegistry**：新增 `registerFromImage()`，可選是否疊加程式效果
3. **色板保留**：`palettes.ts` 的 `REGION_PALETTES` 可對 AI 圖做 `tint` 或 `colorMatrix` 調整

---

## 方案四：風格指南（畫風一致）

不論用 Ludo 或 SDXL，建議先定義「風格聖經」：

### Harry Potter × 中世紀歐洲 關鍵詞

| 類別 | 關鍵詞 |
|------|--------|
| 建築 | Tudor half-timbered, stone castle, thatched roof, cobblestone, manor house |
| 氛圍 | warm candlelight, torch-lit, misty, British countryside, Hogwarts aesthetic |
| 材質 | aged wood, worn stone, brass fittings, parchment, wool cloaks |
| 角色 | robes, cloaks, medieval peasant, wizard apprentice, village elder |
| 怪物 | gothic fantasy, dark fairy tale, European folklore (not anime) |

### 避免

- 日式動漫風、賽璐珞
- 過度寫實（3D 感太重）
- 鮮豔螢光色

---

## 建議執行順序

1. **Phase 1（1–2 天）**
   - 用 Ludo.ai 產 5–10 張測試圖（建築×2、角色×2、怪物×2）
   - 確認風格是否符合預期

2. **Phase 2（約 1 週）**
   - 建立 `public/assets/ai/` 目錄
   - 修改 `ArtRegistry` 支援「優先載入圖片，不存在才程式生成」
   - 先替換建築、地磚等靜態資源

3. **Phase 3（約 2 週）**
   - 角色、怪物 sprite sheet 批次生成
   - 統一尺寸（如 24×32 角色、32×32 怪物）
   - 戰鬥特效可保留程式生成或改用粒子 + AI 圖

4. **Phase 4（可選）**
   - 若 Ludo 風格不夠穩定，考慮自訓 LoRA 或改用 SpriteCook / GenSprite

---

## 技術整合範例

### 在 Phaser 中載入 AI 圖取代程式生成

```typescript
// BootScene 或 ArtRegistry
if (hasAIAsset('bld_tudor')) {
  scene.load.image('bld_tudor', 'assets/ai/bld_tudor.png');
} else {
  // fallback to procedural
  BuildingRenderer.generateBuilding(scene, 'bld_tudor', ...);
}
```

### 對 AI 圖套用區域色調

```typescript
// 沿用現有 palettes
sprite.setTint(hexToNum(getRegionPalette(regionId).accent));
```

---

## 參考連結

### 本機 CPU 方案
- [FastSD CPU](https://github.com/rupeshs/fastsdcpu) — CPU 專用、支援 LoRA、可下載
- [Hugging Face Diffusers](https://huggingface.co/docs/diffusers) — 官方推理庫
- [Optimum OpenVINO](https://huggingface.co/docs/optimum/main/en/intel/optimization/openvino) — Intel CPU 加速
- [Awesome SDXL LoRAs 精選](https://huggingface.co/collections/multimodalart/awesome-sdxl-loras-64f9af6d5cce4f4e8f351466)

### 雲端 / 付費（有呼叫限制）
- [Ludo.ai Image Generator](https://ludo.ai/blog/introducing-new-improved-ludo-ai-image-generator-2024)
- [AISpriteSheet](https://www.aispritesheet.com/)
- [GenSprite](https://gensprite.ai/)
- [SpriteCook](https://spritecook.ai/)
- [Civitai - Game Sprites LoRA](https://civitai.com/models/1936887/)
