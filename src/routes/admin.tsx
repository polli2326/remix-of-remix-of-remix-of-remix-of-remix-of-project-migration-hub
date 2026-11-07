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
    ],
  }),
  component: AccountActivityDashboard,
});
