import { GiftChoice } from './state';
import { ValidDirections, Direction } from './constants';

export interface Actions {
  directions: Direction[];
  giftChoice: GiftChoice;
  baseSetup?: [number, number, number]; // non-null only on turn 0
}

export function parseActions(rawLines: string[], actorCount: number): Actions {
  const directions: Direction[] = Array(actorCount).fill('stay');

  for (let i = 0; i < actorCount; i++) {
    if (i < rawLines.length) {
      const d = rawLines[i].trim();
      if (ValidDirections[d]) {
        directions[i] = d as Direction;
      }
    }
  }

  let giftChoice: GiftChoice = 0;
  if (actorCount < rawLines.length) {
    const parts = rawLines[actorCount].trim().split(/\s+/);
    if (parts.length === 2 && parts[0] === 'gift') {
      const v = parseInt(parts[1], 10);
      if (!isNaN(v) && v >= 0 && v <= 3) {
        giftChoice = v as GiftChoice;
      }
    }
  }

  let baseSetup: [number, number, number] | undefined;
  if (actorCount + 1 < rawLines.length) {
    const parts = rawLines[actorCount + 1].trim().split(/\s+/);
    if (parts.length === 4 && parts[0] === 'base') {
      const v1 = parseInt(parts[1], 10);
      const v2 = parseInt(parts[2], 10);
      const v3 = parseInt(parts[3], 10);
      if (!isNaN(v1) && !isNaN(v2) && !isNaN(v3)) {
        baseSetup = [v1, v2, v3];
      }
    }
  }

  return { directions, giftChoice, baseSetup };
}
