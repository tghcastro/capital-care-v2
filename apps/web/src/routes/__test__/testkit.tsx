import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Account, Category, MonthBalance, Occurrence } from '@capital-care/shared';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { TransactionsPage } from '../TransactionsPage';

export function occ(over: Partial<Occurrence> = {}): Occurrence {
  return {
    transactionId: 't1',
    date: '2026-11-16',
    description: 'Groceries',
    categoryId: 'c1',
    accountId: 'a1',
    type: 'debit',
    amount: '100.35',
    recurrence: null,
    instalment: null,
    status: 'forecast',
    ...over,
  };
}

export const categories: Category[] = [
  { id: 'c2', name: 'Salary', description: null },
  { id: 'c1', name: 'Food', description: null },
];
export const accounts: Account[] = [
  { id: 'a2', name: 'Savings' },
  { id: 'a1', name: 'Checking' },
];

export interface ApiState {
  occurrences: Occurrence[];
  /** What GET /transactions/balance answers with no category param. */
  balance: MonthBalance;
  /** What it answers while a category param is sent. */
  categoryBalance: MonthBalance;
  categories: Category[];
  accounts: Account[];
  requests: { method: string; url: string; userId: string | null; body: unknown }[];
}

/** Answers every endpoint the page uses from `state`; later `server.use` calls override it. */
export function mockApi(partial: Partial<ApiState> = {}): ApiState {
  const state: ApiState = {
    occurrences: [],
    balance: { days: [], totals: { received: '0', debits: '0', net: '0', finalBalance: '0' } },
    categoryBalance: { days: [], totals: null },
    categories,
    accounts,
    requests: [],
    ...partial,
  };
  const record = async (request: Request) => {
    let body: unknown = undefined;
    if (request.method !== 'GET' && request.method !== 'DELETE')
      body = await request.clone().json();
    state.requests.push({
      method: request.method,
      url: new URL(request.url).pathname + new URL(request.url).search,
      userId: request.headers.get('x-user-id'),
      body,
    });
  };
  server.use(
    http.get('/transactions', async ({ request }) => {
      await record(request);
      // Stands in for the API's filter: any id within a param, both params together, none = null.
      const search = new URL(request.url).searchParams;
      const matches = (selected: string[], id: string | null) =>
        selected.length === 0 || selected.includes(id ?? 'none');
      const occurrences = state.occurrences.filter(
        (o) =>
          matches(search.getAll('category'), o.categoryId) &&
          matches(search.getAll('account'), o.accountId)
      );
      return HttpResponse.json({ occurrences });
    }),
    http.get('/transactions/balance', async ({ request }) => {
      await record(request);
      const search = new URL(request.url).searchParams;
      return HttpResponse.json(search.has('category') ? state.categoryBalance : state.balance);
    }),
    http.get('/categories', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ categories: state.categories });
    }),
    http.get('/accounts', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ accounts: state.accounts });
    })
  );
  return state;
}

export function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <TransactionsPage />
    </QueryClientProvider>
  );
}
