/**
 * Modifier system — picks 1 random modifier per round and applies it.
 * Each modifier is self-contained and easily extendable.
 */

import type { World, Player } from 'hytopia';
import { DefaultPlayerEntityController } from 'hytopia';
import { MODIFIERS, DEBUG_MODE } from '../config/gameConfig';
import type { ModifierDef } from '../config/gameConfig';

export class ModifierSystem {
  private _activeModifier: ModifierDef | null = null;
  private _world: World | null = null;
  private _originalGravity = { x: 0, y: -32, z: 0 };
  private _doubleJumpUsed: Map<string, boolean> = new Map();

  get activeModifier(): ModifierDef | null { return this._activeModifier; }
  get activeModifierLabel(): string { return this._activeModifier?.label ?? 'None'; }

  /** Select a random modifier weighted by config */
  selectRandom(): ModifierDef {
    const totalWeight = MODIFIERS.reduce((sum, m) => sum + m.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const mod of MODIFIERS) {
      roll -= mod.weight;
      if (roll <= 0) {
        this._activeModifier = mod;
        if (DEBUG_MODE) console.log(`[Modifier] Selected: ${mod.label}`);
        return mod;
      }
    }
    // Fallback
    this._activeModifier = MODIFIERS[0];
    return MODIFIERS[0];
  }

  /** Apply the active modifier to the world/players */
  apply(world: World, getPlayerEntities: () => Array<{ entity: any; player: Player }>): void {
    this._world = world;
    if (!this._activeModifier) return;

    const entries = getPlayerEntities();

    switch (this._activeModifier.id) {
      case 'low_gravity':
        world.simulation.setGravity({ x: 0, y: -12, z: 0 });
        break;

      case 'ice_floor':
        // Reduce walk/run friction by boosting velocity slightly
        // (True friction is block-level; we simulate via increased slide)
        for (const { entity } of entries) {
          const ctrl = entity.controller as DefaultPlayerEntityController;
          if (ctrl) {
            ctrl.walkVelocity = 6;
            ctrl.runVelocity = 12;
          }
        }
        break;

      case 'speed_boost':
        for (const { entity } of entries) {
          const ctrl = entity.controller as DefaultPlayerEntityController;
          if (ctrl) {
            ctrl.walkVelocity = Math.round(ctrl.walkVelocity * 1.15);
            ctrl.runVelocity = Math.round(ctrl.runVelocity * 1.15);
          }
        }
        break;

      case 'double_jump':
        this._doubleJumpUsed.clear();
        // Double jump is handled in tick — see allowDoubleJump()
        break;

      case 'blink_pads':
        // Blink pads add small forward teleport on shift press — handled in tick
        break;

      case 'dark_mode':
        world.setAmbientLightIntensity(0.05);
        world.setDirectionalLightIntensity(0.1);
        break;
    }
  }

  /** Reset modifier effects */
  reset(world: World, getPlayerEntities: () => Array<{ entity: any; player: Player }>): void {
    // Restore gravity
    world.simulation.setGravity(this._originalGravity);

    // Restore lighting
    world.setAmbientLightIntensity(1);
    world.setDirectionalLightIntensity(1);

    // Restore player velocities
    for (const { entity } of getPlayerEntities()) {
      const ctrl = entity.controller as DefaultPlayerEntityController;
      if (ctrl) {
        ctrl.walkVelocity = 4;
        ctrl.runVelocity = 8;
      }
    }

    this._activeModifier = null;
    this._doubleJumpUsed.clear();
  }

  /** Check if double jump is available for a player (call from tick) */
  tryDoubleJump(playerId: string, entity: any, input: any): boolean {
    if (this._activeModifier?.id !== 'double_jump') return false;

    const ctrl = entity.controller as DefaultPlayerEntityController;
    if (!ctrl) return false;

    // If player is in the air and presses space, and hasn't used double jump
    if (input.sp && !ctrl.isGrounded && !this._doubleJumpUsed.get(playerId)) {
      this._doubleJumpUsed.set(playerId, true);
      entity.applyImpulse({ x: 0, y: 8, z: 0 });
      return true;
    }

    // Reset double jump when grounded
    if (ctrl.isGrounded) {
      this._doubleJumpUsed.set(playerId, false);
    }
    return false;
  }

  /** Apply a blink teleport for the player (call from tick) */
  tryBlink(playerId: string, entity: any, input: any): boolean {
    if (this._activeModifier?.id !== 'blink_pads') return false;
    // Blink on 'f' key press
    if (!input.f) return false;

    const pos = entity.position;
    if (!pos) return false;

    // Teleport 5 units forward in the entity's facing direction
    const rot = entity.rotation;
    // Simple forward blink along -Z in entity local space
    const sinY = 2 * (rot.w * rot.y + rot.x * rot.z);
    const cosY = 1 - 2 * (rot.y * rot.y + rot.z * rot.z);
    const forwardX = -sinY * 5;
    const forwardZ = -cosY * 5;

    entity.setPosition({
      x: pos.x + forwardX,
      y: pos.y + 0.5,
      z: pos.z + forwardZ,
    });
    return true;
  }

  /** Apply modifier to a newly joined player mid-round */
  applyToPlayer(entity: any): void {
    if (!this._activeModifier) return;
    const ctrl = entity.controller as DefaultPlayerEntityController;
    if (!ctrl) return;

    switch (this._activeModifier.id) {
      case 'ice_floor':
        ctrl.walkVelocity = 6;
        ctrl.runVelocity = 12;
        break;
      case 'speed_boost':
        ctrl.walkVelocity = Math.round(4 * 1.15);
        ctrl.runVelocity = Math.round(8 * 1.15);
        break;
    }
  }
}
