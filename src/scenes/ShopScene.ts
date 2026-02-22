import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { COLORS, FONT_FAMILY } from '../utils/constants';
import { t } from '../systems/i18n';
import { gameState } from '../systems/GameStateManager';
import { getRegionById } from '../data/regions/index';
import { getItemById, getEquipmentById } from '../data/items/index';
import { InventorySystem } from '../systems/InventorySystem';
import { audioManager } from '../systems/AudioManager';

export class ShopScene extends Phaser.Scene {
  private regionId = '';
  private mode: 'buy' | 'sell' = 'buy';

  constructor() {
    super('ShopScene');
  }

  create(data: { regionId: string; mode: 'buy' | 'sell' }): void {
    this.regionId = data.regionId;
    this.mode = data.mode;

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

    // Close button
    const closeBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, `← ${t('menu.close')}`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.textHighlight,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeShop());

    this.input.keyboard?.on('keydown-ESC', () => this.closeShop());
  }

  private showBuyList(goldText: Phaser.GameObjects.Text): void {
    const region = getRegionById(this.regionId);
    if (!region) return;

    region.shopItems.forEach((itemId, i) => {
      const item = getItemById(itemId);
      const equip = getEquipmentById(itemId);
      if (!item && !equip) return;

      const name = item?.name ?? equip?.name ?? '';
      const price = item?.price ?? equip?.price ?? 0;
      const desc = item?.description ?? equip?.description ?? '';
      const y = 100 + i * 32;
      if (y > GAME_HEIGHT - 90) return;

      const canAfford = gameState.getGold() >= price;
      const text = this.add.text(100, y, `${name}  ${price}G  — ${desc}`, {
        fontFamily: FONT_FAMILY, fontSize: '14px',
        color: canAfford ? '#ffffff' : '#666666',
        stroke: '#000000', strokeThickness: 2,
        wordWrap: { width: GAME_WIDTH - 240 },
      }).setInteractive({ useHandCursor: canAfford });

      if (canAfford) {
        text.on('pointerdown', () => {
          if (InventorySystem.buyItem(itemId, price)) {
            audioManager.playSfx('equip');
            goldText.setText(t('shop.gold', gameState.getGold()));
            text.setColor(gameState.getGold() >= price ? COLORS.textPrimary : '#666666');
          }
        });
        text.on('pointerover', () => text.setColor(COLORS.textHighlight));
        text.on('pointerout', () => text.setColor(canAfford ? COLORS.textPrimary : '#666666'));
      }
    });
  }

  private showSellList(goldText: Phaser.GameObjects.Text): void {
    const items = InventorySystem.getAllItems();
    if (items.length === 0) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '（沒有可出售的道具）', {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: COLORS.textSecondary,
      }).setOrigin(0.5);
      return;
    }

    items.forEach((entry, i) => {
      const y = 100 + i * 32;
      if (y > GAME_HEIGHT - 90) return;

      const text = this.add.text(100, y, `${entry.item.name} ×${entry.quantity}  賣出: ${entry.item.sellPrice} 金幣`, {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: COLORS.textPrimary,
      }).setInteractive({ useHandCursor: true });

      text.on('pointerdown', () => {
        if (InventorySystem.sellItem(entry.item.id)) {
          audioManager.playSfx('equip');
          goldText.setText(t('shop.gold', gameState.getGold()));
          entry.quantity--;
          if (entry.quantity <= 0) {
            text.setVisible(false);
          } else {
            text.setText(`${entry.item.name} ×${entry.quantity}  賣出: ${entry.item.sellPrice} 金幣`);
          }
        }
      });
    });
  }

  private closeShop(): void {
    const parentScene = gameState.getState().currentScene;
    this.scene.resume(parentScene);
    this.scene.stop();
  }
}
