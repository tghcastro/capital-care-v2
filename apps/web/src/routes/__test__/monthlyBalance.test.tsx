import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../mocks/server';
import { mockApi, occ, renderPage } from './testkit';

// Component: the page shows what GET /transactions and GET /transactions/balance return and sends
// the selected filters; it computes no balance or total itself.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-01-16T12:00:00') });
});
afterEach(() => {
  vi.useRealTimers();
});

const TOTALS = ['Total received', 'Total debits', 'Monthly net total', 'Final available balance'];

function summary() {
  return screen.getByRole('region', { name: 'Monthly summary' });
}

function totalOf(label: string): string | null | undefined {
  return within(summary()).getByText(label).nextSibling?.textContent;
}

function balanceUrls(requests: { url: string }[]) {
  return requests.filter((r) => r.url.startsWith('/transactions/balance')).map((r) => r.url);
}

function listUrls(requests: { url: string }[]) {
  return requests.filter((r) => r.url.startsWith('/transactions?')).map((r) => r.url);
}

describe('TransactionsPage monthly balance', () => {
  it('MB4 shows the day balances and the summary the balance route returns', async () => {
    // January 2027 of the PRD, with the balances as the API returns them (canonical decimals).
    const api = mockApi({
      occurrences: [
        occ({ transactionId: 't1', date: '2027-01-01', description: 'Salary - Acme', type: 'receipt', amount: '3000' }),
        occ({ transactionId: 't2', date: '2027-01-05', description: 'Condo fees', amount: '450' }),
        occ({ transactionId: 't3', date: '2027-01-12', description: 'Supermarket', amount: '200' }),
      ],
      balance: {
        days: [
          { date: '2027-01-01', balance: '8641' },
          { date: '2027-01-05', balance: '7961' },
          { date: '2027-01-12', balance: '7761' },
        ],
        totals: { received: '4000', debits: '1110', net: '2890', finalBalance: '7531' },
      },
    });
    renderPage();

    await screen.findByText('Supermarket');
    await waitFor(() =>
      expect(screen.getAllByTestId('day-balance').map((b) => b.textContent)).toEqual([
        'Balance 8,641.00',
        'Balance 7,961.00',
        'Balance 7,761.00',
      ]),
    );
    expect(totalOf('Total received')).toBe('4,000.00');
    expect(totalOf('Total debits')).toBe('1,110.00');
    expect(totalOf('Monthly net total')).toBe('2,890.00');
    expect(totalOf('Final available balance')).toBe('7,531.00');
    expect(balanceUrls(api.requests)).toContain('/transactions/balance?month=2027-01');
  });

  it('MB5 an empty month shows No transactions this month with net 0.00 and the carried final balance', async () => {
    mockApi({
      occurrences: [],
      balance: { days: [], totals: { received: '0', debits: '0', net: '0', finalBalance: '7531' } },
    });
    renderPage();

    expect(await screen.findByText('No transactions this month')).toBeInTheDocument();
    await waitFor(() => expect(totalOf('Final available balance')).toBe('7,531.00'));
    expect(totalOf('Monthly net total')).toBe('0.00');
    expect(screen.queryAllByTestId('day-balance')).toEqual([]);
  });

  it('MB9 sends only the month when no filter is selected', async () => {
    const api = mockApi({ occurrences: [occ({ date: '2027-01-05' })] });
    renderPage();

    await screen.findByText('Groceries');
    await waitFor(() => expect(balanceUrls(api.requests)).toEqual(['/transactions/balance?month=2027-01']));
    expect(listUrls(api.requests)).toEqual(['/transactions?month=2027-01']);
  });

  it('MB9 sends one category and account param per selected id and none for the pseudo-entries', async () => {
    const api = mockApi({ occurrences: [occ({ date: '2027-01-05' })] });
    renderPage();
    await screen.findByText('Groceries');
    const u = userEvent.setup();
    const categoriesPanel = screen.getByRole('region', { name: 'Categories' });
    const accountsPanel = screen.getByRole('region', { name: 'Accounts' });

    await u.click(await within(categoriesPanel).findByRole('button', { name: 'Food' }));
    await u.click(within(categoriesPanel).getByRole('button', { name: 'Uncategorized' }));
    await u.click(within(accountsPanel).getByRole('button', { name: 'Checking' }));
    await u.click(within(accountsPanel).getByRole('button', { name: 'Unassigned' }));

    const params = (url: string) => {
      const search = new URL(url, 'http://x').searchParams;
      return {
        month: search.getAll('month'),
        category: search.getAll('category').sort(),
        account: search.getAll('account').sort(),
      };
    };
    const expected = { month: ['2027-01'], category: ['c1', 'none'], account: ['a1', 'none'] };
    await waitFor(() => {
      const lastList = listUrls(api.requests).at(-1) ?? '';
      const lastBalance = balanceUrls(api.requests).at(-1) ?? '';
      expect(params(lastList)).toEqual(expected);
      expect(params(lastBalance)).toEqual(expected);
    });
    expect(params(listUrls(api.requests)[1] ?? '')).toEqual({ month: ['2027-01'], category: ['c1'], account: [] });

    // Deselecting everything goes back to the month alone.
    await u.click(within(categoriesPanel).getByRole('button', { name: 'Food' }));
    await u.click(within(categoriesPanel).getByRole('button', { name: 'Uncategorized' }));
    await u.click(within(accountsPanel).getByRole('button', { name: 'Checking' }));
    await u.click(within(accountsPanel).getByRole('button', { name: 'Unassigned' }));
    await waitFor(() => {
      expect(listUrls(api.requests).at(-1)).toBe('/transactions?month=2027-01');
      expect(balanceUrls(api.requests).at(-1)).toBe('/transactions/balance?month=2027-01');
    });
  });

  it('MB9 lists only the occurrences the API returns for the selected filters', async () => {
    mockApi({ occurrences: [occ({ date: '2027-01-05', description: 'Lunch', categoryId: 'c1' })] });
    // Whatever the page asks with a category, the API answers a row of another category: the page
    // must show it, because filtering is the API's job.
    server.use(
      http.get('/transactions', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.has('category')) {
          return HttpResponse.json({
            occurrences: [occ({ transactionId: 't9', date: '2027-01-07', description: 'From the API', categoryId: 'c2' })],
          });
        }
        return HttpResponse.json({ occurrences: [occ({ date: '2027-01-05', description: 'Lunch', categoryId: 'c1' })] });
      }),
    );
    renderPage();
    await screen.findByText('Lunch');

    const panel = screen.getByRole('region', { name: 'Categories' });
    await userEvent.setup().click(await within(panel).findByRole('button', { name: 'Food' }));

    expect(await screen.findByText('From the API')).toBeInTheDocument();
    expect(screen.queryByText('Lunch')).toBeNull();
  });

  it('MB12 hides the four totals while a category is selected and shows them again after deselecting it', async () => {
    mockApi({
      occurrences: [occ({ date: '2027-01-05', description: 'Winter jacket', categoryId: 'c1', amount: '180' })],
      balance: {
        days: [{ date: '2027-01-05', balance: '7961' }],
        totals: { received: '4000', debits: '1110', net: '2890', finalBalance: '7531' },
      },
      categoryBalance: { days: [{ date: '2027-01-05', balance: '-180' }], totals: null },
    });
    renderPage();
    await screen.findByText('Winter jacket');
    await waitFor(() => expect(totalOf('Final available balance')).toBe('7,531.00'));
    const panel = screen.getByRole('region', { name: 'Categories' });
    const u = userEvent.setup();

    await u.click(await within(panel).findByRole('button', { name: 'Food' }));

    await waitFor(() =>
      expect(screen.getAllByTestId('day-balance').map((b) => b.textContent)).toEqual(['Balance -180.00']),
    );
    for (const label of TOTALS) expect(screen.queryByText(label)).toBeNull();

    await u.click(within(panel).getByRole('button', { name: 'Food' }));

    await waitFor(() => expect(totalOf('Final available balance')).toBe('7,531.00'));
    for (const label of TOTALS) expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('MB26 shows the API detail when the balance request fails and Try again refetches', async () => {
    mockApi({
      occurrences: [occ({ date: '2027-01-05' })],
      balance: {
        days: [{ date: '2027-01-05', balance: '-100.35' }],
        totals: { received: '0', debits: '100.35', net: '-100.35', finalBalance: '-100.35' },
      },
    });
    server.use(
      http.get('/transactions/balance', () => HttpResponse.json({ type: 'X', detail: 'Balance offline' }, { status: 500 }), {
        once: true,
      }),
    );
    renderPage();

    expect(await screen.findByText('Balance offline')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(totalOf('Final available balance')).toBe('-100.35'));
    expect(screen.queryByText('Balance offline')).toBeNull();
  });
});
