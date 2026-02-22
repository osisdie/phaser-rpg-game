import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { SaveLoadSystem } from '../systems/SaveLoadSystem';
import { LevelSystem } from '../systems/LevelSystem';
import { EquipmentSystem } from '../systems/EquipmentSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { SkillSystem } from '../systems/SkillSystem';
import { getEquipmentById } from '../data/items/index';
import { audioManager } from '../systems/AudioManager';
import type { EquipmentSlot } from '../types';
import { getCompanionTextureKey } from '../art/characters/NPCProfiles';

type MenuTab = 'main' | 'items' | 'equipment' | 'party' | 'skills' | 'save' | 'system';

export class MenuScene extends Phaser.Scene {
  private currentTab: MenuTab = 'main';
  private contentContainer!: Phaser.GameObjects.Container;
  private menuItems: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    // Semi-transparent overlay
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);

    // Panel — use medieval panel texture if available
    const panelW = GAME_WIDTH - 80;
    const panelH = GAME_HEIGHT - 60;
    if (this.textures.exists('ui_panel_menu')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_panel_menu');
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, panelW + 4, panelH + 4, COLORS.panelBorder);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, panelW, panelH, COLORS.panel, 0.98);
    }

    // Content container (cleared on tab switch)
    this.contentContainer = this.add.container(0, 0);

    this.showMainMenu();

    // Close
    this.input.keyboard?.on('keydown-ESC', () => this.closeMenu());
    this.input.keyboard?.on('keydown-M', () => this.closeMenu());
  }

  private clearContent(): void {
    this.contentContainer.removeAll(true);
    this.menuItems = [];
    this.selectedIndex = 0;
  }

  private showMainMenu(): void {
    this.clearContent();
    this.currentTab = 'main';

    const tabs = [
      { label: t('menu.items'), action: () => this.showItems() },
      { label: t('menu.equipment'), action: () => this.showEquipment() },
      { label: t('menu.party'), action: () => this.showParty() },
      { label: t('menu.skills'), action: () => this.showSkills() },
      { label: t('menu.save'), action: () => this.showSave() },
      { label: t('menu.system'), action: () => this.showSystem() },
      { label: t('menu.close'), action: () => this.closeMenu() },
    ];

    const startY = 80;
    tabs.forEach((tab, i) => {
      const text = this.add.text(100, startY + i * 36, `  ${tab.label}`, {
        fontFamily: FONT_FAMILY, fontSize: '20px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setInteractive({ useHandCursor: true });

      text.on('pointerover', () => { this.selectedIndex = i; this.updateMenuDisplay(); });
      text.on('pointerdown', () => { audioManager.playSfx('select'); tab.action(); });
      this.menuItems.push(text);
      this.contentContainer.add(text);
    });

    // Party info (right side) with character portraits
    const party = gameState.getParty();
    party.forEach((char, i) => {
      const x = 400;
      const y = 80 + i * 100;

      // Character portrait (small sprite)
      let portraitKey = 'char_hero';
      if (i > 0) {
        const compKey = getCompanionTextureKey(char.id);
        if (compKey && this.textures.exists(compKey)) {
          portraitKey = compKey;
        }
      }
      if (this.textures.exists(portraitKey)) {
        this.contentContainer.add(
          this.add.image(x - 30, y + 20, portraitKey, 0).setScale(1.5)
        );
      }

      this.contentContainer.add([
        this.add.text(x, y, char.name, { fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textHighlight, stroke: '#000000', strokeThickness: 2 }),
        this.add.text(x, y + 24, `Lv.${char.level}  HP:${char.stats.hp}/${char.stats.maxHP}  MP:${char.stats.mp}/${char.stats.maxMP}`, { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 2 }),
        this.add.text(x, y + 44, `ATK:${char.stats.atk} DEF:${char.stats.def} AGI:${char.stats.agi} LCK:${char.stats.luck}`, { fontFamily: FONT_FAMILY, fontSize: '13px', color: '#ccccdd', stroke: '#000000', strokeThickness: 1 }),
        this.add.text(x, y + 62, `EXP: ${char.exp}/${LevelSystem.getExpToNextLevel(char)}  點數: ${char.statPoints}`, { fontFamily: FONT_FAMILY, fontSize: '13px', color: '#ccccdd', stroke: '#000000', strokeThickness: 1 }),
      ]);
    });

    // Gold with coin icon
    const goldY = GAME_HEIGHT - 80;
    if (this.textures.exists('icon_coin')) {
      this.contentContainer.add(this.add.image(110, goldY + 4, 'icon_coin'));
    }
    this.contentContainer.add(
      this.add.text(125, goldY - 4, `金幣：${gameState.getGold()}`, {
        fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight,
      })
    );

    // Play time
    this.contentContainer.add(
      this.add.text(100, GAME_HEIGHT - 55, `遊戲時間：${gameState.getPlayTimeFormatted()}`, {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textSecondary,
      })
    );

    this.updateMenuDisplay();

    this.input.keyboard?.on('keydown-UP', () => { this.selectedIndex = (this.selectedIndex - 1 + tabs.length) % tabs.length; this.updateMenuDisplay(); });
    this.input.keyboard?.on('keydown-DOWN', () => { this.selectedIndex = (this.selectedIndex + 1) % tabs.length; this.updateMenuDisplay(); });
    this.input.keyboard?.on('keydown-ENTER', () => { audioManager.playSfx('select'); tabs[this.selectedIndex].action(); });
  }

  private updateMenuDisplay(): void {
    this.menuItems.forEach((text, i) => {
      const label = text.text.replace(/^[► ] /, '');
      text.setText(i === this.selectedIndex ? `► ${label}` : `  ${label}`);
      text.setColor(i === this.selectedIndex ? COLORS.textHighlight : COLORS.textPrimary);
    });
  }

  private showItems(): void {
    this.clearContent();
    this.currentTab = 'items';
    this.addBackButton();

    const allItems = InventorySystem.getAllItems();
    if (allItems.length === 0) {
      this.contentContainer.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '（沒有道具）', {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textSecondary,
      }).setOrigin(0.5));
      return;
    }

    allItems.forEach((entry, i) => {
      const y = 80 + i * 28;
      if (y > GAME_HEIGHT - 80) return;
      this.contentContainer.add(
        this.add.text(100, y, `${entry.item.name}  ×${entry.quantity}  — ${entry.item.description}`, {
          fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textPrimary,
        })
      );
    });
  }

  private showEquipment(charIndex: number = 0): void {
    this.clearContent();
    this.currentTab = 'equipment';
    this.addBackButton();

    const party = gameState.getParty();
    const slotNames: Record<string, string> = { weapon: '武器', helmet: '頭盔', armor: '鎧甲', shield: '盾牌', boots: '靴子' };
    const slots: EquipmentSlot[] = ['weapon', 'helmet', 'armor', 'shield', 'boots'];

    // Character selector tabs
    party.forEach((char, pi) => {
      const tabText = this.add.text(80 + pi * 160, 60, char.name, {
        fontFamily: FONT_FAMILY, fontSize: '16px',
        color: pi === charIndex ? COLORS.textHighlight : '#aaaaaa',
        stroke: '#000000', strokeThickness: 2,
      }).setInteractive({ useHandCursor: true });
      tabText.on('pointerdown', () => { audioManager.playSfx('select'); this.showEquipment(pi); });
      this.contentContainer.add(tabText);
    });

    const char = party[charIndex];
    if (!char) return;

    // Show equipped items with click-to-change
    slots.forEach((slot, si) => {
      const equipped = EquipmentSystem.getEquippedItems(char)[slot];
      const y = 100 + si * 34;

      const slotLabel = this.add.text(80, y, `${slotNames[slot]}：`, {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ccccdd',
        stroke: '#000000', strokeThickness: 2,
      });

      const itemLabel = this.add.text(170, y, equipped?.name ?? '— 空 —', {
        fontFamily: FONT_FAMILY, fontSize: '14px',
        color: equipped ? '#ffffff' : '#888888',
        stroke: '#000000', strokeThickness: 2,
      }).setInteractive({ useHandCursor: true });

      // Click to show equippable items for this slot
      itemLabel.on('pointerdown', () => {
        this.showEquipSlotPicker(charIndex, slot);
      });
      itemLabel.on('pointerover', () => itemLabel.setColor(COLORS.textHighlight));
      itemLabel.on('pointerout', () => itemLabel.setColor(equipped ? '#ffffff' : '#888888'));

      this.contentContainer.add([slotLabel, itemLabel]);
    });

    // Stats summary on the right
    const statsX = 500;
    this.contentContainer.add([
      this.add.text(statsX, 100, `Lv.${char.level}`, { fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight, stroke: '#000000', strokeThickness: 2 }),
      this.add.text(statsX, 126, `HP: ${char.stats.hp}/${char.stats.maxHP}`, { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 2 }),
      this.add.text(statsX, 148, `MP: ${char.stats.mp}/${char.stats.maxMP}`, { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 2 }),
      this.add.text(statsX, 174, `ATK: ${char.stats.atk}  DEF: ${char.stats.def}`, { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ccccdd', stroke: '#000000', strokeThickness: 1 }),
      this.add.text(statsX, 196, `AGI: ${char.stats.agi}  LCK: ${char.stats.luck}`, { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ccccdd', stroke: '#000000', strokeThickness: 1 }),
    ]);

    // Help hint
    this.contentContainer.add(
      this.add.text(80, 280, '點擊裝備欄位以更換裝備', {
        fontFamily: FONT_FAMILY, fontSize: '12px', color: '#999999',
        stroke: '#000000', strokeThickness: 1,
      })
    );
  }

  private showEquipSlotPicker(charIndex: number, slot: EquipmentSlot): void {
    this.clearContent();
    this.addBackButton();

    const party = gameState.getParty();
    const char = party[charIndex];
    if (!char) return;

    const slotNames: Record<string, string> = { weapon: '武器', helmet: '頭盔', armor: '鎧甲', shield: '盾牌', boots: '靴子' };

    this.contentContainer.add(
      this.add.text(80, 60, `${char.name} — ${slotNames[slot]}選擇`, {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textHighlight,
        stroke: '#000000', strokeThickness: 2,
      })
    );

    // Find equippable items in inventory for this slot
    const inventory = gameState.getInventory();
    const equippableItems: { id: string; name: string; stats: string }[] = [];

    for (const entry of inventory) {
      const equip = getEquipmentById(entry.itemId);
      if (equip && equip.slot === slot) {
        const statStr = Object.entries(equip.stats)
          .filter(([, v]) => (v as number) > 0)
          .map(([k, v]) => `${k}+${v}`)
          .join(' ');
        equippableItems.push({ id: equip.id, name: equip.name, stats: statStr });
      }
    }

    // "Unequip" option
    const currentEquipped = char.equipment[slot];
    if (currentEquipped) {
      const unequipText = this.add.text(100, 100, `卸下裝備`, {
        fontFamily: FONT_FAMILY, fontSize: '15px', color: '#ffaaaa',
        stroke: '#000000', strokeThickness: 2,
      }).setInteractive({ useHandCursor: true });
      unequipText.on('pointerdown', () => {
        EquipmentSystem.unequip(char, slot);
        audioManager.playSfx('equip');
        this.showEquipment(charIndex);
      });
      unequipText.on('pointerover', () => unequipText.setColor('#ff6666'));
      unequipText.on('pointerout', () => unequipText.setColor('#ffaaaa'));
      this.contentContainer.add(unequipText);
    }

    if (equippableItems.length === 0) {
      this.contentContainer.add(
        this.add.text(100, 140, '（背包中沒有可用的裝備）', {
          fontFamily: FONT_FAMILY, fontSize: '14px', color: '#999999',
          stroke: '#000000', strokeThickness: 1,
        })
      );
    } else {
      equippableItems.forEach((item, i) => {
        const y = 140 + i * 32;
        const diff = EquipmentSystem.getEquipmentComparison(char, item.id);
        const diffStr = Object.entries(diff)
          .filter(([, v]) => v !== 0)
          .map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`)
          .join(' ');

        const text = this.add.text(100, y, `${item.name}  ${item.stats}`, {
          fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ffffff',
          stroke: '#000000', strokeThickness: 2,
        }).setInteractive({ useHandCursor: true });

        if (diffStr) {
          this.contentContainer.add(
            this.add.text(500, y, diffStr, {
              fontFamily: FONT_FAMILY, fontSize: '13px',
              color: '#88ff88', stroke: '#000000', strokeThickness: 1,
            })
          );
        }

        text.on('pointerdown', () => {
          EquipmentSystem.equip(char, item.id);
          audioManager.playSfx('equip');
          this.showEquipment(charIndex);
        });
        text.on('pointerover', () => text.setColor(COLORS.textHighlight));
        text.on('pointerout', () => text.setColor('#ffffff'));
        this.contentContainer.add(text);
      });
    }

    // Override back button to return to equipment screen
    this.input.keyboard?.once('keydown-ESC', () => {
      audioManager.playSfx('cancel');
      this.showEquipment(charIndex);
    });
  }

  private showParty(): void {
    this.clearContent();
    this.currentTab = 'party';
    this.addBackButton();

    const party = gameState.getParty();
    party.forEach((char, i) => {
      const y = 80 + i * 130;
      this.contentContainer.add([
        this.add.text(100, y, `${char.name} (${char.race})`, { fontFamily: FONT_FAMILY, fontSize: '20px', color: COLORS.textHighlight }),
        this.add.text(100, y + 28, `Lv.${char.level}  HP: ${char.stats.hp}/${char.stats.maxHP}  MP: ${char.stats.mp}/${char.stats.maxMP}`, { fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textPrimary }),
        this.add.text(100, y + 50, `ATK: ${char.stats.atk}  DEF: ${char.stats.def}  AGI: ${char.stats.agi}  LCK: ${char.stats.luck}`, { fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textPrimary }),
        this.add.text(100, y + 72, `可分配點數: ${char.statPoints}`, { fontFamily: FONT_FAMILY, fontSize: '14px', color: char.statPoints > 0 ? COLORS.textHighlight : COLORS.textSecondary }),
        this.add.text(100, y + 92, `技能: ${char.skills.join(', ')}`, { fontFamily: FONT_FAMILY, fontSize: '12px', color: COLORS.textSecondary }),
      ]);
    });
  }

  private showSkills(): void {
    this.clearContent();
    this.currentTab = 'skills';
    this.addBackButton();

    const party = gameState.getParty();
    party.forEach((char, pi) => {
      const x = 80 + pi * 280;
      this.contentContainer.add(
        this.add.text(x, 70, char.name, { fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textHighlight })
      );

      const skills = SkillSystem.getUsableSkills(char);
      skills.forEach((skill, si) => {
        const y = 100 + si * 24;
        this.contentContainer.add(
          this.add.text(x, y, `${skill.name} (MP:${skill.mpCost}) — ${skill.description}`, {
            fontFamily: FONT_FAMILY, fontSize: '12px', color: COLORS.textPrimary,
          })
        );
      });
    });
  }

  private showSave(): void {
    this.clearContent();
    this.currentTab = 'save';
    this.addBackButton();

    for (let i = 0; i < 3; i++) {
      const info = SaveLoadSystem.getSaveInfo(i);
      const y = 100 + i * 80;
      const label = info.exists
        ? `${t('save.slot', i + 1)}  ${info.heroName} Lv.${info.level}  ${info.playTime}`
        : `${t('save.slot', i + 1)}  ${t('save.empty')}`;

      const text = this.add.text(GAME_WIDTH / 2, y, label, {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: info.exists ? COLORS.textPrimary : COLORS.textSecondary,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      text.on('pointerdown', () => {
        if (SaveLoadSystem.save(i)) {
          audioManager.playSfx('select');
          this.showSave(); // Refresh
        }
      });
      this.contentContainer.add(text);
    }
  }

  private showSystem(): void {
    this.clearContent();
    this.currentTab = 'system';
    this.addBackButton();

    const difficulty = gameState.getDifficulty();
    const difficulties = ['easy', 'normal', 'hard'] as const;
    const diffLabels = [t('system.easy'), t('system.normal'), t('system.hard')];

    this.contentContainer.add(
      this.add.text(GAME_WIDTH / 2, 100, t('system.difficulty'), {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textHighlight,
      }).setOrigin(0.5)
    );

    difficulties.forEach((d, i) => {
      const text = this.add.text(GAME_WIDTH / 2, 140 + i * 36, diffLabels[i], {
        fontFamily: FONT_FAMILY, fontSize: '16px',
        color: d === difficulty ? COLORS.textHighlight : COLORS.textPrimary,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      text.on('pointerdown', () => {
        gameState.setDifficulty(d);
        audioManager.playSfx('select');
        this.showSystem();
      });
      this.contentContainer.add(text);
    });

    // Volume
    this.contentContainer.add(
      this.add.text(GAME_WIDTH / 2, 280, `BGM 音量：${Math.round(audioManager.getBgmVolume() * 100)}%`, {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textPrimary,
      }).setOrigin(0.5)
    );

    // Return to title
    const returnBtn = this.add.text(GAME_WIDTH / 2, 400, t('system.return_title'), {
      fontFamily: FONT_FAMILY, fontSize: '18px', color: '#ff6666',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    returnBtn.on('pointerdown', () => {
      this.scene.stop();
      this.scene.stop(gameState.getState().currentScene);
      this.scene.start('TitleScene');
    });
    this.contentContainer.add(returnBtn);
  }

  private addBackButton(): Phaser.GameObjects.Text {
    const backBtn = this.add.text(80, GAME_HEIGHT - 60, `← ${t('menu.back')}`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight,
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => { audioManager.playSfx('cancel'); this.showMainMenu(); });
    this.contentContainer.add(backBtn);

    this.input.keyboard?.once('keydown-ESC', () => { audioManager.playSfx('cancel'); this.showMainMenu(); });
    return backBtn;
  }

  private closeMenu(): void {
    this.scene.resume(gameState.getState().currentScene);
    this.scene.stop();
  }
}
