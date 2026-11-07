import type { FortebetClientRecord, FortebetRecordValue } from './account.functions';

export function recordObject(value: unknown): Record<string, FortebetRecordValue> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, FortebetRecordValue> : {};
}
export function recordRows(record?: FortebetClientRecord): Record<string, FortebetRecordValue>[] {
  if (!record?.ok) return [];
  const data = record.data;
  const object = recordObject(data);
  const rows = Array.isArray(data) ? data : object.items ?? object.records ?? object.tickets ?? object.messages ?? [];
  return Array.isArray(rows) ? rows.map(recordObject) : [];
}
export function accountText(value: unknown) { return typeof value === 'string' || typeof value === 'number' ? String(value) : ''; }
export const accountLinks = [
  ['Deposits & Withdrawals', 'deposit', 'wallet'],
  ['Transactions', '', 'transactions'],
  ['Transactions UGX', 'transactions/money', 'child'],
  ['Transactions VIP PTS', 'transactions/pts', 'child'],
  ['All tickets', 'bets/all', 'ticket'],
  ['Betting tickets', 'bets/betting', 'ticket'],
  ['Prematch tickets', 'bets/prematch', 'child'],
  ['Live tickets', 'bets/live', 'child'],
  ['Virtual tickets', 'bets/virtual', 'ticket'],
  ['Virtual soccer tickets', 'bets/vsoccer', 'child'],
  ['Profile', 'profile', 'profile'],
  ['Messages', 'messages', 'messages'],
] as const;
export function accountPageTitle(path: string) {
  return accountLinks.find(([, target]) => path === target)?.[0] ?? (path.startsWith('deposits/') ? 'Depositing money' : path.startsWith('withdrawals/') ? 'Withdrawal' : 'All tickets');
}