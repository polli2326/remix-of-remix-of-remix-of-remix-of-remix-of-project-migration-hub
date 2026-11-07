import { describe, expect, it } from "vitest";
import { registrationFailureMessage } from "@/lib/account-service.server";

describe("registration failure messages", () => {
  it("explains a taken username and phone instead of ERR_NOT_VALID", () => {
    const msg = registrationFailureMessage({ result: false, error: "ERR_NOT_VALID", checks: [
      { attr_name: "NICKNAME", error: "ERR_VALUE_DUPLICITY" },
      { attr_name: "PHONE", error: "ERR_VALUE_DUPLICITY" },
    ] });
    expect(msg).toContain("username is already taken");
    expect(msg).toContain("phone number is already registered");
    expect(msg).not.toContain("ERR_");
  });
  it("falls back to a readable message with no checks", () => {
    expect(registrationFailureMessage({ result: false, error: "ERR_NOT_VALID", checks: [] })).toBe("Registration could not be completed, please check the entered data.");
  });
});

import { buildRegistrationData } from "@/lib/account-service.server";

describe("registration body", () => {
  it("matches the body fortebet.ug's own form sends for Uganda", () => {
    const body = buildRegistrationData({ firstName: "Test", lastName: "Person", nickname: "zq88123x", phone: "782160368", email: "abc@gmail.com", birthdate: "1995-05-10", nationality: "UG", recordNumber: "cm95012345abcd", promo: "", termsAccepted: true });
    expect(body.phone).toBe("+256782160368");
    expect(body.record_number).toBe("CM95012345ABCD");
    expect(body.lang).toBe("en");
    expect(body.adult).toBe(false);
    expect(body.personal).toMatchObject({ birthDate: "1995-05-10", nationality: "UG", identityDocumentNumber: "CM95012345ABCD" });
    expect(body.address.map((a) => a.addressType)).toEqual(["MAIN", "DELIVERY"]);
  });
});
