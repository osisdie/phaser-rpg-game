import type { RegionData } from '../types';
import { getAllRegions } from '../data/regions/index';
import { gameState } from '../systems/GameStateManager';

export interface WorldNode {
  region: RegionData;
  screenX: number;
  screenY: number;
  visited: boolean;
  liberated: boolean;
  accessible: boolean;
}

/** Build world map node data for rendering */
export function buildWorldMapNodes(): WorldNode[] {
  const regions = getAllRegions();
  const state = gameState.getState();

  // Starting kingdoms are always accessible
  const startingRegions = new Set(['region_hero', 'region_elf', 'region_treant']);
  // Non-demon kingdoms that must all be liberated to access demon castle
  const nonDemonKingdoms = regions.filter(r => r.type !== 'final').map(r => r.id);
  const allNonDemonLiberated = nonDemonKingdoms.every(id => state.liberatedRegions.includes(id));

  return regions.map(region => {
    const visited = state.visitedRegions.includes(region.id);
    const liberated = state.liberatedRegions.includes(region.id);

    // Liberation-based unlocking:
    // 1. Starting 3 kingdoms always accessible
    // 2. Other kingdoms accessible if connected to a liberated region
    // 3. Demon castle requires all non-demon kingdoms liberated
    let accessible: boolean;
    if (startingRegions.has(region.id)) {
      accessible = true;
    } else if (region.type === 'final') {
      accessible = allNonDemonLiberated;
    } else {
      accessible = region.connections.some(c => state.liberatedRegions.includes(c));
    }

    return {
      region,
      screenX: region.worldMapPosition.x,
      screenY: region.worldMapPosition.y,
      visited,
      liberated,
      accessible,
    };
  });
}

/** Get connections for drawing lines between regions */
export function getWorldConnections(): { from: RegionData; to: RegionData }[] {
  const regions = getAllRegions();
  const connections: { from: RegionData; to: RegionData }[] = [];
  const seen = new Set<string>();

  for (const region of regions) {
    for (const connId of region.connections) {
      const key = [region.id, connId].sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        const connRegion = regions.find(r => r.id === connId);
        if (connRegion) {
          connections.push({ from: region, to: connRegion });
        }
      }
    }
  }

  return connections;
}
