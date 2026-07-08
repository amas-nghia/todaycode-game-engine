/**
 * Deterministic splitmix64 RNG — port of pkg/gamecore/rng.go.
 *
 * CRITICAL: raw splitmix64 outputs are full 64-bit values that routinely
 * exceed Number.MAX_SAFE_INTEGER (2^53-1 ~= 9.007e15) — e.g. seed=1's first
 * output is 10451216379200822465. `next()` therefore returns `bigint`, not
 * `number`. Every intermediate `+`/`^`/`*` is masked to 64 bits with
 * `BigInt.asUintN(64, ...)` to replicate Go's silent uint64 wraparound.
 */

const GOLDEN_GAMMA = 0x9e3779b97f4a7c15n;
const MIX1 = 0xbf58476d1ce4e5b9n;
const MIX2 = 0x94d049bb133111ebn;
const MASK64 = (1n << 64n) - 1n;

export class RNG {
  private state: bigint;

  /**
   * Go seeds with `uint64(seed)` where `seed` is `int64` — for a negative
   * seed this is a two's-complement reinterpretation. `BigInt.asUintN(64, ...)`
   * replicates that wrap for negative bigints exactly.
   */
  constructor(seed: number | bigint) {
    this.state = BigInt.asUintN(64, BigInt(seed));
  }

  next(): bigint {
    this.state = BigInt.asUintN(64, this.state + GOLDEN_GAMMA);
    let z = this.state;
    z = BigInt.asUintN(64, BigInt.asUintN(64, z ^ (z >> 30n)) * MIX1);
    z = BigInt.asUintN(64, BigInt.asUintN(64, z ^ (z >> 27n)) * MIX2);
    return BigInt.asUintN(64, z ^ (z >> 31n));
  }

  /**
   * Returns a value in [0, n) using rejection sampling (no modulo bias).
   * Bounded by `n`, so the return value is a plain `number` (safe: `n` is a
   * small int by contract). Throws (not "panics") when `n <= 0`.
   */
  intN(n: number): number {
    if (n <= 0) {
      throw new Error(`rng: intN called with non-positive n=${n}`);
    }
    const un = BigInt(n);
    const limit = MASK64 - (MASK64 % un);
    for (;;) {
      const v = this.next();
      if (v <= limit) {
        return Number(v % un);
      }
    }
  }
}
