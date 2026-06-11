/**
 * auto-expire.ts
 * Watches all ACTIVE sessions in Firebase in real time.
 * For each fixed-duration ACTIVE session, schedules a setTimeout that writes
 * status: 'EXPIRED' the moment the session's endTime passes — even if no
 * customer or admin has the session card open.
 *
 * Open-time sessions are excluded; they are stopped manually by the customer
 * or admin.
 */

import { getDb, sessionKey } from './firebase';
import { SessionRecord } from './types';

const expireTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function parseEndTime(timeStr: string, bookingDate?: string): Date {
  let base: Date;
  if (bookingDate) {
    base = new Date(bookingDate + 'T00:00:00');
    if (isNaN(base.getTime())) base = new Date();
  } else {
    base = new Date();
  }
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return base;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
}

async function markExpired(key: string, record: SessionRecord): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const snap = await db.ref('sessions/' + key + '/status').once('value');
    if (snap.val() !== 'ACTIVE') return;
    await db.ref('sessions/' + key).update({ status: 'EXPIRED' });
    console.log(
      `[AutoExpire] ${record.referenceNumber} (${record.fullName}) → EXPIRED`
    );
  } catch (e) {
    console.warn('[AutoExpire] Failed to expire', key, e);
  }
}

function scheduleExpiry(key: string, record: SessionRecord): void {
  if (expireTimers[key]) {
    clearTimeout(expireTimers[key]);
    delete expireTimers[key];
  }

  if (!record.endTime) return;

  const isOpenTime =
    record.duration === 'Open Time' || record.duration.startsWith('Open Time');
  if (isOpenTime) return;

  const endDate = parseEndTime(record.endTime, record.bookingDate);
  const remaining = endDate.getTime() - Date.now();

  if (remaining <= 0) {
    markExpired(key, record);
  } else {
    expireTimers[key] = setTimeout(() => {
      delete expireTimers[key];
      markExpired(key, record);
    }, remaining);
    console.log(
      `[AutoExpire] ${record.referenceNumber} scheduled to expire in ` +
        `${Math.round(remaining / 1000)}s`
    );
  }
}

function clearAllTimers(): void {
  Object.keys(expireTimers).forEach(k => {
    clearTimeout(expireTimers[k]);
    delete expireTimers[k];
  });
}

export function startAutoExpireWatcher(): void {
  const db = getDb();
  if (!db) {
    console.warn('[AutoExpire] No database — watcher not started.');
    return;
  }

  db.ref('sessions')
    .orderByChild('status')
    .equalTo('ACTIVE')
    .on('value', (snapshot: any) => {
      clearAllTimers();

      if (!snapshot.exists()) return;

      const sessions = snapshot.val() as Record<string, SessionRecord>;
      Object.entries(sessions).forEach(([key, record]) => {
        scheduleExpiry(key, record);
      });
    });

  console.log('[AutoExpire] Watcher started — monitoring all active sessions.');
}

export function stopAutoExpireWatcher(): void {
  const db = getDb();
  clearAllTimers();
  if (db) {
    db.ref('sessions').orderByChild('status').equalTo('ACTIVE').off('value');
  }
  console.log('[AutoExpire] Watcher stopped.');
}
