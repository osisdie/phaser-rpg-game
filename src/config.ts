import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { NameInputScene } from './scenes/NameInputScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { FieldScene } from './scenes/FieldScene';
import { TownScene } from './scenes/TownScene';
import { BattleScene } from './scenes/BattleScene';
import { MenuScene } from './scenes/MenuScene';
import { DialogueScene } from './scenes/DialogueScene';
import { ShopScene } from './scenes/ShopScene';
import { GameOverScene } from './scenes/GameOverScene';
import { CutsceneScene } from './scenes/CutsceneScene';
import { EndingScene } from './scenes/EndingScene';

export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;
export const TILE_SIZE = 64;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  // No pixelArt/roundPixels — use bilinear filtering for crisp text at any scale.
  // Sprite textures that need nearest-neighbor can set it per-texture.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    fullscreenTarget: document.body,
  },
  scene: [
    BootScene,
    TitleScene,
    NameInputScene,
    WorldMapScene,
    FieldScene,
    TownScene,
    BattleScene,
    MenuScene,
    DialogueScene,
    ShopScene,
    GameOverScene,
    CutsceneScene,
    EndingScene,
  ],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  backgroundColor: '#000000',
  loader: {
    imageLoadType: 'HTMLImageElement',
  },
};
