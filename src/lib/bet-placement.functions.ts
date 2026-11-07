import { createServerFn } from "@tanstack/react-start";
import type { BetPlacementResult } from "@/lib/bet-placement";
import { validatePlaceBetInput, type PlaceBetInput } from "@/lib/bet-placement";

export const placeFortebetBet = createServerFn({ method: "POST" })
  .inputValidator((input: PlaceBetInput) => validatePlaceBetInput(input))
  .handler(async ({ data }): Promise<BetPlacementResult> => {
    const { submitFortebetBet } = await import("./bet-placement.server");
    return submitFortebetBet(data);
  });

export const checkFortebetBetAuthorization = createServerFn({ method: "POST" })
  .inputValidator((input: { idTicket: string }) => {
    const idTicket = typeof input?.idTicket === "string" ? input.idTicket.trim() : "";
    if (!idTicket || idTicket.length > 120) throw new Error("Choose a valid Fortebet ticket reference.");
    return { idTicket };
  })
  .handler(async ({ data }): Promise<BetPlacementResult> => {
    const { checkFortebetBetAuthorization: checkAuthorization } = await import("./bet-placement.server");
    return checkAuthorization(data.idTicket);
  });
