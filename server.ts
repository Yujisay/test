/**
 * server.ts — Han12 Study Hub Portal
 * Express server for the cash-only WiFi session management portal.
 * Serves static frontend files from /public.
 * All session logic runs client-side via Firebase Realtime Database.
 *
 * Changed: Removed all Xendit payment API routes (/api/create-payment,
 *          /api/create-stop-payment, /api/create-extend-payment,
 *          /api/xendit-webhook, /api/payment-status).
 *          Removed axios dependency usage and Xendit credentials.
 *          The server now only serves static files.
 */

// ============================================================
// CONFIG — edit these values if needed
// ============================================================
const PORT = 5000;
// ============================================================

import express, { Request, Response } from 'express';
import path from 'path';

const app = express();
app.use(express.json());

// Serve all static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Fallback — send index.html for any unmatched route (SPA-style)
// Express 5 requires explicit wildcard parameter syntax
app.get('/{*path}', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Han12 Study Hub server running on port ${PORT}`);
});
