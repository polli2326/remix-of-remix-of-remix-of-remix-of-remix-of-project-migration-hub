<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Live betting data comes from the public Fortebet feeds, fetched through server functions in src/lib/fortebet.functions.ts (with a short cache) because the browser cannot call those feeds directly.
- Real-time odds/score changes come from the public Fortebet Socket.IO feed opened in the browser (src/lib/odds-feed.ts); snapshot data seeds the same store, and the newest timestamp wins, so every odds button and the bet slip read one source.
- Offer filtering and ticket maths live as pure functions (src/lib/offer-filters.ts, src/lib/ticket.ts) with tests in src/test/offer-rules.test.ts, so rules stay checkable without the UI.
- Bet slips are stored in the browser (src/lib/tickets-store.ts); real bet placement needs an authorized Fortebet account and is not wired.
- Ticket check and ticket preview share one ticket window (src/components/ticket-check.tsx); ticket lookups go through the checkTicket server function, so both views stay identical.
- Same-site <a href> clicks are turned into router navigation by one listener in src/routes/__root.tsx, so the imported pages' plain links never reload the app.
- Casino lobby and jackpot-counter rules live in src/lib/casino.ts (tested in src/test/casino-rules.test.ts); games launch through the playCasinoGame server function, with real mode using the Fortebet session established by account login.
- Account windows share one root-mounted dialog. Login and registration use server-only Fortebet API calls; the session stays in an HttpOnly, Secure, SameSite=None, Partitioned app cookie (so it survives the cross-site editor preview frame) and is forwarded only by server-side API requests.
- Fortebet cookie rotations are tracked per incoming request and login succeeds only after an upstream account check, so header state cannot precede server session verification; unavailable account checks must not be labeled signed out.
- Signed-in account pages share LiveShell under /client/account/*; authenticated server actions forward only verified Fortebet contracts, record filters and pagination run upstream, and mutations require explicit user submission so account data stays per-user and no demo success is shown.
- Virtual Soccer keeps the imported route layout, reads its public offer through a cached server function, and scales one persistent Stream/Tracker iframe when expanded; local preview picks never submit wagers.
- Route loaders prime TanStack Query with the Fortebet snapshots and setupRouterSsrQueryIntegration (src/router.tsx) sends that cache with the HTML, so pages open already filled and then only update; match times render in Africa/Kampala so server and browser text match.
- Live-page toolbar state (sport tab, search, My selection stars) lives in one store in src/components/live-toolbar.tsx, with the pure rules in src/lib/live-nav.ts (tested in src/test/live-nav.test.ts); the Virtual menu item on every page reads the same virtual offer query as the Virtual Soccer page.
