import type { CharacterAppearance } from './CharacterParts';
import { generateNPCAppearance } from './CharacterParts';

/**
 * NPCProfiles — Maps NPC data to texture keys.
 * Called by TownScene to determine which spritesheet to use for each NPC.
 */

/** Get the texture key for an NPC based on type and a numeric seed */
export function getNPCTextureKey(npcType: string, seed: number): string {
  const validTypes = ['shop', 'quest', 'save', 'info', 'inn'];
  const type = validTypes.includes(npcType) ? npcType : 'info';
  const variant = seed % 6;
  return `char_npc_${type}_${variant}`;
}

/** Get the texture key for a companion by their companion ID */
export function getCompanionTextureKey(companionId: string): string {
  return `char_${companionId}`;
}
