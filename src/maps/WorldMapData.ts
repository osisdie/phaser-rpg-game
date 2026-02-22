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

  return regions.map(region => {
    const visited = state.visitedRegions.includes(region.id);
    const liberated = state.liberatedRegions.includes(region.id);

    // A region is accessible if connected to a visited region, or is the starting region
    const accessible = region.id === 'region_hero' || region.connections.some(c =>
      state.visitedRegions.includes(c)
    );

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
