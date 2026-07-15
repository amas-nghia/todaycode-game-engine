import type { Action, ActionContext, ValidationResult } from './actions';
import type { GameEvent } from './events';

export type MultiFrameActionStatus = 'running' | 'done' | 'failed';

export interface MultiFrameActionState<Payload = unknown, LocalState = unknown> {
  action: Action<Payload>;
  startedFrame: number;
  updatedFrame: number;
  status: MultiFrameActionStatus;
  localState?: LocalState;
  failureReason?: string;
}

export interface MultiFrameActionStepResult<LocalState = unknown> {
  status: MultiFrameActionStatus;
  events: GameEvent[];
  localState?: LocalState;
  failureReason?: string;
}

export interface MultiFrameActionHandler<Payload = unknown, LocalState = unknown> {
  type: string;
  validate(ctx: ActionContext, action: Action<Payload>): ValidationResult;
  start?(ctx: ActionContext, action: Action<Payload>): {
    events?: GameEvent[];
    localState?: LocalState;
  };
  step(
    ctx: ActionContext,
    state: MultiFrameActionState<Payload, LocalState>
  ): MultiFrameActionStepResult<LocalState>;
}

export interface MultiFrameActionTickResult {
  state: MultiFrameActionState | null;
  events: GameEvent[];
}

export class MultiFrameActionRunner {
  private handlers = new Map<string, MultiFrameActionHandler>();

  registerHandler(handler: MultiFrameActionHandler): void {
    this.handlers.set(handler.type, handler);
  }

  start(ctx: ActionContext, action: Action): MultiFrameActionTickResult {
    const handler = this.handlers.get(action.type);
    if (!handler) {
      return {
        state: { action, startedFrame: ctx.frame, updatedFrame: ctx.frame, status: 'failed', failureReason: `Unknown action type: ${action.type}` },
        events: [{
          type: 'log',
          frame: ctx.frame,
          message: `Unknown action type: ${action.type}`,
        }],
      };
    }

    const validation = handler.validate(ctx, action);
    if (!validation.valid) {
      return {
        state: { action, startedFrame: ctx.frame, updatedFrame: ctx.frame, status: 'failed', failureReason: `Action invalid: ${validation.reason}` },
        events: [{
          type: 'log',
          frame: ctx.frame,
          message: `Action invalid: ${validation.reason}`,
        }],
      };
    }

    const started = handler.start?.(ctx, action);
    const state: MultiFrameActionState = {
      action,
      startedFrame: ctx.frame,
      updatedFrame: ctx.frame,
      status: 'running',
      localState: started?.localState,
    };

    return { state, events: started?.events ?? [] };
  }

  tick(ctx: ActionContext, state: MultiFrameActionState | null): MultiFrameActionTickResult {
    if (!state) return { state: null, events: [] };
    if (state.status !== 'running') return { state: null, events: [] };

    const handler = this.handlers.get(state.action.type);
    if (!handler) {
      return {
        state: null,
        events: [{
          type: 'log',
          frame: ctx.frame,
          message: `Unknown action type: ${state.action.type}`,
        }],
      };
    }

    const result = handler.step(ctx, state);
    const nextState: MultiFrameActionState = {
      ...state,
      updatedFrame: ctx.frame,
      status: result.status,
      localState: result.localState,
      failureReason: result.failureReason,
    };

    const events = [...result.events];

    return {
      state: nextState,
      events,
    };
  }
}
