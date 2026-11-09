import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryService } from '../category.service.js';
import { MockCategoryRepository } from './mocks/category.repository.mock.js';
import { NotFoundError } from '../../shared/errors.js';

let service: CategoryService;
let repository: MockCategoryRepository;

beforeEach(() => {
  repository = new MockCategoryRepository();
  service = new CategoryService(repository);
});

describe('Category Update', () => {
  it('PATCH updates name only PASS', () => {
    const cat = service.createCategory({
      name: 'Groceries',
      description: 'Food',
      userId: 'user1',
    });

    const updated = service.updateCategory(cat.id, {
      name: 'New Groceries',
      userId: 'user1',
    });

    expect(updated.name).toBe('New Groceries');
    expect(updated.description).toBe('Food');
  });

  it('PATCH updates description only PASS', () => {
    const cat = service.createCategory({
      name: 'Groceries',
      description: 'Food',
      userId: 'user1',
    });

    const updated = service.updateCategory(cat.id, {
      description: 'Vegetables and fruits',
      userId: 'user1',
    });

    expect(updated.name).toBe('Groceries');
    expect(updated.description).toBe('Vegetables and fruits');
  });

  it('PATCH with empty object returns unchanged PASS', () => {
    const cat = service.createCategory({
      name: 'Groceries',
      userId: 'user1',
    });

    const updated = service.updateCategory(cat.id, {
      userId: 'user1',
    });

    expect(updated.name).toBe('Groceries');
    expect(updated.id).toBe(cat.id);
  });

  it('PATCH unowned category returns 404 PASS', () => {
    const cat = service.createCategory({
      name: 'Groceries',
      userId: 'user1',
    });

    expect(() => {
      service.updateCategory(cat.id, {
        name: 'New Name',
        userId: 'user2',
      });
    }).toThrow(NotFoundError);
  });
});
