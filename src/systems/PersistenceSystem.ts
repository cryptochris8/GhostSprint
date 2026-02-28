/**
 * Per-player data persistence.
 * Wraps the HYTOPIA player.getPersistedData / setPersistedData API.
 */

import type { Player } from 'hytopia';
import { XP_PER_LEVEL, COINS_PER_LEVEL_UP, DEBUG_MODE } from '../config/gameConfig';
import type { GhostRecording } from './GhostSystem';

export interface PlayerData {
  xp: number;
  level: number;
  wins: number;
  podiums: number;
  bestTimeMs: number | null;   // null = no time set
  bestRespawns: number | null;
  ghostData: GhostRecording | null;
  coins: number;
  ownedCosmetics: string[];
  equippedTrailId: string | null;
  equippedFinishEffectId: string | null;
}

const DEFAULT_DATA: PlayerData = {
  xp: 0,
  level: 0,
  wins: 0,
  podiums: 0,
  bestTimeMs: null,
  bestRespawns: null,
  ghostData: null,
  coins: 0,
  ownedCosmetics: [],
  equippedTrailId: null,
  equippedFinishEffectId: null,
};

export class PersistenceSystem {
  private _cache: Map<string, PlayerData> = new Map();
  private _activeCourseId = 'course1';

  /** Set the active course ID (call when course changes) */
  setCourseId(id: string): void {
    this._activeCourseId = id;
  }

  /** Load player data from persistence (call on join) */
  load(player: Player): PlayerData {
    const raw = player.getPersistedData() as Record<string, unknown> | undefined;
    const stored = raw?.[this._activeCourseId] as Partial<PlayerData> | undefined;

    const data: PlayerData = {
      ...DEFAULT_DATA,
      ...stored,
      // Ensure arrays are arrays
      ownedCosmetics: Array.isArray(stored?.ownedCosmetics) ? stored.ownedCosmetics : [],
    };

    // Recalculate level
    data.level = Math.floor(data.xp / XP_PER_LEVEL);

    this._cache.set(player.id, data);
    if (DEBUG_MODE) console.log(`[Persistence] Loaded data for ${player.username}:`, JSON.stringify(data).slice(0, 200));
    return data;
  }

  /** Save player data to persistence */
  save(player: Player): void {
    const data = this._cache.get(player.id);
    if (!data) return;

    player.setPersistedData({ [this._activeCourseId]: data });
    if (DEBUG_MODE) console.log(`[Persistence] Saved data for ${player.username}`);
  }

  /** Get cached player data */
  get(playerId: string): PlayerData | undefined {
    return this._cache.get(playerId);
  }

  /** Add XP and handle level-ups. Returns { newLevel, leveled } */
  addXP(player: Player, amount: number): { newLevel: number; leveled: boolean; coinsAwarded: number } {
    const data = this._cache.get(player.id);
    if (!data) return { newLevel: 0, leveled: false, coinsAwarded: 0 };

    const oldLevel = data.level;
    data.xp += amount;
    data.level = Math.floor(data.xp / XP_PER_LEVEL);

    let coinsAwarded = 0;
    const leveled = data.level > oldLevel;
    if (leveled) {
      const levelsGained = data.level - oldLevel;
      coinsAwarded = levelsGained * COINS_PER_LEVEL_UP;
      data.coins += coinsAwarded;
    }

    this.save(player);
    return { newLevel: data.level, leveled, coinsAwarded };
  }

  /** Update best time if this is a new PB. Returns true if new PB. */
  updateBestTime(player: Player, timeMs: number, respawns: number): boolean {
    const data = this._cache.get(player.id);
    if (!data) return false;

    if (data.bestTimeMs === null || timeMs < data.bestTimeMs) {
      data.bestTimeMs = timeMs;
      data.bestRespawns = respawns;
      this.save(player);
      return true;
    }
    return false;
  }

  /** Store ghost data */
  saveGhost(player: Player, ghost: GhostRecording): void {
    const data = this._cache.get(player.id);
    if (!data) return;
    data.ghostData = ghost;
    this.save(player);
  }

  /** Record a win */
  addWin(player: Player): void {
    const data = this._cache.get(player.id);
    if (!data) return;
    data.wins++;
    this.save(player);
  }

  /** Record a podium finish */
  addPodium(player: Player): void {
    const data = this._cache.get(player.id);
    if (!data) return;
    data.podiums++;
    this.save(player);
  }

  /** Buy a cosmetic. Returns true if successful. */
  buyCosmetic(player: Player, cosmeticId: string, price: number): boolean {
    const data = this._cache.get(player.id);
    if (!data) return false;
    if (data.coins < price) return false;
    if (data.ownedCosmetics.includes(cosmeticId)) return false;

    data.coins -= price;
    data.ownedCosmetics.push(cosmeticId);
    this.save(player);
    return true;
  }

  /** Equip a cosmetic */
  equipCosmetic(player: Player, cosmeticId: string, type: 'trail' | 'finishEffect'): boolean {
    const data = this._cache.get(player.id);
    if (!data) return false;
    if (!data.ownedCosmetics.includes(cosmeticId)) return false;

    if (type === 'trail') {
      data.equippedTrailId = cosmeticId;
    } else {
      data.equippedFinishEffectId = cosmeticId;
    }
    this.save(player);
    return true;
  }

  /** Remove player from cache */
  removePlayer(playerId: string): void {
    this._cache.delete(playerId);
  }
}
