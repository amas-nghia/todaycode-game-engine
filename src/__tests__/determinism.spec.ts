import { createWorld, addEntity } from '../world';
import { SystemRunner } from '../systems';
import { MovementSystem } from '../systems/movement';
import { MultiFrameActionRunner } from '../multi-frame-action';
import { MoveDirectionHandler, AttackHandler } from '../actions/handlers';
import { YieldPlanRunner } from '../plan-runner';
import { ObjectiveSystem } from '../objectives';
import { WorldRunner, WorldRunnerResult } from '../world-runner';

describe('Determinism', () => {
  function runScenario(): WorldRunnerResult {
    const world = createWorld(12345);
    world.bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

    addEntity(world, {
      id: 'hero',
      kind: 'hero',
      components: {
        position: { x: 10.5, y: 10.5 },
        movement: { speed: 2, stepDistance: 4.33 },
        combat: { damage: 10, range: 5.0 },
        programmable: { agentId: 'player' }
      }
    });

    addEntity(world, {
      id: 'enemy',
      kind: 'enemy',
      components: {
        position: { x: 14.83, y: 14.83 },
        health: { current: 20, max: 20 },
        collision: { radius: 0.5 },
        blocking: { blocksMovement: true }
      }
    });

    const systemRunner = new SystemRunner();
    systemRunner.addSystem(new MovementSystem());

    const actionRunner = new MultiFrameActionRunner();
    actionRunner.registerHandler(new MoveDirectionHandler());
    actionRunner.registerHandler(new AttackHandler());
    
    function* heroPlan() {
      yield { type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } }; // hero at 14.83, 10.5
      // distance to enemy (14.83, 14.83) is 4.33, within range 5.0
      yield { type: 'ATTACK', actorId: 'hero', payload: { targetId: 'enemy' } };
      yield { type: 'ATTACK', actorId: 'hero', payload: { targetId: 'enemy' } };
    }
    
    const planRunner = new YieldPlanRunner(actionRunner, heroPlan());
    const objectiveSystem = new ObjectiveSystem();

    const runner = new WorldRunner(world, systemRunner, actionRunner, objectiveSystem, planRunner, { 
      maxFrames: 100,
      winCondition: { type: 'defeat_all' }
    });
    return runner.run();
  }

  it('produces exactly the same state across 100 runs using continuous JS floats', () => {
    const firstRun = runScenario();
    
    // Check that it succeeded
    expect(firstRun.success).toBe(true);

    const firstRunHash = JSON.stringify(firstRun.worldFrames);

    for (let i = 0; i < 100; i++) {
      const nthRun = runScenario();
      const nthRunHash = JSON.stringify(nthRun.worldFrames);
      expect(nthRunHash).toBe(firstRunHash);
    }
  });
});
