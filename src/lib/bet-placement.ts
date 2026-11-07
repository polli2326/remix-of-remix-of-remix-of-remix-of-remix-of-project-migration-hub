import type { FortebetAccount } from "@/lib/account.functions";
import { TICKET_RULES } from "@/lib/ticket";

export type PlaceBetSelection = {
  oddsId: number;
  eventId: string;
  odds: number;
  live: boolean;
};

export type PlaceBetInput = {
  confirmed: boolean;
  stake: number;
  selections: PlaceBetSelection[];
};

export type BetPlacementTicket = {
  number: string;
  shortNumber: string;
};

export type BetPlacementResult =
  | {
      status: "accepted";
      message: string;
      ticket: BetPlacementTicket;
      account?: FortebetAccount;
    }
  | { status: "pending"; message: string; idTicket: string }
  | { status: "rejected"; message: string; code: string }
  | { status: "unknown"; message: string; idTicket?: string };

const round2 = (value: number) => Math.round(value * 100) / 100;
const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).slice(0, 120) : "";

export function validatePlaceBetInput(input: unknown): PlaceBetInput {
  if (!input || typeof input !== "object") throw new Error("Review and confirm the bet before continuing.");
  const value = input as Record<string, unknown>;
  if (value.confirmed !== true) throw new Error("Confirm the exact stake and selections before placing this real bet.");

  const stake = round2(Number(value.stake));
  if (!Number.isFinite(stake) || stake < TICKET_RULES.MIN_STAKE || stake > TICKET_RULES.MAX_STAKE) {
    throw new Error(`Enter a stake between ${TICKET_RULES.MIN_STAKE.toLocaleString("en-US")} and ${TICKET_RULES.MAX_STAKE.toLocaleString("en-US")} UGX.`);
  }
  if (!Array.isArray(value.selections) || value.selections.length < 1 || value.selections.length > TICKET_RULES.MAX_ITEMS) {
    throw new Error("Choose between 1 and 150 selections.");
  }

  const oddsIds = new Set<number>();
  const eventIds = new Set<string>();
  const selections = value.selections.map((item): PlaceBetSelection => {
    if (!item || typeof item !== "object") throw new Error("The bet slip contains an invalid selection.");
    const selection = item as Record<string, unknown>;
    const oddsId = Number(selection.oddsId);
    const odds = round2(Number(selection.odds));
    const eventId = typeof selection.eventId === "string" ? selection.eventId.slice(0, 80) : "";
    if (!Number.isSafeInteger(oddsId) || oddsId <= 0 || !Number.isFinite(odds) || odds < 1 || odds > 1_000_000 || !eventId) {
      throw new Error("The bet slip contains invalid odds. Refresh the offer and choose again.");
    }
    if (oddsIds.has(oddsId) || eventIds.has(eventId)) throw new Error("Choose only one outcome per match.");
    oddsIds.add(oddsId);
    eventIds.add(eventId);
    return { oddsId, eventId, odds, live: selection.live === true };
  });

  return { confirmed: true, stake, selections };
}

/** Exact sportsbook contract serialized by fortebet.ug's public ticket service. */
export function buildBetTicketData(input: PlaceBetInput) {
  const liveCount = input.selections.filter((selection) => selection.live).length;
  return {
    ticketData: {
      game: liveCount === input.selections.length ? "LIVE" : liveCount === 0 ? "PREMATCH" : "MIXED",
      type: "COMBI",
      wallet: "MONEY",
      totalStake: input.stake,
      application: "WEB_DESKTOP",
      language: "en",
      kioskName: null,
      combiGroupStakes: [],
      items: input.selections.map((selection) => ({
        groupId: 0,
        oddsId: selection.oddsId,
        odds: selection.odds,
      })),
    },
  } as const;
}

const BET_ERRORS: Record<string, string> = {
  ERR_CLIENT_NOT_LOGGED: "Your Fortebet session has expired. Sign in again before placing this bet.",
  ERR_BAD_REQUEST: "Fortebet rejected the ticket details. Refresh your selections and try again.",
  SB_AUTH_REJECTED: "Fortebet rejected this bet. No ticket was confirmed.",
  SB_CHECK_FAILED: "Fortebet could not accept this ticket. Review your selections and try again.",
  SB_INSUFFICIENT_FUNDS: "Your Fortebet balance is too low for this stake.",
  SB_NOT_ALLOWED: "Fortebet does not allow this ticket.",
  SB_ITEM_SUPPORTIVE_ODDS: "A selection no longer meets Fortebet’s odds requirements. Review your slip.",
  SB_ITEM_ODDS_CHANGED: "Odds changed before Fortebet accepted the ticket. Review the new odds and confirm again.",
  SB_ITEM_NOT_ACTIVE: "A selection is no longer active. Remove it or choose another outcome.",
  SB_VIP_CONDITIONS: "This ticket does not meet Fortebet’s VIP points conditions.",
  SB_MIN_STAKE: "The stake is below Fortebet’s minimum.",
  SB_MAX_STAKE: "The stake is above Fortebet’s maximum.",
  SB_MAX_WIN: "The possible win is above Fortebet’s maximum.",
  SB_WIN_LT_STAKE: "Fortebet does not allow a possible win lower than the stake.",
  SB_LIMIT_REACHED_STAKE_DAY: "You have reached your daily Fortebet stake limit.",
  SB_LIMIT_REACHED_STAKE_MONTH: "You have reached your monthly Fortebet stake limit.",
  SB_LIMIT_REACHED_LOSS_DAY: "You have reached your daily Fortebet loss limit.",
  SB_LIMIT_REACHED_LOSS_MONTH: "You have reached your monthly Fortebet loss limit.",
  SB_LIMIT_CHECK_FAILED: "Fortebet could not complete your account limit check. Try again later.",
  SB_RVO_CHECK_FAILED: "Fortebet could not complete the required account check. Try again later.",
};

export function betFailureMessage(code: string) {
  return BET_ERRORS[code] ?? "Fortebet did not accept this bet. Review your slip or try again later.";
}

/** Maps only Fortebet's explicit SB_AUTH_ACCEPTED state to success. */
export function parseBetPlacementResult(payload: unknown, httpOk: boolean): BetPlacementResult {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const envelopeCode = text(root.code);
  if (!httpOk || root.status !== "OK") {
    return { status: "rejected", code: envelopeCode || "ERR_INTERNAL", message: betFailureMessage(envelopeCode) };
  }

  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : {};
  const result = text(data.result);
  if (result === "SB_AUTH_ACCEPTED") {
    const ticket = data.ticket && typeof data.ticket === "object" ? (data.ticket as Record<string, unknown>) : {};
    const number = text(ticket.number) || text(data.idTicket);
    return {
      status: "accepted",
      message: number ? `Fortebet accepted your bet. Ticket ${number}.` : "Fortebet accepted your bet.",
      ticket: { number, shortNumber: text(ticket.shortNumber) },
    };
  }
  if (result === "SB_AUTH_PENDING") {
    const idTicket = text(data.idTicket);
    if (!idTicket) {
      return { status: "unknown", message: "Fortebet is processing the bet but returned no ticket reference. Check My Tickets before trying again." };
    }
    return { status: "pending", idTicket, message: "Fortebet is authorising this bet. Do not submit it again." };
  }

  const checks = Array.isArray(data.check) ? data.check : [];
  const codes = checks.flatMap((check) => {
    if (!check || typeof check !== "object") return [];
    const code = text((check as Record<string, unknown>).code);
    return code ? [code] : [];
  });
  const code = codes[0] || result || envelopeCode || "SB_CHECK_FAILED";
  return { status: "rejected", code, message: betFailureMessage(code) };
}

export const UNCONFIRMED_BET_MESSAGE =
  "The connection ended before Fortebet confirmed the result. Check My Tickets before placing this slip again; it may already have been accepted.";
