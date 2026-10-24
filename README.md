# Lift Log — personal Hevy-style workout tracker

A static, mobile-first PWA (plain HTML/JS, no build step) backed by Supabase.
Units are **lb**. Single user.

**Files**

| File | Purpose |
|---|---|
| `index.html` | App shell + styles |
| `app.js` | All app logic (auth, data layer, logger, stats) |
| `seed-data.js` | Muscle taxonomy, default exercises, example routines |
| `config.js` | Your Supabase URL + anon key (optional — can also be entered in-app) |
| `schema.sql` | Paste into Supabase SQL editor (tables, RLS, taxonomy seed) |
| `manifest.json`, `sw.js`, `icons/` | PWA install + offline shell |
| `schema.template.sql`, `build-schema.mjs` | Regenerate `schema.sql` if you edit the taxonomy in `seed-data.js` |

## 1. Supabase (free tier)

1. Create a project at <https://supabase.com/dashboard> (any region, free plan). Save the database password somewhere; you don't need it for the app.
2. Open **SQL Editor → New query**, paste the whole of `schema.sql`, click **Run**. It is idempotent; re-run it any time.
3. **Authentication → Providers → Email**: leave *Email* enabled. Decide one of:
   - **Email + password, no confirmation** (simplest): turn **off** "Confirm email". You can then create your account straight from the app's *Create account* button.
   - **Keep confirmation on**: the app's *Create account* / *Email me a link* buttons send a mail; the link must point back at your deployed URL, so add it under **Authentication → URL Configuration → Site URL** and **Redirect URLs** (e.g. `https://liftlog.pages.dev/`).
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
5. After you've created your account, close sign-ups so nobody else can register against your project: **Authentication → Providers → Email → "Allow new users to sign up" → off**. (There's also a trigger-based alternative commented at the bottom of `schema.sql`.) RLS already guarantees each user only sees their own rows, so this is belt-and-braces.

## 2. Configure the app

Either edit `config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://xxxxxxxxxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...',
};
```

…or leave it blank and paste both values into the app's first-run setup screen (stored in that browser's localStorage). The anon key is safe to ship in a public static site: RLS policies do the protection.

**Local mode**: the setup screen also offers *Use this device only*. Everything then lives in the browser's localStorage, no account needed. Handy for trying the app before setting up Supabase; export from *Profile → ⚙ → Export* if you later want the data.

## 3. Deploy (pick one)

### GitHub Pages
1. Create a repo, push these files to `main` (keep them at the repo root).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Your app is at `https://<user>.github.io/<repo>/`. Add that URL to Supabase's Redirect URLs if you use magic links or email confirmation.

### Cloudflare Pages
1. **Workers & Pages → Create → Pages → Connect to Git** (or *Direct upload* and drag the folder).
2. Framework preset: **None**. Build command: *(empty)*. Output directory: `/`.
3. Deploy. The URL is `https://<project>.pages.dev/`.

Both are HTTPS, which the PWA install and service worker need.

### Install on your phone
- **iOS Safari**: open the URL → Share → *Add to Home Screen*.
- **Android Chrome**: menu → *Install app* (or the install banner).

## Using it

- **Routines** are ordered *slots*: a muscle group (optionally a sub-group), a set count, and an optional hint — not a fixed exercise. Example seeded: *Back B: lat paths + traps* = Lats ×2, Lats (lower fibers) ×2, Upper traps ×2.
- **Start** a routine → each slot shows *Pick exercise*: a list filtered to that target, with each exercise's last performance. Pick one, log weight / reps / RPE, tick ✓ (starts the rest timer; empty fields take the previous session's numbers). Tap a set number to cycle Normal → Warm-up → Drop → Failure. Warm-ups are excluded from set counts and PRs.
- The in-progress workout survives reloads and app switches (saved to localStorage); it is written to Supabase when you tap **Finish**.
- **Exercises**: search, filter by group, add/edit. Each exercise maps to one or more group/sub-group targets, marked *Primary* (counts 1 set) or *Secondary* (counts ½) for the distribution stats.
- **Profile**: workouts/week, weekly volume and sets, muscle-group distribution against a target range (default 10–20 sets per group per week; per-group overrides in ⚙ Settings), recent PRs. Tap any exercise for est. 1RM (Epley), heaviest weight, session volume charts and full history.
- **Workout cards** on Home open the detail; *Edit* fixes a past entry; *Repeat this workout* starts a new session with the same exercises.

## Changing the taxonomy / defaults

Edit `seed-data.js` (groups, sub-groups, default exercises, routines) and run

```bash
node build-schema.mjs
```

to regenerate the taxonomy inserts in `schema.sql`, then re-run `schema.sql` in Supabase. Default exercises and routines are seeded by the app the first time it finds an empty account, so changes to those only affect new accounts.

## Notes & limits

- Free-tier Supabase pauses projects after a week without requests; opening the app un-pauses it (first load may take ~30 s then).
- The app loads your whole history at startup (fine for years of personal use; capped at the 2,000 most recent workouts).
- No offline writes yet: finishing a workout needs a connection. The in-progress workout itself is kept locally until then.
