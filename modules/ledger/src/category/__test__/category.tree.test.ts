import { beforeEach, describe, expect, it } from 'vitest';
import { CategoryService } from '../category.service.js';
import type { CategoryNode } from '../category.types.js';
import { MockCategoryRepository } from './mocks/category.repository.mock.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import type { LedgerLogger } from '../../shared/logger.js';

// Unit: the tree rules of CAP-8 (plan S1, S3, S4, S5, S6) on the service with the in-memory
// repository and a logger that keeps its records.
const ALICE = 'alice';
const BOB = 'bob';
let repository: MockCategoryRepository;
let service: CategoryService;
let records: Record<string, unknown>[];

beforeEach(() => {
  repository = new MockCategoryRepository();
  records = [];
  const logger: LedgerLogger = { info: (record) => void records.push(record) };
  service = new CategoryService(repository, logger);
});

const add = (name: string, parentId: string | null = null, userId = ALICE) =>
  service.createCategory({ name, parentId, userId });

function attempt(run: () => unknown): Error | null {
  try {
    run();
    return null;
  } catch (err) {
    return err as Error;
  }
}

/** name -> nested names, for comparing shapes. */
type Shape = [string, Shape[]];
const shape = (nodes: CategoryNode[]): Shape[] => nodes.map((n) => [n.name, shape(n.children)]);

describe('category tree: create', () => {
  it('AC1 a category with no parentId, absent or null, is a root', () => {
    expect(service.createCategory({ name: 'Food', userId: ALICE }).parentId).toBeNull();
    expect(add('Home', null).parentId).toBeNull();
  });

  it('AC2 a category created under a root or a child gets that parentId', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    const fruit = add('Fruit', groceries.id);
    expect(groceries.parentId).toBe(food.id);
    expect(fruit.parentId).toBe(groceries.id);
  });

  it('AC3 creating under a grandchild answers maximum depth is 3 tiers and saves nothing', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    const fruit = add('Fruit', groceries.id);
    const err = attempt(() => add('Apples', fruit.id));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err?.message).toBe('maximum depth is 3 tiers');
    expect(repository.listByUser(ALICE)).toHaveLength(3);
  });

  it('AC4 a parentId that does not exist or is another user’s answers Parent category not found', () => {
    const bobs = add('Bobs', null, BOB);
    for (const parentId of ['missing', bobs.id]) {
      const err = attempt(() => add('Food', parentId));
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err?.message).toBe('Parent category not found');
    }
    expect(repository.listByUser(ALICE)).toEqual([]);
  });
});

describe('category tree: list', () => {
  it('AC5 lists only roots, children nested under them and grandchildren under those, with parentId', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    add('Fruit', groceries.id);
    add('Home');
    const tree = service.listCategories(ALICE);
    expect(shape(tree)).toEqual([
      ['Food', [['Groceries', [['Fruit', []]]]]],
      ['Home', []],
    ]);
    expect(tree[0]?.parentId).toBeNull();
    expect(tree[0]?.children[0]?.parentId).toBe(food.id);
    expect(tree[0]?.children[0]?.children[0]?.parentId).toBe(groceries.id);
  });

  it('AC6 orders every level alphabetically ignoring case and accents, reversed with -name', () => {
    add('banana');
    add('Apple');
    const cherry = add('Cherry');
    add('Zoo', cherry.id);
    add('Éclair', cherry.id);
    add('Dog', cherry.id);
    expect(shape(service.listCategories(ALICE))).toEqual([
      ['Apple', []],
      ['banana', []],
      [
        'Cherry',
        [
          ['Dog', []],
          ['Éclair', []],
          ['Zoo', []],
        ],
      ],
    ]);
    expect(shape(service.listCategories(ALICE, '-name'))).toEqual([
      [
        'Cherry',
        [
          ['Zoo', []],
          ['Éclair', []],
          ['Dog', []],
        ],
      ],
      ['banana', []],
      ['Apple', []],
    ]);
  });

  it('AC7 a user with no categories gets an empty list', () => {
    expect(service.listCategories(ALICE)).toEqual([]);
  });

  it('AC8 lists only the acting user’s categories', () => {
    add('Food');
    add('Travel', null, BOB);
    expect(shape(service.listCategories(ALICE))).toEqual([['Food', []]]);
    expect(shape(service.listCategories(BOB))).toEqual([['Travel', []]]);
  });
});

describe('category tree: move', () => {
  it('AC16 moving under another category takes the whole branch along', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    add('Fruit', groceries.id);
    const home = add('Home');
    const moved = service.updateCategory(groceries.id, { parentId: home.id, userId: ALICE });
    expect(moved.parentId).toBe(home.id);
    expect(shape(service.listCategories(ALICE))).toEqual([
      ['Food', []],
      ['Home', [['Groceries', [['Fruit', []]]]]],
    ]);
  });

  it('AC17 parentId null makes it a root and keeps its branch', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    add('Fruit', groceries.id);
    expect(
      service.updateCategory(groceries.id, { parentId: null, userId: ALICE }).parentId
    ).toBeNull();
    expect(shape(service.listCategories(ALICE))).toEqual([
      ['Food', []],
      ['Groceries', [['Fruit', []]]],
    ]);
  });

  it('AC18 a move that would put any category below tier 3 is refused and nothing moves', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    add('Fruit', groceries.id);
    const home = add('Home');
    const rent = add('Rent', home.id);
    const car = add('Car');
    const fuel = add('Fuel', car.id);
    add('Diesel', fuel.id);
    const before = shape(service.listCategories(ALICE));

    // A root with grandchildren under another root: Fruit would be tier 4.
    const deep = attempt(() =>
      service.updateCategory(food.id, { parentId: home.id, userId: ALICE })
    );
    expect(deep).toBeInstanceOf(ValidationError);
    expect(deep?.message).toBe('maximum depth is 3 tiers');
    // A child with one child under a child: its child would be tier 4.
    const underChild = attempt(() =>
      service.updateCategory(fuel.id, { parentId: rent.id, userId: ALICE })
    );
    expect(underChild?.message).toBe('maximum depth is 3 tiers');
    expect(shape(service.listCategories(ALICE))).toEqual(before);

    // The same child with one child under a root fits.
    expect(service.updateCategory(fuel.id, { parentId: home.id, userId: ALICE }).parentId).toBe(
      home.id
    );
  });

  it('AC19 moving into itself or one of its descendants is refused and nothing moves', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    const fruit = add('Fruit', groceries.id);
    const before = shape(service.listCategories(ALICE));
    for (const parentId of [food.id, groceries.id, fruit.id]) {
      const err = attempt(() => service.updateCategory(food.id, { parentId, userId: ALICE }));
      expect(err).toBeInstanceOf(ValidationError);
      expect(err?.message).toBe('a category cannot be moved into itself or its descendants');
    }
    expect(shape(service.listCategories(ALICE))).toEqual(before);
  });

  it('AC20 a new parent that does not exist or is another user’s answers Parent category not found', () => {
    const food = add('Food');
    const bobs = add('Bobs', null, BOB);
    for (const parentId of ['missing', bobs.id]) {
      const err = attempt(() => service.updateCategory(food.id, { parentId, userId: ALICE }));
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err?.message).toBe('Parent category not found');
    }
    expect(service.getCategory(food.id, ALICE).parentId).toBeNull();
  });

  it('AC21 a patch with name and parentId applies both, or neither when a rule fails', () => {
    const food = add('Food');
    const home = add('Home');
    const groceries = add('Groceries', food.id);
    const both = service.updateCategory(groceries.id, {
      name: 'Market',
      parentId: home.id,
      userId: ALICE,
    });
    expect(both).toMatchObject({ name: 'Market', parentId: home.id });

    // Valid name, invalid parent: the name is not saved either.
    expect(
      attempt(() =>
        service.updateCategory(groceries.id, {
          name: 'Shop',
          parentId: groceries.id,
          userId: ALICE,
        })
      )
    ).not.toBeNull();
    // Invalid name, valid parent: the move is not saved either.
    expect(
      attempt(() =>
        service.updateCategory(groceries.id, { name: 'Bad!', parentId: food.id, userId: ALICE })
      )
    ).not.toBeNull();
    expect(service.getCategory(groceries.id, ALICE)).toMatchObject({
      name: 'Market',
      parentId: home.id,
    });
  });
});

describe('category tree: delete', () => {
  it('AC22 deleting removes the category and all its descendants', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    add('Fruit', groceries.id);
    add('Restaurants', food.id);
    service.deleteCategory(food.id, ALICE);
    expect(service.listCategories(ALICE)).toEqual([]);
  });

  it('AC24 deleting leaves the parent, siblings and other branches unchanged', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    add('Fruit', groceries.id);
    add('Restaurants', food.id);
    add('Home');
    service.deleteCategory(groceries.id, ALICE);
    expect(shape(service.listCategories(ALICE))).toEqual([
      ['Food', [['Restaurants', []]]],
      ['Home', []],
    ]);
  });
});

describe('category tree: not found', () => {
  it('AC25 updating, moving or deleting a missing or another user’s category answers Category not found', () => {
    const bobs = add('Bobs', null, BOB);
    const home = add('Home');
    for (const id of ['missing', bobs.id]) {
      for (const run of [
        () => service.updateCategory(id, { name: 'Renamed', userId: ALICE }),
        () => service.updateCategory(id, { parentId: home.id, userId: ALICE }),
        () => service.deleteCategory(id, ALICE),
      ]) {
        const err = attempt(run);
        expect(err).toBeInstanceOf(NotFoundError);
        expect(err?.message).toBe('Category not found');
      }
    }
    expect(service.getCategory(bobs.id, BOB)).toMatchObject({ name: 'Bobs', parentId: null });
  });
});

describe('category tree: log records', () => {
  it('AC26 a create writes one category.created record', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    expect(records).toEqual([
      {
        event: 'category.created',
        userId: ALICE,
        categoryId: food.id,
        categoryName: 'Food',
        parentId: null,
      },
      {
        event: 'category.created',
        userId: ALICE,
        categoryId: groceries.id,
        categoryName: 'Groceries',
        parentId: food.id,
      },
    ]);
  });

  it('AC27 a rename writes category.renamed with the new and the previous name', () => {
    const food = add('Food');
    records.length = 0;
    service.updateCategory(food.id, { name: 'Meals', userId: ALICE });
    expect(records).toEqual([
      {
        event: 'category.renamed',
        userId: ALICE,
        categoryId: food.id,
        categoryName: 'Meals',
        previousName: 'Food',
      },
    ]);
  });

  it('AC28 a move writes category.moved; a rename and move writes both', () => {
    const food = add('Food');
    const home = add('Home');
    const groceries = add('Groceries', food.id);
    records.length = 0;
    service.updateCategory(groceries.id, { parentId: home.id, userId: ALICE });
    expect(records).toEqual([
      {
        event: 'category.moved',
        userId: ALICE,
        categoryId: groceries.id,
        categoryName: 'Groceries',
        parentId: home.id,
        previousParentId: food.id,
      },
    ]);
    records.length = 0;
    service.updateCategory(groceries.id, { name: 'Market', parentId: null, userId: ALICE });
    expect(records).toEqual([
      {
        event: 'category.renamed',
        userId: ALICE,
        categoryId: groceries.id,
        categoryName: 'Market',
        previousName: 'Groceries',
      },
      {
        event: 'category.moved',
        userId: ALICE,
        categoryId: groceries.id,
        categoryName: 'Market',
        parentId: null,
        previousParentId: home.id,
      },
    ]);
  });

  it('AC29 a description-only patch writes category.updated', () => {
    const food = add('Food');
    records.length = 0;
    service.updateCategory(food.id, { description: 'Meals', userId: ALICE });
    expect(records).toEqual([
      { event: 'category.updated', userId: ALICE, categoryId: food.id, categoryName: 'Food' },
    ]);
  });

  it('AC30 deleting a branch writes one category.deleted record per category removed', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    const fruit = add('Fruit', groceries.id);
    const restaurants = add('Restaurants', food.id);
    records.length = 0;
    service.deleteCategory(food.id, ALICE);
    expect(records).toHaveLength(4);
    expect(records).toEqual(
      expect.arrayContaining([
        { event: 'category.deleted', userId: ALICE, categoryId: food.id, categoryName: 'Food' },
        {
          event: 'category.deleted',
          userId: ALICE,
          categoryId: groceries.id,
          categoryName: 'Groceries',
        },
        { event: 'category.deleted', userId: ALICE, categoryId: fruit.id, categoryName: 'Fruit' },
        {
          event: 'category.deleted',
          userId: ALICE,
          categoryId: restaurants.id,
          categoryName: 'Restaurants',
        },
      ])
    );
  });

  it('AC31 a refused create, update, move or delete writes no record', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    const fruit = add('Fruit', groceries.id);
    records.length = 0;
    attempt(() => add('Bad!'));
    attempt(() => add('food'));
    attempt(() => add('Apples', fruit.id));
    attempt(() => service.updateCategory(food.id, { name: 'groceries', userId: ALICE }));
    attempt(() => service.updateCategory(food.id, { parentId: fruit.id, userId: ALICE }));
    attempt(() => service.updateCategory('missing', { name: 'Other', userId: ALICE }));
    attempt(() => service.deleteCategory('missing', ALICE));
    attempt(() => service.deleteCategory(food.id, BOB));
    expect(records).toEqual([]);
  });
});

describe('category tree: descendants for filters', () => {
  it('AC32 descendantIds returns the ids with every descendant of each', () => {
    const food = add('Food');
    const groceries = add('Groceries', food.id);
    const fruit = add('Fruit', groceries.id);
    add('Home');
    expect(new Set(service.descendantIds(ALICE, [food.id]))).toEqual(
      new Set([food.id, groceries.id, fruit.id])
    );
    expect(new Set(service.descendantIds(ALICE, [groceries.id]))).toEqual(
      new Set([groceries.id, fruit.id])
    );
    expect(service.descendantIds(BOB, [food.id])).toEqual([food.id]);
  });
});
