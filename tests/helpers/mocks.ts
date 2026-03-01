/**
 * Lightweight mocks for Hytopia SDK types used in tests.
 */

export function createMockPlayer(id: string, username = 'TestPlayer'): any {
  let _persisted: Record<string, unknown> = {};
  return {
    id,
    username,
    getPersistedData: () => _persisted,
    setPersistedData: (data: Record<string, unknown>) => {
      _persisted = { ..._persisted, ...data };
    },
  };
}

export function createMockWorld(): any {
  return {
    simulation: {
      setGravity: (_g: any) => {},
    },
    setAmbientLightIntensity: (_v: number) => {},
    setDirectionalLightIntensity: (_v: number) => {},
  };
}

export function createMockEntity(opts?: {
  walkVelocity?: number;
  runVelocity?: number;
  isGrounded?: boolean;
}): any {
  const controller = {
    walkVelocity: opts?.walkVelocity ?? 4,
    runVelocity: opts?.runVelocity ?? 8,
    isGrounded: opts?.isGrounded ?? true,
  };
  return {
    controller,
    position: { x: 0, y: 5, z: 0 },
    rotation: { w: 1, x: 0, y: 0, z: 0 },
    applyImpulse: (_impulse: any) => {},
    setPosition: (pos: any) => {},
  };
}
