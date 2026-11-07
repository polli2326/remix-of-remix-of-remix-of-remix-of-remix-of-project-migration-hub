import { createFileRoute } from "@tanstack/react-router";
import { LiveShell } from "@/components/live-shell";
import { LivePreviewList, BetSlip, useSels } from "@/components/fortebet-live";

export const Route = createFileRoute("/live_/preview")({
  head: () => ({ meta: [
    { title: "Live betting - Fortebet" },
    { name: "description", content: "Live matches, scores and in-play odds at Fortebet Uganda." },
    { property: "og:title", content: "Live betting - Fortebet" },
    { property: "og:description", content: "Live matches, scores and in-play odds at Fortebet Uganda." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: LivePage,
});

function LivePage() {
  const s = useSels();
  return (
    <LiveShell slip={<BetSlip title="Live" slip={s} />}>
      <LivePreviewList slip={s} />
    </LiveShell>
  );
}
