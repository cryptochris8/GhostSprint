import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('hytopia', () => ({}));

import { StateMachine, GameState } from '../src/systems/StateMachine';
import { createMockWorld } from './helpers/mocks';

describe('StateMachine', () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine(createMockWorld());
  });

  it('starts in LOBBY_IDLE', () => {
    expect(sm.state).toBe(GameState.LOBBY_IDLE);
  });

  it('LOBBY_IDLE → LOBBY_COUNTDOWN when player joins (MIN_PLAYERS=1)', () => {
    sm.playerJoined('p1');
    expect(sm.state).toBe(GameState.LOBBY_COUNTDOWN);
    expect(sm.stateTimer).toBe(15);
  });

  it('LOBBY_COUNTDOWN → LOBBY_IDLE when last player leaves', () => {
    sm.playerJoined('p1');
    expect(sm.state).toBe(GameState.LOBBY_COUNTDOWN);
    sm.playerLeft('p1');
    expect(sm.state).toBe(GameState.LOBBY_IDLE);
    expect(sm.stateTimer).toBe(0);
  });

  it('LOBBY_COUNTDOWN → ROUND_STARTING when timer expires', () => {
    sm.playerJoined('p1');
    sm.tick(15); // countdown = 15s
    expect(sm.state).toBe(GameState.ROUND_STARTING);
    expect(sm.stateTimer).toBe(3); // STARTING_FREEZE_SEC
  });

  it('ROUND_STARTING → ROUND_ACTIVE when timer expires', () => {
    sm.playerJoined('p1');
    sm.tick(15); // → ROUND_STARTING
    sm.tick(3);  // → ROUND_ACTIVE
    expect(sm.state).toBe(GameState.ROUND_ACTIVE);
    expect(sm.stateTimer).toBe(180); // ROUND_DURATION_SEC
  });

  it('ROUND_ACTIVE → ROUND_RESULTS when timer expires', () => {
    sm.playerJoined('p1');
    sm.tick(15); // → ROUND_STARTING
    sm.tick(3);  // → ROUND_ACTIVE
    sm.tick(180); // → ROUND_RESULTS
    expect(sm.state).toBe(GameState.ROUND_RESULTS);
    expect(sm.stateTimer).toBe(10); // RESULTS_DURATION_SEC
  });

  it('ROUND_RESULTS → LOBBY_IDLE when timer expires', () => {
    sm.playerJoined('p1');
    sm.tick(15); // → ROUND_STARTING
    sm.tick(3);  // → ROUND_ACTIVE
    sm.tick(180); // → ROUND_RESULTS
    sm.tick(10);  // → LOBBY_IDLE
    expect(sm.state).toBe(GameState.LOBBY_IDLE);
    expect(sm.stateTimer).toBe(0);
  });

  it('forceResults during ROUND_ACTIVE transitions to ROUND_RESULTS', () => {
    sm.playerJoined('p1');
    sm.tick(15);
    sm.tick(3);
    expect(sm.state).toBe(GameState.ROUND_ACTIVE);
    sm.forceResults();
    expect(sm.state).toBe(GameState.ROUND_RESULTS);
    expect(sm.stateTimer).toBe(10);
  });

  it('forceResults does nothing outside ROUND_ACTIVE', () => {
    sm.playerJoined('p1');
    expect(sm.state).toBe(GameState.LOBBY_COUNTDOWN);
    sm.forceResults();
    expect(sm.state).toBe(GameState.LOBBY_COUNTDOWN);
  });

  it('state change callbacks fire on transitions', () => {
    const cb = vi.fn();
    sm.onStateChange(cb);

    sm.playerJoined('p1');
    expect(cb).toHaveBeenCalledWith(GameState.LOBBY_IDLE, GameState.LOBBY_COUNTDOWN);

    sm.playerLeft('p1');
    expect(cb).toHaveBeenCalledWith(GameState.LOBBY_COUNTDOWN, GameState.LOBBY_IDLE);
  });

  it('activePlayers tracks joins and leaves', () => {
    sm.playerJoined('p1');
    sm.playerJoined('p2');
    expect(sm.activePlayers.size).toBe(2);
    expect(sm.activePlayers.has('p1')).toBe(true);

    sm.playerLeft('p1');
    expect(sm.activePlayers.size).toBe(1);
    expect(sm.activePlayers.has('p1')).toBe(false);
  });

  it('timer does not go below 0', () => {
    sm.playerJoined('p1');
    sm.tick(100); // way more than 15s countdown
    // Should have transitioned, timer should not be negative
    expect(sm.stateTimer).toBeGreaterThanOrEqual(0);
  });

  it('full cycle: IDLE → COUNTDOWN → STARTING → ACTIVE → RESULTS → IDLE', () => {
    const cb = vi.fn();
    sm.onStateChange(cb);

    sm.playerJoined('p1');
    sm.tick(15);
    sm.tick(3);
    sm.tick(180);
    sm.tick(10);

    expect(sm.state).toBe(GameState.LOBBY_IDLE);
    expect(cb).toHaveBeenCalledTimes(5);
  });
});
