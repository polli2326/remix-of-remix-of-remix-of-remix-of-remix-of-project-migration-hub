import {
  captureFortebetSessionCookies,
  getFortebetSessionCookieHeader,
} from "@/lib/account-session.server";
import type {
  AccountActionResult,
  FortebetAccount,
  FortebetAccountResult,
  FortebetClientRecord,
  FortebetRecordValue,
  MobileMoneyActionResult,
  MobileMoneyPendingRequest,
  MobileMoneyPendingResult,
  RegistrationCountry,
  RegistrationGuideResult,
  SignedInAccountActivityResult,
} from "@/lib/account.functions";
import { clearFortebetSessionCookie } from "@/lib/account-session.server";
import { setResponseHeader } from '@tanstack/react-start/server';
import { recordRequest, type AccountRecordQuery, type ProfileChanges } from './account-inputs';

const API_BASE = "https://fortebet.ug/api/web/v1";
const PAYIN_PATH = "/mobilemoney/request-payin";
const PAYOUT_PATH = "/mobilemoney/request-payout";
const COUNTRY_CACHE_MS = 10 * 60 * 1000;
const GUIDE_NAME = "WIDGETS/HOW TO REGISTER SHORT";

type ApiPayload = {
  status?: string;
  code?: string;
  message?: string;
  data?: unknown;
};

type RegistrationInput = {
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  email: string;
  birthdate: string;
  nationality: string;
  recordNumber: string;
  promo: string;
  termsAccepted: boolean;
};

type ApiAccount = {
  nickname?: unknown;
  firstname?: unknown;
  lastname?: unknown;
  wallets?: unknown;
};

type MobileMoneyApiResult = {
  result?: unknown;
  message?: unknown;
  subMessage?: unknown;
  textInstructions?: unknown;
  error?: unknown;
};

let countryCache: { expiresAt: number; countries: RegistrationCountry[] } | undefined;
let guideCache: { expiresAt: number; html: string } | undefined;

async function requestFortebet(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  timeoutMs?: number,
): Promise<{ response: Response; payload: ApiPayload | null }> {
  const headers = new Headers({ Accept: "application/json" });
  setResponseHeader('Cache-Control', 'no-store');
  const cookie = getFortebetSessionCookieHeader();
  if (cookie) headers.set("Cookie", cookie);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const request: RequestInit = { method, headers };
  if (body !== undefined) request.body = JSON.stringify(body);
  if (timeoutMs !== undefined) request.signal = AbortSignal.timeout(timeoutMs);
  const response = await fetch(`${API_BASE}${path}`, request);
  captureFortebetSessionCookies(response);

  const payload = (await response.json().catch(() => null)) as ApiPayload | null;
  return { response, payload };
}

function apiFailureMessage(payload: ApiPayload | null, fallback: string): string {
  const data = payload?.data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const value of [record["error"], record["message"], payload?.message]) {
      if (typeof value === "string" && value.trim()) return value.trim().slice(0, 240);
    }
    const checks = record["checks"];
    if (Array.isArray(checks)) {
      const readable = checks
        .map((check) => {
          if (!check || typeof check !== "object") return "";
          const item = check as Record<string, unknown>;
          return [item["attr_name"], item["error"]]
            .filter((part) => typeof part === "string")
            .join(": ");
        })
        .filter(Boolean)
        .slice(0, 4);
      if (readable.length) return readable.join(" · ").slice(0, 240);
    }
  }
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim().slice(0, 240);
  }
  return fallback;
}

function accountFromApi(data: unknown, fallbackNickname = ""): FortebetAccount | null {
  if (!data || typeof data !== "object") return null;
  const client = data as ApiAccount;
  const nickname =
    typeof client.nickname === "string" && client.nickname ? client.nickname : fallbackNickname;
  if (!nickname) return null;

  const wallets = Array.isArray(client.wallets) ? client.wallets : [];
  const moneyWallet = wallets.find(
    (wallet) =>
      Boolean(wallet) &&
      typeof wallet === "object" &&
      String((wallet as Record<string, unknown>)["name"]).toLowerCase() === "money",
  ) as Record<string, unknown> | undefined;
  const firstName = typeof client.firstname === "string" ? client.firstname.trim() : "";
  const lastName = typeof client.lastname === "string" ? client.lastname.trim() : "";
  const parsedBalance = Number(moneyWallet?.["balance"] ?? 0);

  return {
    nickname,
    displayName: [firstName, lastName].filter(Boolean).join(" ") || nickname,
    balance: Number.isFinite(parsedBalance) ? parsedBalance : 0,
    currency: typeof moneyWallet?.["currency"] === "string" ? moneyWallet["currency"] : "UGX",
  };
}

function isLoggedAccount(
  account: FortebetAccountResult,
): account is { ok: true; account: FortebetAccount } {
  return account.ok;
}

function readMobileMoneyMessage(data: MobileMoneyApiResult | null | undefined, fallback: string) {
  for (const value of [data?.message, data?.subMessage, data?.error]) {
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 300);
  }
  return fallback;
}

function pendingRequestsFromApi(data: unknown): MobileMoneyPendingRequest[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const amount = Number(row["amount"]);
    return [
      {
        requestTimestamp:
          typeof row["requestTimestamp"] === "string" ? row["requestTimestamp"].slice(0, 80) : "",
        reference: typeof row["reference"] === "string" ? row["reference"].slice(0, 120) : "",
        amount: Number.isFinite(amount) ? amount : 0,
      },
    ];
  });
}

function safeClientRecordValue(value: unknown, depth = 0): FortebetRecordValue {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 2_000);
  if (depth >= 5) return "[Nested data omitted]";
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => safeClientRecordValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(
          ([key]) => !/(password|token|secret|cookie|authorization|credential|hash)/i.test(key),
        )
        .slice(0, 100)
        .map(([key, item]) => [key.slice(0, 120), safeClientRecordValue(item, depth + 1)]),
    ) as { [key: string]: FortebetRecordValue };
  }
  return null;
}

async function loadClientRecord(path: string, body: unknown = {}): Promise<FortebetClientRecord> {
  try {
    const { response, payload } = await requestFortebet(path, "POST", body, 12_000);
    if (!response.ok || payload?.status !== "OK") {
      return {
        ok: false,
        message: apiFailureMessage(payload, "Fortebet could not load this account section."),
      };
    }
    return { ok: true, data: safeClientRecordValue(payload.data) };
  } catch {
    return { ok: false, message: "Unable to reach Fortebet for this account section." };
  }
}

export async function loadSignedInAccountActivity(): Promise<SignedInAccountActivityResult> {
  const account = await loadFortebetAccount(12_000);
  if (!isLoggedAccount(account)) {
    return { ok: false, message: "Sign in to view your Fortebet account activity." };
  }

  const [profile, preferences, transactions, tickets, messages, session] = await Promise.all([
    loadClientRecord("/client/profile/get"),
    loadClientRecord("/client/preferences/get"),
    loadClientRecord("/client/transactions/get", recordRequest({path:'transactions/money',filters:['All'],from:'',to:'',page:0})),
    loadClientRecord("/client/tickets/get", recordRequest({path:'bets/all',filters:['All'],from:'',to:'',page:0})),
    loadClientRecord("/client/messages/get", {limit:31,offset:0,lang:'EN'}),
    loadClientRecord("/client/alive"),
  ]);

  return {
    ok: true,
    account: account.account,
    profile,
    preferences,
    transactions,
    tickets,
    messages,
    session,
  };
}

async function submitMobileMoneyRequest(
  path: string,
  body: Record<string, number | string>,
  fallback: string,
): Promise<MobileMoneyActionResult> {
  try {
    const { response, payload } = await requestFortebet(path, "POST", body);
    const data =
      payload?.data && typeof payload.data === "object"
        ? (payload.data as MobileMoneyApiResult)
        : null;
    if (response.ok && payload?.status === "OK" && data?.result === true) {
      const instructions =
        typeof data.textInstructions === "string" && data.textInstructions.trim()
          ? data.textInstructions.trim().slice(0, 500)
          : undefined;
      return {
        ok: true,
        message: readMobileMoneyMessage(data, "Your request was accepted."),
        ...(instructions ? { instructions } : {}),
      };
    }
    return {
      ok: false,
      message: readMobileMoneyMessage(data, apiFailureMessage(payload, fallback)),
    };
  } catch {
    return { ok: false, message: "Unable to reach the mobile money service. Please try again." };
  }
}

export async function submitFortebetLogin(data: {
  nickname: string;
  password: string;
}): Promise<AccountActionResult> {
  try {
    const { response, payload } = await requestFortebet("/client/login", "POST", {
      nickname: data.nickname,
      password: data.password,
    });
    if (response.ok && payload?.status === "OK" && payload.data) {
      const account = accountFromApi(payload.data, data.nickname);
      return {
        ok: true,
        message: "You’re now logged in.",
        ...(account ? { account } : {}),
      };
    }
    return {
      ok: false,
      message: apiFailureMessage(payload, "Login failed. Check your details and try again."),
    };
  } catch {
    return { ok: false, message: "Unable to reach the account service. Please try again." };
  }
}

export async function loadFortebetAccount(timeoutMs?: number): Promise<FortebetAccountResult> {
  try {
    const { response, payload } = await requestFortebet("/client/info", "POST", {}, timeoutMs);
    const account = accountFromApi(payload?.data);
    return response.ok && payload?.status === "OK" && account
      ? { ok: true, account }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function loadPendingMobileMoney(
  kind: "payin" | "payout",
): Promise<MobileMoneyPendingResult> {
  try {
    const account = await loadFortebetAccount();
    if (!isLoggedAccount(account)) {
      return { ok: false, message: "Sign in to view your payment requests." };
    }
    const path = kind === "payin" ? "/mobilemoney/pending-payins" : "/mobilemoney/pending-payouts";
    const { response, payload } = await requestFortebet(path, "POST", {});
    if (!response.ok || payload?.status !== "OK") {
      return { ok: false, message: apiFailureMessage(payload, "Unable to load pending requests.") };
    }
    return { ok: true, requests: pendingRequestsFromApi(payload.data) };
  } catch {
    return { ok: false, message: "Unable to reach the mobile money service. Please try again." };
  }
}

export async function submitMobileMoneyDeposit(amount: number): Promise<MobileMoneyActionResult> {
  const account = await loadFortebetAccount();
  if (!isLoggedAccount(account)) {
    return { ok: false, message: "Sign in again before requesting a deposit." };
  }
  return submitMobileMoneyRequest(
    PAYIN_PATH,
    { id_provider: -1, amount, voucher: "" },
    "The deposit request could not be completed.",
  );
}

export async function submitMobileMoneyPayout(amount: number): Promise<MobileMoneyActionResult> {
  const account = await loadFortebetAccount();
  if (!isLoggedAccount(account)) {
    return { ok: false, message: "Sign in again before requesting a withdrawal." };
  }
  if (amount > account.account.balance) {
    return { ok: false, message: "The withdrawal amount exceeds your available balance." };
  }
  return submitMobileMoneyRequest(
    PAYOUT_PATH,
    { amount, id_provider: -1 },
    "The withdrawal request could not be completed.",
  );
}

export async function submitBranchWithdrawal(amount: number): Promise<MobileMoneyActionResult> {
  const account = await loadFortebetAccount(12_000);
  if (!account.ok) return {ok:false,message:'Sign in again before requesting a withdrawal.'};
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > account.account.balance) {
    return {ok:false,message:'The withdrawal amount must be a whole number within your available balance.'};
  }
  return submitMobileMoneyRequest('/client/paymethods/payout-request', {amount}, 'The branch withdrawal request could not be completed.');
}

export async function loadAccountRecords(query: AccountRecordQuery):Promise<FortebetClientRecord> {
  if (!(await loadFortebetAccount(12_000)).ok) return {ok:false,message:'Sign in to view your account records.'};
  const path = query.path === 'messages' ? '/client/messages/get' : query.path.startsWith('bets/') ? '/client/tickets/get' : '/client/transactions/get';
  return loadClientRecord(path, recordRequest(query));
}
export async function loadAccountMessage(messageId:number):Promise<FortebetClientRecord> {
  if (!(await loadFortebetAccount(12_000)).ok) return {ok:false,message:'Sign in to read your messages.'};
  return loadClientRecord('/client/messages/detail', {messageId,lang:'EN'});
}
export async function submitAccountProfile(input:ProfileChanges):Promise<AccountActionResult> {
  if (!(await loadFortebetAccount(12_000)).ok) return {ok:false,message:'Sign in again before saving changes.'};
  try {
    const current = await loadClientRecord('/client/profile/get');
    if (!current.ok || !current.data || typeof current.data !== 'object' || Array.isArray(current.data)) return {ok:false,message:'Unable to load your profile before saving. Please try again.'};
    const existing = current.data['contact'];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return {ok:false,message:'Unable to load your contact details.'};
    const previous = existing['address'];
    const address = Array.isArray(previous) ? previous : previous && typeof previous === 'object' ? [previous] : [];
    const main = address.find(a=>a && typeof a === 'object' && !Array.isArray(a) && a['addressType']==='MAIN');
    const savedAddress = main && typeof main === 'object' && !Array.isArray(main) ? main : {};
    const personalInfo = {contact:{firstName:input.firstName,lastName:input.lastName,email:input.email,phone:existing['phone'],address:[{...savedAddress,addressType:savedAddress['addressType'] || 'MAIN',streetName:input.streetName,city:input.city,zipcode:input.zipcode},...address.filter(a=>a!==main)]}};
    const result = await requestFortebet('/client/profile/set','POST',{password:input.currentPassword,personalInfo},12_000);
    const detail = result.payload?.data as Record<string,unknown> | null;
    if (!result.response.ok || result.payload?.status !== 'OK' || detail?.['result'] !== true) return {ok:false,message:apiFailureMessage(result.payload,'Your profile changes were not accepted.')};
    if (input.newPassword) {
      const changed = await requestFortebet('/client/password/change','POST',{oldPassword:input.currentPassword,newPassword:input.newPassword,newPasswordConfirm:input.newPasswordAgain},12_000);
      const outcome = changed.payload?.data;
      if (!changed.response.ok || changed.payload?.status !== 'OK' || !outcome || typeof outcome === 'object' && (outcome as Record<string,unknown>)['result'] === false) return {ok:false,message:'Profile saved, but the password change was not accepted. Please check your password and try again.'};
    }
    return {ok:true,message:input.newPassword?'Profile and password saved.':'Profile saved.'};
  } catch {return {ok:false,message:'Unable to complete your changes. Refresh your profile before trying again.'};}
}

export async function submitFortebetLogout(): Promise<AccountActionResult> {
  try {
    const { response, payload } = await requestFortebet("/client/logout", "POST", {});
    if (response.ok && payload?.status === "OK") {
      clearFortebetSessionCookie();
      return { ok: true, message: "You’re now logged out." };
    }
    return {
      ok: false,
      message: apiFailureMessage(payload, "Could not log out. Please try again."),
    };
  } catch {
    return { ok: false, message: "Unable to reach the account service. Please try again." };
  }
}

export async function submitFortebetRegistration(
  data: RegistrationInput,
): Promise<AccountActionResult> {
  const promo = data.promo;
  const registrationData = {
    nickname: data.nickname,
    password: "",
    birthdate: data.birthdate,
    record_number: data.recordNumber,
    email: data.email,
    phone: `+256${data.phone}`,
    firstname: data.firstName,
    lastname: data.lastName,
    nationality: data.nationality,
    bonusCode: promo,
    channels: false,
    promo,
    adult: true,
    cookies: true,
    lang: "EN",
    meta: {
      resident: "",
      originUrl: "",
      promo,
      partner: "",
      track: "",
      channels: { email: true, sms: true },
    },
  };

  try {
    const { response, payload } = await requestFortebet("/client/register/create", "POST", {
      data: registrationData,
    });
    const result = payload?.data as Record<string, unknown> | null | undefined;
    if (response.ok && payload?.status === "OK" && result?.["result"] === true) {
      return { ok: true, message: "Registration complete. You can now log in." };
    }
    return {
      ok: false,
      message: apiFailureMessage(
        payload,
        "Registration could not be completed. Check your details and try again.",
      ),
    };
  } catch {
    return { ok: false, message: "Unable to reach the account service. Please try again." };
  }
}

export async function loadFortebetRegistrationCountries() {
  if (countryCache && countryCache.expiresAt > Date.now()) {
    return countryCache.countries;
  }

  const { response, payload } = await requestFortebet("/client/register/country-list", "GET");
  const countries = Array.isArray(payload?.data)
    ? payload.data.filter(
        (item): item is RegistrationCountry =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as RegistrationCountry).name === "string" &&
          typeof (item as RegistrationCountry).code === "string",
      )
    : [];
  if (!response.ok || payload?.status !== "OK" || countries.length === 0) {
    throw new Error("The country list is unavailable. Try again later.");
  }
  countryCache = { expiresAt: Date.now() + COUNTRY_CACHE_MS, countries };
  return countries;
}

export async function loadFortebetRegistrationGuide(): Promise<RegistrationGuideResult> {
  if (guideCache && guideCache.expiresAt > Date.now()) {
    return { ok: true, html: guideCache.html };
  }

  try {
    const query = new URLSearchParams({ name: GUIDE_NAME, language: "EN" });
    const { response, payload } = await requestFortebet(`/cms/snippets/name?${query}`, "GET");
    const item = Array.isArray(payload?.data) ? payload.data[0] : undefined;
    const html =
      item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string"
        ? (item as { text: string }).text
        : "";
    if (!response.ok || payload?.status !== "OK" || !html) {
      return { ok: false, message: "The registration guide could not be loaded." };
    }
    guideCache = { expiresAt: Date.now() + COUNTRY_CACHE_MS, html };
    return { ok: true, html };
  } catch {
    return { ok: false, message: "The registration guide could not be loaded." };
  }
}
