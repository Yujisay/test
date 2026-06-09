console.log("Study Hub Portal loading...");

import { initFirebase, getDb } from './firebase';
import { state } from './state';
import { switchTab, updateConnectionStatus, closeTicketModal, downloadReceipt } from './ui';
import {
  onDurationChange, updateFormPreview,
  selectPaymentMethod, initiateCheckout
} from './booking';
import {
  checkSessionStatus, clearSearchLookup,
  stopOpenTimeSession, confirmStopCash, confirmStopOnline,
  openExtendModal, closeExtendModal, updateExtendCostPreview,
  confirmExtendCash, confirmExtendOnline
} from './session';

function init(): void {
  console.log("Study Hub Portal Initializing...");

  try {
    const db = initFirebase();

    if (window.lucide) lucide.createIcons();

    if (db) {
      db.ref(".info/connected").on("value", (snap: any) => {
        const connected = snap.val() === true;
        state.dbConnected = connected;
        updateConnectionStatus(connected);
        console.log(`Firebase Realtime Database: ${connected ? 'Connected' : 'Disconnected'}`);
      }, (err: any) => {
        console.error("Connection Check Failed:", err);
        updateConnectionStatus(false);
      });
    } else {
      updateConnectionStatus(false);
    }

    window.addEventListener('click', handleGlobalClicks, { capture: true, passive: false });

    (window as any).updateExtendPreview = () => {
      updateExtendCostPreview();
      document.querySelectorAll('.extend-option').forEach(opt => {
        const radio = opt.querySelector('input[type="radio"]') as HTMLInputElement;
        const card = opt.querySelector('.extend-label') as HTMLElement;
        if (!card) return;
        if (radio?.checked) {
          card.classList.add('border-brand-primary', 'bg-brand-primary/5');
          card.classList.remove('border-brand-border', 'bg-brand-light');
        } else {
          card.classList.remove('border-brand-primary', 'bg-brand-primary/5');
          card.classList.add('border-brand-border', 'bg-brand-light');
        }
      });
    };

    setupListeners();

    const savedTab = localStorage.getItem('activeTab') as 'avail' | 'check' | null;
    if (savedTab === 'check') switchTab('check');

    handleUrlParams();

    console.log("Study Hub Portal Ready.");
  } catch (err: any) {
    console.error("Initialization Failed:", err);
    const debugDiv = document.getElementById('debugStatus');
    if (debugDiv) {
      debugDiv.classList.remove('hidden');
      debugDiv.innerHTML = `⚠️ App Init Failed: ${err.message}`;
    }
  }
}

function handleUrlParams(): void {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const ref = params.get('ref');

  if (tab === 'check' && ref) {
    const db = getDb();
    if (db) {
      switchTab('check');
      db.ref('sessions').orderByChild('referenceNumber').equalTo(ref).once('value').then((snap: any) => {
        if (snap.exists()) {
          const record = Object.values(snap.val())[0] as { fullName?: string };
          const searchInput = document.getElementById("searchName") as HTMLInputElement;
          if (searchInput && record.fullName) {
            searchInput.value = record.fullName;
            setTimeout(() => {
              const btn = document.getElementById("btnSearchSession") as HTMLButtonElement;
              if (btn) btn.click();
            }, 300);
          }
        }
      }).catch(() => { switchTab('check'); });
    }
    window.history.replaceState({}, document.title, '/');
  }
}

function closeFormDropdowns(): void {
  document.querySelectorAll('.form-dropdown-menu').forEach(menu => {
    menu.classList.add('hidden');
  });
}

function setupFormDropdowns(): void {
  document.addEventListener('click', () => closeFormDropdowns());

  document.getElementById('seatTypeSelect')?.addEventListener('change', updateFormPreview);
  document.getElementById('durationSelect')?.addEventListener('change', onDurationChange);
}

function setupListeners(): void {
  document.getElementById("searchName")?.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); checkSessionStatus(); }
  });

  setupFormDropdowns();
  document.getElementById("customHours")?.addEventListener("input", updateFormPreview);
  document.getElementById("payMethodCash")?.addEventListener("click", () => selectPaymentMethod('cash'));
  document.getElementById("payMethodOnline")?.addEventListener("click", () => selectPaymentMethod('online'));
}

function handleGlobalClicks(e: MouseEvent): void {
  const target = (e.target as HTMLElement).closest('button') as HTMLElement;
  if (!target) return;

  const id = target.id;

  if (id === 'seatTypeDropdownToggle' || id === 'durationDropdownToggle') {
    e.stopPropagation();
    const menuId = id === 'seatTypeDropdownToggle' ? 'seatTypeDropdownMenu' : 'durationDropdownMenu';
    const menu = document.getElementById(menuId);
    const wasOpen = menu && !menu.classList.contains('hidden');
    closeFormDropdowns();
    if (menu && !wasOpen) menu.classList.remove('hidden');
    return;
  }

  if (target.classList.contains('form-dropdown-option')) {
    e.stopPropagation();
    const selectId = target.getAttribute('data-select');
    const value = target.getAttribute('data-value') ?? '';
    const label = target.getAttribute('data-label') ?? '';
    const select = document.getElementById(selectId!) as HTMLSelectElement;
    if (select) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const labelId = selectId === 'seatTypeSelect' ? 'seatTypeDropdownLabel' : 'durationDropdownLabel';
    const labelEl = document.getElementById(labelId);
    if (labelEl) {
      labelEl.textContent = label;
      labelEl.classList.toggle('text-brand-neutral', !value);
      labelEl.classList.toggle('text-brand-dark', !!value);
    }
    closeFormDropdowns();
    return;
  }

  if (id === 'tabAvail') switchTab('avail');
  if (id === 'tabCheck') switchTab('check');

  if (id === 'btnConfirmBooking') {
    if (state.dbConnected) initiateCheckout();
    else alert("Database is currently disconnected. Please check your internet and try again.");
  }

  if (id === 'btnSearchSession') {
    if (state.dbConnected) checkSessionStatus();
    else alert("Cannot search while database is disconnected.");
  }
  if (id === 'btnClearSearch' || id === 'btnRetrySearch') clearSearchLookup();

  if (id === 'btnCloseTicket' || id === 'btnDoneTicket') closeTicketModal();

  if (id === 'btnDownloadReceipt') {
    e.stopPropagation();
    downloadReceipt();
  }

  if (target.classList.contains('btn-extend-session')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) {
      import('./firebase').then(({ getDb }) => {
        const db = getDb();
        if (!db) return;
        db.ref('sessions/' + refNum).once('value').then((snap: any) => {
          const rec = snap.val();
          if (rec) openExtendModal(refNum, rec, rec.status === 'EXPIRED');
        });
      });
    } else if (!state.dbConnected) alert("Database disconnected.");
  }

  if (id === 'btnCloseExtend') closeExtendModal();
  if (id === 'btnExtendPayCash') confirmExtendCash();
  if (id === 'btnExtendPayOnline') confirmExtendOnline();

  if (target.classList.contains('btn-customer-stop-session')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) stopOpenTimeSession(refNum);
    else if (!state.dbConnected) alert("Cannot stop session while database is disconnected.");
  }

  if (id === 'btnCancelStop') {
    (document.getElementById('stopSessionModal') as HTMLElement).classList.add('hidden');
  }
  if (id === 'btnStopPayCash') confirmStopCash();
  if (id === 'btnStopPayOnline') confirmStopOnline();
}

document.addEventListener("DOMContentLoaded", init);
