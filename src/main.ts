console.log("Study Hub Portal loading...");

import { initFirebase, getDb } from './firebase';
import { state, adminState } from './state';
import { switchTab, updateConnectionStatus, closeTicketModal, closeAdminAuth, downloadReceipt } from './ui';
import {
  onDurationChange, updateFormPreview,
  selectPaymentMethod, initiateCheckout
} from './booking';
import {
  checkSessionStatus, clearSearchLookup,
  stopOpenTimeSession, confirmStopCash, confirmStopOnline,
  openExtendModal, closeExtendModal, updateExtendCostPreview,
  confirmExtendCash, confirmExtendOnline, extendData
} from './session';
import {
  handleAdminTrigger, submitAdminAuth, unlockAdminMode, exitAdminMode,
  refreshAdminDashboard, archiveOldSessions, renderCurrentPage,
  filterAdminLogs, approveTransaction, endSession,
  markAwaitingAsPaid, cancelAwaitingPayment,
  openSalesReportModal, closeSalesReportModal, downloadSalesReport,
  extendSessionAdmin
} from './admin';
import { getPageSize } from './config';

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

    // Expose extend preview updater for radio onchange callbacks
    (window as any).updateExtendPreview = () => {
      updateExtendCostPreview();
      // Highlight selected card
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

    if (localStorage.getItem("adminAuthenticated") === "true") {
      adminState.isAuthenticated = true;
      unlockAdminMode();
    }

    // Handle post-payment redirect: ?tab=check&ref=REFNUM
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
    // Look up the session by ref to get the name, then auto-search
    const db = getDb();
    if (db) {
      switchTab('check');
      db.ref('sessions/' + ref).once('value').then((snap: any) => {
        if (snap.exists()) {
          const record = snap.val();
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
    // Clean URL without reload
    window.history.replaceState({}, document.title, '/');
  }
}

function setupListeners(): void {
  document.getElementById("searchName")?.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); checkSessionStatus(); }
  });

  document.getElementById("adminPassword")?.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); submitAdminAuth(); }
  });

  document.getElementById("adminTableFilter")?.addEventListener("input", filterAdminLogs);
  document.getElementById("adminStatusSelector")?.addEventListener("change", filterAdminLogs);
  document.getElementById("seatTypeSelect")?.addEventListener("change", updateFormPreview);
  document.getElementById("durationSelect")?.addEventListener("change", onDurationChange);
  document.getElementById("customHours")?.addEventListener("input", updateFormPreview);
  document.getElementById("payMethodCash")?.addEventListener("click", () => selectPaymentMethod('cash'));
  document.getElementById("payMethodOnline")?.addEventListener("click", () => selectPaymentMethod('online'));
}

function handleGlobalClicks(e: MouseEvent): void {
  const target = (e.target as HTMLElement).closest('button, #adminTriggerIcon') as HTMLElement;
  if (!target) return;

  const id = target.id;

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

  if (id === 'adminTriggerIcon') { e.stopPropagation(); handleAdminTrigger(); }
  if (id === 'btnCancelAdminAuth') closeAdminAuth();
  if (id === 'btnSubmitAdminAuth') submitAdminAuth();
  if (id === 'btnCloseTicket' || id === 'btnDoneTicket') closeTicketModal();

  if (id === 'btnDownloadReceipt') {
    e.stopPropagation();
    downloadReceipt();
  }

  if (id === 'btnRefreshAdmin') {
    if (state.dbConnected) refreshAdminDashboard();
    else alert("Database disconnected.");
  }
  if (id === 'btnArchiveLogs') {
    if (state.dbConnected) archiveOldSessions();
    else alert("Database disconnected.");
  }
  if (id === 'btnPagePrev') {
    if (adminState.currentPage > 1) { adminState.currentPage--; renderCurrentPage(); }
  }
  if (id === 'btnPageNext') {
    const totalPages = Math.ceil(adminState.filteredCache.length / getPageSize());
    if (adminState.currentPage < totalPages) { adminState.currentPage++; renderCurrentPage(); }
  }
  if (id === 'btnBackToUser') exitAdminMode();

  if (target.classList.contains('btn-approve-session')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) approveTransaction(refNum);
  }
  if (target.classList.contains('btn-end-session')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) endSession(refNum);
  }

  // Awaiting payment actions
  if (target.classList.contains('btn-mark-paid')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) markAwaitingAsPaid(refNum);
    else if (!state.dbConnected) alert("Database disconnected.");
  }
  if (target.classList.contains('btn-cancel-awaiting')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) cancelAwaitingPayment(refNum);
    else if (!state.dbConnected) alert("Database disconnected.");
  }

  // Sales report
  if (id === 'btnSalesReport') openSalesReportModal();
  if (id === 'btnCloseSalesReport') closeSalesReportModal();
  if (id === 'btnDownloadSalesReport') downloadSalesReport();

  // Admin extend session
  if (target.classList.contains('btn-admin-extend')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) extendSessionAdmin(refNum);
    else if (!state.dbConnected) alert("Database disconnected.");
  }

  // Customer extend session (from session card button)
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

  // Extend session modal buttons
  if (id === 'btnCloseExtend') closeExtendModal();
  if (id === 'btnExtendPayCash') confirmExtendCash();
  if (id === 'btnExtendPayOnline') confirmExtendOnline();

  // Customer stop session
  if (target.classList.contains('btn-customer-stop-session')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) stopOpenTimeSession(refNum);
    else if (!state.dbConnected) alert("Cannot stop session while database is disconnected.");
  }

  // Stop session modal buttons
  if (id === 'btnCancelStop') {
    (document.getElementById('stopSessionModal') as HTMLElement).classList.add('hidden');
  }
  if (id === 'btnStopPayCash') {
    confirmStopCash();
  }
  if (id === 'btnStopPayOnline') {
    confirmStopOnline();
  }
}

document.addEventListener("DOMContentLoaded", init);

let lastBreakpoint = window.innerWidth < 768 ? 'mobile' : 'desktop';
window.addEventListener('resize', () => {
  const current = window.innerWidth < 768 ? 'mobile' : 'desktop';
  if (current !== lastBreakpoint) {
    lastBreakpoint = current;
    if (adminState.isAuthenticated && adminState.filteredCache.length > 0) {
      adminState.currentPage = 1;
      renderCurrentPage();
    }
  }
});
