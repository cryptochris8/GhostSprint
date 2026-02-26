/**
 * Global leaderboard — Course 1 best times.
 * Uses PersistenceManager.instance for global data.
 */

import { PersistenceManager } from 'hytopia';
import { COURSE_ID, DEBUG_MODE } from '../config/gameConfig';

export interface LeaderboardEntry {
  playerId: string;
  username: string;
  timeMs: number;
}

const LEADERBOARD_KEY = `leaderboard_${COURSE_ID}`;
const MAX_ENTRIES = 50; // store top 50, display top 10

export class LeaderboardSystem {
  private _entries: LeaderboardEntry[] = [];
  private _loaded = false;

  get entries(): LeaderboardEntry[] { return this._entries; }
  get top10(): LeaderboardEntry[] { return this._entries.slice(0, 10); }

  /** Load leaderboard from global persistence */
  async load(): Promise<void> {
    try {
      const data = await PersistenceManager.instance.getGlobalData(LEADERBOARD_KEY);
      if (data?.entries && Array.isArray(data.entries)) {
        this._entries = data.entries as LeaderboardEntry[];
        this._entries.sort((a, b) => a.timeMs - b.timeMs);
      }
      this._loaded = true;
      if (DEBUG_MODE) console.log(`[Leaderboard] Loaded ${this._entries.length} entries`);
    } catch (err) {
      console.error('[Leaderboard] Failed to load:', err);
      this._loaded = true;
    }
  }

  /** Submit a new time. Returns the player's rank (1-indexed) or null if not top 50. */
  async submit(playerId: string, username: string, timeMs: number): Promise<number | null> {
    // Remove existing entry for this player
    this._entries = this._entries.filter(e => e.playerId !== playerId);

    // Add new entry
    this._entries.push({ playerId, username, timeMs });
    this._entries.sort((a, b) => a.timeMs - b.timeMs);

    // Trim to max
    if (this._entries.length > MAX_ENTRIES) {
      this._entries = this._entries.slice(0, MAX_ENTRIES);
    }

    // Find rank
    const rank = this._entries.findIndex(e => e.playerId === playerId);
    const playerRank = rank >= 0 ? rank + 1 : null;

    // Persist
    try {
      await PersistenceManager.instance.setGlobalData(LEADERBOARD_KEY, {
        entries: this._entries,
      });
      if (DEBUG_MODE) console.log(`[Leaderboard] Updated: ${username} rank #${playerRank} (${timeMs}ms)`);
    } catch (err) {
      console.error('[Leaderboard] Failed to save:', err);
    }

    return playerRank;
  }

  /** Get a player's rank (1-indexed, null if not ranked) */
  getPlayerRank(playerId: string): number | null {
    const idx = this._entries.findIndex(e => e.playerId === playerId);
    return idx >= 0 ? idx + 1 : null;
  }

  /** Get a player's best time from the leaderboard */
  getPlayerTime(playerId: string): number | null {
    const entry = this._entries.find(e => e.playerId === playerId);
    return entry?.timeMs ?? null;
  }
}
