/**
 * GhostSprint
 * Master game configuration. All tunable values live here.
 */

import type { Vector3Like } from 'hytopia';

// ── Session / Round ──────────────────────────────────────────
export const MIN_PLAYERS_TO_START = 2;
export const LOBBY_COUNTDOWN_SEC = 15;
export const ROUND_DURATION_SEC = 180;
export const STARTING_FREEZE_SEC = 3;
export const RESULTS_DURATION_SEC = 10;
export const COURSE_ID = 'course1';

// ── Course Geometry ──────────────────────────────────────────
export const LOBBY_SPAWN: Vector3Like = { x: 0, y: 10, z: 0 };

export const START_PAD_POSITION: Vector3Like = { x: 0, y: 5, z: -20 };
export const START_PAD_SIZE: Vector3Like = { x: 6, y: 1, z: 6 };

export const FINISH_GATE_POSITION: Vector3Like = { x: 0, y: 5, z: -200 };
export const FINISH_GATE_SIZE: Vector3Like = { x: 6, y: 6, z: 2 };

export const CHECKPOINT_POSITIONS: Vector3Like[] = [
  { x: 10, y: 8, z: -40 },
  { x: -5, y: 12, z: -60 },
  { x: 15, y: 10, z: -80 },
  { x: -10, y: 15, z: -100 },
  { x: 5, y: 12, z: -120 },
  { x: -15, y: 18, z: -140 },
  { x: 10, y: 14, z: -160 },
  { x: 0, y: 20, z: -180 },
];
export const CHECKPOINT_SIZE: Vector3Like = { x: 4, y: 4, z: 4 };

export const OUT_OF_BOUNDS_Y = -10;

// ── Modifiers ────────────────────────────────────────────────
export interface ModifierDef {
  id: string;
  label: string;
  weight: number;
}

export const MODIFIERS: ModifierDef[] = [
  { id: 'low_gravity',  label: 'Low Gravity',   weight: 1 },
  { id: 'ice_floor',    label: 'Ice Floor',     weight: 1 },
  { id: 'speed_boost',  label: 'Speed Boost',   weight: 1 },
  { id: 'double_jump',  label: 'Double Jump',   weight: 1 },
  { id: 'blink_pads',   label: 'Blink Pads',    weight: 1 },
  { id: 'dark_mode',    label: 'Dark Mode',     weight: 1 },
];

// ── XP ───────────────────────────────────────────────────────
export const XP_VALUES = {
  finish:  30,
  top1:    20,
  top2:    10,
  top3:    5,
  newPB:   25,
  dnf:     10,
};
export const XP_PER_LEVEL = 100;
export const COINS_PER_LEVEL_UP = 25;

// ── Ghost ────────────────────────────────────────────────────
export const GHOST_SAMPLE_INTERVAL_MS = 250;
export const GHOST_MAX_DURATION_MS = 60000;
export const GHOST_MAX_SAMPLES = Math.floor(GHOST_MAX_DURATION_MS / GHOST_SAMPLE_INTERVAL_MS);

// ── Debug ────────────────────────────────────────────────────
export const DEBUG_MODE = false;
