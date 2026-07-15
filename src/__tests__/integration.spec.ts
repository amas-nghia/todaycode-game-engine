import { WorldState, addEntity, createWorld } from '../world';
import { Entity } from '../entity';
import { SystemRunner } from '../systems';
import { MovementSystem } from '../systems/movement';
import { MultiFrameActionRunner } from '../multi-frame-action';
import { YieldPlanRunner, PlanIterator } from '../plan-runner';
import { MoveDirectionHandler, AttackHandler, PickUpHandler } from '../actions/handlers';
import { ObjectiveSystem } from '../objectives';
import { WorldRunner } from '../world-runner';

describe('integration', () => {
  it('hero executes plan continuously via WorldRunner', () => {
    const world = createWorld(123, 0);
    world.bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

    const hero: Entity = {
      id: 'hero',
      kind: 'hero',
      components: {
        position: { x: 10, y: 10 },
        movement: { speed: 1, stepDistance: 5 },
        collision: { radius: 0.5 }
      }
    };
    addEntity(world, hero);

    const systems = new SystemRunner();
    systems.addSystem(new MovementSystem());

    const actions = new MultiFrameActionRunner();
    actions.registerHandler(new MoveDirectionHandler());

    const objectives = new ObjectiveSystem();

    function* heroPlan(): PlanIterator {
      yield { type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } };
      yield { type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'up' } };
    }

    const runner = new YieldPlanRunner(actions, heroPlan());

    const worldRunner = new WorldRunner(world, systems, actions, objectives, runner, {
      maxFrames: 100,
      winCondition: {
        type: 'reach_position',
        actorId: 'hero',
        position: { x: 15, y: 15 },
        radius: 0.1
      }
    });

    const result = worldRunner.run();

    // Should have moved right 5 units, up 5 units
    expect((world.entities['hero'].components.position as any).x).toBe(15);
    expect((world.entities['hero'].components.position as any).y).toBe(15);
    expect(result.success).toBe(true);
    expect(result.worldFrames.length).toBeGreaterThan(0);
  });

  it('treats an out-of-bounds move as blocked and continues the plan', () => {
    const world = createWorld(123, 0);
    world.bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

    const hero: Entity = {
      id: 'hero',
      kind: 'hero',
      components: {
        position: { x: 0, y: 0 },
        movement: { speed: 1, stepDistance: 5 },
        collision: { radius: 0.5 }
      }
    };
    addEntity(world, hero);

    const systems = new SystemRunner();
    systems.addSystem(new MovementSystem());

    const actions = new MultiFrameActionRunner();
    actions.registerHandler(new MoveDirectionHandler());

    function* heroPlan(): PlanIterator {
      yield { type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'left' } };
      yield { type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } };
    }

    const runner = new YieldPlanRunner(actions, heroPlan());
    const objectives = new ObjectiveSystem();

    const worldRunner = new WorldRunner(world, systems, actions, objectives, runner, { maxFrames: 100 });
    const result = worldRunner.run();

    expect(result.success).toBe(false);
    expect(result.events.some((event) => event.type === 'move_blocked')).toBe(true);
    expect((world.entities['hero'].components.position as any).x).toBe(5);
  });

  it('handles PICK_UP and ATTACK actions in a complex scenario', () => {
    const world = createWorld(123, 0);
    world.bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

    addEntity(world, {
      id: 'hero',
      kind: 'hero',
      components: {
        position: { x: 10, y: 10 },
        movement: { speed: 2, stepDistance: 2.5 },
        combat: { damage: 5, range: 2.0 },
        collision: { radius: 0.5 }
      }
    });

    addEntity(world, {
      id: 'coin',
      kind: 'coin',
      components: {
        position: { x: 12.5, y: 10 },
        collectible: { kind: 'gold' }
      }
    });

    addEntity(world, {
      id: 'enemy',
      kind: 'enemy',
      components: {
        position: { x: 15, y: 10 },
        health: { current: 5, max: 5 },
        collision: { radius: 0.5 },
        blocking: { blocksMovement: true }
      }
    });

    const systems = new SystemRunner();
    systems.addSystem(new MovementSystem());

    const actions = new MultiFrameActionRunner();
    actions.registerHandler(new MoveDirectionHandler());
    actions.registerHandler(new AttackHandler());
    actions.registerHandler(new PickUpHandler());

    function* heroPlan(): PlanIterator {
      yield { type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } }; // x: 12.5
      yield { type: 'PICK_UP', actorId: 'hero', payload: { targetId: 'coin' } };
      yield { type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } }; // x: 15 (blocked by enemy)
      // will fail and stop plan, but let's change plan to attack
      // distance to enemy at x: 15 is 2.5. Out of range (2.0)
      // wait, hero at 12.5, enemy at 15. distance is 2.5.
      // let's attack after moving a bit more.
      // ah, move right blocked, but wait. If we move right by 2.5 it hits 15, which is blocked.
      // So instead, attack from 12.5? Wait, range is 2.0. So it's out of range.
      // Let's change combat range to 3.0 so we can attack from 12.5.
    }
    
    // I'll adjust the components instead of complex logic
    world.entities['hero'].components.combat = { damage: 5, range: 3.0 };

    function* adjustedPlan(): PlanIterator {
      yield { type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } }; // x: 12.5
      yield { type: 'PICK_UP', actorId: 'hero', payload: { targetId: 'coin' } };
      yield { type: 'ATTACK', actorId: 'hero', payload: { targetId: 'enemy' } };
    }

    const runner = new YieldPlanRunner(actions, adjustedPlan());
    const objectives = new ObjectiveSystem();
    
    const worldRunner = new WorldRunner(world, systems, actions, objectives, runner, {
      maxFrames: 100,
      winCondition: {
        type: 'all',
        conditions: [
          { type: 'defeat_all' },
          { type: 'collect_count', actorId: 'hero', kind: 'gold', count: 1 }
        ]
      }
    });

    const result = worldRunner.run();

    expect(result.success).toBe(true);
    expect((world.entities['hero'].components.inventory as any).counts.gold).toBe(1);
    expect((world.entities['enemy'].components.health as any).current).toBe(0);
    expect(result.worldFrames.length).toBeGreaterThan(0);
  });
});
