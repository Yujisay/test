import { PRICING, HOURLY_RATE, CLOSING_TIME } from './config';
import { state } from './state';
import { SessionTimes, SessionRecord } from './types';
import { showLoader, hideLoader, showFormError, showTicketModal } from './ui';
import { getDb } from './firebase';

export function computeSessionTimes(hours: number, duration: string): SessionTimes {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 15) * 15;
  now.setMinutes(roundedMinutes);
  now.setSeconds(0);

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
}

export function updateFormPreview(): void {
  const seatType = (document.getElementById("seatTypeSelect") as HTMLSelectElement).value;
  const duration = (document.getElementById("durationSelect") as HTMLSelectElement).value;
  const card = document.getElementById("pricePreviewCard") as HTMLElement;

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
  (document.getElementById("previewStart") as HTMLElement).textContent = times.startTime;
  (document.getElementById("previewEnd") as HTMLElement).textContent = times.endTime;

  if (duration === 'Open Time') {
    (document.getElementById("previewPrice") as HTMLElement).textContent = `₱${amount.toFixed(2)}/hr`;
    openTimeNote?.classList.remove("hidden");
  } else {
    (document.getElementById("previewPrice") as HTMLElement).textContent = `₱${amount.toFixed(2)}`;
    openTimeNote?.classList.add("hidden");
  }

  if (window.lucide) lucide.createIcons();
}

export function selectPaymentMethod(method: 'cash' | 'online'): void {
  state.paymentMethod = method;
  const cashBtn = document.getElementById("payMethodCash") as HTMLElement;
  const onlineBtn = document.getElementById("payMethodOnline") as HTMLElement;
  const onlineNote = document.getElementById("onlinePayNote") as HTMLElement;
  const btnLabel = document.getElementById("btnConfirmLabel") as HTMLElement;

  const active = ['border-brand-primary', 'bg-brand-primary/10', 'text-brand-primary'];
  const inactive = ['border-brand-border', 'bg-brand-surface', 'text-brand-neutral'];

  if (method === 'cash') {
    cashBtn.classList.remove(...inactive); cashBtn.classList.add(...active);
    onlineBtn.classList.remove(...active); onlineBtn.classList.add(...inactive);
    onlineNote?.classList.add("hidden");
    if (btnLabel) btnLabel.innerHTML = 'Confirm &amp; Book';
  } else {
    onlineBtn.classList.remove(...inactive); onlineBtn.classList.add(...active);
    cashBtn.classList.remove(...active); cashBtn.classList.add(...inactive);
    onlineNote?.classList.remove("hidden");
    if (btnLabel) btnLabel.textContent = 'Pay Online →';
  }
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

  if (state.paymentMethod === 'online' && duration === 'Open Time') {
    showFormError("Online payment is not available for Open Time. Please use Cash or choose a fixed duration.");
    return;
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

  if (state.paymentMethod === 'online') {
    await initiateOnlinePayment(sessionData);
  } else {
    await initiateCashCheckout(sessionData);
  }
}

async function initiateCashCheckout(sessionData: SessionRecord): Promise<void> {
  const db = getDb();
  try {
    showLoader("Processing...", "Creating your WiFi session...");
    const data = { ...sessionData, status: 'PENDING SESSION' as const, paymentMethod: 'CASH' as const };
    if (db) {
      await db.ref('sessions/' + data.referenceNumber).set(data);
      showTicketModal(data);
      resetBookingState();
    }
  } catch (error) {
    console.error("Checkout Error:", error);
    alert("Checkout failed. Check your internet connection.");
  } finally {
    hideLoader();
  }
}

async function initiateOnlinePayment(sessionData: SessionRecord): Promise<void> {
  try {
    showLoader("Redirecting...", "Creating your secure payment link...");
    const res = await fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    });
    const data = await res.json();
    if (!res.ok || !data.invoiceUrl) {
      hideLoader();
      alert(data.error || "Failed to create payment link. Please try again.");
      return;
    }
    window.location.href = data.invoiceUrl;
  } catch (error) {
    console.error("Online payment error:", error);
    hideLoader();
    alert("Could not connect to payment gateway. Please try Cash payment instead.");
  }
}

export function resetBookingState(): void {
  location.reload();
}
