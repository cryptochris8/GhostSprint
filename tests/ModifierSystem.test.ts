import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('hytopia', () => ({
  DefaultPlayerEntityController: class {},
}));

import { ModifierSystem } from '../src/systems/ModifierSystem';
import { MODIFIERS } from '../src/config/gameConfig';
import { createMockWorld, createMockEntity } from './helpers/mocks';

describe('ModifierSystem', () => {
  let ms: ModifierSystem;

  beforeEach(() => {
    ms = new ModifierSystem();
  });

  describe('selectRandom', () => {
    it('returns a valid modifier every time', () => {
      for (let i = 0; i < 20; i++) {
        const mod = ms.selectRandom();
        expect(MODIFIERS).toContainEqual(mod);
      }
    });

    it('sets activeModifier', () => {
      expect(ms.activeModifier).toBeNull();
      ms.selectRandom();
      expect(ms.activeModifier).not.toBeNull();
    });

    it('distribution: 1000 rolls → all 6 modifiers appear', () => {
      const counts = new Map<string, number>();
      for (let i = 0; i < 1000; i++) {
        const mod = ms.selectRandom();
        counts.set(mod.id, (counts.get(mod.id) ?? 0) + 1);
      }
      for (const mod of MODIFIERS) {
        expect(counts.get(mod.id)).toBeGreaterThan(0);
      }
    });
  });

  describe('selectFixed', () => {
    it('returns the specified modifier', () => {
      const mod = ms.selectFixed('double_jump');
      expect(mod.id).toBe('double_jump');
      expect(ms.activeModifier?.id).toBe('double_jump');
    });

    it('falls back to random for nonexistent ID', () => {
      const mod = ms.selectFixed('nonexistent');
      expect(MODIFIERS).toContainEqual(mod);
    });
  });

  describe('activeModifierLabel', () => {
    it('returns "None" when no modifier active', () => {
      expect(ms.activeModifierLabel).toBe('None');
    });

    it('returns label of active modifier', () => {
      ms.selectFixed('low_gravity');
      expect(ms.activeModifierLabel).toBe('Low Gravity');
    });
  });

  describe('tryDoubleJump', () => {
    it('returns false when modifier is not double_jump', () => {
      ms.selectFixed('low_gravity');
      const entity = createMockEntity({ isGrounded: false });
      expect(ms.tryDoubleJump('p1', entity, { sp: true })).toBe(false);
    });

    it('applies impulse when airborne + space + not used', () => {
      ms.selectFixed('double_jump');
      const entity = createMockEntity({ isGrounded: false });
      entity.applyImpulse = vi.fn();

      const result = ms.tryDoubleJump('p1', entity, { sp: true });
      expect(result).toBe(true);
      expect(entity.applyImpulse).toHaveBeenCalledWith({ x: 0, y: 8, z: 0 });
    });

    it('does not double-jump twice in the air', () => {
      ms.selectFixed('double_jump');
      const entity = createMockEntity({ isGrounded: false });
      entity.applyImpulse = vi.fn();

      ms.tryDoubleJump('p1', entity, { sp: true }); // first jump
      const result = ms.tryDoubleJump('p1', entity, { sp: true }); // second attempt
      expect(result).toBe(false);
      expect(entity.applyImpulse).toHaveBeenCalledTimes(1);
    });

    it('resets on ground', () => {
      ms.selectFixed('double_jump');
      const entity = createMockEntity({ isGrounded: false });
      entity.applyImpulse = vi.fn();

      ms.tryDoubleJump('p1', entity, { sp: true }); // use jump

      // Land on ground
      entity.controller.isGrounded = true;
      ms.tryDoubleJump('p1', entity, { sp: false });

      // Take off again
      entity.controller.isGrounded = false;
      const result = ms.tryDoubleJump('p1', entity, { sp: true });
      expect(result).toBe(true);
      expect(entity.applyImpulse).toHaveBeenCalledTimes(2);
    });
  });

  describe('tryBlink', () => {
    it('returns false when modifier is not blink_pads', () => {
      ms.selectFixed('low_gravity');
      const entity = createMockEntity();
      expect(ms.tryBlink('p1', entity, { f: true })).toBe(false);
    });

    it('teleports on first blink', () => {
      ms.selectFixed('blink_pads');
      const entity = createMockEntity();
      entity.setPosition = vi.fn();

      const result = ms.tryBlink('p1', entity, { f: true });
      expect(result).toBe(true);
      expect(entity.setPosition).toHaveBeenCalled();
    });

    it('enforces 1500ms cooldown', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(10000));

      ms.selectFixed('blink_pads');
      const entity = createMockEntity();
      entity.setPosition = vi.fn();

      ms.tryBlink('p1', entity, { f: true }); // first blink at t=10000

      vi.setSystemTime(new Date(11000)); // 1000ms later
      const result = ms.tryBlink('p1', entity, { f: true });
      expect(result).toBe(false);

      vi.setSystemTime(new Date(11500)); // 1500ms after first
      const result2 = ms.tryBlink('p1', entity, { f: true });
      expect(result2).toBe(true);

      vi.useRealTimers();
    });

    it('returns false without shift key', () => {
      ms.selectFixed('blink_pads');
      const entity = createMockEntity();
      expect(ms.tryBlink('p1', entity, { f: false })).toBe(false);
    });
  });

  describe('apply / reset', () => {
    it('apply dark_mode sets light values', () => {
      const world = createMockWorld();
      world.setAmbientLightIntensity = vi.fn();
      world.setDirectionalLightIntensity = vi.fn();

      ms.selectFixed('dark_mode');
      ms.apply(world, () => []);

      expect(world.setAmbientLightIntensity).toHaveBeenCalledWith(0.05);
      expect(world.setDirectionalLightIntensity).toHaveBeenCalledWith(0.1);
    });

    it('apply low_gravity sets gravity', () => {
      const world = createMockWorld();
      world.simulation.setGravity = vi.fn();

      ms.selectFixed('low_gravity');
      ms.apply(world, () => []);

      expect(world.simulation.setGravity).toHaveBeenCalledWith({ x: 0, y: -12, z: 0 });
    });

    it('reset restores gravity and lighting', () => {
      const world = createMockWorld();
      world.simulation.setGravity = vi.fn();
      world.setAmbientLightIntensity = vi.fn();
      world.setDirectionalLightIntensity = vi.fn();

      ms.selectFixed('dark_mode');
      ms.apply(world, () => []);
      ms.reset(world, () => []);

      expect(world.simulation.setGravity).toHaveBeenCalledWith({ x: 0, y: -32, z: 0 });
      expect(world.setAmbientLightIntensity).toHaveBeenCalledWith(1);
      expect(world.setDirectionalLightIntensity).toHaveBeenCalledWith(1);
    });

    it('reset clears activeModifier', () => {
      const world = createMockWorld();
      ms.selectFixed('low_gravity');
      ms.reset(world, () => []);
      expect(ms.activeModifier).toBeNull();
    });
  });

  describe('applyToPlayer', () => {
    it('ice_floor sets walk=6 run=12', () => {
      ms.selectFixed('ice_floor');
      const entity = createMockEntity();
      ms.applyToPlayer(entity);
      expect(entity.controller.walkVelocity).toBe(6);
      expect(entity.controller.runVelocity).toBe(12);
    });

    it('speed_boost sets correct velocities', () => {
      ms.selectFixed('speed_boost');
      const entity = createMockEntity();
      ms.applyToPlayer(entity);
      expect(entity.controller.walkVelocity).toBe(Math.round(4 * 1.15));
      expect(entity.controller.runVelocity).toBe(Math.round(8 * 1.15));
    });

    it('no-op when no active modifier', () => {
      const entity = createMockEntity();
      ms.applyToPlayer(entity);
      expect(entity.controller.walkVelocity).toBe(4); // unchanged
    });
  });
});
