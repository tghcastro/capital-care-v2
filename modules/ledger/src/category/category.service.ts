import type { CategoryRepository } from './category.repository.js';
import type { Category } from './category.types.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.dto.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';

export class CategoryService {
  constructor(private repository: CategoryRepository) {}

  createCategory(input: CreateCategoryInput & { userId: string }): Category {
    const { name, description, userId } = input;

    if (!name || name.trim().length === 0) {
      throw new ValidationError('name is required');
    }

    if (name.length > 255) {
      throw new ValidationError('name must not exceed 255 characters');
    }

    const existing = this.repository.countByUserAndName(userId, name);
    if (existing > 0) {
      throw new ConflictError('A category with this name already exists for this user');
    }

    return this.repository.create({
      userId,
      name,
      description: description || null,
    });
  }

  getCategory(id: string, userId: string): Category {
    const category = this.repository.getById(id);

    if (!category || category.userId !== userId) {
      throw new NotFoundError('Category not found');
    }

    return category;
  }

  listCategories(userId: string, sort?: string): Category[] {
    const sortParam = sort === '-name' ? '-name' : 'name';
    return this.repository.listByUser(userId, sortParam);
  }

  updateCategory(
    id: string,
    input: UpdateCategoryInput & { userId: string },
  ): Category {
    const { userId, ...updateData } = input as { userId: string; name?: string; description?: string | null };

    const category = this.repository.getById(id);
    if (!category || category.userId !== userId) {
      throw new NotFoundError('Category not found');
    }

    if (updateData.name && updateData.name.length > 255) {
      throw new ValidationError('name must not exceed 255 characters');
    }

    if (updateData.description && updateData.description.length > 500) {
      throw new ValidationError('description must not exceed 500 characters');
    }

    if (updateData.name && updateData.name !== category.name) {
      const existing = this.repository.countByUserAndName(userId, updateData.name);
      if (existing > 0) {
        throw new ConflictError('A category with this name already exists for this user');
      }
    }

    const updated = this.repository.update(id, updateData);
    if (!updated) {
      throw new NotFoundError('Category not found');
    }

    return updated;
  }

  deleteCategory(id: string, userId: string): void {
    const category = this.repository.getById(id);
    if (!category || category.userId !== userId) {
      throw new NotFoundError('Category not found');
    }

    if (this.repository.hasTransactions(id)) {
      throw new ConflictError(
        'Cannot delete a category with transactions. Reassign or delete transactions first.',
      );
    }

    this.repository.delete(id);
  }
}
