import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LiveShell } from "@/components/live-shell";
import { CasinoLobby, casinoGamesQuery } from "@/components/casino";

export const Route = createFileRoute("/slots")({
  head: () => ({ meta: [
    { title: "All Games - Slots, crash & jackpots | Fortebet" },
    { name: "description", content: "Play Fortebet casino games: slots, crash games, roulette and jackpots from Apollo, Pragmatic Play and Spribe." },
    { property: "og:title", content: "All Games - Slots, crash & jackpots | Fortebet" },
    { property: "og:description", content: "Play Fortebet casino games: slots, crash games, roulette and jackpots from Apollo, Pragmatic Play and Spribe." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(casinoGamesQuery),
  component: SlotsPage,
});

function SlotsPage() {
  return (
    <LiveShell active="slots" layout="full">
      <CasinoLobby />
      <Outlet />
    </LiveShell>
  );
}
