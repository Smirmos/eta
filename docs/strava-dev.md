# Strava integration — dev setup (ETA-25)

Strava requires a publicly-reachable HTTPS callback for both OAuth redirect and
webhook delivery. Local dev uses [ngrok](https://ngrok.com/) (free tier) to
expose `localhost:3000` over HTTPS.

## One-time setup

1. **Register the Strava app** at https://www.strava.com/settings/api.
   - Authorization Callback Domain: leave as `localhost` initially; we override
     the full URL via env var.
   - Note the Client ID and Client Secret.
2. **Mint a webhook verify token** — any opaque random string. Used on both the
   `subscribe` POST and on the GET handshake echo.
3. **Add to `apps/api/.env`**:
   ```
   STRAVA_ENABLED=true
   STRAVA_CLIENT_ID=<id>
   STRAVA_CLIENT_SECRET=<secret>
   STRAVA_WEBHOOK_VERIFY_TOKEN=<random>
   # filled after `ngrok http 3000` starts:
   STRAVA_REDIRECT_URI=https://<your-ngrok>.ngrok-free.app/integrations/strava/callback
   STRAVA_WEBHOOK_CALLBACK_URL=https://<your-ngrok>.ngrok-free.app/integrations/strava/webhook
   ```

## Per-session run

```sh
# Terminal 1
ngrok http 3000

# Terminal 2 — copy the https:// URL into STRAVA_REDIRECT_URI + STRAVA_WEBHOOK_CALLBACK_URL
pnpm dev
```

Then:

1. **Connect Strava** — open
   `http://localhost:3000/integrations/strava/authorize` in a browser. Strava
   prompts for `profile:read_all` + `activity:read_all`. After approving you
   land on `/integrations/strava/callback?...` and the API persists tokens
   under `oauth_credentials` keyed by `DEV_USER_ID` + provider `strava`.

2. **Subscribe to the webhook** — Strava only accepts subscriptions via their
   API (no UI). Run once per ngrok URL:
   ```sh
   curl -X POST https://www.strava.com/api/v3/push_subscriptions \
     -F client_id=$STRAVA_CLIENT_ID \
     -F client_secret=$STRAVA_CLIENT_SECRET \
     -F callback_url=$STRAVA_WEBHOOK_CALLBACK_URL \
     -F verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN
   ```
   Strava hits the callback once with `GET ?hub.mode=...`; the API echoes
   `hub.challenge` and the subscription is live. List with:
   ```sh
   curl "https://www.strava.com/api/v3/push_subscriptions?client_id=$STRAVA_CLIENT_ID&client_secret=$STRAVA_CLIENT_SECRET"
   ```
   Delete with:
   ```sh
   curl -X DELETE "https://www.strava.com/api/v3/push_subscriptions/$SUB_ID?client_id=$STRAVA_CLIENT_ID&client_secret=$STRAVA_CLIENT_SECRET"
   ```
   Strava allows **one active subscription per Strava app**, so deleting + re-
   subscribing is the only way to switch ngrok URLs.

3. **Smoke test the OAuth → backfill flow** — after the redirect lands, the
   backfill kicks off async. Tail the API logs for `Strava backfill starting`
   and `Strava backfill finished`. Inspect rows:
   ```sh
   psql $DATABASE_URL -c "SELECT discipline, count(*), max(date) FROM workouts_completed WHERE source='strava' GROUP BY discipline;"
   ```

4. **Smoke test the webhook** — go to Strava and upload (or manually finish)
   an activity. Expect to see `Ingested Strava activity <id>` in the API logs
   within seconds. Re-check the DB.

## Caveats (verified in 2026-06-10 smoke test)

- **ngrok free-tier abuse warning blocks browser-initiated OAuth.**
  Strava redirects the browser to your ngrok URL with `?code=…&state=…`.
  On the first browser visit to that ngrok host, ngrok serves an
  interstitial ("You are about to visit…") and does NOT proxy to the
  API. The Strava code remains valid for ~10 min, so two ways out:
  - Pre-warm: visit any URL on the ngrok host once (e.g.
    `https://<host>/health`), click "Visit Site" on the warning, then
    open `/integrations/strava/authorize` and consent. The interstitial
    is suppressed for the rest of the browser session.
  - Bypass via curl: copy the full `…/callback?state=…&code=…` URL from
    the address bar after consent, then
    `curl -H "ngrok-skip-browser-warning: 1" '<that-url>'`. The header
    bypasses the interstitial for non-browser clients. The API
    completes the exchange the same way it would from the browser.
- **PORT in `.env` may be ignored** if something already set it in your
  shell environment (`echo $PORT`). dotenv won't overwrite existing
  `process.env` values. Either `unset PORT` first or run the API with
  `PORT=3001 pnpm dev` on the command line.
- **Strava's "Authorization Callback Domain" field** is on
  `/settings/api`, but only visible **after clicking Edit**. The
  read-only Details view doesn't show it.
- **Mobile Strava app rejects manual activities with no GPS movement.**
  Use the **web upload** at https://www.strava.com/upload/manual for
  synthetic test activities — it accepts manual entries without any GPS
  data. The webhook fires for these the same as for real activities.
## Manual backfill

```sh
pnpm strava:backfill           # uses DEV_USER_ID
pnpm strava:backfill -- --user=<uuid>
```

Idempotent — re-runs upsert on `(source, external_id)` so re-running
does not duplicate rows.

## Operational caveats

- **ngrok free tier rotates URLs** every restart. After a new ngrok URL,
  update `.env`, restart `pnpm dev`, delete the prior Strava subscription
  via the API, and re-subscribe.
- **Subscription PER APP, not per user**: if you switch Strava apps the
  subscription is bound to the new app.
- **Token rotation**: every `/oauth/token` response returns a fresh
  `refresh_token`. The service re-persists every refresh — never reuse an
  older refresh token.
- **Rate limits**: 100/15 min, 1000/day. 90-day backfill is ~180 calls
  total (one list call + two per activity); well under both.
- **Strava-only mode** (no wearable connected) is verified at the Pass 3
  service level — readiness data absent → plan generation runs with
  `avgReadinessLast7d=50` and hard-rules engine produces zero firings.

## AthleteProfile seeding + renormalisation

After OAuth + backfill have populated `workouts_completed` rows, seed an
`AthleteProfile` so TSS can be computed for bike-with-power activities.

```sh
pnpm seed:profile                  # uses test-profile.json + DEV_USER_ID
pnpm seed:profile -- --profile=<path>
pnpm seed:profile -- --user=<uuid>
```

The script creates a new profile row (append-only history) and immediately
runs a renormalise pass that walks existing `pending_inference` rows for that
user, recomputes TSS where possible (today: bike-with-power), and upserts.

Equivalent HTTP path:

```sh
curl -X POST http://localhost:3000/athlete-profiles \
  -H 'content-type: application/json' \
  -d @apps/api/scripts/test-profile.json

curl http://localhost:3000/athlete-profiles/me
```

The POST kicks off renormalisation in the background (fire-and-forget); tail
the API logs to see its summary.

`pnpm generate:test-plan`, `generate:test-week`, and `render:plan` now default
to the DB profile for `DEV_USER_ID`. Pass `--profile=<path>` to override with
a JSON fixture (e.g. for synthetic scenarios like `test-profile-5day.json`).
`pnpm generate:test-adaptation` is unaffected — it uses scenario-specific
hardcoded profiles for Pass 3 hard-rule branch coverage.
