import { FarmWarsEngine } from '../src/farmwars.engine';
import { FarmWarsState } from '../src/state';

describe('FarmWars v2 Scenario Tests', () => {
  let engine: FarmWarsEngine;
  let state: FarmWarsState;

  beforeEach(() => {
    engine = new FarmWarsEngine();
    const level = {
      slug: 'farmwars-v2',
      version: 2,
      gameSlug: 'farmwars',
      definition: {},
    };
    state = engine.init(level, 100);
  });

  it('combat simultaneous damage with Farmer Root Shield', () => {
    // Team1 Farmer (HP 6, Atk 1) vs Team2 Farmer (HP 6, Atk 1)
    // Setup so they are in the same cell at frame 0
    state.team1.actors[0].x = 5;
    state.team1.actors[0].y = 5;

    state.team2.actors[0].x = 5;
    state.team2.actors[0].y = 5;

    // Plant a tree at 5,5 belonging to Team 1 so Root shield activates for Team 1
    state.trees.push({
      id: 99,
      x: 5,
      y: 5,
      team: 1,
      age: 0,
      fruits: 0,
    });

    // Both move 'stay'. Both are speed 1.
    state = engine.applyOrders(state, 1, ['stay', 'stay', 'stay']);
    state = engine.applyOrders(state, 2, ['stay', 'stay', 'stay']);

    const { state: nextState } = engine.tick(state, 0);

    // Team 1 Farmer takes (1 - 2(shield)) = 0 damage. HP: 6 -> 6
    // Team 2 Farmer takes 1 damage. HP: 6 -> 5
    expect(nextState.team1.actors[0].stats.hp).toBe(6);
    expect(nextState.team2.actors[0].stats.hp).toBe(5);
  });

  it('runner drops fruit on death', () => {
    // Runner (Harvester) HP 3
    state.team1.actors[1].x = 3;
    state.team1.actors[1].y = 3;
    state.team1.actors[1].inventory = 2; // Runner carries 2 fruit

    // Biter (Worm) HP 4, Atk 3 (enough to 1-shot a Runner with 3 HP)
    state.team2.actors[2].x = 3;
    state.team2.actors[2].y = 3;

    state = engine.applyOrders(state, 1, ['stay', 'stay', 'stay']);
    state = engine.applyOrders(state, 2, ['stay', 'stay', 'stay']);

    const { state: nextState, events } = engine.tick(state, 0);

    // Runner dies
    expect(nextState.team1.actors[1].respawnIn).toBeGreaterThan(0);
    const dropEvent = events.find((e) => e.type === 'fruit_drop');
    expect(dropEvent).toBeDefined();
    expect((dropEvent as any).amount).toBe(2);
  });

  it('speed schedule: runner moves 3 times, farmer moves 1 time per tick', () => {
    // Runner (speed 3) index 1
    state.team1.actors[1].x = 1;
    state.team1.actors[1].y = 1;

    // Farmer (speed 1) index 0
    state.team2.actors[0].x = 5;
    state.team2.actors[0].y = 5;

    // Move others out of the way
    state.team1.actors[0].x = 0; state.team1.actors[0].y = 0;
    state.team1.actors[2].x = 0; state.team1.actors[2].y = 1;
    state.team2.actors[1].x = 11; state.team2.actors[1].y = 0;
    state.team2.actors[2].x = 11; state.team2.actors[2].y = 1;

    // Order index matches actor index: [planter, harvester, worm]
    state = engine.applyOrders(state, 1, ['stay', 'right', 'stay']);
    state = engine.applyOrders(state, 2, ['left', 'stay', 'stay']);

    // 1 tick = 3 frames (0, 1, 2)
    state = engine.tick(state, 0).state;
    state = engine.tick(state, 1).state;
    state = engine.tick(state, 2).state;

    // Runner should move right 3 times
    expect(state.team1.actors[1].x).toBe(4);
    
    // Farmer should move left 1 time
    expect(state.team2.actors[0].x).toBe(4);
  });

  it('fruit tree lifecycle and collection', () => {
    // Plant a tree
    state.trees.push({
      id: 1,
      x: 3,
      y: 3,
      team: 1,
      age: 19, // About to reach mature age
      fruits: 0,
    });

    state.team1.actors[1].x = 3;
    state.team1.actors[1].y = 3;
    state.team1.actors[1].inventory = 0;

    // Tick it up so it reaches 20 by completing a full tick (frames 0, 1, 2)
    state = engine.tick(state, 0).state;
    state = engine.tick(state, 1).state;
    const { state: nextState, events } = engine.tick(state, 2);

    // Tree should now have 1 fruit since it crossed the age 20 threshold
    expect(nextState.trees[0].fruits).toBe(1);

    // Now the runner (actor index 1) issues a collect command
    const state2 = engine.applyOrders(nextState, 1, ['stay', 'collect', 'stay']);
    
    // Frame 0: stay, Frame 1: collect
    let state3 = engine.tick(state2, 0).state;
    const { state: nextState2 } = engine.tick(state3, 1);

    expect(nextState2.trees[0].fruits).toBe(0);
    expect(nextState2.team1.actors[1].inventory).toBe(1);
  });

  it('map boundaries & collision limits movement', () => {
    // Move actor to right edge
    state.team1.actors[0].x = 11;
    state.team1.actors[0].y = 5;

    // Order to move right
    state = engine.applyOrders(state, 1, ['right', 'stay', 'stay']);

    const { state: nextState } = engine.tick(state, 0);

    // Should stay at 11
    expect(nextState.team1.actors[0].x).toBe(11);
  });

  it('base deposit points and heal', () => {
    // Put Runner on base with 2 fruit
    state.team1.actors[1].x = 0; // base is 0,1
    state.team1.actors[1].y = 1;
    state.team1.actors[1].inventory = 2;
    state = engine.applyOrders(state, 1, ['stay', 'stay', 'stay']);

    let state2 = engine.tick(state, 0).state;
    let state3 = engine.tick(state2, 1).state;
    const { state: nextState } = engine.tick(state3, 2);

    // Score increases
    expect(nextState.team1.score).toBe(2); // inventory was 2
    // Inventory empties
    expect(nextState.team1.actors[1].inventory).toBe(0);
  });
});
