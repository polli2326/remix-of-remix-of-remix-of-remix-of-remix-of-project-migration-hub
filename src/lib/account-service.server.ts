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
  withSession = true,
): Promise<{ response: Response; payload: ApiPayload | null }> {
  const headers = new Headers({ Accept: "application/json" });
  setResponseHeader('Cache-Control', 'no-store');
  const cookie = withSession ? getFortebetSessionCookieHeader() : undefined;
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


const REGISTRATION_ERRORS: Record<string, Record<string, string>> = {
  NICKNAME: { ERR_VALUE_DUPLICITY: "This username is already taken, choose another one.", ERR_BAD_FORMAT: "Bad format of username, choose letters and numbers only.", ERR_REQUIRED: "Username is required." },
  PHONE: { ERR_VALUE_DUPLICITY: "This phone number is already registered, use another one.", ERR_BAD_FORMAT: "Bad value of phone number.", ERR_MIN_LENGTH: "Phone number is too short.", ERR_BLACKLISTED: "This number is self excluded." },
  EMAIL: { ERR_VALUE_DUPLICITY: "This e-mail is already registered, choose another one.", ERR_BAD_FORMAT: "Wrong format of e-mail address.", ERR_BAD_VALUE: "Wrong format of e-mail address." },
  RECORD_NUMBER: { ERR_VALUE_DUPLICITY: "This NIN is already registered.", ERR_NOT_VALID: "The NIN is not valid.", ERR_BAD_FORMAT: "The NIN has a bad format.", ERR_NOT_MATCH: "The birth year in your NIN does not match your birth date.", ERR_BAD_VALUE: "The birth year in your NIN is out of the allowed range." },
  FIRSTNAME: { ERR_BAD_FORMAT: "Your first name has bad format.", ERR_REQUIRED: "Your first name is required." },
  LASTNAME: { ERR_BAD_FORMAT: "Your last name has bad format.", ERR_REQUIRED: "Your last name is required." },
  BIRTHDATE: { ERR_BAD_VALUE: "You must be at least 18 years old.", ERR_BAD_FORMAT: "Enter a valid birth date." },
};

/** Turns Fortebet's registration checks (e.g. NICKNAME/ERR_VALUE_DUPLICITY) into readable reasons. */
export function registrationFailureMessage(data: unknown): string {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const checks = Array.isArray(record["checks"]) ? record["checks"] : [];
  const reasons = checks
    .map((check) => {
      const item = (check ?? {}) as Record<string, unknown>;
      const field = String(item["attr_name"] ?? "").toUpperCase();
      const code = String(item["error"] ?? "");
      return REGISTRATION_ERRORS[field]?.[code] ?? (field ? `${field.toLowerCase().replace(/_/g, " ")}: ${code.replace(/^ERR_/, "").replace(/_/g, " ").toLowerCase()}` : "");
    })
    .filter(Boolean);
  if (reasons.length) return [...new Set(reasons)].join(" ");
  return "Registration could not be completed, please check the entered data.";
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

function accountFailureMessage(account: FortebetAccountResult, signedOutMessage: string) {
  return !account.ok && account.reason === 'unavailable'
    ? 'Unable to confirm your account with Fortebet. Please try again.'
    : signedOutMessage;
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
    return { ok: false, message: accountFailureMessage(account, "Sign in to view your Fortebet account activity.") };
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
      const verified = await loadFortebetAccount(12_000);
      if (!verified.ok) {
        clearFortebetSessionCookie();
        return { ok: false, message: 'Your login could not be confirmed. Please try signing in again.' };
      }
      return {
        ok: true,
        message: "You’re now logged in.",
        account: verified.account,
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
    if (!getFortebetSessionCookieHeader()) return { ok: false, reason: 'unauthenticated' };
    const { response, payload } = await requestFortebet("/client/info", "POST", {}, timeoutMs ?? 12_000);
    if (response.status >= 500 || response.status === 429 || !payload) return { ok: false, reason: 'unavailable' };
    const account = accountFromApi(payload?.data);
    return response.ok && payload?.status === "OK" && account
      ? { ok: true, account }
      : { ok: false, reason: 'unauthenticated' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export async function loadPendingMobileMoney(
  kind: "payin" | "payout",
): Promise<MobileMoneyPendingResult> {
  try {
    const account = await loadFortebetAccount();
    if (!isLoggedAccount(account)) {
      return { ok: false, message: accountFailureMessage(account, "Sign in to view your payment requests.") };
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
    return { ok: false, message: accountFailureMessage(account, "Sign in again before requesting a deposit.") };
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
    return { ok: false, message: accountFailureMessage(account, "Sign in again before requesting a withdrawal.") };
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
  if (!account.ok) return {ok:false,message:accountFailureMessage(account,'Sign in again before requesting a withdrawal.')};
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > account.account.balance) {
    return {ok:false,message:'The withdrawal amount must be a whole number within your available balance.'};
  }
  return submitMobileMoneyRequest('/client/paymethods/payout-request', {amount}, 'The branch withdrawal request could not be completed.');
}

export async function loadAccountRecords(query: AccountRecordQuery):Promise<FortebetClientRecord> {
  const account = await loadFortebetAccount(12_000);
  if (!account.ok) return {ok:false,message:accountFailureMessage(account,'Sign in to view your account records.')};
  const path = query.path === 'messages' ? '/client/messages/get' : query.path.startsWith('bets/') ? '/client/tickets/get' : '/client/transactions/get';
  return loadClientRecord(path, recordRequest(query));
}
export async function loadAccountMessage(messageId:number):Promise<FortebetClientRecord> {
  const account = await loadFortebetAccount(12_000);
  if (!account.ok) return {ok:false,message:accountFailureMessage(account,'Sign in to read your messages.')};
  return loadClientRecord('/client/messages/detail', {messageId,lang:'EN'});
}
export async function submitAccountProfile(input:ProfileChanges):Promise<AccountActionResult> {
  const account = await loadFortebetAccount(12_000);
  if (!account.ok) return {ok:false,message:accountFailureMessage(account,'Sign in again before saving changes.')};
  try {
    const current = await loadClientRecord('/client/profile/get');
    if (!current.ok || !current.data || typeof current.data !== 'object' || Array.isArray(current.data)) return {ok:false,message:'Unable to load your profile before saving. Please try again.'};
    const existing = current.data['contact'];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return {ok:false,message:'Unable to load your contact details.'};
    const previous = existing['address'];
    const address = Array.isArray(previous) ? previous : previous && typeof previous === 'object' ? [previous] : [];
    const main = address.find(a=>a && typeof a === 'object' && !Array.isArray(a) && a['addressType']==='MAIN') ?? address[0];
    const savedAddress = main && typeof main === 'object' && !Array.isArray(main) ? main : {};
    const personalInfo = {contact:{title:input.title,firstName:input.firstName,lastName:input.lastName,email:input.email,phone:existing['phone'],address:[{...savedAddress,addressType:savedAddress['addressType'] || 'MAIN',streetName:input.streetName,city:input.city,zipcode:input.zipcode},...address.filter(a=>a!==main)]}};
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

/** Mirrors exactly the "ClientRegistrationFull" body fortebet.ug's own form sends for Uganda;
 *  Fortebet answers ERR_INTERNAL when the personal/address blocks are missing. */
export function buildRegistrationData(data: RegistrationInput) {
  const promo = data.promo;
  const nin = data.recordNumber.replace(/\s+/g, "").toUpperCase();
  const emptyAddress = { streetName: "", streetNumber: "", city: "", zipcode: "", country: "" };
  return {
    nickname: data.nickname,
    password: "",
    birthdate: data.birthdate,
    record_number: nin,
    email: data.email,
    phone: `+256${data.phone}`,
    firstname: data.firstName,
    lastname: data.lastName,
    nationality: data.nationality,
    bonusCode: promo,
    channels: false,
    promo,
    meta: { resident: "", originUrl: "https://fortebet.ug/", promo, partner: promo, track: promo, channels: { email: true, sms: true } },
    databox: "", gender: "", birth_place: "", birthnumber: "", birthnumberworld: "", record_type: "", income_source: "",
    lang: "en", is_politician: "", adult: false, cookies: false,
    main_street: "", main_numb: "", main_city: "", main_zipcode: "", main_country: "",
    delivery_street: "", delivery_numb: "", delivery_city: "", delivery_zipcode: "", delivery_country: "",
    address: [{ addressType: "MAIN", ...emptyAddress }, { addressType: "DELIVERY", ...emptyAddress }],
    personal: {
      gender: "", birthDate: data.birthdate, birthPlace: "", birthNumber: "", nationality: data.nationality,
      identityDocumentType: "", identityDocumentNumber: nin, incomeSource: "", politician: false, adult: false, lang: "en", agreement: false,
    },
  };
}

export async function submitFortebetRegistration(
  data: RegistrationInput,
): Promise<AccountActionResult> {
  const registrationData = buildRegistrationData(data);

  try {
    const { response, payload } = await requestFortebet("/client/register/create", "POST", {
      data: registrationData,
    }, 20000, false);
    const result = payload?.data as Record<string, unknown> | null | undefined;
    const checks = Array.isArray(result?.["checks"]) ? (result!["checks"] as Record<string, unknown>[]) : [];
    console.info("[register] fortebet reply", JSON.stringify({
      http: response.status, status: payload?.status, code: (payload as Record<string, unknown> | null)?.["code"],
      result: result?.["result"], error: result?.["error"],
      checks: checks.map((c) => `${String(c?.["attr_name"])}:${String(c?.["error"])}`),
    }));
    if (response.ok && payload?.status === "OK" && result?.["result"] === true) {
      return { ok: true, message: "Registration complete. You can now log in." };
    }
    if (response.ok && payload?.status === "OK" && result) {
      return { ok: false, message: registrationFailureMessage(result) };
    }
    return {
      ok: false,
      message: apiFailureMessage(
        payload,
        `Fortebet did not accept the registration right now (code ${response.status}). Please try again in a moment.`,
      ),
    };
  } catch (error) {
    console.error("[register] request failed", error instanceof Error ? error.message : String(error));
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
