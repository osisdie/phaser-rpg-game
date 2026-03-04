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
  private currentSellItems: { item: { id: string; name: string; sellPrice: number; description?: string }; quantity: number }[] = [];
  private sellItemIcons: (Phaser.GameObjects.Image | null)[] = [];
  private goldText?: Phaser.GameObjects.Text;
  private descText?: Phaser.GameObjects.Text;
  private closing = false;

  constructor() {
    super('ShopScene');
  }

  create(data: { regionId: string; mode: 'buy' | 'sell' }): void {
    this.regionId = data.regionId;
    this.mode = data.mode;
    this.itemTexts = [];
    this.sellItemIcons = [];
    this.selectedIndex = 0;
    this.pendingConfirmIndex = -1;
    this.closing = false;

    // Register ESC handler FIRST — must always be available even if list setup fails
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

    // Right-click to cancel pending confirm
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() && this.pendingConfirmIndex >= 0) {
        this.pendingConfirmIndex = -1;
        if (this.mode === 'buy') this.updateShopHighlight(this.currentShopData);
        else this.updateSellHighlight(this.currentSellItems);
        audioManager.playSfx('cancel');
      }
    });

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

    // Gold display with stacked coin icon
    const goldX = GAME_WIDTH - 120;
    const goldIconKey = this.textures.exists('icon_gold_stack') ? 'icon_gold_stack' : 'icon_coin';
    if (this.textures.exists(goldIconKey)) {
      this.add.image(goldX - 60, 60, goldIconKey);
    }
    const goldText = this.add.text(goldX, 60, gameState.getGold().toLocaleString(), {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textHighlight,
    }).setOrigin(1, 0.5);
    this.goldText = goldText;

    // Item description area (create before list so descText is available)
    this.descText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 85, '', {
      fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ccddee',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    if (this.mode === 'buy') {
      this.showBuyList(goldText);
    } else {
      this.showSellList(goldText);
    }

    // Close hint
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, `ESC 關閉  |  ↑↓ 選擇  |  確認鍵×2購買  |  點擊×2 / 右鍵取消`, {
      fontFamily: FONT_FAMILY, fontSize: '13px', color: '#999999',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
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
      const y = 100 + i * 72;
      if (y > GAME_HEIGHT - 100) return;

      // Item icon (full size to match inventory)
      const iconKey = ItemIconRenderer.getIconKey(entry.id);
      if (this.textures.exists(iconKey)) {
        const icon = this.add.image(100, y + 28, iconKey);
        if (gameState.getGold() < entry.price) icon.setAlpha(0.4);
      }

      const canAfford = gameState.getGold() >= entry.price;
      const text = this.add.text(140, y + 16, `  ${entry.name}  ${entry.price}G  — ${entry.desc}`, {
        fontFamily: FONT_FAMILY, fontSize: '14px',
        color: canAfford ? '#ffffff' : '#666666',
        stroke: '#000000', strokeThickness: 2,
        wordWrap: { width: GAME_WIDTH - 260 },
      }).setInteractive({ useHandCursor: canAfford });

      text.on('pointerdown', () => this.doBuy(i, shopData, goldText));
      text.on('pointerover', () => { this.pendingConfirmIndex = -1; this.selectedIndex = i; this.updateShopHighlight(shopData); });
      this.itemTexts.push(text);
    });

    // Defer initial highlight to next tick — Text canvas may not be ready during scene boot
    this.time.delayedCall(0, () => this.updateShopHighlight(shopData));

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
        goldText.setText(gameState.getGold().toLocaleString());
        // Gold change animation — scale pulse
        this.tweens.getTweensOf(goldText).forEach(tw => tw.stop());
        goldText.setScale(1);
        this.tweens.add({
          targets: goldText, scale: { from: 1.0, to: 1.2 },
          duration: 150, yoyo: true, ease: 'Sine.easeOut',
        });
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
    this.sellItemIcons = [];
    items.forEach((entry, i) => {
      const y = 100 + i * 72;
      if (y > GAME_HEIGHT - 100) return;

      // Item icon (full size to match inventory) — store ref for gray-out
      let icon: Phaser.GameObjects.Image | null = null;
      const iconKey = ItemIconRenderer.getIconKey(entry.item.id);
      if (this.textures.exists(iconKey)) {
        icon = this.add.image(100, y + 28, iconKey);
      }
      this.sellItemIcons.push(icon);

      const text = this.add.text(140, y + 16, `  ${entry.item.name} ×${entry.quantity}  賣出: ${entry.item.sellPrice} 金幣`, {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textPrimary,
        stroke: '#000000', strokeThickness: 2,
      }).setInteractive({ useHandCursor: true });

      text.on('pointerdown', () => this.doSell(i, items, goldText));
      text.on('pointerover', () => { this.pendingConfirmIndex = -1; this.selectedIndex = i; this.updateSellHighlight(items); });
      this.itemTexts.push(text);
    });

    // Defer initial highlight to next tick — Text canvas may not be ready during scene boot
    this.time.delayedCall(0, () => this.updateSellHighlight(items));

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
        goldText.setText(gameState.getGold().toLocaleString());
        // Gold change animation — scale pulse + yellow flash
        this.tweens.getTweensOf(goldText).forEach(tw => tw.stop());
        goldText.setScale(1);
        this.tweens.add({
          targets: goldText, scale: { from: 1.0, to: 1.2 },
          duration: 150, yoyo: true, ease: 'Sine.easeOut',
        });
        entry.quantity--;
        if (entry.quantity <= 0) {
          // Gray out sold-out item text and icon
          this.itemTexts[index]?.setColor('#444444');
          this.itemTexts[index]?.setText(`  ${entry.item.name} ×0  已售完`);
          if (this.sellItemIcons[index]) {
            this.sellItemIcons[index]!.setAlpha(0.3);
          }
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
      if (!text.active) return; // guard against destroyed text during scene transitions
      const raw = text.text.replace(/^[► ] /, '').replace(/  ← 確定\?$/, '');
      const canAfford = gameState.getGold() >= (shopData[i]?.price ?? Infinity);
      if (i === this.pendingConfirmIndex) {
        text.setText(`► ${raw}  ← 確定?`);
        text.setColor('#ffff00');
        text.setFontSize('15px');
        // Pulsing flash effect for pending confirm
        this.tweens.getTweensOf(text).forEach(tw => tw.stop());
        this.tweens.add({
          targets: text, alpha: { from: 1, to: 0.5 },
          duration: 300, yoyo: true, repeat: -1,
        });
      } else if (i === this.selectedIndex) {
        this.tweens.getTweensOf(text).forEach(tw => tw.stop());
        text.setAlpha(1).setFontSize('14px');
        text.setText(`► ${raw}`);
        text.setColor(COLORS.textHighlight);
      } else {
        this.tweens.getTweensOf(text).forEach(tw => tw.stop());
        text.setAlpha(1).setFontSize('14px');
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

  private updateSellHighlight(items: { item: { name: string; sellPrice: number; description?: string }; quantity: number }[]): void {
    this.itemTexts.forEach((text, i) => {
      if (!text.active || !items[i]) return;
      const soldOut = items[i].quantity <= 0;
      if (soldOut) return; // already grayed out in doSell
      if (i === this.pendingConfirmIndex) {
        text.setText(`► ${items[i].item.name} ×${items[i].quantity}  賣出: ${items[i].item.sellPrice} 金幣  ← 確定?`);
        text.setColor('#ffff00');
        text.setFontSize('15px');
        this.tweens.getTweensOf(text).forEach(tw => tw.stop());
        this.tweens.add({
          targets: text, alpha: { from: 1, to: 0.5 },
          duration: 300, yoyo: true, repeat: -1,
        });
      } else {
        this.tweens.getTweensOf(text).forEach(tw => tw.stop());
        text.setAlpha(1).setFontSize('14px');
        const isSelected = i === this.selectedIndex;
        text.setText(`${isSelected ? '► ' : '  '}${items[i].item.name} ×${items[i].quantity}  賣出: ${items[i].item.sellPrice} 金幣`);
        text.setColor(isSelected ? COLORS.textHighlight : COLORS.textPrimary);
      }
    });
    // Update description panel for selected item
    const sel = items[this.selectedIndex];
    if (this.descText && sel) {
      this.descText.setText(sel.item.description ? `${sel.item.name} — ${sel.item.description}` : '');
    }
  }

  private closeShop(): void {
    if (this.closing) return;
    this.closing = true;
    const parentScene = gameState.getState().currentScene;
    this.scene.resume(parentScene);
    this.scene.stop(); // InputPlugin.shutdown() handles listener cleanup
  }
}
