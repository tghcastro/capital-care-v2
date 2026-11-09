import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryService } from '../category.service.js';
import { MockCategoryRepository } from './mocks/category.repository.mock.js';
import { ValidationError, ConflictError } from '../../shared/errors.js';

let service: CategoryService;
let repository: MockCategoryRepository;

beforeEach(() => {
  repository = new MockCategoryRepository();
  service = new CategoryService(repository);
});

describe('Category Create', () => {
  it('create with name only PASS', () => {
    const result = service.createCategory({
      name: 'Groceries',
      userId: 'user1',
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Groceries');
    expect(result.description).toBeNull();
    expect(result.userId).toBe('user1');
  });

  it('create with name and description PASS', () => {
    const result = service.createCategory({
      name: 'Utilities',
      description: 'Electric, gas, water',
      userId: 'user1',
    });

    expect(result.name).toBe('Utilities');
    expect(result.description).toBe('Electric, gas, water');
  });

  it('timestamps serialized as ISO 8601 PASS', () => {
    const result = service.createCategory({
      name: 'Groceries',
      userId: 'user1',
    });

    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    expect(result.createdAt.toISOString()).toMatch(isoRegex);
    expect(result.updatedAt.toISOString()).toMatch(isoRegex);
  });

  it('create without name returns 400 PASS', () => {
    expect(() => {
      service.createCategory({
        name: '',
        userId: 'user1',
      });
    }).toThrow(ValidationError);
  });

  it('create with name > 255 chars returns 400 PASS', () => {
    const longName = 'a'.repeat(256);
    expect(() => {
      service.createCategory({
        name: longName,
        userId: 'user1',
      });
    }).toThrow(ValidationError);
  });

  it('user cannot create duplicate name PASS', () => {
    service.createCategory({
      name: 'Groceries',
      userId: 'user1',
    });

    expect(() => {
      service.createCategory({
        name: 'Groceries',
        userId: 'user1',
      });
    }).toThrow(ConflictError);
  });

  it('different users can share name PASS', () => {
    service.createCategory({
      name: 'Groceries',
      userId: 'user1',
    });

    const result = service.createCategory({
      name: 'Groceries',
      userId: 'user2',
    });

    expect(result.userId).toBe('user2');
    expect(result.name).toBe('Groceries');
  });
});
