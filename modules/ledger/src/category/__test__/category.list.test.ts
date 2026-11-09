import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryService } from '../category.service.js';
import { MockCategoryRepository } from './mocks/category.repository.mock.js';

let service: CategoryService;
let repository: MockCategoryRepository;

beforeEach(() => {
  repository = new MockCategoryRepository();
  service = new CategoryService(repository);
});

describe('Category List', () => {
  it('GET /categories returns all user categories sorted by name asc PASS', () => {
    service.createCategory({ name: 'Zebra', userId: 'user1' });
    service.createCategory({ name: 'Apple', userId: 'user1' });
    service.createCategory({ name: 'Mango', userId: 'user1' });

    const result = service.listCategories('user1', 'name');

    expect(result).toHaveLength(3);
    expect(result[0]?.name).toBe('Apple');
    expect(result[1]?.name).toBe('Mango');
    expect(result[2]?.name).toBe('Zebra');
  });

  it('GET /categories?sort=-name sorts descending PASS', () => {
    service.createCategory({ name: 'Apple', userId: 'user1' });
    service.createCategory({ name: 'Zebra', userId: 'user1' });

    const result = service.listCategories('user1', '-name');

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('Zebra');
    expect(result[1]?.name).toBe('Apple');
  });

  it('GET /categories with no categories returns empty array PASS', () => {
    const result = service.listCategories('user1', 'name');
    expect(result).toEqual([]);
  });
});
