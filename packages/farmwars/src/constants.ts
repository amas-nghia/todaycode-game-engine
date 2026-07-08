export const GridWidth = 12;
export const GridHeight = 9;
export const MaxTicks = 200; // 200 ticks = 600 frames
export const FRAMES_PER_TICK = 3;
export const MaxFrames = MaxTicks * FRAMES_PER_TICK;
export const TreeBearFruitAge = 6; // ticks
export const GiftInterval = 10; // ticks
export const GiftRewardPoints = 5;
export const MidCol = 5; // x<=MidCol -> left half
export const RightEdge = 11; // xB = RightEdge - xA

export type Direction = 'up' | 'down' | 'left' | 'right' | 'stay';

export const ValidDirections: Record<string, boolean> = {
  up: true,
  down: true,
  left: true,
  right: true,
  stay: true,
};

export const DirectionDeltas: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  stay: { x: 0, y: 0 },
};

// Unit Stats definitions
export const ACTOR_STATS = {
  planter: { hp: 6, maxHp: 6, atk: 1, speed: 1, carry: 0 },
  harvester: { hp: 3, maxHp: 3, atk: 0, speed: 3, carry: 3 },
  worm: { hp: 4, maxHp: 4, atk: 3, speed: 2, carry: 0 },
} as const;

// Frame offset schedules for speed
// Speed 1 -> frame 0
// Speed 2 -> frames 0, 2
// Speed 3 -> frames 0, 1, 2
export const SPEED_SCHEDULES: Record<number, number[]> = {
  1: [0],
  2: [0, 2],
  3: [0, 1, 2],
};
