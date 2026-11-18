import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, Card, compactInput } from '../components/ui';
import { FilterPanel, type PanelValues } from '../features/ledger/FilterPanel';
import { groupByDay, NONE } from '../features/transaction/ledgerView';
import { QuickAdd } from '../features/transaction/QuickAdd';
import { api, CURRENT_USER } from '../lib/api';
import { groupTitle, monthOf, shiftMonth } from '../lib/dates';
import { formatAmount } from '../lib/money';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** The selected panel ids as the API takes them: the pseudo-entry is `none`. */
function apiIds(selected: ReadonlySet<string>): string[] {
  return [...selected].map((id) => (id === NONE ? 'none' : id)).sort();
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const [categoryFilter, setCategoryFilter] = useState<ReadonlySet<string>>(new Set());
  const [accountFilter, setAccountFilter] = useState<ReadonlySet<string>>(new Set());
  const [settleError, setSettleError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({ categoryIds: apiIds(categoryFilter), accountIds: apiIds(accountFilter) }),
    [categoryFilter, accountFilter]
  );
  const transactions = useQuery({
    queryKey: ['transactions', month, filters],
    queryFn: () => api.listMonth(month, filters),
  });
  const balance = useQuery({
    queryKey: ['transactions', 'balance', month, filters],
    queryFn: () => api.getBalance(month, filters),
  });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.listCategories() });
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => api.listAccounts() });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['transactions'] });

  const settle = useMutation({
    mutationFn: (o: { id: string; date: string; settled: boolean }) =>
      o.settled ? api.unsettle(o.id, o.date) : api.settle(o.id, o.date),
    onMutate: () => setSettleError(null),
    onError: (error) => setSettleError(errorText(error)),
    onSettled: refresh,
  });

  const categoryNames = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data]
  );
  const accountNames = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a.name])),
    [accounts.data]
  );
  const groups = useMemo(
    () => groupByDay(transactions.data ?? [], balance.data?.days ?? []),
    [transactions.data, balance.data]
  );
  const totals = balance.data?.totals ?? null;

  const [yearText, monthText] = month.split('-') as [string, string];
  const year = Number(yearText);
  const years = Array.from({ length: 11 }, (_, i) => year - 5 + i);
  const defaultDate = (() => {
    const today = new Date();
    return monthOf(today) === month
      ? `${month}-${String(today.getDate()).padStart(2, '0')}`
      : `${month}-01`;
  })();

  const loadError = transactions.error ?? balance.error ?? categories.error ?? accounts.error;

  const saveCategory = async (id: string | null, v: PanelValues) => {
    if (id) await api.updateCategory(id, v);
    else await api.createCategory(v);
    await queryClient.invalidateQueries({ queryKey: ['categories'] });
  };
  const saveAccount = async (id: string | null, v: PanelValues) => {
    if (id) await api.updateAccount(id, { name: v.name });
    else await api.createAccount({ name: v.name });
    await queryClient.invalidateQueries({ queryKey: ['accounts'] });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Capital Care</h1>
          <p className="text-sm font-medium text-body">
            Signed in as <span>{CURRENT_USER.id}</span>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 p-6">
        <section aria-label="Controls" className="space-y-4">
          <Card className="flex flex-wrap items-end gap-3 px-5 py-3">
            <Button
              variant="outline"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              ‹
            </Button>
            <label className="text-xs font-medium text-body">
              Month
              <select
                className={`${compactInput} mt-1`}
                value={monthText}
                onChange={(e) => setMonth(`${yearText}-${e.target.value}`)}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={String(i + 1).padStart(2, '0')}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-body">
              Year
              <select
                className={`${compactInput} mt-1`}
                value={yearText}
                onChange={(e) => setMonth(`${e.target.value}-${monthText}`)}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              ›
            </Button>
          </Card>
          <QuickAdd
            key={month}
            categories={categories.data ?? []}
            accounts={accounts.data ?? []}
            defaultDate={defaultDate}
            onCreated={refresh}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <FilterPanel
              title="Accounts"
              noun="account"
              noneLabel="Unassigned"
              withDescription={false}
              items={accounts.data ?? []}
              selected={accountFilter}
              onToggle={(id) => setAccountFilter(toggled(accountFilter, id))}
              onSave={saveAccount}
              onDelete={async (id) => {
                await api.deleteAccount(id);
                setAccountFilter((s) => {
                  const next = new Set(s);
                  next.delete(id);
                  return next;
                });
                await queryClient.invalidateQueries({ queryKey: ['accounts'] });
              }}
            />
            <FilterPanel
              title="Categories"
              noun="category"
              noneLabel="Uncategorized"
              withDescription
              items={categories.data ?? []}
              selected={categoryFilter}
              onToggle={(id) => setCategoryFilter(toggled(categoryFilter, id))}
              onSave={saveCategory}
              onDelete={async (id) => {
                await api.deleteCategory(id);
                setCategoryFilter((s) => {
                  const next = new Set(s);
                  next.delete(id);
                  return next;
                });
                await queryClient.invalidateQueries({ queryKey: ['categories'] });
              }}
            />
          </aside>

          <section aria-label="Transactions" className="min-w-0 space-y-3">
            {settleError ? (
              <p
                role="alert"
                className="rounded-card border border-hairline-strong bg-white p-3 text-sm text-error"
              >
                {settleError}
              </p>
            ) : null}
            {loadError ? (
              <Card>
                <p role="alert" className="mb-3 text-error">
                  {errorText(loadError)}
                </p>
                <Button
                  onClick={() => {
                    void transactions.refetch();
                    void balance.refetch();
                    void categories.refetch();
                    void accounts.refetch();
                  }}
                >
                  Try again
                </Button>
              </Card>
            ) : transactions.isPending ? (
              <Card>
                <p role="status">Loading transactions…</p>
              </Card>
            ) : groups.length === 0 ? (
              <Card>
                <p>No transactions this month</p>
              </Card>
            ) : (
              <Card className="overflow-hidden p-0">
                {groups.map((group) => (
                  <div key={group.date} className="border-b border-hairline last:border-b-0">
                    <h3 className="border-b border-hairline bg-mint-50 px-5 py-2 text-sm font-bold text-ink">
                      {groupTitle(group.date)}
                    </h3>
                    <ul>
                      {group.items.map((item) => (
                        <li
                          key={`${item.transactionId}-${item.date}`}
                          className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-5 py-2"
                        >
                          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                            <p className="break-words text-sm font-bold">{item.description}</p>
                            <p className="text-xs text-body">
                              <span>
                                {accountNames.get(item.accountId ?? NONE) ?? 'Unassigned'}
                              </span>
                              {' · '}
                              <span>
                                {categoryNames.get(item.categoryId ?? NONE) ?? 'Uncategorized'}
                              </span>
                            </p>
                          </div>
                          {item.recurrence || item.instalment ? (
                            <span
                              role="img"
                              aria-label="Recurring"
                              title="Recurring"
                              className="text-body"
                            >
                              ↻
                            </span>
                          ) : null}
                          <button
                            type="button"
                            aria-label={
                              item.status === 'settled' ? 'Mark as unsettled' : 'Mark as settled'
                            }
                            title={item.status === 'settled' ? 'Settled' : 'Forecast'}
                            onClick={() =>
                              settle.mutate({
                                id: item.transactionId,
                                date: item.date,
                                settled: item.status === 'settled',
                              })
                            }
                            className={`rounded-full px-2 text-sm font-bold ${
                              item.status === 'settled' ? 'bg-primary text-white' : 'text-muted'
                            }`}
                          >
                            <span aria-hidden="true">{item.status === 'settled' ? '✔' : '○'}</span>
                          </button>
                          <p
                            className={`ml-auto text-right text-sm font-bold sm:w-28 ${
                              item.type === 'receipt' ? 'text-primary' : 'text-ink'
                            }`}
                          >
                            {item.type === 'receipt' ? '+' : '-'}
                            {formatAmount(item.amount)}
                          </p>
                        </li>
                      ))}
                    </ul>
                    {group.balance !== null && (
                      <p
                        data-testid="day-balance"
                        className="px-5 pb-2 text-right text-xs font-medium text-muted"
                      >
                        Balance {formatAmount(group.balance)}
                      </p>
                    )}
                  </div>
                ))}
              </Card>
            )}

            <section
              aria-label="Monthly summary"
              className="rounded-card bg-primary-deep p-6 text-white"
            >
              {totals && (
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="flex justify-between gap-4">
                    <dt>Total received</dt>
                    <dd className="text-lg font-bold">{formatAmount(totals.received)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Total debits</dt>
                    <dd className="text-lg font-bold">{formatAmount(totals.debits)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Monthly net total</dt>
                    <dd className="text-lg font-bold">{formatAmount(totals.net)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Final available balance</dt>
                    <dd className="text-lg font-bold text-lime-panel">
                      {formatAmount(totals.finalBalance)}
                    </dd>
                  </div>
                </dl>
              )}
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                Back to top
              </Button>
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}
