import { state } from './state';
import { HOURLY_RATE } from './config';
import { SessionRecord } from './types';

export function showLoader(title: string, msg: string): void {
  (document.getElementById("loadingTitle") as HTMLElement).innerText = title;
  (document.getElementById("loadingMsg") as HTMLElement).innerText = msg;
  (document.getElementById("loadingOverlay") as HTMLElement).classList.remove("hidden");
}

export function hideLoader(): void {
  (document.getElementById("loadingOverlay") as HTMLElement).classList.add("hidden");
}

export function showFormError(msg: string): void {
  const el = document.getElementById("stepErrorMessage") as HTMLElement;
  el.innerText = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

export function switchTab(tabId: 'avail' | 'check'): void {
  state.currentTab = tabId;
  const btnAvail = document.getElementById("tabAvail") as HTMLElement;
  const btnCheck = document.getElementById("tabCheck") as HTMLElement;
  const secAvail = document.getElementById("sectionAvail") as HTMLElement;
  const secCheck = document.getElementById("sectionCheck") as HTMLElement;

  const activeClass = "py-3 px-4 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 bg-brand-primary text-white shadow-soft font-['Outfit']";
  const inactiveClass = "py-3 px-4 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 text-brand-neutral hover:text-brand-dark";

  if (tabId === 'avail') {
    btnAvail.className = activeClass;
    btnCheck.className = inactiveClass;
    secAvail.classList.remove("hidden");
    secCheck.classList.add("hidden");
  } else {
    btnCheck.className = activeClass;
    btnAvail.className = inactiveClass;
    secCheck.classList.remove("hidden");
    secAvail.classList.add("hidden");
  }
}

export function updateConnectionStatus(connected: boolean): void {
  const dot = document.querySelector(".text-brand-neutral span.rounded-full") as HTMLElement;
  if (dot) {
    dot.className = `w-1.5 h-1.5 rounded-full mr-1.5 ${connected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`;
  }
}

export function showTicketModal(record: SessionRecord): void {
  const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
  const isOpenTime = record.duration === 'Open Time';
  const amountText = isOpenTime ? `₱${rate.toFixed(2)}/hr` : `₱${Number(record.amount).toFixed(2)}`;
  const instructions = isOpenTime
    ? `Proceed to the Study Hub cashier desk and present this Reference Number. Your session will be billed at ₱${rate}.00 per hour when you end your session.`
    : `Proceed to the Study Hub cashier desk and present this Reference Number. The cashier will receive your payment of ₱${Number(record.amount).toFixed(2)} and activate your session.`;

  (document.getElementById("ticketRef") as HTMLElement).innerText = record.referenceNumber;
  (document.getElementById("ticketName") as HTMLElement).innerText = record.fullName;
  (document.getElementById("ticketHours") as HTMLElement).innerText = record.duration;
  (document.getElementById("ticketAmount") as HTMLElement).innerText = amountText;
  (document.getElementById("ticketInstructions") as HTMLElement).innerText = instructions;
  (document.getElementById("ticketModal") as HTMLElement).classList.remove("hidden");
}

export function closeTicketModal(): void {
  (document.getElementById("ticketModal") as HTMLElement).classList.add("hidden");
}

export function closeAdminAuth(): void {
  (document.getElementById("adminAuthModal") as HTMLElement).classList.add("hidden");
}
