import { createServerFn } from "@tanstack/react-start";
import { validateBranchAmount } from './account-inputs';

export type AccountActionResult =
  { ok: true; message: string; account?: FortebetAccount } | { ok: false; message: string };

export type FortebetAccount = {
  nickname: string;
  displayName: string;
  balance: number;
  currency: string;
};

export type FortebetAccountResult = { ok: true; account: FortebetAccount } | { ok: false };

export type MobileMoneyPendingRequest = {
  requestTimestamp: string;
  reference: string;
  amount: number;
};

export type MobileMoneyPendingResult =
  { ok: true; requests: MobileMoneyPendingRequest[] } | { ok: false; message: string };

export type MobileMoneyActionResult =
  { ok: true; message: string; instructions?: string } | { ok: false; message: string };

export type FortebetRecordValue =
  string | number | boolean | null | FortebetRecordValue[] | { [key: string]: FortebetRecordValue };

export type FortebetClientRecord =
  { ok: true; data: FortebetRecordValue } | { ok: false; message: string };

export type SignedInAccountActivityResult =
  | { ok: false; message: string }
  | {
      ok: true;
      account: FortebetAccount;
      profile: FortebetClientRecord;
      preferences: FortebetClientRecord;
      transactions: FortebetClientRecord;
      tickets: FortebetClientRecord;
      messages: FortebetClientRecord;
      session: FortebetClientRecord;
    };

export type RegistrationCountry = { name: string; code: string };
export type CountryListResult =
  { ok: true; countries: RegistrationCountry[] } | { ok: false; message: string };
export type RegistrationGuideResult = { ok: true; html: string } | { ok: false; message: string };

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

export function isAdultRegistrationDate(birthdate: string, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return false;
  const born = new Date(`${birthdate}T00:00:00.000Z`);
  if (Number.isNaN(born.valueOf()) || born.toISOString().slice(0, 10) !== birthdate) return false;

  let age = today.getUTCFullYear() - born.getUTCFullYear();
  if (
    today.getUTCMonth() < born.getUTCMonth() ||
    (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate())
  ) {
    age -= 1;
  }
  return age >= 18;
}

export const loginWithFortebet = createServerFn({ method: "POST" })
  .validator((input: { nickname: string; password: string }) => {
    const nickname = typeof input?.nickname === "string" ? input.nickname.trim() : "";
    const password = typeof input?.password === "string" ? input.password : "";
    if (!nickname || nickname.length > 120 || !password || password.length > 256) {
      throw new Error("Enter a valid username and password.");
    }
    return { nickname, password };
  })
  .handler(async ({ data }): Promise<AccountActionResult> => {
    const { submitFortebetLogin } = await import("./account-service.server");
    return submitFortebetLogin(data);
  });

export const registerWithFortebet = createServerFn({ method: "POST" })
  .validator((input: RegistrationInput) => {
    const text = (value: unknown, max: number) =>
      typeof value === "string" ? value.trim().slice(0, max) : "";

    const data: RegistrationInput = {
      firstName: text(input?.firstName, 80),
      lastName: text(input?.lastName, 80),
      nickname: text(input?.nickname, 80),
      phone: text(input?.phone, 24).replace(/\D/g, ""),
      email: text(input?.email, 160).toLowerCase(),
      birthdate: text(input?.birthdate, 10),
      nationality: text(input?.nationality, 2).toUpperCase(),
      recordNumber: text(input?.recordNumber, 80),
      promo: text(input?.promo, 80),
      termsAccepted: input?.termsAccepted === true,
    };
    const date = new Date(`${data.birthdate}T00:00:00.000Z`);
    const validDate =
      /^\d{4}-\d{2}-\d{2}$/.test(data.birthdate) &&
      !Number.isNaN(date.valueOf()) &&
      date.toISOString().slice(0, 10) === data.birthdate;

    if (
      !data.firstName ||
      !data.lastName ||
      !data.nickname ||
      data.phone.length !== 9 ||
      (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) ||
      !validDate ||
      !isAdultRegistrationDate(data.birthdate) ||
      !/^[A-Z]{2}$/.test(data.nationality) ||
      !data.recordNumber ||
      !data.termsAccepted
    ) {
      throw new Error("Check the required registration details and try again.");
    }
    return data;
  })
  .handler(async ({ data }): Promise<AccountActionResult> => {
    const { submitFortebetRegistration } = await import("./account-service.server");
    return submitFortebetRegistration(data);
  });

export const getRegistrationCountries = createServerFn({ method: "GET" }).handler(
  async (): Promise<CountryListResult> => {
    try {
      const { loadFortebetRegistrationCountries } = await import("./account-service.server");
      const countries = await loadFortebetRegistrationCountries();
      return { ok: true, countries };
    } catch {
      return { ok: false, message: "The country list is unavailable. Try again later." };
    }
  },
);

export const getRegistrationGuide = createServerFn({ method: "GET" }).handler(
  async (): Promise<RegistrationGuideResult> => {
    const { loadFortebetRegistrationGuide } = await import("./account-service.server");
    return loadFortebetRegistrationGuide();
  },
);

export const getFortebetAccount = createServerFn({ method: "GET" }).handler(
  async (): Promise<FortebetAccountResult> => {
    const { loadFortebetAccount } = await import("./account-service.server");
    return loadFortebetAccount();
  },
);

export const getSignedInAccountActivity = createServerFn({ method: "GET" }).handler(
  async (): Promise<SignedInAccountActivityResult> => {
    const { loadSignedInAccountActivity } = await import("./account-service.server");
    return loadSignedInAccountActivity();
  },
);

export const getPendingMobileMoney = createServerFn({ method: "GET" })
  .validator((input: { kind: "payin" | "payout" }) => {
    if (input?.kind !== "payin" && input?.kind !== "payout") {
      throw new Error("Choose a valid payment type.");
    }
    return { kind: input.kind };
  })
  .handler(async ({ data }): Promise<MobileMoneyPendingResult> => {
    const { loadPendingMobileMoney } = await import("./account-service.server");
    return loadPendingMobileMoney(data.kind);
  });

export const requestMobileMoneyDeposit = createServerFn({ method: "POST" })
  .validator((input: { amount: unknown }) => {
    const amount = Number(input?.amount);
    if (!Number.isSafeInteger(amount) || amount < 1_000 || amount > 5_000_000) {
      throw new Error("Enter a whole-number deposit between 1,000 and 5,000,000 UGX.");
    }
    return { amount };
  })
  .handler(async ({ data }): Promise<MobileMoneyActionResult> => {
    const { submitMobileMoneyDeposit } = await import("./account-service.server");
    return submitMobileMoneyDeposit(data.amount);
  });

export const requestMobileMoneyPayout = createServerFn({ method: "POST" })
  .validator((input: { amount: unknown }) => {
    const amount = Number(input?.amount);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      throw new Error("Enter a valid whole-number withdrawal amount.");
    }
    return { amount };
  })
  .handler(async ({ data }): Promise<MobileMoneyActionResult> => {
    const { submitMobileMoneyPayout } = await import("./account-service.server");
    return submitMobileMoneyPayout(data.amount);
  });

export const logoutFromFortebet = createServerFn({ method: "POST" }).handler(
  async (): Promise<AccountActionResult> => {
    const { submitFortebetLogout } = await import("./account-service.server");
    return submitFortebetLogout();
  },
);

export const requestBranchWithdrawal = createServerFn({method:'POST'})
  .inputValidator(validateBranchAmount)
  .handler(async ({data}): Promise<MobileMoneyActionResult> => {
    const {submitBranchWithdrawal} = await import('./account-service.server');
    return submitBranchWithdrawal(data.amount);
  });
