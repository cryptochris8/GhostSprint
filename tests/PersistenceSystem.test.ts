import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('hytopia', () => ({}));

import { PersistenceSystem } from '../src/systems/PersistenceSystem';
import { createMockPlayer } from './helpers/mocks';

describe('PersistenceSystem', () => {
  let ps: PersistenceSystem;

  beforeEach(() => {
    ps = new PersistenceSystem();
  });

  describe('load', () => {
    it('returns default data for new player', () => {
      const player = createMockPlayer('p1', 'Alice');
      const data = ps.load(player);
      expect(data.xp).toBe(0);
      expect(data.level).toBe(0);
      expect(data.coins).toBe(0);
      expect(data.bestTimeMs).toBeNull();
      expect(data.ownedCosmetics).toEqual([]);
    });

    it('merges stored data with defaults', () => {
      const player = createMockPlayer('p1', 'Alice');
      player.setPersistedData({ course1: { xp: 250, coins: 100 } });
      const data = ps.load(player);
      expect(data.xp).toBe(250);
      expect(data.level).toBe(2); // floor(250/100) = 2
      expect(data.coins).toBe(100);
      expect(data.bestTimeMs).toBeNull(); // default
    });
  });

  describe('addXP', () => {
    it('adds XP without leveling', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      const result = ps.addXP(player, 50);
      expect(result.newLevel).toBe(0);
      expect(result.leveled).toBe(false);
      expect(result.coinsAwarded).toBe(0);
    });

    it('addXP(99) then addXP(1) levels up and awards coins', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      ps.addXP(player, 99);
      const result = ps.addXP(player, 1);
      expect(result.newLevel).toBe(1);
      expect(result.leveled).toBe(true);
      expect(result.coinsAwarded).toBe(25); // COINS_PER_LEVEL_UP
    });

    it('multiple level-ups at once', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      const result = ps.addXP(player, 250);
      expect(result.newLevel).toBe(2);
      expect(result.leveled).toBe(true);
      expect(result.coinsAwarded).toBe(50); // 2 levels * 25
    });

    it('XP accumulates across calls', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      ps.addXP(player, 30);
      ps.addXP(player, 30);
      ps.addXP(player, 30);
      const data = ps.get('p1');
      expect(data!.xp).toBe(90);
    });

    it('returns default result for unknown player', () => {
      const player = createMockPlayer('p1', 'Alice');
      const result = ps.addXP(player, 50);
      expect(result.newLevel).toBe(0);
      expect(result.leveled).toBe(false);
    });
  });

  describe('updateBestTime', () => {
    it('first time is always a new PB', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      const result = ps.updateBestTime(player, 5000, 2);
      expect(result).toBe(true);
      expect(ps.get('p1')!.bestTimeMs).toBe(5000);
      expect(ps.get('p1')!.bestRespawns).toBe(2);
    });

    it('slower time is not a new PB', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      ps.updateBestTime(player, 5000, 2);
      const result = ps.updateBestTime(player, 6000, 1);
      expect(result).toBe(false);
      expect(ps.get('p1')!.bestTimeMs).toBe(5000);
    });

    it('faster time replaces PB', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      ps.updateBestTime(player, 5000, 2);
      const result = ps.updateBestTime(player, 4000, 0);
      expect(result).toBe(true);
      expect(ps.get('p1')!.bestTimeMs).toBe(4000);
      expect(ps.get('p1')!.bestRespawns).toBe(0);
    });
  });

  describe('buyCosmetic', () => {
    it('fails with insufficient coins', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      const result = ps.buyCosmetic(player, 'trail_neon_green', 50);
      expect(result).toBe(false);
    });

    it('succeeds with sufficient coins', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      // Give coins by leveling up: 4 levels = 100 coins
      ps.addXP(player, 400);
      const result = ps.buyCosmetic(player, 'trail_neon_green', 50);
      expect(result).toBe(true);
      const data = ps.get('p1')!;
      expect(data.ownedCosmetics).toContain('trail_neon_green');
      expect(data.coins).toBe(50); // 100 - 50
    });

    it('fails if already owned', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      ps.addXP(player, 400); // 100 coins
      ps.buyCosmetic(player, 'trail_neon_green', 50);
      const result = ps.buyCosmetic(player, 'trail_neon_green', 50);
      expect(result).toBe(false);
    });
  });

  describe('equipCosmetic', () => {
    it('fails if not owned', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      const result = ps.equipCosmetic(player, 'trail_neon_green', 'trail');
      expect(result).toBe(false);
    });

    it('succeeds if owned', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      ps.addXP(player, 400);
      ps.buyCosmetic(player, 'trail_neon_green', 50);
      const result = ps.equipCosmetic(player, 'trail_neon_green', 'trail');
      expect(result).toBe(true);
      expect(ps.get('p1')!.equippedTrailId).toBe('trail_neon_green');
    });

    it('equips finish effect correctly', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      ps.addXP(player, 400);
      ps.buyCosmetic(player, 'finish_confetti', 100);
      ps.equipCosmetic(player, 'finish_confetti', 'finishEffect');
      expect(ps.get('p1')!.equippedFinishEffectId).toBe('finish_confetti');
    });
  });

  describe('removePlayer', () => {
    it('clears cached data', () => {
      const player = createMockPlayer('p1', 'Alice');
      ps.load(player);
      ps.removePlayer('p1');
      expect(ps.get('p1')).toBeUndefined();
    });
  });

  describe('setCourseId', () => {
    it('changes course context for load', () => {
      const player = createMockPlayer('p1', 'Alice');
      player.setPersistedData({
        course1: { xp: 100 },
        course2: { xp: 200 },
      });
      ps.setCourseId('course2');
      const data = ps.load(player);
      expect(data.xp).toBe(200);
    });
  });
});
