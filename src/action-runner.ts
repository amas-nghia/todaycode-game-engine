import { Action, ActionHandler, ActionContext, ValidationResult } from './actions';
import { GameEvent } from './events';

export class ActionRunner {
  private handlers = new Map<string, ActionHandler>();

  registerHandler(handler: ActionHandler): void {
    this.handlers.set(handler.type, handler);
  }

  run(ctx: ActionContext, actions: Action[]): GameEvent[] {
    const events: GameEvent[] = [];

    for (const action of actions) {
      const handler = this.handlers.get(action.type);
      if (!handler) {
        events.push({
          type: 'log',
          frame: ctx.frame,
          message: `Unknown action type: ${action.type}`,
        } as any);
        continue;
      }

      const validation: ValidationResult = handler.validate(ctx, action);
      if (!validation.valid) {
        events.push({
          type: 'log',
          frame: ctx.frame,
          message: `Action invalid: ${validation.reason}`,
        } as any);
        continue;
      }

      const result = handler.apply(ctx, action);
      events.push(...result.events);
    }

    return events;
  }
}
