import { findNearest, isOccupied, isPathClear, isInBounds } from '../selectors';
import { createWorld, addEntity, WorldState } from '../world';
import { Entity } from '../entity';
import { PositionComponent, BlockingComponent, CollisionComponent } from '../components';

describe('Selectors', () => {
  let world: WorldState;

  beforeEach(() => {
    world = createWorld(42);
    world.bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
  });

  it('isOccupied returns true if entity with collision blocks movement', () => {
    const e1: Entity = {
      id: 'e1',
      kind: 'wall',
      components: {
        position: { x: 5, y: 5 } as PositionComponent,
        collision: { radius: 1 } as CollisionComponent,
        blocking: { blocksMovement: true } as BlockingComponent
      }
    };
    addEntity(world, e1);

    expect(isOccupied(world, { x: 5, y: 5 })).toBe(true);
    expect(isOccupied(world, { x: 4.5, y: 5 }, 0.6)).toBe(true);
    expect(isOccupied(world, { x: 10, y: 10 })).toBe(false);
  });

  it('findNearest tie-breaks deterministically based on order', () => {
    const fromEntity: Entity = { id: 'hero', kind: 'hero', components: { position: { x: 0, y: 0 } as PositionComponent } };
    // Both are at Euclidean distance 2
    const target1: Entity = { id: 't1', kind: 'enemy', components: { position: { x: 2, y: 0 } as PositionComponent } };
    const target2: Entity = { id: 't2', kind: 'enemy', components: { position: { x: 0, y: 2 } as PositionComponent } };

    // target1 added first, should win the tie-break
    addEntity(world, fromEntity);
    addEntity(world, target1);
    addEntity(world, target2);

    const nearest = findNearest(world, 'hero', e => e.kind === 'enemy');
    expect(nearest).toBe(target1);
  });

  it('findNearest tie-breaks deterministically based on order (reverse order)', () => {
    const fromEntity: Entity = { id: 'hero', kind: 'hero', components: { position: { x: 0, y: 0 } as PositionComponent } };
    const target1: Entity = { id: 't1', kind: 'enemy', components: { position: { x: 2, y: 0 } as PositionComponent } };
    const target2: Entity = { id: 't2', kind: 'enemy', components: { position: { x: 0, y: 2 } as PositionComponent } };

    // target2 added first, should win the tie-break
    addEntity(world, fromEntity);
    addEntity(world, target2);
    addEntity(world, target1);

    const nearest = findNearest(world, 'hero', e => e.kind === 'enemy');
    expect(nearest).toBe(target2);
  });
  
  it('isPathClear returns false if path intersects blocker', () => {
    const e1: Entity = {
      id: 'e1',
      kind: 'wall',
      components: {
        position: { x: 5, y: 5 } as PositionComponent,
        collision: { radius: 1 } as CollisionComponent,
        blocking: { blocksMovement: true } as BlockingComponent
      }
    };
    addEntity(world, e1);

    expect(isPathClear(world, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false);
    expect(isPathClear(world, { x: 0, y: 10 }, { x: 10, y: 10 })).toBe(true);
  });

  it('isInBounds works correctly', () => {
    expect(isInBounds(world, { x: 50, y: 50 })).toBe(true);
    expect(isInBounds(world, { x: -5, y: 50 })).toBe(false);
    expect(isInBounds(world, { x: 105, y: 50 })).toBe(false);
  });
});
