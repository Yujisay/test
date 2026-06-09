# Firebase & Project Setup Guide — Han12 Study Hub

This project uses **Firebase Realtime Database** as its sole backend. All sessions, payments, and status updates are stored here. Follow this guide when setting up a fresh environment or re-configuring an existing one.

---

## 1. Firebase Realtime Database — Security Rules

Paste these rules into **Firebase Console → Realtime Database → Rules**:

```json
{
  "rules": {
    "sessions": {
      ".read": true,
      ".write": true,
      ".indexOn": ["fullName", "status", "timestamp"],
      "$session_id": {
        ".validate": "newData.hasChildren(['referenceNumber', 'fullName', 'status'])"
      }
    }
  }
}
```

> For production, restrict `.write` to authenticated admin users only (Firebase Auth).

---

## 2. Firebase Configuration

The Firebase config is hardcoded in `public/js/firebase-init.js`. Update these values with your own Firebase project credentials:

```js
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

---

## 3. Session Data Schema

Each session is stored under `/sessions/{referenceNumber}`:

```json
{
  "REFERENCE_CODE": {
    "referenceNumber": "HAN-XXXXXXXX",
    "fullName": "Juan Dela Cruz",
    "seatType": "Regular Seat",
    "duration": "3 hours",
    "amount": 60,
    "status": "PENDING SESSION",
    "paymentMethod": "CASH",
    "timestamp": "2026-06-09T08:00:00.000Z",
    "startTime": "2026-06-09T08:00:00.000Z",
    "endTime": "2026-06-09T11:00:00.000Z"
  }
}
```

**`status` values used in this app:**

| Value | Description |
|---|---|
| `PENDING SESSION` | Booked, awaiting cashier payment confirmation |
| `ACTIVE` | Session paid and currently in progress |
| `AWAITING PAYMENT` | Extension/stop requested, pending cashier approval |
| `COMPLETED` | Session ended |
| `CANCELLED` | Session cancelled by admin |

> `paymentMethod` is always `"CASH"` — online/Xendit payments have been fully removed.

---

## 4. Payment Flow (Cash-Only, No Online Payments)

All payments are handled at the cashier counter. Online payment (Xendit) has been removed.

**How it works:**
1. Customer fills in Name, Seat Type, Duration on the portal.
2. Clicks **Confirm & Book** — creates a `PENDING SESSION` record in Firebase.
3. A **QR code modal** appears with GCash or Maya QR for the customer to show the cashier (cash scan reference). The cashier confirms receipt manually.
4. Admin clicks **Approve** in the Admin Panel → status changes to `ACTIVE`.
5. When the customer wants to extend or stop, they request it via the portal → status becomes `AWAITING PAYMENT` → cashier approves again.

**QR image files** are stored in `public/img/`:
- `public/img/qr-gcash.png` — GCash QR code image
- `public/img/qr-paymaya.png` — Maya/PayMaya QR code image

Replace these image files with your own QR codes (keep the same filenames). You can also update the paths in `QR_CONFIG` inside `public/js/app.js`:

```js
const QR_CONFIG = {
  gcash:  { label: "GCash",  img: "/img/qr-gcash.png"   },
  paymaya:{ label: "Maya",   img: "/img/qr-paymaya.png" }
};
```

---

## 5. Admin Panel Access

The admin panel is hidden by default. To access it:
1. Scroll to the **footer** of the portal page.
2. **Triple-click** the lock icon (🔒).
3. Enter the admin passcode.

**Default passcode** is set in `public/js/app.js` — search for `ADMIN_PASS` and change it:

```js
const ADMIN_PASS = "admin123"; // ← change this
```

**Admin panel features:**
- View all sessions (Active, Pending, Completed)
- **Approve** pending payment requests
- **Extend** or **Stop** active sessions
- **Sales Report** — date-range export
- **Actions dropdown** (top-right of admin header): Refresh Logs, Sales Report, Archive Old Sessions

---

## 6. Branding & UI Configuration

| Item | Location | Value |
|---|---|---|
| Logo image | `public/img/logo.jpg` | Replace with your logo (keep filename) |
| Site name | `public/index.html` — `<h1>` in header | `Han12` |
| Brand primary color | `public/index.html` Tailwind config | `#535C3B` (dark olive) |
| Brand secondary color | Tailwind config | `#E5D3B3` (tan/cream) |
| Header background | `<header>` element | `bg-brand-primary` (dark olive, white text) |
| Tagline | `<header>` sub-line | `STUDY HUB · VA LOUNGE · SNACKS` |

---

## 7. Data Import (Migration from Google Sheets)

1. Export your Google Sheet as **JSON**.
2. Format records to match the schema in Section 3.
3. In Firebase Console → **Realtime Database → Data**, click ⋮ → **Import JSON**.

---

## 8. Maintenance & Cleanup

- **Archive Sessions**: Use the **Archive Old Sessions** button in the Admin Panel actions dropdown to bulk-remove old records.
- **Auto-cleanup**: Firebase does not auto-delete old records. Set up a Firebase Cloud Function to prune sessions older than 30 days if needed.
- **Database URL**: Ensure `databaseURL` in `firebase-init.js` points to your correct regional URL (e.g., `asia-southeast1` for Philippines).
