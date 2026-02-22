/** Medieval color palette system — region-specific palettes for all art generation */

/** Core medieval theme colors (hex strings for Canvas 2D) */
export const MEDIEVAL = {
  // Parchment / paper
  parchment:      '#d4c5a9',
  parchmentDark:  '#b8a88a',
  parchmentLight: '#e8dcc8',

  // Wood
  woodDark:    '#4a3728',
  woodMedium:  '#6b4f3a',
  woodLight:   '#8b6f4e',
  woodGrain:   '#5a4332',

  // Stone
  stoneDark:   '#555555',
  stoneMedium: '#777777',
  stoneLight:  '#999999',
  stoneMortar: '#888888',

  // Brick
  brickDark:   '#6b3322',
  brickMedium: '#8b4433',
  brickLight:  '#ab5544',

  // Metal
  ironDark:    '#3a3a3a',
  ironMedium:  '#5a5a5a',
  ironLight:   '#7a7a7a',
  gold:        '#c8a832',
  goldLight:   '#e8c848',
  goldDark:    '#a88828',
  goldBright:  '#ffd700',

  // Nature
  grassDark:   '#2a5a1a',
  grassMedium: '#3a7a2a',
  grassLight:  '#4a9a3a',
  flowerRed:   '#cc3344',
  flowerYellow:'#ddcc33',
  flowerWhite: '#eeeedd',
  flowerPurple:'#9944aa',

  // Water
  waterDark:   '#224466',
  waterMedium: '#336688',
  waterLight:  '#4488aa',
  waterFoam:   '#88bbcc',

  // Dirt / Earth
  dirtDark:    '#443322',
  dirtMedium:  '#665544',
  dirtLight:   '#887766',
  cobbleGrey:  '#777766',

  // UI
  panelBg:       '#1a1510',
  panelFrame:    '#6b4f3a',
  panelInner:    '#d4c5a9',
  panelInnerDark:'#b0a080',
  textGold:      '#ffd700',
  barFrameGold:  '#8b7732',

  // Roof
  roofDark:    '#6b2222',
  roofMedium:  '#8b3333',
  roofLight:   '#aa4444',

  // Skin tones
  skinLight:   '#f0c8a0',
  skinMedium:  '#d4a878',
  skinDark:    '#a07850',
  skinPale:    '#f8e0c8',

  // Hair
  hairBrown:   '#5a3a1a',
  hairBlonde:  '#c8a838',
  hairBlack:   '#2a2a2a',
  hairRed:     '#883322',
  hairWhite:   '#cccccc',
  hairGreen:   '#3a6a2a',
  hairBlue:    '#3a4a8a',
};

/** Region-specific tile palette */
export interface RegionPalette {
  id: string;
  ground: [string, string, string]; // dark, medium, light
  wall: [string, string, string];
  accent: string;
  tree: [string, string]; // trunk, leaves
  path: [string, string]; // stone, mortar
  waterTint?: string;
  skyColor: string;
  battleBg: [string, string, string]; // top, mid, bottom (sky, horizon, ground)
}

export const REGION_PALETTES: Record<string, RegionPalette> = {
  region_hero: {
    id: 'region_hero',
    ground: ['#3a5a2a', '#4a7a3a', '#5a9a4a'],
    wall: ['#555566', '#777788', '#8888aa'],
    accent: '#8888cc',
    tree: ['#5a3a1a', '#3a7a2a'],
    path: ['#887766', '#aa9988'],
    skyColor: '#4466aa',
    battleBg: ['#334488', '#556699', '#3a5a2a'],
  },
  region_elf: {
    id: 'region_elf',
    ground: ['#1a5a1a', '#2a7a2a', '#3a9a3a'],
    wall: ['#3a5a2a', '#4a7a3a', '#5a9a4a'],
    accent: '#44cc44',
    tree: ['#4a3a1a', '#228822'],
    path: ['#556644', '#778866'],
    skyColor: '#66aa66',
    battleBg: ['#225522', '#338833', '#1a5a1a'],
  },
  region_treant: {
    id: 'region_treant',
    ground: ['#1a3a1a', '#2a4a2a', '#3a5a3a'],
    wall: ['#4a3a28', '#6b5a3a', '#8b7a4e'],
    accent: '#228822',
    tree: ['#6b5a3a', '#1a5a1a'],
    path: ['#4a4a3a', '#6a6a5a'],
    skyColor: '#448844',
    battleBg: ['#1a3a1a', '#225522', '#112211'],
  },
  region_beast: {
    id: 'region_beast',
    ground: ['#6a5a2a', '#8a7a3a', '#aa9a4a'],
    wall: ['#776655', '#998877', '#bbaa99'],
    accent: '#cc8844',
    tree: ['#5a3a1a', '#7a8a2a'],
    path: ['#887755', '#aa9977'],
    skyColor: '#cc9944',
    battleBg: ['#886633', '#aa8844', '#6a5a2a'],
  },
  region_merfolk: {
    id: 'region_merfolk',
    ground: ['#1a4466', '#2a6688', '#3a88aa'],
    wall: ['#335566', '#447788', '#558899'],
    accent: '#4488cc',
    tree: ['#335544', '#448866'],
    path: ['#557788', '#77aacc'],
    waterTint: '#2266aa',
    skyColor: '#2244aa',
    battleBg: ['#112244', '#224466', '#113355'],
  },
  region_giant: {
    id: 'region_giant',
    ground: ['#666666', '#888888', '#aaaaaa'],
    wall: ['#555555', '#777777', '#999999'],
    accent: '#888888',
    tree: ['#4a3a2a', '#556644'],
    path: ['#777777', '#aaaaaa'],
    skyColor: '#8899aa',
    battleBg: ['#667788', '#889999', '#666666'],
  },
  region_dwarf: {
    id: 'region_dwarf',
    ground: ['#3a2a1a', '#554433', '#665544'],
    wall: ['#555544', '#777766', '#999988'],
    accent: '#cc6644',
    tree: ['#5a4a2a', '#667744'],
    path: ['#666655', '#998877'],
    skyColor: '#554433',
    battleBg: ['#332211', '#554433', '#3a2a1a'],
  },
  region_undead: {
    id: 'region_undead',
    ground: ['#2a2a33', '#3a3a44', '#4a4a55'],
    wall: ['#333344', '#444455', '#555566'],
    accent: '#664488',
    tree: ['#3a2a3a', '#4a3a4a'],
    path: ['#444455', '#555566'],
    skyColor: '#332244',
    battleBg: ['#221133', '#332244', '#2a2a33'],
  },
  region_volcano: {
    id: 'region_volcano',
    ground: ['#3a2211', '#553322', '#664422'],
    wall: ['#443322', '#665544', '#887766'],
    accent: '#ff4422',
    tree: ['#3a2211', '#552211'],
    path: ['#554433', '#776655'],
    skyColor: '#882211',
    battleBg: ['#551100', '#883311', '#3a2211'],
  },
  region_hotspring: {
    id: 'region_hotspring',
    ground: ['#3a5a4a', '#4a7a5a', '#5a9a6a'],
    wall: ['#556655', '#778877', '#99aa99'],
    accent: '#44cccc',
    tree: ['#4a3a2a', '#3a7a5a'],
    path: ['#667766', '#99bb99'],
    waterTint: '#44aaaa',
    skyColor: '#66aaaa',
    battleBg: ['#449999', '#55bbbb', '#3a5a4a'],
  },
  region_mountain: {
    id: 'region_mountain',
    ground: ['#9999aa', '#aaaacc', '#ccccee'],
    wall: ['#8888aa', '#aaaacc', '#bbbbdd'],
    accent: '#ccccee',
    tree: ['#5a4a3a', '#667766'],
    path: ['#aabbcc', '#ccddee'],
    skyColor: '#aabbdd',
    battleBg: ['#8899bb', '#aabbdd', '#9999aa'],
  },
  region_demon: {
    id: 'region_demon',
    ground: ['#220022', '#330033', '#440044'],
    wall: ['#332233', '#443344', '#554455'],
    accent: '#880088',
    tree: ['#331133', '#442244'],
    path: ['#332233', '#553355'],
    skyColor: '#220011',
    battleBg: ['#110011', '#220022', '#110011'],
  },
};

/** Get palette for a region, with fallback */
export function getRegionPalette(regionId: string): RegionPalette {
  return REGION_PALETTES[regionId] ?? REGION_PALETTES['region_hero'];
}

/** Convert hex string '#RRGGBB' to number 0xRRGGBB */
export function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Convert number 0xRRGGBB to hex string '#RRGGBB' */
export function numToHex(num: number): string {
  return '#' + num.toString(16).padStart(6, '0');
}

/** Slightly vary a hex color randomly */
export function varyColor(hex: string, amount: number = 10): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const vary = () => Math.floor(Math.random() * amount * 2 - amount);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return '#' + [clamp(r + vary()), clamp(g + vary()), clamp(b + vary())]
    .map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Blend two hex colors by factor t (0=c1, 1=c2) */
export function blendColors(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

/** Darken a hex color by factor (0-1) */
export function darken(hex: string, factor: number): string {
  return blendColors(hex, '#000000', factor);
}

/** Lighten a hex color by factor (0-1) */
export function lighten(hex: string, factor: number): string {
  return blendColors(hex, '#ffffff', factor);
}
