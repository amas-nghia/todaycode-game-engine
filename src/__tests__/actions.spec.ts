import { ActionRunner } from '../action-runner';
import { Action, ActionHandler, ActionContext } from '../actions';
import { createWorld } from '../world';
import { LogEvent } from '../events';

describe('ActionRunner', () => {
  let runner: ActionRunner;
  let ctx: ActionContext;

  beforeEach(() => {
    runner = new ActionRunner();
    ctx = { world: createWorld(42), frame: 1 };
  });

  it('runs an action successfully', () => {
    const handler: ActionHandler = {
      type: 'TEST_ACTION',
      validate: () => ({ valid: true }),
      apply: (context, action) => {
        return {
          events: [{ type: 'custom', frame: context.frame, subtype: 'test', payload: action.payload }] as any
        };
      }
    };
    runner.registerHandler(handler);

    const action: Action = { type: 'TEST_ACTION', actorId: 'e1', payload: 'hello' };
    const events = runner.run(ctx, [action]);

    expect(events.length).toBe(1);
    expect(events[0]).toEqual({ type: 'custom', frame: 1, subtype: 'test', payload: 'hello' });
  });

  it('emits failure event if action is invalid', () => {
    const handler: ActionHandler = {
      type: 'TEST_ACTION',
      validate: () => ({ valid: false, reason: 'Out of mana' }),
      apply: () => ({ events: [] })
    };
    runner.registerHandler(handler);

    const action: Action = { type: 'TEST_ACTION', actorId: 'e1' };
    const events = runner.run(ctx, [action]) as LogEvent[];

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('log');
    expect(events[0].message).toContain('Out of mana');
  });

  it('emits failure event if action handler is unknown', () => {
    const action: Action = { type: 'UNKNOWN', actorId: 'e1' };
    const events = runner.run(ctx, [action]) as LogEvent[];

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('log');
    expect(events[0].message).toContain('Unknown action type');
  });
});
