import { Position } from './state';
import { MidCol, GridHeight, RightEdge } from './constants';

export const goldenGamma = 0x9e3779b1;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = (a ^ (a >>> 15)) >>> 0;
    t = Math.imul(t, (1 | a) >>> 0) >>> 0;
    t = (t + Math.imul(t ^ (t >>> 7), (61 | t) >>> 0)) >>> 0;
    t = (t ^ (t >>> 14)) >>> 0;
    return t / 4294967296.0;
  };
}

export function giftPositionsForTurn(
  seed: number,
  turn: number,
  team1Bases: Position[],
): [Position, Position] {
  // To match Go's: int32(turn) * int32(goldenGamma) we must use Math.imul
  const turnRngMix = Math.imul(turn, goldenGamma);
  const rngSeed = (seed ^ turnRngMix) >>> 0;
  const rng = mulberry32(rngSeed);
  const widthLeft = MidCol + 1;
  let x = 0;
  let y = 0;

  while (true) {
    x = Math.trunc(rng() * widthLeft);
    y = Math.trunc(rng() * GridHeight);

    // Check if it's a team 1 base
    const isBase = team1Bases.some((b) => b.x === x && b.y === y);
    if (!isBase) {
      break;
    }
  }

  return [
    { x, y },
    { x: RightEdge - x, y },
  ];
}
