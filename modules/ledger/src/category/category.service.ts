import { NAME_TAKEN, type ICategoryRepository } from './category.repository.js';
import type { Category, CategoryNode } from './category.types.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.dto.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';
import { silentLogger, type LedgerLogger } from '../shared/logger.js';

export const MAX_DEPTH = 3;
export const MAX_NAME_LENGTH = 30;

const NAME_REQUIRED = 'name is required';
const NAME_TOO_LONG = `name must be at most ${MAX_NAME_LENGTH} characters`;
const NAME_CHARACTERS = 'name may contain only letters, digits and spaces';
const TOO_DEEP = `maximum depth is ${MAX_DEPTH} tiers`;
const INTO_OWN_BRANCH = 'a category cannot be moved into itself or its descendants';
const CATEGORY_NOT_FOUND = 'Category not found';
const PARENT_NOT_FOUND = 'Parent category not found';

const ALLOWED = /^[\p{L}\p{Nd} ]+$/u;
const collator = new Intl.Collator('en', { sensitivity: 'base' });

/** NFC, spaces trimmed, inner runs of spaces collapsed to one. */
function normaliseName(raw: unknown): string {
  if (typeof raw !== 'string') throw new ValidationError(NAME_REQUIRED);
  // Only plain spaces are trimmed; a tab or other whitespace is left for the character rule.
  const name = raw.normalize('NFC').replace(/^ +| +$/g, '').replace(/ {2,}/g, ' ');
  if (name.length === 0) throw new ValidationError(NAME_REQUIRED);
  if ([...name].length > MAX_NAME_LENGTH) throw new ValidationError(NAME_TOO_LONG);
  if (!ALLOWED.test(name)) throw new ValidationError(NAME_CHARACTERS);
  return name;
}

function nameKeyOf(name: string): string {
  return name.toLowerCase();
}

function byName(a: Category, b: Category): number {
  return collator.compare(a.name, b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

/** The user's categories indexed for walking the tree. */
class Tree {
  private byId = new Map<string, Category>();
  private childrenOf = new Map<string | null, Category[]>();

  constructor(categories: Category[]) {
    for (const c of categories) {
      this.byId.set(c.id, c);
      const siblings = this.childrenOf.get(c.parentId) ?? [];
      siblings.push(c);
      this.childrenOf.set(c.parentId, siblings);
    }
  }

  children(id: string | null): Category[] {
    return this.childrenOf.get(id) ?? [];
  }

  /** 1 for a root, 2 for a child, 3 for a grandchild. */
  depth(id: string): number {
    let depth = 0;
    let current = this.byId.get(id);
    while (current) {
      depth += 1;
      current = current.parentId ? this.byId.get(current.parentId) : undefined;
    }
    return depth;
  }

  /** The category and every descendant, parents before children. */
  branch(id: string): Category[] {
    const root = this.byId.get(id);
    if (!root) return [];
    const out: Category[] = [];
    const queue = [root];
    while (queue.length > 0) {
      const next = queue.shift() as Category;
      out.push(next);
      queue.push(...this.children(next.id));
    }
    return out;
  }

  /** Levels in the branch: 1 for a leaf, 2 with children, 3 with grandchildren. */
  height(id: string): number {
    const kids = this.children(id);
    return 1 + (kids.length === 0 ? 0 : Math.max(...kids.map((k) => this.height(k.id))));
  }
}

export class CategoryService {
  constructor(
    private repository: ICategoryRepository,
    private logger: LedgerLogger = silentLogger,
  ) {}

  createCategory(input: CreateCategoryInput & { userId: string }): Category {
    const { userId } = input;
    const name = normaliseName(input.name);
    const parentId = input.parentId ?? null;

    if (parentId !== null) {
      this.requireParent(parentId, userId);
      const tree = new Tree(this.repository.listByUser(userId));
      if (tree.depth(parentId) >= MAX_DEPTH) throw new ValidationError(TOO_DEEP);
    }

    const nameKey = nameKeyOf(name);
    if (this.repository.findByUserAndNameKey(userId, nameKey)) {
      throw new ConflictError(NAME_TAKEN);
    }

    const created = this.repository.create({
      userId,
      parentId,
      name,
      nameKey,
      description: input.description || null,
    });

    this.logger.info(
      {
        event: 'category.created',
        userId,
        categoryId: created.id,
        categoryName: created.name,
        parentId: created.parentId,
      },
      'category created',
    );
    return created;
  }

  getCategory(id: string, userId: string): Category {
    const category = this.repository.getById(id);

    if (!category || category.userId !== userId) {
      throw new NotFoundError(CATEGORY_NOT_FOUND);
    }

    return category;
  }

  /** The user's categories as a tree, every level alphabetical (reversed with `-name`). */
  listCategories(userId: string, sort?: string): CategoryNode[] {
    const descending = sort === '-name';
    const tree = new Tree(this.repository.listByUser(userId));
    const build = (parentId: string | null): CategoryNode[] => {
      const level = [...tree.children(parentId)].sort(byName);
      if (descending) level.reverse();
      return level.map((c) => ({ ...c, children: build(c.id) }));
    };
    return build(null);
  }

  /**
   * The given ids plus the ids of every descendant of the user's categories among them. Ids that
   * are not the user's categories are returned as they are.
   */
  descendantIds(userId: string, ids: readonly string[]): string[] {
    if (ids.length === 0) return [];
    const tree = new Tree(this.repository.listByUser(userId));
    const out = new Set<string>(ids);
    for (const id of ids) for (const c of tree.branch(id)) out.add(c.id);
    return [...out];
  }

  updateCategory(id: string, input: UpdateCategoryInput & { userId: string }): Category {
    const { userId } = input;
    const category = this.getCategory(id, userId);

    const patch: {
      name?: string;
      nameKey?: string;
      description?: string | null;
      parentId?: string | null;
    } = {};

    if (input.name !== undefined) {
      const name = normaliseName(input.name);
      const nameKey = nameKeyOf(name);
      const holder = this.repository.findByUserAndNameKey(userId, nameKey);
      if (holder && holder.id !== id) throw new ConflictError(NAME_TAKEN);
      patch.name = name;
      patch.nameKey = nameKey;
    }

    if (input.description !== undefined) patch.description = input.description;

    if (input.parentId !== undefined && input.parentId !== category.parentId) {
      const parentId = input.parentId;
      if (parentId !== null) {
        this.requireParent(parentId, userId);
        const tree = new Tree(this.repository.listByUser(userId));
        if (tree.branch(id).some((c) => c.id === parentId)) {
          throw new ValidationError(INTO_OWN_BRANCH);
        }
        if (tree.depth(parentId) + tree.height(id) > MAX_DEPTH) {
          throw new ValidationError(TOO_DEEP);
        }
      }
      patch.parentId = parentId;
    }

    const updated = this.repository.update(id, patch);
    if (!updated) throw new NotFoundError(CATEGORY_NOT_FOUND);

    const renamed = patch.name !== undefined && patch.name !== category.name;
    const moved = patch.parentId !== undefined;
    const described = patch.description !== undefined && patch.description !== category.description;
    const base = { userId, categoryId: id, categoryName: updated.name };
    if (renamed) {
      this.logger.info(
        { event: 'category.renamed', ...base, previousName: category.name },
        'category renamed',
      );
    }
    if (moved) {
      this.logger.info(
        {
          event: 'category.moved',
          ...base,
          parentId: updated.parentId,
          previousParentId: category.parentId,
        },
        'category moved',
      );
    }
    if (!renamed && !moved && described) {
      this.logger.info({ event: 'category.updated', ...base }, 'category updated');
    }

    return updated;
  }

  /** Deletes the category and its whole branch; their transactions become uncategorized. */
  deleteCategory(id: string, userId: string): void {
    this.getCategory(id, userId);
    const branch = new Tree(this.repository.listByUser(userId)).branch(id);

    this.repository.delete(id);

    for (const c of branch) {
      this.logger.info(
        { event: 'category.deleted', userId, categoryId: c.id, categoryName: c.name },
        'category deleted',
      );
    }
  }

  private requireParent(parentId: string, userId: string): Category {
    const parent = this.repository.getById(parentId);
    if (!parent || parent.userId !== userId) throw new NotFoundError(PARENT_NOT_FOUND);
    return parent;
  }
}
