console.log("Study Hub Portal loading...");

import { initFirebase, getDb } from './firebase';
import { state, adminState } from './state';
import { switchTab, updateConnectionStatus, closeTicketModal, closeAdminAuth } from './ui';
import {
  onDurationChange, updateFormPreview,
  selectPaymentMethod, initiateCheckout
} from './booking';
import {
  checkSessionStatus, clearSearchLookup
} from './session';
import {
  handleAdminTrigger, submitAdminAuth, unlockAdminMode, exitAdminMode,
  refreshAdminDashboard, archiveOldSessions, renderCurrentPage,
  filterAdminLogs, approveTransaction, endSession
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

    setupListeners();

    if (localStorage.getItem("adminAuthenticated") === "true") {
      adminState.isAuthenticated = true;
      unlockAdminMode();
    }

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
  console.log("Interactive click detected:", id || target.className);

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
}

document.addEventListener("DOMContentLoaded", init);

// Re-render admin when crossing mobile/desktop breakpoint so page size updates
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
