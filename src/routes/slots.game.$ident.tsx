import { useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GameModal, casinoGamesQuery } from "@/components/casino";

type Search = { mode?: "fun" | "real" };

export const Route = createFileRoute("/slots/game/$ident")({
  validateSearch: (s: Record<string, unknown>): Search => (s["mode"] === "real" ? { mode: "real" } : {}),
  head: ({ params }) => ({ meta: [
    { title: `Play ${params.ident} - All Games | Fortebet` },
    { name: "description", content: "Play this Fortebet casino game for fun or for real." },
    { property: "og:title", content: `Play ${params.ident} - All Games | Fortebet` },
    { property: "og:description", content: "Play this Fortebet casino game for fun or for real." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(casinoGamesQuery),
  component: GamePage,
});

function GamePage() {
  const { ident } = Route.useParams();
  const { mode = "fun" } = Route.useSearch();
  const nav = useNavigate();
  const close = useCallback(() => nav({ to: "/slots", resetScroll: false }), [nav]);
  return (
    <GameModal
      ident={ident}
      mode={mode}
      onClose={close}
      onMode={(m) => nav({ to: "/slots/game/$ident", params: { ident }, search: m === "real" ? { mode: "real" } : {}, replace: true, resetScroll: false })}
    />
  );
}
