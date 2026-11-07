import { createServerFn } from "@tanstack/react-start";
import type { VirtualOffer } from "./virtual-soccer";

let cached: { at: number; offer: VirtualOffer } | undefined;

export const getVirtualOffer = createServerFn({ method: "GET" }).handler(async (): Promise<VirtualOffer> => {
  if (cached && Date.now() - cached.at < 5000) return cached.offer;
  try {
    const response = await fetch("https://fortebet.ug/api/web/v1/virtual-soccer/offer", {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Feed unavailable");
    const body = await response.json() as { status: string; ts: string; data?: { matches?: VirtualOffer["matches"]; results?: VirtualOffer["results"] } };
    if (body.status !== "OK" || !Array.isArray(body.data?.matches)) throw new Error("Invalid feed");
    const offer: VirtualOffer = { at: body.ts, matches: body.data.matches, results: body.data.results ?? [], error: null };
    cached = { at: Date.now(), offer };
    return offer;
  } catch {
    return { at: new Date().toISOString(), matches: [], results: [], error: "Virtual matches are temporarily unavailable." };
  }
});