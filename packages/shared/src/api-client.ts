import type { CreateTransactionInput } from './transaction.schema.js';

export type TransactionType = 'receipt' | 'debit';
export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'annually';

export interface Occurrence {
  transactionId: string;
  date: string;
  description: string;
  categoryId: string | null;
  accountId: string | null;
  type: TransactionType;
  amount: string;
  recurrence: Recurrence | null;
  instalment: { number: number; total: number } | null;
  status: 'forecast' | 'settled';
}

/** The balance of one month, as GET /transactions/balance computes it. */
export interface MonthBalance {
  /** One entry per date with occurrences, ascending: the balance after that day. */
  days: { date: string; balance: string }[];
  /** Null while a category filter is active. */
  totals: { received: string; debits: string; net: string; finalBalance: string } | null;
}

/** Selected ids; `none` selects transactions with no category / no account. Empty = no filter. */
export interface MonthFilters {
  categoryIds: readonly string[];
  accountIds: readonly string[];
}

const NO_FILTER: MonthFilters = { categoryIds: [], accountIds: [] };

/** `month=YYYY-MM`, then one `category` / `account` param per selected id. */
function monthQuery(month: string, filters: MonthFilters): string {
  const params = new URLSearchParams({ month });
  for (const id of filters.categoryIds) params.append('category', id);
  for (const id of filters.accountIds) params.append('account', id);
  return params.toString();
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  /** Null on a top-level category. */
  parentId: string | null;
  /** Sent by `GET /categories`, which nests the tree, alphabetical at each level. */
  children?: Category[];
}

/** What creating or editing a category sends; `parentId: null` moves it to the top level. */
export interface CategoryInput {
  name: string;
  description?: string | null;
  parentId?: string | null;
}

export interface Account {
  id: string;
  name: string;
}

/** A non-2xx answer: `detail` is the API's message when it sent one. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  userId: string;
}

/**
 * The typed API client. It is the only place that sets the acting-user header
 * (`X-User-Id` today, a JWT later); components and hooks never set it.
 */
export function createApiClient({ baseUrl, userId }: ApiClientOptions) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'X-User-Id': userId };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const init: { method: string; headers: Record<string, string>; body?: string } = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const response = await fetch(`${baseUrl}${path}`, init);
    if (!response.ok) {
      let detail = 'Something went wrong';
      try {
        const parsed: unknown = await response.json();
        if (typeof parsed === 'object' && parsed !== null && 'detail' in parsed) {
          if (typeof parsed.detail === 'string' && parsed.detail) detail = parsed.detail;
        }
      } catch {
        // keep the generic message
      }
      throw new ApiError(response.status, detail);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  const occurrence = (id: string, date: string) =>
    `/transactions/${encodeURIComponent(id)}/occurrences/${date}`;

  return {
    userId,
    async listMonth(month: string, filters: MonthFilters = NO_FILTER): Promise<Occurrence[]> {
      const body = await request<{ occurrences: Occurrence[] }>(
        'GET',
        `/transactions?${monthQuery(month, filters)}`,
      );
      return body.occurrences;
    },
    getBalance: (month: string, filters: MonthFilters = NO_FILTER) =>
      request<MonthBalance>('GET', `/transactions/balance?${monthQuery(month, filters)}`),
    createTransaction: (input: CreateTransactionInput) => request<unknown>('POST', '/transactions', input),
    settle: (id: string, date: string, amount?: string) =>
      request<unknown>('PUT', `${occurrence(id, date)}/settlement`, amount === undefined ? {} : { amount }),
    unsettle: (id: string, date: string) => request<unknown>('DELETE', `${occurrence(id, date)}/settlement`),
    async listCategories(): Promise<Category[]> {
      return (await request<{ categories: Category[] }>('GET', '/categories')).categories;
    },
    createCategory: (input: CategoryInput) => request<Category>('POST', '/categories', input),
    updateCategory: (id: string, input: CategoryInput) =>
      request<Category>('PATCH', `/categories/${encodeURIComponent(id)}`, input),
    deleteCategory: (id: string) => request<undefined>('DELETE', `/categories/${encodeURIComponent(id)}`),
    async listAccounts(): Promise<Account[]> {
      return (await request<{ accounts: Account[] }>('GET', '/accounts')).accounts;
    },
    createAccount: (input: { name: string }) => request<Account>('POST', '/accounts', input),
    updateAccount: (id: string, input: { name: string }) =>
      request<Account>('PATCH', `/accounts/${encodeURIComponent(id)}`, input),
    deleteAccount: (id: string) => request<undefined>('DELETE', `/accounts/${encodeURIComponent(id)}`),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
