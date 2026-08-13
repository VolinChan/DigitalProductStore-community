import type { TransferPaymentAccount } from '@/types';

export interface PayeeGroup {
  accountName: string;
  rut: string;
  email: string;
  accounts: TransferPaymentAccount[];
}

export const normalizedTransferIdentity = (value: string) => value.trim().toLocaleLowerCase('und');

export function groupTransferAccounts(accounts: TransferPaymentAccount[]): PayeeGroup[] {
  const sorted = accounts.map((account, index) => ({ account, index })).sort((left, right) =>
    left.account.sort_order - right.account.sort_order
    || (left.account.id ?? Number.MAX_SAFE_INTEGER) - (right.account.id ?? Number.MAX_SAFE_INTEGER)
    || left.index - right.index);
  const groups = new Map<string, PayeeGroup>();
  sorted.forEach(({ account }) => {
    const key = [account.account_name, account.rut, account.email].map(normalizedTransferIdentity).join('\u0000');
    const current = groups.get(key);
    if (current) current.accounts.push(account);
    else groups.set(key, { accountName: account.account_name, rut: account.rut, email: account.email, accounts: [account] });
  });
  return [...groups.values()];
}
