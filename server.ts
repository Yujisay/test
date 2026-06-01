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
      success_redirect_url: `${baseUrl}/payment-success.html?ref=${referenceNumber}`,
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
      await firebaseUpdate(`sessions/${event.external_id}`, {
        status: 'PENDING SESSION',
        paidAt: new Date().toISOString(),
        amount: event.paid_amount || event.amount,
        paymentConfirmed: true
      });
      console.log(`Payment confirmed for ${event.external_id} — ₱${event.paid_amount || event.amount}`);
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
    res.json({ status: data.status, paymentConfirmed: data.paymentConfirmed || false });
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
