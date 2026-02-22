import Phaser from 'phaser';
import { gameConfig } from './config';

const game = new Phaser.Game(gameConfig);
// Expose for debugging
(window as any).__GAME__ = game;

// Auto-focus canvas so keyboard events work immediately
game.events.on('ready', () => {
  const canvas = game.canvas;
  canvas.setAttribute('tabindex', '0');
  canvas.style.outline = 'none';
  canvas.focus();
});

// Re-focus on any click
document.addEventListener('click', () => {
  game.canvas?.focus();
});

// F11 — toggle fullscreen
document.addEventListener('keydown', (e) => {
  if (e.key === 'F11') {
    e.preventDefault();
    if (game.scale.isFullscreen) {
      game.scale.stopFullscreen();
    } else {
      game.scale.startFullscreen();
    }
  }
});
