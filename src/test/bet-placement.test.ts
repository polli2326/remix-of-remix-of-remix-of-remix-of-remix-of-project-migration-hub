import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBetTicketData,
  parseBetPlacementResult,
  validatePlaceBetInput,
  UNCONFIRMED_BET_MESSAGE,
  type PlaceBetInput,
} from "@/lib/bet-placement";

vi.mock("@tanstack/react-start/server", () => ({
  setResponseHeader: vi.fn(),
  getRequest: () => new Request("https://app.example/_server", { headers: { origin: "https://app.example", "sec-fetch-site": "same-origin" } }),
}));
vi.mock("@/lib/account-session.server", () => ({
  getFortebetSessionCookieHeader: () => "session=test",
  captureFortebetSessionCookies: vi.fn(),
  clearFortebetSessionCookie: vi.fn(),
}));

import { checkFortebetBetAuthorization, submitFortebetBet } from "@/lib/bet-placement.server";

const input: PlaceBetInput = {
  confirmed: true,
  stake: 2000,
  selections: [{ oddsId: 123456, eventId: "MA76515564", odds: 1.85, live: false }],
};
const fetchMock = vi.fn();
const apiResponse = (data: unknown) => new Response(JSON.stringify({ status: "OK", data }));
const accountResponse = () => apiResponse({ nickname: "sample", wallets: [{ name: "money", balance: 25000, currency: "UGX" }] });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("Fortebet bet contract", () => {
  it("uses COMBI and group zero for a one-selection prematch ticket", () => {
    expect(buildBetTicketData(input)).toEqual({
      ticketData: {
        game: "PREMATCH",
        type: "COMBI",
        wallet: "MONEY",
        totalStake: 2000,
        application: "WEB_DESKTOP",
        language: "en",
        kioskName: null,
        combiGroupStakes: [],
        items: [{ groupId: 0, oddsId: 123456, odds: 1.85 }],
      },
    });
  });

  it("keeps mixed live and prematch selections in one COMBI ticket", () => {
    const mixed = { ...input, selections: [...input.selections, { oddsId: 987654, eventId: "MA2", odds: 2.1, live: true }] };
    expect(buildBetTicketData(mixed).ticketData).toMatchObject({ game: "MIXED", type: "COMBI", items: [{ groupId: 0, oddsId: 123456, odds: 1.85 }, { groupId: 0, oddsId: 987654, odds: 2.1 }] });
  });

  it("requires explicit real-money confirmation", () => {
    expect(() => validatePlaceBetInput({ ...input, confirmed: false })).toThrow("Confirm");
  });

  it("enforces the 1,000 to 5,000,000 UGX stake limits", () => {
    expect(() => validatePlaceBetInput({ ...input, stake: 999 })).toThrow("1,000");
    expect(() => validatePlaceBetInput({ ...input, stake: 5_000_001 })).toThrow("5,000,000");
    expect(validatePlaceBetInput({ ...input, stake: 5000 }).stake).toBe(5000);
  });

  it("rejects two outcomes from the same match", () => {
    expect(() => validatePlaceBetInput({ ...input, selections: [...input.selections, { ...input.selections[0]!, oddsId: 999 }] })).toThrow("one outcome per match");
  });
});

describe("Fortebet result handling", () => {
  it("shows success only for SB_AUTH_ACCEPTED", () => {
    expect(parseBetPlacementResult({ status: "OK", data: { result: "SB_AUTH_ACCEPTED", ticket: { number: "T-900", shortNumber: "900" } } }, true)).toMatchObject({ status: "accepted", ticket: { number: "T-900", shortNumber: "900" } });
  });

  it("treats an empty or unrecognised submission answer as unconfirmed", () => {
    expect(parseBetPlacementResult(null, true)).toEqual({ status: "unknown", message: UNCONFIRMED_BET_MESSAGE });
    expect(parseBetPlacementResult({ status: "OK", data: {} }, true)).toEqual({ status: "unknown", message: UNCONFIRMED_BET_MESSAGE });
  });

  it("does not treat a pending bet as placed", () => {
    expect(parseBetPlacementResult({ status: "OK", data: { result: "SB_AUTH_PENDING", idTicket: 7654 } }, true)).toEqual({ status: "pending", idTicket: "7654", message: "Fortebet is authorising this bet. Do not submit it again." });
  });

  it("requires fresh confirmation when Fortebet reports changed odds", () => {
    expect(parseBetPlacementResult({ status: "OK", data: { result: "SB_CHECK_FAILED", check: [{ code: "SB_ITEM_ODDS_CHANGED", params: { oddsId: 123456, oddsAfter: 1.9 } }] } }, true)).toMatchObject({ status: "rejected", code: "SB_ITEM_ODDS_CHANGED" });
  });

  it("submits only once when the connection result is unknown", async () => {
    fetchMock.mockResolvedValueOnce(accountResponse()).mockRejectedValueOnce(new Error("connection ended"));
    expect(await submitFortebetBet(input)).toEqual({ status: "unknown", message: UNCONFIRMED_BET_MESSAGE });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://fortebet.ug/api/web/v1/ticket/sbt-submit");
  });

  it("does not submit a stake above the verified real balance", async () => {
    fetchMock.mockResolvedValueOnce(accountResponse());
    expect(await submitFortebetBet({ ...input, stake: 25001 })).toMatchObject({ status: "rejected", code: "SB_INSUFFICIENT_FUNDS" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("checks a pending ticket reference without resubmitting the bet", async () => {
    fetchMock.mockResolvedValueOnce(apiResponse({ result: "SB_AUTH_ACCEPTED", ticket: { number: "T-1" } })).mockResolvedValueOnce(accountResponse());
    expect(await checkFortebetBetAuthorization("PENDING-1")).toMatchObject({ status: "accepted", ticket: { number: "T-1" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://fortebet.ug/api/web/v1/ticket/sbt-check-auth");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ number: "PENDING-1" });
  });
});
