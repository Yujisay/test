import { HOURLY_RATE } from './config';
import { getDb } from './firebase';
import { SessionRecord } from './types';
import { showLoader, hideLoader } from './ui';

let countdownInterval: ReturnType<typeof setInterval> | null = null;
let elapsedInterval: ReturnType<typeof setInterval> | null = null;
let autoExpireHandled = false;
let currentViewingRecord: SessionRecord | null = null;

export let stopSessionData: {
  refNum: string;
  record: SessionRecord;
  finalAmount: number;
  timeLabel: string;
} | null = null;

export let extendData: {
  refNum: string;
  record: SessionRecord;
} | null = null;

function clearCountdown(): void {
  if (countdownInterval !== null) { clearInterval(countdownInterval); countdownInterval = null; }
  if (elapsedInterval !== null) { clearInterval(elapsedInterval); elapsedInterval = null; }
}

function parseSessionTime(timeStr: string, bookingDate?: string): Date {
  let base: Date;
  if (bookingDate) {
    // bookingDate is "YYYY-MM-DD" — force midnight local time
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

function addHoursToTimeString(timeStr: string, hours: number, bookingDate?: string): string {
  const date = parseSessionTime(timeStr, bookingDate);
  const newDate = new Date(date.getTime() + hours * 60 * 60 * 1000);
  return newDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

async function autoExpireAndOfferExtend(record: SessionRecord): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.ref('sessions/' + record.referenceNumber).update({ status: 'EXPIRED' });
  } catch (e) { /* ignore if already expired */ }
  openExtendModal(record.referenceNumber, record, true);
}

function startCountdown(endTime: string, bookingDate?: string): void {
  clearCountdown();
  autoExpireHandled = false;

  function tick() {
    const end = parseSessionTime(endTime, bookingDate);
    const remaining = end.getTime() - Date.now();
    const countdownEl = document.getElementById('sessionCountdown');
    const warningEl = document.getElementById('sessionWarningBanner');
    if (!countdownEl) { clearCountdown(); return; }

    if (remaining <= 0) {
      countdownEl.textContent = '00:00';
      warningEl?.classList.remove('hidden');
      clearCountdown();
      if (!autoExpireHandled && currentViewingRecord) {
        autoExpireHandled = true;
        autoExpireAndOfferExtend(currentViewingRecord);
      }
      return;
    }

    const totalSecs = Math.floor(remaining / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    countdownEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

    if (remaining <= 5 * 60 * 1000) {
      warningEl?.classList.remove('hidden');
      countdownEl.classList.add('text-rose-600', 'animate-pulse');
    } else {
      warningEl?.classList.add('hidden');
      countdownEl.classList.remove('text-rose-600', 'animate-pulse');
    }
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

function startElapsedTimer(startTimestamp: string): void {
  clearCountdown();

  function tick() {
    const el = document.getElementById('sessionElapsed');
    if (!el) { clearCountdown(); return; }
    const elapsedMs = Date.now() - new Date(startTimestamp).getTime();
    const totalSecs = Math.floor(elapsedMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    el.textContent = hrs > 0
      ? `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`
      : `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }

  tick();
  elapsedInterval = setInterval(tick, 1000);
}

export async function checkSessionStatus(): Promise<void> {
  clearCountdown();
  const db = getDb();
  const name = (document.getElementById("searchName") as HTMLInputElement).value.trim();
  if (!name || !db) return;

  const resultsDiv = document.getElementById("checkResultContainer") as HTMLElement;
  const emptyState = document.getElementById("checkEmptyState") as HTMLElement;

  emptyState.classList.add("hidden");
  resultsDiv.classList.remove("hidden");
  resultsDiv.innerHTML = `<div class="p-12 text-center"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto text-brand-primary"></i></div>`;
  if (window.lucide) lucide.createIcons();

  try {
    const snapshot = await db.ref('sessions').orderByChild('fullName').equalTo(name).once('value');
    if (snapshot.exists()) {
      const records: SessionRecord[] = Object.values(snapshot.val());
      records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      renderSessionCard(records[0]);
    } else {
      renderNoRecordFound(name);
    }
  } catch (error) {
    console.error("Query Error:", error);
    renderNoRecordFound(name + " (Error)");
  }
}

export function renderSessionCard(record: SessionRecord): void {
  currentViewingRecord = record;
  autoExpireHandled = false;

  const resultsDiv = document.getElementById("checkResultContainer") as HTMLElement;
  const statusColor = record.status === 'ACTIVE'
    ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : record.status === 'PENDING SESSION'
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-brand-neutral bg-brand-light border-brand-border';

  const isOpenTime = record.duration === 'Open Time' || record.duration.startsWith('Open Time');
  const isActive = record.status === 'ACTIVE';
  const isExpired = record.status === 'EXPIRED';
  const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
  const amountDisplay = isOpenTime && isActive
    ? `₱${rate}/hr` : `₱${Number(record.amount).toFixed(2)}`;

  // Countdown / elapsed / action section
  let timerSection = '';
  if (isActive && !isOpenTime && record.endTime) {
    timerSection = `
      <div id="sessionWarningBanner" class="hidden p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs font-semibold text-rose-700 animate-pulse">
        <i data-lucide="alarm-clock" class="w-4 h-4 shrink-0"></i>
        <span>Your session is almost over! Please prepare to wrap up or extend.</span>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="p-3 bg-brand-light rounded-xl border border-brand-border text-center">
          <span class="text-[9px] text-brand-neutral uppercase block mb-1">Start</span>
          <span class="text-sm font-bold text-brand-dark font-mono">${record.startTime}</span>
        </div>
        <div class="p-3 bg-brand-light rounded-xl border border-brand-border text-center">
          <span class="text-[9px] text-brand-neutral uppercase block mb-1">End</span>
          <span class="text-sm font-bold text-brand-dark font-mono">${record.endTime}</span>
        </div>
      </div>
      <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
        <span class="text-[10px] text-emerald-700 uppercase font-bold block mb-1">Time Remaining</span>
        <span id="sessionCountdown" class="text-3xl font-extrabold font-['Outfit'] text-emerald-700 block digital-clock">--:--</span>
      </div>
      <button data-ref="${record.referenceNumber}" class="btn-extend-session w-full py-3 px-4 rounded-xl text-sm font-bold bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-primary flex items-center justify-center gap-2 transition-all">
        <i data-lucide="clock-arrow-up" class="w-4 h-4"></i>
        Extend Session
      </button>`;
  } else if (isActive && isOpenTime) {
    timerSection = `
      <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center">
        <span class="text-[10px] text-amber-700 uppercase font-bold block mb-1">Time Elapsed</span>
        <span id="sessionElapsed" class="text-2xl font-extrabold font-['Outfit'] text-amber-700 block digital-clock">0m 00s</span>
        <span class="text-[10px] text-amber-600 mt-1 block">Billing at ₱${rate}/hr — 15-min increments</span>
      </div>
      <button data-ref="${record.referenceNumber}" class="btn-customer-stop-session w-full py-3 px-4 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-2 transition-all">
        <i data-lucide="timer-off" class="w-4 h-4"></i>
        Stop My Session
      </button>`;
  } else if (isExpired && !isOpenTime) {
    timerSection = `
      <div class="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center">
        <span class="text-[10px] text-rose-600 uppercase font-bold block mb-1">Session Ended</span>
        <span class="text-sm font-semibold text-rose-700">Your time is up.</span>
      </div>
      <button data-ref="${record.referenceNumber}" class="btn-extend-session w-full py-3 px-4 rounded-xl text-sm font-bold bg-brand-primary hover:bg-brand-primary/90 text-white flex items-center justify-center gap-2 transition-all">
        <i data-lucide="clock-arrow-up" class="w-4 h-4"></i>
        Extend &amp; Continue
      </button>`;
  } else {
    timerSection = `
      <div class="grid grid-cols-2 gap-3">
        <div class="p-3 bg-brand-light rounded-xl border border-brand-border text-center">
          <span class="text-[9px] text-brand-neutral uppercase block mb-1">Start</span>
          <span class="text-sm font-bold text-brand-dark font-mono">${record.startTime}</span>
        </div>
        <div class="p-3 bg-brand-light rounded-xl border border-brand-border text-center">
          <span class="text-[9px] text-brand-neutral uppercase block mb-1">End</span>
          <span class="text-sm font-bold text-brand-dark font-mono">${record.endTime}</span>
        </div>
      </div>`;
  }

  resultsDiv.innerHTML = `
    <div class="glass-ticket p-6 rounded-3xl border border-brand-border bg-brand-surface space-y-5 animate-fade-in shadow-soft">
      <div class="flex items-center justify-between border-b border-brand-border pb-4">
        <div>
          <span class="text-[10px] font-semibold text-brand-neutral uppercase block">Reference</span>
          <span class="font-extrabold font-['Outfit'] text-brand-primary text-lg">${record.referenceNumber}</span>
        </div>
        <span class="text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg border ${statusColor}">${record.status}</span>
      </div>
      <div class="space-y-3 text-sm">
        <div class="flex justify-between"><span class="text-brand-neutral">Name</span><span class="font-semibold text-brand-dark">${record.fullName}</span></div>
        <div class="flex justify-between"><span class="text-brand-neutral">Seat</span><span class="font-semibold text-brand-dark">${record.seatType}</span></div>
        <div class="flex justify-between"><span class="text-brand-neutral">Duration</span><span class="font-semibold text-brand-dark">${record.duration}</span></div>
        <div class="flex justify-between items-center pt-2 border-t border-brand-border">
          <span class="text-brand-neutral">${isOpenTime && isActive ? 'Rate' : 'Amount'}</span>
          <span class="font-black font-['Outfit'] text-brand-primary text-lg">${amountDisplay}</span>
        </div>
      </div>
      ${timerSection}
      <button id="btnClearSearch" class="w-full py-3 px-4 rounded-xl text-xs font-bold bg-brand-light border border-brand-border hover:bg-brand-secondary/20 text-brand-dark transition-all">Search Again</button>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  if (isActive && !isOpenTime && record.endTime) {
    setTimeout(() => startCountdown(record.endTime, record.bookingDate), 50);
  } else if (isActive && isOpenTime && record.timestamp) {
    setTimeout(() => startElapsedTimer(record.timestamp), 50);
  }
}

export function renderNoRecordFound(name: string): void {
  const resultsDiv = document.getElementById("checkResultContainer") as HTMLElement;
  resultsDiv.innerHTML = `
    <div class="p-8 text-center space-y-3 bg-brand-surface border border-brand-border rounded-2xl shadow-soft animate-fade-in">
      <div class="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-rose-400">
        <i data-lucide="user-x" class="w-5 h-5"></i>
      </div>
      <div>
        <h4 class="text-sm font-bold text-brand-dark">No Record Found</h4>
        <p class="text-xs text-brand-neutral mt-1">No session found for "<strong>${name}</strong>".</p>
      </div>
      <button id="btnRetrySearch" class="mt-2 px-4 py-2 text-xs font-bold rounded-lg bg-brand-light border border-brand-border hover:bg-brand-secondary/20 text-brand-dark transition-all">Try Again</button>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

export function clearSearchLookup(): void {
  clearCountdown();
  currentViewingRecord = null;
  (document.getElementById("searchName") as HTMLInputElement).value = "";
  (document.getElementById("checkResultContainer") as HTMLElement).classList.add("hidden");
  (document.getElementById("checkEmptyState") as HTMLElement).classList.remove("hidden");
}

// ─── Extend session ───────────────────────────────────────────────────────────

export function openExtendModal(refNum: string, record: SessionRecord, isExpired = false): void {
  extendData = { refNum, record };
  const titleEl = document.getElementById('extendModalTitle');
  const subtitleEl = document.getElementById('extendModalSubtitle');
  if (titleEl) titleEl.textContent = isExpired ? 'Time\'s Up! Extend?' : 'Extend Your Session';
  if (subtitleEl) subtitleEl.textContent = isExpired
    ? 'Your session has ended. Pay to extend and keep your seat.'
    : 'Add more time to your current session.';

  // Default to 1 hour selected
  const defaultRadio = document.querySelector('input[name="extendDuration"][value="1"]') as HTMLInputElement;
  if (defaultRadio) defaultRadio.checked = true;

  updateExtendCostPreview();
  (document.getElementById('extendSessionModal') as HTMLElement).classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

export function closeExtendModal(): void {
  (document.getElementById('extendSessionModal') as HTMLElement).classList.add('hidden');
  extendData = null;
}

export function updateExtendCostPreview(): void {
  if (!extendData) return;
  const { record } = extendData;
  const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
  const selected = document.querySelector('input[name="extendDuration"]:checked') as HTMLInputElement;
  const hours = selected ? parseFloat(selected.value) : 1;
  const cost = Math.round(hours * rate * 100) / 100;
  const label = hours === 0.5 ? '30 minutes' : `${hours} hour${hours > 1 ? 's' : ''}`;

  const costEl = document.getElementById('extendCostPreview');
  const labelEl = document.getElementById('extendDurationLabel');
  const rateEl = document.getElementById('extendRateNote');

  if (costEl) costEl.textContent = `₱${cost.toFixed(2)}`;
  if (labelEl) labelEl.textContent = `+${label}`;
  if (rateEl) rateEl.textContent = `₱${rate}/hr — ${record.seatType}`;
}

export async function confirmExtendCash(): Promise<void> {
  if (!extendData) return;
  const { refNum, record } = extendData;
  const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
  const selected = document.querySelector('input[name="extendDuration"]:checked') as HTMLInputElement;
  const hours = selected ? parseFloat(selected.value) : 1;
  const cost = Math.round(hours * rate * 100) / 100;
  const hoursLabel = hours === 0.5 ? '30 min' : `${hours}hr`;

  closeExtendModal();
  alert(`Extension Request — Ref#: ${refNum}\n\nDuration: +${hoursLabel}\nAmount due: ₱${cost.toFixed(2)}\n\nPlease proceed to the cashier desk and show this reference number. The cashier will extend your session once payment is received.`);
}

export async function confirmExtendOnline(): Promise<void> {
  if (!extendData) return;
  const { refNum, record } = extendData;
  const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
  const selected = document.querySelector('input[name="extendDuration"]:checked') as HTMLInputElement;
  const hours = selected ? parseFloat(selected.value) : 1;
  const cost = Math.round(hours * rate * 100) / 100;
  const hoursLabel = hours === 0.5 ? '30 min' : `${hours}hr`;

  try {
    showLoader("Preparing...", "Setting up your extension payment...");
    const res = await fetch('/api/create-extend-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceNumber: refNum,
        fullName: record.fullName,
        seatType: record.seatType,
        extensionHours: hours,
        amount: cost
      })
    });
    const data = await res.json();
    hideLoader();

    if (data.invoiceUrl) {
      closeExtendModal();
      window.location.href = data.invoiceUrl;
    } else {
      alert(`Could not create payment link. Please pay at the cashier desk.\n\nRef#: ${refNum}\nExtension: +${hoursLabel}\nAmount: ₱${cost.toFixed(2)}`);
    }
  } catch (err) {
    hideLoader();
    console.error("Online extend payment error:", err);
    alert("Payment link creation failed. Please pay at the cashier instead.");
  }
}

// ─── Stop Open Time session ───────────────────────────────────────────────────

export async function stopOpenTimeSession(refNum: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  showLoader("Calculating...", "Computing your session billing...");
  const snapshot = await db.ref('sessions/' + refNum).once('value');
  const record: SessionRecord = snapshot.val();
  hideLoader();

  if (!record) return;

  const elapsedMs = Date.now() - new Date(record.timestamp).getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const roundedHours = Math.max(0.25, Math.ceil(elapsedHours * 4) / 4);
  const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
  const finalAmount = Math.round(roundedHours * rate * 100) / 100;
  const hrs = Math.floor(roundedHours);
  const mins = Math.round((roundedHours - hrs) * 60);
  const timeLabel = `${hrs > 0 ? hrs + 'h ' : ''}${mins > 0 ? mins + 'm' : ''}`.trim() || '15m';

  stopSessionData = { refNum, record, finalAmount, timeLabel };

  const stopTimeEl = document.getElementById('stopTimeUsed');
  const stopAmtEl = document.getElementById('stopAmountDue');
  if (stopTimeEl) stopTimeEl.textContent = timeLabel;
  if (stopAmtEl) stopAmtEl.textContent = `₱${finalAmount.toFixed(2)}`;

  (document.getElementById('stopSessionModal') as HTMLElement).classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

export async function confirmStopCash(): Promise<void> {
  if (!stopSessionData) return;
  const { refNum, finalAmount, timeLabel } = stopSessionData;
  const db = getDb();
  if (!db) return;

  try {
    showLoader("Stopping...", "Ending your session...");
    const endTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    await db.ref('sessions/' + refNum).update({
      status: 'EXPIRED',
      amount: finalAmount,
      endTime,
      duration: `Open Time (${timeLabel})`
    });
    hideLoader();
    (document.getElementById('stopSessionModal') as HTMLElement).classList.add('hidden');
    stopSessionData = null;
    alert(`Session stopped.\n\nRef#: ${refNum}\nTime Used: ${timeLabel}\nAmount Due: ₱${finalAmount.toFixed(2)}\n\nPlease proceed to the cashier desk to complete your payment.`);
    clearSearchLookup();
  } catch (err) {
    hideLoader();
    console.error("Stop session error:", err);
    alert("Failed to stop session. Please try again.");
  }
}

export async function confirmStopOnline(): Promise<void> {
  if (!stopSessionData) return;
  const { refNum, record, finalAmount, timeLabel } = stopSessionData;
  const db = getDb();
  if (!db) return;

  try {
    showLoader("Preparing...", "Setting up your online payment...");
    const endTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    await db.ref('sessions/' + refNum).update({
      status: 'EXPIRED',
      amount: finalAmount,
      endTime,
      duration: `Open Time (${timeLabel})`
    });

    const res = await fetch('/api/create-stop-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceNumber: refNum,
        fullName: record.fullName,
        seatType: record.seatType,
        duration: `Open Time (${timeLabel})`,
        amount: finalAmount
      })
    });
    const data = await res.json();
    hideLoader();

    if (data.invoiceUrl) {
      (document.getElementById('stopSessionModal') as HTMLElement).classList.add('hidden');
      stopSessionData = null;
      window.location.href = data.invoiceUrl;
    } else {
      alert('Could not create payment link. Please pay at the cashier desk instead.\n\nRef#: ' + refNum + '\nAmount: ₱' + finalAmount.toFixed(2));
    }
  } catch (err) {
    hideLoader();
    console.error("Online stop payment error:", err);
    alert("Payment link creation failed. Please pay at the cashier instead.");
  }
}
