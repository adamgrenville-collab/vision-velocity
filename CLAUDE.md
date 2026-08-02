# Vision & Velocity Tracker

Daily mindset / activity / production tracker for a RE/MAX agent in East Pasco &
Tampa, FL. Phone-first. See [README.md](README.md) for the full rationale.

## Stack

- **Vite 8 + React 19**, plain JS with JSX. No TypeScript.
- **Tailwind v4** via `@tailwindcss/vite`. Config is CSS-first in
  `src/index.css` — there is no `tailwind.config.js`.
- **Vitest** for the pure logic in `src/lib/`.
- **Netlify** builds from `main`; config in `netlify.toml`.
- **Storage is `localStorage` only.** No backend, no accounts, single device.

## Hard rules

1. **Never add a runtime CDN dependency.** No `<script src>`, no external
   stylesheet, no webfont. The built page makes zero external requests and it
   stays that way — the previous version died from exactly this. If you need an
   icon, add it to `ICONS` in `scripts/build-icons.mjs` and run `npm run icons`.
2. **Never parse a date key with `new Date(key)`.** Use `src/lib/dates.js`.
   `new Date('2026-08-01')` is UTC midnight and lands on the previous day in
   every US timezone.
3. **`migrateEntry()` must never throw.** It is the only thing standing between
   old saved data and a blank screen. Any new field gets a default in
   `blankEntry()` and a coercion case in `migrateEntry()`.
4. **`entries` is the single source of truth.** Don't add a second copy of the
   current day to state and sync it with an effect.
5. **Bring-your-own-key only. Never add a shared API key.** Every AI call is
   billed to the key the user supplied, from their browser. Whoever hosts this
   must carry no cost and no abuse risk. If that is ever revisited, the server
   must build prompts from `{ kind, payload }` and never accept prompt text —
   see git history for a worked version.
6. **The app must stay fully useful with no key.** Logging, roll-up and the
   meeting recap never depend on the network. Coaching is the only extra.
7. **Nothing user-specific goes in a prompt template.** Market comes from
   settings. No brokerage, no city, no name baked into `prompts.js`.
8. **Run `npm run check` before committing.** Lint, tests, build.

## Layout

```
src/
  lib/          pure logic, fully tested — dates, entry migration, storage, Gemini calls
  components/   presentational; Icon.jsx is GENERATED, don't hand-edit
  App.jsx       state and wiring
scripts/
  build-icons.mjs   regenerates Icon.jsx from the remixicon package
index.html      flight recorder (runs before React; catches silent boot failures)
```

## Gotchas

- Tailwind v4 renamed utilities: `bg-gradient-to-r` → `bg-linear-to-r`,
  `shadow-sm` → `shadow-xs`, `shadow` → `shadow-sm`, `outline-none` →
  `outline-hidden`, `flex-shrink-0` → `shrink-0`. v3 names fail silently.
- `remixicon` is a **devDependency** — it is only read at icon-generation time
  and must never reach the bundle.
- Editing a day autosaves on a 400 ms debounce, plus a flush on
  `visibilitychange`. A day that is merely *visited* is never persisted, which is
  what keeps blank entries out of the roll-up.
- The Gemini key is in `localStorage` by deliberate choice (single user, personal
  phone). Revisit if the URL is ever shared — see README.

## Commercial context

The agent's other product is a referral CRM at mapmyreferrals.com (separate repo,
Cloudflare stack). Deliberately **not** coupled to this one — different product,
different audience. Don't propose merging them.
