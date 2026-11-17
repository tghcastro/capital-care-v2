import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, Card, compactInput } from '../components/ui';
import { FilterPanel, type PanelValues } from '../features/ledger/FilterPanel';
import { buildLedger, NONE } from '../features/transaction/ledgerView';
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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const [categoryFilter, setCategoryFilter] = useState<ReadonlySet<string>>(new Set());
  const [accountFilter, setAccountFilter] = useState<ReadonlySet<string>>(new Set());
  const [settleError, setSettleError] = useState<string | null>(null);

  const transactions = useQuery({
    queryKey: ['transactions', month],
    queryFn: () => api.listMonth(month),
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
  const { groups, totals } = useMemo(
    () =>
      buildLedger(transactions.data ?? [], { categories: categoryFilter, accounts: accountFilter }),
    [transactions.data, categoryFilter, accountFilter]
  );

  const [yearText, monthText] = month.split('-') as [string, string];
  const year = Number(yearText);
  const years = Array.from({ length: 11 }, (_, i) => year - 5 + i);
  const defaultDate = (() => {
    const today = new Date();
    return monthOf(today) === month
      ? `${month}-${String(today.getDate()).padStart(2, '0')}`
      : `${month}-01`;
  })();

  const loadError = transactions.error ?? categories.error ?? accounts.error;

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
      <header className="bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-2xl font-black">Capital Care</h1>
          <p className="text-sm font-semibold">
            Signed in as <span>{CURRENT_USER.id}</span>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 p-6">
        <section aria-label="Controls" className="space-y-4">
          <Card className="flex flex-wrap items-end gap-3 px-5 py-3">
            <Button
              variant="secondary"
              className="min-h-10 px-4 py-2"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              ‹
            </Button>
            <label className="text-sm font-semibold">
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
            <label className="text-sm font-semibold">
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
              variant="secondary"
              className="min-h-10 px-4 py-2"
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
          </aside>

          <section aria-label="Transactions" className="min-w-0 space-y-3">
            {settleError ? (
              <p role="alert" className="rounded-input bg-white p-3 text-sm text-negative-deep">
                {settleError}
              </p>
            ) : null}
            {loadError ? (
              <Card>
                <p role="alert" className="mb-3 text-negative-deep">
                  {errorText(loadError)}
                </p>
                <Button
                  onClick={() => {
                    void transactions.refetch();
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
                  <div key={group.date} className="border-b border-canvas-soft last:border-b-0">
                    <h3 className="bg-canvas-soft/60 px-5 py-2 text-sm font-semibold text-body">
                      {groupTitle(group.date)}
                    </h3>
                    <ul>
                      {group.items.map((item) => (
                        <li
                          key={`${item.transactionId}-${item.date}`}
                          className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-5 py-2"
                        >
                          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                            <p className="break-words text-sm font-semibold">{item.description}</p>
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
                            className={`rounded-full px-2 text-sm font-semibold ${
                              item.status === 'settled'
                                ? 'bg-primary-pale text-positive-deep'
                                : 'text-mute'
                            }`}
                          >
                            <span aria-hidden="true">{item.status === 'settled' ? '✔' : '○'}</span>
                          </button>
                          <p
                            className={`ml-auto text-right text-sm font-semibold sm:w-28 ${
                              item.type === 'receipt' ? 'text-positive-deep' : 'text-ink'
                            }`}
                          >
                            {item.type === 'receipt' ? '+' : '-'}
                            {formatAmount(item.amount)}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <p
                      data-testid="day-balance"
                      className="px-5 pb-2 text-right text-xs font-semibold text-body"
                    >
                      Balance {formatAmount(group.balance)}
                    </p>
                  </div>
                ))}
              </Card>
            )}

            <section
              aria-label="Monthly summary"
              className="rounded-card bg-ink p-6 text-canvas-soft"
            >
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <dt>Total received</dt>
                  <dd className="font-semibold text-primary">{formatAmount(totals.received)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Total debits</dt>
                  <dd className="font-semibold">{formatAmount(totals.debits)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Monthly net total</dt>
                  <dd className="font-semibold">{formatAmount(totals.net)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Final available balance</dt>
                  <dd className="font-semibold text-primary">
                    {formatAmount(totals.finalBalance)}
                  </dd>
                </div>
              </dl>
              <Button
                variant="primary"
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
