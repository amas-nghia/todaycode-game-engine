import type { Action, ActionContext } from './actions';
import type { GameEvent } from './events';
import {
  MultiFrameActionRunner,
  type MultiFrameActionState,
  type MultiFrameActionTickResult,
} from './multi-frame-action';

export interface PlanStep {
  action: Action;
}

export interface PlanRunnerState {
  queue: PlanStep[];
  current: MultiFrameActionState | null;
  completed: number;
  failed: boolean;
  failureReason?: string;
}

export interface PlanRunnerTickResult {
  state: PlanRunnerState;
  events: GameEvent[];
  done: boolean;
}

export interface PlanRunnerOptions {
  stopOnFailure?: boolean;
}

export type PlanYield = Action | null | undefined;
export type PlanIterator = Iterator<PlanYield, void, MultiFrameActionTickResult | undefined>;

/**
 * Runs beginner-style sequential plans: one action starts, receives ticks until
 * done, then the next action starts. This mirrors the CodeCombat "plan" idea
 * without embedding a language runtime in gamecore.
 */
export class PlanRunner {
  constructor(
    private readonly actions: MultiFrameActionRunner,
    private readonly options: PlanRunnerOptions = {}
  ) {}

  createState(actions: Action[]): PlanRunnerState {
    return {
      queue: actions.map((action) => ({ action })),
      current: null,
      completed: 0,
      failed: false,
    };
  }

  tick(ctx: ActionContext, state: PlanRunnerState): PlanRunnerTickResult {
    if (state.failed) {
      return { state, events: [], done: true };
    }

    const events: GameEvent[] = [];
    let current = state.current;
    let queue = state.queue;
    let completed = state.completed;
    let failed: boolean = state.failed;
    let failureReason = state.failureReason;

    if (!current && queue.length > 0) {
      const nextStep = queue[0]!;
      queue = queue.slice(1);
      const started = this.actions.start(ctx, nextStep.action);
      events.push(...started.events);

      if (started.state && started.state.status === 'running') {
        current = started.state;
      } else {
        if (started.state?.status === 'failed') {
          failed = this.options.stopOnFailure ?? true;
          failureReason = started.state.failureReason;
        } else if (started.state?.status === 'done') {
          completed += 1;
        }
        current = null;
      }
    }

    if (current) {
      const ticked = this.actions.tick(ctx, current);
      events.push(...ticked.events);
      
      if (ticked.state && ticked.state.status === 'running') {
        current = ticked.state;
      } else {
        if (ticked.state?.status === 'failed') {
          failed = this.options.stopOnFailure ?? true;
          failureReason = ticked.state.failureReason;
        } else if (ticked.state?.status === 'done') {
          completed += 1;
        }
        current = null;
      }
    }

    const nextState: PlanRunnerState = {
      queue,
      current,
      completed,
      failed,
      failureReason,
    };

    return {
      state: nextState,
      events,
      done: failed || (!current && queue.length === 0),
    };
  }


}

export interface YieldPlanRunnerState {
  current: MultiFrameActionState | null;
  completed: number;
  failed: boolean;
  done: boolean;
  failureReason?: string;
  lastResult?: MultiFrameActionTickResult;
}

export interface YieldPlanRunnerTickResult {
  state: YieldPlanRunnerState;
  events: GameEvent[];
  done: boolean;
}

/**
 * Runs a generator/iterator plan. The iterator yields an Action, the action runs
 * across frames, then the iterator is resumed with the completed action result.
 */
export class YieldPlanRunner {
  constructor(
    private readonly actions: MultiFrameActionRunner,
    private readonly plan: PlanIterator,
    private readonly options: PlanRunnerOptions = {}
  ) {}

  createState(): YieldPlanRunnerState {
    return {
      current: null,
      completed: 0,
      failed: false,
      done: false,
    };
  }

  tick(ctx: ActionContext, state: YieldPlanRunnerState): YieldPlanRunnerTickResult {
    if (state.failed || state.done) {
      return { state, events: [], done: true };
    }

    const events: GameEvent[] = [];
    let current = state.current;
    let completed = state.completed;
    let failed: boolean = state.failed;
    let done: boolean = state.done;
    let failureReason = state.failureReason;
    let lastResult = state.lastResult;
    const wasIdle = !current;

    if (current) {
      const ticked = this.actions.tick(ctx, current);
      events.push(...ticked.events);
      lastResult = ticked;

      if (ticked.state && ticked.state.status === 'running') {
        current = ticked.state;
      } else {
        if (ticked.state?.status === 'failed') {
          failed = this.options.stopOnFailure ?? true;
          failureReason = ticked.state.failureReason;
        } else if (ticked.state?.status === 'done') {
          completed += 1;
        }
        current = null;
      }
    }

    if (wasIdle && !failed && !done) {
      const yielded = this.plan.next(lastResult);
      done = Boolean(yielded.done);

      if (!done && yielded.value) {
        const started = this.actions.start(ctx, yielded.value);
        events.push(...started.events);

        if (started.state && started.state.status === 'running') {
          current = started.state;
        } else {
          if (started.state?.status === 'failed') {
            failed = this.options.stopOnFailure ?? true;
            failureReason = started.state.failureReason;
          } else if (started.state?.status === 'done') {
            completed += 1;
          }
          current = null;
        }

        if (current) {
          const ticked = this.actions.tick(ctx, current);
          events.push(...ticked.events);
          lastResult = ticked;

          if (ticked.state && ticked.state.status === 'running') {
            current = ticked.state;
          } else {
            if (ticked.state?.status === 'failed') {
              failed = this.options.stopOnFailure ?? true;
              failureReason = ticked.state.failureReason;
            } else if (ticked.state?.status === 'done') {
              completed += 1;
            }
            current = null;
          }
        }
      }
    }

    const nextState: YieldPlanRunnerState = {
      current,
      completed,
      failed,
      done,
      failureReason,
      lastResult,
    };

    return {
      state: nextState,
      events,
      done: failed || done,
    };
  }


}
