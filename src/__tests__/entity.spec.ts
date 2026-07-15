import {
  Entity,
  getComponent,
  hasComponent,
  setComponent,
  removeComponent,
  withComponent,
  withoutComponent,
} from '../entity';

describe('Entity helpers', () => {
  let entity: Entity;

  beforeEach(() => {
    entity = {
      id: 'e1',
      kind: 'actor',
      components: {
        health: { current: 100 },
      },
    };
  });

  it('getComponent should return the component if it exists', () => {
    expect(getComponent(entity, 'health')).toEqual({ current: 100 });
    expect(getComponent(entity, 'position')).toBeUndefined();
  });

  it('hasComponent should return true if the component exists', () => {
    expect(hasComponent(entity, 'health')).toBe(true);
    expect(hasComponent(entity, 'position')).toBe(false);
  });

  it('setComponent should mutate the entity to add/update a component', () => {
    setComponent(entity, 'position', { x: 10, y: 20 });
    expect(hasComponent(entity, 'position')).toBe(true);
    expect(getComponent(entity, 'position')).toEqual({ x: 10, y: 20 });

    setComponent(entity, 'health', { current: 50 });
    expect(getComponent(entity, 'health')).toEqual({ current: 50 });
  });

  it('removeComponent should mutate the entity to remove a component', () => {
    removeComponent(entity, 'health');
    expect(hasComponent(entity, 'health')).toBe(false);
    expect(getComponent(entity, 'health')).toBeUndefined();
  });

  it('withComponent should return a new entity with the added component', () => {
    const newEntity = withComponent(entity, 'position', { x: 10, y: 20 });
    expect(hasComponent(newEntity, 'position')).toBe(true);
    expect(hasComponent(entity, 'position')).toBe(false); // original is unchanged
  });

  it('withoutComponent should return a new entity without the component', () => {
    const newEntity = withoutComponent(entity, 'health');
    expect(hasComponent(newEntity, 'health')).toBe(false);
    expect(hasComponent(entity, 'health')).toBe(true); // original is unchanged
  });
});
