import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Account, Category, Occurrence } from '@capital-care/shared';
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
  categories: Category[];
  accounts: Account[];
  requests: { method: string; url: string; userId: string | null; body: unknown }[];
}

/** Answers every endpoint the page uses from `state`; later `server.use` calls override it. */
export function mockApi(partial: Partial<ApiState> = {}): ApiState {
  const state: ApiState = { occurrences: [], categories, accounts, requests: [], ...partial };
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
      return HttpResponse.json({ occurrences: state.occurrences });
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
