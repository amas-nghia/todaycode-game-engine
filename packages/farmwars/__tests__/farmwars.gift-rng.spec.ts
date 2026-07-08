import { giftPositionsForTurn } from '../src/gift-rng';
import { team1Bases } from '../src/initial-state';
import * as fs from 'fs';
import * as path from 'path';

describe('FarmWars v2 Gift RNG Parity', () => {
  const loadFixture = (filename: string) => {
    const filePath = path.join(__dirname, 'fixtures', filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  };

  const seeds = [1000001, 1000002, 1000003];

  for (const seed of seeds) {
    it(`should match gift spawns in replay for seed ${seed}`, () => {
      const replay = loadFixture(`seed-${seed}.json`);

      const expectedSpawns: Array<{ turn: number; positions: any[] }> = [];
      for (const t of replay.turns) {
        for (const e of t.events) {
          if (e.type === 'gift_spawn') {
            expectedSpawns.push({
              turn: t.turn,
              positions: e.gifts.map((g: any) => ({ x: g.x, y: g.y })),
            });
          }
        }
      }

      expect(expectedSpawns.length).toBeGreaterThan(0);

      for (const spawn of expectedSpawns) {
        const positions = giftPositionsForTurn(seed, spawn.turn, team1Bases);
        expect(positions).toEqual([
          { x: spawn.positions[0].x, y: spawn.positions[0].y },
          { x: spawn.positions[1].x, y: spawn.positions[1].y },
        ]);
      }
    });
  }
});
