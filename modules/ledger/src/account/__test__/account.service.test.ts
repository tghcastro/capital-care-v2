import { describe, it, expect, beforeEach } from 'vitest';
import { AccountService } from '../account.service.js';
import { MockAccountRepository } from './mocks/account.repository.mock.js';
import { ConflictError } from '../../shared/errors.js';

let repository: MockAccountRepository;
let service: AccountService;

beforeEach(() => {
  repository = new MockAccountRepository();
  service = new AccountService(repository, 5);
});

function createMany(svc: AccountService, userId: string, count: number): void {
  for (let i = 1; i <= count; i++) svc.createAccount({ userId, name: `Account ${i}` });
}

describe('Account rename', () => {
  it('C6 rename to its own name or only its casing succeeds', () => {
    const account = service.createAccount({ userId: 'u1', name: 'Cash' });

    expect(service.renameAccount(account.id, { userId: 'u1', name: 'Cash' }).name).toBe('Cash');

    const lower = service.renameAccount(account.id, { userId: 'u1', name: 'cash' });
    expect(lower.name).toBe('cash');
    expect(service.renameAccount(account.id, { userId: 'u1', name: 'Cash' }).name).toBe('Cash');
  });

  it('C14 rename rejects a name taken by another account', () => {
    const cash = service.createAccount({ userId: 'u1', name: 'Cash' });
    const bank = service.createAccount({ userId: 'u1', name: 'Bank A' });

    expect(() => service.renameAccount(bank.id, { userId: 'u1', name: 'cash' })).toThrow(
      ConflictError,
    );

    expect(service.getAccount(bank.id, 'u1').name).toBe('Bank A');
    expect(service.getAccount(cash.id, 'u1').name).toBe('Cash');
  });
});

describe('Account uniqueness', () => {
  it('C13 create rejects a name taken ignoring case', () => {
    service.createAccount({ userId: 'u1', name: 'Cash' });
    expect(() => service.createAccount({ userId: 'u1', name: 'cash' })).toThrow(ConflictError);

    service.createAccount({ userId: 'u1', name: 'Poupança' });
    expect(() => service.createAccount({ userId: 'u1', name: 'POUPANÇA' })).toThrow(ConflictError);

    // The same name typed decomposed (c + combining cedilla) is the same name.
    expect(() => service.createAccount({ userId: 'u1', name: 'Poupanc\u0327a' })).toThrow(
      ConflictError,
    );

    expect(service.createAccount({ userId: 'u1', name: 'Cash 2' }).name).toBe('Cash 2');
    expect(service.listAccounts('u1')).toHaveLength(3);
  });
});

describe('Account limit', () => {
  it('C19 create is rejected at the limit and the message states it', () => {
    createMany(service, 'u1', 4);
    expect(service.createAccount({ userId: 'u1', name: 'Fifth' }).name).toBe('Fifth');

    let message = '';
    try {
      service.createAccount({ userId: 'u1', name: 'Sixth' });
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      message = (err as Error).message;
    }
    expect(message).toMatch(/\b5\b/);
    expect(service.listAccounts('u1')).toHaveLength(5);
  });

  it('C20 deleting an account at the limit frees a slot', () => {
    createMany(service, 'u1', 5);
    expect(() => service.createAccount({ userId: 'u1', name: 'Extra' })).toThrow(ConflictError);

    const [first] = service.listAccounts('u1');
    service.deleteAccount(first?.id ?? '', 'u1');

    expect(service.createAccount({ userId: 'u1', name: 'Extra' }).name).toBe('Extra');
  });

  it('C21 the limit counts each user separately', () => {
    createMany(service, 'u1', 5);
    createMany(service, 'u2', 5);

    expect(() => service.createAccount({ userId: 'u1', name: 'Extra' })).toThrow(ConflictError);
    expect(() => service.createAccount({ userId: 'u2', name: 'Extra' })).toThrow(ConflictError);
    expect(service.createAccount({ userId: 'u3', name: 'Extra' }).userId).toBe('u3');
  });

  it('C22 a lowered limit keeps existing accounts and blocks new ones', () => {
    createMany(new AccountService(repository, 10), 'u1', 7);
    const lowered = new AccountService(repository, 5);

    expect(lowered.listAccounts('u1')).toHaveLength(7);
    expect(() => lowered.createAccount({ userId: 'u1', name: 'Extra' })).toThrow(ConflictError);

    const accounts = lowered.listAccounts('u1');
    lowered.deleteAccount(accounts[0]?.id ?? '', 'u1');
    lowered.deleteAccount(accounts[1]?.id ?? '', 'u1');
    expect(lowered.listAccounts('u1')).toHaveLength(5);
    expect(() => lowered.createAccount({ userId: 'u1', name: 'Extra' })).toThrow(ConflictError);

    lowered.deleteAccount(accounts[2]?.id ?? '', 'u1');
    expect(lowered.createAccount({ userId: 'u1', name: 'Extra' }).name).toBe('Extra');
  });
});
