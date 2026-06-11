import { PRICING, HOURLY_RATE, CLOSING_TIME } from './config';
import { state } from './state';
import { SessionTimes, SessionRecord } from './types';
import { showLoader, hideLoader, showFormError, showTicketModal } from './ui';
import { getDb, sessionKey } from './firebase';

export function computeSessionTimes(hours: number, duration: string): SessionTimes {
  const now = new Date();
  now.setSeconds(0);
  now.setMilliseconds(0);

  const startTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  let endTime: string;

  if (duration === 'Open Time') {
    const [closeHour, closeMin] = CLOSING_TIME.split(':');
    const closingDate = new Date(now);
    closingDate.setHours(parseInt(closeHour), parseInt(closeMin), 0, 0);
    endTime = closingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } else {
    const end = new Date(now.getTime() + hours * 60 * 60 * 1000);
    endTime = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return { startTime, endTime };
}

export function onDurationChange(): void {
  const duration = (document.getElementById("durationSelect") as HTMLSelectElement).value;
  const wrapper = document.getElementById("customDurationWrapper") as HTMLElement;
  if (wrapper) {
    wrapper.classList.toggle("hidden", duration !== 'Custom');
  }
  updateFormPreview();
  updateOnlineNoteVisibility();
}

function updateOnlineNoteVisibility(): void {
  const duration = (document.getElementById("durationSelect") as HTMLSelectElement).value;
  const onlineNote = document.getElementById("onlinePayNote") as HTMLElement;
  const onlineOpenTimeNote = document.getElementById("onlineOpenTimeNote") as HTMLElement;

  if (state.paymentMethod === 'online') {
    if (duration === 'Open Time') {
      onlineNote?.classList.add("hidden");
      onlineOpenTimeNote?.classList.remove("hidden");
    } else {
      onlineNote?.classList.remove("hidden");
      onlineOpenTimeNote?.classList.add("hidden");
    }
  } else {
    onlineNote?.classList.add("hidden");
    onlineOpenTimeNote?.classList.add("hidden");
  }
}

export function updateFormPreview(): void {
  const seatType = (document.getElementById("seatTypeSelect") as HTMLSelectElement).value;
  const duration = (document.getElementById("durationSelect") as HTMLSelectElement).value;
  const card = document.getElementById("pricePreviewCard") as HTMLElement;
  const timeGrid = document.getElementById("previewTimeGrid") as HTMLElement;
  const priceLabel = document.getElementById("previewPriceLabel") as HTMLElement;

  if (!seatType || !duration) { card?.classList.add("hidden"); return; }
  if (duration === 'Custom') {
    const hrs = parseFloat((document.getElementById("customHours") as HTMLInputElement).value);
    if (!hrs || hrs < 1) { card?.classList.add("hidden"); return; }
  }

  card?.classList.remove("hidden");

  const rate = HOURLY_RATE[seatType] || 25;
  let amount = 0;
  let displayDuration = duration;
  let hoursValue = 0;

  if (duration === '1 Hour') {
    amount = PRICING[seatType]['1 Hour']; hoursValue = 1;
  } else if (duration === '3+1 Hours') {
    amount = PRICING[seatType]['3+1 Hours']; hoursValue = 4; displayDuration = '3+1 Hours (4 hrs)';
  } else if (duration === 'Open Time') {
    amount = rate; hoursValue = 0;
  } else if (duration === 'Custom') {
    hoursValue = parseFloat((document.getElementById("customHours") as HTMLInputElement).value) || 0;
    amount = hoursValue * rate;
    displayDuration = `${hoursValue} Hour${hoursValue !== 1 ? 's' : ''}`;
  }

  const times = computeSessionTimes(hoursValue, duration);
  const openTimeNote = document.getElementById("openTimeNote") as HTMLElement;

  (document.getElementById("previewSeat") as HTMLElement).textContent = seatType;
  (document.getElementById("previewDuration") as HTMLElement).textContent = displayDuration;
  (document.getElementById("previewDate") as HTMLElement).textContent = state.booking.bookingDate;

  if (duration === 'Open Time') {
    if (priceLabel) priceLabel.textContent = 'Rate / Hour';
    (document.getElementById("previewPrice") as HTMLElement).textContent = `₱${amount.toFixed(2)}/hr`;
    openTimeNote?.classList.remove("hidden");
    timeGrid?.classList.add("hidden");
  } else {
    if (priceLabel) priceLabel.textContent = 'Total';
    (document.getElementById("previewPrice") as HTMLElement).textContent = `₱${amount.toFixed(2)}`;
    openTimeNote?.classList.add("hidden");
    timeGrid?.classList.remove("hidden");
    (document.getElementById("previewStart") as HTMLElement).textContent = times.startTime;
    (document.getElementById("previewEnd") as HTMLElement).textContent = times.endTime;
  }

  if (window.lucide) lucide.createIcons();
}

export function selectPaymentMethod(method: 'cash' | 'online'): void {
  state.paymentMethod = method;
  const cashBtn = document.getElementById("payMethodCash") as HTMLElement;
  const onlineBtn = document.getElementById("payMethodOnline") as HTMLElement;
  const btnLabel = document.getElementById("btnConfirmLabel") as HTMLElement;

  const active = ['border-brand-primary', 'bg-brand-primary/10', 'text-brand-primary'];
  const inactive = ['border-brand-border', 'bg-brand-surface', 'text-brand-neutral'];

  if (method === 'cash') {
    cashBtn.classList.remove(...inactive); cashBtn.classList.add(...active);
    onlineBtn.classList.remove(...active); onlineBtn.classList.add(...inactive);
    if (btnLabel) btnLabel.innerHTML = 'Confirm &amp; Book';
  } else {
    onlineBtn.classList.remove(...inactive); onlineBtn.classList.add(...active);
    cashBtn.classList.remove(...active); cashBtn.classList.add(...inactive);
    if (btnLabel) btnLabel.textContent = 'Pay Online →';
  }

  updateOnlineNoteVisibility();
}

export async function initiateCheckout(): Promise<void> {
  const fullName = (document.getElementById("fullName") as HTMLInputElement).value.trim();
  const seatType = (document.getElementById("seatTypeSelect") as HTMLSelectElement).value;
  const duration = (document.getElementById("durationSelect") as HTMLSelectElement).value;

  if (!fullName) { showFormError("Please enter your full name."); return; }
  if (!seatType) { showFormError("Please select a seat type."); return; }
  if (!duration) { showFormError("Please select a duration."); return; }

  const rate = HOURLY_RATE[seatType] || 25;
  let hours = 0;
  let amount = 0;

  if (duration === '1 Hour') {
    hours = 1; amount = PRICING[seatType]['1 Hour'];
  } else if (duration === '3+1 Hours') {
    hours = 4; amount = PRICING[seatType]['3+1 Hours'];
  } else if (duration === 'Open Time') {
    hours = 0; amount = 0;
  } else if (duration === 'Custom') {
    hours = parseFloat((document.getElementById("customHours") as HTMLInputElement).value);
    if (!hours || hours < 1) { showFormError("Please enter a valid number of hours (minimum 1)."); return; }
    amount = Math.round(hours * rate * 100) / 100;
  }

  const times = computeSessionTimes(hours, duration);
  const refNumber = Math.random().toString(36).substring(2, 10).toUpperCase();
  const durationLabel = duration === 'Custom' ? `${hours} Hour${hours !== 1 ? 's' : ''} (Custom)` : duration;

  const sessionData: SessionRecord = {
    referenceNumber: refNumber,
    fullName, seatType,
    duration: durationLabel,
    amount, hourlyRate: rate,
    bookingDate: state.booking.bookingDate,
    startTime: times.startTime,
    endTime: times.endTime,
    status: 'PENDING SESSION',
    timestamp: new Date().toISOString()
  };

  // Online payment for fixed durations → Xendit flow
  // Open Time + Online OR Cash → direct Firebase flow
  if (state.paymentMethod === 'online' && duration !== 'Open Time') {
    await initiateOnlinePayment(sessionData);
  } else {
    await initiateCashCheckout(sessionData);
  }
}

async function initiateCashCheckout(sessionData: SessionRecord): Promise<void> {
  const db = getDb();
  try {
    showLoader("Processing...", "Creating your WiFi session...");
    const payMethod = state.paymentMethod === 'online' ? 'ONLINE' : 'CASH';
    const data: SessionRecord = { ...sessionData, status: 'PENDING SESSION', paymentMethod: payMethod };
    if (db) {
      await db.ref('sessions/' + sessionKey(data)).set(data);
      hideLoader();
      showTicketModal(data);
    }
  } catch (error) {
    console.error("Checkout Error:", error);
    hideLoader();
    alert("Checkout failed. Check your internet connection.");
  }
}

async function initiateOnlinePayment(sessionData: SessionRecord): Promise<void> {
  const db = getDb();
  try {
    showLoader("Redirecting...", "Creating your secure payment link...");
    const pendingSession: SessionRecord = { ...sessionData, status: 'AWAITING PAYMENT', paymentMethod: 'ONLINE' };
    if (db) {
      await db.ref('sessions/' + sessionKey(pendingSession)).set(pendingSession);
    }
    const res = await fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    });
    const result = await res.json();
    if (!res.ok || !result.invoiceUrl) {
      hideLoader();
      alert(result.error || "Failed to create payment link. Please try again.");
      return;
    }
    window.location.href = result.invoiceUrl;
  } catch (error) {
    console.error("Online payment error:", error);
    hideLoader();
    alert("Could not connect to payment gateway. Please try Cash payment instead.");
  }
}

export function resetBookingState(): void {
  location.reload();
}
