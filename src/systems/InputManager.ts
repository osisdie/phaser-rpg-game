import Phaser from 'phaser';

/**
 * Unified input abstraction — binds SPACE/ENTER/click for confirm,
 * ESC/right-click for cancel. Centralizes input handling so
 * future touch/gamepad support only needs changes here.
 */

type InputCallback = () => void;

const CONFIRM_KEYS = ['SPACE', 'ENTER', 'Z'] as const;
const CANCEL_KEYS = ['ESC'] as const;

/** Per-scene tracking of bound listeners for cleanup */
const sceneBindings = new WeakMap<Phaser.Scene, {
  confirmKeys: Phaser.Input.Keyboard.Key[];
  cancelKeys: Phaser.Input.Keyboard.Key[];
  confirmClick?: (pointer: Phaser.Input.Pointer) => void;
  cancelClick?: (pointer: Phaser.Input.Pointer) => void;
}>();

export class InputManager {

  /**
   * Bind a confirm action (SPACE + ENTER + Z + left-click).
   * Uses JustDown check in scene update for keyboard,
   * and pointerdown event for mouse.
   */
  static onConfirm(scene: Phaser.Scene, callback: InputCallback): void {
    const kb = scene.input.keyboard;
    if (!kb) return;

    let binding = sceneBindings.get(scene);
    if (!binding) {
      binding = { confirmKeys: [], cancelKeys: [] };
      sceneBindings.set(scene, binding);
    }

    // Register keyboard keys
    for (const keyName of CONFIRM_KEYS) {
      const key = kb.addKey(keyName);
      binding.confirmKeys.push(key);
    }

    // Register left-click
    const clickHandler = (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) callback();
    };
    binding.confirmClick = clickHandler;
    scene.input.on('pointerdown', clickHandler);

    // Store callback for JustDown polling in update
    (scene as any).__inputConfirmCb = callback;
  }

  /**
   * Bind a cancel action (ESC + right-click).
   */
  static onCancel(scene: Phaser.Scene, callback: InputCallback): void {
    const kb = scene.input.keyboard;
    if (!kb) return;

    let binding = sceneBindings.get(scene);
    if (!binding) {
      binding = { confirmKeys: [], cancelKeys: [] };
      sceneBindings.set(scene, binding);
    }

    for (const keyName of CANCEL_KEYS) {
      const key = kb.addKey(keyName);
      binding.cancelKeys.push(key);
    }

    const clickHandler = (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) callback();
    };
    binding.cancelClick = clickHandler;
    scene.input.on('pointerdown', clickHandler);

    (scene as any).__inputCancelCb = callback;
  }

  /**
   * Call this in scene.update() to poll JustDown for confirm/cancel keys.
   * Returns true if a confirm or cancel was triggered.
   */
  static update(scene: Phaser.Scene): { confirmed: boolean; cancelled: boolean } {
    const binding = sceneBindings.get(scene);
    if (!binding) return { confirmed: false, cancelled: false };

    let confirmed = false;
    let cancelled = false;

    const confirmCb = (scene as any).__inputConfirmCb as InputCallback | undefined;
    if (confirmCb) {
      for (const key of binding.confirmKeys) {
        if (Phaser.Input.Keyboard.JustDown(key)) {
          confirmed = true;
          confirmCb();
          break;
        }
      }
    }

    const cancelCb = (scene as any).__inputCancelCb as InputCallback | undefined;
    if (cancelCb && !confirmed) {
      for (const key of binding.cancelKeys) {
        if (Phaser.Input.Keyboard.JustDown(key)) {
          cancelled = true;
          cancelCb();
          break;
        }
      }
    }

    return { confirmed, cancelled };
  }

  /**
   * Remove all confirm bindings from a scene.
   */
  static removeConfirm(scene: Phaser.Scene): void {
    const binding = sceneBindings.get(scene);
    if (!binding) return;

    for (const key of binding.confirmKeys) {
      scene.input.keyboard?.removeKey(key, true);
    }
    binding.confirmKeys = [];

    if (binding.confirmClick) {
      scene.input.off('pointerdown', binding.confirmClick);
      binding.confirmClick = undefined;
    }

    delete (scene as any).__inputConfirmCb;
  }

  /**
   * Remove all cancel bindings from a scene.
   */
  static removeCancel(scene: Phaser.Scene): void {
    const binding = sceneBindings.get(scene);
    if (!binding) return;

    for (const key of binding.cancelKeys) {
      scene.input.keyboard?.removeKey(key, true);
    }
    binding.cancelKeys = [];

    if (binding.cancelClick) {
      scene.input.off('pointerdown', binding.cancelClick);
      binding.cancelClick = undefined;
    }

    delete (scene as any).__inputCancelCb;
  }

  /**
   * Remove all bindings from a scene.
   */
  static removeAll(scene: Phaser.Scene): void {
    this.removeConfirm(scene);
    this.removeCancel(scene);
    sceneBindings.delete(scene);
  }

  /**
   * Check if a confirm key was just pressed (one-shot check, no callback).
   */
  static isConfirmJustDown(scene: Phaser.Scene): boolean {
    const binding = sceneBindings.get(scene);
    if (!binding) return false;
    return binding.confirmKeys.some(key => Phaser.Input.Keyboard.JustDown(key));
  }

  /**
   * Check if a cancel key was just pressed (one-shot check, no callback).
   */
  static isCancelJustDown(scene: Phaser.Scene): boolean {
    const binding = sceneBindings.get(scene);
    if (!binding) return false;
    return binding.cancelKeys.some(key => Phaser.Input.Keyboard.JustDown(key));
  }
}
