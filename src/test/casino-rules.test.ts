import { describe, expect, it } from "vitest";
import { filterGames, popularGames, DEFAULT_CASINO_FILTER } from "@/lib/casino";
import type { CasinoGame } from "@/lib/fortebet.functions";

const g = (id: number, name: string, provider: string, tags: string[], popular: number | null = null, sortOrder = 10): CasinoGame => ({
  id, name, provider, ident: name.toLowerCase().replace(/\s/g, ""), image: "", tags, playReal: true, playFun: true, sortOrder, popular, portrait: false,
});

const games = [
  g(204, "Aviator", "Spribe", ["crash"], 1, 40),
  g(20, "Midnight Fruits 81", "Apollo Casino", ["jackpot", "slots"], 2),
  g(5, "Bonus Joker II", "Apollo Casino", ["jackpot", "slots"]),
  g(517, "Hot to Burn", "Pragmatic Play", ["slots"], null, 30),
  g(7, "Crystal miners", "Apollo Casino", ["jackpot", "slots"]),
];

describe("casino lobby rules", () => {
  it("most popular games follow Fortebet's preferred order, topped up in normal order", () => {
    expect(popularGames(games, 3).map((x) => x.name)).toEqual(["Aviator", "Midnight Fruits 81", "Bonus Joker II"]);
  });
  it("most popular games show at most 12", () => {
    const many = Array.from({ length: 20 }, (_, i) => g(100 + i, `Game ${i}`, "Apollo Casino", ["slots"], i + 1));
    expect(popularGames(many)).toHaveLength(12);
  });
  it("unfiltered grid leaves out popular games and sorts by provider order then id", () => {
    const many = [...Array.from({ length: 12 }, (_, i) => g(100 + i, `Pop ${i}`, "Spribe", ["crash"], i + 1)), g(9, "Late", "Pragmatic Play", ["slots"], null, 30), g(8, "Early", "Apollo Casino", ["slots"])];
    expect(filterGames(many, DEFAULT_CASINO_FILTER).map((x) => x.name)).toEqual(["Early", "Late"]);
  });
  it("provider filter keeps only that provider (popular included)", () => {
    expect(filterGames(games, { ...DEFAULT_CASINO_FILTER, provider: "apollo_casino" }).map((x) => x.id)).toEqual([5, 7, 20]);
  });
  it("game type filter uses the game tags", () => {
    expect(filterGames(games, { ...DEFAULT_CASINO_FILTER, category: "crash" }).map((x) => x.name)).toEqual(["Aviator"]);
  });
  it("search matches part of the name, any case", () => {
    expect(filterGames(games, { ...DEFAULT_CASINO_FILTER, q: "joker" }).map((x) => x.id)).toEqual([5]);
  });
});

import { jackpotCounter, jackpotStart } from "@/lib/casino";
describe("jackpot counter", () => {
  it("starts 60 seconds of growth below the real value", () => {
    expect(jackpotStart(1_901_258, 41.6)).toBeCloseTo(1_898_762, 0);
  });
  it("never starts below zero", () => {
    expect(jackpotStart(100, 50)).toBe(0);
  });
  it("is halfway after 30 seconds and reaches the real value after 60 seconds", () => {
    expect(jackpotCounter(1000, 2000, 30_000)).toBe(1500);
    expect(jackpotCounter(1000, 2000, 60_000)).toBe(2000);
    expect(jackpotCounter(1000, 2000, 120_000)).toBe(2000);
  });
  it("drops straight to a lower value (jackpot was won)", () => {
    expect(jackpotCounter(5000, 100, 1000)).toBe(100);
  });
});
