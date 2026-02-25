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

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(DEPTH.ui + 10);

    const boxWidth = GAME_WIDTH - 40;
    const boxHeight = 140;
    const boxX = GAME_WIDTH / 2;
    const boxY = GAME_HEIGHT - 90;

    // Use medieval panel texture if available
    if (scene.textures.exists('ui_panel_dialogue')) {
      this.bg = scene.add.image(boxX, boxY, 'ui_panel_dialogue');
    } else {
      this.border = scene.add.rectangle(boxX, boxY, boxWidth + 4, boxHeight + 4, COLORS.panelBorder);
      this.bg = scene.add.rectangle(boxX, boxY, boxWidth, boxHeight, COLORS.panel, 0.95);
    }

    // Name plate
    if (scene.textures.exists('ui_name_plate')) {
      this.namePlate = scene.add.image(boxX - boxWidth / 2 + 80, boxY - boxHeight / 2 - 4, 'ui_name_plate');
    }

    this.nameText = scene.add.text(boxX - boxWidth / 2 + 16, boxY - boxHeight / 2 + 8, '', {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 1,
    });
    const contentWrapWidth = boxWidth - 40;
    this.contentText = scene.add.text(boxX - boxWidth / 2 + 16, boxY - boxHeight / 2 + 32, '', {
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
    this.indicator = scene.add.text(boxX + boxWidth / 2 - 30, boxY + boxHeight / 2 - 24, '▼', {
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
    this.choicesContainer = this.scene.add.container(0, 0);
    this.add(this.choicesContainer);

    const startY = GAME_HEIGHT - 90 - 70 + 36;
    choices.forEach((choice, i) => {
      const y = startY + i * 28;
      const text = this.scene.add.text(GAME_WIDTH / 2 - 400, y, `  ${choice.text}`, {
        fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textPrimary,
      });
      text.setInteractive({ useHandCursor: true });
      text.on('pointerover', () => text.setColor(COLORS.textHighlight));
      text.on('pointerout', () => text.setColor(COLORS.textPrimary));
      text.on('pointerdown', () => onSelect(choice.index));
      this.choicesContainer!.add(text);
    });

    // Keyboard support
    let selectedIndex = 0;
    const updateSelection = () => {
      const children = this.choicesContainer!.list as Phaser.GameObjects.Text[];
      children.forEach((t, i) => {
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
    const onConfirm = () => {
      upKey?.off('down', onUp);
      downKey?.off('down', onDown);
      enterKey?.off('down', onConfirm);
      spaceKey?.off('down', onConfirm);
      onSelect(choices[selectedIndex].index);
    };

    upKey?.on('down', onUp);
    downKey?.on('down', onDown);
    enterKey?.on('down', onConfirm);
    spaceKey?.on('down', onConfirm);
  }

  private clearChoices(): void {
    if (this.choicesContainer) {
      this.choicesContainer.destroy();
      this.choicesContainer = undefined;
    }
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
}
