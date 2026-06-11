# Han12 Study Hub — WiFi Session Portal

A self-hosted captive portal for managing study hub / co-working seat sessions. Customers book a seat via the web portal; the admin approves and monitors sessions in real time via a password-protected dashboard. All session data lives in Firebase Realtime Database — no backend database setup required.

---

## Features

- Book fixed-duration or open-time seats (Regular, Lounge, Cubicle)
- Admin dashboard with live countdown / elapsed timers per session
- Auto-expiry: sessions are marked EXPIRED automatically when end time passes
- Extend or stop sessions from both the customer and admin side
- Receipt download (canvas-rendered PNG)
- Dark mode admin panel
- CSV / sales report export

---

## Requirements

- **Node.js 18 or higher** — [https://nodejs.org](https://nodejs.org)
- npm (comes with Node.js)

---

## Setup & Run

```bash
# 1. Clone or extract the project
git clone <your-repo-url>
cd <project-folder>

# 2. Install dependencies (includes build tools)
npm install

# 3. Build frontend + start the server
npm start
```

The server starts on **port 5000**.  
Open `http://localhost:5000` in your browser.

---

## Pages

| URL | Description |
|-----|-------------|
| `/` | Customer booking & session check portal |
| `/admin.html` | Admin dashboard (password protected) |
| `/payment-success.html` | Online payment success landing page |
| `/payment-failed.html` | Online payment failed landing page |

---

## Firebase Configuration

Firebase is pre-configured and ready to use. The project connects to the Han12 Study Hub Firebase Realtime Database automatically.

If you want to use your own Firebase project:
1. Create a project at [https://console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Realtime Database**
3. Replace the config values in `src/config.ts`:
   ```ts
   export const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT",
     databaseURL: "https://YOUR_PROJECT-default-rtdb.REGION.firebasedatabase.app",
   };
   ```
4. Set your database rules (`database.rules.json`) and publish them in the Firebase console.
5. Rebuild: `npm run build`

---

## npm Scripts

| Script | What it does |
|--------|-------------|
| `npm start` | Builds frontend JS then starts the Express server |
| `npm run build` | Compiles `src/main.ts` → `public/js/app.js` and `src/admin-page.ts` → `public/js/admin.js` using esbuild |

---

## Project Structure

```
├── server.ts              # Express server (serves /public on port 5000)
├── src/
│   ├── main.ts            # Customer portal entry point
│   ├── admin-page.ts      # Admin panel entry point
│   ├── admin.ts           # Admin dashboard logic
│   ├── booking.ts         # Session booking / checkout
│   ├── session.ts         # Session status / extend / stop
│   ├── auto-expire.ts     # Background auto-expiry watcher
│   ├── firebase.ts        # Firebase init
│   ├── config.ts          # Firebase config + pricing
│   ├── state.ts           # Shared app state
│   ├── types.ts           # TypeScript interfaces
│   ├── ui.ts              # UI utilities (modals, loaders, receipt)
│   └── globals.d.ts       # Browser global type declarations
├── public/
│   ├── index.html         # Customer portal
│   ├── admin.html         # Admin dashboard
│   ├── payment-success.html
│   ├── payment-failed.html
│   ├── style.css
│   ├── js/
│   │   ├── app.js         # Built customer bundle
│   │   └── admin.js       # Built admin bundle
│   └── img/
│       ├── han12_logo_transparent.png
│       └── logo.jpg
├── package.json
├── tsconfig.json
└── database.rules.json    # Firebase security rules
```

---

## Deploying

The app is a standard Node.js/Express server. You can deploy it on:

- **Replit** — already configured (`.replit` file included)
- **Railway / Render / Fly.io** — set start command to `npm start`, port to `5000`
- **VPS / Linux server** — `npm install && npm start`

> **Note:** Make sure `PORT` environment variable matches your host's expected port, or change the `PORT` constant in `server.ts`.
