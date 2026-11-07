import { describe, expect, it } from "vitest";
import { validateLogin } from "@/lib/login-modal";
import { isAdultRegistrationDate } from "@/lib/account.functions";
describe("login form", () => {
  it("requires a username", () => expect(validateLogin(" ", "x").username).toBeTruthy());
  it("requires a password", () => expect(validateLogin("0700", "").password).toBeTruthy());
  it("accepts filled fields", () => expect(validateLogin("0700", "pw")).toEqual({}));
});

describe("registration age", () => {
  const today = new Date("2026-11-06T12:00:00.000Z");
  it("accepts users who have turned 18", () => {
    expect(isAdultRegistrationDate("2008-11-06", today)).toBe(true);
  });
  it("rejects users who have not turned 18", () => {
    expect(isAdultRegistrationDate("2008-11-07", today)).toBe(false);
  });
  it("rejects invalid calendar dates", () => {
    expect(isAdultRegistrationDate("2008-02-30", today)).toBe(false);
  });
});
