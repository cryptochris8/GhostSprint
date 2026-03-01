import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock hytopia's PersistenceManager
vi.mock('hytopia', () => ({
  PersistenceManager: {
    instance: {
      getGlobalData: vi.fn().mockResolvedValue(null),
      setGlobalData: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

import { LeaderboardSystem } from '../src/systems/LeaderboardSystem';

describe('LeaderboardSystem', () => {
  let lb: LeaderboardSystem;

  beforeEach(() => {
    lb = new LeaderboardSystem();
  });

  it('submit 1 entry returns rank 1', async () => {
    const rank = await lb.submit('p1', 'Alice', 5000);
    expect(rank).toBe(1);
  });

  it('faster time gets rank 1, old entry bumps to rank 2', async () => {
    await lb.submit('p1', 'Alice', 5000);
    await lb.submit('p2', 'Bob', 3000);
    expect(lb.getPlayerRank('p2')).toBe(1);
    expect(lb.getPlayerRank('p1')).toBe(2);
  });

  it('same player replaces old entry with better time', async () => {
    await lb.submit('p1', 'Alice', 5000);
    await lb.submit('p1', 'Alice', 3000);
    expect(lb.entries.length).toBe(1);
    expect(lb.getPlayerTime('p1')).toBe(3000);
    expect(lb.getPlayerRank('p1')).toBe(1);
  });

  it('same player replaces old entry even with worse time', async () => {
    await lb.submit('p1', 'Alice', 3000);
    await lb.submit('p1', 'Alice', 5000);
    expect(lb.entries.length).toBe(1);
    expect(lb.getPlayerTime('p1')).toBe(5000);
  });

  it('caps at 50 entries', async () => {
    for (let i = 0; i < 51; i++) {
      await lb.submit(`p${i}`, `Player${i}`, 1000 + i);
    }
    expect(lb.entries.length).toBe(50);
  });

  it('51st entry pushes out slowest when faster', async () => {
    for (let i = 0; i < 50; i++) {
      await lb.submit(`p${i}`, `Player${i}`, 1000 + i * 10);
    }
    // Submit faster than all
    const rank = await lb.submit('p50', 'Player50', 500);
    expect(rank).toBe(1);
    expect(lb.entries.length).toBe(50);
    // Slowest (p49 at 1490) should be gone
    expect(lb.getPlayerRank('p49')).toBeNull();
  });

  it('top10 returns first 10 entries', async () => {
    for (let i = 0; i < 15; i++) {
      await lb.submit(`p${i}`, `Player${i}`, 1000 + i);
    }
    expect(lb.top10.length).toBe(10);
    expect(lb.top10[0].timeMs).toBe(1000);
    expect(lb.top10[9].timeMs).toBe(1009);
  });

  it('getPlayerRank returns null for unknown player', () => {
    expect(lb.getPlayerRank('nonexistent')).toBeNull();
  });

  it('getPlayerTime returns null for unknown player', () => {
    expect(lb.getPlayerTime('nonexistent')).toBeNull();
  });

  it('getPlayerTime returns correct time', async () => {
    await lb.submit('p1', 'Alice', 4200);
    expect(lb.getPlayerTime('p1')).toBe(4200);
  });

  it('entries are sorted by time ascending', async () => {
    await lb.submit('p1', 'Alice', 5000);
    await lb.submit('p2', 'Bob', 3000);
    await lb.submit('p3', 'Charlie', 7000);
    expect(lb.entries.map(e => e.timeMs)).toEqual([3000, 5000, 7000]);
  });

  it('setCourseId clears entries', async () => {
    await lb.submit('p1', 'Alice', 5000);
    lb.setCourseId('course2');
    expect(lb.entries.length).toBe(0);
  });
});
