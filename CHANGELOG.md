# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-03-16

### Added
- Docker support (Dockerfile + nginx + .dockerignore)
- Bilingual README (English + 繁體中文)
- Controls / keybinding table in README
- CONTRIBUTING.md with expanded guide
- CHANGELOG.md
- GitHub Pages auto-deploy via CI
- Play Demo, Phaser, TypeScript badges in README

### Changed
- Track AI-generated PNG assets in git (for CI/CD builds)
- Vite `base` path conditional for GitHub Pages subpath

## [0.1.0] - 2025-03-09

### Added
- Full game loop: Title → Name Input → World Map → Town → Field → Battle → Victory / Game Over
- 12 regions with 120+ monsters and 12 bosses
- 7 companions with unique racial skills (max 4 party members)
- Turn-based combat with AGI ordering, skills, items, flee, auto-attack (A key)
- AI-generated pixel art (Stable Diffusion) — 71 monster sprites, 16 battle characters, 36 battle backgrounds, 24 portraits, 12 effects
- AI-generated audio (MusicGen) — 23 BGM tracks (region-specific) + 15 SFX
- Procedural art fallback — characters, buildings, terrain, tiles, UI panels via Canvas 2D
- Equipment system — 5 slots × 8 tiers (40 items)
- Save/Load system — 3 manual slots + autosave (localStorage)
- Menu system — items, equipment, party, skills, system
- World map with visual status indicators (occupied, unexplored, liberated, accessible)
- Town layout — 40×32 grid with castle, inn, shop, church, houses, NPCs
- Difficulty settings — Easy / Normal / Hard with card-style UI toggle
- Real-time monitoring system (WebSocket dashboard on port 9473)
- E2E tests with Playwright (8 test cases)
- AI asset pipeline — CPU (SD 1.5) + GPU (SDXL / Flux.1-dev) generation scripts
- Pre-commit hooks — trailing whitespace, case-conflict, TypeScript check, conventional commits
- CI pipeline — GitHub Actions (lint + build) and GitLab CI

[0.2.0]: https://github.com/osisdie/phaser-rpg-game/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/osisdie/phaser-rpg-game/releases/tag/v0.1.0
