import { createWorld, addEntity, removeEntity, getEntity, updateEntity, WorldState } from '../world';
import { Entity } from '../entity';

describe('World helpers', () => {
  let world: WorldState;
  const entity1: Entity = { id: 'e1', kind: 'actor', components: {} };
  const entity2: Entity = { id: 'e2', kind: 'tree', components: {} };

  beforeEach(() => {
    world = createWorld(42, 0);
  });

  it('createWorld creates an empty deterministic world', () => {
    expect(world.seed).toBe(42);
    expect(world.frame).toBe(0);
    expect(world.entities).toEqual({});
    expect(world.order).toEqual([]);
  });

  it('addEntity adds an entity to the end of order array', () => {
    addEntity(world, entity1);
    expect(world.entities['e1']).toBe(entity1);
    expect(world.order).toEqual(['e1']);

    addEntity(world, entity2);
    expect(world.entities['e2']).toBe(entity2);
    expect(world.order).toEqual(['e1', 'e2']);
  });

  it('addEntity throws if entity exists', () => {
    addEntity(world, entity1);
    expect(() => addEntity(world, entity1)).toThrow(/already exists/);
  });

  it('removeEntity removes entity and updates order', () => {
    addEntity(world, entity1);
    addEntity(world, entity2);
    removeEntity(world, 'e1');
    expect(world.entities['e1']).toBeUndefined();
    expect(world.order).toEqual(['e2']);
  });

  it('getEntity returns entity or undefined', () => {
    addEntity(world, entity1);
    expect(getEntity(world, 'e1')).toBe(entity1);
    expect(getEntity(world, 'e3')).toBeUndefined();
  });

  it('updateEntity updates existing entity', () => {
    addEntity(world, entity1);
    const updatedEntity = { ...entity1, kind: 'updated' };
    updateEntity(world, updatedEntity);
    expect(getEntity(world, 'e1')?.kind).toBe('updated');
  });

  it('updateEntity throws if entity does not exist', () => {
    expect(() => updateEntity(world, entity1)).toThrow(/does not exist/);
  });
});
