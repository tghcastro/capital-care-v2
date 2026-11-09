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

describe('Category Delete', () => {
  it('DELETE removes category with no transactions PASS', () => {
    const cat = service.createCategory({
      name: 'Groceries',
      userId: 'user1',
    });

    service.deleteCategory(cat.id, 'user1');

    expect(() => {
      service.getCategory(cat.id, 'user1');
    }).toThrow(NotFoundError);
  });

  it('DELETE unowned category returns 404 PASS', () => {
    const cat = service.createCategory({
      name: 'Groceries',
      userId: 'user1',
    });

    expect(() => {
      service.deleteCategory(cat.id, 'user2');
    }).toThrow(NotFoundError);
  });
});
