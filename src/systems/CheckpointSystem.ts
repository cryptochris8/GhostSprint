/**
 * Checkpoint tracking system.
 * Manages ordered checkpoint progression, start pad trigger, and finish gate.
 */

import type { World, Player, Entity } from 'hytopia';
import {
  CHECKPOINT_POSITIONS,
  START_PAD_POSITION,
  FINISH_GATE_POSITION,
  OUT_OF_BOUNDS_Y,
  DEBUG_MODE,
} from '../config/gameConfig';

export interface PlayerCheckpointData {
  /** Which checkpoints have been reached (0-indexed) */
  nextCheckpoint: number;
  /** Has the player crossed the start pad? */
  started: boolean;
  /** Has the player finished? */
  finished: boolean;
  /** Respawn count for this run */
  respawns: number;
  /** Position to respawn at */
  lastCheckpointPosition: { x: number; y: number; z: number };
}

export type StartCallback = (player: Player) => void;
export type CheckpointCallback = (player: Player, index: number) => void;
export type FinishCallback = (player: Player, respawns: number) => void;
export type RespawnCallback = (player: Player) => void;

export class CheckpointSystem {
  private _playerData: Map<string, PlayerCheckpointData> = new Map();
  private _onStart: StartCallback[] = [];
  private _onCheckpoint: CheckpointCallback[] = [];
  private _onFinish: FinishCallback[] = [];
  private _onRespawn: RespawnCallback[] = [];

  get totalCheckpoints(): number { return CHECKPOINT_POSITIONS.length; }

  onStart(cb: StartCallback): void { this._onStart.push(cb); }
  onCheckpoint(cb: CheckpointCallback): void { this._onCheckpoint.push(cb); }
  onFinish(cb: FinishCallback): void { this._onFinish.push(cb); }
  onRespawn(cb: RespawnCallback): void { this._onRespawn.push(cb); }

  /** Initialize/reset tracking for a player at round start */
  resetPlayer(playerId: string): void {
    this._playerData.set(playerId, {
      nextCheckpoint: 0,
      started: false,
      finished: false,
      respawns: 0,
      lastCheckpointPosition: { ...START_PAD_POSITION, y: START_PAD_POSITION.y + 2 },
    });
  }

  /** Remove player tracking */
  removePlayer(playerId: string): void {
    this._playerData.delete(playerId);
  }

  /** Get checkpoint data for a player */
  getPlayerData(playerId: string): PlayerCheckpointData | undefined {
    return this._playerData.get(playerId);
  }

  /** Check if a player position triggers start pad */
  checkStartPad(player: Player, pos: { x: number; y: number; z: number }): void {
    const data = this._playerData.get(player.id);
    if (!data || data.started) return;

    if (this._isNear(pos, START_PAD_POSITION, 3)) {
      data.started = true;
      if (DEBUG_MODE) console.log(`[Checkpoint] ${player.username} crossed start pad`);
      for (const cb of this._onStart) cb(player);
    }
  }

  /** Check if a player position triggers a checkpoint */
  checkCheckpoints(player: Player, pos: { x: number; y: number; z: number }): void {
    const data = this._playerData.get(player.id);
    if (!data || !data.started || data.finished) return;

    const idx = data.nextCheckpoint;
    if (idx >= CHECKPOINT_POSITIONS.length) return;

    const cp = CHECKPOINT_POSITIONS[idx];
    if (this._isNear(pos, cp, 2.5)) {
      data.nextCheckpoint = idx + 1;
      data.lastCheckpointPosition = { x: cp.x, y: cp.y + 2, z: cp.z };
      if (DEBUG_MODE) console.log(`[Checkpoint] ${player.username} hit checkpoint ${idx + 1}/${CHECKPOINT_POSITIONS.length}`);
      for (const cb of this._onCheckpoint) cb(player, idx);
    }
  }

  /** Check if a player position triggers the finish gate */
  checkFinish(player: Player, pos: { x: number; y: number; z: number }): void {
    const data = this._playerData.get(player.id);
    if (!data || !data.started || data.finished) return;

    // Must have hit all checkpoints in order
    if (data.nextCheckpoint < CHECKPOINT_POSITIONS.length) return;

    if (this._isNear(pos, FINISH_GATE_POSITION, 3.5)) {
      data.finished = true;
      if (DEBUG_MODE) console.log(`[Checkpoint] ${player.username} FINISHED! Respawns: ${data.respawns}`);
      for (const cb of this._onFinish) cb(player, data.respawns);
    }
  }

  /** Check if player has fallen out of bounds */
  checkOutOfBounds(player: Player, pos: { x: number; y: number; z: number }): boolean {
    const data = this._playerData.get(player.id);
    if (!data) return false;

    if (pos.y < OUT_OF_BOUNDS_Y) {
      data.respawns++;
      if (DEBUG_MODE) console.log(`[Checkpoint] ${player.username} fell OOB, respawn #${data.respawns}`);
      for (const cb of this._onRespawn) cb(player);
      return true;
    }
    return false;
  }

  /** Get respawn position for a player */
  getRespawnPosition(playerId: string): { x: number; y: number; z: number } {
    const data = this._playerData.get(playerId);
    return data?.lastCheckpointPosition ?? { ...START_PAD_POSITION, y: START_PAD_POSITION.y + 2 };
  }

  /** Reset all players (new round) */
  resetAll(): void {
    this._playerData.clear();
  }

  private _isNear(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, radius: number): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return (dx * dx + dy * dy + dz * dz) < radius * radius;
  }
}
