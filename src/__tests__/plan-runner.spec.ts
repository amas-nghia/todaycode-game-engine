import { ActionContext } from '../actions';
import { createWorld } from '../world';
import { MultiFrameActionHandler, MultiFrameActionRunner } from '../multi-frame-action';
import { PlanRunner, YieldPlanRunner } from '../plan-runner';

describe('PlanRunner', () => {
  let actionRunner: MultiFrameActionRunner;
  let planRunner: PlanRunner;
  let ctx: ActionContext;

  beforeEach(() => {
    actionRunner = new MultiFrameActionRunner();
    planRunner = new PlanRunner(actionRunner);
    ctx = { world: createWorld(42), frame: 0 };
  });

  it('runs one action across frames before starting the next action', () => {
    const slowHandler: MultiFrameActionHandler<{ steps: number }, { remaining: number }> = {
      type: 'SLOW',
      validate: () => ({ valid: true }),
      start: (_context, action) => ({
        localState: { remaining: action.payload?.steps ?? 1 },
      }),
      step: (context, state) => {
        const remaining = (state.localState?.remaining ?? 0) - 1;
        return {
          status: remaining > 0 ? 'running' : 'done',
          localState: { remaining },
          events: [{ type: 'custom', frame: context.frame, subtype: 'slow', payload: remaining }],
        };
      },
    };
    const instantHandler: MultiFrameActionHandler = {
      type: 'INSTANT',
      validate: () => ({ valid: true }),
      step: (context) => ({
        status: 'done',
        events: [{ type: 'custom', frame: context.frame, subtype: 'instant', payload: null }],
      }),
    };
    actionRunner.registerHandler(slowHandler);
    actionRunner.registerHandler(instantHandler);

    let state = planRunner.createState([
      { type: 'SLOW', actorId: 'hero', payload: { steps: 2 } },
      { type: 'INSTANT', actorId: 'hero' },
    ]);

    const first = planRunner.tick({ ...ctx, frame: 1 }, state);
    state = first.state;
    expect(first.done).toBe(false);
    expect(first.events).toEqual([{ type: 'custom', frame: 1, subtype: 'slow', payload: 1 }]);
    expect(state.completed).toBe(0);
    expect(state.queue).toHaveLength(1);

    const second = planRunner.tick({ ...ctx, frame: 2 }, state);
    state = second.state;
    expect(second.done).toBe(false);
    expect(second.events).toEqual([{ type: 'custom', frame: 2, subtype: 'slow', payload: 0 }]);
    expect(state.completed).toBe(1);
    expect(state.queue).toHaveLength(1);

    const third = planRunner.tick({ ...ctx, frame: 3 }, state);
    expect(third.done).toBe(true);
    expect(third.events).toEqual([{ type: 'custom', frame: 3, subtype: 'instant', payload: null }]);
    expect(third.state.completed).toBe(2);
  });

  it('stops on invalid action by default', () => {
    const state = planRunner.createState([{ type: 'UNKNOWN', actorId: 'hero' }]);
    const result = planRunner.tick(ctx, state);

    expect(result.done).toBe(true);
    expect(result.state.failed).toBe(true);
    expect(result.state.failureReason).toContain('Unknown action type');
  });

  it('resumes a yield plan only after the yielded action finishes', () => {
    const slowHandler: MultiFrameActionHandler<{ steps: number }, { remaining: number }> = {
      type: 'SLOW',
      validate: () => ({ valid: true }),
      start: (_context, action) => ({
        localState: { remaining: action.payload?.steps ?? 1 },
      }),
      step: (context, state) => {
        const remaining = (state.localState?.remaining ?? 0) - 1;
        return {
          status: remaining > 0 ? 'running' : 'done',
          localState: { remaining },
          events: [{ type: 'custom', frame: context.frame, subtype: 'slow', payload: remaining }],
        };
      },
    };
    const instantHandler: MultiFrameActionHandler = {
      type: 'INSTANT',
      validate: () => ({ valid: true }),
      step: (context) => ({
        status: 'done',
        events: [{ type: 'custom', frame: context.frame, subtype: 'instant', payload: null }],
      }),
    };
    actionRunner.registerHandler(slowHandler);
    actionRunner.registerHandler(instantHandler);

    const calls: string[] = [];
    function* plan() {
      calls.push('start');
      yield { type: 'SLOW', actorId: 'hero', payload: { steps: 2 } };
      calls.push('after slow');
      yield { type: 'INSTANT', actorId: 'hero' };
      calls.push('after instant');
    }

    const yieldRunner = new YieldPlanRunner(actionRunner, plan());
    let state = yieldRunner.createState();

    const first = yieldRunner.tick({ ...ctx, frame: 1 }, state);
    state = first.state;
    expect(first.done).toBe(false);
    expect(calls).toEqual(['start']);
    expect(state.completed).toBe(0);

    const second = yieldRunner.tick({ ...ctx, frame: 2 }, state);
    state = second.state;
    expect(second.done).toBe(false);
    expect(calls).toEqual(['start']);
    expect(state.completed).toBe(1);

    const third = yieldRunner.tick({ ...ctx, frame: 3 }, state);
    state = third.state;
    expect(third.done).toBe(false);
    expect(calls).toEqual(['start', 'after slow']);
    expect(third.events).toEqual([{ type: 'custom', frame: 3, subtype: 'instant', payload: null }]);
    expect(state.completed).toBe(2);

    const fourth = yieldRunner.tick({ ...ctx, frame: 4 }, state);
    expect(fourth.done).toBe(true);
    expect(calls).toEqual(['start', 'after slow', 'after instant']);
  });
});
