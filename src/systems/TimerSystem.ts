/**
 * Per-player race timer.
 * Tracks individual start/finish times in milliseconds.
 */

import type { Player } from 'hytopia';
import { DEBUG_MODE } from '../config/gameConfig';

export interface PlayerTimerData {
  startMs: number;       // Date.now() when timer started
  finishMs: number | null; // null = not finished
  elapsedMs: number;     // running total
}

export class TimerSystem {
  private _timers: Map<string, PlayerTimerData> = new Map();

  /** Start the timer for a player */
  startTimer(playerId: string): void {
    this._timers.set(playerId, {
      startMs: Date.now(),
      finishMs: null,
      elapsedMs: 0,
    });
    if (DEBUG_MODE) console.log(`[Timer] Started for ${playerId}`);
  }

  /** Stop the timer for a player (they finished) */
  stopTimer(playerId: string): number {
    const data = this._timers.get(playerId);
    if (!data || data.finishMs !== null) return data?.elapsedMs ?? 0;

    data.finishMs = Date.now();
    data.elapsedMs = data.finishMs - data.startMs;
    if (DEBUG_MODE) console.log(`[Timer] ${playerId} finished in ${data.elapsedMs}ms`);
    return data.elapsedMs;
  }

  /** Get current elapsed time for a player */
  getElapsed(playerId: string): number {
    const data = this._timers.get(playerId);
    if (!data) return 0;
    if (data.finishMs !== null) return data.elapsedMs;
    return Date.now() - data.startMs;
  }

  /** Get final time (only valid after finish) */
  getFinishTime(playerId: string): number | null {
    const data = this._timers.get(playerId);
    if (!data || data.finishMs === null) return null;
    return data.elapsedMs;
  }

  /** Check if player has a running timer */
  isRunning(playerId: string): boolean {
    const data = this._timers.get(playerId);
    return !!data && data.finishMs === null;
  }

  /** Remove player tracking */
  removePlayer(playerId: string): void {
    this._timers.delete(playerId);
  }

  /** Reset all timers (new round) */
  resetAll(): void {
    this._timers.clear();
  }

  /** Format milliseconds as mm:ss.ms */
  static formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = Math.floor((ms % 1000) / 10); // two-digit ms
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
  }
}
