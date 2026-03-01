import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('hytopia', () => ({}));

import { COURSES } from '../src/config/courseConfig';

// Load map.json — format: { blockTypes: [...], blocks: { "x,y,z": blockId } }
const mapPath = join(__dirname, '..', 'assets', 'map.json');
let blocks: Record<string, number> = {};

try {
  const raw = JSON.parse(readFileSync(mapPath, 'utf-8'));
  blocks = raw.blocks ?? {};
} catch {
  blocks = {};
}

function hasBlockAt(x: number, y: number, z: number): boolean {
  const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
  return key in blocks;
}

function hasBlockInRegion(
  cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number,
): boolean {
  const halfX = Math.ceil(rx / 2);
  const halfY = Math.ceil(ry / 2);
  const halfZ = Math.ceil(rz / 2);
  for (let dx = -halfX; dx <= halfX; dx++) {
    for (let dy = -halfY; dy <= halfY; dy++) {
      for (let dz = -halfZ; dz <= halfZ; dz++) {
        if (hasBlockAt(cx + dx, cy + dy, cz + dz)) return true;
      }
    }
  }
  return false;
}

describe('mapValidation', () => {
  it('map.json loaded with blocks', () => {
    expect(Object.keys(blocks).length).toBeGreaterThan(0);
  });

  it('all courses have blocks near start pad positions', () => {
    for (const course of COURSES) {
      const sp = course.startPadPosition;
      const sz = course.startPadSize;
      const found = hasBlockInRegion(sp.x, sp.y, sp.z, sz.x, sz.y, sz.z);
      expect(found, `Missing blocks at start pad for ${course.name} (${sp.x},${sp.y},${sp.z})`).toBe(true);
    }
  });

  it('all finish gates have blocks nearby', () => {
    for (const course of COURSES) {
      const fg = course.finishGatePosition;
      const sz = course.finishGateSize;
      const found = hasBlockInRegion(fg.x, fg.y, fg.z, sz.x, sz.y, sz.z);
      expect(found, `Missing blocks at finish gate for ${course.name} (${fg.x},${fg.y},${fg.z})`).toBe(true);
    }
  });

  it('all checkpoints have platform blocks nearby (3 below checkpoint Y)', () => {
    for (const course of COURSES) {
      for (let i = 0; i < course.checkpointPositions.length; i++) {
        const cp = course.checkpointPositions[i];
        const found = hasBlockInRegion(cp.x, cp.y - 3, cp.z, 4, 4, 4);
        expect(
          found,
          `Missing platform blocks for ${course.name} checkpoint ${i} at (${cp.x},${cp.y},${cp.z})`,
        ).toBe(true);
      }
    }
  });

  it('no blocks with non-positive IDs', () => {
    for (const [key, blockId] of Object.entries(blocks)) {
      expect(typeof blockId).toBe('number');
      expect(blockId, `Invalid block ID at ${key}`).toBeGreaterThan(0);
    }
  });

  it('course 1 region has blocks (sanity check)', () => {
    let blockCount = 0;
    for (const key of Object.keys(blocks)) {
      const [x, , z] = key.split(',').map(Number);
      if (x >= -25 && x <= 25 && z >= -210 && z <= -10) {
        blockCount++;
      }
    }
    expect(blockCount).toBeGreaterThan(0);
  });
});
