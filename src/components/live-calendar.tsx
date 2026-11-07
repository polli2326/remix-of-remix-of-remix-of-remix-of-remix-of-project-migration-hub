import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getLiveCalendar } from "@/lib/fortebet.functions";
import { calendarDays } from "@/lib/live-nav";

export const calendarQuery = (day: string) =>
  queryOptions({ queryKey: ["fb-live-calendar", day], queryFn: () => getLiveCalendar({ data: { day } }), staleTime: 60_000, refetchInterval: 120_000 });

const CSS = `
.fbCal{background:rgb(46,49,57);border-radius:calc(6px*var(--factor));overflow:hidden;color:#e6e6e8;font-weight:700}
.fbCal .head{display:flex;align-items:center;gap:calc(8px*var(--factor));flex-wrap:wrap;padding:calc(10px*var(--factor)) calc(14px*var(--factor));background:rgb(61,63,73);text-transform:uppercase;font-size:calc(12px*var(--factor))}
.fbCal .head a{padding:calc(5px*var(--factor)) calc(10px*var(--factor));border-radius:calc(3px*var(--factor));background:rgb(84,86,97);color:#e6e6e8;text-transform:none;font-size:calc(12px*var(--factor))}
.fbCal .head a.active{background:rgb(0,166,90);color:#fff}
.fbCal .row{display:grid;grid-template-columns:calc(50px*var(--factor)) calc(30px*var(--factor)) 22% 1fr 38%;align-items:center;gap:calc(8px*var(--factor));padding:calc(6px*var(--factor)) calc(14px*var(--factor));border-top:1px solid rgb(36,38,45);font-size:calc(12px*var(--factor))}
.fbCal .row .t{line-height:1.15}
.fbCal .row .sp{text-transform:uppercase}
.fbCal .empty{padding:calc(14px*var(--factor));color:#a3a4a8}
`;

function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: "Africa/Kampala", hour: "numeric", minute: "2-digit" });
}

/** Schedule of live matches, like fortebet.ug/live/calendar: five day tabs and every match that will go live that day. */
export function LiveCalendar({ day, now }: { day: string; now: number }) {
  const { data } = useSuspenseQuery(calendarQuery(day));
  const days = calendarDays(now);
  return (
    <div className="fbCal">
      <style>{CSS}</style>
      <div className="head">
        <span>Schedule of live matches →</span>
        {days.map((d, i) => (
          <Link key={d.key} to="/live/calendar" search={i === 0 ? {} : { day: d.key }} className={d.key === day ? "active" : ""} resetScroll={false}>{d.label}</Link>
        ))}
      </div>
      {data.rows.length === 0 && <div className="empty">No live matches are scheduled for this day yet.</div>}
      {data.rows.map((r) => (
        <div className="row" key={r.id}>
          <div className="t">{fmtClock(r.start)}</div>
          <div><span className={`ico ${r.icon} h16`} /></div>
          <div className="sp">{r.sport}</div>
          <div>{r.home} - {r.away}</div>
          <div>{r.league}</div>
        </div>
      ))}
    </div>
  );
}
