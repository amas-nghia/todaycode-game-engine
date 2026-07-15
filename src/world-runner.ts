import { WorldState } from './world';
import { GameEvent } from './events';
import { PlanRunner, YieldPlanRunner, YieldPlanRunnerState, PlanRunnerState } from './plan-runner';
import { MultiFrameActionRunner, MultiFrameActionState } from './multi-frame-action';
import { SystemRunner } from './systems';
import { ActionContext, Action } from './actions';
import { ObjectiveSystem, ObjectiveCondition } from './objectives';
import { captureWorldFrame, WorldFrame, Replay } from './replay';

export interface WorldRunnerOptions {
  maxFrames?: number;
  winCondition?: ObjectiveCondition;
  lossCondition?: ObjectiveCondition;
  initialPlanState?: YieldPlanRunnerState | PlanRunnerState;
}

export interface WorldRunnerResult {
  success: boolean;
  frames: number;
  events: GameEvent[];
  worldFrames: WorldFrame[];
}

export interface ReplayMetadata {
  engine?: string;
  engineVersion?: string;
  levelSlug?: string;
  levelVersion?: number;
  seed?: number;
  schemaVersion?: number;
  config?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export function buildReplay(result: WorldRunnerResult, metadata: ReplayMetadata = {}): Replay {
  return {
    engine: metadata.engine || 'todaycode-game-engine',
    engineVersion: metadata.engineVersion || '0.2.6',
    levelSlug: metadata.levelSlug || 'unknown',
    levelVersion: metadata.levelVersion || 1,
    seed: metadata.seed || 0,
    frameCount: result.frames,
    worldFrames: result.worldFrames,
    outcome: {
      over: true,
      passed: result.success
    },
    schemaVersion: metadata.schemaVersion,
    config: metadata.config,
    meta: metadata.meta
  };
}


export class WorldRunner {
  private events: GameEvent[] = [];
  private worldFrames: WorldFrame[] = [];
  private planState: any;

  constructor(
    public world: WorldState,
    public systemRunner: SystemRunner,
    public actionRunner: MultiFrameActionRunner,
    public objectiveSystem: ObjectiveSystem,
    private planRunner: YieldPlanRunner | PlanRunner,
    private options: WorldRunnerOptions = {}
  ) {
    if (this.options.initialPlanState) {
      this.planState = this.options.initialPlanState;
    } else {
      if (this.planRunner instanceof YieldPlanRunner) {
        this.planState = this.planRunner.createState();
      } else if (this.planRunner instanceof PlanRunner) {
        this.planState = this.planRunner.createState([]); // Needs actions, assume empty if not provided
      }
    }
  }

  run(): WorldRunnerResult {
    const maxFrames = this.options.maxFrames ?? 10000;
    
    // Check initial objectives state
    if (this.options.winCondition && this.objectiveSystem.evaluate(this.world, this.options.winCondition)) {
      this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
      return {
        success: true,
        frames: this.world.frame,
        events: this.events,
        worldFrames: this.worldFrames
      };
    }
    
    if (this.options.lossCondition && this.objectiveSystem.evaluate(this.world, this.options.lossCondition)) {
      this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
      return {
        success: false,
        frames: this.world.frame,
        events: this.events,
        worldFrames: this.worldFrames
      };
    }

    while (this.world.frame < maxFrames) {
      const frameEvents: GameEvent[] = [];

      const ctx: ActionContext = {
        world: this.world,
        frame: this.world.frame
      };

      // 2. Tick systems (passive movement, etc.)
      const systemEvents = this.systemRunner.runTick(this.world);
      frameEvents.push(...systemEvents);
      this.events.push(...systemEvents);

      // 3. Tick plan runner (actions)
      if (this.planRunner instanceof YieldPlanRunner) {
        if (!this.planState.failed && !this.planState.done) {
          const ticked = this.planRunner.tick(ctx, this.planState);
          this.planState = ticked.state;
          frameEvents.push(...ticked.events);
          this.events.push(...ticked.events);
        }
      } else if (this.planRunner instanceof PlanRunner) {
        if (!this.planState.failed) {
          const ticked = this.planRunner.tick(ctx, this.planState);
          this.planState = ticked.state;
          frameEvents.push(...ticked.events);
          this.events.push(...ticked.events);
        }
      }

      // 1. Capture frame at the end of tick
      this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, frameEvents));

      // 4. Tick objectives
      if (this.options.winCondition && this.objectiveSystem.evaluate(this.world, this.options.winCondition)) {
        this.world.frame++;
        this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, [])); // capture final state
        return {
          success: true,
          frames: this.world.frame,
          events: this.events,
          worldFrames: this.worldFrames
        };
      }
      
      if (this.options.lossCondition && this.objectiveSystem.evaluate(this.world, this.options.lossCondition)) {
        this.world.frame++;
        this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
        return {
          success: false,
          frames: this.world.frame,
          events: this.events,
          worldFrames: this.worldFrames
        };
      }

      // Check if plan runner failed explicitly
      if (this.planState && this.planState.failed) {
        this.world.frame++;
        this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
        return {
          success: false, // plan failed and objectives didn't succeed
          frames: this.world.frame,
          events: this.events,
          worldFrames: this.worldFrames
        };
      }

      // Check if plan runner is done but objective is not met yet
      if (this.planState && this.planState.done) {
        this.world.frame++;
        this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
        return {
          success: false, // plan done but objectives didn't succeed
          frames: this.world.frame,
          events: this.events,
          worldFrames: this.worldFrames
        };
      }

      // 5. Advance frame
      this.world.frame++;
    }

    // Timeout
    this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
    return {
      success: false,
      frames: this.world.frame,
      events: this.events,
      worldFrames: this.worldFrames
    };
  }
}
