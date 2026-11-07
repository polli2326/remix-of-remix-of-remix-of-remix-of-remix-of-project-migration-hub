import { useEffect, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { getVirtualOffer } from "@/lib/virtual-soccer.functions";
import { kickoffCountdown } from "@/lib/virtual-soccer";
import { nextVirtualMatch, virtualNavLabel } from "@/lib/live-nav";

/** One shared virtual offer for the menu item and the Virtual Soccer page (kept fresh every 5 s). */
export const virtualOfferQuery = queryOptions({
  queryKey: ["virtual-soccer-offer"],
  queryFn: () => getVirtualOffer(),
  refetchInterval: 5000,
  staleTime: 4000,
});

/** Ticks every second; starts from the feed time so server and browser render the same first frame. */
export function useNow(start: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now ?? start;
}

/** Menu content: next virtual match and the real countdown to its kick-off, on every page. */
export function VirtualNavItem({ iconHref = "#icoSportVirtualsoccer" }: { iconHref?: string }) {
  const { data } = useQuery(virtualOfferQuery);
  const now = useNow(data ? Date.parse(data.at) : 0);
  const m = data ? nextVirtualMatch(data.matches, now) : undefined;
  return (
    <div data-ce="app-virtual-soccer-sec-header">
      <div>
        <icon {...({ href: iconHref, classname: "current h30" } as any)}>
          <svg className="current h30 align-middle" viewBox="0 0 100 100"><use xlinkHref="#icoSportVirtualsoccer" /></svg>
        </icon>
      </div>
      <div> {virtualNavLabel(m)} <br /><span suppressHydrationWarning>{m ? kickoffCountdown(m.item_time, now) : "--:--"}</span></div>
    </div>
  );
}
