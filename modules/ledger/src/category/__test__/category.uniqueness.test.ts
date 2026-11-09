import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryService } from '../category.service.js';
import { MockCategoryRepository } from './mocks/category.repository.mock.js';
import { ConflictError } from '../../shared/errors.js';

let service: CategoryService;
let repository: MockCategoryRepository;

beforeEach(() => {
  repository = new MockCategoryRepository();
  service = new CategoryService(repository);
});

describe('Category Uniqueness', () => {
  it('PATCH rename collision returns 409 PASS', () => {
    const cat1 = service.createCategory({
      name: 'Groceries',
      userId: 'user1',
    });

    service.createCategory({
      name: 'Food',
      userId: 'user1',
    });

    expect(() => {
      service.updateCategory(cat1.id, {
        name: 'Food',
        userId: 'user1',
      });
    }).toThrow(ConflictError);
  });
});
