export type ProfileChanges = {
  title: string; firstName: string; lastName: string; email: string;
  streetName: string; city: string; zipcode: string;
  currentPassword: string; newPassword: string; newPasswordAgain: string;
};

export function validateProfileChanges(input: ProfileChanges): ProfileChanges {
  if (!input || typeof input !== 'object') throw new Error('Enter your profile details.');
  const output = {} as ProfileChanges;
  for (const key of ['title','firstName','lastName','email','streetName','city','zipcode','currentPassword','newPassword','newPasswordAgain'] as const) {
    if (typeof input[key] !== 'string' || input[key].length > 256) throw new Error('Check your profile details.');
    output[key] = key.includes('Password') ? input[key] : input[key].trim();
  }
  if (!output.currentPassword) throw new Error('Enter your current password to save changes.');
  if (output.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(output.email)) throw new Error('Enter a valid email address.');
  if (output.newPassword !== output.newPasswordAgain) throw new Error('The new passwords do not match.');
  return output;
}

export function validateBranchAmount(input: {amount: unknown}) {
  const amount = Number(input?.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a valid whole-number withdrawal amount.');
  return {amount};
}

export type AccountRecordQuery = {path:string; filters:string[]; from:string; to:string; page:number};
export function validateRecordQuery(input: AccountRecordQuery): AccountRecordQuery {
  if (!input || !/^(transactions\/(money|pts)|bets\/(all|betting|prematch|live|virtual|vsoccer)|messages)$/.test(input.path)) throw new Error('Choose a valid account section.');
  if (!Array.isArray(input.filters) || input.filters.length > 8 || input.filters.some(f=>!['All','Win','Cashout','Placed','Lost','Void','Canceled','Deposits','Withdrawals','Money winnings','Money losses','VIP PTS winnings','VIP PTS losses','Transfers'].includes(f))) throw new Error('Choose valid filters.');
  for (const date of [input.from,input.to]) if (typeof date !== 'string' || date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose valid dates.');
  if (!Number.isSafeInteger(input.page) || input.page < 0 || input.page > 10000) throw new Error('Choose a valid page.');
  return input;
}
export function recordRequest(input: AccountRecordQuery) {
  const shared = {limit:31,offset:input.page*30,dateFrom:input.from || null,dateTo:input.to || null};
  if (input.path === 'messages') return {limit:31,offset:input.page*30,lang:'EN'};
  if (input.path.startsWith('transactions')) {
    const types: Record<string,string> = {'Deposits':'deposits','Withdrawals':'withdrawals','Money winnings':'moneyWin','Money losses':'moneyLost','VIP PTS winnings':'vipWin','VIP PTS losses':'vipLost','Transfers':'vipTransfer'};
    const type = input.filters.includes('All') ? 'all' : input.filters.map(f=>types[f]).filter(Boolean).join(',');
    return {...shared,wallet:input.path.endsWith('pts')?2:1,type:type || 'all'};
  }
  const state = input.filters.includes('All') ? [] : input.filters.flatMap(f=>f === 'Placed' ? ['PLACED','REPAIRED'] : [f.toUpperCase()]);
  const betTypes:Record<string,string> = {'all':'ALL','betting':'BETTING','prematch':'PREMATCH','live':'LIVE','virtual':'VIRTUAL','vsoccer':'VSOCCER'};
  return {...shared,state,betType:[betTypes[input.path.split('/')[1] ?? 'all'] ?? 'all']};
}