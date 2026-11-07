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
