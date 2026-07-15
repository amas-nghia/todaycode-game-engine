# Hướng Dẫn Triển Khai Missions Engine — dành cho Antigravity

> Tài liệu chỉ dẫn để Antigravity triển khai **rulebook game "Missions"** (giáo trình
> CodeClash Python: CS1/CS2/CS3, 213 màn) trên nền `todaycode-game-engine`.
> Đọc kèm: [`GAME_ENGINE_ANALYSIS.md`](GAME_ENGINE_ANALYSIS.md) (phân tích giáo trình đầy đủ,
> 26 loại win condition, API theo chương).

---

## 0. Bối cảnh hệ thống — ĐỌC TRƯỚC KHI CODE

| Repo | Vai trò | Được sửa? |
|---|---|---|
| `todaycode-game-engine` | Engine base game-agnostic: `Engine` contract, `FrameDriver`, `RNG` (splitmix64), `vec2` (integer milli-units), `Replay`, `LevelDef` | ❌ **KHÔNG BAO GIỜ thêm game vào repo này.** Chỉ sửa nếu contract thiếu (hiếm — hỏi trước) |
| `todaycode-farmwars` | **Reference implementation** — rulebook Farm Wars implement Engine contract, publish GitHub Packages `@amas-nghia/todaycode-farmwars` | ❌ Chỉ đọc để học pattern |
| `todaycode-be` | NestJS backend — `arena-service` consume rulebook qua git/npm dep, chạy match authoritative | Sau này (phase tích hợp) |
| `CodeClash-fe` | Frontend — preview/simulate màn chơi trên browser | Sau này (phase tích hợp) |
| **`todaycode-missions`** ← **DELIVERABLE** | Rulebook mới: rules 213 màn missions, source-of-truth duy nhất cho cả BE và FE | ✅ **Tạo mới — toàn bộ công việc nằm ở đây** |

**Quy tắc placement** (từ README engine): game tính toán ở ≥2 nơi (FE preview + BE authority)
⇒ rulebook phải là package riêng, cả hai app cùng import. Missions đúng trường hợp này.

---

## 1. Quy tắc bất di bất dịch (determinism contract)

Mọi file trong `todaycode-missions/src` phải **thuần khiết**:

1. **Không** DB / network / filesystem / `Date.now()` / `performance.now()` / timers.
2. **Không** `Math.random()` — randomness duy nhất là `RNG` seeded từ engine base.
3. **Không chạy code Python của học sinh bên trong rulebook.** Python executor
   (Pyodide trên FE, sandbox runner trên BE) nằm ở **runner layer của app consume** —
   rulebook chỉ nhận `Order[]` đã được runner dịch ra.
4. State chỉ dùng **integer** (toạ độ dùng `vec2` milli-units nếu cần sub-cell; CS1 grid
   thì integer cell là đủ).
5. Cùng `(engineVersion, levelVersion, seed, orders)` ⇒ `events[]` và `outcome` giống
   nhau bit-for-bit trên server lẫn browser.
6. `dist/` **commit vào repo** — chạy `pnpm build` và commit kết quả trong mọi PR đụng
   `src/` (consumers cài qua git dep/GitHub Packages, không có bước publish tự build).
7. Version bằng **semver git tag**; consumer pin tag, nâng cấp chủ động.

---

## 2. Khởi tạo package

Copy nguyên bộ khung từ `todaycode-farmwars` (package.json / tsup.config.ts / tsconfig.json /
jest config / .github). Đổi:

```json
{
  "name": "@amas-nghia/todaycode-missions",
  "version": "0.1.0",
  "description": "Missions rulebook — implements the todaycode-game-engine Engine contract; single source of CodeClash mission rules for todaycode-be and CodeClash-fe.",
  "dependencies": {
    "@amas-nghia/todaycode-game-engine": "^0.2.1"
  }
}
```

Cấu trúc file đề xuất (mirror farmwars):

```
todaycode-missions/
├── src/
│   ├── index.ts               # barrel — export Engine, types, selectors, grader
│   ├── missions.engine.ts     # class MissionsEngine implements Engine, Grader
│   ├── state.ts               # MissionState: wizard, enemies, items, map, counters
│   ├── level-schema.ts        # kiểu cho LevelDef.definition + LevelValidator
│   ├── orders.ts              # Order types + parse/validate
│   ├── tick.ts                # applyOrder → state chuyển tiếp thuần
│   ├── events.ts              # MissionEvent types (cho replay/animation)
│   ├── selectors.ts           # pure queries: findNearestEnemy, isPathClear, distanceTo…
│   ├── win-conditions.ts      # evaluator 26 loại condition + composite
│   ├── constants.ts           # mana cost (cast = −10), damage, max frames…
│   └── api-levels.ts          # bảng API allowlist theo course/chapter (data, không enforce)
├── __tests__/
│   ├── fixtures/              # golden fixtures per level (xem §7)
│   ├── engine.spec.ts
│   ├── win-conditions.spec.ts
│   └── determinism.spec.ts
└── (package.json, tsup.config.ts, tsconfig.json, README.md, dist/ committed)
```

---

## 3. Mapping giáo trình → Engine contract

### 3.1 Tổng quan luồng chạy

```
Học sinh viết Python
        │
   RUNNER (ở app consume — KHÔNG thuộc rulebook)
   - FE: Pyodide/worker · BE: sandbox process
   - Đếm statements bằng Python AST (static)
   - Enforce API allowlist theo chapter (AST whitelist)
   - Thực thi code: mỗi lệnh wizard.* → dịch thành Order
   - Query state (wizard.mana, find_nearest_enemy…) → gọi SELECTOR
     của rulebook trên state hiện tại, trả kết quả về Python
   - Timeout/step-limit chống vòng lặp vô hạn
        │  Order[] (tuần tự, synchronous từng order)
        ▼
   MissionsEngine (rulebook này — pure)
   init → applyOrders → tick → events → isOver → result/grade
        │
   Replay { events[], outcome }  →  FE animate / BE chấm điểm
```

**Điểm mấu chốt:** vì code Python có `while wizard.mana >= 20:` đọc state giữa chừng,
runner phải chạy **interleaved**: đẩy 1 order → engine tick → trả state query qua selector →
Python chạy tiếp. `FrameDriver` mặc định của engine base là synchronous batch — runner
tự hand-roll loop (README engine cho phép rõ điều này). Rulebook do đó **bắt buộc export
selectors thuần** để FE/BE trả lời query giống hệt nhau.

### 3.2 `LevelDef.definition` payload (level-schema.ts)

```ts
interface MissionDefinition {
  course: 'cs1' | 'cs2' | 'cs3';
  chapter: number;
  coordinateSystem: 'grid' | 'xy';
  map: {
    width: number;
    height: number;
    walls: { x: number; y: number }[];
  };
  wizard: { x: number; y: number; health: number; mana: number };
  entities: Array<
    | { kind: 'enemy'; type: 'slime' | 'skeleton' | 'shadow_ghost' | 'boss';
        id: string; x: number; y: number; health: number; damage?: number }
    | { kind: 'gold'; x: number; y: number; amount: number }
    | { kind: 'gem'; x: number; y: number }
    | { kind: 'mana_crystal'; x: number; y: number; amount: number }
    | { kind: 'barrier'; x: number; y: number; breakBySkill: string }
    | { kind: 'door'; x: number; y: number }
    | { kind: 'goal'; x: number; y: number }
  >;
  apiAllowlist: string[];        // vd ['move_up','move_down','attack'] — runner enforce
  events?: Array<{ trigger: string; payload: unknown }>;   // CS3 Ch.4
  phases?: Array<{ id: string; unlockCondition: unknown }>; // CS3 capstone
}
```

`LevelDef.grading` = object `win_conditions` **nguyên văn schema giáo trình**
(xem `GAME_ENGINE_ANALYSIS.md` §3):

```json
{ "mode": "all", "conditions": [
    { "type": "reach_goal" },
    { "type": "max_statements", "max": 12 }
] }
```

Implement `LevelValidator.validateLevel(definition)` — throw nếu map/entities/goal thiếu.

### 3.3 Orders (orders.ts)

Một order = một lệnh wizard đã được runner dịch. Wire format string-friendly (giống
farmwars dùng `string[]`), ví dụ JSON-encoded:

| Python API | Order |
|---|---|
| `move_up/down/left/right()` | `{ op: 'MOVE', dir: 'up'\|'down'\|'left'\|'right', steps: 1 }` |
| `move(dir, n)` | `{ op: 'MOVE', dir, steps: n }` |
| `move_to(x, y)` (CS2+) | `{ op: 'MOVE_TO', x, y }` |
| `attack(enemy)` | `{ op: 'ATTACK', targetId }` |
| `say(text)` | `{ op: 'SAY', text }` |
| `cast(skill)` | `{ op: 'CAST', skill }` |
| `cast(skill)` tại vị trí (CS2+) | `{ op: 'CAST_AT', skill, x, y }` |
| `pick_up()` | `{ op: 'PICK_UP' }` |

Query (`find_nearest_enemy`, `is_path_clear`, `.health`, `.gold`, `.mana`, `.pos`,
`distanceTo`) **không phải order** — chúng là selectors (§3.5), không đổi state.

### 3.4 State + tick (state.ts, tick.ts)

`MissionState` chứa: wizard (pos/health/mana/gold), enemies còn sống, items còn lại,
barriers, **counters phục vụ chấm điểm**: `saidStrings: Array<{text, x, y}>`,
`castLog: Array<{skill, x, y}>`, `gemsCollected`, `goldCollected`, `manaSpent`,
`eventsHandled`, `phaseCompleted[]`, `ordersExecuted`.

Quy ước từ giáo trình (constants.ts):
- Mỗi `cast()` trừ **10 mana** (CS1 Ch.6+).
- Màn **tự dừng khi win** kể cả đang `while True:` ⇒ `isOver()` = `evaluate(winConditions, state).passed || wizard.health <= 0 || frame >= maxFrames`.
- Move vào tường/ra ngoài map: order bị bỏ qua, emit event `bump` (không throw — học sinh thấy trên animation).
- Attack: trừ health theo damage constant; enemy health ≤ 0 thì remove + emit `enemy_defeated`.
- Đi qua ô có item **không** tự nhặt — phải `pick_up()` (đúng API giáo trình `wizard.pick_up()`).

Mỗi order → 1 tick → emit events tương ứng (`moved`, `attacked`, `said`, `casted`,
`picked_up`, `enemy_defeated`, `barrier_broken`, `mana_changed`…) — events là nguồn
animation cho FE, giữ payload nhỏ và ổn định.

### 3.5 Selectors (selectors.ts) — bắt buộc export

```ts
export function findNearestEnemy(state: MissionState): EnemyView | null;
export function isPathClear(state: MissionState, dir: Direction): boolean;
export function distanceTo(state: MissionState, x: number, y: number): number; // integer (milli-unit nếu cần)
export function wizardView(state: MissionState): { x; y; health; mana; gold };
```

Tie-break của `findNearestEnemy` khi 2 enemy cùng khoảng cách: **id nhỏ hơn thắng**
(thứ tự cố định, không phụ thuộc Map iteration) — ghi rõ trong doc comment.

### 3.6 Grader — win conditions (win-conditions.ts)

Implement interface `Grader` từ engine base: `grade(final, level): Outcome`.

- Evaluator đệ quy: `composite` + `mode: 'all' | 'any'`.
- **Đủ 26 type** theo bảng trong `GAME_ENGINE_ANALYSIS.md` §3.2. Phase 1 chỉ cần nhóm
  CS1 (14 type), nhưng **định nghĩa union type đủ 26 ngay từ đầu** để schema ổn định.
- `max_statements` / `min_statements`: đếm **statement trong source Python (static AST)**,
  không phải số order chạy. Rulebook không thấy source ⇒ runner đếm và truyền vào qua
  `Outcome.metrics` đầu vào — cụ thể: `grade(final, level, extra?: { statementCount?: number })`
  hoặc runner ghi `statementCount` vào state qua một order meta `{ op: 'META', statementCount }`
  áp một lần đầu match. **Chọn cách META order** để chữ ký `grade` giữ nguyên contract.
- `Outcome`: `{ over: true, passed, stars, metrics: { statementCount, ordersExecuted, manaSpent, … } }`.
  Stars 1★ = pass composite cơ bản; 2★/3★ đọc ngưỡng siết chặt hơn từ `grading` nếu có.

### 3.7 Cái gì KHÔNG nằm trong rulebook (để khỏi làm nhầm)

| Việc | Nơi làm |
|---|---|
| Chạy Python (Pyodide / sandbox) | Runner của FE/BE |
| Đếm statements, enforce API allowlist theo chương | Runner (Python AST) — rulebook chỉ cung cấp `apiAllowlist` data |
| Timeout / chống vòng lặp vô hạn | Runner (step budget, vd 10 000 orders) |
| Lưu progress, stars, leaderboard | todaycode-be (arena-service + user-service) |
| Render, animation | CodeClash-fe (consume `events[]`) |
| Soạn 213 file level JSON | Bước riêng — script convert từ curriculum, không phải code rulebook |

---

## 4. Roadmap theo phase — mỗi phase 1 PR + 1 tag

| Phase | Phạm vi | Tag | Definition of Done |
|---|---|---|---|
| **P0** | Skeleton package + `MissionState` + orders MOVE/ATTACK/PICK_UP + tick + selectors + win: `reach_goal`, `reach_position`, `kill_all`, `max_statements`, `composite` | `v0.1.0` | CS1 Ch.1–2 chạy được; golden fixture 3 màn mẫu pass; determinism spec pass |
| **P1** | SAY/CAST orders + mana + đủ 14 win-type CS1 + `LevelValidator` | `v0.2.0` | Toàn bộ nhóm điều kiện CS1 có unit test; fixture màn boss (≥3 conditions) pass |
| **P2** | Hệ toạ độ xy: `MOVE_TO`, `distanceTo`, `.type`/`.pos` views, `defeat_type`, `reach_coord`, `decode_string` | `v0.3.0` | Fixture CS2 pass; grid và xy dùng chung 1 state model |
| **P3** | CS3: events (`event_handled`), `collect_data`, `defeat_boss`, `phase_complete`, `min_statements`, `leaderboard_time` (nhận elapsed từ META, engine không đọc clock) | `v0.4.0` | Fixture CS3 events + capstone đa phase pass |
| **P4** | Tích hợp: todaycode-be `arena-service` đăng ký engine `missions`; CodeClash-fe runner Pyodide + animation | (ở repo consume) | E2E: submit code → replay → grade trên cả 2 nền tảng, outcome giống nhau |

Không gộp phase. Mỗi phase: `pnpm lint && pnpm test && pnpm build`, commit `dist/`, tag semver.

---

## 5. Golden fixtures & test (bắt buộc, học từ farmwars)

1. **Fixture format**: mỗi fixture = `{ level, seed, orders[], expected: { events, outcome } }` —
   giống pattern `seed-*.json` của farmwars và `cs1-01-move-right.json` đã có sẵn trong
   `todaycode-game-engine/src/__tests__/fixtures/` (dùng file đó làm mẫu wire format).
2. **Determinism spec**: chạy cùng fixture 2 lần + so sánh deep-equal `events` & `outcome`;
   thêm 1 lần chạy với object key order xáo trộn để bắt lỗi phụ thuộc iteration order.
3. **Win-condition spec**: mỗi type có ít nhất 1 test pass + 1 test fail; composite lồng nhau.
4. **Coverage mục tiêu**: `tick.ts` và `win-conditions.ts` ≥ 90% branch.

---

## 6. Nguồn dữ liệu tham chiếu

- Phân tích giáo trình đầy đủ: `GAME_ENGINE_ANALYSIS.md` (cùng thư mục file này).
- Curriculum gốc (đã giải nén): `C:\Users\thanh\AppData\Local\Temp\claude\codeclash-curriculum\codeclash-python-curriculum\`
  - Win conditions hợp đồng: `docs/02-win-conditions.md`
  - API theo chương CS1: `computer-science-1/docs/01-game-mechanics-api.md`
  - Metadata màn: `computer-science-2/data/levels.json`, `computer-science-3/data/levels.json`
  - (Nếu thư mục temp đã bị xoá: giải nén lại từ `C:\Users\thanh\Downloads\codeclash-python-curriculum.zip`)
- Reference Engine implementation: `C:\Users\thanh\OneDrive\Documents\Github\todaycode-farmwars\src\`
- Engine contract: `C:\Users\thanh\OneDrive\Documents\Github\todaycode-game-engine\src\gamecore.interface.ts`

## 7. Checklist trước khi mở PR (mọi phase)

- [ ] Không import gì ngoài `@amas-nghia/todaycode-game-engine` trong `src/` (zero runtime deps khác)
- [ ] Không có `Math.random` / `Date` / `fs` / `fetch` trong `src/` (grep trước khi commit)
- [ ] `pnpm lint` (tsc noEmit) sạch, `pnpm test` xanh
- [ ] `pnpm build` chạy và **`dist/` được commit**
- [ ] Tag semver mới nếu thay đổi public API
- [ ] README của package cập nhật: bảng orders, bảng win conditions đã hỗ trợ, ví dụ dùng selectors
