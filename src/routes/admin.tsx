import { createFileRoute } from "@tanstack/react-router";
import { AccountActivityDashboard } from "@/components/account-activity-dashboard";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Account Activity | Fortebet" },
      {
        name: "description",
        content: "View the profile and activity linked to your signed-in Fortebet account.",
      },
      { property: "og:title", content: "Account Activity | Fortebet" },
      { property: "og:description", content: "View your signed-in Fortebet account records and activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountActivityDashboard,
});
