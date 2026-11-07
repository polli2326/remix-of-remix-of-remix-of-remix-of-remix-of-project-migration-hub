import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { captureFortebetSessionCookies, getFortebetSessionCookieHeader } from "@/lib/account-session.server";
import { loadFortebetAccount } from "@/lib/account-service.server";
import {
  buildBetTicketData,
  parseBetPlacementResult,
  UNCONFIRMED_BET_MESSAGE,
  type BetPlacementResult,
  type PlaceBetInput,
} from "@/lib/bet-placement";

const API_BASE = "https://fortebet.ug/api/web/v1";

function verifyMutationCaller() {
  const request = getRequest();
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new Error("Cross-site bet placement is not allowed.");
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    throw new Error("Cross-site bet placement is not allowed.");
  }
}

async function requestBet(path: string, body: unknown) {
  setResponseHeader("Cache-Control", "no-store");
  const cookie = getFortebetSessionCookieHeader();
  if (!cookie) {
    return {
      response: new Response(null, { status: 401 }),
      payload: { status: "ERROR", code: "ERR_CLIENT_NOT_LOGGED" },
    };
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  captureFortebetSessionCookies(response);
  const payload: unknown = await response.json().catch(() => null);
  return { response, payload };
}

async function withRefreshedAccount(result: BetPlacementResult): Promise<BetPlacementResult> {
  if (result.status !== "accepted") return result;
  const account = await loadFortebetAccount(8_000).catch(() => null);
  return account?.ok ? { ...result, account: account.account } : result;
}

export async function submitFortebetBet(input: PlaceBetInput): Promise<BetPlacementResult> {
  try {
    verifyMutationCaller();
  } catch {
    return { status: "rejected", code: "ERR_BAD_REQUEST", message: "This bet must be confirmed from the app." };
  }

  const account = await loadFortebetAccount(12_000);
  if (!account.ok) {
    return account.reason === "unavailable"
      ? { status: "rejected", code: "ACCOUNT_UNAVAILABLE", message: "Unable to confirm your Fortebet account. No bet was submitted; please try again." }
      : { status: "rejected", code: "ERR_CLIENT_NOT_LOGGED", message: "Sign in to your Fortebet account before placing a real bet." };
  }
  if (input.stake > account.account.balance) {
    return { status: "rejected", code: "SB_INSUFFICIENT_FUNDS", message: "Your Fortebet balance is too low for this stake." };
  }

  // Deliberately submit once. A network retry could duplicate an accepted wager.
  try {
    const { response, payload } = await requestBet("/ticket/sbt-submit", buildBetTicketData(input));
    return withRefreshedAccount(parseBetPlacementResult(payload, response.ok));
  } catch {
    return { status: "unknown", message: UNCONFIRMED_BET_MESSAGE };
  }
}

export async function checkFortebetBetAuthorization(idTicket: string): Promise<BetPlacementResult> {
  try {
    verifyMutationCaller();
  } catch {
    return { status: "unknown", idTicket, message: "Unable to check this ticket from the current window. Open My Tickets for its status." };
  }

  try {
    const { response, payload } = await requestBet("/ticket/sbt-check-auth", { number: idTicket });
    return withRefreshedAccount(parseBetPlacementResult(payload, response.ok));
  } catch {
    return { status: "unknown", idTicket, message: UNCONFIRMED_BET_MESSAGE };
  }
}
