import express, { Request, Response } from 'express';
import axios from 'axios';
import path from 'path';

import fs from 'fs';
if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf-8').split('\n').forEach(line => {
    const [key, ...rest] = line.trim().split('=');
    if (key && rest.length) process.env[key] = rest.join('=');
  });
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY || '';
const XENDIT_WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_TOKEN || '';
const FIREBASE_DB_URL = 'https://studyhub-f1fbe-default-rtdb.asia-southeast1.firebasedatabase.app';

async function firebaseSet(fbPath: string, data: object): Promise<any> {
  const res = await axios.put(`${FIREBASE_DB_URL}/${fbPath}.json`, data);
  return res.data;
}

async function firebaseUpdate(fbPath: string, data: object): Promise<any> {
  const res = await axios.patch(`${FIREBASE_DB_URL}/${fbPath}.json`, data);
  return res.data;
}

async function firebaseGet(fbPath: string): Promise<any> {
  const res = await axios.get(`${FIREBASE_DB_URL}/${fbPath}.json`);
  return res.data;
}

function getBaseUrl(req: Request): string {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const host = req.get('host') || 'localhost:5000';
  const proto = host.includes('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

function addHoursToTimeString(timeStr: string, hours: number, bookingDate?: string): string {
  let base: Date;
  if (bookingDate) {
    base = new Date(bookingDate + 'T00:00:00');
    if (isNaN(base.getTime())) base = new Date();
  } else {
    base = new Date();
  }
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return timeStr;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
  // If that date is already in the past, extend from now instead
  const extendFrom = date.getTime() < Date.now() ? new Date() : date;
  const newDate = new Date(extendFrom.getTime() + hours * 60 * 60 * 1000);
  return newDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

app.post('/api/create-payment', async (req: Request, res: Response) => {
  try {
    const { referenceNumber, fullName, seatType, duration, amount, hourlyRate, bookingDate, startTime, endTime } = req.body;

    if (!referenceNumber || !fullName || !amount) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const baseUrl = getBaseUrl(req);

    const invoicePayload = {
      external_id: referenceNumber,
      payer_email: `${fullName.toLowerCase().replace(/\s+/g, '.')}@studyhub.local`,
      description: `Study Hub WiFi — ${seatType} (${duration})`,
      amount: Math.round(amount),
      currency: 'PHP',
      customer: { given_names: fullName },
      customer_notification_preference: { invoice_paid: [] },
      success_redirect_url: `${baseUrl}/payment-success.html?ref=${referenceNumber}&tab=check`,
      failure_redirect_url: `${baseUrl}/payment-failed.html?ref=${referenceNumber}`,
      items: [{ name: `${seatType} — ${duration}`, quantity: 1, price: Math.round(amount), category: 'WiFi Access' }]
    };

    const xenditRes = await axios.post(
      'https://api.xendit.co/v2/invoices',
      invoicePayload,
      { auth: { username: XENDIT_SECRET_KEY, password: '' }, headers: { 'Content-Type': 'application/json' } }
    );

    const invoice = xenditRes.data;

    await firebaseSet(`sessions/${referenceNumber}`, {
      referenceNumber, fullName, seatType, duration, amount,
      hourlyRate: hourlyRate || null,
      bookingDate, startTime, endTime,
      status: 'AWAITING PAYMENT',
      paymentMethod: 'ONLINE',
      xenditInvoiceId: invoice.id,
      xenditInvoiceUrl: invoice.invoice_url,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, invoiceUrl: invoice.invoice_url, invoiceId: invoice.id, referenceNumber });
  } catch (err: any) {
    console.error('Create payment error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create payment. Please try again.' });
  }
});

// Stop-payment: create Xendit invoice for Open Time final billing
app.post('/api/create-stop-payment', async (req: Request, res: Response) => {
  try {
    const { referenceNumber, fullName, seatType, duration, amount } = req.body;

    if (!referenceNumber || !fullName || !amount) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const baseUrl = getBaseUrl(req);
    const stopRef = `${referenceNumber}-STOP`;

    const invoicePayload = {
      external_id: stopRef,
      payer_email: `${fullName.toLowerCase().replace(/\s+/g, '.')}@studyhub.local`,
      description: `Study Hub WiFi — ${seatType} ${duration} (Final Bill)`,
      amount: Math.round(amount),
      currency: 'PHP',
      customer: { given_names: fullName },
      customer_notification_preference: { invoice_paid: [] },
      success_redirect_url: `${baseUrl}/payment-success.html?ref=${referenceNumber}&tab=check&paid=1`,
      failure_redirect_url: `${baseUrl}/payment-failed.html?ref=${referenceNumber}`,
      items: [{ name: `${seatType} — ${duration}`, quantity: 1, price: Math.round(amount), category: 'WiFi Access' }]
    };

    const xenditRes = await axios.post(
      'https://api.xendit.co/v2/invoices',
      invoicePayload,
      { auth: { username: XENDIT_SECRET_KEY, password: '' }, headers: { 'Content-Type': 'application/json' } }
    );

    const invoice = xenditRes.data;

    await firebaseUpdate(`sessions/${referenceNumber}`, {
      xenditStopInvoiceUrl: invoice.invoice_url,
      xenditStopInvoiceId: invoice.id
    });

    res.json({ success: true, invoiceUrl: invoice.invoice_url });
  } catch (err: any) {
    console.error('Create stop payment error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create stop payment link.' });
  }
});

// Extend-payment: create Xendit invoice for session extension
app.post('/api/create-extend-payment', async (req: Request, res: Response) => {
  try {
    const { referenceNumber, fullName, seatType, extensionHours, amount } = req.body;

    if (!referenceNumber || !fullName || !amount || !extensionHours) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const baseUrl = getBaseUrl(req);
    const extRef = `${referenceNumber}-EXT`;
    const hoursLabel = extensionHours === 0.5 ? '30 min' : `${extensionHours}hr`;

    const invoicePayload = {
      external_id: extRef,
      payer_email: `${fullName.toLowerCase().replace(/\s+/g, '.')}@studyhub.local`,
      description: `Study Hub WiFi — ${seatType} Extension (+${hoursLabel})`,
      amount: Math.round(amount),
      currency: 'PHP',
      customer: { given_names: fullName },
      customer_notification_preference: { invoice_paid: [] },
      success_redirect_url: `${baseUrl}/payment-success.html?ref=${referenceNumber}&tab=check&extended=1`,
      failure_redirect_url: `${baseUrl}/payment-failed.html?ref=${referenceNumber}`,
      items: [{ name: `${seatType} — Extension (+${hoursLabel})`, quantity: 1, price: Math.round(amount), category: 'WiFi Access' }]
    };

    const xenditRes = await axios.post(
      'https://api.xendit.co/v2/invoices',
      invoicePayload,
      { auth: { username: XENDIT_SECRET_KEY, password: '' }, headers: { 'Content-Type': 'application/json' } }
    );

    const invoice = xenditRes.data;

    // Store pending extension info so webhook knows what to do
    const currentSession = await firebaseGet(`sessions/${referenceNumber}`);
    await firebaseUpdate(`sessions/${referenceNumber}`, {
      pendingExtension: {
        hours: extensionHours,
        amount: amount,
        currentEndTime: currentSession?.endTime || '',
        invoiceId: invoice.id
      }
    });

    res.json({ success: true, invoiceUrl: invoice.invoice_url });
  } catch (err: any) {
    console.error('Create extend payment error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create extension payment link.' });
  }
});

app.post('/api/xendit-webhook', async (req: Request, res: Response) => {
  try {
    const incomingToken = req.headers['x-callback-token'];
    if (!incomingToken || incomingToken !== XENDIT_WEBHOOK_TOKEN) {
      console.warn('Webhook rejected: invalid token');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const event = req.body;
    console.log('Xendit webhook received:', event.status, event.external_id);

    if (event.status === 'PAID' || event.status === 'SETTLED') {
      const externalId: string = event.external_id || '';
      const isStopPayment = externalId.endsWith('-STOP');
      const isExtendPayment = externalId.endsWith('-EXT');
      const sessionRef = isStopPayment
        ? externalId.replace(/-STOP$/, '')
        : isExtendPayment
          ? externalId.replace(/-EXT$/, '')
          : externalId;

      const currentSession = await firebaseGet(`sessions/${sessionRef}`);
      const currentStatus = currentSession?.status;

      if (isExtendPayment) {
        // Extension paid — calculate new endTime and reactivate
        const ext = currentSession?.pendingExtension;
        const baseEndTime = ext?.currentEndTime || currentSession?.endTime || '';
        const extHours = ext?.hours || 1;
        const extAmount = ext?.amount || 0;
        const newEndTime = baseEndTime ? addHoursToTimeString(baseEndTime, extHours, currentSession?.bookingDate) : '';
        const newAmount = Math.round(((Number(currentSession?.amount) || 0) + extAmount) * 100) / 100;
        const hoursLabel = extHours === 0.5 ? '30 min' : `${extHours}hr`;

        await firebaseUpdate(`sessions/${sessionRef}`, {
          status: 'ACTIVE',
          endTime: newEndTime,
          amount: newAmount,
          duration: `${currentSession?.duration || ''} +${hoursLabel}`.trim(),
          paidAt: new Date().toISOString(),
          paymentConfirmed: true,
          pendingExtension: null
        });
        console.log(`Extension confirmed for ${sessionRef} — +${hoursLabel}, new end: ${newEndTime}`);
      } else if (isStopPayment || currentStatus === 'EXPIRED') {
        // Stop payment — confirm amount, session already closed
        await firebaseUpdate(`sessions/${sessionRef}`, {
          paidAt: new Date().toISOString(),
          paymentConfirmed: true,
          amount: event.paid_amount || event.amount
        });
        console.log(`Stop payment confirmed for ${sessionRef} — ₱${event.paid_amount || event.amount}`);
      } else {
        // Normal new-booking flow
        await firebaseUpdate(`sessions/${sessionRef}`, {
          status: 'PENDING SESSION',
          paidAt: new Date().toISOString(),
          amount: event.paid_amount || event.amount,
          paymentConfirmed: true
        });
        console.log(`Payment confirmed for ${sessionRef} — ₱${event.paid_amount || event.amount}`);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.get('/api/payment-status/:refNum', async (req: Request, res: Response) => {
  try {
    const data = await firebaseGet(`sessions/${req.params.refNum}`);
    if (!data) return res.status(404).json({ error: 'Session not found' });
    res.json({ status: data.status, paymentConfirmed: data.paymentConfirmed || false, fullName: data.fullName || '' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});

app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Study Hub server running on port ${PORT}`);
});
