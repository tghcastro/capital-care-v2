import { beforeEach, describe, expect, it } from 'vitest';
import { CategoryService } from '../category.service.js';
import { MockCategoryRepository } from './mocks/category.repository.mock.js';
import { ConflictError, ValidationError } from '../../shared/errors.js';

// Unit: the name rules of CAP-8 (plan S2), on the service with the in-memory repository.
let repository: MockCategoryRepository;
let service: CategoryService;

beforeEach(() => {
  repository = new MockCategoryRepository();
  service = new CategoryService(repository);
});

function createError(name: unknown, userId = 'alice'): Error | null {
  try {
    service.createCategory({ name, userId });
    return null;
  } catch (err) {
    return err as Error;
  }
}

function expectRefused(
  err: Error | null,
  type: typeof ValidationError | typeof ConflictError,
  detail: string
) {
  expect(err).toBeInstanceOf(type);
  expect(err?.message).toBe(detail);
}

describe('category names', () => {
  it('AC9 stores the name normalised: trimmed, inner spaces collapsed, NFC', () => {
    expect(service.createCategory({ name: '  Food   Out ', userId: 'alice' }).name).toBe(
      'Food Out'
    );
    const decomposed = 'Saúde';
    expect(service.createCategory({ name: decomposed, userId: 'alice' }).name).toBe('Saúde');
  });

  it('AC10 a missing, non-string or blank name on create answers name is required', () => {
    for (const name of [undefined, null, 42, '', '    ']) {
      expectRefused(createError(name), ValidationError, 'name is required');
    }
    expect(repository.listByUser('alice')).toEqual([]);
  });

  it('AC10 on update an absent name keeps it and an empty one answers name is required', () => {
    const food = service.createCategory({ name: 'Food', userId: 'alice' });
    expect(service.updateCategory(food.id, { description: 'Meals', userId: 'alice' }).name).toBe(
      'Food'
    );
    expect(() => service.updateCategory(food.id, { name: '  ', userId: 'alice' })).toThrow(
      new ValidationError('name is required')
    );
    expect(service.getCategory(food.id, 'alice').name).toBe('Food');
  });

  it('AC11 accepts 30 characters and refuses 31, counting characters not bytes', () => {
    expect(createError('a'.repeat(30))).toBeNull();
    expect(createError('é'.repeat(30))).toBeNull();
    expectRefused(
      createError('b'.repeat(31)),
      ValidationError,
      'name must be at most 30 characters'
    );
    expectRefused(
      createError(`${'c'.repeat(15)}   ${'d'.repeat(15)}`),
      ValidationError,
      'name must be at most 30 characters'
    );
  });

  it('AC11 the length rule applies to a rename', () => {
    const food = service.createCategory({ name: 'Food', userId: 'alice' });
    expect(() =>
      service.updateCategory(food.id, { name: 'x'.repeat(31), userId: 'alice' })
    ).toThrow(new ValidationError('name must be at most 30 characters'));
  });

  it('AC12 accepts letters with accents, digits and spaces and refuses anything else', () => {
    expect(createError('Saúde 2')).toBeNull();
    expect(createError('Educação')).toBeNull();
    for (const name of [
      'Food & Drinks',
      'Car-Fuel',
      'Tab\tName',
      'Line\nBreak',
      'Emoji \u{1F600}',
      'Sq²',
    ]) {
      expectRefused(
        createError(name),
        ValidationError,
        'name may contain only letters, digits and spaces'
      );
    }
  });

  it('AC9 AC12 a tab, newline or no-break space at either end is refused, not trimmed', () => {
    for (const name of ['Food\t', '\nFood', '\u00a0Food', 'Food\u00a0', 'Food\r\n']) {
      expectRefused(
        createError(name),
        ValidationError,
        'name may contain only letters, digits and spaces'
      );
    }
    expect(repository.listByUser('alice')).toEqual([]);
  });

  it('AC12 the character rule applies to a rename', () => {
    const food = service.createCategory({ name: 'Food', userId: 'alice' });
    expect(() => service.updateCategory(food.id, { name: 'Food!', userId: 'alice' })).toThrow(
      new ValidationError('name may contain only letters, digits and spaces')
    );
  });

  it('AC13 a name taken in any letter case anywhere in the tree answers name is taken', () => {
    const car = service.createCategory({ name: 'Car', userId: 'alice' });
    const costs = service.createCategory({ name: 'Costs', parentId: car.id, userId: 'alice' });
    service.createCategory({ name: 'Fuel', parentId: costs.id, userId: 'alice' });
    service.createCategory({ name: 'Saúde', userId: 'alice' });

    expectRefused(createError('FUEL'), ConflictError, 'name is taken');
    expectRefused(createError('SAÚDE'), ConflictError, 'name is taken');
    expectRefused(createError('  fuel '), ConflictError, 'name is taken');
    expect(repository.listByUser('alice')).toHaveLength(4);
    expect(createError('Fuel', 'bob')).toBeNull();
  });

  it('AC13 renaming to a name another category holds answers name is taken', () => {
    service.createCategory({ name: 'Fuel', userId: 'alice' });
    const food = service.createCategory({ name: 'Food', userId: 'alice' });
    expect(() => service.updateCategory(food.id, { name: 'fUEL', userId: 'alice' })).toThrow(
      new ConflictError('name is taken')
    );
    expect(service.getCategory(food.id, 'alice').name).toBe('Food');
  });

  it('AC14 renaming to its own name, or to it in another letter case, is accepted', () => {
    const food = service.createCategory({ name: 'Food', userId: 'alice' });
    expect(service.updateCategory(food.id, { name: 'Food', userId: 'alice' }).name).toBe('Food');
    expect(service.updateCategory(food.id, { name: 'FOOD', userId: 'alice' }).name).toBe('FOOD');
  });

  it('AC15 the description keeps its rule and is not checked against the name rules', () => {
    const food = service.createCategory({
      name: 'Food',
      description: 'Meals & snacks!',
      userId: 'alice',
    });
    expect(food.description).toBe('Meals & snacks!');
  });
});
