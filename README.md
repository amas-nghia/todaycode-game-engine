# todaycode-game-engine

## What it is

A game-agnostic, deterministic engine base: the `Engine` contract, `FrameDriver`,
a seeded splitmix64 `RNG`, integer-only `vec2` math, a `Replay`/`Outcome`
envelope, and `LevelDef`. Ported from a Go reference implementation
(`pkg/gamecore`), so any turn-based game can implement the same contract
without reinventing the loop, the RNG, or the replay wire format.

**This repo contains no game and never will.** It has no knowledge of Farm
Wars, missions, or any other specific ruleset — only the shape every such
ruleset plugs into.

| File | What it gives you |
|---|---|
| `gamecore.interface.ts` | The `Engine` contract every game implements: `name`, `version`, `init`, `applyOrders`, `tick`, `isOver`, `result`. Also `Commander` (an agent's decision-maker), `Outcome`, `Grader`, `Solvable`. |
| `frame-driver.ts` | `FrameDriver` — a generic turn loop: visit each commander in numeric agent-id order, collect orders, apply them, tick the engine, collect events, repeat until `isOver()`. Produces a `Replay`. Synchronous by design — real async bot matches (spawning a process, awaiting stdout, per-turn timeouts) hand-roll their own version of this loop in the consuming app. |
| `replay.ts` | `Replay` / `FrameEvents` / `toReplayJSON` / `toOutcomeJSON` — the wire envelope, with `omitempty`-style serialization matching the Go original exactly (empty `scores`/`metrics` are omitted; a zero-value entry inside a non-empty map is kept). |
| `rng.ts` | `RNG` — seeded splitmix64. Returns `bigint` (raw outputs routinely exceed `Number.MAX_SAFE_INTEGER`); replicates Go's `uint64` wraparound bit-for-bit, including negative-seed reinterpretation. |
| `vec2.ts` | Integer-only vector math. `UNIT`-based milli-units instead of floats; `Math.trunc` (not `Math.floor`) everywhere division was ported from Go, to match Go's toward-zero truncation for negative operands. |
| `level.ts` | `LevelDef` — a generic level/scenario definition (`slug`, `version`, `gameSlug`, opaque `definition`/`grading` payloads). |

## Determinism guarantee

Every file in this repo must stay pure:

- No DB, network, or filesystem access.
- No wall-clock reads (`Date.now()`, `performance.now()`, timers).
- No process/container spawning — untrusted bot code never runs in here, only
  inside a consumer's own sandbox/runner layer.
- The only randomness source is the seeded `RNG` in `rng.ts` — never
  `Math.random()`.

Given the same `(engineVersion, levelVersion, seed, inputs)`, an engine built
on this base **must** produce identical `events[]` and `outcome` — on a
server, in a browser tab, doesn't matter. That's the whole point: it's safe
to run the literal same code in both places.

## Install & use

Install as a **git dependency**, pinned to a semver tag — no npm registry
involved:

```json
{
  "dependencies": {
    "todaycode-game-engine": "github:amas-nghia/todaycode-game-engine#v0.2.0"
  }
}
```

```ts
import { FrameDriver, RNG } from 'todaycode-game-engine'
```

Both ESM (`import`) and CommonJS (`require`) resolve correctly.

## Building a game on this engine

1. Implement the Engine contract (init / applyOrders / tick / isOver / result)
   in YOUR app's own repository. This engine repo is never edited to add a game.
2. Your implementation inherits the purity rules above — pure rules code only;
   bot execution, I/O, and rendering live in your app's own layers.
3. Placement rule: a game is declared where it computes.
   - Computes in ONE app (a learning mode, a future web game): declare it inside
     that app's repo. Example: CodeClash-fe's mission simulator.
   - Computes in TWO OR MORE places (client preview + server authority): hoist
     the rulebook into its own small shared package that every computing app
     imports, so the rules are written exactly once.
     Reference implementation: [todaycode-farmwars](https://github.com/amas-nghia/todaycode-farmwars).
4. Version your game with semver git tags; consumers pin a tag and upgrade
   deliberately. Commit `dist/` with every src change (git-dep distribution).

## Development

```bash
pnpm install
pnpm test     # jest — every spec in src/__tests__
pnpm build    # tsup — emits dist/index.{js,cjs,d.ts,d.cts}
pnpm lint     # tsc --noEmit
```

`dist/` is committed to this repo (not gitignored). This is deliberate: since
consumers install via a plain git dependency rather than a real npm registry,
there's no separate "publish" step that builds on their behalf — what's
checked in at a given tag *is* what they get. **Run `pnpm build` and commit
the result as part of any change to `src`**, or a consumer bumping to a new
tag will receive stale compiled output.
