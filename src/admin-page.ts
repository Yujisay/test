import { initFirebase, getDb } from './firebase';
import { state, adminState } from './state';
import { startAutoExpireWatcher } from './auto-expire';
import { ADMIN_PASSCODE, getPageSize } from './config';
import { showLoader, hideLoader } from './ui';
import {
  startRealtimeDashboard, stopRealtimeDashboard,
  refreshAdminDashboard, archiveOldSessions, renderCurrentPage,
  filterAdminLogs, approveTransaction, endSession,
  markAwaitingAsPaid, cancelAwaitingPayment,
  openSalesReportModal, closeSalesReportModal, downloadSalesReport,
  extendSessionAdmin
} from './admin';

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 60_000;
const INACTIVITY_MS = 30 * 60 * 1000;

let currentPasscode = ADMIN_PASSCODE;
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let lockoutInterval: ReturnType<typeof setInterval> | null = null;

function closeAdminDropdown(): void {
  document.getElementById('adminDropdownMenu')?.classList.add('hidden');
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  sessionStorage.setItem('adminTheme', theme);
  const icon = document.getElementById('themeToggleIcon');
  if (icon) {
    icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons();
  }
  const label = document.getElementById('themeToggleLabel');
  if (label) label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
}

async function fetchPasscode(): Promise<string> {
  const db = getDb();
  if (!db) return ADMIN_PASSCODE;
  try {
    const snap = await db.ref('adminConfig/passcode').once('value');
    return snap.exists() ? String(snap.val()) : ADMIN_PASSCODE;
  } catch {
    return ADMIN_PASSCODE;
  }
}

function getLoginAttempts(): number {
  return parseInt(sessionStorage.getItem('adminLoginAttempts') || '0', 10);
}

function setLoginAttempts(n: number): void {
  sessionStorage.setItem('adminLoginAttempts', String(n));
}

function getLockoutUntil(): number {
  return parseInt(sessionStorage.getItem('adminLockoutUntil') || '0', 10);
}

function setLockoutUntil(ts: number): void {
  sessionStorage.setItem('adminLockoutUntil', String(ts));
}

function showLoginScreen(): void {
  document.getElementById('adminLoginScreen')?.classList.remove('hidden');
  document.getElementById('adminDashboard')?.classList.add('hidden');
  stopRealtimeDashboard();
}

function showDashboard(): void {
  document.getElementById('adminLoginScreen')?.classList.add('hidden');
  document.getElementById('adminDashboard')?.classList.remove('hidden');
  adminState.isAuthenticated = true;
  startRealtimeDashboard();
  resetInactivityTimer();
  if (window.lucide) lucide.createIcons();
}

function logout(): void {
  sessionStorage.removeItem('adminAuth');
  stopRealtimeDashboard();
  if (inactivityTimer) clearTimeout(inactivityTimer);
  showLoginScreen();
  const pw = document.getElementById('adminLoginPassword') as HTMLInputElement;
  if (pw) pw.value = '';
  hideLoginError();
}

function hideLoginError(): void {
  const el = document.getElementById('adminLoginError');
  if (el) { el.classList.add('hidden'); el.textContent = ''; }
}

function showLoginError(msg: string): void {
  const el = document.getElementById('adminLoginError');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function updateLockoutUI(): void {
  const lockoutEl = document.getElementById('adminLockoutMsg');
  const loginBtn = document.getElementById('btnAdminLogin') as HTMLButtonElement;
  const pwInput = document.getElementById('adminLoginPassword') as HTMLInputElement;
  const until = getLockoutUntil();
  const remaining = until - Date.now();

  if (remaining > 0) {
    const secs = Math.ceil(remaining / 1000);
    if (lockoutEl) {
      lockoutEl.textContent = `Too many attempts. Try again in ${secs} seconds.`;
      lockoutEl.classList.remove('hidden');
    }
    hideLoginError();
    if (loginBtn) loginBtn.disabled = true;
    if (pwInput) pwInput.disabled = true;
    return;
  }

  if (lockoutEl) lockoutEl.classList.add('hidden');
  if (loginBtn) loginBtn.disabled = false;
  if (pwInput) pwInput.disabled = false;
  setLockoutUntil(0);
}

function startLockoutCountdown(): void {
  if (lockoutInterval) clearInterval(lockoutInterval);
  updateLockoutUI();
  lockoutInterval = setInterval(() => {
    updateLockoutUI();
    if (getLockoutUntil() <= Date.now() && lockoutInterval) {
      clearInterval(lockoutInterval);
      lockoutInterval = null;
    }
  }, 1000);
}

function resetInactivityTimer(): void {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    alert('Session expired due to inactivity. Please log in again.');
    logout();
  }, INACTIVITY_MS);
}

function onAdminActivity(): void {
  if (adminState.isAuthenticated) resetInactivityTimer();
}

async function handleLogin(): Promise<void> {
  const until = getLockoutUntil();
  if (until > Date.now()) {
    updateLockoutUI();
    return;
  }

  const pwInput = document.getElementById('adminLoginPassword') as HTMLInputElement;
  const entered = pwInput?.value || '';

  if (entered === currentPasscode) {
    setLoginAttempts(0);
    setLockoutUntil(0);
    hideLoginError();
    sessionStorage.setItem('adminAuth', 'true');
    showDashboard();
    return;
  }

  const attempts = getLoginAttempts() + 1;
  setLoginAttempts(attempts);
  const remaining = MAX_ATTEMPTS - attempts;

  if (remaining <= 0) {
    setLockoutUntil(Date.now() + LOCKOUT_MS);
    setLoginAttempts(0);
    startLockoutCountdown();
    return;
  }

  showLoginError(`Incorrect password. ${remaining} attempt(s) remaining.`);
  if (pwInput) pwInput.value = '';
}

function clearSettingsMessages(): void {
  const err = document.getElementById('settingsPasswordError');
  const ok = document.getElementById('settingsPasswordSuccess');
  if (err) { err.classList.add('hidden'); err.textContent = ''; }
  if (ok) ok.classList.add('hidden');
}

function showSettingsError(msg: string): void {
  const el = document.getElementById('settingsPasswordError');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  document.getElementById('settingsPasswordSuccess')?.classList.add('hidden');
}

async function saveNewPassword(): Promise<void> {
  clearSettingsMessages();
  const current = (document.getElementById('settingsCurrentPassword') as HTMLInputElement).value;
  const newPw = (document.getElementById('settingsNewPassword') as HTMLInputElement).value;
  const confirm = (document.getElementById('settingsConfirmPassword') as HTMLInputElement).value;

  if (current !== currentPasscode) {
    showSettingsError('Current password is incorrect.');
    return;
  }
  if (newPw.length < 6) {
    showSettingsError('New password must be at least 6 characters.');
    return;
  }
  if (newPw !== confirm) {
    showSettingsError('New password and confirmation do not match.');
    return;
  }

  const db = getDb();
  if (!db) {
    showSettingsError('Database is not connected.');
    return;
  }

  try {
    showLoader('Saving...', 'Updating admin password...');
    await db.ref('adminConfig/passcode').set(newPw);
    currentPasscode = newPw;
    hideLoader();
    const ok = document.getElementById('settingsPasswordSuccess');
    if (ok) {
      ok.textContent = 'Password updated successfully.';
      ok.classList.remove('hidden');
    }
    (document.getElementById('settingsCurrentPassword') as HTMLInputElement).value = '';
    (document.getElementById('settingsNewPassword') as HTMLInputElement).value = '';
    (document.getElementById('settingsConfirmPassword') as HTMLInputElement).value = '';
  } catch (err: any) {
    hideLoader();
    console.error('Password update error:', err);
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('permission_denied')) {
      showSettingsError('Firebase denied the write. Add adminConfig rules in Firebase Console (see database.rules.json in project).');
    } else {
      showSettingsError('Failed to update password. Please try again.');
    }
  }
}

function setupListeners(): void {
  document.getElementById('adminTableFilter')?.addEventListener('input', filterAdminLogs);
  document.getElementById('adminStatusSelector')?.addEventListener('change', filterAdminLogs);

  document.getElementById('adminLoginPassword')?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleLogin(); }
  });

  ['click', 'keydown', 'mousemove', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, onAdminActivity, { passive: true });
  });
}

function handleGlobalClicks(e: MouseEvent): void {
  const target = (e.target as HTMLElement).closest('button') as HTMLElement;
  if (!target) return;

  const id = target.id;

  if (id === 'adminDropdownToggle') {
    e.stopPropagation();
    document.getElementById('adminDropdownMenu')?.classList.toggle('hidden');
    return;
  }

  if (id === 'btnAdminLogin') { handleLogin(); return; }

  if (id === 'btnRefreshAdmin') {
    closeAdminDropdown();
    if (state.dbConnected) refreshAdminDashboard();
    else alert('Database disconnected.');
    return;
  }

  if (id === 'btnArchiveLogs') {
    closeAdminDropdown();
    if (state.dbConnected) archiveOldSessions();
    else alert('Database disconnected.');
    return;
  }

  if (id === 'btnPagePrev') {
    if (adminState.currentPage > 1) { adminState.currentPage--; renderCurrentPage(); }
    return;
  }

  if (id === 'btnPageNext') {
    const totalPages = Math.ceil(adminState.filteredCache.length / getPageSize());
    if (adminState.currentPage < totalPages) { adminState.currentPage++; renderCurrentPage(); }
    return;
  }

  if (target.classList.contains('btn-approve-session')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) approveTransaction(refNum);
    return;
  }

  if (target.classList.contains('btn-end-session')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) endSession(refNum);
    return;
  }

  if (target.classList.contains('btn-mark-paid')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) markAwaitingAsPaid(refNum);
    else if (!state.dbConnected) alert('Database disconnected.');
    return;
  }

  if (target.classList.contains('btn-cancel-awaiting')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) cancelAwaitingPayment(refNum);
    else if (!state.dbConnected) alert('Database disconnected.');
    return;
  }

  if (id === 'btnSalesReport') {
    closeAdminDropdown();
    openSalesReportModal();
    return;
  }

  if (id === 'btnCloseSalesReport') closeSalesReportModal();
  if (id === 'btnDownloadSalesReport') downloadSalesReport();

  if (id === 'btnThemeToggle') {
    closeAdminDropdown();
    const isDark = document.documentElement.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark');
    return;
  }

  if (id === 'btnOpenSettings') {
    closeAdminDropdown();
    clearSettingsMessages();
    document.getElementById('settingsModal')?.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (id === 'btnCloseSettings') {
    document.getElementById('settingsModal')?.classList.add('hidden');
    return;
  }

  if (id === 'btnSavePassword') { saveNewPassword(); return; }

  if (id === 'btnLogout') {
    closeAdminDropdown();
    logout();
    return;
  }

  if (target.classList.contains('btn-admin-extend')) {
    const refNum = target.getAttribute('data-ref');
    if (refNum && state.dbConnected) extendSessionAdmin(refNum);
    else if (!state.dbConnected) alert('Database disconnected.');
  }
}

async function init(): Promise<void> {
  const savedTheme = sessionStorage.getItem('adminTheme') as 'light' | 'dark' | null;
  if (savedTheme) applyTheme(savedTheme);

  const db = initFirebase();
  if (window.lucide) lucide.createIcons();

  if (db) {
    startAutoExpireWatcher();

    db.ref('.info/connected').on('value', (snap: any) => {
      state.dbConnected = snap.val() === true;
    });
    currentPasscode = await fetchPasscode();
  }

  window.addEventListener('click', handleGlobalClicks, { capture: true, passive: false });
  document.addEventListener('click', () => closeAdminDropdown());

  setupListeners();

  if (getLockoutUntil() > Date.now()) startLockoutCountdown();

  if (sessionStorage.getItem('adminAuth') === 'true') {
    showDashboard();
  } else {
    showLoginScreen();
  }
}

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

document.addEventListener('DOMContentLoaded', () => { init(); });
