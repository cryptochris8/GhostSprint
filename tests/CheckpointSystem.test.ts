import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('hytopia', () => ({}));

import { CheckpointSystem } from '../src/systems/CheckpointSystem';
import type { CourseDefinition } from '../src/config/courseConfig';

const MOCK_COURSE: CourseDefinition = {
  id: 'test_course',
  name: 'Test Course',
  description: 'For testing',
  lobbySpawn: { x: 0, y: 10, z: 0 },
  startPadPosition: { x: 0, y: 5, z: 0 },
  startPadSize: { x: 6, y: 1, z: 6 },
  finishGatePosition: { x: 0, y: 5, z: -100 },
  finishGateSize: { x: 6, y: 6, z: 2 },
  checkpointPositions: [
    { x: 10, y: 8, z: -30 },
    { x: -5, y: 12, z: -60 },
  ],
  checkpointSize: { x: 4, y: 4, z: 4 },
  outOfBoundsY: -10,
  startTriggerRadius: 3,
  checkpointTriggerRadius: 2.5,
  finishTriggerRadius: 3.5,
  modifierMode: 'random',
};

function mockPlayer(id: string): any {
  return { id, username: `Player_${id}` };
}

describe('CheckpointSystem', () => {
  let cs: CheckpointSystem;

  beforeEach(() => {
    cs = new CheckpointSystem();
    cs.setCourse(MOCK_COURSE);
  });

  describe('_isNear distance check (via checkStartPad)', () => {
    it('exact center triggers start pad', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      cs.checkStartPad(player, { x: 0, y: 5, z: 0 }); // exact start position
      expect(cs.getPlayerData('p1')!.started).toBe(true);
    });

    it('position outside radius does not trigger', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      cs.checkStartPad(player, { x: 100, y: 100, z: 100 });
      expect(cs.getPlayerData('p1')!.started).toBe(false);
    });

    it('position exactly at radius boundary does not trigger (strict <)', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      // radius = 3, distance needs to be < 3, not <=
      // distance of exactly 3: e.g. (3, 5, 0) from (0, 5, 0) = dist 3
      cs.checkStartPad(player, { x: 3, y: 5, z: 0 });
      expect(cs.getPlayerData('p1')!.started).toBe(false);
    });

    it('position just inside radius triggers', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      // 2.99 < 3
      cs.checkStartPad(player, { x: 2.99, y: 5, z: 0 });
      expect(cs.getPlayerData('p1')!.started).toBe(true);
    });
  });

  describe('sequential checkpoint enforcement', () => {
    it('cannot skip from checkpoint 0 to checkpoint 2', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      cs.checkStartPad(player, { x: 0, y: 5, z: 0 });

      // Try to trigger checkpoint 1 (index 1) without hitting checkpoint 0
      cs.checkCheckpoints(player, { x: -5, y: 12, z: -60 });
      expect(cs.getPlayerData('p1')!.nextCheckpoint).toBe(0);
    });

    it('hitting checkpoints in order works', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      cs.checkStartPad(player, { x: 0, y: 5, z: 0 });

      // Hit checkpoint 0
      cs.checkCheckpoints(player, { x: 10, y: 8, z: -30 });
      expect(cs.getPlayerData('p1')!.nextCheckpoint).toBe(1);

      // Hit checkpoint 1
      cs.checkCheckpoints(player, { x: -5, y: 12, z: -60 });
      expect(cs.getPlayerData('p1')!.nextCheckpoint).toBe(2);
    });
  });

  describe('start pad requirement', () => {
    it('checkpoints do not count before starting', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');

      // Try hitting checkpoint without starting
      cs.checkCheckpoints(player, { x: 10, y: 8, z: -30 });
      expect(cs.getPlayerData('p1')!.nextCheckpoint).toBe(0);
    });
  });

  describe('finish gate', () => {
    it('must hit all checkpoints before finish', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      cs.checkStartPad(player, { x: 0, y: 5, z: 0 });

      // Try finish without checkpoints
      cs.checkFinish(player, { x: 0, y: 5, z: -100 });
      expect(cs.getPlayerData('p1')!.finished).toBe(false);
    });

    it('finish triggers after all checkpoints', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      cs.checkStartPad(player, { x: 0, y: 5, z: 0 });

      // Hit both checkpoints
      cs.checkCheckpoints(player, { x: 10, y: 8, z: -30 });
      cs.checkCheckpoints(player, { x: -5, y: 12, z: -60 });

      // Now finish
      cs.checkFinish(player, { x: 0, y: 5, z: -100 });
      expect(cs.getPlayerData('p1')!.finished).toBe(true);
    });

    it('finish callback receives respawn count', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      cs.checkStartPad(player, { x: 0, y: 5, z: 0 });
      cs.checkCheckpoints(player, { x: 10, y: 8, z: -30 });
      cs.checkCheckpoints(player, { x: -5, y: 12, z: -60 });

      // Fall OOB once
      cs.checkOutOfBounds(player, { x: 0, y: -20, z: 0 });

      const finishCb = vi.fn();
      cs.onFinish(finishCb);
      cs.checkFinish(player, { x: 0, y: 5, z: -100 });
      expect(finishCb).toHaveBeenCalledWith(player, 1);
    });
  });

  describe('out of bounds', () => {
    it('OOB increments respawn counter', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');

      const result = cs.checkOutOfBounds(player, { x: 0, y: -20, z: 0 });
      expect(result).toBe(true);
      expect(cs.getPlayerData('p1')!.respawns).toBe(1);
    });

    it('position above OOB threshold is not OOB', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');

      const result = cs.checkOutOfBounds(player, { x: 0, y: 5, z: 0 });
      expect(result).toBe(false);
      expect(cs.getPlayerData('p1')!.respawns).toBe(0);
    });

    it('multiple OOB increments correctly', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');

      cs.checkOutOfBounds(player, { x: 0, y: -20, z: 0 });
      cs.checkOutOfBounds(player, { x: 0, y: -20, z: 0 });
      cs.checkOutOfBounds(player, { x: 0, y: -20, z: 0 });
      expect(cs.getPlayerData('p1')!.respawns).toBe(3);
    });
  });

  describe('respawn position', () => {
    it('respawn position starts at start pad + 2 on Y', () => {
      cs.resetPlayer('p1');
      const pos = cs.getRespawnPosition('p1');
      expect(pos).toEqual({ x: 0, y: 7, z: 0 }); // startPadPosition.y + 2
    });

    it('respawn position updates after checkpoint', () => {
      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      cs.checkStartPad(player, { x: 0, y: 5, z: 0 });
      cs.checkCheckpoints(player, { x: 10, y: 8, z: -30 });

      const pos = cs.getRespawnPosition('p1');
      expect(pos).toEqual({ x: 10, y: 10, z: -30 }); // checkpoint.y + 2
    });

    it('getRespawnPosition for unknown player returns start pad', () => {
      const pos = cs.getRespawnPosition('unknown');
      expect(pos).toEqual({ x: 0, y: 7, z: 0 });
    });
  });

  describe('callbacks', () => {
    it('onStart callback fires on start pad trigger', () => {
      const cb = vi.fn();
      cs.onStart(cb);

      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      cs.checkStartPad(player, { x: 0, y: 5, z: 0 });
      expect(cb).toHaveBeenCalledWith(player);
    });

    it('onCheckpoint callback fires with correct index', () => {
      const cb = vi.fn();
      cs.onCheckpoint(cb);

      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      cs.checkStartPad(player, { x: 0, y: 5, z: 0 });
      cs.checkCheckpoints(player, { x: 10, y: 8, z: -30 });
      expect(cb).toHaveBeenCalledWith(player, 0);
    });

    it('onRespawn callback fires on OOB', () => {
      const cb = vi.fn();
      cs.onRespawn(cb);

      const player = mockPlayer('p1');
      cs.resetPlayer('p1');
      cs.checkOutOfBounds(player, { x: 0, y: -20, z: 0 });
      expect(cb).toHaveBeenCalledWith(player);
    });
  });

  describe('resetAll', () => {
    it('clears all player data', () => {
      cs.resetPlayer('p1');
      cs.resetPlayer('p2');
      cs.resetAll();
      expect(cs.getPlayerData('p1')).toBeUndefined();
      expect(cs.getPlayerData('p2')).toBeUndefined();
    });
  });

  describe('totalCheckpoints', () => {
    it('returns correct count from course', () => {
      expect(cs.totalCheckpoints).toBe(2);
    });
  });
});
