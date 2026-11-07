import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LiveShell } from "@/components/live-shell";
import { EventDetail, LiveEventHeader, BetSlip, useSels, liveQuery, eventDetailQuery } from "@/components/fortebet-live";

export const Route = createFileRoute("/live_/event_/$id")({
  head: () => ({ meta: [
    { title: "Live match - Fortebet" },
    { name: "description", content: "Live score and all in-play betting options for this match at Fortebet." },
    { property: "og:title", content: "Live match - Fortebet" },
    { property: "og:description", content: "Live score and all in-play betting options for this match at Fortebet." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context, params }) => Promise.all([
    context.queryClient.ensureQueryData(liveQuery),
    context.queryClient.ensureQueryData(eventDetailQuery(params.id, true)).catch(() => null),
  ]).then(() => null),
  component: LiveEventPage,
});

function LiveEventPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const s = useSels();
  return (
    <LiveShell slip={<BetSlip title="Live" slip={s} />}>
      <LiveEventHeader id={id} onBack={() => nav({ to: "/live/preview" })} />
      <EventDetail id={id} live onClose={() => nav({ to: "/live/preview" })} sels={s.sels} toggle={s.toggle} />
    </LiveShell>
  );
}
