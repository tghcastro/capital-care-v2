import { v4 as uuidv4 } from 'uuid';
import type { ICategoryRepository } from '../category.repository.js';
import type { Category } from '../category.types.js';

export class MockCategoryRepository implements ICategoryRepository {
  private categories: Map<string, Category> = new Map();
  private callTracker = MockCategoryRepository.emptyCalls();

  private static emptyCalls() {
    return {
      create: [] as { userId: string; name: string; description: string | null }[],
      getById: [] as string[],
      listByUser: [] as { userId: string; sort: 'name' | '-name' }[],
      update: [] as { id: string; data: { name?: string; description?: string | null } }[],
      delete: [] as string[],
    };
  }

  create(data: {
    userId: string;
    name: string;
    description: string | null;
  }): Category {
    const id = uuidv4();
    const now = new Date();

    const category: Category = {
      id,
      userId: data.userId,
      name: data.name,
      description: data.description || null,
      createdAt: now,
      updatedAt: now,
    };

    this.categories.set(id, category);
    this.callTracker.create.push(data);
    return category;
  }

  getById(id: string): Category | null {
    this.callTracker.getById.push(id);
    return this.categories.get(id) || null;
  }

  listByUser(userId: string, sort: 'name' | '-name' = 'name'): Category[] {
    this.callTracker.listByUser.push({ userId, sort });
    const filtered = Array.from(this.categories.values()).filter(
      (c) => c.userId === userId,
    );

    if (sort === 'name') {
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      return filtered.sort((a, b) => b.name.localeCompare(a.name));
    }
  }

  update(
    id: string,
    data: { name?: string; description?: string | null },
  ): Category | null {
    const category = this.categories.get(id);
    if (!category) return null;

    const updated: Category = {
      ...category,
      ...data,
      updatedAt: new Date(),
    };

    this.categories.set(id, updated);
    this.callTracker.update.push({ id, data });
    return updated;
  }

  delete(id: string): boolean {
    this.callTracker.delete.push(id);
    return this.categories.delete(id);
  }

  countByUserAndName(userId: string, name: string): number {
    return Array.from(this.categories.values()).filter(
      (c) => c.userId === userId && c.name === name,
    ).length;
  }

  hasTransactions(_categoryId: string): boolean {
    return false;
  }

  // Test helpers
  getCalls() {
    return this.callTracker;
  }

  reset() {
    this.categories.clear();
    this.callTracker = MockCategoryRepository.emptyCalls();
  }

  addCategory(category: Category) {
    this.categories.set(category.id, category);
  }
}
