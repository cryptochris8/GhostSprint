import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('hytopia', () => ({}));

import { XPSystem } from '../src/systems/XPSystem';
import type { RoundResult } from '../src/systems/XPSystem';
import { PersistenceSystem } from '../src/systems/PersistenceSystem';
import { createMockPlayer } from './helpers/mocks';

describe('XPSystem', () => {
  let xpSys: XPSystem;
  let persistence: PersistenceSystem;
  let player: any;

  beforeEach(() => {
    persistence = new PersistenceSystem();
    xpSys = new XPSystem(persistence);
    player = createMockPlayer('p1', 'Alice');
    persistence.load(player);
  });

  function makeResult(overrides: Partial<RoundResult> = {}): RoundResult {
    return {
      playerId: 'p1',
      player,
      finished: true,
      timeMs: 5000,
      isNewPB: false,
      placement: 4,
      ...overrides,
    };
  }

  it('1st place + PB: 30 + 20 + 25 = 75 XP', () => {
    const results = [makeResult({ placement: 1, isNewPB: true })];
    const awards = xpSys.awardRound(results);
    expect(awards[0].amount).toBe(75);
  });

  it('2nd place no PB: 30 + 10 = 40 XP', () => {
    const results = [makeResult({ placement: 2, isNewPB: false })];
    const awards = xpSys.awardRound(results);
    expect(awards[0].amount).toBe(40);
  });

  it('3rd place: 30 + 5 = 35 XP', () => {
    const results = [makeResult({ placement: 3, isNewPB: false })];
    const awards = xpSys.awardRound(results);
    expect(awards[0].amount).toBe(35);
  });

  it('4th+ place: 30 XP (finish only)', () => {
    const results = [makeResult({ placement: 4, isNewPB: false })];
    const awards = xpSys.awardRound(results);
    expect(awards[0].amount).toBe(30);
  });

  it('DNF: 10 XP, no finish bonus', () => {
    const results = [makeResult({ finished: false, timeMs: null, placement: 0 })];
    const awards = xpSys.awardRound(results);
    expect(awards[0].amount).toBe(10);
  });

  it('reasons array contains correct strings for 1st + PB', () => {
    const results = [makeResult({ placement: 1, isNewPB: true })];
    const awards = xpSys.awardRound(results);
    expect(awards[0].reasons).toContain('Finish: +30');
    expect(awards[0].reasons).toContain('1st Place: +20');
    expect(awards[0].reasons).toContain('New PB: +25');
    expect(awards[0].reasons.length).toBe(3);
  });

  it('reasons array for DNF', () => {
    const results = [makeResult({ finished: false, placement: 0 })];
    const awards = xpSys.awardRound(results);
    expect(awards[0].reasons).toEqual(['DNF: +10']);
  });

  it('level-up info propagated from persistence', () => {
    // Give 90 XP first
    persistence.addXP(player, 90);
    // Now award 10+ more to level up
    const results = [makeResult({ placement: 4 })]; // 30 XP
    const awards = xpSys.awardRound(results);
    expect(awards[0].leveled).toBe(true);
    expect(awards[0].newLevel).toBe(1);
    expect(awards[0].coinsAwarded).toBe(25);
  });

  it('handles multiple results', () => {
    const p2 = createMockPlayer('p2', 'Bob');
    persistence.load(p2);

    const results = [
      makeResult({ placement: 1, isNewPB: true }),
      { playerId: 'p2', player: p2, finished: false, timeMs: null, isNewPB: false, placement: 0 },
    ];
    const awards = xpSys.awardRound(results);
    expect(awards.length).toBe(2);
    expect(awards[0].amount).toBe(75);
    expect(awards[1].amount).toBe(10);
  });
});
