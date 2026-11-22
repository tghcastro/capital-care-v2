import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeLedgerDatabase, migrateLedger } from '@capital-care/ledger';
import { createApp } from '../src/app.js';

// Acceptance: the Monthly Balance PRD scenarios, one month per test, over the whole API app on a
// disposable database. Expected values are written as the PRD writes them ("2,321.00").
const ALICE = 'alice';
let dir: string;
let server: Server | undefined;
let base: string;
const savedDbPath = process.env.DB_PATH;

interface Balance {
  days: { date: string; balance: string }[];
  totals: { received: string; debits: string; net: string; finalBalance: string } | null;
}

interface Occurrence {
  transactionId: string;
  date: string;
  description: string;
  categoryId: string | null;
  accountId: string | null;
  amount: string;
  type: string;
}

const MONTHS: Record<string, string> = {
  'October 2026': '2026-10',
  'November 2026': '2026-11',
  'December 2026': '2026-12',
  'January 2027': '2027-01',
  'February 2027': '2027-02',
  'March 2027': '2027-03',
  'April 2027': '2027-04',
};

/** "2,321.00" -> "2321"; "-180.00" -> "-180"; "0.00" -> "0": the API's canonical decimal. */
function canonical(prd: string): string {
  const plain = prd.replace(/,/g, '');
  const [whole = '0', fraction = ''] = plain.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  const value = trimmed ? `${whole}.${trimmed}` : whole;
  return value === '-0' ? '0' : value;
}

let ids: { categories: Record<string, string>; accounts: Record<string, string> };

async function call(method: string, url: string, body?: unknown) {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: {
      'x-user-id': ALICE,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null };
}

async function create(url: string, body: unknown): Promise<string> {
  const response = await call('POST', url, body);
  expect(response.status).toBe(201);
  return (response.body as { id: string }).id;
}

const BACKGROUND: [string, string, string, string, string, 'Receipt' | 'Debit'][] = [
  ['2026-11-01', 'Salary - Acme', 'Income', 'Checking Account', '3,000.00', 'Receipt'],
  ['2026-11-10', 'New office chair', 'Shopping', 'Credit Card', '229.00', 'Debit'],
  ['2026-11-15', 'Condo fees', 'Housing', 'Checking Account', '450.00', 'Debit'],
  ['2026-12-01', 'Salary - Acme', 'Income', 'Checking Account', '3,000.00', 'Receipt'],
  ['2026-12-05', 'Dentist', 'Health', 'Checking Account', '120.00', 'Debit'],
  ['2026-12-10', 'Wireless keyboard', 'Shopping', 'Credit Card', '110.00', 'Debit'],
  ['2026-12-15', 'Condo fees', 'Housing', 'Checking Account', '450.00', 'Debit'],
  ['2027-01-01', 'Salary - Acme', 'Income', 'Checking Account', '3,000.00', 'Receipt'],
  ['2027-01-01', 'Dividends', 'Income', 'Checking Account', '1,000.00', 'Receipt'],
  ['2027-01-05', 'Condo fees', 'Housing', 'Checking Account', '450.00', 'Debit'],
  ['2027-01-05', 'Winter jacket', 'Shopping', 'Credit Card', '180.00', 'Debit'],
  ['2027-01-05', 'Gym', 'Leisure', 'Checking Account', '50.00', 'Debit'],
  ['2027-01-12', 'Supermarket', 'Groceries', 'Checking Account', '200.00', 'Debit'],
  ['2027-01-20', 'Running shoes', 'Shopping', 'Credit Card', '150.00', 'Debit'],
  ['2027-01-25', 'Supermarket', 'Groceries', 'Credit Card', '80.00', 'Debit'],
  ['2027-03-01', 'Salary - Acme', 'Income', 'Checking Account', '3,000.00', 'Receipt'],
];

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capital-care-monthly-balance-'));
  process.env.DB_PATH = path.join(dir, 'test.db');
  migrateLedger(process.env.DB_PATH);

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server?.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  // Background: the PRD's categories, accounts and transactions, recorded through the API.
  ids = { categories: {}, accounts: {} };
  for (const name of ['Income', 'Housing', 'Groceries', 'Shopping', 'Health', 'Leisure']) {
    ids.categories[name] = await create('/categories', { name });
  }
  for (const name of ['Checking Account', 'Credit Card']) {
    ids.accounts[name] = await create('/accounts', { name });
  }
  for (const [date, description, category, account, amount, type] of BACKGROUND) {
    await create('/transactions', {
      date,
      description,
      categoryId: ids.categories[category],
      accountId: ids.accounts[account],
      amount: canonical(amount),
      type: type === 'Receipt' ? 'receipt' : 'debit',
    });
  }
});

afterEach(async () => {
  const running = server;
  if (running) await new Promise((resolve) => running.close(resolve));
  server = undefined;
  closeLedgerDatabase();
  fs.rmSync(dir, { recursive: true, force: true });
  if (savedDbPath === undefined) Reflect.deleteProperty(process.env, 'DB_PATH');
  else process.env.DB_PATH = savedDbPath;
});

interface Filters {
  category?: string[];
  account?: string[];
}

function query(month: string, filters: Filters): string {
  const params = new URLSearchParams({ month: MONTHS[month] ?? month });
  for (const name of filters.category ?? []) params.append('category', ids.categories[name] ?? name);
  for (const name of filters.account ?? []) params.append('account', ids.accounts[name] ?? name);
  return params.toString();
}

/** When I view "<month>" (with the given filters): the balance route's answer. */
async function viewBalance(month: string, filters: Filters = {}): Promise<Balance> {
  const response = await call('GET', `/transactions/balance?${query(month, filters)}`);
  expect(response.status).toBe(200);
  return response.body as Balance;
}

async function viewList(month: string, filters: Filters = {}): Promise<Occurrence[]> {
  const response = await call('GET', `/transactions?${query(month, filters)}`);
  expect(response.status).toBe(200);
  return (response.body as { occurrences: Occurrence[] }).occurrences;
}

async function expectTotals(month: string, net: string, finalBalance: string, filters: Filters = {}) {
  const { totals } = await viewBalance(month, filters);
  expect(totals).not.toBeNull();
  expect(totals?.net).toBe(canonical(net));
  expect(totals?.finalBalance).toBe(canonical(finalBalance));
}

async function expectFinal(month: string, finalBalance: string, filters: Filters = {}) {
  const { totals } = await viewBalance(month, filters);
  expect(totals?.finalBalance).toBe(canonical(finalBalance));
}

async function expectDays(month: string, days: [string, string][], filters: Filters = {}) {
  const { days: actual } = await viewBalance(month, filters);
  expect(actual).toEqual(days.map(([date, balance]) => ({ date, balance: canonical(balance) })));
}

async function occurrenceOf(description: string, date: string): Promise<Occurrence> {
  const found = (await viewList(date.slice(0, 7))).find(
    (o) => o.description === description && o.date === date,
  );
  expect(found).toBeDefined();
  return found as Occurrence;
}

describe('Monthly balance without filters', () => {
  it('MB1 October 2026 has net 0.00 and final 0.00', async () => {
    await expectTotals('October 2026', '0.00', '0.00');
  });

  it('MB1 November 2026 has net 2,321.00 and final 2,321.00', async () => {
    await expectTotals('November 2026', '2,321.00', '2,321.00');
  });

  it('MB1 December 2026 has net 2,320.00 and final 4,641.00', async () => {
    await expectTotals('December 2026', '2,320.00', '4,641.00');
  });

  it('MB1 January 2027 has net 2,890.00 and final 7,531.00', async () => {
    await expectTotals('January 2027', '2,890.00', '7,531.00');
  });

  it('MB1 February 2027 has net 0.00 and final 7,531.00', async () => {
    await expectTotals('February 2027', '0.00', '7,531.00');
  });

  it('MB1 March 2027 has net 3,000.00 and final 10,531.00', async () => {
    await expectTotals('March 2027', '3,000.00', '10,531.00');
  });

  it('MB1 April 2027 has net 0.00 and final 10,531.00', async () => {
    await expectTotals('April 2027', '0.00', '10,531.00');
  });

  it('MB3 November 2026 day balances start from 0.00', async () => {
    await expectDays('November 2026', [
      ['2026-11-01', '3,000.00'],
      ['2026-11-10', '2,771.00'],
      ['2026-11-15', '2,321.00'],
    ]);
  });

  it('MB3 December 2026 day balances continue from the November closing balance', async () => {
    await expectDays('December 2026', [
      ['2026-12-01', '5,321.00'],
      ['2026-12-05', '5,201.00'],
      ['2026-12-10', '5,091.00'],
      ['2026-12-15', '4,641.00'],
    ]);
  });

  it('MB3 January 2027 shows one balance per day after all of its transactions', async () => {
    await expectDays('January 2027', [
      ['2027-01-01', '8,641.00'],
      ['2027-01-05', '7,961.00'],
      ['2027-01-12', '7,761.00'],
      ['2027-01-20', '7,611.00'],
      ['2027-01-25', '7,531.00'],
    ]);
  });

  it('MB3 March 2027 day balances continue from the February closing balance', async () => {
    await expectDays('March 2027', [['2027-03-01', '10,531.00']]);
  });

  it('MB5 February 2027 lists nothing and carries 7,531.00 forward to March', async () => {
    expect(await viewList('February 2027')).toEqual([]);
    const february = await viewBalance('February 2027');
    expect(february.days).toEqual([]);
    expect(february.totals?.finalBalance).toBe(canonical('7,531.00'));
    await expectDays('March 2027', [['2027-03-01', '10,531.00']]);
  });
});

describe('Monthly balance for Checking Account', () => {
  const checking: Filters = { account: ['Checking Account'] };

  it('MB6 November 2026 has net 2,550.00 and final 2,550.00', async () => {
    await expectTotals('November 2026', '2,550.00', '2,550.00', checking);
  });

  it('MB6 December 2026 has net 2,430.00 and final 4,980.00', async () => {
    await expectTotals('December 2026', '2,430.00', '4,980.00', checking);
  });

  it('MB6 January 2027 has net 3,300.00 and final 8,280.00', async () => {
    await expectTotals('January 2027', '3,300.00', '8,280.00', checking);
  });

  it('MB6 February 2027 has net 0.00 and final 8,280.00', async () => {
    await expectTotals('February 2027', '0.00', '8,280.00', checking);
  });

  it('MB7 January 2027 lists only Checking Account and continues from its closing balance', async () => {
    const listed = await viewList('January 2027', checking);
    expect(listed.length).toBe(5);
    expect(new Set(listed.map((o) => o.accountId))).toEqual(new Set([ids.accounts['Checking Account']]));
    await expectDays(
      'January 2027',
      [
        ['2027-01-01', '8,980.00'],
        ['2027-01-05', '8,480.00'],
        ['2027-01-12', '8,280.00'],
      ],
      checking,
    );
  });

  it('MB8 both accounts together in January 2027 have final 7,531.00', async () => {
    await expectTotals('January 2027', '2,890.00', '7,531.00', {
      account: ['Checking Account', 'Credit Card'],
    });
  });
});

describe('Monthly balance with a category filter', () => {
  it('MB10 Shopping in January 2027 starts at 0.00 and returns no totals', async () => {
    const filters: Filters = { category: ['Shopping'] };
    const listed = await viewList('January 2027', filters);
    expect(listed.map((o) => [o.date, o.description, o.categoryId, o.accountId, o.amount, o.type])).toEqual([
      ['2027-01-05', 'Winter jacket', ids.categories.Shopping, ids.accounts['Credit Card'], '180', 'debit'],
      ['2027-01-20', 'Running shoes', ids.categories.Shopping, ids.accounts['Credit Card'], '150', 'debit'],
    ]);
    const balance = await viewBalance('January 2027', filters);
    expect(balance.days).toEqual([
      { date: '2027-01-05', balance: canonical('-180.00') },
      { date: '2027-01-20', balance: canonical('-330.00') },
    ]);
    expect(balance.totals).toBeNull();
  });

  it('MB11 Groceries and Checking Account in January 2027 follow the category rule', async () => {
    const filters: Filters = { category: ['Groceries'], account: ['Checking Account'] };
    const listed = await viewList('January 2027', filters);
    expect(listed.map((o) => [o.date, o.description, o.categoryId, o.accountId, o.amount, o.type])).toEqual([
      ['2027-01-12', 'Supermarket', ids.categories.Groceries, ids.accounts['Checking Account'], '200', 'debit'],
    ]);
    const balance = await viewBalance('January 2027', filters);
    expect(balance.days).toEqual([{ date: '2027-01-12', balance: canonical('-200.00') }]);
    expect(balance.totals).toBeNull();
  });
});

describe('Monthly balance after changing a past transaction', () => {
  it('MB14 editing the amount of Dentist', async () => {
    const dentist = await occurrenceOf('Dentist', '2026-12-05');
    const edited = await call('PATCH', `/transactions/${dentist.transactionId}/occurrences/2026-12-05`, {
      amount: '220.00',
    });
    expect(edited.status).toBe(200);

    await expectFinal('December 2026', '4,541.00');
    await expectFinal('January 2027', '7,431.00');
    const { days } = await viewBalance('January 2027');
    expect(days[0]).toEqual({ date: '2027-01-01', balance: canonical('8,541.00') });
  });

  it('MB15 deleting New office chair', async () => {
    const chair = await occurrenceOf('New office chair', '2026-11-10');
    const deleted = await call('DELETE', `/transactions/${chair.transactionId}/occurrences/2026-11-10`);
    expect(deleted.status).toBe(204);

    await expectFinal('November 2026', '2,550.00');
    await expectFinal('December 2026', '4,870.00');
    await expectFinal('January 2027', '7,760.00');
  });

  it('MB16 moving Condo fees to the next month', async () => {
    const condo = await occurrenceOf('Condo fees', '2026-12-15');
    const moved = await call('PATCH', `/transactions/${condo.transactionId}/occurrences/2026-12-15`, {
      date: '2027-01-02',
    });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ transactionId: condo.transactionId, date: '2027-01-02', amount: '450' });

    await expectTotals('December 2026', '2,770.00', '5,091.00');
    await expectTotals('January 2027', '2,440.00', '7,531.00');
  });

  it('MB17 moving Wireless keyboard to Checking Account', async () => {
    const keyboard = await occurrenceOf('Wireless keyboard', '2026-12-10');
    const edited = await call('PATCH', `/transactions/${keyboard.transactionId}/occurrences/2026-12-10`, {
      accountId: ids.accounts['Checking Account'],
    });
    expect(edited.status).toBe(200);

    const checking: Filters = { account: ['Checking Account'] };
    await expectFinal('December 2026', '4,870.00', checking);
    await expectFinal('January 2027', '8,170.00', checking);
  });
});
