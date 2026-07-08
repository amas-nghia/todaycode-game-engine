# todaycode-game-engine

Shared, deterministic game engine consumed by both `todaycode-be` (arena-service)
and `CodeClash-fe`. Single source of truth for game rules — no more logic
implemented twice (once server-side, once client-side) drifting apart over time.

## What's here

- **`packages/gamecore`** — game-agnostic engine base: the `Engine` contract,
  a generic `FrameDriver` turn loop, a seeded deterministic RNG, integer-only
  vector math, and the `Replay`/`Outcome` wire format. Ported from Go
  (`pkg/gamecore` in `codeclash-be`) — see purity rules below.
- **`packages/farmwars`** — the Farm Wars ruleset: state shape, all 19 event
  types, tick logic, combat, gifts, and `replay.ts` (an event-log reducer for
  replaying an already-computed match without re-simulating it).

Both are built together into one package (`todaycode-game-engine`) with two
subpath exports — see [Usage](#usage).

## Purity guarantee

Every file in `packages/gamecore` and `packages/farmwars` MUST stay pure and
deterministic:

- No DB, network, or filesystem access.
- No wall-clock reads (`Date.now()`, timers).
- No process/container spawning — untrusted user code never runs in here,
  only inside a consumer's own sandbox/runner layer.
- The only randomness source is the seeded `RNG` in `gamecore/rng.ts` — never
  `Math.random()`.

Given the same `(engineVersion, levelVersion, seed, inputs)`, the engine MUST
produce identical output on every platform — that's what makes it safe to run
the same code in a Node backend and a browser tab.

## Usage

Both consumers install this repo as a **git dependency** (no npm registry
involved):

```json
"dependencies": {
  "todaycode-game-engine": "github:amas-nghia/todaycode-game-engine#v0.1.0"
}
```

Then import by subpath:

```ts
import { FarmWarsEngine, applyFrame } from 'todaycode-game-engine/farmwars'
import { FrameDriver } from 'todaycode-game-engine/gamecore'
```

- `arena-service` (todaycode-be): `farmwars.engine.ts`-adjacent code imports
  `FarmWarsEngine`/`tick`/etc. directly, replacing the local
  `apps/arena-service/src/engine/farmwars` copy.
- `CodeClash-fe`: `match-simulator.ts` imports `FarmWarsEngine`'s tick logic
  instead of its own `step()` (deleted); `remote-farm-wars-service.ts` uses
  `applyFrame()` from `todaycode-game-engine/farmwars` to replay a match the
  backend already computed, instead of re-simulating it from raw bot turns.

## Versioning

Semver git tags. A gameplay change is a version bump; each consumer upgrades
on its own schedule by bumping the tag in its `package.json` — never
silently.

## Development

```bash
pnpm install
pnpm test     # jest — all specs in packages/*/__tests__
pnpm build    # tsup — emits dist/{gamecore,farmwars}.{js,cjs,d.ts,d.cts}
pnpm lint     # tsc --noEmit
```

`dist/` is committed to this repo (not gitignored). This is deliberate: since
consumers install via a plain git dependency (not a real npm registry), what's
checked in at a given tag is exactly what they get — there's no separate
"publish" step that builds on their behalf. **Run `pnpm build` and commit the
result as part of any change**, or a consumer bumping to a new tag will get
stale compiled output.
