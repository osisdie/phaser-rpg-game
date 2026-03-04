import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, DEPTH, FONT_FAMILY } from '../utils/constants';

/** JRPG-style text box with typewriter effect and medieval panel */
export class TextBox extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private border: Phaser.GameObjects.Rectangle | null = null;
  private namePlate: Phaser.GameObjects.Image | null = null;
  private nameText: Phaser.GameObjects.Text;
  private contentText: Phaser.GameObjects.Text;
  private indicator: Phaser.GameObjects.Text;
  private fullText = '';
  private displayedChars = 0;
  private typeSpeed = 30; // ms per char
  private typeTimer = 0;
  private isComplete = false;
  private onComplete?: () => void;
  private choicesContainer?: Phaser.GameObjects.Container;
  private choicesCleanup?: () => void;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(DEPTH.ui + 10);

    const boxWidth = GAME_WIDTH - 40;
    const boxHeight = 140;
    const boxX = GAME_WIDTH / 2;
    const boxY = GAME_HEIGHT - 90;

    // Use medieval panel texture if available
    const hasPanel = scene.textures.exists('ui_panel_dialogue');
    if (hasPanel) {
      this.bg = scene.add.image(boxX, boxY, 'ui_panel_dialogue');
    } else {
      this.border = scene.add.rectangle(boxX, boxY, boxWidth + 4, boxHeight + 4, COLORS.panelBorder);
      this.bg = scene.add.rectangle(boxX, boxY, boxWidth, boxHeight, COLORS.panel, 0.95);
    }

    // Content area — align text within the visual panel interior
    // Panel texture is 920×140 with 10px wood border; rect fallback is 984×140 with 2px border
    const bgW = hasPanel ? 920 : boxWidth;
    const bdr = hasPanel ? 10 : 2;
    const padX = 14;  // horizontal padding inside border
    const padY = 6;   // vertical padding inside border
    const cLeft = boxX - bgW / 2 + bdr + padX;
    const cRight = boxX + bgW / 2 - bdr - padX;
    const cTop = boxY - boxHeight / 2 + bdr + padY;

    // Name plate
    if (scene.textures.exists('ui_name_plate')) {
      this.namePlate = scene.add.image(boxX - bgW / 2 + 80, boxY - boxHeight / 2 - 4, 'ui_name_plate');
    }

    this.nameText = scene.add.text(cLeft, cTop, '', {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 3,
    });
    const contentWrapWidth = cRight - cLeft;
    this.contentText = scene.add.text(cLeft, cTop + 24, '', {
      fontFamily: FONT_FAMILY, fontSize: '15px', color: COLORS.textPrimary,
      wordWrap: { width: contentWrapWidth },
      lineSpacing: 4,
      maxLines: 4,
    });
    // Phaser 3.90 drops wordWrap.callback from config; set directly on style
    this.contentText.style.wordWrapCallback = (_text: string, textObject: Phaser.GameObjects.Text) => {
      const ctx = textObject.context;
      let result = '';
      let lineWidth = 0;
      for (const char of _text) {
        if (char === '\n') { result += '\n'; lineWidth = 0; continue; }
        const w = ctx.measureText(char).width;
        if (lineWidth + w > contentWrapWidth && lineWidth > 0) {
          result += '\n';
          lineWidth = 0;
        }
        result += char;
        lineWidth += w;
      }
      return result;
    };
    this.indicator = scene.add.text(cRight - 12, boxY + boxHeight / 2 - bdr - padY - 16, '▼', {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight,
    });

    const children: Phaser.GameObjects.GameObject[] = [this.bg, this.nameText, this.contentText, this.indicator];
    if (this.border) children.unshift(this.border);
    if (this.namePlate) children.push(this.namePlate);
    this.add(children);

    this.setVisible(false);
    this.setScrollFactor(0);

    // Blink indicator
    scene.tweens.add({
      targets: this.indicator,
      alpha: { from: 1, to: 0.2 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  show(speaker: string, text: string, onComplete?: () => void): void {
    this.setVisible(true);
    this.nameText.setText(speaker);
    if (this.namePlate) {
      this.namePlate.setVisible(speaker.length > 0);
    }
    this.fullText = text;
    this.displayedChars = 0;
    this.contentText.setText('');
    this.isComplete = false;
    this.onComplete = onComplete;
    this.indicator.setVisible(false);
    this.clearChoices();
  }

  showChoices(choices: { text: string; index: number }[], onSelect: (index: number) => void): void {
    this.clearChoices();
    this.contentText.setVisible(false); // Hide content to prevent overlap
    this.choicesContainer = this.scene.add.container(0, 0);
    this.add(this.choicesContainer);

    // Position choice panel ABOVE the dialog box
    const boxTop = GAME_HEIGHT - 90 - 70; // top edge of dialog box
    const panelH = choices.length * 32 + 20;
    const panelW = 280;
    const panelCX = GAME_WIDTH / 2;
    const panelTop = boxTop - panelH - 8;

    // Semi-transparent background + border for choice panel
    const choiceBorder = this.scene.add.rectangle(panelCX, panelTop + panelH / 2, panelW + 4, panelH + 4, COLORS.panelBorder);
    const choiceBg = this.scene.add.rectangle(panelCX, panelTop + panelH / 2, panelW, panelH, COLORS.panel, 0.95);
    this.choicesContainer.add([choiceBorder, choiceBg]);

    const startY = panelTop + 14;
    // Store choice text bounds for scene-level mouse handler (avoids scrollFactor input mismatch)
    const choiceBounds: { x: number; y: number; w: number; h: number }[] = [];
    choices.forEach((choice, i) => {
      const y = startY + i * 32;
      const text = this.scene.add.text(panelCX - panelW / 2 + 20, y, `  ${choice.text}`, {
        fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textPrimary,
      });
      // Don't use setInteractive() — it breaks with scrollFactor(0) + camera scroll.
      // Mouse input is handled via scene-level pointer handlers below.
      choiceBounds.push({ x: text.x, y: text.y, w: panelW - 40, h: 28 });
      this.choicesContainer!.add(text);
    });

    // Keyboard + mouse support
    let selectedIndex = 0;
    const getChoiceTexts = () =>
      this.choicesContainer!.list.filter((c): c is Phaser.GameObjects.Text => c instanceof Phaser.GameObjects.Text);
    const updateSelection = () => {
      const textChildren = getChoiceTexts();
      textChildren.forEach((t, i) => {
        t.setText(i === selectedIndex ? `► ${choices[i].text}` : `  ${choices[i].text}`);
        t.setColor(i === selectedIndex ? COLORS.textHighlight : COLORS.textPrimary);
      });
    };
    updateSelection();

    const upKey = this.scene.input.keyboard?.addKey('UP');
    const downKey = this.scene.input.keyboard?.addKey('DOWN');
    const enterKey = this.scene.input.keyboard?.addKey('ENTER');
    const spaceKey = this.scene.input.keyboard?.addKey('SPACE');

    const onUp = () => { selectedIndex = (selectedIndex - 1 + choices.length) % choices.length; updateSelection(); };
    const onDown = () => { selectedIndex = (selectedIndex + 1) % choices.length; updateSelection(); };

    let fired = false;
    const doSelect = (index: number) => {
      if (fired) return;
      fired = true;
      cleanup();
      onSelect(index);
    };
    const onConfirm = () => doSelect(choices[selectedIndex].index);

    // Scene-level mouse handlers — use pointer screen coords (not world coords)
    // to bypass the scrollFactor + camera scroll input mismatch in Phaser 3
    const onPointerMove = (pointer: Phaser.Input.Pointer) => {
      for (let i = 0; i < choiceBounds.length; i++) {
        const b = choiceBounds[i];
        if (pointer.x >= b.x && pointer.x <= b.x + b.w &&
            pointer.y >= b.y && pointer.y <= b.y + b.h) {
          if (selectedIndex !== i) {
            selectedIndex = i;
            updateSelection();
          }
          return;
        }
      }
    };
    const onPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      for (let i = 0; i < choiceBounds.length; i++) {
        const b = choiceBounds[i];
        if (pointer.x >= b.x && pointer.x <= b.x + b.w &&
            pointer.y >= b.y && pointer.y <= b.y + b.h) {
          doSelect(choices[i].index);
          return;
        }
      }
    };
    this.scene.input.on('pointermove', onPointerMove);
    this.scene.input.on('pointerdown', onPointerDown);

    const cleanup = () => {
      upKey?.off('down', onUp);
      downKey?.off('down', onDown);
      enterKey?.off('down', onConfirm);
      spaceKey?.off('down', onConfirm);
      this.scene.input.off('pointermove', onPointerMove);
      this.scene.input.off('pointerdown', onPointerDown);
      this.choicesCleanup = undefined;
    };

    // Store cleanup so clearChoices() can remove orphaned handlers
    this.choicesCleanup = cleanup;

    upKey?.on('down', onUp);
    downKey?.on('down', onDown);
    enterKey?.on('down', onConfirm);
    spaceKey?.on('down', onConfirm);
  }

  private clearChoices(): void {
    // Remove keyboard handlers BEFORE destroying container to prevent orphaned listeners
    this.choicesCleanup?.();
    if (this.choicesContainer) {
      this.choicesContainer.destroy();
      this.choicesContainer = undefined;
    }
    this.contentText.setVisible(true); // Restore content text visibility
  }

  hide(): void {
    this.setVisible(false);
    this.clearChoices();
  }

  update(_time: number, delta: number): void {
    if (!this.visible || this.isComplete) return;

    this.typeTimer += delta;
    while (this.typeTimer >= this.typeSpeed && this.displayedChars < this.fullText.length) {
      this.typeTimer -= this.typeSpeed;
      this.displayedChars++;
      this.contentText.setText(this.fullText.substring(0, this.displayedChars));
    }

    if (this.displayedChars >= this.fullText.length) {
      this.isComplete = true;
      this.indicator.setVisible(true);
    }
  }

  /** Skip to full text or advance */
  advance(): boolean {
    if (!this.isComplete) {
      this.displayedChars = this.fullText.length;
      this.contentText.setText(this.fullText);
      this.isComplete = true;
      this.indicator.setVisible(true);
      return false;
    }
    this.onComplete?.();
    return true;
  }

  getIsComplete(): boolean {
    return this.isComplete;
  }

  /** Returns true if choices are currently displayed */
  hasActiveChoices(): boolean {
    return !!this.choicesContainer;
  }

  /** Returns true if the textBox is currently visible */
  isVisible(): boolean {
    return this.visible;
  }
}
