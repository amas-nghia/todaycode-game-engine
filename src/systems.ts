import { WorldState } from './world';
import { GameEvent } from './events';

export interface System {
  name: string;
  preAction?(world: WorldState): GameEvent[];
  action?(world: WorldState): GameEvent[];
  postAction?(world: WorldState): GameEvent[];
  tick?(world: WorldState): GameEvent[];
  objective?(world: WorldState): GameEvent[];
}

export class SystemRunner {
  private systems: System[] = [];

  addSystem(system: System): void {
    this.systems.push(system);
  }

  runPhase(world: WorldState, phase: keyof Omit<System, 'name'>): GameEvent[] {
    const events: GameEvent[] = [];
    for (const system of this.systems) {
      if (system[phase]) {
        const phaseEvents = system[phase]!(world);
        if (phaseEvents) {
          events.push(...phaseEvents);
        }
      }
    }
    return events;
  }

  runPreAction(world: WorldState): GameEvent[] {
    return this.runPhase(world, 'preAction');
  }

  runAction(world: WorldState): GameEvent[] {
    return this.runPhase(world, 'action');
  }

  runPostAction(world: WorldState): GameEvent[] {
    return this.runPhase(world, 'postAction');
  }

  runTick(world: WorldState): GameEvent[] {
    return this.runPhase(world, 'tick');
  }

  runObjective(world: WorldState): GameEvent[] {
    return this.runPhase(world, 'objective');
  }
}
