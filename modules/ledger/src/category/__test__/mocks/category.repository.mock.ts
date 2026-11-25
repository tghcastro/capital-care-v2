import { v4 as uuidv4 } from 'uuid';
import { NAME_TAKEN, type ICategoryRepository } from '../../category.repository.js';
import type { Category } from '../../category.types.js';
import { ConflictError } from '../../../shared/errors.js';

type Stored = Category & { nameKey: string };
type CreateData = Parameters<ICategoryRepository['create']>[0];
type UpdateData = Parameters<ICategoryRepository['update']>[1];

/** In-memory stand-in for the category table, including its unique key and branch cascade. */
export class MockCategoryRepository implements ICategoryRepository {
  private categories: Map<string, Stored> = new Map();
  private callTracker = MockCategoryRepository.emptyCalls();

  private static emptyCalls() {
    return {
      create: [] as CreateData[],
      getById: [] as string[],
      listByUser: [] as string[],
      update: [] as { id: string; data: UpdateData }[],
      delete: [] as string[],
    };
  }

  private taken(userId: string, nameKey: string, except?: string): boolean {
    return [...this.categories.values()].some(
      (c) => c.userId === userId && c.nameKey === nameKey && c.id !== except,
    );
  }

  private toDomain({ nameKey: _nameKey, ...category }: Stored): Category {
    return { ...category };
  }

  create(data: CreateData): Category {
    this.callTracker.create.push(data);
    if (this.taken(data.userId, data.nameKey)) throw new ConflictError(NAME_TAKEN);
    const now = new Date();
    const stored: Stored = {
      id: uuidv4(),
      userId: data.userId,
      parentId: data.parentId,
      name: data.name,
      nameKey: data.nameKey,
      description: data.description || null,
      createdAt: now,
      updatedAt: now,
    };
    this.categories.set(stored.id, stored);
    return this.toDomain(stored);
  }

  getById(id: string): Category | null {
    this.callTracker.getById.push(id);
    const stored = this.categories.get(id);
    return stored ? this.toDomain(stored) : null;
  }

  listByUser(userId: string): Category[] {
    this.callTracker.listByUser.push(userId);
    return [...this.categories.values()]
      .filter((c) => c.userId === userId)
      .map((c) => this.toDomain(c));
  }

  update(id: string, data: UpdateData): Category | null {
    const stored = this.categories.get(id);
    if (!stored) return null;
    this.callTracker.update.push({ id, data });
    if (data.nameKey !== undefined && this.taken(stored.userId, data.nameKey, id)) {
      throw new ConflictError(NAME_TAKEN);
    }
    const defined = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    ) as Partial<Stored>;
    const updated: Stored = { ...stored, ...defined, updatedAt: new Date() };
    this.categories.set(id, updated);
    return this.toDomain(updated);
  }

  delete(id: string): boolean {
    this.callTracker.delete.push(id);
    if (!this.categories.has(id)) return false;
    // ON DELETE CASCADE on parentId.
    const doomed = [id];
    for (let i = 0; i < doomed.length; i++) {
      for (const c of this.categories.values()) if (c.parentId === doomed[i]) doomed.push(c.id);
    }
    for (const each of doomed) this.categories.delete(each);
    return true;
  }

  findByUserAndNameKey(userId: string, nameKey: string): Category | null {
    const found = [...this.categories.values()].find(
      (c) => c.userId === userId && c.nameKey === nameKey,
    );
    return found ? this.toDomain(found) : null;
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
    this.categories.set(category.id, { ...category, nameKey: category.name.toLowerCase() });
  }
}
