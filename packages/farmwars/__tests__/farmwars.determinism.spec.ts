import { FarmWarsEngine } from '../src/farmwars.engine';
import { FrameDriver, withDecisionInterval, Commander } from '../../gamecore/src';

describe('FarmWars v2 Determinism', () => {
  class DummyCommander implements Commander {
    constructor(private orders: string[]) {}
    decide(state: any, agentId: number, frame: number): string[] {
      return this.orders;
    }
  }

  it('should produce identical state sequence given identical inputs', () => {
    const engine1 = new FarmWarsEngine();
    const engine2 = new FarmWarsEngine();

    const seed = 42;
    const level = {
      slug: 'farmwars-v2',
      version: 2,
      gameSlug: 'farmwars',
      definition: {},
    };

    const commanders1 = new Map<number, Commander>([
      [1, new DummyCommander(['right', 'down', 'right'])],
      [2, new DummyCommander(['left', 'up', 'left'])],
    ]);

    const commanders2 = new Map<number, Commander>([
      [1, new DummyCommander(['right', 'down', 'right'])],
      [2, new DummyCommander(['left', 'up', 'left'])],
    ]);

    const driver1 = new FrameDriver(withDecisionInterval(3));
    const driver2 = new FrameDriver(withDecisionInterval(3));

    const replay1 = driver1.run(engine1, level, seed, commanders1);
    const replay2 = driver2.run(engine2, level, seed, commanders2);

    expect(JSON.stringify(replay1)).toEqual(JSON.stringify(replay2));
  });

  it('khác seed → khác outcome/replay', () => {
    const engine = new FarmWarsEngine();

    const level = {
      slug: 'farmwars-v2',
      version: 2,
      gameSlug: 'farmwars',
      definition: {},
    };

    const commanders = new Map<number, Commander>([
      [1, new DummyCommander(['stay', 'stay', 'stay'])],
      [2, new DummyCommander(['stay', 'stay', 'stay'])],
    ]);

    const driver1 = new FrameDriver(withDecisionInterval(3));
    const driver2 = new FrameDriver(withDecisionInterval(3));

    const replay1 = driver1.run(engine, level, 123, commanders);
    const replay2 = driver1.run(engine, level, 456, commanders);

    expect(JSON.stringify(replay1)).not.toEqual(JSON.stringify(replay2));
  });
});
