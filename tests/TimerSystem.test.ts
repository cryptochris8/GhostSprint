import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock hytopia module before importing the system
vi.mock('hytopia', () => ({}));

import { TimerSystem } from '../src/systems/TimerSystem';

describe('TimerSystem', () => {
  describe('formatTime (static)', () => {
    it('formats 0 as 00:00.00', () => {
      expect(TimerSystem.formatTime(0)).toBe('00:00.00');
    });

    it('formats 1500ms as 00:01.50', () => {
      expect(TimerSystem.formatTime(1500)).toBe('00:01.50');
    });

    it('formats 83450ms as 01:23.45', () => {
      expect(TimerSystem.formatTime(83450)).toBe('01:23.45');
    });

    it('formats 60000ms as 01:00.00', () => {
      expect(TimerSystem.formatTime(60000)).toBe('01:00.00');
    });

    it('formats sub-second values correctly', () => {
      expect(TimerSystem.formatTime(990)).toBe('00:00.99');
    });

    it('formats large times correctly', () => {
      // 5 minutes exactly
      expect(TimerSystem.formatTime(300000)).toBe('05:00.00');
    });
  });

  describe('instance methods', () => {
    let timer: TimerSystem;

    beforeEach(() => {
      timer = new TimerSystem();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('isRunning is true after startTimer', () => {
      timer.startTimer('p1');
      expect(timer.isRunning('p1')).toBe(true);
    });

    it('isRunning is false before startTimer', () => {
      expect(timer.isRunning('p1')).toBe(false);
    });

    it('isRunning is false after stopTimer', () => {
      timer.startTimer('p1');
      timer.stopTimer('p1');
      expect(timer.isRunning('p1')).toBe(false);
    });

    it('getFinishTime returns null before stop', () => {
      timer.startTimer('p1');
      expect(timer.getFinishTime('p1')).toBeNull();
    });

    it('getFinishTime returns null for unknown player', () => {
      expect(timer.getFinishTime('unknown')).toBeNull();
    });

    it('stopTimer returns elapsed milliseconds', () => {
      vi.setSystemTime(new Date(1000));
      timer.startTimer('p1');
      vi.setSystemTime(new Date(3500));
      const elapsed = timer.stopTimer('p1');
      expect(elapsed).toBe(2500);
    });

    it('getFinishTime returns correct time after stop', () => {
      vi.setSystemTime(new Date(1000));
      timer.startTimer('p1');
      vi.setSystemTime(new Date(6000));
      timer.stopTimer('p1');
      expect(timer.getFinishTime('p1')).toBe(5000);
    });

    it('getElapsed tracks running time', () => {
      vi.setSystemTime(new Date(0));
      timer.startTimer('p1');
      vi.setSystemTime(new Date(2000));
      expect(timer.getElapsed('p1')).toBe(2000);
    });

    it('getElapsed returns 0 for unknown player', () => {
      expect(timer.getElapsed('unknown')).toBe(0);
    });

    it('getElapsed returns fixed value after stop', () => {
      vi.setSystemTime(new Date(0));
      timer.startTimer('p1');
      vi.setSystemTime(new Date(3000));
      timer.stopTimer('p1');
      vi.setSystemTime(new Date(9999));
      expect(timer.getElapsed('p1')).toBe(3000);
    });

    it('stopTimer is idempotent', () => {
      vi.setSystemTime(new Date(0));
      timer.startTimer('p1');
      vi.setSystemTime(new Date(2000));
      timer.stopTimer('p1');
      vi.setSystemTime(new Date(5000));
      const elapsed = timer.stopTimer('p1');
      expect(elapsed).toBe(2000);
    });

    it('removePlayer clears player data', () => {
      timer.startTimer('p1');
      timer.removePlayer('p1');
      expect(timer.isRunning('p1')).toBe(false);
      expect(timer.getFinishTime('p1')).toBeNull();
    });

    it('resetAll clears all timers', () => {
      timer.startTimer('p1');
      timer.startTimer('p2');
      timer.resetAll();
      expect(timer.isRunning('p1')).toBe(false);
      expect(timer.isRunning('p2')).toBe(false);
    });
  });
});
