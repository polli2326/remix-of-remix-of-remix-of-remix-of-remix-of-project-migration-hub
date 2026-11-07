import { createFileRoute } from "@tanstack/react-router";
import { LiveShell } from "@/components/live-shell";
import { BetSlip, liveQuery, useSels } from "@/components/fortebet-live";
import { LiveCalendar, calendarQuery } from "@/components/live-calendar";
import { kampalaDay } from "@/lib/live-nav";

type Search = { day?: string };

export const Route = createFileRoute("/live_/calendar")({
  validateSearch: (s: Record<string, unknown>): Search => (typeof s["day"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["day"]) ? { day: s["day"] } : {}),
  loaderDeps: ({ search }) => ({ day: search.day }),
  head: () => ({ meta: [
    { title: "Live schedule - Fortebet" },
    { name: "description", content: "Schedule of upcoming live matches you can bet on in play at Fortebet Uganda." },
    { property: "og:title", content: "Live schedule - Fortebet" },
    { property: "og:description", content: "Schedule of upcoming live matches you can bet on in play at Fortebet Uganda." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: async ({ context, deps }) => {
    const now = Date.now();
    const day = deps.day ?? kampalaDay(new Date(now).toISOString());
    await Promise.all([context.queryClient.ensureQueryData(calendarQuery(day)), context.queryClient.ensureQueryData(liveQuery)]);
    return { day, now };
  },
  component: CalendarPage,
  errorComponent: ({ error }) => <div role="alert" style={{ padding: 20, color: "#e6e6e8" }}>{error instanceof Error ? error.message : "The schedule could not be loaded."}</div>,
  notFoundComponent: () => <div style={{ padding: 20, color: "#e6e6e8" }}>Schedule not found.</div>,
});

function CalendarPage() {
  const { day, now } = Route.useLoaderData();
  const s = useSels();
  return (
    <LiveShell slip={<BetSlip title="Live" slip={s} />}>
      <div className="live">
        <div className="live__head live__head--space" />
        <LiveCalendar day={day} now={now} />
      </div>
    </LiveShell>
  );
}
