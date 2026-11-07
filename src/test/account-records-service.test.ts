import { afterEach, beforeEach, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  getCookieHeader: vi.fn(() => "forte_session=test-session"),
  captureCookies: vi.fn(),
}));
const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-start/server',()=>({setResponseHeader:vi.fn()}));

vi.mock("@/lib/account-session.server", () => ({
  getFortebetSessionCookieHeader: session.getCookieHeader,
  captureFortebetSessionCookies: session.captureCookies,
  clearFortebetSessionCookie: vi.fn(),
}));

import { loadSignedInAccountActivity } from "@/lib/account-service.server";

const apiResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ status: "OK", data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const accountResponse = () =>
  apiResponse({
    nickname: "sample-user",
    firstname: "Sample",
    lastname: "User",
    wallets: [{ name: "money", balance: 25_000, currency: "UGX" }],
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

it("loads only the signed-in account's own profile and activity records", async () => {
  fetchMock.mockImplementation(async (input: string) => {
    const path = input.replace("https://fortebet.ug/api/web/v1", "");
    if (path === "/client/info") return accountResponse();
    if (path === "/client/profile/get") {
      return apiResponse({ firstName: "Sample", passwordHash: "must not reach browser" });
    }
    if (path === "/client/preferences/get") return apiResponse({ language: "EN" });
    if (path === "/client/transactions/get") return apiResponse([{ amount: 2_000 }]);
    if (path === "/client/tickets/get") return apiResponse([{ ticket: "T-1" }]);
    if (path === "/client/messages/get") return apiResponse([]);
    if (path === "/client/alive") return apiResponse(true);
    throw new Error(`Unexpected Fortebet path: ${path}`);
  });

  const result = await loadSignedInAccountActivity();

  expect(result).toMatchObject({
    ok: true,
    account: { nickname: "sample-user", balance: 25_000 },
    profile: { ok: true, data: { firstName: "Sample" } },
    preferences: { ok: true, data: { language: "EN" } },
    transactions: { ok: true, data: [{ amount: 2_000 }] },
    tickets: { ok: true, data: [{ ticket: "T-1" }] },
    messages: { ok: true, data: [] },
    session: { ok: true, data: true },
  });
  expect(JSON.stringify(result)).not.toContain("passwordHash");

  const calls = fetchMock.mock.calls as [string, RequestInit][];
  expect(calls).toHaveLength(7);
  for (const [url, options] of calls) {
    expect(url).toMatch(/^https:\/\/fortebet\.ug\/api\/web\/v1\/client\//);
    expect(options.method).toBe("POST");
    expect((options.headers as Headers).get("Cookie")).toBe("forte_session=test-session");
    const body = JSON.parse(options.body as string);
    if(url.endsWith('/transactions/get')) expect(body).toEqual({limit:31,offset:0,dateFrom:null,dateTo:null,wallet:1,type:'all'});
    else if(url.endsWith('/tickets/get')) expect(body).toEqual({limit:31,offset:0,dateFrom:null,dateTo:null,state:[],betType:['ALL']});
    else if(url.endsWith('/messages/get')) expect(body).toEqual({limit:31,offset:0,lang:'EN'});
    else expect(body).toEqual({});
  }
});

it("does not request client records when the signed-in account check fails", async () => {
  fetchMock.mockResolvedValueOnce(apiResponse(null, 401));

  const result = await loadSignedInAccountActivity();

  expect(result).toEqual({
    ok: false,
    message: "Sign in to view your Fortebet account activity.",
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("keeps available sections when one Fortebet record endpoint fails", async () => {
  fetchMock.mockImplementation(async (input: string) => {
    const path = input.replace("https://fortebet.ug/api/web/v1", "");
    if (path === "/client/info") return accountResponse();
    if (path === "/client/transactions/get") return apiResponse({ message: "Unavailable" }, 503);
    return apiResponse([]);
  });

  const result = await loadSignedInAccountActivity();

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.profile).toEqual({ ok: true, data: [] });
    expect(result.transactions.ok).toBe(false);
    expect(result.tickets).toEqual({ ok: true, data: [] });
  }
});
