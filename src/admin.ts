import { ADMIN_PASSCODE, HOURLY_RATE, getPageSize } from './config';
import { adminState, state } from './state';
import { SessionRecord } from './types';
import { showLoader, hideLoader, closeAdminAuth } from './ui';
import { getDb } from './firebase';

export function handleAdminTrigger(): void {
  adminState.clickCount++;
  if (adminState.clickTimer) clearTimeout(adminState.clickTimer);
  adminState.clickTimer = setTimeout(() => { adminState.clickCount = 0; }, 2000);

  if (adminState.clickCount >= 3) {
    adminState.clickCount = 0;
    (document.getElementById("adminAuthModal") as HTMLElement).classList.remove("hidden");
    (document.getElementById("adminPassword") as HTMLInputElement).focus();
  }
}

export function submitAdminAuth(): void {
  const pass = (document.getElementById("adminPassword") as HTMLInputElement).value;
  if (pass === ADMIN_PASSCODE) {
    adminState.isAuthenticated = true;
    localStorage.setItem("adminAuthenticated", "true");
    closeAdminAuth();
    unlockAdminMode();
  } else {
    (document.getElementById("adminAuthError") as HTMLElement).classList.remove("hidden");
  }
}

export function unlockAdminMode(): void {
  (document.getElementById("publicClientView") as HTMLElement).classList.add("hidden");
  (document.getElementById("privateAdminView") as HTMLElement).classList.remove("hidden");
  (document.getElementById("btnBackToUser") as HTMLElement).classList.remove("hidden");
  startRealtimeDashboard();
}

export function exitAdminMode(): void {
  const db = getDb();
  localStorage.removeItem("adminAuthenticated");
  if (db && adminState.unsubscribe) {
    db.ref('sessions').off("value", adminState.unsubscribe);
    adminState.unsubscribe = null;
  }
  location.reload();
}

export function startRealtimeDashboard(): void {
  const db = getDb();
  if (!db) return;
  adminState.unsubscribe = db.ref('sessions').on("value", (snapshot: any) => {
    if (snapshot.exists()) {
      const records: SessionRecord[] = Object.values(snapshot.val());
      adminState.recordsCache = records;
      renderAdminTable(records);
      updateKpis(records);
    } else {
      renderAdminTable([]);
    }
  });
}

export function refreshAdminDashboard(): void {
  startRealtimeDashboard();
}

export function renderAdminTable(records: SessionRecord[]): void {
  records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  adminState.filteredCache = records;
  adminState.currentPage = 1;
  renderCurrentPage();
}

export function renderCurrentPage(): void {
  const records = adminState.filteredCache;
  const tbody = document.getElementById("adminTableBody") as HTMLElement;
  const cardBody = document.getElementById("adminCardBody") as HTMLElement;
  tbody.innerHTML = "";
  cardBody.innerHTML = "";

  if (records.length === 0) {
    const emptyMsg = `<div class="flex flex-col items-center justify-center space-y-2 py-12 text-brand-neutral text-xs"><i data-lucide="inbox" class="w-5 h-5"></i><span>No records found.</span></div>`;
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-12 text-brand-neutral">No records found.</td></tr>`;
    cardBody.innerHTML = emptyMsg;
    (document.getElementById("adminTableCount") as HTMLElement).textContent = "Showing 0 rows";
    (document.getElementById("adminTablePageInfo") as HTMLElement).classList.add("hidden");
    updatePaginationControls(0);
    if (window.lucide) lucide.createIcons();
    return;
  }

  const pageSize = getPageSize();
  adminState.pageSize = pageSize;
  const totalPages = Math.ceil(records.length / pageSize);
  adminState.currentPage = Math.min(adminState.currentPage, totalPages);

  const start = (adminState.currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, records.length);

  records.slice(start, end).forEach(row => {
    const rate = row.hourlyRate || HOURLY_RATE[row.seatType] || 25;
    const amountDisplay = row.duration === 'Open Time' && row.status === 'ACTIVE'
      ? `₱${rate}/hr` : `₱${Number(row.amount).toFixed(2)}`;

    const isOpenTime = row.duration === 'Open Time';
    let actionHtml = '';
    if (row.status === 'PENDING SESSION') {
      actionHtml = `<button data-ref="${row.referenceNumber}" class="btn-approve-session px-3 py-1 bg-brand-primary text-white rounded text-[10px] font-semibold">Approve</button>`;
    } else if (row.status === 'ACTIVE') {
      actionHtml = `<button data-ref="${row.referenceNumber}" class="btn-end-session px-3 py-1 bg-rose-500 text-white rounded text-[10px] font-semibold">${isOpenTime ? 'End & Bill' : 'End'}</button>`;
    }

    const statusColor = row.status === 'ACTIVE'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : row.status === 'PENDING SESSION'
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : row.status === 'AWAITING PAYMENT'
          ? 'text-blue-700 bg-blue-50 border-blue-200'
          : 'text-brand-neutral bg-brand-light border-brand-border';

    // --- Desktop table row ---
    const tr = document.createElement("tr");
    tr.className = "hover:bg-brand-light";
    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold">${row.referenceNumber}</td>
      <td class="py-3 px-4 font-semibold">${row.fullName}</td>
      <td class="py-3 px-4">${row.seatType}</td>
      <td class="py-3 px-4">${row.duration}</td>
      <td class="py-3 px-4 font-bold">${amountDisplay}</td>
      <td class="py-3 px-4"><span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${statusColor}">${row.status}</span></td>
      <td class="py-3 px-4 text-[10px]">${row.startTime} – ${row.endTime}</td>
      <td class="py-3 px-4 text-center">${actionHtml || '–'}</td>
    `;
    tbody.appendChild(tr);

    // --- Mobile card ---
    const card = document.createElement("div");
    card.className = "p-4 space-y-3";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <span class="font-mono font-extrabold text-brand-primary text-sm">${row.referenceNumber}</span>
          <p class="font-semibold text-brand-dark text-sm mt-0.5">${row.fullName}</p>
        </div>
        <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-lg border whitespace-nowrap ${statusColor}">${row.status}</span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="bg-brand-light rounded-lg p-2">
          <span class="text-brand-neutral block text-[9px] uppercase font-semibold mb-0.5">Seat</span>
          <span class="font-semibold text-brand-dark">${row.seatType}</span>
        </div>
        <div class="bg-brand-light rounded-lg p-2">
          <span class="text-brand-neutral block text-[9px] uppercase font-semibold mb-0.5">Duration</span>
          <span class="font-semibold text-brand-dark">${row.duration}</span>
        </div>
        <div class="bg-brand-light rounded-lg p-2">
          <span class="text-brand-neutral block text-[9px] uppercase font-semibold mb-0.5">Amount</span>
          <span class="font-bold text-brand-primary">${amountDisplay}</span>
        </div>
        <div class="bg-brand-light rounded-lg p-2">
          <span class="text-brand-neutral block text-[9px] uppercase font-semibold mb-0.5">Time</span>
          <span class="font-semibold text-brand-dark text-[10px]">${row.startTime} – ${row.endTime}</span>
        </div>
      </div>
      ${actionHtml ? `<div class="pt-1">${actionHtml.replace('rounded text-[10px]', 'rounded-lg text-xs w-full py-2')}</div>` : ''}
    `;
    cardBody.appendChild(card);
  });

  (document.getElementById("adminTableCount") as HTMLElement).textContent =
    `Showing ${start + 1}–${end} of ${records.length} record${records.length !== 1 ? 's' : ''}`;

  const pageInfo = document.getElementById("adminTablePageInfo") as HTMLElement;
  if (totalPages > 1) {
    pageInfo.classList.remove("hidden");
    (document.getElementById("adminCurrentPage") as HTMLElement).textContent = String(adminState.currentPage);
    (document.getElementById("adminTotalPages") as HTMLElement).textContent = String(totalPages);
  } else {
    pageInfo.classList.add("hidden");
  }

  updatePaginationControls(totalPages);
  if (window.lucide) lucide.createIcons();
}

function updatePaginationControls(totalPages: number): void {
  const prevBtn = document.getElementById("btnPagePrev") as HTMLButtonElement;
  const nextBtn = document.getElementById("btnPageNext") as HTMLButtonElement;
  if (!prevBtn || !nextBtn) return;

  const atFirst = adminState.currentPage <= 1;
  const atLast = adminState.currentPage >= totalPages || totalPages <= 1;

  prevBtn.disabled = atFirst;
  prevBtn.classList.toggle("opacity-40", atFirst);
  prevBtn.classList.toggle("cursor-not-allowed", atFirst);

  nextBtn.disabled = atLast;
  nextBtn.classList.toggle("opacity-40", atLast);
  nextBtn.classList.toggle("cursor-not-allowed", atLast);
}

export function filterAdminLogs(): void {
  const query = (document.getElementById("adminTableFilter") as HTMLInputElement).value.toLowerCase();
  const status = (document.getElementById("adminStatusSelector") as HTMLSelectElement).value;

  const filtered = adminState.recordsCache.filter(r => {
    const matchesQuery = r.fullName.toLowerCase().includes(query) || r.referenceNumber.toLowerCase().includes(query);
    const matchesStatus = status === 'ALL'
      || (status === 'ACTIVE' && r.status === 'ACTIVE')
      || (status === 'PENDING' && r.status === 'PENDING SESSION')
      || (status === 'EXPIRED' && r.status === 'EXPIRED');
    return matchesQuery && matchesStatus;
  });

  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  adminState.filteredCache = filtered;
  adminState.currentPage = 1;
  renderCurrentPage();
}

export async function approveTransaction(refNum: string): Promise<void> {
  const db = getDb();
  if (confirm("Approve session " + refNum + "?") && db) {
    await db.ref('sessions/' + refNum).update({ status: 'ACTIVE' });
  }
}

export async function endSession(refNum: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const snapshot = await db.ref('sessions/' + refNum).once('value');
  const record: SessionRecord = snapshot.val();
  if (!record) return;

  const isOpenTime = record.duration === 'Open Time';
  const confirmMsg = isOpenTime
    ? `End Open Time session ${refNum}?\nBilling will be calculated based on actual time used.`
    : `End session ${refNum}?`;

  if (!confirm(confirmMsg)) return;

  const updateData: Partial<SessionRecord> & { [key: string]: any } = { status: 'EXPIRED' };

  if (isOpenTime) {
    const elapsedMs = Date.now() - new Date(record.timestamp).getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const roundedHours = Math.max(0.25, Math.ceil(elapsedHours * 4) / 4);
    const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
    const finalAmount = Math.round(roundedHours * rate * 100) / 100;
    const hrs = Math.floor(roundedHours);
    const mins = Math.round((roundedHours - hrs) * 60);
    updateData.amount = finalAmount;
    updateData.endTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    updateData.duration = `Open Time (${hrs > 0 ? hrs + 'h ' : ''}${mins > 0 ? mins + 'm' : ''})`.trim();
    alert(`Session ended.\nTime used: ${hrs > 0 ? hrs + 'h ' : ''}${mins > 0 ? mins + 'm' : ''}.\nTotal amount due: ₱${finalAmount.toFixed(2)}`);
  }

  await db.ref('sessions/' + refNum).update(updateData);
}

export async function archiveOldSessions(): Promise<void> {
  const db = getDb();
  const DAYS = 30;
  const cutoff = Date.now() - DAYS * 24 * 60 * 60 * 1000;

  const expired = adminState.recordsCache.filter(r =>
    r.status === 'EXPIRED' && new Date(r.timestamp).getTime() < cutoff
  );

  if (expired.length === 0) {
    alert(`No expired sessions older than ${DAYS} days found.`); return;
  }

  if (!confirm(`Archive ${expired.length} expired session${expired.length !== 1 ? 's' : ''} older than ${DAYS} days?\n\nThis permanently removes them from the database.`)) return;

  try {
    showLoader("Archiving...", `Removing ${expired.length} old records...`);
    const updates: Record<string, null> = {};
    expired.forEach(r => { updates[`sessions/${r.referenceNumber}`] = null; });
    await db.ref().update(updates);
    alert(`Done! ${expired.length} old record${expired.length !== 1 ? 's' : ''} removed.`);
  } catch (err) {
    console.error("Archive error:", err);
    alert("Archive failed. Please try again.");
  } finally {
    hideLoader();
  }
}

export function updateKpis(records: SessionRecord[]): void {
  const today = new Date().toDateString();
  let active = 0, earnings = 0, pending = 0;

  records.forEach(r => {
    if (r.status === 'ACTIVE') active++;
    if (r.status === 'PENDING SESSION') pending++;
    if (r.status === 'EXPIRED' && new Date(r.timestamp).toDateString() === today) earnings += Number(r.amount) || 0;
  });

  (document.getElementById("adminActiveSessions") as HTMLElement).innerText = String(active);
  (document.getElementById("adminDailyEarnings") as HTMLElement).innerText = `₱${earnings.toFixed(2)}`;
  (document.getElementById("adminPendingPayments") as HTMLElement).innerText = String(pending);
}
