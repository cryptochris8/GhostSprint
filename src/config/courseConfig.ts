/**
 * Multi-course definitions for GhostSprint.
 * Each course defines its own geometry, trigger radii, and modifier mode.
 */

import type { Vector3Like } from 'hytopia';

export interface CourseDefinition {
  id: string;
  name: string;
  description: string;
  lobbySpawn: Vector3Like;
  startPadPosition: Vector3Like;
  startPadSize: Vector3Like;
  finishGatePosition: Vector3Like;
  finishGateSize: Vector3Like;
  checkpointPositions: Vector3Like[];
  checkpointSize: Vector3Like;
  outOfBoundsY: number;
  /** Trigger radius for start pad proximity check */
  startTriggerRadius: number;
  /** Trigger radius for checkpoint proximity check */
  checkpointTriggerRadius: number;
  /** Trigger radius for finish gate proximity check */
  finishTriggerRadius: number;
  /** 'random' = roll a random modifier each round; 'fixed' = always use fixedModifierId */
  modifierMode: 'random' | 'fixed';
  /** Only used when modifierMode is 'fixed' */
  fixedModifierId?: string;
}

export const COURSES: CourseDefinition[] = [
  // ── Course 1: Neon Gauntlet (existing) ─────────────────
  {
    id: 'course1',
    name: 'Neon Gauntlet',
    description: 'Classic serpentine run through neon obstacles',
    lobbySpawn: { x: 0, y: 10, z: 0 },
    startPadPosition: { x: 0, y: 5, z: -20 },
    startPadSize: { x: 6, y: 1, z: 6 },
    finishGatePosition: { x: 0, y: 5, z: -200 },
    finishGateSize: { x: 6, y: 6, z: 2 },
    checkpointPositions: [
      { x: 10, y: 8, z: -40 },
      { x: -5, y: 12, z: -60 },
      { x: 15, y: 10, z: -80 },
      { x: -10, y: 15, z: -100 },
      { x: 5, y: 12, z: -120 },
      { x: -15, y: 18, z: -140 },
      { x: 10, y: 14, z: -160 },
      { x: 0, y: 20, z: -180 },
    ],
    checkpointSize: { x: 4, y: 4, z: 4 },
    outOfBoundsY: -10,
    startTriggerRadius: 3,
    checkpointTriggerRadius: 2.5,
    finishTriggerRadius: 3.5,
    modifierMode: 'random',
  },

  // ── Course 2: Shadow Run ───────────────────────────────
  {
    id: 'course2',
    name: 'Shadow Run',
    description: 'Near-blind navigation with wider platforms',
    lobbySpawn: { x: 0, y: 10, z: 0 },
    startPadPosition: { x: 50, y: 5, z: -20 },
    startPadSize: { x: 8, y: 1, z: 8 },
    finishGatePosition: { x: 50, y: 5, z: -140 },
    finishGateSize: { x: 8, y: 6, z: 2 },
    checkpointPositions: [
      { x: 55, y: 7, z: -40 },
      { x: 45, y: 9, z: -60 },
      { x: 58, y: 8, z: -80 },
      { x: 42, y: 10, z: -100 },
      { x: 52, y: 9, z: -115 },
      { x: 48, y: 11, z: -130 },
    ],
    checkpointSize: { x: 5, y: 4, z: 5 },
    outOfBoundsY: -10,
    startTriggerRadius: 3,
    checkpointTriggerRadius: 3.0,
    finishTriggerRadius: 4.0,
    modifierMode: 'fixed',
    fixedModifierId: 'dark_mode',
  },

  // ── Course 3: Sky Circuit ──────────────────────────────
  {
    id: 'course3',
    name: 'Sky Circuit',
    description: 'Vertical aerial platforms with big height gaps',
    lobbySpawn: { x: 0, y: 10, z: 0 },
    startPadPosition: { x: -60, y: 5, z: -20 },
    startPadSize: { x: 6, y: 1, z: 6 },
    finishGatePosition: { x: -60, y: 40, z: -180 },
    finishGateSize: { x: 6, y: 6, z: 2 },
    checkpointPositions: [
      { x: -55, y: 10, z: -40 },
      { x: -65, y: 16, z: -60 },
      { x: -58, y: 22, z: -80 },
      { x: -62, y: 28, z: -100 },
      { x: -55, y: 24, z: -120 },
      { x: -68, y: 30, z: -140 },
      { x: -58, y: 34, z: -155 },
      { x: -62, y: 38, z: -170 },
    ],
    checkpointSize: { x: 4, y: 4, z: 4 },
    outOfBoundsY: -10,
    startTriggerRadius: 3,
    checkpointTriggerRadius: 2.5,
    finishTriggerRadius: 3.5,
    modifierMode: 'fixed',
    fixedModifierId: 'double_jump',
  },

  // ── Course 4: Twisted Spire ────────────────────────────
  {
    id: 'course4',
    name: 'Twisted Spire',
    description: 'Spiral vertical climb on tight platforms',
    lobbySpawn: { x: 0, y: 10, z: 0 },
    startPadPosition: { x: 0, y: 5, z: 50 },
    startPadSize: { x: 5, y: 1, z: 5 },
    finishGatePosition: { x: 0, y: 45, z: 50 },
    finishGateSize: { x: 5, y: 6, z: 2 },
    checkpointPositions: [
      { x: 6, y: 9, z: 55 },
      { x: 8, y: 13, z: 45 },
      { x: 2, y: 17, z: 56 },
      { x: -6, y: 21, z: 52 },
      { x: -8, y: 25, z: 44 },
      { x: -2, y: 29, z: 55 },
      { x: 5, y: 33, z: 48 },
      { x: 7, y: 37, z: 54 },
      { x: -3, y: 40, z: 46 },
      { x: 0, y: 43, z: 50 },
    ],
    checkpointSize: { x: 3, y: 4, z: 3 },
    outOfBoundsY: -10,
    startTriggerRadius: 3,
    checkpointTriggerRadius: 2.5,
    finishTriggerRadius: 3.5,
    modifierMode: 'random',
  },
];
