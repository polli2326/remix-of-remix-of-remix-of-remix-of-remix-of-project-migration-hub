// Ticket rules mirrored from Fortebet's public /global/config (WEB.*).
export const TICKET_RULES = {
  MIN_STAKE: 1000,
  MAX_STAKE: 5_000_000,
  MAX_WIN: 1_000_000_000,
  DEFAULT_STAKE: 2000,
  MAX_ITEMS: 150,
  VIP_MIN_TOTAL_ODDS: 1,
  VIP_LEVELS: [
    { items: 1, ratio: 0.001 },
    { items: 3, ratio: 0.002 },
    { items: 5, ratio: 0.003 },
    { items: 7, ratio: 0.004 },
    { items: 10, ratio: 0.006 },
    { items: 13, ratio: 0.008 },
    { items: 16, ratio: 0.01 },
  ],
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function totalOdds(odds: number[]) {
  return odds.length ? odds.reduce((a, b) => a * b, 1) : 0;
}

export function possibleWin(stake: number, total: number) {
  if (!stake || !total) return 0;
  return Math.min(round2(stake * total), TICKET_RULES.MAX_WIN);
}

export function vipRatio(items: number) {
  let r = 0;
  for (const l of TICKET_RULES.VIP_LEVELS) if (items >= l.items) r = l.ratio;
  return r;
}

export function vipPoints(stake: number, items: number, total: number) {
  if (items < 1 || total < TICKET_RULES.VIP_MIN_TOTAL_ODDS) return 0;
  return Math.floor(stake * vipRatio(items));
}

export function stakeError(stake: number): string | null {
  if (!Number.isFinite(stake) || stake < TICKET_RULES.MIN_STAKE) return `Minimum stake is ${TICKET_RULES.MIN_STAKE.toLocaleString("en-US")} UGX`;
  if (stake > TICKET_RULES.MAX_STAKE) return `Maximum stake is ${TICKET_RULES.MAX_STAKE.toLocaleString("en-US")} UGX`;
  return null;
}
