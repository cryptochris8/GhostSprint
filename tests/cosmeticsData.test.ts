import { describe, it, expect } from 'vitest';

import { COSMETICS, getCosmeticById } from '../src/data/cosmeticsData';

describe('cosmeticsData validation', () => {
  it('getCosmeticById returns correct item', () => {
    const item = getCosmeticById('trail_neon_green');
    expect(item).toBeDefined();
    expect(item!.name).toBe('Neon Green Trail');
    expect(item!.type).toBe('trail');
    expect(item!.price).toBe(50);
  });

  it('getCosmeticById returns undefined for invalid ID', () => {
    expect(getCosmeticById('invalid')).toBeUndefined();
  });

  it('all IDs are unique', () => {
    const ids = COSMETICS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all prices > 0', () => {
    for (const cosmetic of COSMETICS) {
      expect(cosmetic.price).toBeGreaterThan(0);
    }
  });

  it('trail cosmetics have color property', () => {
    const trails = COSMETICS.filter(c => c.type === 'trail');
    expect(trails.length).toBeGreaterThan(0);
    for (const trail of trails) {
      expect(trail.color).toBeDefined();
      expect(trail.color!.r).toBeGreaterThanOrEqual(0);
      expect(trail.color!.g).toBeGreaterThanOrEqual(0);
      expect(trail.color!.b).toBeGreaterThanOrEqual(0);
    }
  });

  it('all cosmetics have valid type', () => {
    for (const cosmetic of COSMETICS) {
      expect(['trail', 'finishEffect']).toContain(cosmetic.type);
    }
  });

  it('all cosmetics have non-empty description', () => {
    for (const cosmetic of COSMETICS) {
      expect(cosmetic.description.length).toBeGreaterThan(0);
    }
  });
});
