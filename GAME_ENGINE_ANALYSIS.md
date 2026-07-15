# CodeClash Game Engine — Features Analysis for Missions
**Analysis Date:** 2026-07-10  
**Source:** codeclash-python-curriculum.zip (3 courses: CS1, CS2, CS3)  
**Total Missions:** 213 (CS1: 61 + CS2: 78 + CS3: 74)

---

## 1. Curriculum Overview

### 1.1 Course Structure

| Course | Title | Coordinate System | Missions | Chapters | Complexity |
|--------|-------|-------------------|----------|----------|------------|
| **CS1** | Python Syntax (Cơ Bản) | **Grid-based** | 61 | 8 | Basic: syntax, loops, conditions |
| **CS2** | Python Advanced (Nâng Cao) | **x, y coordinates** | 78 | 11 | Intermediate: arrays, functions, complex logic |
| **CS3** | Python Battle (Thực Chiến) | **x, y coordinates** | 74 | 7 | Advanced: events, data collections, algorithms |

### 1.2 Key Narrative

- **Player Role:** Wizard (Pháp Sư)
- **Goal:** Write Python code to solve missions (Viết code để vượt thử thách)
- **Theme:** Gamified learning with fantasy/magic setting
- **Progression:** Chapter-based with boss missions marked with ★

---

## 2. Game Engine Mechanics

### 2.1 Core Entities

#### Wizard (Player Character)
- **Position:** 
  - CS1: Grid coordinates (row, col)
  - CS2/CS3: (x, y) — Cartesian
- **Properties:**
  - `health` — current HP (read-only in-game)
  - `gold` — collected items (CS1+)
  - `mana` — spell casting resource (CS6+)
- **Methods:**
  - **Movement:** `move_up()`, `move_down()`, `move_left()`, `move_right()`, `move(direction)`, `move(direction, distance)`, `move_to(x, y)`
  - **Combat:** `attack(enemy)`, `cast(skill_name)`
  - **Interaction:** `say(text)`, `pick_up()`
  - **Observation:** `find_nearest_enemy()`, `is_path_clear(direction)`

#### Enemies
- **Types:** `slime`, `skeleton`, `shadow_ghost`
- **Properties:**
  - `health` — can be checked: `enemy.health > 0`
  - `.type` — CS2+ can identify enemy type
  - `.pos` — CS2+ can get enemy position
- **Behavior:** Static or patrolling (implementation detail)

#### Items/Collectibles
- **Gold ($):** Collectable resource
- **Gems (◆):** Collectible with win condition
- **Mana Crystal (C):** Restores mana
- **Barrier (B):** Destructible obstacle (requires spell)
- **Door (D):** Marker for `say_at_door` condition
- **Goal/Gate (G):** End position for `reach_goal`

### 2.2 Map Systems

#### CS1: Grid-based Map
- **Dimension:** Variable grid size (e.g., 8x8)
- **Cells:** Each cell contains terrain + optional entity
- **Symbols:**
  - `.` = walkable
  - `#` = wall
  - `G` = goal
  - `$` = gold
  - `◆` = gem
  - `D` = door
  - `B` = barrier
  - Enemy letters: `s` (slime), `k` (skeleton), `g` (ghost)

#### CS2/CS3: Coordinate Map
- **Type:** x, y Cartesian grid (continuous or discrete)
- **Same symbols** as CS1, but positioned by (x, y)
- **Features:**
  - `reach_coord(x, y)` for specific targets
  - `distanceTo(x, y)` for distance calculation

---

## 3. Win Conditions System

### 3.1 Architecture

```json
{
  "win_conditions": {
    "mode": "all",
    "conditions": [
      { "type": "reach_goal" },
      { "type": "max_statements", "max": 15 },
      { "type": "collect_gems", "count": "all" }
    ]
  }
}
```

**Logic:**
- `mode: "all"` = AND (all conditions must be true)
- `mode: "any"` = OR (at least one — rare, boss optional)

### 3.2 Complete Condition Types

| Type | Parameters | Use Case | CS1 | CS2 | CS3 |
|------|-----------|----------|-----|-----|-----|
| `reach_goal` | — | Wizard on `G` | ✅ | ✅ (alias) | ✅ |
| `reach_coord` | `x`, `y` | Specific position | — | ✅ | ✅ |
| `reach_position` | `x`, `y` | Any position | ✅ | ✅ | ✅ |
| `kill_all` | — | Defeat all enemies | ✅ | ✅ | ✅ |
| `defeat_all` | — | Alias for `kill_all` | ✅ | ✅ | ✅ |
| `defeat_type` | `enemy_type` | Defeat specific type | — | ✅ | ✅ |
| `defeat_boss` | `boss_id` | Defeat named boss | — | — | ✅ |
| `collect_gold` | `min` | Collect minimum gold | ✅ | ✅ | ✅ |
| `collect_gems` | `count` (all/min) | Collect gems | ✅ | ✅ | ✅ |
| `collect_all_items` | — | All $ and ◆ | ✅ | ✅ | ✅ |
| `say_string` | `text` | Say exact text | ✅ | ✅ | ✅ |
| `say_at_door` | `text`, `x`, `y` | Say at door location | ✅ | ✅ | ✅ |
| `cast_skill` | `skill` | Cast spell | ✅ | ✅ | ✅ |
| `cast_at` | `skill`, `x`, `y` | Cast at location | ✅ | ✅ | ✅ |
| `cast_at_barrier` | `skill` | Destroy all barriers | ✅ | ✅ | ✅ |
| `decode_string` | `text` | String concatenation + say | — | ✅ | ✅ |
| `max_statements` | `max` | ≤ N lines of code | ✅ | ✅ | ✅ |
| `min_statements` | `min` | ≥ N lines (enforce loop/function) | — | — | ✅ |
| `mana_spent` | `min`/`max` | Mana resource check | ✅ | ✅ | ✅ |
| `event_handled` | `count`, `event` | Handle N events | — | — | ✅ |
| `collect_data` | spec | Dict/list condition | — | — | ✅ |
| `phase_complete` | `phase_id` | Capstone phase done | — | — | ✅ |
| `leaderboard_time` | `seconds` | Finish in time | — | — | ✅ |
| `custom` | — | Platform-specific script | ✅ | ✅ | ✅ |
| `composite` | `conditions[]` | AND multiple (recursive) | ✅ | ✅ | ✅ |

### 3.3 Common Win Patterns

#### Pattern A: Simple Movement
```json
{
  "mode": "all",
  "conditions": [
    { "type": "reach_goal" },
    { "type": "max_statements", "max": 12 }
  ]
}
```

#### Pattern B: Movement + Combat
```json
{
  "mode": "all",
  "conditions": [
    { "type": "kill_all" },
    { "type": "reach_goal" },
    { "type": "max_statements", "max": 20 }
  ]
}
```

#### Pattern C: Collection + Constraints
```json
{
  "mode": "all",
  "conditions": [
    { "type": "collect_gems", "count": "all" },
    { "type": "collect_gold", "min": 2 },
    { "type": "reach_goal" }
  ]
}
```

#### Pattern D: Review/Boss (≥3 conditions)
```json
{
  "mode": "all",
  "conditions": [
    { "type": "defeat_all" },
    { "type": "collect_gems", "count": "all" },
    { "type": "reach_coord", "x": 9, "y": 1 },
    { "type": "max_statements", "max": 25 }
  ]
}
```

---

## 4. Code Execution & Validation

### 4.1 Python API by Chapter

#### **CS1 — Chapter 1–8 (61 missions)**

| Chapter | Concept | New API | Constraints |
|---------|---------|---------|-------------|
| Ch.1 | Syntax & Args | `move_up/down/left/right()`, `move(dir)`, `move(dir, n)`, `attack(target)` | Sequential only |
| Ch.2 | Variables | `=`, `find_nearest_enemy()`, `.gold`, `.health` | Snake_case vars |
| Ch.3 | Data Types | `int`, `float`, `str`, `bool`, `say()`, `cast()` | No type conversion functions |
| Ch.4 | Arithmetic | `+`, `-`, `*`, `/`, `//`, `%`, `**`, `+=`, `-=` | Precedence enforced |
| Ch.5 | If Statements | `if`/`elif`/`else`, `is_path_clear()`, comparisons, `None`, `enemy.health` | Must use conditions |
| Ch.6 | While True | `while True:`, indentation, `if` inside, `wizard.mana`, `cast()` in loop | Must use True |
| Ch.7 | While Condition | `while condition:`, counter vars, `+= 1` | Avoid infinite loops |
| Ch.8 | For Loop | `for i in range(n):`, range syntax | No list comprehensions |

**Forbidden in CS1:**
- `type()`, `int()`, `str()` (conversions)
- `and`, `or`, `not` (logic operators)
- `break`, `continue` (loop control)
- `def`, `return` (functions)
- `list`, `dict` (collections)
- `move_to(x, y)`, `distanceTo()` (CS2 APIs)
- `.type`, `.pos` (advanced properties)

#### **CS2 — Chapter 1–11 (78 missions)**

**Unlocks (on top of CS1):**
- `move_to(x, y)` — direct position movement
- `distanceTo(x, y)` — distance calculation
- `and`, `or`, `not` — boolean operators
- `break`, `continue` — loop control
- `def func(...): return ...` — function definition
- `list` — arrays/lists
- `.type` (enemy type), `.pos` (enemy position)
- `range(start, stop, step)` — full range syntax
- String slicing, advanced string methods

**New Concepts:**
- Ch.1: Orientation (x, y coords)
- Ch.2: CS1 review + nested loops
- Ch.3: Boolean logic
- Ch.4: break statement
- Ch.5: continue statement
- Ch.6: Nested loops
- Ch.7: Advanced strings
- Ch.8: Arrays/Lists
- Ch.9: Arrays + Loops
- Ch.10: Functions
- Ch.11: Parameters & return

**Forbidden in CS2:**
- `dict`, `tuple`, `set` (CS3 only)
- `try`/`except` (error handling)
- Imports (except built-ins)

#### **CS3 — Chapter 1–7 (74 missions)**

**Unlocks:**
- `dict` — dictionaries/maps
- `tuple`, `set` — advanced collections
- **Events system** — game triggers (on_enemy_spotted, on_gold_collected, etc.)
- Multi-skill activation
- Algorithm challenges

**New Concepts:**
- Ch.1: CS1 review (on x,y maps)
- Ch.2: CS2 review (advanced CS1 concepts)
- Ch.3: Combined CS1+CS2 review
- Ch.4: **Events** — event handlers, event properties
- Ch.5: **Data Collections** — dict/tuple/set manipulation
- Ch.6: **Multi-Skill & Algorithms** — complex spell combos
- Ch.7: **Capstone** — Shadow Lord boss (multi-phase)

**Advanced Features:**
- Event handlers: `on_event` registration
- Phase-based missions (capstone has 3+ phases)
- Leaderboard time constraints
- Complex data structure validation

---

## 5. Mission Metadata Structure

### 5.1 Levels JSON Format

```json
{
  "course": "computer-science-3",
  "title": "Python Thực Chiến",
  "coordinate_system": "xy",
  "total_levels": 74,
  "chapters": [
    {
      "id": 1,
      "slug": "ch01-on-cs1",
      "concept": "Ôn CS1",
      "region": "Sân Khấu Nền Tảng",
      "level_start": 1,
      "level_end": 11,
      "boss_name": "Marathon CS1"
    }
  ],
  "levels": [
    {
      "id": 1,
      "chapter": 1,
      "slug": "level-01",
      "boss": false,
      "title": "Sân khấu nền tảng: Syntax + move_to"
    }
  ]
}
```

### 5.2 Individual Mission Config (inferred from win conditions)

Each mission likely has:
```json
{
  "id": 1,
  "chapter": 1,
  "slug": "level-01",
  "boss": false,
  "title": "Mission title",
  "description": "Mission story/context",
  "map": {
    "width": 10,
    "height": 10,
    "grid": ["........G.", ...]
  },
  "wizard": {
    "start_x": 0,
    "start_y": 0,
    "health": 100,
    "mana": 50
  },
  "entities": [
    { "type": "slime", "x": 5, "y": 5, "health": 10 },
    { "type": "gold", "x": 3, "y": 3, "count": 1 }
  ],
  "win_conditions": {
    "mode": "all",
    "conditions": [
      { "type": "reach_goal" },
      { "type": "max_statements", "max": 12 }
    ]
  },
  "difficulty": {
    "stars": 1,
    "constraints": {
      "max_lines": 12,
      "time_limit": 300
    }
  }
}
```

---

## 6. Game Engine Features to Implement

### 6.1 Core Engine (All Courses)

#### A. Game State Management
- [ ] Wizard position/properties tracking
- [ ] Enemy state (position, health, type)
- [ ] Item/collectible tracking (gold, gems, crystals)
- [ ] Map state (barriers, doors, goals)
- [ ] Mana system (consumption and restoration)

#### B. Code Execution Engine
- [ ] Python code parser/interpreter
- [ ] Statement counter (for `max_statements` validation)
- [ ] Execution trace (for debugging)
- [ ] Timeout detection (prevent infinite loops)
- [ ] Variable scope management

#### C. Validation System
- [ ] Win condition evaluator (composite support)
- [ ] Code structure validators (enforce `while`/`for`/`if`)
- [ ] API access control (per-chapter unlocks)
- [ ] Statement limit enforcement
- [ ] Custom validation hooks

#### D. Simulation System
- [ ] Step-by-step execution
- [ ] State snapshots for replay
- [ ] Deterministic playback
- [ ] Time stepping (for animation/visualization)

### 6.2 CS1-Specific Features

#### Movement & Interaction
- [ ] Grid pathfinding validation
- [ ] Direction-based movement (`move_up/down/left/right`)
- [ ] Multi-step movement (`move(dir, distance)`)
- [ ] Directional checks (`is_path_clear`)

#### Combat
- [ ] Enemy targeting
- [ ] Attack damage calculation
- [ ] Health tracking
- [ ] Multi-enemy maps

#### Collections
- [ ] Item pickup mechanics
- [ ] Gold counting
- [ ] Gem collection tracking
- [ ] Resource limits

### 6.3 CS2-Specific Features (on top of CS1)

#### Coordinate System
- [ ] Convert grid → (x, y) coordinates
- [ ] `move_to(x, y)` direct positioning
- [ ] `distanceTo(x, y)` calculations
- [ ] Property access (`.type`, `.pos`)

#### Advanced Control Flow
- [ ] `break` statement processing
- [ ] `continue` statement processing
- [ ] Nested loop support
- [ ] Boolean operators (`and`, `or`, `not`)

#### Functions
- [ ] Function definition (`def`)
- [ ] Parameter passing
- [ ] Return value handling
- [ ] Local scope management
- [ ] Recursion support (optional)

#### Advanced Collections
- [ ] List/array operations
- [ ] Indexing and slicing
- [ ] List methods (`append`, `remove`, `len`, etc.)
- [ ] Iteration over lists

#### String Operations
- [ ] String concatenation
- [ ] String slicing
- [ ] String methods (`upper`, `lower`, `split`, `join`, etc.)
- [ ] String formatting

### 6.4 CS3-Specific Features (on top of CS1+CS2)

#### Events System
- [ ] Event emission on game events (on_enemy_spotted, on_gold_collected, on_mana_changed)
- [ ] Event handler registration
- [ ] Event routing and dispatch
- [ ] Event payload access
- [ ] Multiple handlers per event

#### Data Collections
- [ ] Dictionary creation and access (`dict[key]`)
- [ ] Tuple unpacking
- [ ] Set operations and membership
- [ ] Nested data structures
- [ ] Collection validation in win conditions

#### Multi-Skill Combat
- [ ] Skill chaining
- [ ] Skill combos (sequence detection)
- [ ] Conditional skill casting
- [ ] Mana-based limitations

#### Capstone/Multi-Phase
- [ ] Phase detection and transition
- [ ] Phase-specific win conditions
- [ ] State persistence across phases
- [ ] Boss entity with multiple health phases

#### Algorithms
- [ ] Algorithm complexity hints
- [ ] Best-solution tracking (for leaderboards)
- [ ] Performance validation
- [ ] Time-based constraints

---

## 7. Infrastructure Requirements

### 7.1 Data Storage
- [ ] Mission definitions (JSON/database)
- [ ] User progress tracking (completion, stars, attempts)
- [ ] Execution logs/traces (for debugging)
- [ ] Leaderboards (CS3 time-based)
- [ ] Code solutions (for hints/replay)

### 7.2 Execution Environment
- [ ] Sandboxed Python interpreter (RestrictedPython or similar)
- [ ] Memory limits per execution
- [ ] Timeout mechanisms
- [ ] Safe standard library access
- [ ] Error isolation

### 7.3 Visualization/Replay
- [ ] Step-by-step animation support
- [ ] State snapshots at each step
- [ ] Code execution highlighting
- [ ] Map visualization (grid or coordinate)
- [ ] Unit movement animation

### 7.4 Testing/Debugging
- [ ] Breakpoint system
- [ ] Variable inspector
- [ ] Execution trace viewer
- [ ] Error messages with location info
- [ ] Hint system (optional)

---

## 8. API Documentation Requirements

### 8.1 Per-Chapter API Reference

Each chapter needs:
- Newly unlocked methods/properties
- Example usage with context
- Common patterns
- Anti-patterns (what NOT to do)

### 8.2 Win Condition Documentation

- All condition types with examples
- Composite conditions syntax
- Mode explanation (AND/OR)
- Troubleshooting

### 8.3 Game State Documentation

- Wizard properties (read-only vs writable)
- Enemy properties
- Item/collectible behavior
- Map conventions

---

## 9. Implementation Priority Roadmap

### Phase 1 (MVP): CS1 Basics
- [ ] Game state management
- [ ] Grid-based movement
- [ ] Combat system
- [ ] Basic win conditions (reach_goal, max_statements, kill_all)
- [ ] Code execution (chapters 1-4)
- [ ] Missions 1-30 (first 3 chapters)

### Phase 2: CS1 Completion
- [ ] If/else validation
- [ ] While loops
- [ ] For loops + range
- [ ] All win conditions (say, cast, collect_gold, gems)
- [ ] Missions 31-61 (final 5 chapters)

### Phase 3: CS2 Foundation
- [ ] Coordinate system (x, y)
- [ ] move_to() API
- [ ] Boolean operators
- [ ] break/continue
- [ ] Missions 1-30 (Ch.1-2)

### Phase 4: CS2 Advanced
- [ ] Functions (def, return)
- [ ] Lists and iteration
- [ ] String operations
- [ ] Missions 31-78 (Ch.3-11)

### Phase 5: CS3 Features
- [ ] Event system
- [ ] Dictionaries, tuples, sets
- [ ] Multi-skill mechanics
- [ ] Capstone/phase system
- [ ] Missions 1-74 (all chapters)

---

## 10. Summary Table: What Game Engine Needs

| Feature | CS1 | CS2 | CS3 | Complexity | Priority |
|---------|-----|-----|-----|------------|----------|
| Grid/Coordinate maps | ✅ | ✅ | ✅ | Low | P0 |
| Wizard movement | ✅ | ✅ | ✅ | Low | P0 |
| Enemy combat | ✅ | ✅ | ✅ | Medium | P1 |
| Win conditions | ✅ | ✅ | ✅ | Medium | P1 |
| Code execution | ✅ | ✅ | ✅ | High | P1 |
| Statement counter | ✅ | ✅ | ✅ | Low | P1 |
| API access control | ✅ | ✅ | ✅ | Medium | P2 |
| Function definitions | — | ✅ | ✅ | High | P2 |
| Collections (list, dict) | — | ✅ | ✅ | High | P2 |
| Events system | — | — | ✅ | High | P3 |
| Multi-phase missions | — | — | ✅ | Medium | P3 |
| Leaderboards | — | — | ✅ | Low | P3 |
| Spell combos | — | — | ✅ | Medium | P3 |

---

## 11. Test Coverage Requirements

### Unit Tests
- Win condition evaluators
- Code statement counting
- API access control
- Math operations correctness

### Integration Tests
- Full mission execution (happy path)
- Edge cases (empty map, no enemies, etc.)
- Error cases (infinite loops, invalid API calls)
- Cross-chapter API inheritance

### Mission Tests
- All 213 missions must pass their own win conditions
- Sample solutions for each mission
- Edge case solutions (minimum lines, maximum complexity)

---

## 12. Notes for Implementation

1. **Determinism:** All execution must be deterministic for replay/debugging
2. **Sandboxing:** Python execution must be sandboxed (no file I/O, imports)
3. **Performance:** Aim for <100ms execution time per mission
4. **Scaling:** Architecture should support >1000 concurrent executions
5. **Compatibility:** Must work across web (JavaScript), mobile, and backend

---

**End of Analysis**
