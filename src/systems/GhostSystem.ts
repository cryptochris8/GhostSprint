/**
 * Ghost replay system — personal best ghost only.
 * Records position+rotation samples during a run.
 * Replays as a translucent non-collidable entity visible only to the owning player.
 */

import type { World, Player } from 'hytopia';
import { Entity, RigidBodyType, ColliderShape } from 'hytopia';
import {
  GHOST_SAMPLE_INTERVAL_MS,
  GHOST_MAX_SAMPLES,
  DEBUG_MODE,
} from '../config/gameConfig';

export interface GhostSample {
  x: number;
  y: number;
  z: number;
  rw: number;
  rx: number;
  ry: number;
  rz: number;
}

export interface GhostRecording {
  samples: GhostSample[];
  timeMs: number;
}

export class GhostSystem {
  /** Active recordings (player is currently running) */
  private _recordings: Map<string, { samples: GhostSample[]; startMs: number; lastSampleMs: number }> = new Map();
  /** Active ghost replay entities */
  private _ghostEntities: Map<string, { entity: Entity; samples: GhostSample[]; startMs: number; sampleIndex: number }> = new Map();

  /** Start recording ghost data for a player */
  startRecording(playerId: string): void {
    this._recordings.set(playerId, {
      samples: [],
      startMs: Date.now(),
      lastSampleMs: 0,
    });
  }

  /** Record a sample (call from tick) */
  recordSample(playerId: string, pos: { x: number; y: number; z: number }, rot: { w: number; x: number; y: number; z: number }): void {
    const rec = this._recordings.get(playerId);
    if (!rec) return;

    const now = Date.now();
    if (now - rec.lastSampleMs < GHOST_SAMPLE_INTERVAL_MS) return;
    if (rec.samples.length >= GHOST_MAX_SAMPLES) return;

    rec.samples.push({
      x: Math.round(pos.x * 100) / 100,
      y: Math.round(pos.y * 100) / 100,
      z: Math.round(pos.z * 100) / 100,
      rw: Math.round(rot.w * 1000) / 1000,
      rx: Math.round(rot.x * 1000) / 1000,
      ry: Math.round(rot.y * 1000) / 1000,
      rz: Math.round(rot.z * 1000) / 1000,
    });
    rec.lastSampleMs = now;
  }

  /** Stop recording and return the ghost data */
  stopRecording(playerId: string): GhostRecording | null {
    const rec = this._recordings.get(playerId);
    this._recordings.delete(playerId);
    if (!rec || rec.samples.length === 0) return null;

    return {
      samples: rec.samples,
      timeMs: Date.now() - rec.startMs,
    };
  }

  /** Spawn a ghost replay entity for a player */
  spawnGhost(world: World, playerId: string, ghostData: GhostRecording): void {
    // Remove existing ghost if any
    this.despawnGhost(playerId);

    if (!ghostData.samples.length) return;

    const firstSample = ghostData.samples[0];

    const ghostEntity = new Entity({
      name: `ghost_${playerId}`,
      modelUri: 'models/players/player.gltf',
      modelScale: 0.5,
      opacity: 0.3,
      tintColor: { r: 100, g: 200, b: 255 },
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
        colliders: [{
          shape: ColliderShape.BLOCK,
          halfExtents: { x: 0.001, y: 0.001, z: 0.001 },
          isSensor: true,
        }],
      },
    });

    ghostEntity.spawn(world, { x: firstSample.x, y: firstSample.y, z: firstSample.z });

    this._ghostEntities.set(playerId, {
      entity: ghostEntity,
      samples: ghostData.samples,
      startMs: Date.now(),
      sampleIndex: 0,
    });

    if (DEBUG_MODE) console.log(`[Ghost] Spawned ghost for ${playerId} with ${ghostData.samples.length} samples`);
  }

  /** Tick ghost replay (call from world tick) */
  tickGhosts(): void {
    const now = Date.now();

    for (const [playerId, ghost] of this._ghostEntities) {
      const elapsed = now - ghost.startMs;
      const targetIndex = Math.floor(elapsed / GHOST_SAMPLE_INTERVAL_MS);

      if (targetIndex >= ghost.samples.length) {
        // Ghost replay finished — loop or despawn
        ghost.startMs = now; // loop
        ghost.sampleIndex = 0;
        continue;
      }

      if (targetIndex !== ghost.sampleIndex && targetIndex < ghost.samples.length) {
        ghost.sampleIndex = targetIndex;
        const sample = ghost.samples[targetIndex];
        ghost.entity.setPosition({ x: sample.x, y: sample.y, z: sample.z });
        ghost.entity.setRotation({ w: sample.rw, x: sample.rx, y: sample.ry, z: sample.rz });
      }
    }
  }

  /** Despawn a specific player's ghost */
  despawnGhost(playerId: string): void {
    const ghost = this._ghostEntities.get(playerId);
    if (ghost) {
      if (ghost.entity.isSpawned) ghost.entity.despawn();
      this._ghostEntities.delete(playerId);
    }
  }

  /** Despawn all ghosts */
  despawnAll(): void {
    for (const [id] of this._ghostEntities) {
      this.despawnGhost(id);
    }
  }

  /** Cancel all recordings */
  cancelAllRecordings(): void {
    this._recordings.clear();
  }
}
