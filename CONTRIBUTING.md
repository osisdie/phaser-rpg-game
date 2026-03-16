# Contributing to 勇者傳說

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/<your-username>/phaser-rpg-game.git
   cd phaser-rpg-game
   ```
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Start the dev server**:
   ```bash
   pnpm start        # port 5473
   ```

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes
3. Run checks before committing:
   ```bash
   pnpm exec tsc --noEmit   # Type check
   pnpm run build            # Full build
   pnpm test                 # E2E tests (requires Playwright)
   ```
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add new monster sprites"
   ```
5. Push and open a **Pull Request**

## Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

| Prefix | Usage |
|--------|-------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `style:` | Formatting, no logic change |
| `refactor:` | Code change that neither fixes a bug nor adds a feature |
| `test:` | Adding or updating tests |
| `chore:` | Build process, CI, or tooling changes |

## Pre-commit Hooks

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

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `src/scenes/` | Phaser scenes (Boot, Title, WorldMap, Town, Battle, ...) |
| `src/systems/` | Game logic (state, combat, audio, i18n) |
| `src/data/` | Static game data (monsters, items, skills, regions) |
| `src/ui/` | Reusable UI components |
| `src/maps/` | Procedural map generation |
| `src/art/` | Procedural pixel art generation (Canvas 2D) |
| `src/entities/` | Player sprite & movement |
| `e2e/` | Playwright E2E tests |
| `scripts/` | Dev workflow & AI asset generation |

## Tech Stack

- **Phaser 3** — 2D game framework
- **TypeScript** — Type-safe game logic
- **Vite** — Dev server & bundler
- **pnpm** — Package manager (not npm)
- **Playwright** — E2E testing

## Notes

- All game text is in **Traditional Chinese** (繁體中文)
- Use `t()` from `src/systems/i18n.ts` for translatable strings
- AI-generated assets are in `public/assets/ai/` — see [AI-Generated Assets Notice](README.md#ai-generated-assets-notice) for license details
- Dev server runs on port **5473**
