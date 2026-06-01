import { HOURLY_RATE } from './config';
import { getDb } from './firebase';
import { SessionRecord } from './types';

export async function checkSessionStatus(): Promise<void> {
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
  const resultsDiv = document.getElementById("checkResultContainer") as HTMLElement;
  const statusColor = record.status === 'ACTIVE'
    ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : record.status === 'PENDING SESSION'
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-brand-neutral bg-brand-light border-brand-border';

  const isOpenTime = record.duration === 'Open Time';
  const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
  const amountDisplay = isOpenTime && record.status === 'ACTIVE'
    ? `₱${rate}/hr (Open)` : `₱${Number(record.amount).toFixed(2)}`;

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
          <span class="text-brand-neutral">Amount</span>
          <span class="font-black font-['Outfit'] text-brand-primary text-lg">${amountDisplay}</span>
        </div>
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
      <button id="btnClearSearch" class="w-full py-3 px-4 rounded-xl text-xs font-bold bg-brand-light border border-brand-border hover:bg-brand-secondary/20 text-brand-dark transition-all">Search Again</button>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
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
        <p class="text-xs text-brand-neutral mt-1">No active session found for "<strong>${name}</strong>".</p>
      </div>
      <button id="btnRetrySearch" class="mt-2 px-4 py-2 text-xs font-bold rounded-lg bg-brand-light border border-brand-border hover:bg-brand-secondary/20 text-brand-dark transition-all">Try Again</button>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

export function clearSearchLookup(): void {
  (document.getElementById("searchName") as HTMLInputElement).value = "";
  (document.getElementById("checkResultContainer") as HTMLElement).classList.add("hidden");
  (document.getElementById("checkEmptyState") as HTMLElement).classList.remove("hidden");
}
