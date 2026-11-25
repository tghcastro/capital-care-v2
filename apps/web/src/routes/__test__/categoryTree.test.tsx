import type { Category } from '@capital-care/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../mocks/server';
import { mockApi, occ, renderPage, type ApiState } from './testkit';

// Component: the category tree on the transactions page (plan S8), with the API answered by MSW.
const node = (
  id: string,
  name: string,
  parentId: string | null,
  children: Category[] = []
): Category => ({
  id,
  name,
  description: null,
  parentId,
  children,
});

/** Food > Groceries > Fruit, Food > Restaurants; Home; as GET /categories answers. */
const tree = (): Category[] => [
  node('food', 'Food', null, [
    node('groceries', 'Groceries', 'food', [node('fruit', 'Fruit', 'groceries')]),
    node('restaurants', 'Restaurants', 'food'),
  ]),
  node('home', 'Home', null),
];

const rows = () => [
  occ({ transactionId: 't1', description: 'Lunch', categoryId: 'restaurants' }),
  occ({ transactionId: 't2', description: 'Apples', categoryId: 'fruit' }),
  occ({ transactionId: 't3', description: 'Rent', categoryId: 'home' }),
];

async function panel(): Promise<HTMLElement> {
  await screen.findByText('Lunch');
  const region = screen.getByRole('region', { name: 'Categories' });
  await within(region).findByRole('button', { name: 'Food' });
  return region;
}

/** The category names in the panel, top to bottom, with each row's indent class. */
function listed(region: HTMLElement): [string, string][] {
  return within(region)
    .getAllByRole('button', { pressed: false })
    .concat(within(region).queryAllByRole('button', { pressed: true }))
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((b) => [b.textContent ?? '', b.closest('li')?.className.match(/pl-\d+/)?.[0] ?? '']);
}

function record(api: ApiState, method: string, url: string, body: unknown) {
  api.requests.push({ method, url, userId: 'alice', body });
}

describe('category tree panel', () => {
  it('AC34 AC35 shows Uncategorized, then roots expanded with indented children and children collapsed', async () => {
    mockApi({ occurrences: rows(), categories: tree() });
    renderPage();
    const region = await panel();
    expect(listed(region)).toEqual([
      ['Uncategorized', ''],
      ['Food', ''],
      ['Groceries', 'pl-6'],
      ['Restaurants', 'pl-6'],
      ['Home', ''],
    ]);
    expect(within(region).getByRole('button', { name: 'Collapse Food' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(within(region).getByRole('button', { name: 'Expand Groceries' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(within(region).queryByRole('button', { name: /Expand Home|Collapse Home/ })).toBeNull();
  });

  it('AC35 the toggle shows and hides a category’s children', async () => {
    mockApi({ occurrences: rows(), categories: tree() });
    renderPage();
    const region = await panel();
    const u = userEvent.setup();
    await u.click(within(region).getByRole('button', { name: 'Expand Groceries' }));
    expect(within(region).getByRole('button', { name: 'Fruit' }).closest('li')).toHaveClass(
      'pl-12'
    );
    expect(within(region).getByRole('button', { name: 'Collapse Groceries' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await u.click(within(region).getByRole('button', { name: 'Collapse Food' }));
    expect(within(region).queryByRole('button', { name: 'Groceries' })).toBeNull();
    expect(within(region).queryByRole('button', { name: 'Fruit' })).toBeNull();
    expect(within(region).getByRole('button', { name: 'Expand Food' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('AC36 clicking a category filters by it and the list shows what the API returns for that branch', async () => {
    const api = mockApi({ occurrences: rows(), categories: tree() });
    renderPage();
    const region = await panel();
    // The API includes descendants (AC 32); here MSW stands in for it.
    server.use(
      http.get('/transactions', ({ request }) => {
        const selected = new URL(request.url).searchParams.getAll('category');
        record(api, 'GET', new URL(request.url).pathname + new URL(request.url).search, undefined);
        return HttpResponse.json({
          occurrences: selected.includes('food') ? rows().slice(0, 2) : rows(),
        });
      })
    );
    await userEvent.setup().click(within(region).getByRole('button', { name: 'Food' }));
    await waitFor(() => expect(screen.queryByText('Rent')).toBeNull());
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Apples')).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Food' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      api.requests.some(
        (r) => r.url.startsWith('/transactions?') && r.url.includes('category=food')
      )
    ).toBe(true);
  });

  it('AC37 Add with a Parent creates it under that parent and shows it nested, parent expanded', async () => {
    const api = mockApi({ occurrences: rows(), categories: tree() });
    server.use(
      http.post('/categories', async ({ request }) => {
        const body = (await request.json()) as { name: string; parentId?: string | null };
        record(api, 'POST', '/categories', body);
        const fresh = node('nuts', body.name, body.parentId ?? null);
        const groceries = api.categories[0]?.children?.[0];
        groceries?.children?.push(fresh);
        api.categories = [...api.categories];
        return HttpResponse.json(fresh, { status: 201 });
      })
    );
    renderPage();
    const region = await panel();
    const u = userEvent.setup();
    await u.click(within(region).getByRole('button', { name: 'Add category' }));
    const dialog = screen.getByRole('dialog', { name: 'Add category' });
    const parent = within(dialog).getByLabelText('Parent');
    expect(parent).toHaveValue('');
    expect(
      within(parent)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual([
      'None (top level)',
      'Food',
      '    Groceries',
      '        Fruit',
      '    Restaurants',
      'Home',
    ]);
    await u.type(within(dialog).getByLabelText('Name'), 'Nuts');
    await u.selectOptions(parent, 'groceries');
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    const nuts = await within(region).findByRole('button', { name: 'Nuts' });
    expect(nuts.closest('li')).toHaveClass('pl-12');
    expect(within(region).getByRole('button', { name: 'Collapse Groceries' })).toBeInTheDocument();
    expect(api.requests.find((r) => r.method === 'POST')?.body).toEqual({
      name: 'Nuts',
      parentId: 'groceries',
    });
  });

  it('AC37 Add with None (top level) sends no parentId', async () => {
    const api = mockApi({ occurrences: rows(), categories: tree() });
    server.use(
      http.post('/categories', async ({ request }) => {
        const body = await request.json();
        record(api, 'POST', '/categories', body);
        return HttpResponse.json(node('travel', 'Travel', null), { status: 201 });
      })
    );
    renderPage();
    const region = await panel();
    const u = userEvent.setup();
    await u.click(within(region).getByRole('button', { name: 'Add category' }));
    const dialog = screen.getByRole('dialog', { name: 'Add category' });
    await u.type(within(dialog).getByLabelText('Name'), 'Travel');
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.requests.find((r) => r.method === 'POST')?.body).toEqual({ name: 'Travel' })
    );
  });

  it('AC38 Edit with another Parent moves it and shows its branch in the new place', async () => {
    const api = mockApi({ occurrences: rows(), categories: tree() });
    server.use(
      http.patch('/categories/groceries', async ({ request }) => {
        const body = (await request.json()) as { parentId?: string | null };
        record(api, 'PATCH', '/categories/groceries', body);
        const [food, home] = tree();
        const groceries = food?.children?.[0] as Category;
        api.categories = [
          { ...(food as Category), children: food?.children?.slice(1) ?? [] },
          { ...(home as Category), children: [{ ...groceries, parentId: 'home' }] },
        ];
        return HttpResponse.json({ ...groceries, parentId: 'home' });
      })
    );
    renderPage();
    const region = await panel();
    const u = userEvent.setup();
    await u.click(within(region).getByRole('button', { name: 'Edit Groceries' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit category' });
    const parent = within(dialog).getByLabelText('Parent');
    expect(parent).toHaveValue('food');
    expect(
      within(parent)
        .getAllByRole('option')
        .map((o) => o.textContent?.trim())
    ).toEqual(['None (top level)', 'Food', 'Fruit', 'Restaurants', 'Home']);
    await u.selectOptions(parent, 'home');
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(listed(region)).toEqual([
        ['Uncategorized', ''],
        ['Food', ''],
        ['Restaurants', 'pl-6'],
        ['Home', ''],
        ['Groceries', 'pl-6'],
      ])
    );
    await u.click(within(region).getByRole('button', { name: 'Expand Groceries' }));
    expect(within(region).getByRole('button', { name: 'Fruit' }).closest('li')).toHaveClass(
      'pl-12'
    );
    expect(api.requests.find((r) => r.method === 'PATCH')?.body).toEqual({
      name: 'Groceries',
      description: null,
      parentId: 'home',
    });
  });

  it('AC38 Edit to None (top level) sends parentId null', async () => {
    const api = mockApi({ occurrences: rows(), categories: tree() });
    server.use(
      http.patch('/categories/groceries', async ({ request }) => {
        const body = await request.json();
        record(api, 'PATCH', '/categories/groceries', body);
        return HttpResponse.json(node('groceries', 'Groceries', null));
      })
    );
    renderPage();
    const region = await panel();
    const u = userEvent.setup();
    await u.click(within(region).getByRole('button', { name: 'Edit Groceries' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit category' });
    await u.selectOptions(within(dialog).getByLabelText('Parent'), '');
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.requests.find((r) => r.method === 'PATCH')?.body).toEqual({
        name: 'Groceries',
        description: null,
        parentId: null,
      })
    );
  });

  it('AC39 a refused save keeps the dialog open with the API detail', async () => {
    mockApi({ occurrences: rows(), categories: tree() });
    server.use(
      http.post('/categories', () =>
        HttpResponse.json(
          { type: 'ValidationError', detail: 'maximum depth is 3 tiers' },
          { status: 400 }
        )
      )
    );
    renderPage();
    const region = await panel();
    const u = userEvent.setup();
    await u.click(within(region).getByRole('button', { name: 'Add category' }));
    const dialog = screen.getByRole('dialog', { name: 'Add category' });
    await u.type(within(dialog).getByLabelText('Name'), 'Apples');
    await u.selectOptions(within(dialog).getByLabelText('Parent'), 'fruit');
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('maximum depth is 3 tiers');
    expect(screen.getByRole('dialog', { name: 'Add category' })).toBeInTheDocument();
  });

  it('AC40 AC42 deleting a branch shows the count, Cancel removes nothing, Delete removes it and clears the filter', async () => {
    const api = mockApi({ occurrences: rows(), categories: tree() });
    let deletes = 0;
    server.use(
      http.delete('/categories/food', () => {
        deletes += 1;
        api.categories = api.categories.filter((c) => c.id !== 'food');
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderPage();
    const region = await panel();
    const u = userEvent.setup();
    await u.click(within(region).getByRole('button', { name: 'Restaurants' }));
    await waitFor(() =>
      expect(api.requests.some((r) => r.url.includes('category=restaurants'))).toBe(true)
    );

    await u.click(within(region).getByRole('button', { name: 'Delete Food' }));
    let dialog = screen.getByRole('dialog', { name: 'Delete Food?' });
    expect(dialog).toHaveTextContent(
      'This permanently removes 4 categories: Food and its 3 subcategories. Their transactions become uncategorized.'
    );
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(deletes).toBe(0);
    expect(within(region).getByRole('button', { name: 'Food' })).toBeInTheDocument();

    await u.click(within(region).getByRole('button', { name: 'Delete Food' }));
    dialog = screen.getByRole('dialog', { name: 'Delete Food?' });
    await u.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(within(region).queryByRole('button', { name: 'Food' })).toBeNull());
    expect(deletes).toBe(1);
    expect(within(region).queryByRole('button', { name: 'Restaurants' })).toBeNull();
    await waitFor(() => {
      const last = api.requests.filter((r) => r.url.startsWith('/transactions?')).at(-1);
      expect(last?.url).not.toContain('category=');
    });
  });

  it('AC41 deleting a category with no descendants shows the single-category text', async () => {
    mockApi({ occurrences: rows(), categories: tree() });
    server.use(http.delete('/categories/home', () => new HttpResponse(null, { status: 204 })));
    renderPage();
    const region = await panel();
    const u = userEvent.setup();
    await u.click(within(region).getByRole('button', { name: 'Delete Home' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Home?' });
    expect(dialog).toHaveTextContent(
      'This permanently removes this category. Its transactions become uncategorized.'
    );
    await u.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('category picker and rows', () => {
  it('AC43 the quick-add Category select lists the tree in order, indented, and any tier can be picked', async () => {
    const api = mockApi({ occurrences: rows(), categories: tree() });
    server.use(
      http.post('/transactions', async ({ request }) => {
        record(api, 'POST', '/transactions', await request.json());
        return HttpResponse.json({}, { status: 201 });
      })
    );
    renderPage();
    await panel();
    const form = screen.getByRole('form', { name: 'Quick add transaction' });
    const select = within(form).getByLabelText('Category');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Select…', 'Food', '    Groceries', '        Fruit', '    Restaurants', 'Home']);
    const u = userEvent.setup();
    await u.type(within(form).getByLabelText('Description'), 'Bananas');
    await u.type(within(form).getByLabelText('Amount'), '3');
    await u.selectOptions(select, 'fruit');
    await u.selectOptions(within(form).getByLabelText('Account'), 'a1');
    await u.click(within(form).getByRole('button', { name: /add/i }));
    await waitFor(() =>
      expect(api.requests.find((r) => r.method === 'POST')?.body).toMatchObject({
        categoryId: 'fruit',
      })
    );
  });

  it('AC44 transaction rows show the category name at any tier', async () => {
    mockApi({ occurrences: rows(), categories: tree() });
    renderPage();
    await panel();
    const list = screen.getByRole('region', { name: 'Transactions' });
    expect(within(list).getByText('Fruit')).toBeInTheDocument();
    expect(within(list).getByText('Restaurants')).toBeInTheDocument();
    expect(within(list).getByText('Home')).toBeInTheDocument();
  });
});
