import { WorldState, addEntity, createWorld } from '../world';
import { Entity } from '../entity';
import { SystemRunner } from '../systems';
import { MovementSystem } from '../systems/movement';
import { MultiFrameActionRunner } from '../multi-frame-action';
import { MoveDirectionHandler, WaitHandler } from '../actions/handlers';
import { ObjectiveSystem } from '../objectives';
import { LiveWorldSession, LiveWorldSessionOptions } from '../live-world-session';
import { buildReplay } from '../world-runner';

function makeWorld(): WorldState {
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

  return world;
}

function makeSession(world: WorldState, options: LiveWorldSessionOptions = {}): LiveWorldSession {
  const systems = new SystemRunner();
  systems.addSystem(new MovementSystem());

  const actions = new MultiFrameActionRunner();
  actions.registerHandler(new MoveDirectionHandler());
  actions.registerHandler(new WaitHandler());

  const objectives = new ObjectiveSystem();

  return new LiveWorldSession(world, systems, actions, objectives, options);
}

function heroPosition(world: WorldState): { x: number; y: number } {
  return world.entities['hero'].components.position as { x: number; y: number };
}

describe('LiveWorldSession', () => {
  it('advances frame-by-frame until a single MOVE_DIRECTION action completes', () => {
    const world = makeWorld();
    const session = makeSession(world);

    const result = session.runAction({ type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } });

    expect(result.status).toBe('done');
    expect(heroPosition(world)).toEqual({ x: 15, y: 10 });

    const sessionResult = session.result();
    expect(sessionResult.worldFrames.length).toBeGreaterThan(1);
    expect(sessionResult.frames).toBe(5);
  });

  it('lets the caller query the live world between actions with no snapshotting', () => {
    const world = makeWorld();
    const session = makeSession(world);

    session.runAction({ type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } });

    expect(heroPosition(world)).toEqual({ x: 15, y: 10 });
    expect(heroPosition(world)).not.toEqual({ x: 10, y: 10 });

    session.runAction({ type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'up' } });

    expect(heroPosition(world)).toEqual({ x: 15, y: 15 });
  });

  it('ends the session once the win condition is reached, and ignores further actions', () => {
    const world = makeWorld();
    const session = makeSession(world, {
      maxFrames: 100,
      winCondition: {
        type: 'reach_position',
        actorId: 'hero',
        position: { x: 15, y: 10 },
        radius: 0.1
      }
    });

    const first = session.runAction({ type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } });

    expect(['done', 'interrupted']).toContain(first.status);
    expect(session.isOver()).toBe(true);
    expect(session.result().success).toBe(true);

    const second = session.runAction({ type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'up' } });

    expect(second.status).toBe('interrupted');
    expect(second.events).toEqual([]);
    expect(heroPosition(world)).toEqual({ x: 15, y: 10 });
  });

  it('reports a failed action without ending the session, and keeps accepting actions', () => {
    const world = makeWorld();
    const session = makeSession(world);

    const failed = session.runAction({
      type: 'MOVE_DIRECTION',
      actorId: 'hero',
      payload: { direction: 'right', distance: 0 }
    });

    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBeTruthy();
    expect(session.isOver()).toBe(false);
    expect(heroPosition(world)).toEqual({ x: 10, y: 10 });

    const failedUnknownActor = session.runAction({
      type: 'MOVE_DIRECTION',
      actorId: 'ghost',
      payload: { direction: 'right' }
    });
    expect(failedUnknownActor.status).toBe('failed');
    expect(session.isOver()).toBe(false);

    const succeeded = session.runAction({ type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } });

    expect(succeeded.status).toBe('done');
    expect(heroPosition(world)).toEqual({ x: 15, y: 10 });
  });

  it('interrupts a long action once the frame budget is exhausted', () => {
    const world = makeWorld();
    const session = makeSession(world, { maxFrames: 5 });

    const result = session.runAction({ type: 'WAIT', actorId: 'hero', payload: { frames: 100 } });

    expect(result.status).toBe('interrupted');
    expect(session.isOver()).toBe(true);
    expect(session.result().success).toBe(false);
    expect(world.frame).toBe(5);
  });

  it('is deterministic across two independent runs of the same script', () => {
    function runScript(): LiveWorldSession {
      const world = makeWorld();
      const session = makeSession(world, { maxFrames: 100 });
      session.runAction({ type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } });
      session.runAction({ type: 'WAIT', actorId: 'hero', payload: { frames: 3 } });
      session.runAction({ type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'up' } });
      return session;
    }

    const resultA = runScript().result();
    const resultB = runScript().result();

    expect(resultA.worldFrames).toEqual(resultB.worldFrames);
    expect(resultA.events).toEqual(resultB.events);
  });

  it('produces a replay whose worldFrames match the session result', () => {
    const world = makeWorld();
    const session = makeSession(world);

    session.runAction({ type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } });

    const result = session.result();
    const replay = buildReplay(result, { levelSlug: 'test-level', seed: 123 });

    expect(replay.worldFrames).toEqual(result.worldFrames);
    expect(replay.frameCount).toBe(result.frames);
  });
});
