/**
 * Data-driven cosmetic definitions.
 * Add new cosmetics here — no switch statements needed.
 */

export type CosmeticType = 'trail' | 'finishEffect';

export interface CosmeticDef {
  id: string;
  name: string;
  type: CosmeticType;
  price: number;
  /** RGB color for trails */
  color?: { r: number; g: number; b: number };
  /** Description shown in shop */
  description: string;
}

export const COSMETICS: CosmeticDef[] = [
  {
    id: 'trail_neon_green',
    name: 'Neon Green Trail',
    type: 'trail',
    price: 50,
    color: { r: 57, g: 255, b: 20 },
    description: 'A bright neon green trail follows you as you run.',
  },
  {
    id: 'trail_electric_blue',
    name: 'Electric Blue Trail',
    type: 'trail',
    price: 75,
    color: { r: 44, g: 117, b: 255 },
    description: 'An electric blue streak blazes behind you.',
  },
  {
    id: 'finish_confetti',
    name: 'Confetti Burst',
    type: 'finishEffect',
    price: 100,
    color: { r: 255, g: 215, b: 0 },
    description: 'Confetti explodes when you cross the finish line!',
  },
];

/** Lookup cosmetic by id */
export function getCosmeticById(id: string): CosmeticDef | undefined {
  return COSMETICS.find(c => c.id === id);
}
