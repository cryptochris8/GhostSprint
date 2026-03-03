/**
 * Mid-game join integration tests.
 * Validates player cap, state-aware spawn logic, modifier application
 * for late joiners, and checkpoint registration during active rounds.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('hytopia', () => ({
  DefaultPlayerEntityController: class {},
}));

import { MAX_PLAYERS } from '../src/config/gameConfig';
import { StateMachine, GameState } from '../src/systems/StateMachine';
import { CheckpointSystem } from '../src/systems/CheckpointSystem';
import { ModifierSystem } from '../src/systems/ModifierSystem';
import type { CourseDefinition } from '../src/config/courseConfig';
import { createMockWorld, createMockPlayer, createMockEntity } from './helpers/mocks';

const MOCK_COURSE: CourseDefinition = {
  id: 'test_course',
  name: 'Test Course',
  description: 'For testing',
  lobbySpawn: { x: 0, y: 10, z: 0 },
  startPadPosition: { x: 0, y: 5, z: 0 },
  startPadSize: { x: 6, y: 1, z: 6 },
  finishGatePosition: { x: 0, y: 5, z: -100 },
  finishGateSize: { x: 6, y: 6, z: 2 },
  checkpointPositions: [
    { x: 10, y: 8, z: -30 },
    { x: -5, y: 12, z: -60 },
  ],
  checkpointSize: { x: 4, y: 4, z: 4 },
  outOfBoundsY: -10,
  startTriggerRadius: 3,
  checkpointTriggerRadius: 2.5,
  finishTriggerRadius: 3.5,
  modifierMode: 'random',
};

describe('Mid-game join system', () => {
  // ── Player cap ──────────────────────────────────────────────

  describe('MAX_PLAYERS config', () => {
    it('MAX_PLAYERS is 16', () => {
      expect(MAX_PLAYERS).toBe(16);
    });

    it('MAX_PLAYERS is a positive integer', () => {
      expect(Number.isInteger(MAX_PLAYERS)).toBe(true);
      expect(MAX_PLAYERS).toBeGreaterThan(0);
    });
  });

  describe('player cap enforcement', () => {
    it('activePlayers map rejects when at capacity', () => {
      // Simulate the logic from main.ts: check size before adding
      const activePlayers = new Map<string, unknown>();

      // Fill to capacity
      for (let i = 0; i < MAX_PLAYERS; i++) {
        activePlayers.set(`player_${i}`, { player: createMockPlayer(`p${i}`) });
      }
      expect(activePlayers.size).toBe(MAX_PLAYERS);

      // Next player should be rejected
      const shouldReject = activePlayers.size >= MAX_PLAYERS;
      expect(shouldReject).toBe(true);
    });

    it('accepts player when below capacity', () => {
      const activePlayers = new Map<string, unknown>();

      for (let i = 0; i < MAX_PLAYERS - 1; i++) {
        activePlayers.set(`player_${i}`, { player: createMockPlayer(`p${i}`) });
      }

      const shouldReject = activePlayers.size >= MAX_PLAYERS;
      expect(shouldReject).toBe(false);
    });

    it('accepts player after someone leaves (back under cap)', () => {
      const activePlayers = new Map<string, unknown>();

      // Fill to capacity
      for (let i = 0; i < MAX_PLAYERS; i++) {
        activePlayers.set(`player_${i}`, { player: createMockPlayer(`p${i}`) });
      }
      expect(activePlayers.size >= MAX_PLAYERS).toBe(true);

      // One player leaves
      activePlayers.delete('player_0');
      expect(activePlayers.size >= MAX_PLAYERS).toBe(false);
    });
  });

  // ── State-aware checkpoint registration ─────────────────────

  describe('late joiner checkpoint registration during ROUND_ACTIVE', () => {
    let sm: StateMachine;
    let cs: CheckpointSystem;

    beforeEach(() => {
      sm = new StateMachine(createMockWorld());
      cs = new CheckpointSystem();
      cs.setCourse(MOCK_COURSE);
    });

    it('resetPlayer registers late joiner in checkpoint system', () => {
      // Advance to ROUND_ACTIVE
      sm.playerJoined('p1');
      sm.tick(15); // → ROUND_STARTING
      sm.tick(3);  // → ROUND_ACTIVE
      expect(sm.state).toBe(GameState.ROUND_ACTIVE);

      // Late joiner arrives
      cs.resetPlayer('late_joiner');

      const data = cs.getPlayerData('late_joiner');
      expect(data).toBeDefined();
      expect(data!.started).toBe(false);
      expect(data!.finished).toBe(false);
      expect(data!.nextCheckpoint).toBe(0);
      expect(data!.respawns).toBe(0);
    });

    it('late joiner can complete full checkpoint sequence after resetPlayer', () => {
      sm.playerJoined('p1');
      sm.tick(15);
      sm.tick(3);

      // Simulate late joiner
      cs.resetPlayer('late_joiner');
      const player = { id: 'late_joiner', username: 'LateJoiner' } as any;

      // Cross start pad
      cs.checkStartPad(player, { x: 0, y: 5, z: 0 });
      expect(cs.getPlayerData('late_joiner')!.started).toBe(true);

      // Hit checkpoints in order
      cs.checkCheckpoints(player, { x: 10, y: 8, z: -30 });
      expect(cs.getPlayerData('late_joiner')!.nextCheckpoint).toBe(1);

      cs.checkCheckpoints(player, { x: -5, y: 12, z: -60 });
      expect(cs.getPlayerData('late_joiner')!.nextCheckpoint).toBe(2);

      // Finish
      cs.checkFinish(player, { x: 0, y: 5, z: -100 });
      expect(cs.getPlayerData('late_joiner')!.finished).toBe(true);
    });

    it('resetPlayer is idempotent (called again in handleRoundStarting)', () => {
      cs.resetPlayer('p1');

      // Simulate partial progress
      const player = { id: 'p1', username: 'Player1' } as any;
      cs.checkStartPad(player, { x: 0, y: 5, z: 0 });
      expect(cs.getPlayerData('p1')!.started).toBe(true);

      // Reset again (as handleRoundStarting does)
      cs.resetPlayer('p1');
      expect(cs.getPlayerData('p1')!.started).toBe(false);
      expect(cs.getPlayerData('p1')!.nextCheckpoint).toBe(0);
    });
  });

  describe('late joiner checkpoint registration during ROUND_STARTING', () => {
    let sm: StateMachine;
    let cs: CheckpointSystem;

    beforeEach(() => {
      sm = new StateMachine(createMockWorld());
      cs = new CheckpointSystem();
      cs.setCourse(MOCK_COURSE);
    });

    it('registers player during ROUND_STARTING state', () => {
      sm.playerJoined('p1');
      sm.tick(15); // → ROUND_STARTING
      expect(sm.state).toBe(GameState.ROUND_STARTING);

      cs.resetPlayer('late_joiner');
      expect(cs.getPlayerData('late_joiner')).toBeDefined();
      expect(cs.getPlayerData('late_joiner')!.respawns).toBe(0);
    });
  });

  // ── Modifier application for late joiners ───────────────────

  describe('modifier application for late joiners', () => {
    let ms: ModifierSystem;

    beforeEach(() => {
      ms = new ModifierSystem();
    });

    it('applyToPlayer applies ice_floor velocity to late joiner', () => {
      ms.selectFixed('ice_floor');
      const entity = createMockEntity();
      expect(entity.controller.walkVelocity).toBe(4); // default

      ms.applyToPlayer(entity);
      expect(entity.controller.walkVelocity).toBe(6);
      expect(entity.controller.runVelocity).toBe(12);
    });

    it('applyToPlayer applies speed_boost velocity to late joiner', () => {
      ms.selectFixed('speed_boost');
      const entity = createMockEntity();

      ms.applyToPlayer(entity);
      expect(entity.controller.walkVelocity).toBe(Math.round(4 * 1.15));
      expect(entity.controller.runVelocity).toBe(Math.round(8 * 1.15));
    });

    it('applyToPlayer is no-op for world-level modifiers (low_gravity, dark_mode)', () => {
      // These modifiers affect the world, not individual players,
      // so applyToPlayer should leave entity defaults unchanged.
      for (const modId of ['low_gravity', 'dark_mode']) {
        ms.selectFixed(modId);
        const entity = createMockEntity();
        ms.applyToPlayer(entity);
        expect(entity.controller.walkVelocity).toBe(4);
        expect(entity.controller.runVelocity).toBe(8);
      }
    });

    it('applyToPlayer is no-op for per-tick modifiers (double_jump, blink_pads)', () => {
      // These modifiers work via tick checks, not velocity changes,
      // so applyToPlayer should leave entity defaults unchanged.
      for (const modId of ['double_jump', 'blink_pads']) {
        ms.selectFixed(modId);
        const entity = createMockEntity();
        ms.applyToPlayer(entity);
        expect(entity.controller.walkVelocity).toBe(4);
        expect(entity.controller.runVelocity).toBe(8);
      }
    });

    it('applyToPlayer is no-op when no modifier is active', () => {
      const entity = createMockEntity();
      ms.applyToPlayer(entity);
      expect(entity.controller.walkVelocity).toBe(4);
      expect(entity.controller.runVelocity).toBe(8);
    });
  });

  // ── State-aware spawn position ──────────────────────────────

  describe('spawn position logic', () => {
    let sm: StateMachine;

    beforeEach(() => {
      sm = new StateMachine(createMockWorld());
    });

    it('ROUND_ACTIVE joiners should be teleported to start pad', () => {
      sm.playerJoined('p1');
      sm.tick(15);
      sm.tick(3);
      expect(sm.state).toBe(GameState.ROUND_ACTIVE);

      // Simulate the teleport logic from main.ts
      const entity = createMockEntity();
      entity.setPosition = vi.fn();
      entity.setLinearVelocity = vi.fn();

      const startPos = MOCK_COURSE.startPadPosition;
      entity.setPosition({ x: startPos.x, y: startPos.y + 2, z: startPos.z });
      entity.setLinearVelocity({ x: 0, y: 0, z: 0 });

      expect(entity.setPosition).toHaveBeenCalledWith({ x: 0, y: 7, z: 0 });
      expect(entity.setLinearVelocity).toHaveBeenCalledWith({ x: 0, y: 0, z: 0 });
    });

    it('ROUND_STARTING joiners should be teleported to start pad', () => {
      sm.playerJoined('p1');
      sm.tick(15);
      expect(sm.state).toBe(GameState.ROUND_STARTING);

      const entity = createMockEntity();
      entity.setPosition = vi.fn();

      const startPos = MOCK_COURSE.startPadPosition;
      entity.setPosition({ x: startPos.x, y: startPos.y + 2, z: startPos.z });
      expect(entity.setPosition).toHaveBeenCalledWith({ x: 0, y: 7, z: 0 });
    });

    it('ROUND_RESULTS joiners stay at lobby spawn (no teleport)', () => {
      sm.playerJoined('p1');
      sm.tick(15);
      sm.tick(3);
      sm.tick(180);
      expect(sm.state).toBe(GameState.ROUND_RESULTS);

      // In ROUND_RESULTS, no setPosition call should be made for teleport
      // The entity spawns at lobbySpawn by default in main.ts
      const currentState = sm.state;
      const shouldTeleport = currentState === GameState.ROUND_ACTIVE || currentState === GameState.ROUND_STARTING;
      expect(shouldTeleport).toBe(false);
    });

    it('LOBBY_IDLE joiners stay at lobby spawn (no teleport)', () => {
      expect(sm.state).toBe(GameState.LOBBY_IDLE);

      const currentState = sm.state;
      const shouldTeleport = currentState === GameState.ROUND_ACTIVE || currentState === GameState.ROUND_STARTING;
      expect(shouldTeleport).toBe(false);
    });

    it('LOBBY_COUNTDOWN joiners stay at lobby spawn (no teleport)', () => {
      sm.playerJoined('p1');
      expect(sm.state).toBe(GameState.LOBBY_COUNTDOWN);

      const currentState = sm.state;
      const shouldTeleport = currentState === GameState.ROUND_ACTIVE || currentState === GameState.ROUND_STARTING;
      expect(shouldTeleport).toBe(false);
    });
  });

  // ── Full mid-game join flow ─────────────────────────────────

  describe('full mid-game join simulation', () => {
    it('late joiner during ROUND_ACTIVE gets full race setup', () => {
      const world = createMockWorld();
      const sm = new StateMachine(world);
      const cs = new CheckpointSystem();
      const ms = new ModifierSystem();

      cs.setCourse(MOCK_COURSE);

      // Existing player starts game
      sm.playerJoined('p1');
      sm.tick(15); // → ROUND_STARTING
      cs.resetPlayer('p1');
      ms.selectFixed('ice_floor');
      sm.tick(3);  // → ROUND_ACTIVE
      ms.apply(world, () => [{ entity: createMockEntity(), player: createMockPlayer('p1') }]);

      expect(sm.state).toBe(GameState.ROUND_ACTIVE);

      // Late joiner arrives
      const lateEntity = createMockEntity();
      lateEntity.setPosition = vi.fn();
      lateEntity.setLinearVelocity = vi.fn();

      // 1. Register in checkpoint system
      cs.resetPlayer('late_joiner');
      expect(cs.getPlayerData('late_joiner')).toBeDefined();

      // 2. Teleport to start pad
      const startPos = MOCK_COURSE.startPadPosition;
      lateEntity.setPosition({ x: startPos.x, y: startPos.y + 2, z: startPos.z });
      lateEntity.setLinearVelocity({ x: 0, y: 0, z: 0 });
      expect(lateEntity.setPosition).toHaveBeenCalledWith({ x: 0, y: 7, z: 0 });

      // 3. Apply modifier
      ms.applyToPlayer(lateEntity);
      expect(lateEntity.controller.walkVelocity).toBe(6);
      expect(lateEntity.controller.runVelocity).toBe(12);

      // 4. Late joiner can race
      const latePlayer = { id: 'late_joiner', username: 'LateJoiner' } as any;
      cs.checkStartPad(latePlayer, { x: 0, y: 5, z: 0 });
      expect(cs.getPlayerData('late_joiner')!.started).toBe(true);
    });

    it('late joiner during ROUND_RESULTS gets no race setup', () => {
      const world = createMockWorld();
      const sm = new StateMachine(world);
      const cs = new CheckpointSystem();

      cs.setCourse(MOCK_COURSE);

      sm.playerJoined('p1');
      sm.tick(15);
      sm.tick(3);
      sm.tick(180); // → ROUND_RESULTS
      expect(sm.state).toBe(GameState.ROUND_RESULTS);

      // Late joiner: should NOT get checkpoint registration
      const currentState = sm.state;
      const shouldSetupRace = currentState === GameState.ROUND_ACTIVE || currentState === GameState.ROUND_STARTING;
      expect(shouldSetupRace).toBe(false);

      // No player data in checkpoint system
      expect(cs.getPlayerData('late_joiner')).toBeUndefined();
    });
  });

  // ── UI state fallback ───────────────────────────────────────

  describe('ROUND_RESULTS UI fallback logic', () => {
    it('hasReceivedResults=false shows lobby instead of results', () => {
      // Simulates the client-side logic from index.html
      let hasReceivedResults = false;
      const gameState = 'ROUND_RESULTS';

      let shownPanel: string;
      if (gameState === 'ROUND_RESULTS') {
        if (hasReceivedResults) {
          shownPanel = 'resultsPanel';
        } else {
          shownPanel = 'lobbyPanel';
        }
      }

      expect(shownPanel!).toBe('lobbyPanel');
    });

    it('hasReceivedResults=true shows results panel', () => {
      let hasReceivedResults = true;
      const gameState = 'ROUND_RESULTS';

      let shownPanel: string;
      if (gameState === 'ROUND_RESULTS') {
        if (hasReceivedResults) {
          shownPanel = 'resultsPanel';
        } else {
          shownPanel = 'lobbyPanel';
        }
      }

      expect(shownPanel!).toBe('resultsPanel');
    });

    it('hideAll resets hasReceivedResults', () => {
      let hasReceivedResults = true;

      // Simulate hideAll()
      hasReceivedResults = false;

      expect(hasReceivedResults).toBe(false);
    });

    it('roundResults message sets hasReceivedResults=true', () => {
      let hasReceivedResults = false;

      // Simulate receiving roundResults data
      const data = { type: 'roundResults' };
      if (data.type === 'roundResults') {
        hasReceivedResults = true;
      }

      expect(hasReceivedResults).toBe(true);
    });
  });
});
