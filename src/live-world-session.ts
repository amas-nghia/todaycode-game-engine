import { WorldState } from './world';
import { GameEvent } from './events';
import { MultiFrameActionRunner, MultiFrameActionState } from './multi-frame-action';
import { SystemRunner } from './systems';
import { ActionContext, Action } from './actions';
import { ObjectiveSystem, ObjectiveCondition } from './objectives';
import { captureWorldFrame, WorldFrame } from './replay';
import { WorldRunnerResult } from './world-runner';

export interface LiveWorldSessionOptions {
  maxFrames?: number;
  winCondition?: ObjectiveCondition;
  lossCondition?: ObjectiveCondition;
}

export type LiveActionStatus = 'done' | 'failed' | 'interrupted';

export interface LiveActionResult {
  status: LiveActionStatus;
  events: GameEvent[];
  failureReason?: string;
}

export class LiveWorldSession {
  private events: GameEvent[] = [];
  private worldFrames: WorldFrame[] = [];
  private over = false;
  private success = false;

  constructor(
    public world: WorldState,
    public systems: SystemRunner,
    public actions: MultiFrameActionRunner,
    public objectives: ObjectiveSystem,
    private options: LiveWorldSessionOptions = {}
  ) {
    this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));

    if (this.options.winCondition && this.objectives.evaluate(this.world, this.options.winCondition)) {
      this.over = true;
      this.success = true;
    } else if (this.options.lossCondition && this.objectives.evaluate(this.world, this.options.lossCondition)) {
      this.over = true;
      this.success = false;
    }
  }

  runAction(action: Action): LiveActionResult {
    if (this.over) {
      return { status: 'interrupted', events: [] };
    }

    const startCtx: ActionContext = { world: this.world, frame: this.world.frame };
    const started = this.actions.start(startCtx, action);
    let actionState: MultiFrameActionState | null = started.state;

    if (!actionState || actionState.status === 'failed') {
      return {
        status: 'failed',
        events: started.events,
        failureReason: actionState?.failureReason
      };
    }

    if (actionState.status === 'done') {
      this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, started.events));
      this.events.push(...started.events);
      return { status: 'done', events: started.events };
    }

    const actionEvents: GameEvent[] = [];
    let pendingFrameEvents: GameEvent[] = [...started.events];
    const maxFrames = this.options.maxFrames ?? 2000;

    while (actionState && actionState.status === 'running' && !this.over) {
      const frameEvents: GameEvent[] = [...pendingFrameEvents];
      pendingFrameEvents = [];

      const tickCtx: ActionContext = { world: this.world, frame: this.world.frame };

      const systemEvents = this.systems.runTick(this.world);
      frameEvents.push(...systemEvents);

      const tickResult = this.actions.tick(tickCtx, actionState);
      actionState = tickResult.state;
      frameEvents.push(...tickResult.events);

      this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, frameEvents));
      this.events.push(...frameEvents);
      actionEvents.push(...frameEvents);

      if (this.options.winCondition && this.objectives.evaluate(this.world, this.options.winCondition)) {
        this.over = true;
        this.success = true;
      } else if (this.options.lossCondition && this.objectives.evaluate(this.world, this.options.lossCondition)) {
        this.over = true;
        this.success = false;
      }

      this.world.frame++;

      if (!this.over && this.world.frame >= maxFrames) {
        this.over = true;
        this.success = false;
      }
    }

    if (!actionState || actionState.status === 'running') {
      return { status: 'interrupted', events: actionEvents };
    }

    return {
      status: actionState.status,
      events: actionEvents,
      failureReason: actionState.failureReason
    };
  }

  isOver(): boolean {
    return this.over;
  }

  result(): WorldRunnerResult {
    return {
      success: this.success,
      frames: this.world.frame,
      events: this.events,
      worldFrames: this.worldFrames
    };
  }
}
