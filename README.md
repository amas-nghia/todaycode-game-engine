# todaycode-game-engine

**Repo này không chạy game nào — nó là bộ tiêu chuẩn mà mọi game phải khớp vào.**
Ví như chuẩn ổ cắm điện: bóng đèn (farmwars), quạt (missions) do rulebook khác
sản xuất; dòng điện (code bot/học sinh) do app bơm vào; nhờ chung chuẩn mà cắm
ở đâu (browser hay server) cũng ra kết quả y hệt nhau.

## Bạn là dev mới? Đọc theo thứ tự này

1. README này — hiểu contract và vì sao mọi thứ phải deterministic (10 phút).
2. [`src/gamecore.interface.ts`](src/gamecore.interface.ts) — toàn bộ contract chỉ ~70 dòng, đọc thẳng code.
3. [todaycode-farmwars](https://github.com/amas-nghia/todaycode-farmwars) — **bản implement mẫu sống**: một game thật cắm vào contract này thế nào.
4. Cách app tiêu thụ: `CodeClash-fe/src/features/codeclash/farm-wars/simulator/match-simulator.ts` (browser) và `todaycode-be/apps/arena-service/src/simulator/simulator.ts` (server).

## CodeCombat-style Programmable World Kernel

The `todaycode-game-engine` now includes a generic **programmable world kernel** to support CodeCombat-style games and simulations.

**Important**: This core does *not* contain any game-specific logic (e.g., FarmWars tree planting or Missions wizard story). It solely provides standard primitives:
- `WorldState`, `Entity`, `Component` for data structures.
- `Action`, `ActionRunner` for defining and applying moves sequentially.
- `MultiFrameActionRunner` for actions that occupy multiple simulation frames (move over time, attack wind-up, pickup delay).
- `PlanRunner` and `YieldPlanRunner` for CodeCombat-style sequential plans: run one action until it finishes, then continue with the next queued or yielded action.
- `System`, `SystemRunner` for game loop phases (`preAction`, `tick`, etc.).
- Generic `selectors` (`findNearest`, `isPathClear`) and `objectives` (`all`, `defeat_all`, `metric_comparison`).

The programmable world kernel uses continuous coordinates with JavaScript `number`
positions/speeds/distances. Determinism here means pure, ordered simulation under
the supported JS runtime used by both frontend and backend; rulebooks that need
integer/fixed-point math can still opt into `vec2`.

**Migration Path for FarmWars/Missions:**
1. **Missions**: Update first. Adapt the existing `MissionState` to wrap or map directly to `WorldState`. Delegate commands to the `ActionRunner` and use the generic `selectors` to replace ad-hoc queries.
2. **FarmWars**: Migrate next. It can continue using the old `Engine` interface while under the hood it builds upon the new primitives (e.g., `components.ts` and `systems.ts`) to avoid duplicate engine-building.


## Cung cấp gì — cho ai

| Thứ | Làm gì | Ai đang dùng thật |
|---|---|---|
| **`Engine` contract** | 5 hàm mọi game phải có: `init / applyOrders / tick / isOver / result`. Hạ tầng chạy được *mọi* game mà không biết luật bên trong. | `FarmWarsEngine`, `MissionsEngine` implement; BE arena-service gọi generic |
| **`Replay` wire format** (`replay.ts`) | JSON chuẩn của một trận: `frames[].events` + `outcome`. Khớp bản Go cũ bit-for-bit. | BE lưu Postgres (`toReplayJSON`); FE trang watch phát lại |
| **`LevelDef`** (`level.ts`) | Phong bì chở màn/trận: `slug, version, definition, grading`. `definition` là payload tự do — config động farmwars, map missions đều đi qua đây. | BE build level mỗi trận; missions mỗi màn |
| **`RNG`** (`rng.ts`) | Random có seed (splitmix64, khớp Go). Nguồn ngẫu nhiên hợp lệ duy nhất. | Rulebook nào cần random |
| **`FrameDriver`** | Vòng lặp mẫu: orders → tick → events → Replay. | Không ai gọi trực tiếp — đúng thiết kế: trận bot async tự viết loop theo mẫu (FE `match-simulator`, BE `simulator.ts`) |
| **`vec2`** | Toán vector fixed-point theo milli-unit cho rulebook cần số nguyên. World kernel mới vẫn có thể dùng JS `number` cho tọa độ continuous. | Rulebook cần fixed-point math |

## Dùng thế nào — game tối giản trong 40 dòng

Ví dụ đầy đủ vòng đời: game "đua xúc xắc" (2 người tung xúc xắc seeded, ai tới 20
điểm trước thì thắng). Đây vừa là cách *dùng* FrameDriver, vừa là khung *implement*
một Engine:

```ts
import { FrameDriver, RNG, type Engine, type Commander, type LevelDef } from 'todaycode-game-engine'

type S = { rng: RNG; scores: [number, number]; over: boolean }

const diceRace: Engine = {
  name: () => 'dice-race',
  version: () => '1.0.0',
  init: (_level, seed) => ({ rng: new RNG(seed), scores: [0, 0], over: false } as S),
  applyOrders: (state, agentId, orders) => {
    const s = state as S
    if (orders[0] === 'roll') s.scores[agentId] += Number((s.rng.next() % 6n) + 1n)
    return s
  },
  tick: (state, _frame) => {
    const s = state as S
    s.over = s.scores.some((x) => x >= 20)
    return { state: s, events: [{ type: 'scores', values: [...s.scores] }] }
  },
  isOver: (state) => (state as S).over,
  result: (state) => {
    const s = state as S
    return { over: true, winner: s.scores[0] >= 20 ? 0 : 1 }
  },
}

const alwaysRoll: Commander = { decide: () => ['roll'] }
const level: LevelDef = { slug: 'demo', version: 1, gameSlug: 'dice-race', definition: {} }

const driver = new FrameDriver(diceRace, [alwaysRoll, alwaysRoll])
const replay = driver.run(level, /* seed */ 42)
console.log(replay.outcome)        // { over: true, winner: ... } — mọi máy ra y hệt
console.log(replay.frames.length)  // số frame + events từng frame để client vẽ lại
```

Chạy cùng seed 42 ở browser, server, CI — `outcome` và `events` giống nhau từng byte.
Đó là toàn bộ "phép màu" của repo này.

> Lưu ý: `FrameDriver` synchronous — đủ cho game/test đơn giản. Trận bot thật
> (chờ Pyodide worker / process, timeout mỗi lượt) thì copy vòng lặp của nó và
> thêm `await` — xem `match-simulator.ts` của FE làm mẫu.

## Implement game thật — checklist

1. **Tạo repo riêng** (không bao giờ thêm game vào repo này). Copy skeleton từ
   todaycode-farmwars: `package.json` (exports ESM/CJS, tsup, jest), `tsconfig`,
   `.github/workflows/publish.yml`.
2. **Định nghĩa 4 loại dữ liệu trước, luật sau**: `State` (ảnh chụp ván đấu),
   `Order` (một lệnh), `Event` (một điều đã xảy ra — client vẽ từ đây),
   schema cho `LevelDef.definition`.
3. **Implement 5 hàm** của `Engine`. Đọc config/map từ `level.definition` trong
   `init` — đừng hardcode, sẽ muốn đổi số mà không release lại (xem farmwars
   `resolveConfig`).
4. **Tuân thủ hiến pháp determinism** (dưới) — vi phạm là replay vỡ và FE/BE lệch nhau.
5. **Test bắt buộc**: golden fixture (level + seed + orders → events/outcome kỳ vọng,
   chạy 2 lần so deep-equal) + 1 lần chạy với key-order xáo trộn.
6. **Release**: `pnpm build` → **commit cả `dist/`** → tag `v0.x.0` → CI publish
   GitHub Packages → consumer bump tag chủ động.

## Hiến pháp determinism

Cam kết: cùng `(engineVersion, levelVersion, seed, inputs)` → cùng `events[]` +
`outcome` trong runtime JS được support ở FE/BE. Vì replay phải phát lại được mãi mãi,
và client–server lệch nhau nghĩa là bug hoặc gian lận.

- ❌ Không I/O (DB/network/fs), không đọc đồng hồ, không spawn process.
- ❌ Không `Math.random()` — chỉ `RNG` có seed. Continuous-space được dùng JS `number`, nhưng update phải pure, theo thứ tự cố định, và có test repeated-run.
- ❌ Không phụ thuộc thứ tự duyệt `Map`/object — vòng lặp theo thứ tự cố định.
- Code bot/học sinh **không bao giờ** chạy trong engine — chỉ trong sandbox của app.

## Cài & phát triển

```json
"todaycode-game-engine": "npm:@amas-nghia/todaycode-game-engine@^0.2.1"
```

Cần `GITHUB_TOKEN` (scope `read:packages`) trong env + `.npmrc` scope
`@amas-nghia` → `npm.pkg.github.com`.

```bash
pnpm install && pnpm test && pnpm build && pnpm lint
```

**`dist/` được commit** — mọi thay đổi `src` phải kèm `pnpm build` + commit dist
rồi tag mới, quên là consumer bump tag nhận code biên dịch cũ (đã gây bug thật).
