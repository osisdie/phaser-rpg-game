import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { getRegionById } from '../data/regions/index';
import { getItemById, getEquipmentById } from '../data/items/index';
import { InventorySystem } from '../systems/InventorySystem';
import { audioManager } from '../systems/AudioManager';
import { ItemIconRenderer } from '../art/ui/ItemIconRenderer';

export class ShopScene extends Phaser.Scene {
  private regionId = '';
  private mode: 'buy' | 'sell' = 'buy';
  private itemTexts: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private pendingConfirmIndex = -1;

  // Store references for ESC handler
  private currentShopData: { id: string; name: string; price: number; desc: string }[] = [];
  private currentSellItems: { item: { id: string; name: string; sellPrice: number }; quantity: number }[] = [];
  private descText?: Phaser.GameObjects.Text;

  constructor() {
    super('ShopScene');
  }

  create(data: { regionId: string; mode: 'buy' | 'sell' }): void {
    this.regionId = data.regionId;
    this.mode = data.mode;
    this.itemTexts = [];
    this.selectedIndex = 0;
    this.pendingConfirmIndex = -1;

    // Overlay
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);

    // Panel — use medieval panel texture if available
    const panelW = GAME_WIDTH - 120;
    const panelH = GAME_HEIGHT - 80;
    if (this.textures.exists('ui_panel_menu')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_panel_menu');
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, panelW + 4, panelH + 4, COLORS.panelBorder);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, panelW, panelH, COLORS.panel, 0.98);
    }

    // Title
    this.add.text(GAME_WIDTH / 2, 60, this.mode === 'buy' ? t('shop.buy') : t('shop.sell'), {
      fontFamily: FONT_FAMILY, fontSize: '22px', color: COLORS.textHighlight,
    }).setOrigin(0.5);

    // Gold display with coin icon
    const goldX = GAME_WIDTH - 120;
    if (this.textures.exists('icon_coin')) {
      this.add.image(goldX - 90, 60, 'icon_coin');
    }
    const goldText = this.add.text(goldX, 60, t('shop.gold', gameState.getGold()), {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textHighlight,
    }).setOrigin(1, 0.5);

    if (this.mode === 'buy') {
      this.showBuyList(goldText);
    } else {
      this.showSellList(goldText);
    }

    // Item description area
    this.descText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 85, '', {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ccddee',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    // Close hint
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, `ESC 關閉  |  ↑↓ 選擇  |  Enter/Z/Space 確認（按兩次）`, {
      fontFamily: FONT_FAMILY, fontSize: '13px', color: '#999999',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.pendingConfirmIndex >= 0) {
        this.pendingConfirmIndex = -1;
        if (this.mode === 'buy') this.updateShopHighlight(this.currentShopData);
        else this.updateSellHighlight(this.currentSellItems);
        audioManager.playSfx('cancel');
      } else {
        audioManager.playSfx('cancel');
        this.closeShop();
      }
    });
  }

  private showBuyList(goldText: Phaser.GameObjects.Text): void {
    const region = getRegionById(this.regionId);
    if (!region) return;

    // Build item data array (filter valid items)
    const shopData: { id: string; name: string; price: number; desc: string }[] = [];
    for (const itemId of region.shopItems) {
      const item = getItemById(itemId);
      const equip = getEquipmentById(itemId);
      if (!item && !equip) continue;
      shopData.push({
        id: itemId,
        name: item?.name ?? equip?.name ?? '',
        price: item?.price ?? equip?.price ?? 0,
        desc: item?.description ?? equip?.description ?? '',
      });
    }
    this.currentShopData = shopData;

    this.itemTexts = [];
    shopData.forEach((entry, i) => {
      const y = 100 + i * 36;
      if (y > GAME_HEIGHT - 90) return;

      // Item icon
      const iconKey = ItemIconRenderer.getIconKey(entry.id);
      if (this.textures.exists(iconKey)) {
        const icon = this.add.image(85, y + 10, iconKey).setScale(0.5);
        if (gameState.getGold() < entry.price) icon.setAlpha(0.4);
      }

      const canAfford = gameState.getGold() >= entry.price;
      const text = this.add.text(108, y, `  ${entry.name}  ${entry.price}G  — ${entry.desc}`, {
        fontFamily: FONT_FAMILY, fontSize: '14px',
        color: canAfford ? '#ffffff' : '#666666',
        stroke: '#000000', strokeThickness: 2,
        wordWrap: { width: GAME_WIDTH - 260 },
      }).setInteractive({ useHandCursor: canAfford });

      text.on('pointerdown', () => this.doBuy(i, shopData, goldText));
      text.on('pointerover', () => { this.pendingConfirmIndex = -1; this.selectedIndex = i; this.updateShopHighlight(shopData); });
      this.itemTexts.push(text);
    });

    this.updateShopHighlight(shopData);

    // Keyboard navigation
    this.input.keyboard?.on('keydown-UP', () => {
      if (this.itemTexts.length === 0) return;
      this.pendingConfirmIndex = -1;
      this.selectedIndex = (this.selectedIndex - 1 + this.itemTexts.length) % this.itemTexts.length;
      this.updateShopHighlight(shopData);
      audioManager.playSfx('select');
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      if (this.itemTexts.length === 0) return;
      this.pendingConfirmIndex = -1;
      this.selectedIndex = (this.selectedIndex + 1) % this.itemTexts.length;
      this.updateShopHighlight(shopData);
      audioManager.playSfx('select');
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.doBuy(this.selectedIndex, shopData, goldText));
    this.input.keyboard?.on('keydown-Z', () => this.doBuy(this.selectedIndex, shopData, goldText));
    this.input.keyboard?.on('keydown-SPACE', () => this.doBuy(this.selectedIndex, shopData, goldText));
  }

  private doBuy(index: number, shopData: { id: string; name: string; price: number; desc: string }[], goldText: Phaser.GameObjects.Text): void {
    const entry = shopData[index];
    if (!entry) return;
    if (gameState.getGold() < entry.price) {
      audioManager.playSfx('fail');
      return;
    }

    if (this.pendingConfirmIndex === index) {
      // Second press — confirmed, execute purchase
      this.pendingConfirmIndex = -1;
      if (InventorySystem.buyItem(entry.id, entry.price)) {
        audioManager.playSfx('equip');
        goldText.setText(t('shop.gold', gameState.getGold()));
        // Update all items affordability
        shopData.forEach((d, i) => {
          if (this.itemTexts[i]) {
            const canAfford = gameState.getGold() >= d.price;
            const isSelected = i === this.selectedIndex;
            this.itemTexts[i].setColor(canAfford ? (isSelected ? COLORS.textHighlight : '#ffffff') : '#666666');
          }
        });
      }
      this.updateShopHighlight(shopData);
    } else {
      // First press — show confirmation prompt
      this.pendingConfirmIndex = index;
      this.updateShopHighlight(shopData);
    }
  }

  private showSellList(goldText: Phaser.GameObjects.Text): void {
    const items = InventorySystem.getAllItems();
    this.currentSellItems = items;

    if (items.length === 0) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '（沒有可出售的道具）', {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textSecondary,
      }).setOrigin(0.5);
      return;
    }

    this.itemTexts = [];
    items.forEach((entry, i) => {
      const y = 100 + i * 36;
      if (y > GAME_HEIGHT - 90) return;

      // Item icon
      const iconKey = ItemIconRenderer.getIconKey(entry.item.id);
      if (this.textures.exists(iconKey)) {
        this.add.image(85, y + 10, iconKey).setScale(0.5);
      }

      const text = this.add.text(108, y, `  ${entry.item.name} ×${entry.quantity}  賣出: ${entry.item.sellPrice} 金幣`, {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setInteractive({ useHandCursor: true });

      text.on('pointerdown', () => this.doSell(i, items, goldText));
      text.on('pointerover', () => { this.pendingConfirmIndex = -1; this.selectedIndex = i; this.updateSellHighlight(items); });
      this.itemTexts.push(text);
    });

    this.updateSellHighlight(items);

    // Keyboard navigation
    this.input.keyboard?.on('keydown-UP', () => {
      if (this.itemTexts.length === 0) return;
      this.pendingConfirmIndex = -1;
      this.selectedIndex = (this.selectedIndex - 1 + this.itemTexts.length) % this.itemTexts.length;
      this.updateSellHighlight(items);
      audioManager.playSfx('select');
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      if (this.itemTexts.length === 0) return;
      this.pendingConfirmIndex = -1;
      this.selectedIndex = (this.selectedIndex + 1) % this.itemTexts.length;
      this.updateSellHighlight(items);
      audioManager.playSfx('select');
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.doSell(this.selectedIndex, items, goldText));
    this.input.keyboard?.on('keydown-Z', () => this.doSell(this.selectedIndex, items, goldText));
    this.input.keyboard?.on('keydown-SPACE', () => this.doSell(this.selectedIndex, items, goldText));
  }

  private doSell(index: number, items: { item: { id: string; name: string; sellPrice: number }; quantity: number }[], goldText: Phaser.GameObjects.Text): void {
    const entry = items[index];
    if (!entry || entry.quantity <= 0) return;

    if (this.pendingConfirmIndex === index) {
      // Second press — confirmed, execute sale
      this.pendingConfirmIndex = -1;
      if (InventorySystem.sellItem(entry.item.id)) {
        audioManager.playSfx('equip');
        goldText.setText(t('shop.gold', gameState.getGold()));
        entry.quantity--;
        if (entry.quantity <= 0) {
          this.itemTexts[index]?.setVisible(false);
        } else {
          this.itemTexts[index]?.setText(`  ${entry.item.name} ×${entry.quantity}  賣出: ${entry.item.sellPrice} 金幣`);
        }
      }
      this.updateSellHighlight(items);
    } else {
      // First press — show confirmation prompt
      this.pendingConfirmIndex = index;
      this.updateSellHighlight(items);
    }
  }

  private updateShopHighlight(shopData: { id: string; price: number; desc?: string; name?: string }[]): void {
    this.itemTexts.forEach((text, i) => {
      const raw = text.text.replace(/^[► ] /, '').replace(/  ← 確定\?$/, '');
      const canAfford = gameState.getGold() >= (shopData[i]?.price ?? Infinity);
      if (i === this.pendingConfirmIndex) {
        text.setText(`► ${raw}  ← 確定?`);
        text.setColor('#ffff44');
      } else if (i === this.selectedIndex) {
        text.setText(`► ${raw}`);
        text.setColor(COLORS.textHighlight);
      } else {
        text.setText(`  ${raw}`);
        text.setColor(canAfford ? '#ffffff' : '#666666');
      }
    });
    // Update description panel
    const sel = shopData[this.selectedIndex];
    if (this.descText && sel) {
      this.descText.setText(sel.desc ? `${sel.name ?? ''} — ${sel.desc}` : '');
    }
  }

  private updateSellHighlight(items: { item: { name: string; sellPrice: number }; quantity: number }[]): void {
    this.itemTexts.forEach((text, i) => {
      if (!items[i] || items[i].quantity <= 0) return;
      if (i === this.pendingConfirmIndex) {
        text.setText(`► ${items[i].item.name} ×${items[i].quantity}  賣出: ${items[i].item.sellPrice} 金幣  ← 確定?`);
        text.setColor('#ffff44');
      } else {
        const isSelected = i === this.selectedIndex;
        text.setText(`${isSelected ? '► ' : '  '}${items[i].item.name} ×${items[i].quantity}  賣出: ${items[i].item.sellPrice} 金幣`);
        text.setColor(isSelected ? COLORS.textHighlight : COLORS.textPrimary);
      }
    });
  }

  private closeShop(): void {
    const parentScene = gameState.getState().currentScene;
    this.scene.resume(parentScene);
    this.scene.stop();
  }
}
