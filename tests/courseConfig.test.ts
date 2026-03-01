import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';

vi.mock('hytopia', () => ({}));

import { COURSES } from '../src/config/courseConfig';
import { MODIFIERS } from '../src/config/gameConfig';

describe('courseConfig validation', () => {
  it('has 4 courses', () => {
    expect(COURSES.length).toBe(4);
  });

  it('all courses have unique IDs', () => {
    const ids = COURSES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all courses have at least 1 checkpoint', () => {
    for (const course of COURSES) {
      expect(course.checkpointPositions.length).toBeGreaterThan(0);
    }
  });

  it('all trigger radii > 0', () => {
    for (const course of COURSES) {
      expect(course.startTriggerRadius).toBeGreaterThan(0);
      expect(course.checkpointTriggerRadius).toBeGreaterThan(0);
      expect(course.finishTriggerRadius).toBeGreaterThan(0);
    }
  });

  it('all sizes have positive dimensions', () => {
    for (const course of COURSES) {
      for (const key of ['startPadSize', 'finishGateSize', 'checkpointSize'] as const) {
        const size = course[key];
        expect(size.x).toBeGreaterThan(0);
        expect(size.y).toBeGreaterThan(0);
        expect(size.z).toBeGreaterThan(0);
      }
    }
  });

  it('fixed modifier IDs exist in MODIFIERS array', () => {
    for (const course of COURSES) {
      if (course.modifierMode === 'fixed' && course.fixedModifierId) {
        const found = MODIFIERS.find(m => m.id === course.fixedModifierId);
        expect(found).toBeDefined();
      }
    }
  });

  it('outOfBoundsY is below all checkpoint Y values', () => {
    for (const course of COURSES) {
      for (const cp of course.checkpointPositions) {
        expect(course.outOfBoundsY).toBeLessThan(cp.y);
      }
      // Also below start pad and finish gate
      expect(course.outOfBoundsY).toBeLessThan(course.startPadPosition.y);
      expect(course.outOfBoundsY).toBeLessThan(course.finishGatePosition.y);
    }
  });

  it('no checkpoint positions overlap within same course', () => {
    for (const course of COURSES) {
      const positions = course.checkpointPositions;
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i];
          const b = positions[j];
          const same = a.x === b.x && a.y === b.y && a.z === b.z;
          expect(same).toBe(false);
        }
      }
    }
  });

  it('all courses have valid modifierMode', () => {
    for (const course of COURSES) {
      expect(['random', 'fixed']).toContain(course.modifierMode);
    }
  });

  it('courses with fixed mode have fixedModifierId', () => {
    for (const course of COURSES) {
      if (course.modifierMode === 'fixed') {
        expect(course.fixedModifierId).toBeDefined();
        expect(typeof course.fixedModifierId).toBe('string');
      }
    }
  });
});
