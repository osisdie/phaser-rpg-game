/**
 * 音效管理器 — 程式化多聲道 BGM 引擎
 *
 * 使用 Web Audio API 產生多層次循環音樂：
 * - Melody: 主旋律 (三角波/正弦波)
 * - Bass: 低音線 (正弦波)
 * - Pad: 和弦墊底 (三角波低音量)
 * - Drum: 節奏 (噪音+濾波)
 *
 * 每首曲子定義：音階、速度、樂器組合、旋律模式
 */

// ─── 音符頻率表 ───
const NOTE: Record<string, number> = {
  C3: 131, D3: 147, E3: 165, F3: 175, G3: 196, A3: 220, B3: 247,
  C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494,
  C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988,
  'Db3': 139, 'Eb3': 156, 'Gb3': 185, 'Ab3': 208, 'Bb3': 233,
  'Db4': 277, 'Eb4': 311, 'Gb4': 370, 'Ab4': 415, 'Bb4': 466,
  'Db5': 554, 'Eb5': 622, 'Gb5': 740, 'Ab5': 831, 'Bb5': 932,
  R: 0, // rest
};

interface TrackDef {
  name: string;
  bpm: number;
  melody: number[];        // frequencies
  melodyRhythm: number[];  // beats per note (1 = quarter)
  melodyWave: OscillatorType;
  melodyVol: number;
  bass: number[];
  bassRhythm: number[];
  bassWave: OscillatorType;
  bassVol: number;
  padChords: number[][];   // chords, each plays for 4 beats
  padWave: OscillatorType;
  padVol: number;
  drumPattern: number[];   // 1=kick 2=snare 3=hihat 0=rest, per 8th note
  drumVol: number;
  loopBars: number;        // how many bars before loop
}

// ─── 音階工具 ───
function scaleNotes(root: number, pattern: number[], octaves: number = 2): number[] {
  const result: number[] = [];
  let freq = root;
  for (let oct = 0; oct < octaves; oct++) {
    for (const interval of pattern) {
      result.push(freq);
      freq *= Math.pow(2, interval / 12);
    }
  }
  return result;
}

const MAJOR = [2, 2, 1, 2, 2, 2, 1];
const MINOR = [2, 1, 2, 2, 1, 2, 2];
const PENTATONIC = [2, 2, 3, 2, 3];
const PENT_MINOR = [3, 2, 2, 3, 2];
const DORIAN = [2, 1, 2, 2, 2, 1, 2];
const MIXOLYDIAN = [2, 2, 1, 2, 2, 1, 2];

function melodyFromScale(notes: number[], pattern: number[]): number[] {
  return pattern.map(i => i < 0 ? 0 : notes[i % notes.length] * Math.pow(2, Math.floor(i / notes.length)));
}

function generateDrumLoop(style: 'epic' | 'march' | 'calm' | 'battle' | 'boss' | 'waltz' | 'tribal' | 'none'): number[] {
  switch (style) {
    case 'epic':    return [1,0,3,0,2,0,3,0, 1,0,3,3,2,0,3,0];
    case 'march':   return [1,0,3,0,2,0,3,0, 1,0,3,0,2,3,2,3];
    case 'calm':    return [0,0,3,0,0,0,3,0, 0,0,3,0,0,0,3,0];
    case 'battle':  return [1,3,2,3,1,3,2,3, 1,1,2,3,1,3,2,2];
    case 'boss':    return [1,3,1,3,2,3,2,3, 1,1,1,3,2,2,2,3];
    case 'waltz':   return [1,0,0,3,3,0, 1,0,0,3,3,0];
    case 'tribal':  return [1,0,2,0,1,3,2,0, 1,3,2,3,1,0,2,3];
    case 'none':    return [0,0,0,0,0,0,0,0];
  }
}

// ─── 曲目定義 (30+) ───
function defineTracks(): Record<string, TrackDef> {
  // ─── 開頭 / 通用 ───
  const title: TrackDef = {
    name: '開頭主題', bpm: 72, loopBars: 8,
    melody: melodyFromScale(scaleNotes(NOTE.C4, MAJOR), [0,2,4,7, 4,2,0,2, 4,5,7,9, 7,5,4,2]),
    melodyRhythm: [2,2,2,2, 2,2,2,2, 2,2,2,2, 2,2,2,2],
    melodyWave: 'triangle', melodyVol: 0.18,
    bass: [NOTE.C3, NOTE.C3, NOTE.G3, NOTE.G3, NOTE.A3, NOTE.A3, NOTE.F3, NOTE.F3],
    bassRhythm: [4,4,4,4,4,4,4,4], bassWave: 'sine', bassVol: 0.15,
    padChords: [[NOTE.C4,NOTE.E4,NOTE.G4],[NOTE.G3,NOTE.B3,NOTE.D4],[NOTE.A3,NOTE.C4,NOTE.E4],[NOTE.F3,NOTE.A3,NOTE.C4]],
    padWave: 'triangle', padVol: 0.06,
    drumPattern: generateDrumLoop('epic'), drumVol: 0.08,
  };

  const victory: TrackDef = {
    name: '勝利', bpm: 132, loopBars: 4,
    melody: melodyFromScale(scaleNotes(NOTE.C5, MAJOR), [0,2,4,5,7,7,5,4, 5,4,2,0,2,4,5,7]),
    melodyRhythm: [1,1,1,1,2,2,1,1, 1,1,1,1,2,2,2,2],
    melodyWave: 'triangle', melodyVol: 0.16,
    bass: [NOTE.C3,NOTE.G3,NOTE.A3,NOTE.F3], bassRhythm: [4,4,4,4],
    bassWave: 'sine', bassVol: 0.14,
    padChords: [[NOTE.C4,NOTE.E4,NOTE.G4],[NOTE.G3,NOTE.B3,NOTE.D4],[NOTE.A3,NOTE.C4,NOTE.E4],[NOTE.F3,NOTE.A3,NOTE.C4]],
    padWave: 'triangle', padVol: 0.06,
    drumPattern: generateDrumLoop('march'), drumVol: 0.1,
  };

  const gameover: TrackDef = {
    name: '全滅', bpm: 50, loopBars: 4,
    melody: melodyFromScale(scaleNotes(NOTE.A3, MINOR), [4,3,2,1, 0,-1,-1,-1, 2,1,0,-1, -1,-1,-1,-1]),
    melodyRhythm: [2,2,2,2, 4,4,4,4, 2,2,2,2, 4,4,4,4],
    melodyWave: 'sine', melodyVol: 0.12,
    bass: [NOTE.A3,0,NOTE.E3,0], bassRhythm: [4,4,4,4],
    bassWave: 'sine', bassVol: 0.1,
    padChords: [[NOTE.A3,NOTE.C4,NOTE.E4],[0],[NOTE.E3,NOTE.G3,NOTE.B3],[0]],
    padWave: 'sine', padVol: 0.04,
    drumPattern: generateDrumLoop('none'), drumVol: 0,
  };

  const ending: TrackDef = {
    name: '結局', bpm: 80, loopBars: 8,
    melody: melodyFromScale(scaleNotes(NOTE.C4, MAJOR), [0,4,7,9, 7,4,5,2, 0,4,7,12, 9,7,5,4]),
    melodyRhythm: [2,2,2,2, 2,2,2,2, 2,2,2,2, 2,2,4,4],
    melodyWave: 'triangle', melodyVol: 0.16,
    bass: [NOTE.C3,NOTE.F3,NOTE.G3,NOTE.C3, NOTE.A3,NOTE.F3,NOTE.G3,NOTE.C3],
    bassRhythm: [4,4,4,4,4,4,4,4], bassWave: 'sine', bassVol: 0.14,
    padChords: [[NOTE.C4,NOTE.E4,NOTE.G4],[NOTE.F3,NOTE.A3,NOTE.C4],[NOTE.G3,NOTE.B3,NOTE.D4],[NOTE.C4,NOTE.E4,NOTE.G4]],
    padWave: 'triangle', padVol: 0.07,
    drumPattern: generateDrumLoop('calm'), drumVol: 0.06,
  };

  const sad: TrackDef = {
    name: '悲傷', bpm: 56, loopBars: 4,
    melody: melodyFromScale(scaleNotes(NOTE.A3, MINOR), [0,2,4,3, 2,0,-1,0, 4,3,2,1, 0,-1,-1,0]),
    melodyRhythm: [2,2,3,1, 2,2,2,2, 2,2,3,1, 2,2,4,2],
    melodyWave: 'sine', melodyVol: 0.14,
    bass: [NOTE.A3,NOTE.F3,NOTE.E3,NOTE.A3], bassRhythm: [4,4,4,4],
    bassWave: 'sine', bassVol: 0.1,
    padChords: [[NOTE.A3,NOTE.C4,NOTE.E4],[NOTE.F3,NOTE.A3,NOTE.C4],[NOTE.E3,NOTE.G3,NOTE.B3],[NOTE.A3,NOTE.C4,NOTE.E4]],
    padWave: 'sine', padVol: 0.05,
    drumPattern: generateDrumLoop('none'), drumVol: 0,
  };

  const happy: TrackDef = {
    name: '歡樂', bpm: 120, loopBars: 4,
    melody: melodyFromScale(scaleNotes(NOTE.C4, MAJOR), [0,2,4,2, 4,5,7,5, 7,9,7,5, 4,2,0,4]),
    melodyRhythm: [1,1,1,1, 1,1,2,2, 1,1,1,1, 1,1,2,2],
    melodyWave: 'triangle', melodyVol: 0.15,
    bass: [NOTE.C3,NOTE.G3,NOTE.F3,NOTE.G3], bassRhythm: [4,4,4,4],
    bassWave: 'triangle', bassVol: 0.12,
    padChords: [[NOTE.C4,NOTE.E4,NOTE.G4],[NOTE.G3,NOTE.B3,NOTE.D4],[NOTE.F3,NOTE.A3,NOTE.C4],[NOTE.G3,NOTE.B3,NOTE.D4]],
    padWave: 'triangle', padVol: 0.05,
    drumPattern: generateDrumLoop('march'), drumVol: 0.08,
  };

  const thinking: TrackDef = {
    name: '思考', bpm: 60, loopBars: 4,
    melody: melodyFromScale(scaleNotes(NOTE.D4, DORIAN), [0,2,3,5, 3,2,0,-1, 2,3,5,7, 5,3,2,0]),
    melodyRhythm: [2,2,2,2, 2,2,4,2, 2,2,2,2, 2,2,4,2],
    melodyWave: 'sine', melodyVol: 0.1,
    bass: [NOTE.D3,NOTE.A3,NOTE.G3,NOTE.D3], bassRhythm: [4,4,4,4],
    bassWave: 'sine', bassVol: 0.08,
    padChords: [[NOTE.D4,NOTE.F4,NOTE.A4],[NOTE.A3,NOTE.C4,NOTE.E4],[NOTE.G3,NOTE.B3,NOTE.D4],[NOTE.D4,NOTE.F4,NOTE.A4]],
    padWave: 'sine', padVol: 0.04,
    drumPattern: generateDrumLoop('none'), drumVol: 0,
  };

  const companion: TrackDef = {
    name: '夥伴加入', bpm: 100, loopBars: 4,
    melody: melodyFromScale(scaleNotes(NOTE.G4, MAJOR), [0,2,4,5, 7,9,7,5, 4,5,7,9, 12,9,7,5]),
    melodyRhythm: [1,1,1,1, 2,2,1,1, 1,1,2,2, 2,2,2,2],
    melodyWave: 'triangle', melodyVol: 0.16,
    bass: [NOTE.G3,NOTE.C3,NOTE.D3,NOTE.G3], bassRhythm: [4,4,4,4],
    bassWave: 'sine', bassVol: 0.12,
    padChords: [[NOTE.G3,NOTE.B3,NOTE.D4],[NOTE.C4,NOTE.E4,NOTE.G4],[NOTE.D4,NOTE.Gb4,NOTE.A4],[NOTE.G3,NOTE.B3,NOTE.D4]],
    padWave: 'triangle', padVol: 0.06,
    drumPattern: generateDrumLoop('march'), drumVol: 0.07,
  };

  const memory: TrackDef = {
    name: '回憶', bpm: 54, loopBars: 4,
    melody: melodyFromScale(scaleNotes(NOTE.E4, MINOR), [0,2,4,7, 4,2,0,-1, 2,4,5,4, 2,0,-1,-1]),
    melodyRhythm: [3,1,2,2, 2,2,2,2, 3,1,2,2, 2,2,4,4],
    melodyWave: 'sine', melodyVol: 0.12,
    bass: [NOTE.E3,NOTE.C3,NOTE.D3,NOTE.E3], bassRhythm: [4,4,4,4],
    bassWave: 'sine', bassVol: 0.08,
    padChords: [[NOTE.E3,NOTE.G3,NOTE.B3],[NOTE.C3,NOTE.E3,NOTE.G3],[NOTE.D3,NOTE.Gb3,NOTE.A3],[NOTE.E3,NOTE.G3,NOTE.B3]],
    padWave: 'sine', padVol: 0.04,
    drumPattern: generateDrumLoop('none'), drumVol: 0,
  };

  const shop: TrackDef = {
    name: '商店', bpm: 110, loopBars: 4,
    melody: melodyFromScale(scaleNotes(NOTE.F4, MAJOR), [0,2,4,5, 4,2,0,2, 4,5,7,5, 4,2,0,4]),
    melodyRhythm: [1,1,1,1, 1,1,2,2, 1,1,1,1, 1,1,2,2],
    melodyWave: 'triangle', melodyVol: 0.13,
    bass: [NOTE.F3,NOTE.C3,NOTE.Bb3,NOTE.C3], bassRhythm: [4,4,4,4],
    bassWave: 'triangle', bassVol: 0.1,
    padChords: [[NOTE.F3,NOTE.A3,NOTE.C4],[NOTE.C3,NOTE.E3,NOTE.G3],[NOTE.Bb3,NOTE.D4,NOTE.F4],[NOTE.C4,NOTE.E4,NOTE.G4]],
    padWave: 'triangle', padVol: 0.05,
    drumPattern: generateDrumLoop('calm'), drumVol: 0.06,
  };

  // ─── 12 王國主題 ───
  const kingdom = (
    name: string, root: number, scale: number[], bpm: number,
    pattern: number[], wave: OscillatorType, drum: 'epic'|'march'|'calm'|'waltz'|'tribal'|'battle'|'boss'|'none'
  ): TrackDef => {
    const notes = scaleNotes(root, scale);
    return {
      name, bpm, loopBars: 8,
      melody: melodyFromScale(notes, pattern),
      melodyRhythm: pattern.map(() => 2),
      melodyWave: wave, melodyVol: 0.15,
      bass: [notes[0] / 2, notes[4] / 2, notes[3] / 2, notes[0] / 2, notes[2] / 2, notes[5] / 2, notes[4] / 2, notes[0] / 2],
      bassRhythm: [4,4,4,4,4,4,4,4], bassWave: 'sine', bassVol: 0.12,
      padChords: [
        [notes[0], notes[2], notes[4]],
        [notes[3], notes[5], notes[7 % notes.length]],
        [notes[4], notes[6 % notes.length], notes[1]],
        [notes[0], notes[2], notes[4]],
      ],
      padWave: 'triangle', padVol: 0.05,
      drumPattern: generateDrumLoop(drum), drumVol: drum === 'none' ? 0 : 0.07,
    };
  };

  const k_hero    = kingdom('勇者王國', NOTE.C4, MAJOR,     84, [0,4,7,5,4,2,0,2, 4,5,7,9,7,5,4,2], 'triangle', 'epic');
  const k_elf     = kingdom('精靈王國', NOTE.E4, PENTATONIC, 76, [0,1,3,4,3,1,0,1, 3,4,6,4,3,1,0,3], 'sine', 'calm');
  const k_treant  = kingdom('樹人王國', NOTE.G3, MAJOR,     66, [0,2,4,7,4,2,0,-1, 2,4,5,4,2,0,-1,0], 'triangle', 'none');
  const k_beast   = kingdom('獸人王國', NOTE.A3, PENT_MINOR, 100, [0,2,4,2,0,2,4,7, 4,2,0,2,4,7,4,2], 'sawtooth', 'tribal');
  const k_merfolk = kingdom('人魚王國', NOTE.D4, MAJOR,     72, [0,2,4,7,9,7,4,2, 0,4,7,12,9,7,4,2], 'sine', 'waltz');
  const k_giant   = kingdom('巨人王國', NOTE.C3, MIXOLYDIAN, 70, [0,2,4,5,7,5,4,2, 0,4,7,4,2,0,-1,0], 'triangle', 'epic');
  const k_dwarf   = kingdom('矮人王國', NOTE.D3, DORIAN,    96, [0,2,3,5,7,5,3,2, 0,3,5,7,5,3,2,0], 'triangle', 'march');
  const k_undead  = kingdom('不死王國', NOTE.A3, MINOR,     60, [0,1,3,4,3,1,0,-1, 3,4,7,4,3,1,0,-1], 'sine', 'none');
  const k_volcano = kingdom('火山族',   NOTE.E3, PENT_MINOR, 108, [0,2,4,2,4,7,4,2, 0,4,7,9,7,4,2,0], 'sawtooth', 'tribal');
  const k_spring  = kingdom('溫泉族',   NOTE.F4, MAJOR,     68, [0,2,4,5,4,2,0,2, 4,5,7,5,4,2,0,4], 'sine', 'calm');
  const k_mountain= kingdom('高山族',   NOTE.G4, PENTATONIC, 64, [0,1,3,4,3,1,0,1, 3,6,4,3,1,0,1,3], 'triangle', 'none');
  const k_demon   = kingdom('魔王城',   NOTE.C3, MINOR,     76, [0,3,5,7,5,3,0,3, 7,5,3,0,-1,0,3,5], 'sawtooth', 'boss');

  // ─── 12 王國城鎮主題 (calmer, softer versions for town scenes) ───
  const townTrack = (
    name: string, root: number, scale: number[], bpm: number,
    pattern: number[], drum: 'calm' | 'none' | 'waltz'
  ): TrackDef => {
    const notes = scaleNotes(root, scale);
    return {
      name, bpm, loopBars: 8,
      melody: melodyFromScale(notes, pattern),
      melodyRhythm: pattern.map(() => 2),
      melodyWave: 'sine', melodyVol: 0.12,
      bass: [notes[0] / 2, notes[4] / 2, notes[3] / 2, notes[0] / 2,
             notes[2] / 2, notes[5] / 2, notes[4] / 2, notes[0] / 2],
      bassRhythm: [4,4,4,4,4,4,4,4], bassWave: 'sine', bassVol: 0.1,
      padChords: [
        [notes[0], notes[2], notes[4]],
        [notes[3], notes[5], notes[7 % notes.length]],
        [notes[4], notes[6 % notes.length], notes[1]],
        [notes[0], notes[2], notes[4]],
      ],
      padWave: 'sine', padVol: 0.06,
      drumPattern: generateDrumLoop(drum), drumVol: drum === 'none' ? 0 : 0.05,
    };
  };

  const t_hero    = townTrack('勇者王國城鎮', NOTE.C4, MAJOR,      72, [0,2,4,2, 0,2,5,4, 2,4,7,5, 4,2,0,2], 'calm');
  const t_elf     = townTrack('精靈王國城鎮', NOTE.E4, PENTATONIC,  64, [0,3,1,4, 3,1,0,3, 1,4,3,1, 0,1,3,4], 'none');
  const t_treant  = townTrack('樹人王國城鎮', NOTE.G3, MAJOR,      56, [0,4,2,7, 2,0,-1,0, 4,2,5,4, 2,0,-1,2], 'none');
  const t_beast   = townTrack('獸人王國城鎮', NOTE.A3, PENT_MINOR,  80, [0,4,2,0, 2,4,7,4, 2,0,2,4, 7,4,2,0], 'calm');
  const t_merfolk = townTrack('人魚王國城鎮', NOTE.D4, MAJOR,      60, [0,4,7,4, 2,0,2,4, 7,9,7,4, 2,0,4,2], 'waltz');
  const t_giant   = townTrack('巨人王國城鎮', NOTE.C3, MIXOLYDIAN,  58, [0,4,2,5, 4,2,0,-1, 2,4,7,5, 4,2,0,2], 'calm');
  const t_dwarf   = townTrack('矮人王國城鎮', NOTE.D3, DORIAN,     78, [0,3,5,3, 2,0,3,5, 7,5,3,2, 0,2,3,5], 'calm');
  const t_undead  = townTrack('不死王國城鎮', NOTE.A3, MINOR,      50, [0,1,3,1, 0,-1,0,1, 3,4,3,1, 0,-1,-1,0], 'none');
  const t_volcano = townTrack('火山族城鎮',   NOTE.E3, PENT_MINOR,  84, [0,2,4,7, 4,2,0,2, 4,7,4,2, 0,2,4,2], 'calm');
  const t_spring  = townTrack('溫泉族城鎮',   NOTE.F4, MAJOR,      56, [0,4,2,5, 4,2,0,4, 5,4,2,0, 2,4,5,7], 'none');
  const t_mountain= townTrack('高山族城鎮',   NOTE.G4, PENTATONIC,  52, [0,3,1,4, 1,0,1,3, 4,3,1,0, 1,3,4,6], 'none');
  const t_demon   = townTrack('魔王城城鎮',   NOTE.C3, MINOR,      60, [0,3,5,3, 0,-1,0,3, 5,3,0,-1, 0,3,5,7], 'none');

  // ─── 戰鬥 (每王國有普通小怪戰鬥+Boss戰) ───
  function battleTrack(name: string, root: number, scale: number[], bpm: number, drumStyle: 'battle'|'boss'): TrackDef {
    const notes = scaleNotes(root, scale);
    const pattern = drumStyle === 'boss'
      ? [0,3,5,7,5,3,7,5, 0,5,7,9,7,5,3,0]
      : [0,2,4,2,4,5,4,2, 0,4,5,7,5,4,2,0];
    return {
      name, bpm, loopBars: 4,
      melody: melodyFromScale(notes, pattern),
      melodyRhythm: pattern.map(() => 1),
      melodyWave: drumStyle === 'boss' ? 'sawtooth' : 'triangle',
      melodyVol: 0.14,
      bass: [notes[0] / 2, notes[4] / 2, notes[3] / 2, notes[0] / 2],
      bassRhythm: [4,4,4,4], bassWave: 'sawtooth', bassVol: 0.1,
      padChords: [
        [notes[0], notes[2], notes[4]],
        [notes[3], notes[5], notes[7 % notes.length]],
        [notes[2], notes[4], notes[6 % notes.length]],
        [notes[0], notes[2], notes[4]],
      ],
      padWave: 'sawtooth', padVol: 0.04,
      drumPattern: generateDrumLoop(drumStyle), drumVol: 0.12,
    };
  }

  const b_hero    = battleTrack('勇者王國-戰鬥', NOTE.C4, MINOR, 144, 'battle');
  const b_elf     = battleTrack('精靈王國-戰鬥', NOTE.E4, MINOR, 138, 'battle');
  const b_treant  = battleTrack('樹人王國-戰鬥', NOTE.G3, MINOR, 132, 'battle');
  const b_beast   = battleTrack('獸人王國-戰鬥', NOTE.A3, PENT_MINOR, 152, 'battle');
  const b_merfolk = battleTrack('人魚王國-戰鬥', NOTE.D4, MINOR, 140, 'battle');
  const b_giant   = battleTrack('巨人王國-戰鬥', NOTE.C3, MINOR, 128, 'battle');
  const b_dwarf   = battleTrack('矮人王國-戰鬥', NOTE.D3, MINOR, 148, 'battle');
  const b_undead  = battleTrack('不死王國-戰鬥', NOTE.A3, MINOR, 136, 'battle');
  const b_volcano = battleTrack('火山族-戰鬥',   NOTE.E3, PENT_MINOR, 156, 'battle');
  const b_spring  = battleTrack('溫泉族-戰鬥',   NOTE.F4, MINOR, 134, 'battle');
  const b_mountain= battleTrack('高山族-戰鬥',   NOTE.G4, MINOR, 130, 'battle');
  const b_demon   = battleTrack('魔王城-戰鬥',   NOTE.C3, MINOR, 160, 'battle');

  const boss_hero    = battleTrack('勇者王國-Boss', NOTE.C3, MINOR, 120, 'boss');
  const boss_elf     = battleTrack('精靈王國-Boss', NOTE.E3, MINOR, 116, 'boss');
  const boss_treant  = battleTrack('樹人王國-Boss', NOTE.G3, MINOR, 112, 'boss');
  const boss_beast   = battleTrack('獸人王國-Boss', NOTE.A3, PENT_MINOR, 126, 'boss');
  const boss_merfolk = battleTrack('人魚王國-Boss', NOTE.D3, MINOR, 118, 'boss');
  const boss_giant   = battleTrack('巨人王國-Boss', NOTE.C3, MINOR, 108, 'boss');
  const boss_dwarf   = battleTrack('矮人王國-Boss', NOTE.D3, MINOR, 124, 'boss');
  const boss_undead  = battleTrack('不死王國-Boss', NOTE.A3, MINOR, 114, 'boss');
  const boss_volcano = battleTrack('火山族-Boss',   NOTE.E3, PENT_MINOR, 128, 'boss');
  const boss_spring  = battleTrack('溫泉族-Boss',   NOTE.F3, MINOR, 116, 'boss');
  const boss_mountain= battleTrack('高山族-Boss',   NOTE.G3, MINOR, 110, 'boss');
  const boss_demon   = battleTrack('大魔王',        NOTE.C3, MINOR, 96, 'boss');

  return {
    title, victory, gameover, ending, sad, happy, thinking, companion, memory, shop,
    // Kingdom themes (used for field/overworld)
    kingdom_hero: k_hero, kingdom_elf: k_elf, kingdom_treant: k_treant,
    kingdom_beast: k_beast, kingdom_merfolk: k_merfolk, kingdom_giant: k_giant,
    kingdom_dwarf: k_dwarf, kingdom_undead: k_undead, kingdom_volcano: k_volcano,
    kingdom_hotspring: k_spring, kingdom_mountain: k_mountain, kingdom_demon: k_demon,
    // Town themes (calmer versions for towns)
    town_hero: t_hero, town_elf: t_elf, town_treant: t_treant,
    town_beast: t_beast, town_merfolk: t_merfolk, town_giant: t_giant,
    town_dwarf: t_dwarf, town_undead: t_undead, town_volcano: t_volcano,
    town_hotspring: t_spring, town_mountain: t_mountain, town_demon: t_demon,
    // Battle themes
    battle_hero: b_hero, battle_elf: b_elf, battle_treant: b_treant,
    battle_beast: b_beast, battle_merfolk: b_merfolk, battle_giant: b_giant,
    battle_dwarf: b_dwarf, battle_undead: b_undead, battle_volcano: b_volcano,
    battle_hotspring: b_spring, battle_mountain: b_mountain, battle_demon: b_demon,
    // Boss themes
    boss_hero, boss_elf, boss_treant, boss_beast, boss_merfolk, boss_giant,
    boss_dwarf, boss_undead, boss_volcano, boss_hotspring: boss_spring,
    boss_mountain, boss_demon,
  };
}

// ─── 音樂播放引擎 ───
interface ActiveNodes {
  oscillators: OscillatorNode[];
  gains: GainNode[];
  sources: AudioBufferSourceNode[];
  timeout: ReturnType<typeof setTimeout> | null;
}

class AudioManagerClass {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmVolume = 0.2;
  private sfxVolume = 0.3;
  private bgmMuted = false;
  private sfxMuted = false;
  private bgmVolumeBeforeMute = 0.2;
  private sfxVolumeBeforeMute = 0.3;
  private activeNodes: ActiveNodes = { oscillators: [], gains: [], sources: [], timeout: null };
  private currentTrackKey = '';
  private loopTimeout: ReturnType<typeof setTimeout> | null = null;
  private tracks: Record<string, TrackDef> | null = null;
  // AI pre-recorded audio (AI first, procedural fallback)
  private preRecorded: Map<string, AudioBuffer> = new Map();
  private preRecordedBgmSource: AudioBufferSourceNode | null = null;

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('audio_settings');
      if (saved) {
        const s = JSON.parse(saved);
        if (typeof s.bgmVolume === 'number') this.bgmVolume = s.bgmVolume;
        if (typeof s.sfxVolume === 'number') this.sfxVolume = s.sfxVolume;
        if (typeof s.bgmMuted === 'boolean') this.bgmMuted = s.bgmMuted;
        if (typeof s.sfxMuted === 'boolean') this.sfxMuted = s.sfxMuted;
        // saveSettings stores pre-mute volume, so restore accordingly
        this.bgmVolumeBeforeMute = this.bgmVolume;
        this.sfxVolumeBeforeMute = this.sfxVolume;
        if (this.bgmMuted) this.bgmVolume = 0;
        if (this.sfxMuted) this.sfxVolume = 0;
      }
    } catch { /* ignore corrupt data */ }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('audio_settings', JSON.stringify({
        bgmVolume: this.bgmMuted ? this.bgmVolumeBeforeMute : this.bgmVolume,
        sfxVolume: this.sfxMuted ? this.sfxVolumeBeforeMute : this.sfxVolume,
        bgmMuted: this.bgmMuted,
        sfxMuted: this.sfxMuted,
      }));
    } catch { /* storage full or unavailable */ }
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.audioContext.destination);
      this.bgmGain = this.audioContext.createGain();
      this.bgmGain.gain.value = this.bgmMuted ? 0 : this.bgmVolume;
      this.bgmGain.connect(this.masterGain);
      this.sfxGain = this.audioContext.createGain();
      this.sfxGain.gain.value = this.sfxMuted ? 0 : this.sfxVolume;
      this.sfxGain.connect(this.masterGain);
    }
    if (!this.tracks) this.tracks = defineTracks();
    return this.audioContext;
  }

  setBgmVolume(vol: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.bgmGain) this.bgmGain.gain.value = this.bgmVolume;
    if (!this.bgmMuted) this.bgmVolumeBeforeMute = this.bgmVolume;
    this.saveSettings();
  }

  setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
    if (!this.sfxMuted) this.sfxVolumeBeforeMute = this.sfxVolume;
    this.saveSettings();
  }

  getBgmVolume(): number { return this.bgmVolume; }
  getSfxVolume(): number { return this.sfxVolume; }

  toggleBgmMute(): boolean {
    if (!this.bgmMuted) {
      this.bgmMuted = true;
      this.bgmVolumeBeforeMute = this.bgmVolume;
      this.bgmVolume = 0;
      if (this.bgmGain) this.bgmGain.gain.value = 0;
    } else {
      this.bgmMuted = false;
      this.bgmVolume = this.bgmVolumeBeforeMute;
      if (this.bgmGain) this.bgmGain.gain.value = this.bgmVolume;
    }
    this.saveSettings();
    return this.bgmMuted;
  }

  toggleSfxMute(): boolean {
    if (!this.sfxMuted) {
      this.sfxMuted = true;
      this.sfxVolumeBeforeMute = this.sfxVolume;
      this.sfxVolume = 0;
      if (this.sfxGain) this.sfxGain.gain.value = 0;
    } else {
      this.sfxMuted = false;
      this.sfxVolume = this.sfxVolumeBeforeMute;
      if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
    }
    this.saveSettings();
    return this.sfxMuted;
  }

  isBgmMuted(): boolean { return this.bgmMuted; }
  isSfxMuted(): boolean { return this.sfxMuted; }

  // ─── AI pre-recorded audio registration ───
  registerPreRecorded(key: string, buffer: AudioBuffer): void {
    this.preRecorded.set(key, buffer);
  }

  hasPreRecorded(key: string): boolean {
    return this.preRecorded.has(key);
  }

  // ─── Region-aware BGM mapping ───
  playBgm(type: string, regionId?: string): void {
    const trackKey = this.resolveTrackKey(type, regionId);
    if (trackKey === this.currentTrackKey) return; // already playing
    this.stopBgm();
    this.currentTrackKey = trackKey;

    // AI first: check for pre-recorded audio
    const aiKey = this.resolveBgmAIKey(type);
    const buffer = aiKey ? this.preRecorded.get(aiKey) : undefined;
    if (buffer) {
      this.playPreRecordedBgm(buffer);
      return;
    }

    // Procedural fallback
    const ctx = this.getContext();
    const track = this.tracks![trackKey];
    if (!track) return;

    this.playTrack(ctx, track);
  }

  private resolveBgmAIKey(type: string): string | undefined {
    // Only use AI audio for non-region-specific types.
    // Region types (field/town/battle/boss) use procedural per-kingdom music.
    const keyMap: Record<string, string> = {
      title: 'title', victory: 'victory',
      gameover: 'gameover', shop: 'shop',
    };
    return keyMap[type];
  }

  private playPreRecordedBgm(buffer: AudioBuffer): void {
    const ctx = this.getContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.bgmGain!);
    source.start();
    this.preRecordedBgmSource = source;
  }

  private resolveTrackKey(type: string, regionId?: string): string {
    // Direct track names
    if (this.tracks && this.tracks[type]) return type;

    // Map generic types to region-specific
    const regionSuffix = regionId?.replace('region_', '') ?? '';
    switch (type) {
      case 'title': return 'title';
      case 'victory': return 'victory';
      case 'gameover': return 'gameover';
      case 'ending': return 'ending';
      case 'sad': return 'sad';
      case 'happy': return 'happy';
      case 'thinking': return 'thinking';
      case 'companion': return 'companion';
      case 'memory': return 'memory';
      case 'shop': return 'shop';
      case 'town':
        return regionId ? `town_${regionSuffix}` : 'town_hero';
      case 'field':
        return regionId ? `kingdom_${regionSuffix}` : 'kingdom_hero';
      case 'battle':
        return regionId ? `battle_${regionSuffix}` : 'battle_hero';
      case 'boss':
        return regionId ? `boss_${regionSuffix}` : 'boss_hero';
      default:
        return type;
    }
  }

  private playTrack(ctx: AudioContext, track: TrackDef): void {
    const beatDur = 60 / track.bpm;  // seconds per beat
    const totalBeats = track.loopBars * 4;
    const loopDuration = totalBeats * beatDur;

    // ─── Melody ───
    if (track.melodyVol > 0) {
      const melodyOsc = ctx.createOscillator();
      const melodyGain = ctx.createGain();
      melodyOsc.type = track.melodyWave;
      melodyGain.gain.value = 0;

      let t = ctx.currentTime + 0.05;
      for (let loop = 0; loop < 3; loop++) {
        for (let i = 0; i < track.melody.length; i++) {
          const freq = track.melody[i];
          const dur = (track.melodyRhythm[i] ?? 1) * beatDur;
          if (freq > 20) {
            melodyGain.gain.setValueAtTime(track.melodyVol, t);
            melodyOsc.frequency.setValueAtTime(freq, t);
            // Soft release
            melodyGain.gain.setValueAtTime(track.melodyVol, t + dur * 0.7);
            melodyGain.gain.linearRampToValueAtTime(0, t + dur * 0.95);
          } else {
            melodyGain.gain.setValueAtTime(0, t);
          }
          t += dur;
        }
      }
      melodyOsc.connect(melodyGain);
      melodyGain.connect(this.bgmGain!);
      melodyOsc.start(ctx.currentTime);
      melodyOsc.stop(ctx.currentTime + loopDuration * 3 + 1);
      this.activeNodes.oscillators.push(melodyOsc);
      this.activeNodes.gains.push(melodyGain);
    }

    // ─── Bass ───
    if (track.bassVol > 0) {
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = track.bassWave;
      bassGain.gain.value = 0;

      let t = ctx.currentTime + 0.05;
      for (let loop = 0; loop < 3; loop++) {
        for (let i = 0; i < track.bass.length; i++) {
          const freq = track.bass[i];
          const dur = (track.bassRhythm[i] ?? 4) * beatDur;
          if (freq > 20) {
            bassGain.gain.setValueAtTime(track.bassVol, t);
            bassOsc.frequency.setValueAtTime(freq, t);
            bassGain.gain.setValueAtTime(track.bassVol, t + dur * 0.8);
            bassGain.gain.linearRampToValueAtTime(0, t + dur * 0.98);
          } else {
            bassGain.gain.setValueAtTime(0, t);
          }
          t += dur;
        }
      }
      bassOsc.connect(bassGain);
      bassGain.connect(this.bgmGain!);
      bassOsc.start(ctx.currentTime);
      bassOsc.stop(ctx.currentTime + loopDuration * 3 + 1);
      this.activeNodes.oscillators.push(bassOsc);
      this.activeNodes.gains.push(bassGain);
    }

    // ─── Pad (chords) ───
    if (track.padVol > 0) {
      for (const chord of track.padChords[0]?.length ? [0] : []) { /* skip if empty */ }
      // Each chord note gets its own oscillator
      const chordDur = totalBeats / track.padChords.length * beatDur;
      for (let voiceIdx = 0; voiceIdx < 3; voiceIdx++) {
        const padOsc = ctx.createOscillator();
        const padGain = ctx.createGain();
        padOsc.type = track.padWave;
        padGain.gain.value = 0;

        let t = ctx.currentTime + 0.05;
        for (let loop = 0; loop < 3; loop++) {
          for (const chord of track.padChords) {
            const freq = chord[voiceIdx] ?? 0;
            if (freq > 20) {
              padGain.gain.setValueAtTime(track.padVol, t);
              padOsc.frequency.setValueAtTime(freq, t);
              // Gentle swell
              padGain.gain.linearRampToValueAtTime(track.padVol, t + chordDur * 0.1);
              padGain.gain.setValueAtTime(track.padVol, t + chordDur * 0.85);
              padGain.gain.linearRampToValueAtTime(track.padVol * 0.3, t + chordDur * 0.99);
            } else {
              padGain.gain.setValueAtTime(0, t);
            }
            t += chordDur;
          }
        }
        padOsc.connect(padGain);
        padGain.connect(this.bgmGain!);
        padOsc.start(ctx.currentTime);
        padOsc.stop(ctx.currentTime + loopDuration * 3 + 1);
        this.activeNodes.oscillators.push(padOsc);
        this.activeNodes.gains.push(padGain);
      }
    }

    // ─── Drums (noise-based) ───
    if (track.drumVol > 0 && track.drumPattern.some(d => d > 0)) {
      this.playDrumTrack(ctx, track, loopDuration);
    }

    // Schedule re-loop
    this.loopTimeout = setTimeout(() => {
      if (this.currentTrackKey) {
        this.cleanupNodes();
        this.playTrack(ctx, track);
      }
    }, (loopDuration * 3 - 0.5) * 1000);
  }

  private playDrumTrack(ctx: AudioContext, track: TrackDef, loopDuration: number): void {
    const eighthNote = 60 / track.bpm / 2;
    const buffer = this.createNoiseBuffer(ctx, 0.1);

    let t = ctx.currentTime + 0.05;
    for (let loop = 0; loop < 3; loop++) {
      for (let rep = 0; rep < track.loopBars; rep++) {
        for (let i = 0; i < track.drumPattern.length; i++) {
          const hit = track.drumPattern[i];
          if (hit > 0) {
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const drumGain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            if (hit === 1) { // kick
              filter.type = 'lowpass';
              filter.frequency.value = 150;
              drumGain.gain.setValueAtTime(track.drumVol * 1.2, t);
              drumGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            } else if (hit === 2) { // snare
              filter.type = 'bandpass';
              filter.frequency.value = 1000;
              filter.Q.value = 0.5;
              drumGain.gain.setValueAtTime(track.drumVol * 0.8, t);
              drumGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            } else { // hihat
              filter.type = 'highpass';
              filter.frequency.value = 5000;
              drumGain.gain.setValueAtTime(track.drumVol * 0.4, t);
              drumGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            }

            source.connect(filter);
            filter.connect(drumGain);
            drumGain.connect(this.bgmGain!);
            source.start(t);
            source.stop(t + 0.1);
            this.activeNodes.sources.push(source);
            this.activeNodes.gains.push(drumGain);
          }
          t += eighthNote;
        }
      }
    }
  }

  private createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const size = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, size, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  stopBgm(): void {
    this.currentTrackKey = '';
    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }
    // Stop pre-recorded BGM source if playing
    if (this.preRecordedBgmSource) {
      try { this.preRecordedBgmSource.stop(); } catch { /* already stopped */ }
      try { this.preRecordedBgmSource.disconnect(); } catch { /* ok */ }
      this.preRecordedBgmSource = null;
    }
    this.cleanupNodes();
  }

  private cleanupNodes(): void {
    for (const osc of this.activeNodes.oscillators) {
      try { osc.stop(); } catch { /* already stopped */ }
      try { osc.disconnect(); } catch { /* ok */ }
    }
    for (const src of this.activeNodes.sources) {
      try { src.stop(); } catch { /* already stopped */ }
      try { src.disconnect(); } catch { /* ok */ }
    }
    for (const gain of this.activeNodes.gains) {
      try { gain.disconnect(); } catch { /* ok */ }
    }
    this.activeNodes = { oscillators: [], gains: [], sources: [], timeout: null };
  }

  // ─── SFX (improved) ───
  playSfx(type: 'select' | 'cancel' | 'hit' | 'magic' | 'heal' | 'levelup' | 'fanfare' | 'step' | 'equip' | 'fail' | 'warning'): void {
    // AI first: check for pre-recorded SFX
    const aiKey = `sfx_${type}`;
    const buffer = this.preRecorded.get(aiKey);
    if (buffer) {
      const ctx = this.getContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.sfxGain!);
      source.start();
      return;
    }

    // Procedural fallback
    const ctx = this.getContext();

    switch (type) {
      case 'select':
        this.playToneSequence(ctx, [{ f: 440, d: 0.04 }, { f: 660, d: 0.06 }], 'sine', 0.10);
        break;
      case 'cancel':
        this.playToneSequence(ctx, [{ f: 440, d: 0.04 }, { f: 330, d: 0.08 }], 'sine', 0.08);
        break;
      case 'hit':
        this.playNoiseBurst(ctx, 150, 0.12, 0.2);
        this.playToneSequence(ctx, [{ f: 120, d: 0.08 }, { f: 80, d: 0.1 }], 'sawtooth', 0.15);
        break;
      case 'magic':
        this.playToneSequence(ctx, [
          { f: 600, d: 0.05 }, { f: 800, d: 0.05 }, { f: 1000, d: 0.05 },
          { f: 1200, d: 0.08 }, { f: 1000, d: 0.06 }, { f: 800, d: 0.1 },
        ], 'sine', 0.1);
        break;
      case 'heal':
        this.playToneSequence(ctx, [
          { f: 400, d: 0.08 }, { f: 500, d: 0.08 }, { f: 600, d: 0.08 }, { f: 800, d: 0.15 },
        ], 'sine', 0.12);
        break;
      case 'levelup':
        this.playToneSequence(ctx, [
          { f: 523, d: 0.1 }, { f: 659, d: 0.1 }, { f: 784, d: 0.1 }, { f: 1047, d: 0.3 },
        ], 'triangle', 0.18);
        break;
      case 'fanfare':
        this.playToneSequence(ctx, [
          { f: 523, d: 0.12 }, { f: 523, d: 0.06 }, { f: 523, d: 0.06 },
          { f: 659, d: 0.1 }, { f: 784, d: 0.15 }, { f: 1047, d: 0.4 },
        ], 'triangle', 0.16);
        break;
      case 'step':
        this.playToneSequence(ctx, [{ f: 180, d: 0.03 }], 'triangle', 0.04);
        break;
      case 'equip':
        this.playToneSequence(ctx, [{ f: 330, d: 0.04 }, { f: 440, d: 0.04 }, { f: 554, d: 0.08 }], 'triangle', 0.12);
        break;
      case 'fail':
        this.playToneSequence(ctx, [{ f: 400, d: 0.06 }, { f: 300, d: 0.06 }, { f: 200, d: 0.12 }], 'square', 0.2);
        this.playNoiseBurst(ctx, 300, 0.08, 0.15);
        break;
      case 'warning':
        // Two descending alarm pulses — urgent low tone
        this.playToneSequence(ctx, [
          { f: 520, d: 0.1 }, { f: 380, d: 0.15 },
          { f: 520, d: 0.1 }, { f: 380, d: 0.2 },
        ], 'square', 0.15);
        break;
    }
  }

  private playToneSequence(ctx: AudioContext, tones: { f: number; d: number }[], wave: OscillatorType, vol: number): void {
    let t = ctx.currentTime;
    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = tone.f;
      gain.gain.setValueAtTime(vol * this.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + tone.d);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + tone.d + 0.02);
      t += tone.d;
    }
  }

  private playNoiseBurst(ctx: AudioContext, filterFreq: number, duration: number, vol: number): void {
    const buffer = this.createNoiseBuffer(ctx, duration);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * this.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    source.start();
    source.stop(ctx.currentTime + duration + 0.02);
  }

  resume(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  /** Get list of all available tracks */
  getTrackList(): string[] {
    this.getContext(); // ensure tracks are initialized
    return Object.keys(this.tracks ?? {});
  }
}

export const audioManager = new AudioManagerClass();
