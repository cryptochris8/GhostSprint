/**
 * Round-based state machine.
 * States: LOBBY_IDLE → LOBBY_COUNTDOWN → ROUND_STARTING → ROUND_ACTIVE → ROUND_RESULTS → LOBBY_IDLE
 */

import type { World, Player } from 'hytopia';
import {
  MIN_PLAYERS_TO_START,
  LOBBY_COUNTDOWN_SEC,
  STARTING_FREEZE_SEC,
  ROUND_DURATION_SEC,
  RESULTS_DURATION_SEC,
  DEBUG_MODE,
} from '../config/gameConfig';

export enum GameState {
  LOBBY_IDLE = 'LOBBY_IDLE',
  LOBBY_COUNTDOWN = 'LOBBY_COUNTDOWN',
  ROUND_STARTING = 'ROUND_STARTING',
  ROUND_ACTIVE = 'ROUND_ACTIVE',
  ROUND_RESULTS = 'ROUND_RESULTS',
}

export type StateChangeCallback = (prev: GameState, next: GameState) => void;

export class StateMachine {
  private _state: GameState = GameState.LOBBY_IDLE;
  private _stateTimer = 0; // seconds remaining in current timed state
  private _listeners: StateChangeCallback[] = [];
  private _world: World;
  private _activePlayers: Set<string> = new Set(); // player ids

  constructor(world: World) {
    this._world = world;
  }

  get state(): GameState { return this._state; }
  get stateTimer(): number { return this._stateTimer; }
  get activePlayers(): Set<string> { return this._activePlayers; }

  /** Register a callback for state transitions */
  onStateChange(cb: StateChangeCallback): void {
    this._listeners.push(cb);
  }

  /** Call when a player joins the world */
  playerJoined(playerId: string): void {
    this._activePlayers.add(playerId);
    // Trigger countdown if enough players while idle
    if (this._state === GameState.LOBBY_IDLE && this._activePlayers.size >= MIN_PLAYERS_TO_START) {
      this._transition(GameState.LOBBY_COUNTDOWN);
      this._stateTimer = LOBBY_COUNTDOWN_SEC;
    }
  }

  /** Call when a player leaves the world */
  playerLeft(playerId: string): void {
    this._activePlayers.delete(playerId);
    // Cancel countdown if not enough players
    if (this._state === GameState.LOBBY_COUNTDOWN && this._activePlayers.size < MIN_PLAYERS_TO_START) {
      this._transition(GameState.LOBBY_IDLE);
      this._stateTimer = 0;
    }
  }

  /** Tick every second from the main loop */
  tick(deltaSec: number): void {
    if (this._stateTimer > 0) {
      this._stateTimer = Math.max(0, this._stateTimer - deltaSec);
    }

    switch (this._state) {
      case GameState.LOBBY_IDLE:
        // Check if we have enough players to start
        if (this._activePlayers.size >= MIN_PLAYERS_TO_START) {
          this._transition(GameState.LOBBY_COUNTDOWN);
          this._stateTimer = LOBBY_COUNTDOWN_SEC;
        }
        break;

      case GameState.LOBBY_COUNTDOWN:
        if (this._activePlayers.size < MIN_PLAYERS_TO_START) {
          this._transition(GameState.LOBBY_IDLE);
          this._stateTimer = 0;
        } else if (this._stateTimer <= 0) {
          this._transition(GameState.ROUND_STARTING);
          this._stateTimer = STARTING_FREEZE_SEC;
        }
        break;

      case GameState.ROUND_STARTING:
        if (this._stateTimer <= 0) {
          this._transition(GameState.ROUND_ACTIVE);
          this._stateTimer = ROUND_DURATION_SEC;
        }
        break;

      case GameState.ROUND_ACTIVE:
        if (this._stateTimer <= 0) {
          this._transition(GameState.ROUND_RESULTS);
          this._stateTimer = RESULTS_DURATION_SEC;
        }
        break;

      case GameState.ROUND_RESULTS:
        if (this._stateTimer <= 0) {
          this._transition(GameState.LOBBY_IDLE);
          this._stateTimer = 0;
        }
        break;
    }
  }

  /** Force end the round early (e.g. all players finished) */
  forceResults(): void {
    if (this._state === GameState.ROUND_ACTIVE) {
      this._transition(GameState.ROUND_RESULTS);
      this._stateTimer = RESULTS_DURATION_SEC;
    }
  }

  private _transition(next: GameState): void {
    const prev = this._state;
    if (prev === next) return;
    this._state = next;
    if (DEBUG_MODE) {
      console.log(`[StateMachine] ${prev} → ${next}`);
    }
    for (const cb of this._listeners) {
      cb(prev, next);
    }
  }
}
