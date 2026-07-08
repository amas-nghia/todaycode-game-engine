import { UNIT, add, isqrt, len2, moveToward, scale, sub, tile } from '../vec2';

describe('vec2', () => {
  describe('isqrt', () => {
    it.each([
      [-5, 0],
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 2],
      [8, 2],
      [9, 3],
      [15, 3],
      [16, 4],
      [1000000, 1000],
      [1000001, 1000],
      [999999, 999],
    ])('isqrt(%i) === %i', (input, expected) => {
      expect(isqrt(input)).toBe(expected);
    });
  });

  describe('add/sub/scale/len2', () => {
    it('adds two vectors', () => {
      expect(add(tile(1, 2), tile(3, 4))).toEqual(tile(4, 6));
    });

    it('subtracts two vectors', () => {
      expect(sub(tile(3, 4), tile(1, 2))).toEqual(tile(2, 2));
    });

    it('scales a vector', () => {
      expect(scale(tile(1, 2), 3)).toEqual(tile(3, 6));
    });

    it('computes squared length', () => {
      expect(len2({ x: 3, y: 4 })).toBe(25);
    });
  });

  describe('moveToward', () => {
    it('snaps exactly onto the target when the step covers the distance', () => {
      const from = tile(0, 0);
      const target = tile(0, 1);
      const result = moveToward(from, target, UNIT * 2);
      expect(result).toEqual(target);
    });

    it('does not move when maxStep is 0', () => {
      const from = tile(0, 0);
      const target = tile(0, 1);
      const result = moveToward(from, target, 0);
      expect(result).toEqual(from);
    });

    it('never overshoots and eventually reaches the target', () => {
      let pos = tile(0, 0);
      const target = tile(5, 0);
      const step = 66;
      let prevDist = len2(sub(target, pos));
      let iterations = 0;
      const maxIterations = 10000;

      while (!(pos.x === target.x && pos.y === target.y)) {
        iterations++;
        if (iterations > maxIterations) {
          throw new Error('moveToward did not converge within iteration cap');
        }
        pos = moveToward(pos, target, step);
        const dist = len2(sub(target, pos));
        expect(dist).toBeLessThanOrEqual(prevDist);
        prevDist = dist;
      }

      expect(pos).toEqual(target);
    });

    it('is deterministic across repeated runs of the same sequence', () => {
      const run = () => {
        let pos = tile(1, 1);
        const target = tile(9, 4);
        const step = 50;
        const path: { x: number; y: number }[] = [];
        let iterations = 0;
        while (!(pos.x === target.x && pos.y === target.y)) {
          iterations++;
          if (iterations > 10000) {
            throw new Error('moveToward did not converge within iteration cap');
          }
          pos = moveToward(pos, target, step);
          path.push(pos);
        }
        return path;
      };

      const first = run();
      const second = run();
      expect(second).toEqual(first);
    });
  });
});
