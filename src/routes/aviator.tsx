import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { LiveShell } from "@/components/live-shell";
import { casinoGamesQuery } from "@/components/casino";

export const Route = createFileRoute("/aviator")({
  head: () => ({ meta: [
    { title: "Aviator - Play for fun or for money | Fortebet" },
    { name: "description", content: "Play Spribe's Aviator crash game at Fortebet Uganda: free play for fun or play for money." },
    { property: "og:title", content: "Aviator - Play for fun or for money | Fortebet" },
    { property: "og:description", content: "Play Spribe's Aviator crash game at Fortebet Uganda: free play for fun or play for money." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(casinoGamesQuery),
  component: AviatorPage,
});

const tile = { backgroundColor: "rgb(61, 63, 73)", backgroundImage: 'url("https://fortebet.ug/assets/img/aviator.svg")', backgroundRepeat: "no-repeat", backgroundPosition: "center calc(38px * var(--factor))", lineHeight: 1.25 } as const;

/** Same page as fortebet.ug/aviator: two tiles that start Aviator in demo or real-money mode. */
function AviatorPage() {
  return (
    <LiveShell active="aviator" layout="full">
      <div className="aviator" style={{ minHeight: "calc(380px * var(--factor))" }}>
        <div>
          <Link to="/aviator/game/$mode" params={{ mode: "fun" }} style={tile} resetScroll={false}>Free play<br />for fun!</Link>
          <Link to="/aviator/game/$mode" params={{ mode: "real" }} style={tile} resetScroll={false}>Play<br />for money!</Link>
        </div>
        <div className="info"><p>Please, read the <a href="/doc/aviator_rules">Terms and Conditions</a>.</p></div>
      </div>
      <Outlet />
    </LiveShell>
  );
}
