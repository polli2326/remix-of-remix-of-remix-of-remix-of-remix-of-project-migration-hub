import { useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GameModal, casinoGamesQuery } from "@/components/casino";
import { AVIATOR_GAME_ID } from "@/lib/casino";

export const Route = createFileRoute("/aviator/game/$mode")({
  head: () => ({ meta: [
    { title: "Play Aviator | Fortebet" },
    { name: "description", content: "Aviator by Spribe, running inside Fortebet: play for fun or for real money." },
    { property: "og:title", content: "Play Aviator | Fortebet" },
    { property: "og:description", content: "Aviator by Spribe, running inside Fortebet: play for fun or for real money." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(casinoGamesQuery),
  component: AviatorGame,
});

function AviatorGame() {
  const { mode } = Route.useParams();
  const nav = useNavigate();
  const close = useCallback(() => nav({ to: "/aviator", resetScroll: false }), [nav]);
  return (
    <GameModal
      gameId={AVIATOR_GAME_ID}
      backPath="/aviator"
      backLabel="Back to Aviator"
      mode={mode === "real" ? "real" : "fun"}
      onClose={close}
      onMode={(m) => nav({ to: "/aviator/game/$mode", params: { mode: m }, replace: true, resetScroll: false })}
    />
  );
}
