import { System, SystemRunner } from '../systems';
import { createWorld, WorldState } from '../world';
import { LogEvent } from '../events';

describe('SystemRunner', () => {
  let runner: SystemRunner;
  let world: WorldState;

  beforeEach(() => {
    runner = new SystemRunner();
    world = createWorld(42);
  });

  it('runs pipeline phases in order', () => {
    const order: string[] = [];
    
    const sysA: System = {
      name: 'SysA',
      preAction: () => { order.push('A.preAction'); return []; },
      tick: () => { order.push('A.tick'); return []; },
    };

    const sysB: System = {
      name: 'SysB',
      preAction: () => { order.push('B.preAction'); return []; },
      tick: () => { order.push('B.tick'); return []; },
    };

    runner.addSystem(sysA);
    runner.addSystem(sysB);

    runner.runPreAction(world);
    runner.runTick(world);

    expect(order).toEqual([
      'A.preAction',
      'B.preAction',
      'A.tick',
      'B.tick'
    ]);
  });

  it('collects events from systems', () => {
    const sysA: System = {
      name: 'SysA',
      tick: (w) => [{ type: 'log', frame: w.frame, message: 'SysA tick' } as LogEvent],
    };

    runner.addSystem(sysA);
    const events = runner.runTick(world) as LogEvent[];

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('log');
    expect(events[0].message).toBe('SysA tick');
  });
});
