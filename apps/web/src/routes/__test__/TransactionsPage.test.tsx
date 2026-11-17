import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../mocks/server';
import { mockApi, occ, renderPage } from './testkit';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-16T12:00:00') });
});
afterEach(() => {
  vi.useRealTimers();
});

const user = () => userEvent.setup();

describe('TransactionsPage', () => {
  it('shows Capital Care and alice and sends X-User-Id alice on every request', async () => {
    const api = mockApi({ occurrences: [occ()] });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Capital Care' })).toBeInTheDocument();
    expect(await screen.findByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(api.requests.length).toBeGreaterThanOrEqual(3);
    expect(api.requests.every((r) => r.userId === 'alice')).toBe(true);
  });

  it('loads the current month', async () => {
    const api = mockApi({ occurrences: [occ()] });
    renderPage();
    await screen.findByText('Groceries');
    expect(api.requests.some((r) => r.url === '/transactions?month=2026-11')).toBe(true);
  });

  it('shows a loading state while occurrences load', async () => {
    mockApi();
    server.use(http.get('/transactions', () => new Promise<never>(() => undefined)));
    renderPage();
    expect(await screen.findByText('Loading transactions…')).toBeInTheDocument();
  });

  it('shows the API detail on failure and Try again refetches', async () => {
    mockApi({ occurrences: [occ()] });
    server.use(
      http.get('/transactions', () => HttpResponse.json({ type: 'X', detail: 'Database offline' }, { status: 500 }), {
        once: true,
      }),
    );
    renderPage();
    expect(await screen.findByText('Database offline')).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Groceries')).toBeInTheDocument();
  });

  it('shows No transactions this month with 0.00 totals', async () => {
    mockApi();
    renderPage();
    expect(await screen.findByText('No transactions this month')).toBeInTheDocument();
    const footer = screen.getByRole('region', { name: 'Monthly summary' });
    for (const label of ['Total received', 'Total debits', 'Monthly net total', 'Final available balance']) {
      expect(within(footer).getByText(label).nextSibling?.textContent).toBe('0.00');
    }
  });

  it('renders every row detail', async () => {
    mockApi({
      occurrences: [
        occ({ description: 'Pay', type: 'receipt', amount: '500.01', recurrence: 'monthly', status: 'settled' }),
        occ({ transactionId: 't2', description: 'Lunch', type: 'debit', amount: '100.35' }),
        occ({ transactionId: 't3', description: 'Mystery', categoryId: null, accountId: null, amount: '1' }),
      ],
    });
    renderPage();
    const pay = (await screen.findByText('Pay')).closest('li') as HTMLElement;
    expect(within(pay).getByText('Checking')).toBeInTheDocument();
    expect(within(pay).getByText('Food')).toBeInTheDocument();
    expect(within(pay).getByText('+500.01')).toBeInTheDocument();
    expect(within(pay).getByLabelText('Recurring')).toBeInTheDocument();
    expect(within(pay).getByRole('button', { name: 'Mark as unsettled' })).toBeInTheDocument();
    const lunch = screen.getByText('Lunch').closest('li') as HTMLElement;
    expect(within(lunch).getByText('-100.35')).toBeInTheDocument();
    expect(within(lunch).queryByLabelText('Recurring')).toBeNull();
    expect(within(lunch).getByRole('button', { name: 'Mark as settled' })).toBeInTheDocument();
    const mystery = screen.getByText('Mystery').closest('li') as HTMLElement;
    expect(within(mystery).getByText('Uncategorized')).toBeInTheDocument();
    expect(within(mystery).getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '16/11/2026 - Monday' })).toBeInTheDocument();
  });

  it('loads the month picked in the date filter', async () => {
    const api = mockApi({ occurrences: [occ()] });
    renderPage();
    await screen.findByText('Groceries');
    await user().selectOptions(screen.getByLabelText('Month'), 'March');
    await user().selectOptions(screen.getByLabelText('Year'), '2025');
    await waitFor(() => expect(api.requests.some((r) => r.url === '/transactions?month=2025-03')).toBe(true));
  });

  it('Next month and Previous month buttons change the month', async () => {
    const api = mockApi({ occurrences: [occ()] });
    renderPage();
    await screen.findByText('Groceries');
    await user().click(screen.getByRole('button', { name: 'Next month' }));
    await waitFor(() => expect(api.requests.some((r) => r.url === '/transactions?month=2026-12')).toBe(true));
    await user().click(screen.getByRole('button', { name: 'Previous month' }));
    await user().click(screen.getByRole('button', { name: 'Previous month' }));
    await waitFor(() => expect(api.requests.some((r) => r.url === '/transactions?month=2026-10')).toBe(true));
  });

  it('shows the running balance after each day group', async () => {
    mockApi({
      occurrences: [
        occ({ date: '2026-11-01', type: 'debit', amount: '100.35' }),
        occ({ transactionId: 't2', date: '2026-11-01', type: 'receipt', amount: '500.01' }),
        occ({ transactionId: 't3', date: '2026-11-02', type: 'debit', amount: '400' }),
      ],
    });
    renderPage();
    const balances = await screen.findAllByTestId('day-balance');
    expect(balances.map((b) => b.textContent)).toEqual(['Balance 399.66', 'Balance -0.34']);
  });

  it('shows the monthly summary in the footer', async () => {
    mockApi({
      occurrences: [
        occ({ description: 'Pay', type: 'receipt', amount: '1500.5' }),
        occ({ transactionId: 't2', description: 'Groceries', type: 'debit', amount: '100.35' }),
      ],
    });
    renderPage();
    await screen.findByText('Groceries');
    const footer = screen.getByRole('region', { name: 'Monthly summary' });
    expect(within(footer).getByText('Total received').nextSibling?.textContent).toBe('1,500.50');
    expect(within(footer).getByText('Total debits').nextSibling?.textContent).toBe('100.35');
    expect(within(footer).getByText('Monthly net total').nextSibling?.textContent).toBe('1,400.15');
    expect(within(footer).getByText('Final available balance').nextSibling?.textContent).toBe('1,400.15');
  });

  it('Back to top scrolls the window to the top', async () => {
    mockApi({ occurrences: [occ()] });
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    renderPage();
    await screen.findByText('Groceries');
    await user().click(screen.getByRole('button', { name: 'Back to top' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});

async function fillQuickAdd(u: ReturnType<typeof userEvent.setup>, over: { amount?: string; description?: string } = {}) {
  const form = screen.getByRole('form', { name: 'Quick add transaction' });
  await u.clear(within(form).getByLabelText('Description'));
  await u.type(within(form).getByLabelText('Description'), over.description ?? 'Coffee');
  await u.clear(within(form).getByLabelText('Amount'));
  await u.type(within(form).getByLabelText('Amount'), over.amount ?? '3.5');
  await u.selectOptions(within(form).getByLabelText('Category'), 'Food');
  await u.selectOptions(within(form).getByLabelText('Account'), 'Checking');
  return form;
}

describe('TransactionsPage details', () => {
  it('shows the recurring icon for an instalment-only transaction', async () => {
    mockApi({ occurrences: [occ({ description: 'Sofa', instalment: { number: 1, total: 3 } })] });
    renderPage();
    const row = (await screen.findByText('Sofa')).closest('li') as HTMLElement;
    expect(within(row).getByLabelText('Recurring')).toBeInTheDocument();
  });

  it('shows Something went wrong when a failure carries no detail', async () => {
    mockApi();
    server.use(http.get('/transactions', () => new HttpResponse(null, { status: 500 })));
    renderPage();
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });
});

describe('TransactionsPage quick add', () => {
  it('quick-add posts a one-off transaction and lists it', async () => {
    const api = mockApi();
    server.use(
      http.post('/transactions', async ({ request }) => {
        const body = (await request.json()) as Record<string, string>;
        api.requests.push({ method: 'POST', url: '/transactions', userId: 'alice', body });
        api.occurrences = [occ({ description: body.description ?? '', amount: body.amount ?? '0' })];
        return HttpResponse.json({ id: 't9' }, { status: 201 });
      }),
    );
    renderPage();
    await screen.findByText('No transactions this month');
    const u = user();
    const form = await fillQuickAdd(u);
    await u.click(within(form).getByRole('button', { name: 'Add transaction' }));
    expect(await screen.findByText('Coffee')).toBeInTheDocument();
    const post = api.requests.find((r) => r.method === 'POST');
    expect(post?.body).toEqual({
      date: '2026-11-16',
      description: 'Coffee',
      categoryId: 'c1',
      accountId: 'a1',
      amount: '3.5',
      type: 'debit',
    });
  });

  it.each(['daily', 'weekly', 'monthly', 'annually'])('More details sends the chosen recurrence (%s)', async (recurrence) => {
    const api = mockApi();
    server.use(
      http.post('/transactions', async ({ request }) => {
        api.requests.push({ method: 'POST', url: '/transactions', userId: 'alice', body: await request.json() });
        return HttpResponse.json({ id: 't9' }, { status: 201 });
      }),
    );
    renderPage();
    await screen.findByText('No transactions this month');
    const u = user();
    const form = await fillQuickAdd(u);
    await u.click(within(form).getByRole('button', { name: 'More details' }));
    await u.selectOptions(within(form).getByLabelText('Repeat'), recurrence);
    await u.click(within(form).getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(api.requests.some((r) => r.method === 'POST')).toBe(true));
    const body = api.requests.find((r) => r.method === 'POST')?.body as Record<string, unknown>;
    expect(body.recurrence).toBe(recurrence);
    expect('instalment' in body).toBe(false);
  });

  it('More details sends an instalment and hides recurrence', async () => {
    const api = mockApi();
    server.use(
      http.post('/transactions', async ({ request }) => {
        api.requests.push({ method: 'POST', url: '/transactions', userId: 'alice', body: await request.json() });
        return HttpResponse.json({ id: 't9' }, { status: 201 });
      }),
    );
    renderPage();
    await screen.findByText('No transactions this month');
    const u = user();
    const form = await fillQuickAdd(u);
    await u.click(within(form).getByRole('button', { name: 'More details' }));
    await u.selectOptions(within(form).getByLabelText('Repeat'), 'instalments');
    expect(within(form).getByLabelText('Instalment number')).toBeInTheDocument();
    await u.clear(within(form).getByLabelText('Instalment number'));
    await u.type(within(form).getByLabelText('Instalment number'), '1');
    await u.clear(within(form).getByLabelText('Instalment total'));
    await u.type(within(form).getByLabelText('Instalment total'), '3');
    await u.click(within(form).getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(api.requests.some((r) => r.method === 'POST')).toBe(true));
    const body = api.requests.find((r) => r.method === 'POST')?.body as Record<string, unknown>;
    expect(body.instalment).toEqual({ number: 1, total: 3 });
    expect('recurrence' in body).toBe(false);
  });

  it('shows schema messages and posts nothing for amount 0 and a 101 character description', async () => {
    const api = mockApi();
    renderPage();
    await screen.findByText('No transactions this month');
    const u = user();
    const form = await fillQuickAdd(u, { amount: '0' });
    await u.click(within(form).getByRole('button', { name: 'Add transaction' }));
    expect(await within(form).findByText('amount must be greater than zero')).toBeInTheDocument();
    await fillQuickAdd(u, { amount: '5', description: 'x'.repeat(101) });
    await u.click(within(form).getByRole('button', { name: 'Add transaction' }));
    expect(await within(form).findByText('description must not exceed 100 characters')).toBeInTheDocument();
    expect(api.requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('shows the API detail and keeps typed values when create fails', async () => {
    mockApi();
    server.use(
      http.post('/transactions', () => HttpResponse.json({ type: 'ValidationError', detail: 'category not found' }, { status: 400 })),
    );
    renderPage();
    await screen.findByText('No transactions this month');
    const u = user();
    const form = await fillQuickAdd(u);
    await u.click(within(form).getByRole('button', { name: 'Add transaction' }));
    expect(await within(form).findByText('category not found')).toBeInTheDocument();
    expect(within(form).getByLabelText('Description')).toHaveValue('Coffee');
    expect(within(form).getByLabelText('Amount')).toHaveValue('3.5');
  });

  it('clears the quick-add form and refetches after create', async () => {
    const api = mockApi();
    server.use(http.post('/transactions', () => HttpResponse.json({ id: 't9' }, { status: 201 })));
    renderPage();
    await screen.findByText('No transactions this month');
    const before = api.requests.filter((r) => r.url.startsWith('/transactions?')).length;
    const u = user();
    const form = await fillQuickAdd(u);
    await u.click(within(form).getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(within(form).getByLabelText('Description')).toHaveValue(''));
    expect(within(form).getByLabelText('Amount')).toHaveValue('');
    await waitFor(() =>
      expect(api.requests.filter((r) => r.url.startsWith('/transactions?')).length).toBeGreaterThan(before),
    );
  });
});

describe('TransactionsPage settlement', () => {
  it('clicking the icon of a forecast occurrence settles it', async () => {
    const api = mockApi({ occurrences: [occ()] });
    server.use(
      http.put('/transactions/t1/occurrences/2026-11-16/settlement', () => {
        api.requests.push({ method: 'PUT', url: 'settle', userId: 'alice', body: undefined });
        api.occurrences = [occ({ status: 'settled' })];
        return HttpResponse.json({});
      }),
    );
    renderPage();
    await user().click(await screen.findByRole('button', { name: 'Mark as settled' }));
    expect(await screen.findByRole('button', { name: 'Mark as unsettled' })).toBeInTheDocument();
    expect(api.requests.some((r) => r.url === 'settle')).toBe(true);
  });

  it('clicking the icon of a settled occurrence unsettles it', async () => {
    const api = mockApi({ occurrences: [occ({ status: 'settled' })] });
    server.use(
      http.delete('/transactions/t1/occurrences/2026-11-16/settlement', () => {
        api.occurrences = [occ({ status: 'forecast' })];
        return HttpResponse.json({});
      }),
    );
    renderPage();
    await user().click(await screen.findByRole('button', { name: 'Mark as unsettled' }));
    expect(await screen.findByRole('button', { name: 'Mark as settled' })).toBeInTheDocument();
  });

  it('shows the API detail and keeps the icon when settle fails', async () => {
    mockApi({ occurrences: [occ()] });
    server.use(
      http.put('/transactions/t1/occurrences/2026-11-16/settlement', () =>
        HttpResponse.json({ type: 'ConflictError', detail: 'Already settled' }, { status: 409 }),
      ),
    );
    renderPage();
    await user().click(await screen.findByRole('button', { name: 'Mark as settled' }));
    expect(await screen.findByText('Already settled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as settled' })).toBeInTheDocument();
  });
});
