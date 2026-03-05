// @ts-check
'use strict';

// ─── State ───────────────────────────────────────────────
/** @type {Map<string, {info: any, snapshot: any, battle: any, recording: boolean}>} */
const players = new Map();

/** @type {WebSocket|null} */
let ws = null;
let reconnectDelay = 1000;
let reconnectTimer = null;

// ─── DOM refs ────────────────────────────────────────────
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const playerCount = document.getElementById('player-count');
const playerList = document.getElementById('player-list');
const filterName = document.getElementById('filter-name');
const filterScene = document.getElementById('filter-scene');
const filterRegion = document.getElementById('filter-region');
const updateRate = document.getElementById('update-rate');
const mediaModal = document.getElementById('media-modal');
const mediaContainer = document.getElementById('media-container');
const mediaDownload = document.getElementById('media-download');
const modalClose = document.getElementById('modal-close');

// ─── Safe DOM helpers ────────────────────────────────────
function el(tag, className, textContent) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (textContent != null) e.textContent = String(textContent);
  return e;
}

// ─── Connection ──────────────────────────────────────────
function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}`;

  try {
    ws = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectDelay = 1000;
    setConnected(true);
    ws.send(JSON.stringify({
      type: 'register',
      timestamp: Date.now(),
      payload: { role: 'dashboard', clientId: 'dashboard_' + Date.now() }
    }));
  };

  ws.onmessage = (event) => {
    try {
      handleMessage(JSON.parse(event.data));
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    setConnected(false);
    scheduleReconnect();
  };

  ws.onerror = () => { /* onclose fires */ };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
}

function setConnected(connected) {
  statusDot.className = 'dot ' + (connected ? 'connected' : 'disconnected');
  statusText.textContent = connected ? 'Connected' : 'Disconnected';
}

// ─── Message Handling ────────────────────────────────────
function handleMessage(msg) {
  switch (msg.type) {
    case 'client_list':
      players.clear();
      for (const info of msg.payload) {
        players.set(info.clientId, {
          info,
          snapshot: info.lastSnapshot || null,
          battle: info.lastBattle || null,
          recording: false,
        });
      }
      updateFilters();
      render();
      break;

    case 'client_connected':
      players.set(msg.payload.clientId, {
        info: msg.payload,
        snapshot: msg.payload.lastSnapshot || null,
        battle: msg.payload.lastBattle || null,
        recording: false,
      });
      updateFilters();
      render();
      break;

    case 'client_disconnected':
      players.delete(msg.payload.clientId);
      updateFilters();
      render();
      break;

    case 'state_update': {
      const p = players.get(msg.clientId);
      if (p) {
        p.snapshot = msg.payload;
        p.info.heroName = msg.payload.heroName;
        renderCard(msg.clientId);
      }
      break;
    }

    case 'battle_update': {
      const p = players.get(msg.clientId);
      if (p) {
        p.battle = msg.payload;
        renderCard(msg.clientId);
      }
      break;
    }

    case 'screenshot_response':
      showMedia('image', msg.payload.dataUrl);
      break;

    case 'recording_data':
      showMedia('video', msg.payload.dataUrl);
      break;

    case 'recording_status': {
      const p = players.get(msg.clientId);
      if (p) {
        p.recording = msg.payload.recording;
        renderCard(msg.clientId);
      }
      break;
    }
  }

  updatePlayerCount();
}

// ─── Region name mapping ─────────────────────────────────
const REGION_NAMES = {
  region_hero: '\u52C7\u8005\u738B\u570B',
  region_forest: '\u68EE\u6797\u738B\u570B',
  region_mountain: '\u5C71\u5CB3\u738B\u570B',
  region_desert: '\u6C99\u6F20\u738B\u570B',
  region_ocean: '\u6D77\u6D0B\u738B\u570B',
  region_ice: '\u6C37\u96EA\u738B\u570B',
  region_volcano: '\u706B\u5C71\u738B\u570B',
  region_sky: '\u5929\u7A7A\u738B\u570B',
  region_swamp: '\u6CBC\u6FA4\u738B\u570B',
  region_dark: '\u9ED1\u6697\u738B\u570B',
  region_machine: '\u6A5F\u68B0\u738B\u570B',
  region_demon: '\u9B54\u738B\u57CE',
};

function regionDisplayName(id) {
  return REGION_NAMES[id] || id;
}

function sceneDisplayName(scene) {
  const map = {
    TitleScene: '\u6A19\u984C',
    NameInputScene: '\u547D\u540D',
    WorldMapScene: '\u4E16\u754C\u5730\u5716',
    TownScene: '\u57CE\u93AE',
    FieldScene: '\u91CE\u5916',
    BattleScene: '\u6230\u9B25',
  };
  return map[scene] || scene;
}

// ─── Rendering (safe DOM construction) ───────────────────
function render() {
  playerList.textContent = '';
  const filtered = getFilteredPlayers();

  if (filtered.length === 0) {
    const empty = el('div', 'empty-state');
    empty.textContent = 'No game clients connected. Open game with ?monitor=true to start monitoring.';
    playerList.appendChild(empty);
    return;
  }

  for (const [clientId] of filtered) {
    playerList.appendChild(createCard(clientId));
  }
}

function renderCard(clientId) {
  const existing = document.getElementById('card-' + clientId);
  if (!existing) {
    if (matchesFilters(clientId)) {
      const empty = playerList.querySelector('.empty-state');
      if (empty) empty.remove();
      playerList.appendChild(createCard(clientId));
    }
    return;
  }

  if (!matchesFilters(clientId)) {
    existing.remove();
    return;
  }

  existing.replaceWith(createCard(clientId));
}

function createCard(clientId) {
  const data = players.get(clientId);
  if (!data) return document.createElement('div');

  const s = data.snapshot;
  const b = data.battle;
  const card = el('div', 'player-card');
  card.id = 'card-' + clientId;

  // ── Thumbnail area with overlays ──
  const thumbArea = el('div', 'card-thumb-area');

  // Detect truly black thumbnails: a solid black 256x192 JPEG is ~350 chars
  // Even dark title screens with content are ~1000+ chars
  const hasRealThumb = s?.thumbnail && s.thumbnail.length > 500;
  if (hasRealThumb) {
    const img = document.createElement('img');
    img.src = s.thumbnail;
    img.alt = 'Game view';
    thumbArea.appendChild(img);
  } else {
    const ph = el('div', 'thumb-placeholder');
    ph.appendChild(el('div', null, s?.thumbnail ? '\u80CC\u666F\u5206\u9801' : '\u7B49\u5F85\u756B\u9762...'));
    ph.appendChild(el('div', 'bg-tab-hint', s?.thumbnail ? '(Browser throttles inactive tabs)' : ''));
    thumbArea.appendChild(ph);
  }

  // Top overlay: name/level on left, scene/region on right
  const topOverlay = el('div', 'thumb-overlay');
  const overlayLeft = el('div', 'overlay-left');
  overlayLeft.appendChild(el('div', 'overlay-name', s?.heroName || data.info.heroName || '???'));
  overlayLeft.appendChild(el('div', 'overlay-level', `Lv.${s?.heroLevel || '?'}`));
  topOverlay.appendChild(overlayLeft);

  const overlayRight = el('div', 'overlay-right');
  overlayRight.appendChild(el('div', 'overlay-scene', sceneDisplayName(s?.currentScene || '--')));
  overlayRight.appendChild(el('div', 'overlay-region', regionDisplayName(s?.currentRegion || '--')));
  topOverlay.appendChild(overlayRight);
  thumbArea.appendChild(topOverlay);

  // Bottom overlay: liberation progress + FPS
  const bottomOverlay = el('div', 'thumb-overlay-bottom');
  const libSection = el('div', 'overlay-liberation');
  const libCount = s?.liberatedCount ?? 0;
  const libTotal = s?.totalRegions ?? 12;
  const libPct = Math.round((libCount / libTotal) * 100);
  libSection.appendChild(el('span', null, `\u89E3\u653E ${libCount}/${libTotal}`));
  const libBar = el('div', 'liberation-bar');
  const libFill = el('div', 'liberation-fill');
  libFill.style.width = libPct + '%';
  libBar.appendChild(libFill);
  libSection.appendChild(libBar);
  bottomOverlay.appendChild(libSection);

  bottomOverlay.appendChild(el('div', 'overlay-fps', `${s?.fps ?? '--'} FPS`));
  thumbArea.appendChild(bottomOverlay);

  card.appendChild(thumbArea);

  // ── Info bar below thumbnail ──
  const info = el('div', 'card-info');

  // Compact HP/MP bars
  const hpPct = s ? Math.round((s.hp / s.maxHP) * 100) : 0;
  const mpPct = s ? (s.maxMP > 0 ? Math.round((s.mp / s.maxMP) * 100) : 0) : 0;

  const bars = el('div', 'compact-bars');
  bars.appendChild(createCompactBar('HP', s?.hp ?? 0, s?.maxHP ?? 1, hpPct, 'hp'));
  bars.appendChild(createCompactBar('MP', s?.mp ?? 0, s?.maxMP ?? 1, mpPct, 'mp'));
  info.appendChild(bars);

  // Details row
  const details = el('div', 'card-details-row');
  details.appendChild(el('span', null, `Gold ${s ? s.gold.toLocaleString() : '--'}`));
  details.appendChild(el('span', null, `Party: ${s?.partyMembers?.length ?? '--'}`));
  details.appendChild(el('span', null, s?.playTimeFormatted || '--:--:--'));
  details.appendChild(el('span', null, s?.difficulty || '--'));
  info.appendChild(details);

  // Actions
  const actions = el('div', 'card-actions');
  const ssBtn = el('button', 'btn', 'Screenshot');
  ssBtn.addEventListener('click', () => requestScreenshot(clientId));
  actions.appendChild(ssBtn);

  if (data.recording) {
    const stopBtn = el('button', 'btn recording', 'Stop');
    stopBtn.addEventListener('click', () => stopRecording(clientId));
    actions.appendChild(stopBtn);
  } else {
    const recBtn = el('button', 'btn', 'Record');
    recBtn.addEventListener('click', () => startRecording(clientId));
    actions.appendChild(recBtn);
  }
  info.appendChild(actions);

  card.appendChild(info);

  // Battle detail
  if (b) {
    card.appendChild(createBattleDetail(b));
  }

  return card;
}

function createCompactBar(label, current, max, pct, type) {
  const bar = el('div', 'compact-bar');
  bar.appendChild(el('span', 'compact-bar-label', label));
  const track = el('div', 'compact-bar-track');
  const fill = el('div', `compact-bar-fill ${type}`);
  fill.style.width = pct + '%';
  track.appendChild(fill);
  bar.appendChild(track);
  bar.appendChild(el('span', 'compact-bar-text', `${current}/${max}`));
  return bar;
}

function createBattleDetail(b) {
  const detail = el('div', 'battle-detail');

  const header = el('div', 'battle-header', `Battle \u2014 Turn ${b.turn} \u00B7 ${b.phase}`);
  detail.appendChild(header);

  const combatants = el('div', 'battle-combatants');

  const partySide = el('div', 'battle-side');
  partySide.appendChild(el('h4', null, 'Party'));
  for (const c of b.party) {
    const row = el('div', 'combatant-row');
    row.appendChild(el('span', null, c.name));
    row.appendChild(el('span', null, `${c.hp}/${c.maxHP} HP \u00B7 ${c.mp}/${c.maxMP} MP`));
    partySide.appendChild(row);
  }
  combatants.appendChild(partySide);

  const enemySide = el('div', 'battle-side');
  enemySide.appendChild(el('h4', null, 'Enemies'));
  for (const e of b.enemies) {
    const row = el('div', 'combatant-row');
    row.appendChild(el('span', null, e.name));
    row.appendChild(el('span', null, `${e.hp}/${e.maxHP} HP`));
    enemySide.appendChild(row);
  }
  combatants.appendChild(enemySide);
  detail.appendChild(combatants);

  if (b.log && b.log.length > 0) {
    const log = el('div', 'battle-log');
    for (const line of b.log) {
      log.appendChild(el('div', null, line));
    }
    detail.appendChild(log);
  }

  return detail;
}

// ─── Filters ─────────────────────────────────────────────
function updateFilters() {
  const scenes = new Set();
  const regions = new Set();
  for (const [, data] of players) {
    if (data.snapshot) {
      scenes.add(data.snapshot.currentScene);
      regions.add(data.snapshot.currentRegion);
    }
  }

  updateSelectOptions(filterScene, scenes);
  updateSelectOptions(filterRegion, regions);
}

function updateSelectOptions(select, values) {
  const current = select.value;
  while (select.options.length > 1) select.remove(1);
  for (const v of [...values].sort()) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  }
  select.value = current;
}

function matchesFilters(clientId) {
  const data = players.get(clientId);
  if (!data) return false;
  const s = data.snapshot;
  const name = filterName.value.toLowerCase();
  const scene = filterScene.value;
  const region = filterRegion.value;

  if (name && !(data.info.heroName || '').toLowerCase().includes(name)) return false;
  if (scene && s?.currentScene !== scene) return false;
  if (region && s?.currentRegion !== region) return false;
  return true;
}

function getFilteredPlayers() {
  return [...players].filter(([id]) => matchesFilters(id));
}

// ─── Actions ─────────────────────────────────────────────
function requestScreenshot(clientId) {
  sendCommand('request_screenshot', clientId, { requestId: 'ss_' + Date.now() });
}

function startRecording(clientId) {
  sendCommand('start_recording', clientId, { requestId: 'rec_' + Date.now(), maxDuration: 60 });
}

function stopRecording(clientId) {
  sendCommand('stop_recording', clientId, { requestId: 'rec_stop_' + Date.now() });
}

function sendCommand(type, clientId, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type, clientId, timestamp: Date.now(), payload }));
}

// ─── Media Modal ─────────────────────────────────────────
function showMedia(type, dataUrl) {
  mediaContainer.textContent = '';
  if (type === 'image') {
    const img = document.createElement('img');
    img.src = dataUrl;
    mediaContainer.appendChild(img);
    mediaDownload.href = dataUrl;
    mediaDownload.download = `screenshot_${Date.now()}.png`;
  } else {
    const video = document.createElement('video');
    video.src = dataUrl;
    video.controls = true;
    video.autoplay = true;
    mediaContainer.appendChild(video);
    mediaDownload.href = dataUrl;
    mediaDownload.download = `recording_${Date.now()}.webm`;
  }
  mediaModal.classList.remove('hidden');
}

function closeModal() {
  mediaModal.classList.add('hidden');
  mediaContainer.textContent = '';
}

modalClose.addEventListener('click', closeModal);
mediaModal.addEventListener('click', (e) => {
  if (e.target === mediaModal) closeModal();
});

// ─── Filter Events ───────────────────────────────────────
filterName.addEventListener('input', render);
filterScene.addEventListener('change', render);
filterRegion.addEventListener('change', render);

updateRate.addEventListener('change', () => {
  const ms = parseInt(updateRate.value);
  for (const [clientId] of players) {
    sendCommand('set_update_rate', clientId, { intervalMs: ms });
  }
});

// ─── Helpers ─────────────────────────────────────────────
function updatePlayerCount() {
  playerCount.textContent = `${players.size} player${players.size !== 1 ? 's' : ''}`;
}

// ─── Init ────────────────────────────────────────────────
connect();
