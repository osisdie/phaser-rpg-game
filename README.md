# 勇者傳說 — 七國的傳說

> 一款以 Phaser 3 打造的 2D 像素風 JRPG，全程式生成美術、回合制戰鬥、12 大區域冒險。

[![CI](https://github.com/<owner>/phaser-rpg-game/actions/workflows/ci.yml/badge.svg)](https://github.com/<owner>/phaser-rpg-game/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<p align="center">
  <img src="docs/screenshots/title.png" width="49%" alt="標題畫面">
  <img src="docs/screenshots/battle.png" width="49%" alt="戰鬥場景">
</p>

---

## 遊戲特色 Features

- **壯闊的冒險旅程** — 歷經 12 個王國（精靈、樹人、獸人、人魚、巨人、矮人、不死族…），從流浪勇者成長為國王
- **回合制戰鬥** — 基於敏捷排序，支援攻擊、技能、道具、防禦、逃跑
- **120+ 怪物 & 12 Boss** — 每個區域 10 種怪物 + 1 位區域魔王，最終迎戰大魔王
- **7 位夥伴** — 各具種族特色技能，最多帶 2 位上場戰鬥
- **全程式生成美術** — 角色、怪物、建築、地形、UI 面板皆由 Canvas 2D 即時繪製
- **裝備系統** — 5 部位 × 8 階裝備，影響攻防敏等屬性
- **存檔系統** — 3 個手動存檔 + 自動存檔（localStorage）
- **選單系統** — 物品 / 裝備 / 隊伍 / 技能 / 存檔 / 系統

## 遊戲截圖 Screenshots

| 標題畫面 | 世界地圖 |
|:---:|:---:|
| ![Title](docs/screenshots/title.png) | ![World Map](docs/screenshots/worldmap.png) |

| 城鎮探索 | 戰鬥場景 |
|:---:|:---:|
| ![Town](docs/screenshots/town.png) | ![Battle](docs/screenshots/battle.png) |

## Tech Stack

| Technology | Purpose |
|---|---|
| [Phaser 3](https://phaser.io/) | 2D game framework (WebGL / Canvas) |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe game logic |
| [Vite](https://vitejs.dev/) | Dev server & bundler |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9

### Installation

```bash
git clone https://github.com/<owner>/phaser-rpg-game.git
cd phaser-rpg-game
pnpm install
```

### Run

```bash
pnpm start          # Start dev server (port 5473)
pnpm run status     # Check if server is running
pnpm run stop       # Stop the server
```

Or run directly:

```bash
pnpm run dev        # Vite dev server
pnpm run build      # TypeScript check + production build
pnpm run preview    # Preview production build
```

## Project Structure

```
phaser-rpg-game/
├── src/
│   ├── scenes/        # Phaser scenes (Boot → Title → WorldMap → Town → Battle)
│   ├── systems/       # Game logic (state, combat, audio, i18n)
│   ├── entities/      # Player sprite & movement
│   ├── data/          # Static data (monsters, items, skills, regions)
│   ├── ui/            # Reusable UI components (TextBox, BattleHUD, menus)
│   ├── maps/          # Procedural map generation
│   ├── art/           # Procedural pixel art generation (Canvas 2D)
│   └── types/         # TypeScript interfaces
├── scripts/           # Dev workflow scripts (dev/stop/build/status)
├── docs/screenshots/  # Game screenshots
├── index.html
├── vite.config.ts
└── tsconfig.json
```

## Scripts

| Command | Description |
|---|---|
| `pnpm start` | Start dev server with port-check |
| `pnpm run stop` | Stop dev server on port 5473 |
| `pnpm run status` | Check server status + health check |
| `pnpm run dev` | Vite dev server (raw) |
| `pnpm run build` | TypeScript check + Vite build |
| `pnpm run preview` | Preview production build |
| `bash scripts/build.sh` | TypeScript check + build with output |

## Contributing

Contributions are welcome! Follow these steps:

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feat/my-feature`
3. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add new monster sprites"
   ```
4. **Push** and open a **Pull Request**

### Setup pre-commit hooks

```bash
pip install pre-commit
pre-commit install
pre-commit install --hook-type commit-msg
```

This enforces:
- Trailing whitespace / line ending fixes
- Case-conflict checks (important for WSL / Windows)
- TypeScript type checking
- Conventional commit messages

## License

[MIT](LICENSE) — feel free to use, modify, and distribute.
