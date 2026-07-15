import { ObjectiveSystem, ObjectiveCondition } from '../objectives';
import { createWorld, addEntity, WorldState } from '../world';
import { Entity } from '../entity';
import { HealthComponent } from '../components';

describe('ObjectiveSystem', () => {
  let system: ObjectiveSystem;
  let world: WorldState;

  beforeEach(() => {
    system = new ObjectiveSystem();
    world = createWorld(42);
  });

  it('evaluates all composition', () => {
    system.registerEvaluator('pass', () => true);
    system.registerEvaluator('fail', () => false);

    const condition: ObjectiveCondition = {
      type: 'all',
      conditions: [
        { type: 'pass' },
        { type: 'pass' }
      ]
    };
    expect(system.evaluate(world, condition)).toBe(true);

    const conditionFail: ObjectiveCondition = {
      type: 'all',
      conditions: [
        { type: 'pass' },
        { type: 'fail' }
      ]
    };
    expect(system.evaluate(world, conditionFail)).toBe(false);
  });

  it('evaluates any composition', () => {
    system.registerEvaluator('pass', () => true);
    system.registerEvaluator('fail', () => false);

    const condition: ObjectiveCondition = {
      type: 'any',
      conditions: [
        { type: 'fail' },
        { type: 'pass' }
      ]
    };
    expect(system.evaluate(world, condition)).toBe(true);

    const conditionFail: ObjectiveCondition = {
      type: 'any',
      conditions: [
        { type: 'fail' },
        { type: 'fail' }
      ]
    };
    expect(system.evaluate(world, conditionFail)).toBe(false);
  });

  it('evaluates defeat_all', () => {
    const enemy1: Entity = { id: 'e1', kind: 'enemy', components: { health: { current: 0, max: 10 } as HealthComponent } };
    addEntity(world, enemy1);
    
    expect(system.evaluate(world, { type: 'defeat_all' })).toBe(true);

    const enemy2: Entity = { id: 'e2', kind: 'enemy', components: { health: { current: 10, max: 10 } as HealthComponent } };
    addEntity(world, enemy2);

    expect(system.evaluate(world, { type: 'defeat_all' })).toBe(false);
  });

  it('evaluates metric_comparison', () => {
    world.metrics['gold'] = 50;

    expect(system.evaluate(world, { type: 'metric_comparison', metric: 'gold', operator: 'gte', value: 50 })).toBe(true);
    expect(system.evaluate(world, { type: 'metric_comparison', metric: 'gold', operator: 'lt', value: 50 })).toBe(false);
    expect(system.evaluate(world, { type: 'metric_comparison', metric: 'gold', operator: 'eq', value: 50 })).toBe(true);
  });

  it('throws on unknown type', () => {
    expect(() => system.evaluate(world, { type: 'unknown' })).toThrow(/Unknown objective type/);
  });
});
