# Execute — Do the next task.

> No thinking. No distractions. Just the next task.

A minimal, production-ready PWA focused purely on execution.
Built with React + Vite + Supabase, deployable to Netlify in minutes.

---

## Project Structure

```
execute-app/
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker (offline support)
│   └── icon.svg            # App icon
├── src/
│   ├── components/
│   │   ├── ExecutionMode.jsx   # Primary focus screen (one task at a time)
│   │   ├── WeeklyPlanner.jsx   # Full week task management
│   │   ├── AnytimeList.jsx     # Undated checklist
│   │   └── Nav.jsx             # Bottom tab bar
│   ├── lib/
│   │   ├── supabase.js         # Supabase client (graceful if missing)
│   │   ├── db.js               # All data operations (Supabase + localStorage)
│   │   └── utils.js            # Date helpers (LOCAL time only)
│   ├── App.jsx                 # Root with tab routing + offline banner
│   ├── main.jsx                # Entry point
│   └── index.css               # Full design system
├── index.html
├── vite.config.js
├── netlify.toml
└── .env.example
```

---

## 1. Supabase Setup

### 1a. Create a project

Go to https://supabase.com → New project → note your URL and anon key.

### 1b. Run this SQL in the Supabase SQL Editor

```sql
-- Weekly scheduled tasks
create table tasks (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  day                 text not null check (day in (
                        'Saturday','Sunday','Monday','Tuesday',
                        'Wednesday','Thursday','Friday'
                      )),
  "order"             integer not null default 0,
  last_completed_date text default null,
  created_at          timestamptz default now()
);

-- Anytime (undated) tasks
create table anytime_tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  completed  boolean not null default false,
  created_at timestamptz default now()
);

-- Enable Row Level Security (open read/write — no auth required)
alter table tasks enable row level security;
alter table anytime_tasks enable row level security;

create policy "Public access tasks"
  on tasks for all using (true) with check (true);

create policy "Public access anytime_tasks"
  on anytime_tasks for all using (true) with check (true);
```

> ⚠️ These policies allow public read/write.
> This is intentional per spec (no auth).
> For production with sensitive data, add authentication.

---

## 2. Local Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup

```bash
# 1. Clone or copy the project
cd execute-app

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key

# 4. Run dev server
npm run dev
```

App opens at http://localhost:5173

> **No Supabase?** Skip step 3 — the app runs fully on localStorage.
> All features work offline. Data persists in the browser.

---

## 3. Build for Production

```bash
npm run build
# Output in /dist — ready to deploy
```

---

## 4. Netlify Deployment

### Option A: Drag & Drop (fastest)

```bash
npm run build
```
Go to https://netlify.com → Sites → drag the `/dist` folder.

### Option B: Git-connected (recommended)

1. Push this project to GitHub/GitLab
2. Go to Netlify → "Add new site" → "Import from Git"
3. Set build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Add environment variables in Netlify UI:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
5. Deploy

The `netlify.toml` handles SPA routing automatically.

---

## 5. PWA Installation

After deploying, users can install the app from their browser:

- **iOS Safari:** Share → "Add to Home Screen"
- **Android Chrome:** Menu → "Install app"
- **Desktop Chrome:** Address bar install icon

The service worker caches the shell for offline use.
Supabase calls fall through to the network; localStorage provides the offline fallback.

---

## 6. How It Works

### Execution Mode (the core)

1. Gets today's weekday using **local device time** (never UTC)
2. Fetches tasks for today, sorted by `order` ascending
3. Finds the first task where `last_completed_date ≠ today`
4. Shows only that one task — nothing else
5. "Done" → sets `last_completed_date = today` → next task appears
6. "Skip" → pushes task to bottom of pending list (session only, no DB write)
7. No cron jobs. Reset is implicit: a new day = new date string = all tasks pending

### Data flow

```
User action
    ↓
Optimistic localStorage update (instant UI)
    ↓
Supabase write (async, background)
    ↓  (if Supabase fails, local state persists)
localStorage stays as fallback
```

### Week definition
Saturday → Friday (configurable in `src/lib/utils.js` → `WEEK_DAYS`)

---

## 7. Customization

| What | Where |
|------|-------|
| Week start day | `src/lib/utils.js` → `WEEK_DAYS` array |
| Accent color | `src/index.css` → `--accent` variable |
| Task title font | `src/index.css` → `--font-serif` |
| Done button text | `src/components/ExecutionMode.jsx` |
| App name / colors | `public/manifest.json` |

---

## 8. Architecture Decisions

- **No auth** — per spec. RLS policies are open.
- **No cron** — reset is date-string comparison at read time.
- **localStorage first** — every write goes local first, then Supabase.
- **Local time only** — `new Date().getDay()` and manual YYYY-MM-DD formatting, no UTC conversions.
- **No dependencies beyond Supabase** — React + Vite only. No router, no state library.
- **PWA** — manifest + service worker included. Works offline out of the box.

---

## 9. Adding Icons (optional)

Replace the placeholder icons with real PNGs:

```bash
# Using ImageMagick or any image tool:
# - public/icon-192.png  (192×192)
# - public/icon-512.png  (512×512)
# - public/apple-touch-icon.png (180×180)
```

Or generate from `public/icon.svg` using https://realfavicongenerator.net

---

## Design

**Theme:** Industrial minimalism
- Execution mode: deep dark (#141414) for full focus
- Planner/Anytime: warm cream (#faf8f5) for comfortable planning
- Accent: terracotta orange (#e8945a) — deliberate, not alarming
- Typography: Playfair Display (task titles) + DM Sans (UI) + DM Mono (labels)
