import { state } from './state';
import { HOURLY_RATE } from './config';
import { SessionRecord } from './types';

let currentTicketRecord: SessionRecord | null = null;

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
  localStorage.setItem('activeTab', tabId);
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
  currentTicketRecord = record;
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

  const methodEl = document.getElementById("ticketMethod") as HTMLElement;
  if (methodEl) methodEl.innerText = record.paymentMethod || 'CASH';

  (document.getElementById("ticketModal") as HTMLElement).classList.remove("hidden");
}

export function closeTicketModal(): void {
  (document.getElementById("ticketModal") as HTMLElement).classList.add("hidden");

  if (currentTicketRecord) {
    const name = currentTicketRecord.fullName;
    currentTicketRecord = null;
    switchTab('check');
    const searchInput = document.getElementById("searchName") as HTMLInputElement;
    if (searchInput) {
      searchInput.value = name;
      setTimeout(() => {
        const btnSearch = document.getElementById("btnSearchSession") as HTMLButtonElement;
        if (btnSearch) btnSearch.click();
      }, 150);
    }
  }
}

export function closeAdminAuth(): void {
  (document.getElementById("adminAuthModal") as HTMLElement).classList.add("hidden");
}

export function getCurrentTicketRecord(): SessionRecord | null {
  return currentTicketRecord;
}

export function downloadReceipt(): void {
  const record = currentTicketRecord;
  if (!record) return;

  const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
  const isOpenTime = record.duration === 'Open Time';
  const amountText = isOpenTime ? `₱${rate.toFixed(2)}/hr (billed at end)` : `₱${Number(record.amount).toFixed(2)}`;

  const W = 480;
  const H = 680;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Header bar
  ctx.fillStyle = '#535C3B';
  roundRect(ctx, 0, 0, W, 110, 0);
  ctx.fill();

  // Header text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STUDY HUB WiFi', W / 2, 48);
  ctx.font = '13px Arial, sans-serif';
  ctx.fillStyle = '#E5D3B3';
  ctx.fillText('Official Booking Receipt', W / 2, 74);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText(new Date().toLocaleString(), W / 2, 96);

  // Reference number box
  ctx.fillStyle = '#F4F1EC';
  roundRect(ctx, 32, 126, W - 64, 70, 12);
  ctx.fill();
  ctx.strokeStyle = '#E8E2D9';
  ctx.lineWidth = 1;
  roundRect(ctx, 32, 126, W - 64, 70, 12);
  ctx.stroke();

  ctx.fillStyle = '#707070';
  ctx.font = '10px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('REFERENCE NUMBER', W / 2, 148);

  ctx.fillStyle = '#535C3B';
  ctx.font = 'bold 30px Arial, monospace';
  ctx.fillText(record.referenceNumber, W / 2, 183);

  // Divider
  ctx.strokeStyle = '#E8E2D9';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(32, 214);
  ctx.lineTo(W - 32, 214);
  ctx.stroke();
  ctx.setLineDash([]);

  // Details rows
  const details: [string, string][] = [
    ['Customer Name', record.fullName],
    ['Seat Type', record.seatType],
    ['Duration', record.duration],
    ['Date', record.bookingDate],
    ['Session Time', `${record.startTime} – ${record.endTime}`],
    ['Payment Method', record.paymentMethod || 'CASH'],
    ['Amount', amountText],
    ['Status', record.status],
  ];

  ctx.textAlign = 'left';
  let y = 244;
  details.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      ctx.fillStyle = '#FAFAF8';
      ctx.fillRect(32, y - 14, W - 64, 34);
    }
    ctx.fillStyle = '#707070';
    ctx.font = '11px Arial, sans-serif';
    ctx.fillText(label, 48, y + 6);
    ctx.fillStyle = '#373737';
    ctx.font = label === 'Amount' ? 'bold 13px Arial, sans-serif' : '12px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(value, W - 48, y + 6);
    ctx.textAlign = 'left';
    y += 36;
  });

  // Footer bar
  ctx.fillStyle = '#F4F1EC';
  ctx.fillRect(0, H - 80, W, 80);
  ctx.strokeStyle = '#E8E2D9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H - 80);
  ctx.lineTo(W, H - 80);
  ctx.stroke();

  ctx.fillStyle = '#707070';
  ctx.font = '10px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Thank you for visiting Study Hub!', W / 2, H - 50);
  ctx.fillText('Present this reference number to the cashier.', W / 2, H - 33);
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.fillStyle = '#535C3B';
  ctx.fillText('study-hub-captive-portal', W / 2, H - 14);

  const link = document.createElement('a');
  link.download = `StudyHub-Receipt-${record.referenceNumber}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
