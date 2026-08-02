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

The app is public, so there are two paths and it tries them in order:

1. **The shared server key** — `netlify/functions/coach.mjs`, rate limited per IP
   per day. Free for the visitor.
2. **The visitor's own Gemini key** — set in Settings, stored only in their
   browser, sent only to Google. Used when the server has no key configured or
   the daily cap is hit.

**The client never sends a prompt.** It sends `{ kind, payload }`, and the
function builds the prompt from `src/lib/prompts.js`. That is the whole reason
this endpoint is not a free general-purpose LLM proxy for anyone who finds the
URL. Never add an endpoint that accepts prompt text.

Input is length-capped and whitespace-collapsed in `prompts.js` before it reaches
a template, so a pasted novel can't run up a bill and a payload can't smuggle in
extra instruction lines.

### Deploy configuration

| Env var | Effect |
| --- | --- |
| `GEMINI_API_KEY` | **Unset by default.** Until you set it, the function returns 503 and every visitor uses their own key — so deploying costs nothing. |
| `COACH_DAILY_LIMIT` | Free calls per IP per day. Defaults to 10. |
| `GEMINI_MODEL` | Defaults to `gemini-2.5-flash`. |
| `RATE_SALT` | Salt for hashing IPs in the rate-limit store. Set it. |

Rate-limit counters live in Netlify Blobs keyed by date and a truncated hash of
the IP — no raw addresses are stored. If Blobs is unavailable the function fails
closed rather than handing out an unmetered key.

Gemini 1.5 Flash was retired in September 2025; a fresh key returns 404 for it.

## Not built yet

`production` (evaluations, listings, pendings, closings), `roadblock`,
`peakTime`, `belief` and `pipeline` are in the data model, are migrated, are
summarised, and are fed to the coaching prompt — but have **no UI to enter
them**. The coach is currently reasoning over empty strings for those, which is
why its gap analysis reads thin. Wiring up those inputs is the highest-value
next change.
