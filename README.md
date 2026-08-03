# Vision & Velocity

A daily mindset, activity and production tracker for a working real estate agent.
Phone-first, offline-capable, with a Gemini-powered coach.

## Running it

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm test` | Vitest suite (date + entry logic) |
| `npm run build` | Production build into `dist/` |
| `npm run check` | Lint, test, build — run this before pushing |
| `npm run icons` | Regenerate `src/components/Icon.jsx` |

## Deploying

Netlify builds from this repo; `netlify.toml` holds the config. Push to `main`
and it deploys. There is no drag-and-drop step and no manual build.

## Why this project exists in this shape

The previous version was a single HTML file that loaded React, Babel Standalone
and the Tailwind Play CDN from `<script>` tags, and it rendered a blank white
screen on mobile. The cause was not a code bug: the page shipped **3.4 MB of
compilers** and asked a phone to transpile the JSX and compile the CSS on every
page load. Mobile WebKit killed the tab before it finished, silently — no
exception, so no error handler could catch it.

Everything below follows from not doing that again.

- **Compile at build time.** JSX and Tailwind are compiled here, by Vite. The
  phone receives plain JS and plain CSS.
- **No CDN dependencies at runtime.** The built page makes **zero external
  requests**. Nothing to be blocked by a phone network, a VPN, or a content
  blocker.
- **Icons are inlined, not a webfont.** Importing `remixicon`'s stylesheet costs
  169 KB of CSS plus a 190 KB font to draw ~20 glyphs. `scripts/build-icons.mjs`
  inlines just the paths used, into 9.7 KB. Add an icon by adding its name to
  `ICONS` in that script and running `npm run icons`.
- **A flight recorder runs before anything else** (see `index.html`). On a phone
  there is no console to open, so if the app fails to start it paints the reason
  on screen — including unhandled promise rejections and failed script loads,
  neither of which reach `window.onerror`.

Build output is around 260 KB, ~78 KB gzipped.

## Where the bodies are buried

**Dates.** Entries are keyed `YYYY-MM-DD` and represent **local calendar days**.
`new Date('2026-08-01')` parses as UTC midnight, which is 8pm July 31st in
Florida — this shipped, and labelled every entry with the wrong day. Always go
through `src/lib/dates.js`. The tests in `dates.test.js` pin this down,
including DST boundaries.

**Storage schema drift.** The saved shape changed several times during early
development, and old data is still out there. `migrateEntry()` in
`src/lib/entries.js` is **total**: any input, however mangled, returns a valid
entry. It never throws. If you add a field, add it to `blankEntry()` and add a
case to `entries.test.js`.

**One source of truth.** `entries` in `App.jsx` holds everything; the visible day
is derived from it with `useMemo`. An earlier version kept a second copy of the
current day in state and synced it with an effect, which meant saving clobbered
in-progress edits and wiped the coach's reply off screen. Don't reintroduce that.

## How coaching is powered

**Bring-your-own-key, and only that.** Each person adds their own Gemini key in
Settings; it is stored in their browser and sent only to Google. There is no
shared key, no server, and no environment variable to configure — whoever hosts
this app is never in the payment path and carries no cost or abuse risk.

Google AI Studio has a free tier, so for most users this costs nothing.

The app is fully useful with no key at all. Logging, the roll-up and the meeting
recap need no network. Coaching is the only thing a key unlocks.

Prompts are built in `src/lib/prompts.js`, which caps input length and keeps the
templates market-neutral. **If a shared server key is ever added, the server must
build the prompt from `{ kind, payload }` and never accept prompt text from the
client** — otherwise the key becomes a free general-purpose LLM proxy for anyone
who finds the URL. A worked version is in git history (`git log --diff-filter=D
-- netlify/functions/coach.mjs`).

Gemini 1.5 Flash was retired in September 2025; a fresh key returns 404 for it.

## The broker's form

The app exists to serve a fortnightly coaching session. The broker collects prep
via a Google Form — *"Vision & Velocity Business Coaching: You, Amplified!"*,
headed *"To be filled out prior to every session!"* — whose responses land in a
Sheet he shares across all his coaching clients.

**The app fills that form rather than replacing it.** `prefillUrl()` in
`src/lib/googleForm.js` produces a link that opens his real form with all 17
answers populated; the agent reviews and submits as normal. Nothing changes on
his end.

What assembles itself from the nightly logs:

| Form field | Source |
| --- | --- |
| Activity snapshot | the eight nightly counters, in the form's own order |
| What I committed to | the previous session's three actions |
| Progress made | which of those were ticked, plus consistency |
| What slowed me down | roadblocks logged that cycle, with dates |
| Progress toward goals | goals from settings |

**Entry IDs are read from the live form and hardcoded.** If the broker edits a
question, Google may assign it a NEW id and that answer will silently stop
prefilling. To re-read them: fetch the form HTML and parse `FB_PUBLIC_LOAD_DATA_`
— each question carries `[id, title, description, type, [[entryId, ...]]]`.

`# Active Listings` and `# Pendings` are point-in-time states, not running
totals, so they cannot be derived from event counters and are confirmed by the
agent each session. Closings shows the year-to-date figure from the logs as a
hint.

## Sync

Optional Google sign-in, using the **OAuth 2.0 redirect flow** — not Google's JS
library, which would mean loading a script from Google on every page load and
breaking the no-runtime-CDN rule this app exists to honour.

- `netlify/functions/auth-start.mjs` → Google consent, with a signed short-lived
  `state` in both the URL and a cookie (double-submit CSRF).
- `netlify/functions/auth-callback.mjs` → exchanges the code, sets an
  HMAC-signed HttpOnly session cookie. No session table.
- `netlify/functions/data.mjs` → reads/writes one JSON document per user in
  Netlify Blobs, keyed by the Google account id **from the cookie** — there is no
  user id in the request for an attacker to change.

**The client merges, not the server** (`src/lib/merge.js`). One implementation,
identical online and off. Merge is per day with newest-edit-wins, and is
commutative and idempotent.

Sign-in is optional: with no `GOOGLE_CLIENT_ID` configured, `/api/me` reports
sign-in unavailable and the button hides itself. The app is fully usable without
an account, and the API key never syncs — it is a credential and stays per-device.

Required env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`.
Redirect URI is `<origin>/api/auth/google/callback`.

## Sessions

A session is a record, not a rolling window. Its snapshot covers **the days since
the previous session actually happened** — cadence slips with schedules, and a
fixed fortnight would quietly mis-report. Broker feedback and the agent's own
takeaways are captured on the session record for tracking; they never go on the
form, which is filled in beforehand.

## Not built yet

`production` (evaluations, listings, pendings, closings), `roadblock`,
`peakTime`, `belief` and `pipeline` are in the data model, are migrated, are
summarised, and are fed to the coaching prompt — but have **no UI to enter
them**. The coach is currently reasoning over empty strings for those, which is
why its gap analysis reads thin. Wiring up those inputs is the highest-value
next change.
