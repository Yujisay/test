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
      actionHtml = `
        <div class="flex flex-col gap-1">
          <button data-ref="${row.referenceNumber}" class="btn-end-session px-3 py-1 bg-rose-500 text-white rounded text-[10px] font-semibold">${isOpenTime ? 'End & Bill' : 'End'}</button>
          ${!isOpenTime ? `<button data-ref="${row.referenceNumber}" class="btn-admin-extend px-3 py-1 bg-brand-primary/10 border border-brand-primary/30 text-brand-primary rounded text-[10px] font-semibold whitespace-nowrap">Extend</button>` : ''}
        </div>`;
    } else if (row.status === 'AWAITING PAYMENT') {
      actionHtml = `
        <div class="flex flex-col gap-1">
          <button data-ref="${row.referenceNumber}" class="btn-mark-paid px-3 py-1 bg-emerald-600 text-white rounded text-[10px] font-semibold whitespace-nowrap">Mark Paid</button>
          <button data-ref="${row.referenceNumber}" class="btn-cancel-awaiting px-3 py-1 bg-rose-100 text-rose-600 border border-rose-200 rounded text-[10px] font-semibold whitespace-nowrap">Cancel</button>
        </div>`;
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
      ${actionHtml ? `<div class="pt-1 flex flex-col gap-2">${actionHtml}</div>` : ''}
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
      || (status === 'EXPIRED' && r.status === 'EXPIRED')
      || (status === 'AWAITING' && r.status === 'AWAITING PAYMENT');
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

export async function markAwaitingAsPaid(refNum: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  if (confirm(`Mark session ${refNum} as paid and move to PENDING SESSION?\n\nUse this if the customer has paid but the online payment gateway did not automatically update.`)) {
    await db.ref('sessions/' + refNum).update({
      status: 'PENDING SESSION',
      paymentConfirmed: true,
      paidAt: new Date().toISOString()
    });
  }
}

export async function cancelAwaitingPayment(refNum: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  if (confirm(`Cancel and remove session ${refNum}?\n\nThis will delete the unpaid booking. The customer can create a new booking.`)) {
    await db.ref('sessions/' + refNum).remove();
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

export async function extendSessionAdmin(refNum: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const snapshot = await db.ref('sessions/' + refNum).once('value');
  const record = snapshot.val();
  if (!record) return;

  const options = ['0.5 — 30 minutes', '1 — 1 hour', '2 — 2 hours', '3 — 3 hours'];
  const choice = prompt(
    `Extend session for ${record.fullName} (${refNum})\nCurrent end time: ${record.endTime || 'N/A'}\n\nEnter hours to add:\n  0.5 = 30 min\n  1 = 1 hour\n  2 = 2 hours\n  3 = 3 hours`
  );
  if (!choice) return;
  const hours = parseFloat(choice);
  if (isNaN(hours) || hours <= 0) { alert('Invalid hours entered.'); return; }

  // Calculate new end time — use bookingDate to get the correct calendar date,
  // but if that end time has already passed, extend from right now instead.
  const currentEndTime = record.endTime || '';
  let newEndTime = currentEndTime;
  if (currentEndTime) {
    const match = currentEndTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      let h = parseInt(match[1]);
      const m = parseInt(match[2]);
      const period = match[3].toUpperCase();
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;

      // Use bookingDate as the base date, fall back to today
      let base: Date;
      if (record.bookingDate) {
        base = new Date(record.bookingDate + 'T00:00:00');
        if (isNaN(base.getTime())) base = new Date();
      } else {
        base = new Date();
      }
      const storedEnd = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);

      // If the stored end time is in the past, extend from now
      const extendFrom = storedEnd.getTime() < Date.now() ? new Date() : storedEnd;
      const newDate = new Date(extendFrom.getTime() + hours * 60 * 60 * 1000);
      newEndTime = newDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }

  const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
  const addedCost = Math.round(hours * rate * 100) / 100;
  const newAmount = Math.round(((Number(record.amount) || 0) + addedCost) * 100) / 100;
  const hoursLabel = hours === 0.5 ? '30 min' : `${hours}hr`;
  const newDuration = `${record.duration} +${hoursLabel}`.trim();

  if (!confirm(
    `Extend ${refNum} by +${hoursLabel}?\n\nNew end time: ${newEndTime}\nExtra charge: ₱${addedCost.toFixed(2)}\nNew total: ₱${newAmount.toFixed(2)}`
  )) return;

  await db.ref('sessions/' + refNum).update({
    status: 'ACTIVE',
    endTime: newEndTime,
    amount: newAmount,
    duration: newDuration
  });
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

export function openSalesReportModal(): void {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const startInput = document.getElementById('reportStartDate') as HTMLInputElement;
  const endInput = document.getElementById('reportEndDate') as HTMLInputElement;
  if (startInput) startInput.value = firstOfMonth;
  if (endInput) endInput.value = today;
  (document.getElementById('salesReportModal') as HTMLElement).classList.remove('hidden');
}

export function closeSalesReportModal(): void {
  (document.getElementById('salesReportModal') as HTMLElement).classList.add('hidden');
}

export function downloadSalesReport(): void {
  const startVal = (document.getElementById('reportStartDate') as HTMLInputElement).value;
  const endVal = (document.getElementById('reportEndDate') as HTMLInputElement).value;

  if (!startVal || !endVal) {
    alert('Please select both a start and end date.');
    return;
  }

  const startDate = new Date(startVal + 'T00:00:00');
  const endDate = new Date(endVal + 'T23:59:59');

  if (startDate > endDate) {
    alert('Start date must be before end date.');
    return;
  }

  const allRecords = adminState.recordsCache;
  const filtered = allRecords.filter(r => {
    const ts = new Date(r.timestamp);
    return ts >= startDate && ts <= endDate;
  });

  // Summary calculations
  const completedSessions = filtered.filter(r => r.status === 'EXPIRED');
  const totalRevenue = completedSessions.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const activeSessions = filtered.filter(r => r.status === 'ACTIVE').length;
  const pendingSessions = filtered.filter(r => r.status === 'PENDING SESSION').length;
  const awaitingSessions = filtered.filter(r => r.status === 'AWAITING PAYMENT').length;

  // Breakdown by seat type
  const byType: Record<string, { count: number; revenue: number }> = {};
  completedSessions.forEach(r => {
    if (!byType[r.seatType]) byType[r.seatType] = { count: 0, revenue: 0 };
    byType[r.seatType].count++;
    byType[r.seatType].revenue += Number(r.amount) || 0;
  });

  // Breakdown by payment method
  const byMethod: Record<string, { count: number; revenue: number }> = {};
  completedSessions.forEach(r => {
    const method = r.paymentMethod || 'CASH';
    if (!byMethod[method]) byMethod[method] = { count: 0, revenue: 0 };
    byMethod[method].count++;
    byMethod[method].revenue += Number(r.amount) || 0;
  });

  const formatDate = (d: Date) => d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const generatedAt = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });

  const typeRows = Object.entries(byType).map(([type, data]) => `
    <tr>
      <td>${type}</td>
      <td style="text-align:center">${data.count}</td>
      <td style="text-align:right;font-weight:700;color:#535C3B">₱${data.revenue.toFixed(2)}</td>
    </tr>`).join('');

  const methodRows = Object.entries(byMethod).map(([method, data]) => `
    <tr>
      <td>${method}</td>
      <td style="text-align:center">${data.count}</td>
      <td style="text-align:right;font-weight:700;color:#535C3B">₱${data.revenue.toFixed(2)}</td>
    </tr>`).join('');

  const sessionRows = filtered
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map(r => {
      const statusColor = r.status === 'ACTIVE' ? '#059669'
        : r.status === 'PENDING SESSION' ? '#d97706'
        : r.status === 'AWAITING PAYMENT' ? '#2563eb'
        : '#6b7280';
      return `
      <tr>
        <td style="font-family:monospace;font-weight:700">${r.referenceNumber}</td>
        <td>${r.fullName}</td>
        <td>${r.seatType}</td>
        <td>${r.duration}</td>
        <td>${r.bookingDate}</td>
        <td>${r.startTime}</td>
        <td>${r.paymentMethod || 'CASH'}</td>
        <td style="text-align:right;font-weight:700;color:#535C3B">${r.status === 'ACTIVE' ? '(Active)' : '₱' + Number(r.amount).toFixed(2)}</td>
        <td><span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;color:${statusColor};border:1px solid ${statusColor};white-space:nowrap">${r.status}</span></td>
      </tr>`;
    }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sales Report — Study Hub WiFi</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #373737; background: #fff; }
    .page { padding: 32px 40px; max-width: 900px; margin: 0 auto; }

    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #535C3B; padding-bottom: 16px; margin-bottom: 24px; }
    .header-left h1 { font-size: 22px; font-weight: 800; color: #535C3B; letter-spacing: -0.5px; }
    .header-left p { font-size: 11px; color: #707070; margin-top: 2px; }
    .header-right { text-align: right; }
    .header-right .badge { display: inline-block; background: #535C3B; color: #fff; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 4px; letter-spacing: 1px; }
    .header-right .generated { font-size: 10px; color: #707070; margin-top: 6px; }

    .date-range { background: #F4F1EC; border: 1px solid #E8E2D9; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
    .date-range span { font-size: 11px; color: #707070; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .date-range strong { font-size: 13px; color: #373737; }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { background: #FDFCFB; border: 1px solid #E8E2D9; border-radius: 8px; padding: 14px; }
    .kpi-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: #707070; margin-bottom: 4px; }
    .kpi-card .value { font-size: 22px; font-weight: 800; color: #535C3B; }
    .kpi-card.revenue .value { color: #535C3B; }
    .kpi-card.sessions .value { color: #059669; }
    .kpi-card.pending .value { color: #d97706; }
    .kpi-card.total .value { color: #373737; }

    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #707070; border-bottom: 1px solid #E8E2D9; padding-bottom: 6px; margin-bottom: 12px; }

    .breakdown-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }

    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead th { background: #535C3B; color: #fff; text-align: left; padding: 8px 10px; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    tbody tr { border-bottom: 1px solid #E8E2D9; }
    tbody tr:nth-child(even) { background: #FDFCFB; }
    tbody tr:hover { background: #F4F1EC; }
    td { padding: 7px 10px; color: #373737; }
    tfoot td { background: #F4F1EC; font-weight: 700; padding: 8px 10px; border-top: 2px solid #535C3B; }

    .footer { margin-top: 32px; border-top: 1px solid #E8E2D9; padding-top: 12px; text-align: center; color: #707070; font-size: 10px; }
    .no-records { text-align: center; padding: 24px; color: #707070; font-style: italic; }

    @media print {
      body { font-size: 11px; }
      .page { padding: 20px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-left">
      <h1>STUDY HUB WiFi</h1>
      <p>Sales & Revenue Report</p>
    </div>
    <div class="header-right">
      <span class="badge">OFFICIAL REPORT</span>
      <p class="generated">Generated: ${generatedAt}</p>
    </div>
  </div>

  <div class="date-range">
    <span>Period:</span>
    <strong>${formatDate(startDate)} &nbsp;→&nbsp; ${formatDate(endDate)}</strong>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card revenue">
      <div class="label">Total Revenue</div>
      <div class="value">₱${totalRevenue.toFixed(2)}</div>
    </div>
    <div class="kpi-card total">
      <div class="label">Total Bookings</div>
      <div class="value">${filtered.length}</div>
    </div>
    <div class="kpi-card sessions">
      <div class="label">Completed</div>
      <div class="value">${completedSessions.length}</div>
    </div>
    <div class="kpi-card pending">
      <div class="label">Pending / Active</div>
      <div class="value">${pendingSessions + activeSessions}</div>
    </div>
  </div>

  <div class="breakdown-grid">
    <div class="section">
      <div class="section-title">Revenue by Seat Type</div>
      ${Object.keys(byType).length > 0 ? `
      <table>
        <thead><tr><th>Seat Type</th><th style="text-align:center">Sessions</th><th style="text-align:right">Revenue</th></tr></thead>
        <tbody>${typeRows}</tbody>
        <tfoot><tr><td>Total</td><td style="text-align:center">${completedSessions.length}</td><td style="text-align:right">₱${totalRevenue.toFixed(2)}</td></tr></tfoot>
      </table>` : '<p class="no-records">No completed sessions in range.</p>'}
    </div>

    <div class="section">
      <div class="section-title">Revenue by Payment Method</div>
      ${Object.keys(byMethod).length > 0 ? `
      <table>
        <thead><tr><th>Method</th><th style="text-align:center">Sessions</th><th style="text-align:right">Revenue</th></tr></thead>
        <tbody>${methodRows}</tbody>
        <tfoot><tr><td>Total</td><td style="text-align:center">${completedSessions.length}</td><td style="text-align:right">₱${totalRevenue.toFixed(2)}</td></tr></tfoot>
      </table>` : '<p class="no-records">No completed sessions in range.</p>'}
    </div>
  </div>

  <div class="section">
    <div class="section-title">All Sessions in Period (${filtered.length} records)</div>
    ${filtered.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Ref #</th>
          <th>Customer</th>
          <th>Seat</th>
          <th>Duration</th>
          <th>Date</th>
          <th>Start</th>
          <th>Payment</th>
          <th style="text-align:right">Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${sessionRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="7">Total Collected Revenue</td>
          <td style="text-align:right">₱${totalRevenue.toFixed(2)}</td>
          <td>${completedSessions.length} completed</td>
        </tr>
      </tfoot>
    </table>` : '<p class="no-records">No sessions found for the selected date range.</p>'}
  </div>

  <div class="footer">
    Study Hub Captive Portal &nbsp;|&nbsp; Sales Report &nbsp;|&nbsp; ${formatDate(startDate)} to ${formatDate(endDate)}
  </div>

</div>
<script>
  window.onload = function() { window.print(); };
</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert('Please allow popups for this site to download the report.');
  }
}
