import { ActionContext } from '../actions';
import { createWorld } from '../world';
import { MultiFrameActionRunner, MultiFrameActionHandler } from '../multi-frame-action';

describe('MultiFrameActionRunner', () => {
  let runner: MultiFrameActionRunner;
  let ctx: ActionContext;

  beforeEach(() => {
    runner = new MultiFrameActionRunner();
    ctx = { world: createWorld(42), frame: 0 };
  });

  it('keeps an action running until its handler reports done', () => {
    const handler: MultiFrameActionHandler<{ steps: number }, { remaining: number }> = {
      type: 'MOVE_OVER_TIME',
      validate: () => ({ valid: true }),
      start: (_context, action) => ({
        localState: { remaining: action.payload?.steps ?? 1 },
      }),
      step: (context, state) => {
        const remaining = (state.localState?.remaining ?? 0) - 1;
        return {
          status: remaining > 0 ? 'running' : 'done',
          localState: { remaining },
          events: [{ type: 'custom', frame: context.frame, subtype: 'step', payload: remaining }],
        };
      },
    };
    runner.registerHandler(handler);

    const started = runner.start(ctx, {
      type: 'MOVE_OVER_TIME',
      actorId: 'hero',
      payload: { steps: 2 },
    });

    expect(started.state?.status).toBe('running');

    const first = runner.tick({ ...ctx, frame: 1 }, started.state);
    expect(first.state?.status).toBe('running');
    expect(first.events).toEqual([{ type: 'custom', frame: 1, subtype: 'step', payload: 1 }]);

    const second = runner.tick({ ...ctx, frame: 2 }, first.state);
    expect(second.state?.status).toBe('done');
    expect(second.events).toEqual([{ type: 'custom', frame: 2, subtype: 'step', payload: 0 }]);
  });

  it('emits a log event when an action cannot start', () => {
    const started = runner.start(ctx, { type: 'UNKNOWN', actorId: 'hero' });

    expect(started.state?.status).toBe('failed');
    expect(started.events[0]).toMatchObject({
      type: 'log',
      frame: 0,
    });
  });
});
