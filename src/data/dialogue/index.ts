import type { DialogueTree } from '../../types';

const dialogues: Record<string, DialogueTree> = {
  npc_elder_intro: {
    id: 'npc_elder_intro',
    startNode: 'start',
    nodes: {
      start: {
        id: 'start', speaker: '村長', text: '唉...自從魔王軍佔領了王國，這裡就再也不安寧了。',
        next: 'ask',
      },
      ask: {
        id: 'ask', speaker: '村長', text: '你是...勇者？！聽說你還活著，太好了！',
        next: 'advice',
      },
      advice: {
        id: 'advice', speaker: '村長', text: '{heroName}，你必須去尋求其他王國的幫助。一個人是無法打敗魔王的。',
        next: 'direction',
      },
      direction: {
        id: 'direction', speaker: '村長', text: '先去北方的精靈王國吧，精靈族擅長魔法，他們會是很好的盟友。',
        action: 'set_flag:talked_to_elder',
      },
    },
  },

  npc_elf_elder: {
    id: 'npc_elf_elder',
    startNode: 'start',
    nodes: {
      start: {
        id: 'start', speaker: '精靈長老', text: '歡迎來到精靈王國，{heroName}。',
        next: 'crisis',
      },
      crisis: {
        id: 'crisis', speaker: '精靈長老', text: '我們的森林正在被腐化...一個強大的腐化精靈王控制了森林深處。',
        next: 'request',
      },
      request: {
        id: 'request', speaker: '精靈長老', text: '如果你能幫我們驅逐他，精靈族將永遠是你的盟友。',
        choices: [
          { text: '我會幫助你們的！', next: 'accept' },
          { text: '讓我先準備一下。', next: 'later' },
        ],
      },
      accept: {
        id: 'accept', speaker: '精靈長老', text: '太好了！腐化精靈王就在森林深處，請小心。艾拉會陪你一起去。',
        action: 'set_flag:elf_quest_accepted',
      },
      later: {
        id: 'later', speaker: '精靈長老', text: '好的，準備好了再來找我。',
      },
    },
  },

  npc_shop: {
    id: 'npc_shop',
    startNode: 'start',
    nodes: {
      start: {
        id: 'start', speaker: '商人', text: '歡迎光臨！需要什麼嗎？',
        choices: [
          { text: '我想買東西', next: 'buy' },
          { text: '我想賣東西', next: 'sell' },
          { text: '沒事，再見', next: 'bye' },
        ],
      },
      buy: {
        id: 'buy', speaker: '商人', text: '請看看我的貨物吧！',
        action: 'set_flag:open_shop_buy',
      },
      sell: {
        id: 'sell', speaker: '商人', text: '讓我看看你有什麼好東西。',
        action: 'set_flag:open_shop_sell',
      },
      bye: {
        id: 'bye', speaker: '商人', text: '歡迎再來！',
      },
    },
  },

  npc_save: {
    id: 'npc_save',
    startNode: 'start',
    nodes: {
      start: {
        id: 'start', speaker: '記錄者', text: '要記錄你的冒險嗎？',
        choices: [
          { text: '是的，請存檔', next: 'save' },
          { text: '不了，謝謝', next: 'bye' },
        ],
      },
      save: {
        id: 'save', speaker: '記錄者', text: '冒險記錄已保存。祝你旅途平安！',
        action: 'set_flag:trigger_save',
      },
      bye: {
        id: 'bye', speaker: '記錄者', text: '好的，一路順風。',
      },
    },
  },

  npc_inn: {
    id: 'npc_inn',
    startNode: 'start',
    nodes: {
      start: {
        id: 'start', speaker: '旅店老闆', text: '歡迎來到旅店！住一晚只要 30 金幣，可以完全恢復體力。要住宿嗎？',
        choices: [
          { text: '好的，住一晚', next: 'rest' },
          { text: '不了，謝謝', next: 'bye' },
        ],
      },
      rest: {
        id: 'rest', speaker: '旅店老闆', text: '好好休息吧！……你睡了一覺，覺得精神飽滿了！',
        action: 'set_flag:trigger_inn',
      },
      no_gold: {
        id: 'no_gold', speaker: '旅店老闆', text: '看來你的錢不太夠呢…下次再來吧。',
      },
      bye: {
        id: 'bye', speaker: '旅店老闆', text: '慢走，歡迎再來！',
      },
    },
  },

  npc_generic_villager: {
    id: 'npc_generic_villager',
    startNode: 'start',
    nodes: {
      start: {
        id: 'start', speaker: '村民', text: '聽說勇者 {heroName} 正在到處幫助各個王國呢！真是了不起。',
      },
    },
  },

  npc_companion_join: {
    id: 'npc_companion_join',
    startNode: 'start',
    nodes: {
      start: {
        id: 'start', speaker: '???', text: '你就是那位勇者嗎？讓我跟你一起戰鬥吧！',
        choices: [
          { text: '歡迎加入！', next: 'join' },
          { text: '我再考慮一下。', next: 'wait' },
        ],
      },
      join: {
        id: 'join', speaker: '???', text: '太好了！我會用我的力量保護大家的！',
        action: 'set_flag:companion_joined',
      },
      wait: {
        id: 'wait', speaker: '???', text: '好的，我會在這裡等你的決定。',
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 勇者王國 — 日常生活 NPC
  // ═══════════════════════════════════════════════════════════════
  npc_hero_farmer: {
    id: 'npc_hero_farmer', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '農夫', text: '今年的收成比以前差多了…魔王軍的影響連土地都受害了。', next: 'hope' },
      hope: { id: 'hope', speaker: '農夫', text: '不過只要勇者還在，我們就有希望！我會繼續耕作，為大家提供糧食的。' },
    },
  },
  npc_hero_guard: {
    id: 'npc_hero_guard', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '村莊守衛', text: '我負責巡邏村子周圍…最近魔物越來越多，要小心啊。', next: 'tip' },
      tip: { id: 'tip', speaker: '村莊守衛', text: '出村前記得在旅店休息，補充體力。野外不像城鎮這麼安全。' },
    },
  },
  npc_hero_child: {
    id: 'npc_hero_child', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '小孩', text: '哇！你就是勇者嗎？好酷喔！我長大以後也要像你一樣強！', next: 'dream' },
      dream: { id: 'dream', speaker: '小孩', text: '爸爸說世界上有很多不同的王國，精靈啊、矮人啊…我好想去看看！' },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 精靈王國 — 森林中的優雅生活
  // ═══════════════════════════════════════════════════════════════
  npc_elf_bard: {
    id: 'npc_elf_bard', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '精靈樂師', text: '♪～精靈之歌在風中迴盪，古老的旋律訴說著千年的故事…♪', next: 'talk' },
      talk: { id: 'talk', speaker: '精靈樂師', text: '音樂是精靈族的靈魂。每一首歌都承載著森林的記憶。你喜歡音樂嗎？' },
    },
  },
  npc_elf_hunter: {
    id: 'npc_elf_hunter', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '精靈獵人', text: '這片森林的一草一木我都熟悉…最近有些地方開始腐化了，真令人擔心。', next: 'advice' },
      advice: { id: 'advice', speaker: '精靈獵人', text: '在森林深處行動時要小心腐化的植物，它們會吸取你的力量。' },
    },
  },
  npc_elf_gardener: {
    id: 'npc_elf_gardener', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '精靈園丁', text: '我在照顧這些月光花…它們只有在星光下才會綻放呢。', next: 'lore' },
      lore: { id: 'lore', speaker: '精靈園丁', text: '精靈族與自然共生，我們不只是住在森林裡，我們就是森林的一部分。' },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 樹人王國 — 古樹中的寧靜生活
  // ═══════════════════════════════════════════════════════════════
  npc_treant_keeper: {
    id: 'npc_treant_keeper', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '樹人守護者', text: '…………（樹人緩慢地轉過身來）……歡迎，年輕的旅人…', next: 'wisdom' },
      wisdom: { id: 'wisdom', speaker: '樹人守護者', text: '我們已經守護這片土地千年了…時間對我們來說，只是樹葉落下又長出的循環。' },
    },
  },
  npc_treant_fairy: {
    id: 'npc_treant_fairy', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '花精靈', text: '嘻嘻！你好呀～我在收集今早盛開的花瓣，它們可以做成很棒的藥水喔！', next: 'info' },
      info: { id: 'info', speaker: '花精靈', text: '樹人王國的空氣充滿了治癒的力量，在這裡休息會恢復得特別快呢～' },
    },
  },
  npc_treant_mushroom: {
    id: 'npc_treant_mushroom', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '蘑菇採集者', text: '噓…你看這棵古樹根部的蘑菇，這是非常珍貴的靈芝！', next: 'trade' },
      trade: { id: 'trade', speaker: '蘑菇採集者', text: '樹人王國的特產就是各種神奇的菌類，據說能增強魔力呢。' },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 獸人王國 — 草原上的力量文化
  // ═══════════════════════════════════════════════════════════════
  npc_beast_warrior: {
    id: 'npc_beast_warrior', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '獸人戰士', text: '哈！你就是那個人類勇者？看起來不怎麼壯嘛！', next: 'respect' },
      respect: { id: 'respect', speaker: '獸人戰士', text: '不過能走到這裡，說明你有真本事。在獸人國，力量就是一切！來，跟我比劃比劃？…算了，下次吧。' },
    },
  },
  npc_beast_hunter: {
    id: 'npc_beast_hunter', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '獸人獵人', text: '嗅…我聞到遠方有大型獵物的氣味。今天會是豐收的一天！', next: 'culture' },
      culture: { id: 'culture', speaker: '獸人獵人', text: '獸人族靠狩獵和畜牧為生。我們尊重每一條生命，只取所需。' },
    },
  },
  npc_beast_smith: {
    id: 'npc_beast_smith', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '獸人鍛造師', text: '（鏘！鏘！鏘！）呼…正在打一把新的戰斧。獸人族的武器講究力道！', next: 'craft' },
      craft: { id: 'craft', speaker: '獸人鍛造師', text: '不像矮人那些精細的東西，我們的武器就是要大、要重、要能一擊必殺！' },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 人魚王國 — 海底水晶宮的優雅生活
  // ═══════════════════════════════════════════════════════════════
  npc_merfolk_singer: {
    id: 'npc_merfolk_singer', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '人魚歌手', text: '♪～海浪輕輕搖，珊瑚在微笑，深海的秘密只有我們知道…♪', next: 'chat' },
      chat: { id: 'chat', speaker: '人魚歌手', text: '人魚的歌聲能安撫海中的魔物。但最近深海的黑暗變強了，連我的歌聲都壓不住…' },
    },
  },
  npc_merfolk_fisher: {
    id: 'npc_merfolk_fisher', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '人魚漁夫', text: '今天的海流不太對勁啊…魚群都往淺水區移動了。', next: 'warn' },
      warn: { id: 'warn', speaker: '人魚漁夫', text: '深海最近出現了奇怪的暗流，據說是海底有什麼東西在攪動。小心那邊的海域。' },
    },
  },
  npc_merfolk_sculptor: {
    id: 'npc_merfolk_sculptor', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '珊瑚雕刻師', text: '你看這塊珊瑚，我正在把它雕成人魚女王的像。已經花了三個月了。', next: 'art' },
      art: { id: 'art', speaker: '珊瑚雕刻師', text: '水晶宮裡的每一件裝飾都是手工雕刻的，這是人魚族引以為傲的傳統工藝。' },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 巨人王國 — 山巔城堡的壯闊生活
  // ═══════════════════════════════════════════════════════════════
  npc_giant_mason: {
    id: 'npc_giant_mason', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '巨人石匠', text: '（轟！）哈哈，別嚇到了！我只是在搬這塊巨石而已。對巨人來說這很輕鬆！', next: 'build' },
      build: { id: 'build', speaker: '巨人石匠', text: '這座城堡是巨人族花了百年建造的。每一塊石頭都有一個巨人那麼大！' },
    },
  },
  npc_giant_cook: {
    id: 'npc_giant_cook', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '巨人廚師', text: '今天的燉肉湯快好了！一鍋就要用掉十頭牛…你要嚐嚐嗎？', next: 'food' },
      food: { id: 'food', speaker: '巨人廚師', text: '呃…對你來說可能一碗就夠你吃一個禮拜了吧，哈哈哈！' },
    },
  },
  npc_giant_guard: {
    id: 'npc_giant_guard', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '巨人守衛', text: '站住！……啊，是勇者啊。你真的好小，差點沒看到你。', next: 'patrol' },
      patrol: { id: 'patrol', speaker: '巨人守衛', text: '我在巡邏城堡周圍。雖然巨人族很強，但魔王軍的威脅不容小覷。' },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 矮人王國 — 地下礦脈的工匠文化
  // ═══════════════════════════════════════════════════════════════
  npc_dwarf_forge: {
    id: 'npc_dwarf_forge', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '矮人鑄造師', text: '（叮！叮！叮！）等一下…好了！看看這把劍的紋路，完美！', next: 'pride' },
      pride: { id: 'pride', speaker: '矮人鑄造師', text: '矮人族的鍛造技術是全世界最頂尖的！我們的秘鋼配方代代相傳了五百年！' },
    },
  },
  npc_dwarf_miner: {
    id: 'npc_dwarf_miner', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '矮人礦工', text: '嘿！你知道嗎，昨天我們在第七礦坑挖到了一塊秘銀礦石！', next: 'ore' },
      ore: { id: 'ore', speaker: '矮人礦工', text: '秘銀是最珍貴的金屬，比鋼鐵輕但比龍鱗硬。做成裝備的話，那可是頂級貨色！' },
    },
  },
  npc_dwarf_brewer: {
    id: 'npc_dwarf_brewer', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '矮人釀酒師', text: '來來來！嚐嚐我新釀的石窖麥酒！保證你喝過最醇的！', next: 'brew' },
      brew: { id: 'brew', speaker: '矮人釀酒師', text: '矮人不只會打鐵，我們的酒也是一絕！用地下泉水和千年酵母…嗝！' },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 不死王國 — 永恆黑暗中的哀愁靈魂
  // ═══════════════════════════════════════════════════════════════
  npc_undead_scholar: {
    id: 'npc_undead_scholar', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '幽靈學者', text: '…我在研究如何解除這片土地上的詛咒。已經研究了…三百年了吧。', next: 'study' },
      study: { id: 'study', speaker: '幽靈學者', text: '這裡的亡靈並非天生邪惡，我們只是被困在生與死之間。也許勇者能為我們帶來解脫。' },
    },
  },
  npc_undead_knight: {
    id: 'npc_undead_knight', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '骷髏騎士', text: '…我生前是一名騎士，為正義而戰…死後依然守護著這片土地。', next: 'duty' },
      duty: { id: 'duty', speaker: '骷髏騎士', text: '即使身體已經腐朽，騎士的誓言永不磨滅。勇者，請讓我們重獲安息。' },
    },
  },
  npc_undead_poet: {
    id: 'npc_undead_poet', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '亡靈詩人', text: '在黑暗中我寫了一萬首詩…都是關於那再也看不見的陽光。', next: 'poem' },
      poem: { id: 'poem', speaker: '亡靈詩人', text: '「當最後的光芒消逝，唯有記憶中的溫暖不滅。」…這是我最喜歡的一句。' },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 火山族 — 烈焰中的熱情部族
  // ═══════════════════════════════════════════════════════════════
  npc_volcano_dancer: {
    id: 'npc_volcano_dancer', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '火焰舞者', text: '（旋轉！）哈～火焰之舞是我們對火山神的敬意！每一步都要充滿熱情！', next: 'dance' },
      dance: { id: 'dance', speaker: '火焰舞者', text: '火山族相信，舞蹈能讓火山保持安寧。如果停止跳舞…火山就會發怒噢！' },
    },
  },
  npc_volcano_forge: {
    id: 'npc_volcano_forge', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '熔岩鍛造師', text: '我們直接用火山的熔岩來鍛造武器！比普通的爐火溫度高多了！', next: 'tech' },
      tech: { id: 'tech', speaker: '熔岩鍛造師', text: '火山族的武器帶有天然的火焰之力。不過…要在熔岩旁邊工作真的很熱就是了。' },
    },
  },
  npc_volcano_priest: {
    id: 'npc_volcano_priest', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '火山祭司', text: '火山神賜予我們力量，也教我們敬畏自然。火焰既是創造，也是毀滅。', next: 'prophecy' },
      prophecy: { id: 'prophecy', speaker: '火山祭司', text: '古老的預言說，當勇者集結所有王國之力時，連火山都會為他開路。' },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 溫泉族 — 山谷中的療癒之地
  // ═══════════════════════════════════════════════════════════════
  npc_hotspring_herbalist: {
    id: 'npc_hotspring_herbalist', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '藥草師', text: '這片山谷的藥草種類特別豐富，都是溫泉水滋養出來的。', next: 'herb' },
      herb: { id: 'herb', speaker: '藥草師', text: '我用溫泉水和山上的藥草調配各種藥劑。如果你受傷了，在溫泉裡泡一泡就好了～' },
    },
  },
  npc_hotspring_attendant: {
    id: 'npc_hotspring_attendant', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '溫泉管理員', text: '歡迎來到溫泉鄉！這裡的溫泉有神奇的療癒效果，泡完保證精神百倍！', next: 'rules' },
      rules: { id: 'rules', speaker: '溫泉管理員', text: '不過要記得，溫泉區禁止使用武器和魔法喔。這裡是和平的療養之地。' },
    },
  },
  npc_hotspring_traveler: {
    id: 'npc_hotspring_traveler', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '疲憊旅人', text: '唉…從巨人王國走到這裡，腳都快斷了。還好有溫泉可以泡…', next: 'relax' },
      relax: { id: 'relax', speaker: '疲憊旅人', text: '勇者也要記得適當休息啊。再強的人，不休息的話遲早會倒下的。' },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 高山族 — 雪山之巔的隱居智者
  // ═══════════════════════════════════════════════════════════════
  npc_mountain_guide: {
    id: 'npc_mountain_guide', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '登山嚮導', text: '能爬到這麼高的地方，你很有毅力嘛！山頂的空氣稀薄，要注意呼吸。', next: 'path' },
      path: { id: 'path', speaker: '登山嚮導', text: '高山族世代居住在雲端之上。我們習慣了寒風和暴雪…但美麗的星空是最好的回報。' },
    },
  },
  npc_mountain_hermit: {
    id: 'npc_mountain_hermit', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '隱士', text: '…你打擾了我的冥想。不過沒關係，也許這就是命運的安排。', next: 'wisdom' },
      wisdom: { id: 'wisdom', speaker: '隱士', text: '真正的力量不在於劍有多鋒利，而在於揮劍者的心是否堅定。記住這句話吧。' },
    },
  },
  npc_mountain_falcon: {
    id: 'npc_mountain_falcon', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '鷹匠', text: '看！我的獵鷹「蒼穹」正在盤旋。牠的眼睛能看到山下十里外的獵物。', next: 'eagle' },
      eagle: { id: 'eagle', speaker: '鷹匠', text: '高山族用獵鷹來偵查和傳遞消息。在這片雪山上，牠們是我們最忠誠的夥伴。' },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 魔王城 — 黑暗中的絕望與希望
  // ═══════════════════════════════════════════════════════════════
  npc_demon_servant: {
    id: 'npc_demon_servant', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '暗影僕從', text: '…你不該來這裡的，勇者。這裡充滿了絕望和黑暗。', next: 'warn' },
      warn: { id: 'warn', speaker: '暗影僕從', text: '我被魔王奴役了…但如果你能打敗他，也許我們都能獲得自由…' },
    },
  },
  npc_demon_guard: {
    id: 'npc_demon_guard', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '魔族衛兵', text: '…我奉命看守這裡。但說實話，我也厭倦了無盡的戰爭。', next: 'doubt' },
      doubt: { id: 'doubt', speaker: '魔族衛兵', text: '魔王說人類是邪惡的…但看到你幫助各個王國，我開始懷疑了…' },
    },
  },
  npc_demon_prisoner: {
    id: 'npc_demon_prisoner', startNode: 'start',
    nodes: {
      start: { id: 'start', speaker: '被囚勇者', text: '你…你是新來的勇者嗎？我是上一代的冒險者，被困在這裡很久了…', next: 'help' },
      help: { id: 'help', speaker: '被囚勇者', text: '小心魔王的力量…他能操控黑暗本身。但只要各王國團結一心，一定能戰勝他！加油！' },
    },
  },
};

export function getDialogueTree(id: string): DialogueTree | undefined {
  return dialogues[id];
}

export function getAllDialogueIds(): string[] {
  return Object.keys(dialogues);
}
