# Project Files Note
**Project:** Hans12 — Study Hub WiFi Captive Portal  
**Date:** June 11, 2026  
**Server:** Express (TypeScript) on port 5000

---

## Server

| File | Lines | Description |
|------|-------|-------------|
| `server.ts` | 37 | Express server — serves all static files from `/public`, SPA fallback to `index.html`. Runs on port 5000. |

---

## Source Files (`/src`)

| File | Lines | Description |
|------|-------|-------------|
| `main.ts` | 215 | App entry point — initializes Firebase, sets up global click handler, tab switching, URL param handling, and all DOM event listeners. |
| `admin.ts` | 786 | Admin panel logic — session list rendering, live countdown/elapsed timers, session approval/rejection, filtering, pagination, dark mode toggle, CSV export, revenue summary, seat availability grid. |
| `admin-page.ts` | 408 | Admin page entry point — initializes Firebase for admin view, handles admin auth, wires up all admin UI events and listeners. |
| `booking.ts` | 234 | Booking/checkout logic — pricing calculation, form preview updates, duration selection, seat type selection, session creation in Firebase. |
| `session.ts` | 484 | Session management — check session status by name search, stop open-time sessions, extend sessions (cash/online), expiry handling. |
| `ui.ts` | 233 | UI utilities — tab switching, connection status display, ticket modal (show/close/download receipt), loader overlay, form error display. |
| `state.ts` | 24 | Shared app state — `AppState` and `AdminState` singleton objects used across modules. |
| `config.ts` | 26 | Configuration — Firebase project config, pricing table (`PRICING`), hourly rate, closing time, page size. |
| `firebase.ts` | 26 | Firebase init — initializes Firebase Realtime Database (compat mode), exposes `getDb()` and `sessionKey()` helpers. |
| `types.ts` | 50 | TypeScript interfaces — `SessionRecord`, `AppState`, `AdminState`, `SessionTimes`. |
| `globals.d.ts` | 2 | Global type declarations — `firebase` (any) and `lucide` (icon library) for browser globals. |

---

## Public Files (`/public`)

| File | Lines | Description |
|------|-------|-------------|
| `index.html` | 569 | Customer-facing portal — two tabs: "Book a Session" (with seat type, duration, payment method) and "Check My Session" (search by name). Includes ticket modal and extend/stop session modals. |
| `admin.html` | 350 | Admin dashboard — session table with filters, approval controls, revenue summary card, seat availability grid, dark mode toggle. |
| `payment-success.html` | 89 | Payment success landing page — shown after successful online payment redirect. |
| `payment-failed.html` | 62 | Payment failed landing page — shown after failed/cancelled online payment redirect. |
| `style.css` | 153 | Custom CSS — brand colors, scrollbar styles, dark mode overrides, receipt/ticket print styles, custom animations. |

### Public Assets (`/public/js`)

| File | Description |
|------|-------------|
| `app.js` | Bundled output of `src/main.ts` (built by esbuild) — served to customers. |
| `admin.js` | Bundled output of `src/admin-page.ts` (built by esbuild) — served to admins. |

### Public Images (`/public/img`)

| File | Description |
|------|-------------|
| `han12_logo_transparent.png` | Main logo (transparent background) used in the portal header. |
| `logo.jpg` | Alternate logo used in the admin panel / receipt. |

---

## Config & Setup Files (Root)

| File | Description |
|------|-------------|
| `package.json` | Project metadata, npm scripts (`build`, `start`), dependencies (express, cors, dotenv, axios) and devDependencies (@types/node, @types/express, typescript, ts-node, esbuild). |
| `tsconfig.json` | TypeScript compiler config. |
| `.replit` | Replit workflow config — runs `npx ts-node server.ts`, maps port 5000 → 80. |
| `replit.nix` | Nix environment — includes `unzip` system package. |
| `database.rules.json` | Firebase Realtime Database security rules. |
| `FIREBASE_SETUP.md` | Firebase setup instructions and notes. |
| `Troubleshoot_notes` | Troubleshooting notes from development. |
| `.gitignore` | Git ignore rules. |
| `README.md` | Basic project readme. |
| `dev.bat` | Windows batch script for running dev servers in parallel (not used in Replit). |
| `zipFile.zip` | Original project zip archive. |

---

## Build Flow

```
src/main.ts       → esbuild →  public/js/app.js     (customer portal JS)
src/admin-page.ts → esbuild →  public/js/admin.js   (admin panel JS)
server.ts         → ts-node →  serves /public/*      (Express HTTP server)
```

---

## Notes

- All session data is stored and read from **Firebase Realtime Database** (no backend API — purely client-driven).
- The server is **static-file only** — no payment API routes. Xendit payment routes were removed.
- `concurrently` and `npm-run-all` were removed from devDependencies (they pulled in a blocked `shell-quote` package). The `dev` and `dev:*` scripts were removed accordingly — `build` and `start` remain.
