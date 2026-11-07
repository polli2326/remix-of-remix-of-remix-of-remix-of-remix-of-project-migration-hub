import { afterEach, beforeEach, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  getCookieHeader: vi.fn(() => "forte_session=test-session"),
  captureCookies: vi.fn(),
}));
const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-start/server', () => ({ setResponseHeader: vi.fn() }));

vi.mock("@/lib/account-session.server", () => ({
  getFortebetSessionCookieHeader: session.getCookieHeader,
  captureFortebetSessionCookies: session.captureCookies,
  clearFortebetSessionCookie: vi.fn(),
}));

import {
  loadPendingMobileMoney,
  submitMobileMoneyDeposit,
  submitMobileMoneyPayout,
} from "@/lib/account-service.server";

const accountResponse = () =>
  new Response(
    JSON.stringify({
      status: "OK",
      data: {
        nickname: "sample-user",
        firstname: "Sample",
        lastname: "User",
        wallets: [{ name: "money", balance: 25_000, currency: "UGX" }],
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

const apiResponse = (data: unknown) =>
  new Response(JSON.stringify({ status: "OK", data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  session.getCookieHeader.mockClear();
  session.captureCookies.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("sends a validated deposit to Fortebet with the logged-in server cookie", async () => {
  fetchMock
    .mockResolvedValueOnce(accountResponse())
    .mockResolvedValueOnce(apiResponse({ result: true, message: "Payment prompt sent." }));

  const result = await submitMobileMoneyDeposit(5_000);
  expect(result).toEqual({ ok: true, message: "Payment prompt sent." });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("https://fortebet.ug/api/web/v1/client/info");
  const paymentCall = fetchMock.mock.calls[1];
  if (!paymentCall) throw new Error('Expected a payment request');
  expect(paymentCall[0]).toBe("https://fortebet.ug/api/web/v1/mobilemoney/request-payin");
  const options = paymentCall[1] as RequestInit;
  expect(options.method).toBe("POST");
  expect((options.headers as Headers).get("Cookie")).toBe("forte_session=test-session");
  expect(JSON.parse(options.body as string)).toEqual({
    id_provider: -1,
    amount: 5_000,
    voucher: "",
  });
});

it("sends a payout through the working singular Fortebet route", async () => {
  fetchMock
    .mockResolvedValueOnce(accountResponse())
    .mockResolvedValueOnce(apiResponse({ result: true, message: "Withdrawal request received." }));

  const result = await submitMobileMoneyPayout(10_000);
  expect(result).toEqual({ ok: true, message: "Withdrawal request received." });
  const payoutCall = fetchMock.mock.calls[1];
  if (!payoutCall) throw new Error('Expected a payout request');
  expect(payoutCall[0]).toBe("https://fortebet.ug/api/web/v1/mobilemoney/request-payout");
  const options = payoutCall[1] as RequestInit;
  expect(JSON.parse(options.body as string)).toEqual({ amount: 10_000, id_provider: -1 });
});

it("loads pending payment requests and returns only the fields used by the UI", async () => {
  fetchMock.mockResolvedValueOnce(accountResponse()).mockResolvedValueOnce(
    apiResponse([
      {
        requestTimestamp: "2026-11-06T12:00:00Z",
        reference: "MM-123",
        amount: 7_500,
        internal: "not returned to the browser",
      },
    ]),
  );

  const result = await loadPendingMobileMoney("payin");
  expect(result).toEqual({
    ok: true,
    requests: [
      {
        requestTimestamp: "2026-11-06T12:00:00Z",
        reference: "MM-123",
        amount: 7_500,
      },
    ],
  });
  const pendingCall = fetchMock.mock.calls[1];
  if (!pendingCall) throw new Error('Expected a pending request lookup');
  expect(pendingCall[0]).toBe("https://fortebet.ug/api/web/v1/mobilemoney/pending-payins");
  expect(JSON.parse((pendingCall[1] as RequestInit).body as string)).toEqual({});
});

it("does not request a payout above the current logged-in balance", async () => {
  fetchMock.mockResolvedValueOnce(accountResponse());

  const result = await submitMobileMoneyPayout(25_001);
  expect(result).toEqual({
    ok: false,
    message: "The withdrawal amount exceeds your available balance.",
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
