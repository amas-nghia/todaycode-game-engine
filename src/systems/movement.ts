import { System } from '../systems';
import { WorldState } from '../world';
import { GameEvent } from '../events';
import { getComponent, removeComponent } from '../entity';
import { PositionComponent, MotionComponent, MovementComponent } from '../components';
import { distance } from '../physics';

export class MovementSystem implements System {
  name = 'movement';

  tick(world: WorldState): GameEvent[] {
    const events: GameEvent[] = [];

    for (const id of world.order) {
      const entity = world.entities[id];
      const pos = getComponent<PositionComponent>(entity, 'position');
      const motion = getComponent<MotionComponent>(entity, 'motion');
      const movement = getComponent<MovementComponent>(entity, 'movement');

      if (pos && motion && movement) {
        const dist = distance(pos, motion.target);
        
        if (dist <= movement.speed) {
          pos.x = motion.target.x;
          pos.y = motion.target.y;
          removeComponent(entity, 'motion');
          
          events.push({
            type: 'custom',
            subtype: 'move_finished',
            frame: world.frame,
            payload: { actorId: id, position: { x: pos.x, y: pos.y } }
          });
        } else {
          const dx = motion.target.x - pos.x;
          const dy = motion.target.y - pos.y;
          const dirX = dx / dist;
          const dirY = dy / dist;

          pos.x += dirX * movement.speed;
          pos.y += dirY * movement.speed;
          
          events.push({
            type: 'custom',
            subtype: 'move_progress',
            frame: world.frame,
            payload: { actorId: id, position: { x: pos.x, y: pos.y } }
          });
        }
      }
    }

    return events;
  }
}
