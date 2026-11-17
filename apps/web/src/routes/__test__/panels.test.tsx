import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../mocks/server';
import { mockApi, occ, renderPage } from './testkit';

interface Kind {
  panel: string; // describe name
  region: string; // section label
  noun: string; // "category" | "account"
  path: string; // API path
  none: string;
  first: string; // alphabetically first real item
  second: string;
  firstId: string;
  filterTarget: string; // item whose selection filters rows
  keepRow: string; // row description that stays
  dropRow: string; // row description that goes
}

const kinds: Kind[] = [
  {
    panel: 'categories panel',
    region: 'Categories',
    noun: 'category',
    path: '/categories',
    none: 'Uncategorized',
    first: 'Food',
    second: 'Salary',
    firstId: 'c1',
    filterTarget: 'Food',
    keepRow: 'Lunch',
    dropRow: 'Pay',
  },
  {
    panel: 'accounts panel',
    region: 'Accounts',
    noun: 'account',
    path: '/accounts',
    none: 'Unassigned',
    first: 'Checking',
    second: 'Savings',
    firstId: 'a1',
    filterTarget: 'Checking',
    keepRow: 'Lunch',
    dropRow: 'Pay',
  },
];

const rows = () => [
  occ({ description: 'Lunch', categoryId: 'c1', accountId: 'a1' }),
  occ({
    transactionId: 't2',
    description: 'Pay',
    type: 'receipt',
    categoryId: 'c2',
    accountId: 'a2',
  }),
];

async function panelOf(k: Kind): Promise<HTMLElement> {
  await screen.findByText('Lunch');
  return screen.getByRole('region', { name: k.region });
}

describe('categories panel description', () => {
  it('Edit sends null when the description is cleared', async () => {
    const api = mockApi({
      occurrences: rows(),
      categories: [{ id: 'c1', name: 'Food', description: 'Meals' }],
    });
    server.use(
      http.patch('/categories/c1', async ({ request }) => {
        api.requests.push({
          method: 'PATCH',
          url: '/categories/c1',
          userId: 'alice',
          body: await request.json(),
        });
        return HttpResponse.json({ id: 'c1', name: 'Food', description: null });
      })
    );
    renderPage();
    const panel = await panelOf(kinds[0] as Kind);
    const u = userEvent.setup();
    await u.click(await within(panel).findByRole('button', { name: 'Edit Food' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit category' });
    expect(within(dialog).getByLabelText('Description')).toHaveValue('Meals');
    await u.clear(within(dialog).getByLabelText('Description'));
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.requests.some((r) => r.method === 'PATCH')).toBe(true));
    expect(api.requests.find((r) => r.method === 'PATCH')?.body).toEqual({
      name: 'Food',
      description: null,
    });
  });
});

describe.each(kinds)('$panel', (k) => {
  it('lists the pseudo-entry first then names alphabetically', async () => {
    mockApi({ occurrences: rows() });
    renderPage();
    const panel = await panelOf(k);
    await within(panel).findByText(k.second);
    const names = within(panel)
      .getAllByRole('button', { pressed: false })
      .map((b) => b.textContent);
    expect(names).toEqual([k.none, k.first, k.second]);
  });

  it('selecting and deselecting items filters the list', async () => {
    mockApi({ occurrences: rows() });
    renderPage();
    const panel = await panelOf(k);
    const u = userEvent.setup();
    await u.click(await within(panel).findByRole('button', { name: k.filterTarget }));
    expect(screen.getByText(k.keepRow)).toBeInTheDocument();
    expect(screen.queryByText(k.dropRow)).toBeNull();
    await u.click(within(panel).getByRole('button', { name: k.filterTarget }));
    expect(screen.getByText(k.dropRow)).toBeInTheDocument();
  });

  it('Add posts a new item and lists it', async () => {
    const api = mockApi({ occurrences: rows() });
    server.use(
      http.post(k.path, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        api.requests.push({ method: 'POST', url: k.path, userId: 'alice', body });
        const key = k.noun === 'category' ? 'categories' : 'accounts';
        api[key] = [...api[key], { id: 'new', name: body.name, description: null }] as never;
        return HttpResponse.json({ id: 'new', name: body.name }, { status: 201 });
      })
    );
    renderPage();
    const panel = await panelOf(k);
    const u = userEvent.setup();
    await u.click(within(panel).getByRole('button', { name: `Add ${k.noun}` }));
    const dialog = screen.getByRole('dialog', { name: `Add ${k.noun}` });
    await u.type(within(dialog).getByLabelText('Name'), 'Zebra');
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByRole('button', { name: 'Zebra' })).toBeInTheDocument();
    expect(api.requests.find((r) => r.method === 'POST')?.body).toMatchObject({ name: 'Zebra' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Edit patches the name', async () => {
    const api = mockApi({ occurrences: rows() });
    server.use(
      http.patch(`${k.path}/${k.firstId}`, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        api.requests.push({
          method: 'PATCH',
          url: `${k.path}/${k.firstId}`,
          userId: 'alice',
          body,
        });
        const key = k.noun === 'category' ? 'categories' : 'accounts';
        api[key] = api[key].map((i) =>
          i.id === k.firstId ? { ...i, name: body.name } : i
        ) as never;
        return HttpResponse.json({ id: k.firstId, name: body.name });
      })
    );
    renderPage();
    const panel = await panelOf(k);
    const u = userEvent.setup();
    await u.click(await within(panel).findByRole('button', { name: `Edit ${k.first}` }));
    const dialog = screen.getByRole('dialog', { name: `Edit ${k.noun}` });
    const input = within(dialog).getByLabelText('Name');
    expect(input).toHaveValue(k.first);
    await u.clear(input);
    await u.type(input, 'Renamed');
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByRole('button', { name: 'Renamed' })).toBeInTheDocument();
    expect(api.requests.find((r) => r.method === 'PATCH')?.body).toMatchObject({ name: 'Renamed' });
  });

  it('the pseudo-entry offers no edit or delete', async () => {
    mockApi({ occurrences: rows() });
    renderPage();
    const panel = await panelOf(k);
    await within(panel).findByText(k.first);
    expect(within(panel).queryByRole('button', { name: `Edit ${k.none}` })).toBeNull();
    expect(within(panel).queryByRole('button', { name: `Delete ${k.none}` })).toBeNull();
    expect(within(panel).getByRole('button', { name: `Edit ${k.first}` })).toBeInTheDocument();
  });

  it('confirmed Delete removes the item', async () => {
    const api = mockApi({ occurrences: rows() });
    server.use(
      http.delete(`${k.path}/${k.firstId}`, () => {
        const key = k.noun === 'category' ? 'categories' : 'accounts';
        api[key] = api[key].filter((i) => i.id !== k.firstId) as never;
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderPage();
    const panel = await panelOf(k);
    const u = userEvent.setup();
    await u.click(await within(panel).findByRole('button', { name: `Delete ${k.first}` }));
    const dialog = screen.getByRole('dialog', { name: `Delete ${k.first}?` });
    await u.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(within(panel).queryByRole('button', { name: k.first })).toBeNull());
    expect(within(panel).getByRole('button', { name: k.second })).toBeInTheDocument();
  });

  it('Delete answered 409 shows the detail and keeps the item', async () => {
    mockApi({ occurrences: rows() });
    server.use(
      http.delete(`${k.path}/${k.firstId}`, () =>
        HttpResponse.json(
          { type: 'ConflictError', detail: 'Cannot delete: it is in use' },
          { status: 409 }
        )
      )
    );
    renderPage();
    const panel = await panelOf(k);
    const u = userEvent.setup();
    await u.click(await within(panel).findByRole('button', { name: `Delete ${k.first}` }));
    const dialog = screen.getByRole('dialog', { name: `Delete ${k.first}?` });
    await u.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByText('Cannot delete: it is in use')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: k.first })).toBeInTheDocument();
  });

  it('an empty name shows a message and keeps the dialog open', async () => {
    const api = mockApi({ occurrences: rows() });
    renderPage();
    const panel = await panelOf(k);
    const u = userEvent.setup();
    await u.click(within(panel).getByRole('button', { name: `Add ${k.noun}` }));
    const dialog = screen.getByRole('dialog', { name: `Add ${k.noun}` });
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('name is required')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: `Add ${k.noun}` })).toBeInTheDocument();
    expect(api.requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('a duplicate name answered 409 shows the detail and keeps the dialog open', async () => {
    mockApi({ occurrences: rows() });
    server.use(
      http.post(k.path, () =>
        HttpResponse.json(
          { type: 'ConflictError', detail: 'This name already exists' },
          { status: 409 }
        )
      )
    );
    renderPage();
    const panel = await panelOf(k);
    const u = userEvent.setup();
    await u.click(within(panel).getByRole('button', { name: `Add ${k.noun}` }));
    const dialog = screen.getByRole('dialog', { name: `Add ${k.noun}` });
    await u.type(within(dialog).getByLabelText('Name'), k.first);
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('This name already exists')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: `Add ${k.noun}` })).toBeInTheDocument();
  });
});
