import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('hytopia', () => ({
  Entity: class {
    constructor() {}
    spawn() {}
    despawn() {}
    setPosition() {}
    setRotation() {}
    get isSpawned() { return false; }
  },
  RigidBodyType: { KINEMATIC_POSITION: 1 },
  ColliderShape: { BLOCK: 0 },
}));

import { GhostSystem } from '../src/systems/GhostSystem';

describe('GhostSystem', () => {
  let gs: GhostSystem;

  beforeEach(() => {
    gs = new GhostSystem();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recording samples', () => {
    it('sample recorded after 250ms interval', () => {
      vi.setSystemTime(new Date(1000));
      gs.startRecording('p1');

      vi.setSystemTime(new Date(1250)); // 250ms later
      gs.recordSample('p1', { x: 1, y: 2, z: 3 }, { w: 1, x: 0, y: 0, z: 0 });

      const recording = gs.stopRecording('p1');
      expect(recording).not.toBeNull();
      expect(recording!.samples.length).toBe(1);
    });

    it('sample not recorded before 250ms since last sample', () => {
      vi.setSystemTime(new Date(1000));
      gs.startRecording('p1');

      // First sample always records (lastSampleMs starts at 0)
      vi.setSystemTime(new Date(1250));
      gs.recordSample('p1', { x: 0, y: 0, z: 0 }, { w: 1, x: 0, y: 0, z: 0 });

      // Try second sample only 100ms later — should be rejected
      vi.setSystemTime(new Date(1350));
      gs.recordSample('p1', { x: 1, y: 2, z: 3 }, { w: 1, x: 0, y: 0, z: 0 });

      const recording = gs.stopRecording('p1');
      expect(recording!.samples.length).toBe(1); // only the first sample
    });

    it('max 240 samples enforced', () => {
      vi.setSystemTime(new Date(0));
      gs.startRecording('p1');

      // Record 250 attempts
      for (let i = 0; i < 250; i++) {
        vi.setSystemTime(new Date(i * 250));
        gs.recordSample('p1', { x: i, y: 0, z: 0 }, { w: 1, x: 0, y: 0, z: 0 });
      }

      const recording = gs.stopRecording('p1');
      expect(recording!.samples.length).toBe(240);
    });
  });

  describe('quantization', () => {
    it('position quantized to 2 decimal places', () => {
      vi.setSystemTime(new Date(0));
      gs.startRecording('p1');

      vi.setSystemTime(new Date(250));
      gs.recordSample('p1', { x: 1.23456, y: 7.89012, z: -3.456 }, { w: 1, x: 0, y: 0, z: 0 });

      const recording = gs.stopRecording('p1');
      const sample = recording!.samples[0];
      expect(sample.x).toBe(1.23);
      expect(sample.y).toBe(7.89);
      expect(sample.z).toBe(-3.46);
    });

    it('rotation quantized to 3 decimal places', () => {
      vi.setSystemTime(new Date(0));
      gs.startRecording('p1');

      vi.setSystemTime(new Date(250));
      gs.recordSample('p1', { x: 0, y: 0, z: 0 }, { w: 0.12345, x: 0.67891, y: -0.11119, z: 0.99999 });

      const recording = gs.stopRecording('p1');
      const sample = recording!.samples[0];
      expect(sample.rw).toBe(0.123);
      expect(sample.rx).toBe(0.679);
      expect(sample.ry).toBe(-0.111);
      expect(sample.rz).toBe(1);
    });
  });

  describe('stopRecording', () => {
    it('returns null with 0 samples', () => {
      vi.setSystemTime(new Date(1000));
      gs.startRecording('p1');
      const recording = gs.stopRecording('p1');
      expect(recording).toBeNull();
    });

    it('returns null for unknown player', () => {
      expect(gs.stopRecording('unknown')).toBeNull();
    });

    it('includes timeMs from start to stop', () => {
      vi.setSystemTime(new Date(1000));
      gs.startRecording('p1');

      vi.setSystemTime(new Date(1250));
      gs.recordSample('p1', { x: 0, y: 0, z: 0 }, { w: 1, x: 0, y: 0, z: 0 });

      vi.setSystemTime(new Date(5000));
      const recording = gs.stopRecording('p1');
      expect(recording!.timeMs).toBe(4000);
    });
  });

  describe('cancelAllRecordings', () => {
    it('clears all active recordings', () => {
      gs.startRecording('p1');
      gs.startRecording('p2');
      gs.cancelAllRecordings();
      expect(gs.stopRecording('p1')).toBeNull();
      expect(gs.stopRecording('p2')).toBeNull();
    });
  });
});
