/** 繁體中文本地化系統 — 所有遊戲內文字集中管理 */

const strings: Record<string, string> = {
  // ─── 標題 ───
  'title.game_name': '勇者傳說',
  'title.new_game': '新遊戲',
  'title.load_game': '讀取進度',
  'title.settings': '系統設定',
  'title.subtitle': '～七國的傳說～',

  // ─── 命名 ───
  'name.prompt': '請為勇者命名：',
  'name.confirm': '確認',
  'name.default': '勇者',

  // ─── 戰鬥 ───
  'battle.attack': '攻擊',
  'battle.skill': '技能',
  'battle.item': '道具',
  'battle.defend': '防禦',
  'battle.flee': '逃跑',
  'battle.victory': '戰鬥勝利！',
  'battle.defeat': '全軍覆沒...',
  'battle.exp_gained': '獲得 {0} 經驗值',
  'battle.gold_gained': '獲得 {0} 金幣',
  'battle.item_dropped': '獲得 {0}',
  'battle.level_up': '{0} 升級到 Lv.{1}！',
  'battle.fled': '成功逃跑了！',
  'battle.flee_fail': '逃跑失敗！',
  'battle.encounter': '遭遇了 {0}！',
  'battle.turn': '第 {0} 回合',
  'battle.hp': 'HP',
  'battle.mp': 'MP',
  'battle.select_target': '選擇目標',
  'battle.select_skill': '選擇技能',
  'battle.select_item': '選擇道具',
  'battle.not_enough_mp': 'MP 不足！',
  'battle.defend_stance': '{0} 採取防禦姿勢',
  'battle.damage': '{0} 對 {1} 造成 {2} 點傷害',
  'battle.heal': '{0} 恢復了 {1} 點 HP',
  'battle.miss': '{0} 的攻擊落空了！',
  'battle.defeated': '{0} 被擊倒了！',

  // ─── 選單 ───
  'menu.items': '道具',
  'menu.equipment': '裝備',
  'menu.skills': '技能',
  'menu.party': '隊伍',
  'menu.quests': '任務日誌',
  'menu.save': '存檔',
  'menu.system': '系統',
  'menu.close': '關閉',
  'menu.back': '返回',

  // ─── 商店 ───
  'shop.buy': '購買',
  'shop.sell': '出售',
  'shop.welcome': '歡迎光臨！',
  'shop.gold': '持有金幣：{0}',
  'shop.not_enough': '金幣不足！',
  'shop.bought': '購買了 {0}',
  'shop.sold': '出售了 {0}',
  'shop.confirm_buy': '確定購買 {0} 嗎？（{1} 金幣）',

  // ─── 存檔 ───
  'save.slot': '存檔欄 {0}',
  'save.empty': '— 空白 —',
  'save.saved': '存檔成功！',
  'save.loaded': '讀取成功！',
  'save.confirm_overwrite': '確定覆蓋存檔嗎？',
  'save.auto': '自動存檔',

  // ─── 世界地圖 ───
  'world.title': '世界地圖',
  'world.liberated': '已解放',
  'world.occupied': '被佔領',
  'world.unexplored': '未探索',
  'world.press_enter': '按 Enter 進入',
  'world.fast_travel': '快速傳送',

  // ─── 城鎮 ───
  'town.welcome': '歡迎來到 {0}',
  'town.shop': '商店',
  'town.save_point': '存檔點',
  'town.exit': '離開城鎮',

  // ─── 屬性 ───
  'stat.hp': '體力',
  'stat.mp': '魔力',
  'stat.atk': '攻擊',
  'stat.def': '防禦',
  'stat.agi': '敏捷',
  'stat.luck': '幸運',
  'stat.level': '等級',
  'stat.exp': '經驗值',

  // ─── 通用 ───
  'common.yes': '是',
  'common.no': '否',
  'common.confirm': '確認',
  'common.cancel': '取消',
  'common.ok': '確定',

  // ─── 系統 ───
  'system.difficulty': '難度',
  'system.easy': '簡單',
  'system.normal': '正常',
  'system.hard': '困難',
  'system.bgm_volume': '音樂音量',
  'system.sfx_volume': '音效音量',
  'system.return_title': '回到標題',

  // ─── 進度 ───
  'progress.kingdoms': '已解放王國：{0}/7',
  'progress.chapter': '第 {0} 章',

  // ─── 全滅 ───
  'gameover.title': 'GAME OVER',
  'gameover.retry': '重新挑戰',
  'gameover.load': '讀取存檔',
  'gameover.title_screen': '回到標題',
  'gameover.return_town': '回到城鎮',
  'gameover.gold_lost': '失去了 {0} 金幣...',
  'gameover.revived': '在城鎮中恢復了意識...',
  'battle.near_death': '瀕死',

  // ─── 結局 ───
  'ending.congratulations': '恭喜通關！',
  'ending.playtime': '遊戲時間：{0}',
  'ending.newgame_plus': '新遊戲+',
};

export function t(key: string, ...args: (string | number)[]): string {
  let text = strings[key] ?? key;
  args.forEach((arg, i) => {
    text = text.replace(`{${i}}`, String(arg));
  });
  return text;
}

export function addStrings(newStrings: Record<string, string>): void {
  Object.assign(strings, newStrings);
}
