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
import { ItemIconRenderer } from '../art/ui/ItemIconRenderer';

type MenuTab = 'main' | 'items' | 'equipment' | 'party' | 'skills' | 'save' | 'system';

// ─── Grid Item Page Constants ───
const GRID_CELL_W = 80;
const GRID_CELL_H = 90;
const GRID_COLS = 8;
const GRID_START_X = 80;
const GRID_START_Y = 80;
const GRID_GAP = 4;
const GRID_VISIBLE_ROWS = 6;
const GRID_AREA_H = GRID_VISIBLE_ROWS * (GRID_CELL_H + GRID_GAP);
const SCROLLBAR_W = 14;
const SCROLLBAR_X = GRID_START_X + GRID_COLS * (GRID_CELL_W + GRID_GAP) + 10;

export class MenuScene extends Phaser.Scene {
  private currentTab: MenuTab = 'main';
  private contentContainer!: Phaser.GameObjects.Container;
  private menuItems: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private descText!: Phaser.GameObjects.Text;

  // Grid items state
  private gridScrollRow = 0;
  private gridMaxScrollRow = 0;
  private gridSelectedCell = -1;
  private gridDragFrom = -1;
  private gridDragGhost?: Phaser.GameObjects.Image;

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

    // Description text (shows on hover/select)
    this.descText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 80, '', {
      fontFamily: FONT_FAMILY, fontSize: '13px', color: '#ccddee',
      stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: GAME_WIDTH - 160 }, align: 'center',
    }).setOrigin(0.5);

    this.showMainMenu();
  }

  private clearContent(): void {
    this.contentContainer.removeAll(true);
    this.menuItems = [];
    this.selectedIndex = 0;
    this.gridSelectedCell = -1;
    this.gridDragFrom = -1;
    this.gridDragGhost?.destroy();
    this.gridDragGhost = undefined;
    this.input.keyboard?.removeAllListeners();
    this.input.removeAllListeners();
    // Re-register M to close (always available)
    this.input.keyboard?.on('keydown-M', () => this.closeMenu());
    if (this.descText) this.descText.setText('');
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
      text.on('pointerdown', () => tab.action());
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
          this.add.image(x - 30, y + 20, portraitKey, 0).setScale(1.0)
        );
      }

      const statStyle = { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#eeeeff', stroke: '#000000', strokeThickness: 2 };
      const labelColor = '#aabbdd';
      this.contentContainer.add([
        this.add.text(x, y, char.name, { fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textHighlight, stroke: '#000000', strokeThickness: 2 }),
        this.add.text(x, y + 24, `Lv.${char.level}  HP:${char.stats.hp}/${char.stats.maxHP}  MP:${char.stats.mp}/${char.stats.maxMP}`, { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 2 }),
        this.add.text(x, y + 46, `${t('stat.atk')}:${char.stats.atk}  ${t('stat.def')}:${char.stats.def}  ${t('stat.agi')}:${char.stats.agi}  ${t('stat.luck')}:${char.stats.luck}`, { ...statStyle, color: labelColor }),
        this.add.text(x, y + 66, `${t('stat.exp')}: ${char.exp}/${LevelSystem.getExpToNextLevel(char)}  可分配點數: ${char.statPoints}`, { ...statStyle, color: char.statPoints > 0 ? COLORS.textHighlight : labelColor }),
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

    this.input.keyboard?.on('keydown-UP', () => { this.selectedIndex = (this.selectedIndex - 1 + tabs.length) % tabs.length; this.updateMenuDisplay(); audioManager.playSfx('select'); });
    this.input.keyboard?.on('keydown-DOWN', () => { this.selectedIndex = (this.selectedIndex + 1) % tabs.length; this.updateMenuDisplay(); audioManager.playSfx('select'); });
    this.input.keyboard?.on('keydown-ENTER', () => tabs[this.selectedIndex].action());
    this.input.keyboard?.on('keydown-SPACE', () => tabs[this.selectedIndex].action());
    this.input.keyboard?.on('keydown-ESC', () => this.closeMenu());
  }

  private updateMenuDisplay(): void {
    this.menuItems.forEach((text, i) => {
      const label = text.text.replace(/^[► ] /, '');
      text.setText(i === this.selectedIndex ? `► ${label}` : `  ${label}`);
      text.setColor(i === this.selectedIndex ? COLORS.textHighlight : COLORS.textPrimary);
    });
  }

  // ─────────────────────────────────────────────
  // Grid-based Item Page
  // ─────────────────────────────────────────────

  private showItems(): void {
    this.clearContent();
    this.currentTab = 'items';
    this.addBackButton();

    const allItems = InventorySystem.getAllItems();
    if (allItems.length === 0) {
      this.contentContainer.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '（沒有道具）', {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textSecondary,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5));
      return;
    }

    // Grid state
    this.gridScrollRow = 0;
    this.gridSelectedCell = 0;
    const totalRows = Math.ceil(allItems.length / GRID_COLS);
    this.gridMaxScrollRow = Math.max(0, totalRows - GRID_VISIBLE_ROWS);

    // Mask for grid area
    const maskGfx = this.add.graphics();
    maskGfx.fillRect(GRID_START_X - 2, GRID_START_Y - 2, GRID_COLS * (GRID_CELL_W + GRID_GAP) + 4, GRID_AREA_H + 4);
    const mask = maskGfx.createGeometryMask();
    this.contentContainer.add(maskGfx);

    // Grid container (scrollable)
    const gridContainer = this.add.container(0, 0);
    gridContainer.setMask(mask);
    this.contentContainer.add(gridContainer);

    // Render grid cells
    const cellBgs: Phaser.GameObjects.Rectangle[] = [];
    const cellIcons: Phaser.GameObjects.Image[] = [];
    const cellNames: Phaser.GameObjects.Text[] = [];
    const cellQtys: Phaser.GameObjects.Text[] = [];

    const renderGrid = () => {
      // Clear previous
      gridContainer.removeAll(true);
      cellBgs.length = 0;
      cellIcons.length = 0;
      cellNames.length = 0;
      cellQtys.length = 0;

      const startIdx = this.gridScrollRow * GRID_COLS;
      const endIdx = Math.min(allItems.length, startIdx + GRID_VISIBLE_ROWS * GRID_COLS);

      for (let idx = startIdx; idx < endIdx; idx++) {
        const entry = allItems[idx];
        const localIdx = idx - startIdx;
        const col = localIdx % GRID_COLS;
        const row = Math.floor(localIdx / GRID_COLS);
        const cx = GRID_START_X + col * (GRID_CELL_W + GRID_GAP);
        const cy = GRID_START_Y + row * (GRID_CELL_H + GRID_GAP);

        // Cell background
        const isSelected = idx === this.gridSelectedCell;
        const bgColor = isSelected ? 0x334466 : 0x1a1a2e;
        const borderColor = isSelected ? 0xffdd44 : 0x3a3a5e;
        const border = this.add.rectangle(cx + GRID_CELL_W / 2, cy + GRID_CELL_H / 2, GRID_CELL_W + 2, GRID_CELL_H + 2, borderColor);
        const bg = this.add.rectangle(cx + GRID_CELL_W / 2, cy + GRID_CELL_H / 2, GRID_CELL_W, GRID_CELL_H, bgColor, 0.9);
        gridContainer.add([border, bg]);
        cellBgs.push(bg);

        // Icon (centered at top of cell)
        const iconKey = ItemIconRenderer.getIconKey(entry.item.id);
        if (this.textures.exists(iconKey)) {
          const icon = this.add.image(cx + GRID_CELL_W / 2, cy + 32, iconKey);
          gridContainer.add(icon);
          cellIcons.push(icon);
        }

        // Quantity badge (top-right)
        if (entry.quantity > 1) {
          const qtyBg = this.add.rectangle(cx + GRID_CELL_W - 6, cy + 6, 22, 14, 0x000000, 0.7);
          const qty = this.add.text(cx + GRID_CELL_W - 6, cy + 6, `${entry.quantity}`, {
            fontFamily: FONT_FAMILY, fontSize: '10px', color: '#ffdd44',
            stroke: '#000000', strokeThickness: 1,
          }).setOrigin(0.5);
          gridContainer.add([qtyBg, qty]);
          cellQtys.push(qty);
        }

        // Item name (bottom of cell, 2 lines max)
        const name = this.add.text(cx + GRID_CELL_W / 2, cy + 66, entry.item.name, {
          fontFamily: FONT_FAMILY, fontSize: '12px', color: isSelected ? COLORS.textHighlight : '#eeeeff',
          stroke: '#000000', strokeThickness: 2,
          wordWrap: { width: GRID_CELL_W - 2 }, align: 'center',
          lineSpacing: -2,
        }).setOrigin(0.5, 0);
        gridContainer.add(name);
        cellNames.push(name);

        // Make cell interactive
        bg.setInteractive({ useHandCursor: true, draggable: true });
        bg.setData('itemIdx', idx);

        bg.on('pointerover', () => {
          this.gridSelectedCell = idx;
          this.descText?.setText(entry.item.description);
          renderGrid();
        });

        bg.on('pointerdown', () => {
          this.gridDragFrom = idx;
        });
      }

      // Update scrollbar thumb position
      updateScrollbar();
    };

    // ─── Scrollbar ───
    const scrollTrack = this.add.rectangle(SCROLLBAR_X + SCROLLBAR_W / 2, GRID_START_Y + GRID_AREA_H / 2, SCROLLBAR_W, GRID_AREA_H, 0x222233, 0.8);
    this.contentContainer.add(scrollTrack);

    const thumbH = totalRows <= GRID_VISIBLE_ROWS ? GRID_AREA_H : Math.max(30, GRID_AREA_H * (GRID_VISIBLE_ROWS / totalRows));
    const scrollThumb = this.add.rectangle(SCROLLBAR_X + SCROLLBAR_W / 2, GRID_START_Y + thumbH / 2, SCROLLBAR_W - 4, thumbH, 0x556688, 1);
    this.contentContainer.add(scrollThumb);
    scrollThumb.setInteractive({ useHandCursor: true, draggable: true });

    const updateScrollbar = () => {
      if (this.gridMaxScrollRow <= 0) {
        scrollThumb.setVisible(false);
        return;
      }
      scrollThumb.setVisible(true);
      const ratio = this.gridScrollRow / this.gridMaxScrollRow;
      const trackUsable = GRID_AREA_H - thumbH;
      scrollThumb.setY(GRID_START_Y + thumbH / 2 + ratio * trackUsable);
    };

    // Scrollbar drag
    this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, _dragX: number, dragY: number) => {
      if (gameObject === scrollThumb) {
        const trackUsable = GRID_AREA_H - thumbH;
        const relY = Phaser.Math.Clamp(dragY - GRID_START_Y - thumbH / 2, 0, trackUsable);
        const ratio = trackUsable > 0 ? relY / trackUsable : 0;
        this.gridScrollRow = Math.round(ratio * this.gridMaxScrollRow);
        renderGrid();
      }
    });

    // ─── Drag & Drop for items ───
    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      if (gameObject === scrollThumb) return;
      if (this.gridDragGhost) {
        this.gridDragGhost.destroy();
        this.gridDragGhost = undefined;
      }

      // Find what cell the pointer is over
      const ptr = this.input.activePointer;
      const col = Math.floor((ptr.x - GRID_START_X) / (GRID_CELL_W + GRID_GAP));
      const row = Math.floor((ptr.y - GRID_START_Y) / (GRID_CELL_H + GRID_GAP));
      if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_VISIBLE_ROWS) {
        this.gridDragFrom = -1;
        return;
      }
      const dropIdx = (this.gridScrollRow + row) * GRID_COLS + col;

      if (this.gridDragFrom >= 0 && dropIdx !== this.gridDragFrom && dropIdx < allItems.length) {
        // Swap items
        gameState.swapInventoryItems(this.gridDragFrom, dropIdx);
        // Re-fetch allItems (they reference the same array so order already changed)
        audioManager.playSfx('select');
        this.gridSelectedCell = dropIdx;
        renderGrid();
      }
      this.gridDragFrom = -1;
    });

    this.input.on('drag', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
      if (gameObject === scrollThumb) return;
      if (this.gridDragFrom >= 0 && this.gridDragFrom < allItems.length) {
        if (!this.gridDragGhost) {
          const entry = allItems[this.gridDragFrom];
          const iconKey = ItemIconRenderer.getIconKey(entry.item.id);
          if (this.textures.exists(iconKey)) {
            this.gridDragGhost = this.add.image(pointer.x, pointer.y, iconKey).setAlpha(0.7).setDepth(200);
          }
        }
        if (this.gridDragGhost) {
          this.gridDragGhost.setPosition(pointer.x, pointer.y);
        }
      }
    });

    // ─── Mouse Wheel Scroll ───
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: Phaser.GameObjects.GameObject[], _dx: number, deltaY: number) => {
      if (this.currentTab !== 'items') return;
      this.gridScrollRow += deltaY > 0 ? 1 : -1;
      this.gridScrollRow = Phaser.Math.Clamp(this.gridScrollRow, 0, this.gridMaxScrollRow);
      renderGrid();
    });

    // ─── Keyboard Navigation ───
    this.input.keyboard?.on('keydown-UP', () => {
      this.gridSelectedCell = Math.max(0, this.gridSelectedCell - GRID_COLS);
      this.ensureCellVisible();
      if (allItems[this.gridSelectedCell]) this.descText?.setText(allItems[this.gridSelectedCell].item.description);
      renderGrid();
      audioManager.playSfx('select');
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      this.gridSelectedCell = Math.min(allItems.length - 1, this.gridSelectedCell + GRID_COLS);
      this.ensureCellVisible();
      if (allItems[this.gridSelectedCell]) this.descText?.setText(allItems[this.gridSelectedCell].item.description);
      renderGrid();
      audioManager.playSfx('select');
    });
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.gridSelectedCell = Math.max(0, this.gridSelectedCell - 1);
      this.ensureCellVisible();
      if (allItems[this.gridSelectedCell]) this.descText?.setText(allItems[this.gridSelectedCell].item.description);
      renderGrid();
      audioManager.playSfx('select');
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.gridSelectedCell = Math.min(allItems.length - 1, this.gridSelectedCell + 1);
      this.ensureCellVisible();
      if (allItems[this.gridSelectedCell]) this.descText?.setText(allItems[this.gridSelectedCell].item.description);
      renderGrid();
      audioManager.playSfx('select');
    });

    // Initial render
    renderGrid();
    if (allItems.length > 0) this.descText?.setText(allItems[0].item.description);
  }

  /** Ensure the selected cell is visible by adjusting scroll */
  private ensureCellVisible(): void {
    const row = Math.floor(this.gridSelectedCell / GRID_COLS);
    if (row < this.gridScrollRow) {
      this.gridScrollRow = row;
    } else if (row >= this.gridScrollRow + GRID_VISIBLE_ROWS) {
      this.gridScrollRow = row - GRID_VISIBLE_ROWS + 1;
    }
    this.gridScrollRow = Phaser.Math.Clamp(this.gridScrollRow, 0, this.gridMaxScrollRow);
  }

  // ─────────────────────────────────────────────
  // Equipment Page (with icons)
  // ─────────────────────────────────────────────

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
      tabText.on('pointerdown', () => this.showEquipment(pi));
      this.contentContainer.add(tabText);
    });

    const char = party[charIndex];
    if (!char) return;

    // Show equipped items with icons and click-to-change
    const slotActions: (() => void)[] = [];
    slots.forEach((slot, si) => {
      const equipped = EquipmentSystem.getEquippedItems(char)[slot];
      const y = 100 + si * 40;

      // Equipment slot icon
      const slotIconKey = equipped ? ItemIconRenderer.getIconKey(equipped.id) : null;
      if (slotIconKey && this.textures.exists(slotIconKey)) {
        this.contentContainer.add(
          this.add.image(95, y + 12, slotIconKey).setScale(0.5)
        );
      }

      const slotLabel = this.add.text(115, y, `${slotNames[slot]}：`, {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ccccdd',
        stroke: '#000000', strokeThickness: 2,
      });

      const itemLabel = this.add.text(195, y, `  ${equipped?.name ?? '— 空 —'}`, {
        fontFamily: FONT_FAMILY, fontSize: '14px',
        color: equipped ? '#ffffff' : '#888888',
        stroke: '#000000', strokeThickness: 2,
      }).setInteractive({ useHandCursor: true });

      const openPicker = () => this.showEquipSlotPicker(charIndex, slot);
      slotActions.push(openPicker);
      itemLabel.on('pointerdown', openPicker);
      itemLabel.on('pointerover', () => {
        this.selectedIndex = si;
        this.updateMenuDisplay();
        this.descText?.setText(equipped?.description ?? '空欄位 — 可裝備');
      });

      this.menuItems.push(itemLabel);
      this.contentContainer.add([slotLabel, itemLabel]);
    });

    // Stats summary on the right
    const statsX = 500;
    const eqStatStyle = { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#eeeeff', stroke: '#000000', strokeThickness: 2 };
    this.contentContainer.add([
      this.add.text(statsX, 100, `Lv.${char.level}`, { fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight, stroke: '#000000', strokeThickness: 2 }),
      this.add.text(statsX, 126, `HP: ${char.stats.hp}/${char.stats.maxHP}`, { ...eqStatStyle, color: '#ffffff' }),
      this.add.text(statsX, 148, `MP: ${char.stats.mp}/${char.stats.maxMP}`, { ...eqStatStyle, color: '#ffffff' }),
      this.add.text(statsX, 174, `${t('stat.atk')}: ${char.stats.atk}  ${t('stat.def')}: ${char.stats.def}`, { ...eqStatStyle, color: '#aabbdd' }),
      this.add.text(statsX, 196, `${t('stat.agi')}: ${char.stats.agi}  ${t('stat.luck')}: ${char.stats.luck}`, { ...eqStatStyle, color: '#aabbdd' }),
    ]);

    this.updateMenuDisplay();

    this.input.keyboard?.on('keydown-UP', () => { this.selectedIndex = (this.selectedIndex - 1 + slots.length) % slots.length; this.updateMenuDisplay(); audioManager.playSfx('select'); });
    this.input.keyboard?.on('keydown-DOWN', () => { this.selectedIndex = (this.selectedIndex + 1) % slots.length; this.updateMenuDisplay(); audioManager.playSfx('select'); });
    this.input.keyboard?.on('keydown-ENTER', () => slotActions[this.selectedIndex]?.());
    this.input.keyboard?.on('keydown-SPACE', () => slotActions[this.selectedIndex]?.());
    this.input.keyboard?.on('keydown-LEFT', () => { if (charIndex > 0) this.showEquipment(charIndex - 1); });
    this.input.keyboard?.on('keydown-RIGHT', () => { if (charIndex < party.length - 1) this.showEquipment(charIndex + 1); });
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
        const y = 140 + i * 38;
        const diff = EquipmentSystem.getEquipmentComparison(char, item.id);
        const diffStr = Object.entries(diff)
          .filter(([, v]) => v !== 0)
          .map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`)
          .join(' ');

        // Equipment icon
        const iconKey = ItemIconRenderer.getIconKey(item.id);
        if (this.textures.exists(iconKey)) {
          this.contentContainer.add(
            this.add.image(112, y + 10, iconKey).setScale(0.5)
          );
        }

        const text = this.add.text(135, y, `${item.name}  ${item.stats}`, {
          fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ffffff',
          stroke: '#000000', strokeThickness: 2,
        }).setInteractive({ useHandCursor: true });

        if (diffStr) {
          this.contentContainer.add(
            this.add.text(520, y, diffStr, {
              fontFamily: FONT_FAMILY, fontSize: '13px',
              color: '#88ff88', stroke: '#000000', strokeThickness: 1,
            })
          );
        }

        text.on('pointerdown', () => {
          EquipmentSystem.equip(char, item.id);
          this.showEquipment(charIndex);
        });
        text.on('pointerover', () => text.setColor(COLORS.textHighlight));
        text.on('pointerout', () => text.setColor('#ffffff'));
        this.contentContainer.add(text);
      });
    }

    // Keyboard navigation for equip slot picker
    const allSelectables = [...(currentEquipped ? [() => { EquipmentSystem.unequip(char, slot); this.showEquipment(charIndex); }] : []),
      ...equippableItems.map((item) => () => { EquipmentSystem.equip(char, item.id); this.showEquipment(charIndex); })];

    if (allSelectables.length > 0) {
      this.input.keyboard?.on('keydown-UP', () => { this.selectedIndex = (this.selectedIndex - 1 + allSelectables.length) % allSelectables.length; audioManager.playSfx('select'); });
      this.input.keyboard?.on('keydown-DOWN', () => { this.selectedIndex = (this.selectedIndex + 1) % allSelectables.length; audioManager.playSfx('select'); });
      this.input.keyboard?.on('keydown-ENTER', () => allSelectables[this.selectedIndex]?.());
      this.input.keyboard?.on('keydown-SPACE', () => allSelectables[this.selectedIndex]?.());
    }

    // ESC returns to equipment screen
    this.input.keyboard?.on('keydown-ESC', () => this.showEquipment(charIndex));
  }

  // ─────────────────────────────────────────────
  // Party Page
  // ─────────────────────────────────────────────

  private showParty(): void {
    this.clearContent();
    this.currentTab = 'party';
    this.addBackButton();

    const party = gameState.getParty();
    party.forEach((char, i) => {
      const y = 80 + i * 130;
      const partyStatStyle = { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#eeeeff', stroke: '#000000', strokeThickness: 2 };

      // Selectable name row for arrow-key navigation
      const nameText = this.add.text(100, y, `  ${char.name} (${char.race})`, {
        fontFamily: FONT_FAMILY, fontSize: '20px', color: COLORS.textHighlight,
        stroke: '#000000', strokeThickness: 2,
      }).setInteractive({ useHandCursor: true });

      const desc = `Lv.${char.level}  HP:${char.stats.hp}/${char.stats.maxHP}  MP:${char.stats.mp}/${char.stats.maxMP}  ${t('stat.atk')}:${char.stats.atk}  ${t('stat.def')}:${char.stats.def}  技能:${char.skills.join(', ')}`;
      nameText.on('pointerover', () => { this.selectedIndex = i; this.updateMenuDisplay(); this.descText?.setText(desc); });
      this.menuItems.push(nameText);

      this.contentContainer.add([
        nameText,
        this.add.text(100, y + 28, `Lv.${char.level}  HP: ${char.stats.hp}/${char.stats.maxHP}  MP: ${char.stats.mp}/${char.stats.maxMP}`, { ...partyStatStyle, color: '#ffffff' }),
        this.add.text(100, y + 50, `${t('stat.atk')}: ${char.stats.atk}  ${t('stat.def')}: ${char.stats.def}  ${t('stat.agi')}: ${char.stats.agi}  ${t('stat.luck')}: ${char.stats.luck}`, { ...partyStatStyle, color: '#aabbdd' }),
        this.add.text(100, y + 72, `可分配點數: ${char.statPoints}`, { ...partyStatStyle, color: char.statPoints > 0 ? COLORS.textHighlight : '#aabbdd' }),
        this.add.text(100, y + 92, `技能: ${char.skills.join(', ')}`, { fontFamily: FONT_FAMILY, fontSize: '12px', color: COLORS.textSecondary, stroke: '#000000', strokeThickness: 1 }),
      ]);
    });

    this.updateMenuDisplay();
    if (party.length > 0) {
      const c = party[0];
      this.descText?.setText(`Lv.${c.level}  HP:${c.stats.hp}/${c.stats.maxHP}  MP:${c.stats.mp}/${c.stats.maxMP}  ${t('stat.atk')}:${c.stats.atk}  ${t('stat.def')}:${c.stats.def}  技能:${c.skills.join(', ')}`);
    }

    this.input.keyboard?.on('keydown-UP', () => {
      this.selectedIndex = (this.selectedIndex - 1 + party.length) % party.length;
      this.updateMenuDisplay();
      const c = party[this.selectedIndex];
      this.descText?.setText(`Lv.${c.level}  HP:${c.stats.hp}/${c.stats.maxHP}  MP:${c.stats.mp}/${c.stats.maxMP}  ${t('stat.atk')}:${c.stats.atk}  ${t('stat.def')}:${c.stats.def}  技能:${c.skills.join(', ')}`);
      audioManager.playSfx('select');
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      this.selectedIndex = (this.selectedIndex + 1) % party.length;
      this.updateMenuDisplay();
      const c = party[this.selectedIndex];
      this.descText?.setText(`Lv.${c.level}  HP:${c.stats.hp}/${c.stats.maxHP}  MP:${c.stats.mp}/${c.stats.maxMP}  ${t('stat.atk')}:${c.stats.atk}  ${t('stat.def')}:${c.stats.def}  技能:${c.skills.join(', ')}`);
      audioManager.playSfx('select');
    });
  }

  // ─────────────────────────────────────────────
  // Skills Page (with icons)
  // ─────────────────────────────────────────────

  private showSkills(): void {
    this.clearContent();
    this.currentTab = 'skills';
    this.addBackButton();

    const party = gameState.getParty();
    // Flatten all skills with character reference for arrow-key navigation
    const allSkillEntries: { charName: string; skill: ReturnType<typeof SkillSystem.getUsableSkills>[0] }[] = [];

    party.forEach((char, pi) => {
      const x = 80 + pi * 280;
      this.contentContainer.add(
        this.add.text(x, 70, char.name, { fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textHighlight, stroke: '#000000', strokeThickness: 2 })
      );

      const skills = SkillSystem.getUsableSkills(char);
      skills.forEach((skill, si) => {
        const y = 100 + si * 30;

        // Skill icon
        const iconKey = ItemIconRenderer.getSkillIconKey(skill.element, skill.type);
        if (this.textures.exists(iconKey)) {
          this.contentContainer.add(
            this.add.image(x + 10, y + 9, iconKey).setScale(0.35)
          );
        }

        const text = this.add.text(x + 28, y, `${skill.name} (MP:${skill.mpCost})`, {
          fontFamily: FONT_FAMILY, fontSize: '13px', color: COLORS.textPrimary,
          stroke: '#000000', strokeThickness: 1,
        }).setInteractive({ useHandCursor: true });
        const idx = allSkillEntries.length;
        text.on('pointerover', () => { this.selectedIndex = idx; this.updateMenuDisplay(); this.descText?.setText(`${skill.description}  [${skill.element}屬性]  威力:${skill.power}`); });
        this.menuItems.push(text);
        this.contentContainer.add(text);
        allSkillEntries.push({ charName: char.name, skill });
      });
    });

    this.updateMenuDisplay();
    if (allSkillEntries.length > 0) this.descText?.setText(allSkillEntries[0].skill.description);

    this.input.keyboard?.on('keydown-UP', () => {
      this.selectedIndex = (this.selectedIndex - 1 + allSkillEntries.length) % allSkillEntries.length;
      this.updateMenuDisplay();
      this.descText?.setText(`${allSkillEntries[this.selectedIndex].skill.description}  [${allSkillEntries[this.selectedIndex].skill.element}屬性]  威力:${allSkillEntries[this.selectedIndex].skill.power}`);
      audioManager.playSfx('select');
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      this.selectedIndex = (this.selectedIndex + 1) % allSkillEntries.length;
      this.updateMenuDisplay();
      this.descText?.setText(`${allSkillEntries[this.selectedIndex].skill.description}  [${allSkillEntries[this.selectedIndex].skill.element}屬性]  威力:${allSkillEntries[this.selectedIndex].skill.power}`);
      audioManager.playSfx('select');
    });
  }

  // ─────────────────────────────────────────────
  // Save Page
  // ─────────────────────────────────────────────

  private showSave(): void {
    this.clearContent();
    this.currentTab = 'save';
    this.addBackButton();

    // Title
    this.contentContainer.add(
      this.add.text(GAME_WIDTH / 2, 70, '存檔', {
        fontFamily: FONT_FAMILY, fontSize: '20px', color: COLORS.textHighlight,
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5)
    );

    // Save slots for current hero
    const saveItems: { label: string; action: () => void }[] = [];
    for (let i = 0; i < 3; i++) {
      const info = SaveLoadSystem.getSaveInfo(i);
      const completedMark = info.gameCompleted ? ' ★通關' : '';
      const label = info.exists
        ? `${t('save.slot', i + 1)}  ${info.heroName} Lv.${info.level}  ${info.playTime}${completedMark}`
        : `${t('save.slot', i + 1)}  ${t('save.empty')}`;
      const slot = i;
      saveItems.push({ label, action: () => { if (SaveLoadSystem.save(slot)) this.showSave(); } });
    }

    saveItems.forEach((item, i) => {
      const y = 110 + i * 44;
      const text = this.add.text(GAME_WIDTH / 2, y, `  ${item.label}`, {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      text.on('pointerover', () => { this.selectedIndex = i; this.updateMenuDisplay(); });
      text.on('pointerdown', () => item.action());
      this.menuItems.push(text);
      this.contentContainer.add(text);
    });

    // Divider — show all saves across all heroes for reference
    const allSaves = SaveLoadSystem.getAllSaves();
    if (allSaves.length > 0) {
      allSaves.sort((a, b) => b.timestamp - a.timestamp);
      this.contentContainer.add(
        this.add.text(GAME_WIDTH / 2, 260, '── 所有存檔記錄 ──', {
          fontFamily: FONT_FAMILY, fontSize: '14px', color: '#aabbcc',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5)
      );
      const maxShow = Math.min(allSaves.length, 6);
      for (let i = 0; i < maxShow; i++) {
        const s = allSaves[i];
        const slotLabel = s.slot === -1 ? '自動' : `${s.slot + 1}`;
        this.contentContainer.add(
          this.add.text(GAME_WIDTH / 2, 290 + i * 26, `${s.heroName} [${slotLabel}]  Lv.${s.level}  ${s.playTime}${s.gameCompleted ? ' ★通關' : ''}`, {
            fontFamily: FONT_FAMILY, fontSize: '13px', color: '#bbbbdd',
            stroke: '#000000', strokeThickness: 2,
          }).setOrigin(0.5)
        );
      }
    }

    this.updateMenuDisplay();

    this.input.keyboard?.on('keydown-UP', () => { this.selectedIndex = (this.selectedIndex - 1 + saveItems.length) % saveItems.length; this.updateMenuDisplay(); audioManager.playSfx('select'); });
    this.input.keyboard?.on('keydown-DOWN', () => { this.selectedIndex = (this.selectedIndex + 1) % saveItems.length; this.updateMenuDisplay(); audioManager.playSfx('select'); });
    this.input.keyboard?.on('keydown-ENTER', () => saveItems[this.selectedIndex]?.action());
    this.input.keyboard?.on('keydown-SPACE', () => saveItems[this.selectedIndex]?.action());
  }

  // ─────────────────────────────────────────────
  // System Page
  // ─────────────────────────────────────────────

  private showSystem(): void {
    this.clearContent();
    this.currentTab = 'system';
    this.addBackButton();

    const difficulty = gameState.getDifficulty();
    const difficulties = ['easy', 'normal', 'hard'] as const;
    const diffLabels = [t('system.easy'), t('system.normal'), t('system.hard')];
    const diffDescs = ['戰鬥傷害降低，經驗值增加', '標準遊戲難度', '戰鬥傷害增加，經驗值減少'];

    this.contentContainer.add(
      this.add.text(GAME_WIDTH / 2, 80, t('system.difficulty'), {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textHighlight,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5)
    );

    // Selectable system items: 3 difficulties + BGM vol + SFX vol + return to title
    type SystemAction = { label: string; desc: string; action: () => void };
    const systemItems: SystemAction[] = [];

    difficulties.forEach((d, i) => {
      const isActive = d === difficulty;
      const label = isActive ? `● ${diffLabels[i]}` : `  ${diffLabels[i]}`;
      systemItems.push({ label, desc: diffDescs[i], action: () => { gameState.setDifficulty(d); this.showSystem(); } });
    });

    // Volume items
    const bgmVol = Math.round(audioManager.getBgmVolume() * 100);
    const sfxVol = Math.round(audioManager.getSfxVolume() * 100);
    systemItems.push({
      label: `  ${t('system.bgm_volume')}: ${audioManager.isBgmMuted() ? '靜音' : bgmVol + '%'}`,
      desc: '← → 調整音量，SPACE 靜音切換',
      action: () => { audioManager.toggleBgmMute(); this.showSystem(); },
    });
    systemItems.push({
      label: `  ${t('system.sfx_volume')}: ${audioManager.isSfxMuted() ? '靜音' : sfxVol + '%'}`,
      desc: '← → 調整音量，SPACE 靜音切換',
      action: () => { audioManager.toggleSfxMute(); this.showSystem(); },
    });
    systemItems.push({
      label: `  ${t('system.return_title')}`,
      desc: '回到標題畫面（未存檔的進度將會遺失）',
      action: () => { this.scene.stop(); this.scene.stop(gameState.getState().currentScene); this.scene.start('TitleScene'); },
    });

    systemItems.forEach((item, i) => {
      const y = i < 3 ? 110 + i * 32 : (i === 3 ? 230 : i === 4 ? 270 : 340);
      const color = i >= 3 && i <= 4 ? '#ccddee' : (i === 5 ? '#ff6666' : COLORS.textPrimary);
      const text = this.add.text(GAME_WIDTH / 2, y, item.label, {
        fontFamily: FONT_FAMILY, fontSize: '16px', color,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      text.on('pointerover', () => { this.selectedIndex = i; this.updateMenuDisplay(); this.descText?.setText(item.desc); });
      text.on('pointerdown', () => item.action());
      this.menuItems.push(text);
      this.contentContainer.add(text);
    });

    this.updateMenuDisplay();
    this.descText?.setText(systemItems[0].desc);

    this.input.keyboard?.on('keydown-UP', () => {
      this.selectedIndex = (this.selectedIndex - 1 + systemItems.length) % systemItems.length;
      this.updateMenuDisplay();
      this.descText?.setText(systemItems[this.selectedIndex].desc);
      audioManager.playSfx('select');
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      this.selectedIndex = (this.selectedIndex + 1) % systemItems.length;
      this.updateMenuDisplay();
      this.descText?.setText(systemItems[this.selectedIndex].desc);
      audioManager.playSfx('select');
    });
    this.input.keyboard?.on('keydown-ENTER', () => systemItems[this.selectedIndex]?.action());
    this.input.keyboard?.on('keydown-SPACE', () => systemItems[this.selectedIndex]?.action());
    // LEFT/RIGHT to adjust volume when on volume rows
    this.input.keyboard?.on('keydown-LEFT', () => {
      if (this.selectedIndex === 3 && !audioManager.isBgmMuted()) {
        audioManager.setBgmVolume(Math.max(0, audioManager.getBgmVolume() - 0.1));
        this.showSystem();
      } else if (this.selectedIndex === 4 && !audioManager.isSfxMuted()) {
        audioManager.setSfxVolume(Math.max(0, audioManager.getSfxVolume() - 0.1));
        this.showSystem();
      }
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      if (this.selectedIndex === 3 && !audioManager.isBgmMuted()) {
        audioManager.setBgmVolume(Math.min(1, audioManager.getBgmVolume() + 0.1));
        this.showSystem();
      } else if (this.selectedIndex === 4 && !audioManager.isSfxMuted()) {
        audioManager.setSfxVolume(Math.min(1, audioManager.getSfxVolume() + 0.1));
        this.showSystem();
      }
    });
  }

  // ─────────────────────────────────────────────
  // Shared
  // ─────────────────────────────────────────────

  private addBackButton(): Phaser.GameObjects.Text {
    const backBtn = this.add.text(80, GAME_HEIGHT - 60, `← ${t('menu.back')} (ESC)`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight,
      stroke: '#000000', strokeThickness: 2,
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.showMainMenu());
    this.contentContainer.add(backBtn);

    // ESC goes back to main menu (not close)
    this.input.keyboard?.on('keydown-ESC', () => this.showMainMenu());
    return backBtn;
  }

  private closeMenu(): void {
    this.scene.resume(gameState.getState().currentScene);
    this.scene.stop();
  }
}
