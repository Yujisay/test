(() => {
  // src/config.ts
  var firebaseConfig = {
    apiKey: "AIzaSyC6piJ_bLMZeOMZZb62PYmanilcA-JW3FM",
    authDomain: "studyhub-f1fbe.firebaseapp.com",
    projectId: "studyhub-f1fbe",
    databaseURL: "https://studyhub-f1fbe-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "studyhub-f1fbe.firebasestorage.app",
    messagingSenderId: "466465286377",
    appId: "1:466465286377:web:972eb3d4c45832933f6878"
  };
  var HOURLY_RATE = {
    "Table": 25,
    "Cubicle": 50
  };
  var ADMIN_PASSCODE = "admin123";
  var PAGE_SIZE = 10;
  function getPageSize() {
    return window.innerWidth < 768 ? 5 : 10;
  }

  // src/firebase.ts
  var db = null;
  function initFirebase() {
    try {
      if (window.firebase) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        console.log("Firebase Initialized Successfully (Compat Mode)");
      } else {
        console.error("Firebase SDK not found! Ensure CDN scripts are loaded in index.html.");
      }
    } catch (error) {
      console.error("Firebase Initialization Error:", error);
    }
    return db;
  }
  function getDb() {
    return db;
  }
  function sessionKey(record) {
    return record.fullName + "_" + record.referenceNumber;
  }

  // src/state.ts
  var state = {
    currentTab: "avail",
    paymentMethod: "cash",
    booking: {
      fullName: "",
      seatType: "",
      duration: "",
      hours: 0,
      amount: 0,
      bookingDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      startTime: "",
      endTime: ""
    },
    dbConnected: false
  };
  var adminState = {
    clickCount: 0,
    clickTimer: null,
    isAuthenticated: false,
    recordsCache: [],
    filteredCache: [],
    unsubscribe: null,
    currentPage: 1,
    pageSize: PAGE_SIZE
  };

  // src/auto-expire.ts
  var expireTimers = {};
  function parseEndTime(timeStr, bookingDate) {
    let base;
    if (bookingDate) {
      base = /* @__PURE__ */ new Date(bookingDate + "T00:00:00");
      if (isNaN(base.getTime())) base = /* @__PURE__ */ new Date();
    } else {
      base = /* @__PURE__ */ new Date();
    }
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return base;
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const period = match[3].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
  }
  async function markExpired(key, record) {
    const db2 = getDb();
    if (!db2) return;
    try {
      const snap = await db2.ref("sessions/" + key + "/status").once("value");
      if (snap.val() !== "ACTIVE") return;
      await db2.ref("sessions/" + key).update({ status: "EXPIRED" });
      console.log(
        `[AutoExpire] ${record.referenceNumber} (${record.fullName}) \u2192 EXPIRED`
      );
    } catch (e) {
      console.warn("[AutoExpire] Failed to expire", key, e);
    }
  }
  function scheduleExpiry(key, record) {
    if (expireTimers[key]) {
      clearTimeout(expireTimers[key]);
      delete expireTimers[key];
    }
    if (!record.endTime) return;
    const isOpenTime = record.duration === "Open Time" || record.duration.startsWith("Open Time");
    if (isOpenTime) return;
    const endDate = parseEndTime(record.endTime, record.bookingDate);
    const remaining = endDate.getTime() - Date.now();
    if (remaining <= 0) {
      markExpired(key, record);
    } else {
      expireTimers[key] = setTimeout(() => {
        delete expireTimers[key];
        markExpired(key, record);
      }, remaining);
      console.log(
        `[AutoExpire] ${record.referenceNumber} scheduled to expire in ${Math.round(remaining / 1e3)}s`
      );
    }
  }
  function clearAllTimers() {
    Object.keys(expireTimers).forEach((k) => {
      clearTimeout(expireTimers[k]);
      delete expireTimers[k];
    });
  }
  function startAutoExpireWatcher() {
    const db2 = getDb();
    if (!db2) {
      console.warn("[AutoExpire] No database \u2014 watcher not started.");
      return;
    }
    db2.ref("sessions").orderByChild("status").equalTo("ACTIVE").on("value", (snapshot) => {
      clearAllTimers();
      if (!snapshot.exists()) return;
      const sessions = snapshot.val();
      Object.entries(sessions).forEach(([key, record]) => {
        scheduleExpiry(key, record);
      });
    });
    console.log("[AutoExpire] Watcher started \u2014 monitoring all active sessions.");
  }

  // src/ui.ts
  function showLoader(title, msg) {
    document.getElementById("loadingTitle").innerText = title;
    document.getElementById("loadingMsg").innerText = msg;
    document.getElementById("loadingOverlay").classList.remove("hidden");
  }
  function hideLoader() {
    document.getElementById("loadingOverlay").classList.add("hidden");
  }

  // src/admin.ts
  var adminTimerInterval = null;
  function parseSessionTime(timeStr, bookingDate) {
    let base;
    if (bookingDate) {
      base = /* @__PURE__ */ new Date(bookingDate + "T00:00:00");
      if (isNaN(base.getTime())) base = /* @__PURE__ */ new Date();
    } else {
      base = /* @__PURE__ */ new Date();
    }
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return base;
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const period = match[3].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
  }
  function isOpenTimeSession(row) {
    return row.duration === "Open Time" || row.duration.startsWith("Open Time");
  }
  function formatCountdown(remainingMs) {
    if (remainingMs <= 0) return "00:00";
    const totalSecs = Math.floor(remainingMs / 1e3);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor(totalSecs % 3600 / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  function formatElapsed(elapsedMs) {
    const totalSecs = Math.floor(elapsedMs / 1e3);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor(totalSecs % 3600 / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) return `${hrs}h ${mins.toString().padStart(2, "0")}m`;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  }
  function getActiveTimerHtml(row) {
    if (row.status !== "ACTIVE") return '<span class="text-brand-neutral dark:text-[#a0a88e]">\u2014</span>';
    if (isOpenTimeSession(row)) {
      return `<span class="admin-session-timer font-mono font-bold text-amber-600 dark:text-amber-400"
      data-mode="elapsed" data-timestamp="${row.timestamp}">${formatElapsed(Date.now() - new Date(row.timestamp).getTime())}</span>
      <span class="block text-[9px] text-brand-neutral dark:text-[#a0a88e] mt-0.5">elapsed</span>`;
    }
    if (!row.endTime) {
      return '<span class="text-brand-neutral dark:text-[#a0a88e]">\u2014</span>';
    }
    const remaining = parseSessionTime(row.endTime, row.bookingDate).getTime() - Date.now();
    const urgent = remaining > 0 && remaining <= 5 * 60 * 1e3;
    const ended = remaining <= 0;
    const colorClass = ended ? "text-rose-600 dark:text-rose-400" : urgent ? "text-rose-600 dark:text-rose-400 animate-pulse" : "text-emerald-600 dark:text-emerald-400";
    return `<span class="admin-session-timer font-mono font-bold ${colorClass}"
    data-mode="countdown" data-end-time="${row.endTime}" data-booking-date="${row.bookingDate || ""}">${formatCountdown(remaining)}</span>
    <span class="block text-[9px] text-brand-neutral dark:text-[#a0a88e] mt-0.5">${ended ? "ended" : "remaining"}</span>`;
  }
  function tickAdminTimers() {
    document.querySelectorAll(".admin-session-timer").forEach((el) => {
      const mode = el.getAttribute("data-mode");
      if (mode === "countdown") {
        const endTime = el.getAttribute("data-end-time") || "";
        const bookingDate = el.getAttribute("data-booking-date") || void 0;
        const remaining = parseSessionTime(endTime, bookingDate).getTime() - Date.now();
        el.textContent = formatCountdown(remaining);
        el.classList.remove("text-emerald-600", "dark:text-emerald-400", "text-rose-600", "dark:text-rose-400", "animate-pulse");
        if (remaining <= 0) {
          el.classList.add("text-rose-600", "dark:text-rose-400");
        } else if (remaining <= 5 * 60 * 1e3) {
          el.classList.add("text-rose-600", "dark:text-rose-400", "animate-pulse");
        } else {
          el.classList.add("text-emerald-600", "dark:text-emerald-400");
        }
      } else if (mode === "elapsed") {
        const ts = el.getAttribute("data-timestamp") || "";
        el.textContent = formatElapsed(Date.now() - new Date(ts).getTime());
      }
    });
  }
  function stopAdminTimers() {
    if (adminTimerInterval !== null) {
      clearInterval(adminTimerInterval);
      adminTimerInterval = null;
    }
  }
  function startAdminTimers() {
    stopAdminTimers();
    if (!document.querySelector(".admin-session-timer")) return;
    tickAdminTimers();
    adminTimerInterval = setInterval(tickAdminTimers, 1e3);
  }
  function stopRealtimeDashboard() {
    stopAdminTimers();
    const db2 = getDb();
    if (db2 && adminState.unsubscribe) {
      db2.ref("sessions").off("value", adminState.unsubscribe);
      adminState.unsubscribe = null;
    }
  }
  function startRealtimeDashboard() {
    const db2 = getDb();
    if (!db2) return;
    adminState.unsubscribe = db2.ref("sessions").on("value", (snapshot) => {
      if (snapshot.exists()) {
        const records = Object.values(snapshot.val());
        adminState.recordsCache = records;
        renderAdminTable(records);
        updateKpis(records);
      } else {
        renderAdminTable([]);
      }
    });
  }
  function refreshAdminDashboard() {
    startRealtimeDashboard();
  }
  function renderAdminTable(records) {
    records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    adminState.filteredCache = records;
    adminState.currentPage = 1;
    renderCurrentPage();
  }
  function renderCurrentPage() {
    stopAdminTimers();
    const records = adminState.filteredCache;
    const tbody = document.getElementById("adminTableBody");
    const cardBody = document.getElementById("adminCardBody");
    tbody.innerHTML = "";
    cardBody.innerHTML = "";
    if (records.length === 0) {
      const emptyMsg = `<div class="flex flex-col items-center justify-center space-y-2 py-12 text-brand-neutral dark:text-[#a0a88e] text-xs"><i data-lucide="inbox" class="w-5 h-5"></i><span>No records found.</span></div>`;
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-12 text-brand-neutral">No records found.</td></tr>`;
      cardBody.innerHTML = emptyMsg;
      document.getElementById("adminTableCount").textContent = "Showing 0 rows";
      document.getElementById("adminTablePageInfo").classList.add("hidden");
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
    records.slice(start, end).forEach((row) => {
      const key = sessionKey(row);
      const rate = row.hourlyRate || HOURLY_RATE[row.seatType] || 25;
      const amountDisplay = row.duration === "Open Time" && row.status === "ACTIVE" ? `\u20B1${rate}/hr` : `\u20B1${Number(row.amount).toFixed(2)}`;
      const isOpenTime = isOpenTimeSession(row);
      const timerHtml = getActiveTimerHtml(row);
      let actionHtml = "";
      if (row.status === "PENDING SESSION") {
        actionHtml = `<button data-ref="${key}" class="btn-approve-session px-3 py-1 bg-brand-primary text-white rounded text-[10px] font-semibold">Approve</button>`;
      } else if (row.status === "ACTIVE") {
        actionHtml = `
        <div class="flex flex-col gap-1">
          <button data-ref="${key}" class="btn-end-session px-3 py-1 bg-rose-500 text-white rounded text-[10px] font-semibold">${isOpenTime ? "End & Bill" : "End"}</button>
          ${!isOpenTime ? `<button data-ref="${key}" class="btn-admin-extend px-3 py-1 bg-brand-primary/10 border border-brand-primary/30 text-brand-primary rounded text-[10px] font-semibold whitespace-nowrap">Extend</button>` : ""}
        </div>`;
      } else if (row.status === "AWAITING PAYMENT") {
        actionHtml = `
        <div class="flex flex-col gap-1">
          <button data-ref="${key}" class="btn-mark-paid px-3 py-1 bg-emerald-600 text-white rounded text-[10px] font-semibold whitespace-nowrap">Mark Paid</button>
          <button data-ref="${key}" class="btn-cancel-awaiting px-3 py-1 bg-rose-100 text-rose-600 border border-rose-200 rounded text-[10px] font-semibold whitespace-nowrap">Cancel</button>
        </div>`;
      }
      const statusColor = row.status === "ACTIVE" ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" : row.status === "PENDING SESSION" ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" : row.status === "AWAITING PAYMENT" ? "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" : "text-brand-neutral dark:text-[#a0a88e] bg-brand-light dark:bg-[#252b1a] border-brand-border dark:border-[#3a4229]";
      const tr = document.createElement("tr");
      tr.className = "admin-table-row hover:bg-brand-light dark:hover:bg-[#252b1a] text-brand-dark dark:text-[#e8e2d4]";
      tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold text-brand-primary">${row.referenceNumber}</td>
      <td class="py-3 px-4 font-semibold">${row.fullName}</td>
      <td class="py-3 px-4">${row.seatType}</td>
      <td class="py-3 px-4">${row.duration}</td>
      <td class="py-3 px-4 font-bold">${amountDisplay}</td>
      <td class="py-3 px-4"><span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${statusColor}">${row.status}</span></td>
      <td class="py-3 px-4">${timerHtml}</td>
      <td class="py-3 px-4 text-[10px] text-brand-neutral dark:text-[#a0a88e]">${row.startTime} \u2013 ${row.endTime}</td>
      <td class="py-3 px-4 text-center">${actionHtml || "\u2013"}</td>
    `;
      tbody.appendChild(tr);
      const card = document.createElement("div");
      card.className = "admin-card-item p-4 space-y-3 text-brand-dark dark:text-[#e8e2d4]";
      card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <span class="font-mono font-extrabold text-brand-primary text-sm">${row.referenceNumber}</span>
          <p class="font-semibold text-sm mt-0.5">${row.fullName}</p>
        </div>
        <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-lg border whitespace-nowrap ${statusColor}">${row.status}</span>
      </div>
      ${row.status === "ACTIVE" ? `<div class="admin-card-tile bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800 text-center">
          <span class="text-brand-neutral dark:text-[#a0a88e] block text-[9px] uppercase font-semibold mb-1">Live Timer</span>
          ${timerHtml}
        </div>` : ""}
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="admin-card-tile bg-brand-light dark:bg-[#252b1a] rounded-lg p-2 border border-transparent dark:border-[#3a4229]">
          <span class="text-brand-neutral dark:text-[#a0a88e] block text-[9px] uppercase font-semibold mb-0.5">Seat</span>
          <span class="font-semibold">${row.seatType}</span>
        </div>
        <div class="admin-card-tile bg-brand-light dark:bg-[#252b1a] rounded-lg p-2 border border-transparent dark:border-[#3a4229]">
          <span class="text-brand-neutral dark:text-[#a0a88e] block text-[9px] uppercase font-semibold mb-0.5">Duration</span>
          <span class="font-semibold">${row.duration}</span>
        </div>
        <div class="admin-card-tile bg-brand-light dark:bg-[#252b1a] rounded-lg p-2 border border-transparent dark:border-[#3a4229]">
          <span class="text-brand-neutral dark:text-[#a0a88e] block text-[9px] uppercase font-semibold mb-0.5">Amount</span>
          <span class="font-bold text-brand-primary">${amountDisplay}</span>
        </div>
        <div class="admin-card-tile bg-brand-light dark:bg-[#252b1a] rounded-lg p-2 border border-transparent dark:border-[#3a4229]">
          <span class="text-brand-neutral dark:text-[#a0a88e] block text-[9px] uppercase font-semibold mb-0.5">Time</span>
          <span class="font-semibold text-[10px]">${row.startTime} \u2013 ${row.endTime}</span>
        </div>
      </div>
      ${actionHtml ? `<div class="pt-1 flex flex-col gap-2">${actionHtml}</div>` : ""}
    `;
      cardBody.appendChild(card);
    });
    document.getElementById("adminTableCount").textContent = `Showing ${start + 1}\u2013${end} of ${records.length} record${records.length !== 1 ? "s" : ""}`;
    const pageInfo = document.getElementById("adminTablePageInfo");
    if (totalPages > 1) {
      pageInfo.classList.remove("hidden");
      document.getElementById("adminCurrentPage").textContent = String(adminState.currentPage);
      document.getElementById("adminTotalPages").textContent = String(totalPages);
    } else {
      pageInfo.classList.add("hidden");
    }
    updatePaginationControls(totalPages);
    if (window.lucide) lucide.createIcons();
    startAdminTimers();
  }
  function updatePaginationControls(totalPages) {
    const prevBtn = document.getElementById("btnPagePrev");
    const nextBtn = document.getElementById("btnPageNext");
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
  function filterAdminLogs() {
    const query = document.getElementById("adminTableFilter").value.toLowerCase();
    const status = document.getElementById("adminStatusSelector").value;
    const filtered = adminState.recordsCache.filter((r) => {
      const matchesQuery = r.fullName.toLowerCase().includes(query) || r.referenceNumber.toLowerCase().includes(query);
      const matchesStatus = status === "ALL" || status === "ACTIVE" && r.status === "ACTIVE" || status === "PENDING" && r.status === "PENDING SESSION" || status === "EXPIRED" && r.status === "EXPIRED" || status === "AWAITING" && r.status === "AWAITING PAYMENT";
      return matchesQuery && matchesStatus;
    });
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    adminState.filteredCache = filtered;
    adminState.currentPage = 1;
    renderCurrentPage();
  }
  function parseDurationHours(duration) {
    if (!duration || duration === "Open Time") return 0;
    const hourMatch = duration.match(/(\d+(?:\.\d+)?)\s*h/i);
    const minMatch = duration.match(/(\d+(?:\.\d+)?)\s*m/i);
    if (hourMatch) return parseFloat(hourMatch[1]);
    if (minMatch) return parseFloat(minMatch[1]) / 60;
    return 1;
  }
  async function approveTransaction(refNum) {
    const db2 = getDb();
    if (!db2) return;
    const snapshot = await db2.ref("sessions/" + refNum).once("value");
    const record = snapshot.val();
    if (!record) return;
    if (!confirm(`Approve session ${refNum} for ${record.fullName}?`)) return;
    const now = /* @__PURE__ */ new Date();
    const startTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    const today = now.toISOString().split("T")[0];
    const updateData = {
      status: "ACTIVE",
      startTime,
      bookingDate: today
    };
    if (record.duration && record.duration !== "Open Time") {
      const hours = parseDurationHours(record.duration);
      if (hours > 0) {
        const endDate = new Date(now.getTime() + hours * 60 * 60 * 1e3);
        updateData.endTime = endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      }
    }
    await db2.ref("sessions/" + refNum).update(updateData);
  }
  async function markAwaitingAsPaid(refNum) {
    const db2 = getDb();
    if (!db2) return;
    if (confirm(`Mark session ${refNum} as paid and move to PENDING SESSION?

Use this if the customer has paid but the online payment gateway did not automatically update.`)) {
      await db2.ref("sessions/" + refNum).update({
        status: "PENDING SESSION",
        paymentConfirmed: true,
        paidAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  }
  async function cancelAwaitingPayment(refNum) {
    const db2 = getDb();
    if (!db2) return;
    if (confirm(`Cancel and remove session ${refNum}?

This will delete the unpaid booking. The customer can create a new booking.`)) {
      await db2.ref("sessions/" + refNum).remove();
    }
  }
  async function endSession(refNum) {
    const db2 = getDb();
    if (!db2) return;
    const snapshot = await db2.ref("sessions/" + refNum).once("value");
    const record = snapshot.val();
    if (!record) return;
    const isOpenTime = record.duration === "Open Time";
    const confirmMsg = isOpenTime ? `End Open Time session ${refNum}?
Billing will be calculated based on actual time used.` : `End session ${refNum}?`;
    if (!confirm(confirmMsg)) return;
    const updateData = { status: "EXPIRED" };
    if (isOpenTime) {
      const elapsedMs = Date.now() - new Date(record.timestamp).getTime();
      const elapsedHours = elapsedMs / (1e3 * 60 * 60);
      const roundedHours = Math.max(0.25, Math.ceil(elapsedHours * 4) / 4);
      const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
      const finalAmount = Math.round(roundedHours * rate * 100) / 100;
      const hrs = Math.floor(roundedHours);
      const mins = Math.round((roundedHours - hrs) * 60);
      updateData.amount = finalAmount;
      updateData.endTime = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      updateData.duration = `Open Time (${hrs > 0 ? hrs + "h " : ""}${mins > 0 ? mins + "m" : ""})`.trim();
      alert(`Session ended.
Time used: ${hrs > 0 ? hrs + "h " : ""}${mins > 0 ? mins + "m" : ""}.
Total amount due: \u20B1${finalAmount.toFixed(2)}`);
    }
    await db2.ref("sessions/" + refNum).update(updateData);
  }
  async function extendSessionAdmin(refNum) {
    const db2 = getDb();
    if (!db2) return;
    const snapshot = await db2.ref("sessions/" + refNum).once("value");
    const record = snapshot.val();
    if (!record) return;
    const options = ["0.5 \u2014 30 minutes", "1 \u2014 1 hour", "2 \u2014 2 hours", "3 \u2014 3 hours"];
    const choice = prompt(
      `Extend session for ${record.fullName} (${refNum})
Current end time: ${record.endTime || "N/A"}

Enter hours to add:
  0.5 = 30 min
  1 = 1 hour
  2 = 2 hours
  3 = 3 hours`
    );
    if (!choice) return;
    const hours = parseFloat(choice);
    if (isNaN(hours) || hours <= 0) {
      alert("Invalid hours entered.");
      return;
    }
    const currentEndTime = record.endTime || "";
    let newEndTime = currentEndTime;
    if (currentEndTime) {
      const match = currentEndTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let h = parseInt(match[1]);
        const m = parseInt(match[2]);
        const period = match[3].toUpperCase();
        if (period === "PM" && h !== 12) h += 12;
        if (period === "AM" && h === 12) h = 0;
        let base;
        if (record.bookingDate) {
          base = /* @__PURE__ */ new Date(record.bookingDate + "T00:00:00");
          if (isNaN(base.getTime())) base = /* @__PURE__ */ new Date();
        } else {
          base = /* @__PURE__ */ new Date();
        }
        const storedEnd = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
        const extendFrom = storedEnd.getTime() < Date.now() ? /* @__PURE__ */ new Date() : storedEnd;
        const newDate = new Date(extendFrom.getTime() + hours * 60 * 60 * 1e3);
        newEndTime = newDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      }
    }
    const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
    const addedCost = Math.round(hours * rate * 100) / 100;
    const newAmount = Math.round(((Number(record.amount) || 0) + addedCost) * 100) / 100;
    const hoursLabel = hours === 0.5 ? "30 min" : `${hours}hr`;
    const newDuration = `${record.duration} +${hoursLabel}`.trim();
    if (!confirm(
      `Extend ${refNum} by +${hoursLabel}?

New end time: ${newEndTime}
Extra charge: \u20B1${addedCost.toFixed(2)}
New total: \u20B1${newAmount.toFixed(2)}`
    )) return;
    await db2.ref("sessions/" + refNum).update({
      status: "ACTIVE",
      endTime: newEndTime,
      amount: newAmount,
      duration: newDuration
    });
  }
  function getPHTime() {
    return new Date((/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  }
  async function archiveOldSessions() {
    const db2 = getDb();
    const DAYS = 7;
    const phNow = getPHTime();
    const cutoff = new Date(phNow.getTime() - 7 * 24 * 60 * 60 * 1e3);
    const expired = adminState.recordsCache.filter(
      (r) => r.status === "EXPIRED" && new Date(r.timestamp) < cutoff
    );
    if (expired.length === 0) {
      alert("No expired sessions older than 7 days found.");
      return;
    }
    if (!confirm("Are you sure you want to delete expired sessions older than 7 days? This cannot be undone.")) return;
    try {
      showLoader("Archiving...", `Removing ${expired.length} old records...`);
      const updates = {};
      expired.forEach((r) => {
        updates[`sessions/${sessionKey(r)}`] = null;
      });
      await db2.ref().update(updates);
      alert(`Done! ${expired.length} old record${expired.length !== 1 ? "s" : ""} removed.`);
    } catch (err) {
      console.error("Archive error:", err);
      alert("Archive failed. Please try again.");
    } finally {
      hideLoader();
    }
  }
  function updateKpis(records) {
    const today = (/* @__PURE__ */ new Date()).toDateString();
    let active = 0, earnings = 0, pending = 0;
    records.forEach((r) => {
      if (r.status === "ACTIVE") active++;
      if (r.status === "PENDING SESSION") pending++;
      if (r.status === "EXPIRED" && new Date(r.timestamp).toDateString() === today) earnings += Number(r.amount) || 0;
    });
    document.getElementById("adminActiveSessions").innerText = String(active);
    document.getElementById("adminDailyEarnings").innerText = `\u20B1${earnings.toFixed(2)}`;
    document.getElementById("adminPendingPayments").innerText = String(pending);
  }
  function openSalesReportModal() {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const firstOfMonth = new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0];
    const startInput = document.getElementById("reportStartDate");
    const endInput = document.getElementById("reportEndDate");
    if (startInput) startInput.value = firstOfMonth;
    if (endInput) endInput.value = today;
    document.getElementById("salesReportModal").classList.remove("hidden");
  }
  function closeSalesReportModal() {
    document.getElementById("salesReportModal").classList.add("hidden");
  }
  function downloadSalesReport() {
    const startVal = document.getElementById("reportStartDate").value;
    const endVal = document.getElementById("reportEndDate").value;
    if (!startVal || !endVal) {
      alert("Please select both a start and end date.");
      return;
    }
    const startDate = /* @__PURE__ */ new Date(startVal + "T00:00:00");
    const endDate = /* @__PURE__ */ new Date(endVal + "T23:59:59");
    if (startDate > endDate) {
      alert("Start date must be before end date.");
      return;
    }
    const allRecords = adminState.recordsCache;
    const filtered = allRecords.filter((r) => {
      const ts = new Date(r.timestamp);
      return ts >= startDate && ts <= endDate;
    });
    const completedSessions = filtered.filter((r) => r.status === "EXPIRED");
    const totalRevenue = completedSessions.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const activeSessions = filtered.filter((r) => r.status === "ACTIVE").length;
    const pendingSessions = filtered.filter((r) => r.status === "PENDING SESSION").length;
    const awaitingSessions = filtered.filter((r) => r.status === "AWAITING PAYMENT").length;
    const byType = {};
    completedSessions.forEach((r) => {
      if (!byType[r.seatType]) byType[r.seatType] = { count: 0, revenue: 0 };
      byType[r.seatType].count++;
      byType[r.seatType].revenue += Number(r.amount) || 0;
    });
    const byMethod = {};
    completedSessions.forEach((r) => {
      const method = r.paymentMethod || "CASH";
      if (!byMethod[method]) byMethod[method] = { count: 0, revenue: 0 };
      byMethod[method].count++;
      byMethod[method].revenue += Number(r.amount) || 0;
    });
    const formatDate = (d) => d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
    const generatedAt = (/* @__PURE__ */ new Date()).toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" });
    const typeRows = Object.entries(byType).map(([type, data]) => `
    <tr>
      <td>${type}</td>
      <td style="text-align:center">${data.count}</td>
      <td style="text-align:right;font-weight:700;color:#535C3B">\u20B1${data.revenue.toFixed(2)}</td>
    </tr>`).join("");
    const methodRows = Object.entries(byMethod).map(([method, data]) => `
    <tr>
      <td>${method}</td>
      <td style="text-align:center">${data.count}</td>
      <td style="text-align:right;font-weight:700;color:#535C3B">\u20B1${data.revenue.toFixed(2)}</td>
    </tr>`).join("");
    const sessionRows = filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((r) => {
      const statusColor = r.status === "ACTIVE" ? "#059669" : r.status === "PENDING SESSION" ? "#d97706" : r.status === "AWAITING PAYMENT" ? "#2563eb" : "#6b7280";
      return `
      <tr>
        <td style="font-family:monospace;font-weight:700">${r.referenceNumber}</td>
        <td>${r.fullName}</td>
        <td>${r.seatType}</td>
        <td>${r.duration}</td>
        <td>${r.bookingDate}</td>
        <td>${r.startTime}</td>
        <td>${r.paymentMethod || "CASH"}</td>
        <td style="text-align:right;font-weight:700;color:#535C3B">${r.status === "ACTIVE" ? "(Active)" : "\u20B1" + Number(r.amount).toFixed(2)}</td>
        <td><span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;color:${statusColor};border:1px solid ${statusColor};white-space:nowrap">${r.status}</span></td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sales Report \u2014 Study Hub WiFi</title>
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
    <strong>${formatDate(startDate)} &nbsp;\u2192&nbsp; ${formatDate(endDate)}</strong>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card revenue">
      <div class="label">Total Revenue</div>
      <div class="value">\u20B1${totalRevenue.toFixed(2)}</div>
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
        <tfoot><tr><td>Total</td><td style="text-align:center">${completedSessions.length}</td><td style="text-align:right">\u20B1${totalRevenue.toFixed(2)}</td></tr></tfoot>
      </table>` : '<p class="no-records">No completed sessions in range.</p>'}
    </div>

    <div class="section">
      <div class="section-title">Revenue by Payment Method</div>
      ${Object.keys(byMethod).length > 0 ? `
      <table>
        <thead><tr><th>Method</th><th style="text-align:center">Sessions</th><th style="text-align:right">Revenue</th></tr></thead>
        <tbody>${methodRows}</tbody>
        <tfoot><tr><td>Total</td><td style="text-align:center">${completedSessions.length}</td><td style="text-align:right">\u20B1${totalRevenue.toFixed(2)}</td></tr></tfoot>
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
          <td style="text-align:right">\u20B1${totalRevenue.toFixed(2)}</td>
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
<\/script>
</body>
</html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      alert("Please allow popups for this site to download the report.");
    }
  }

  // src/admin-page.ts
  var MAX_ATTEMPTS = 3;
  var LOCKOUT_MS = 6e4;
  var INACTIVITY_MS = 30 * 60 * 1e3;
  var currentPasscode = ADMIN_PASSCODE;
  var inactivityTimer = null;
  var lockoutInterval = null;
  function closeAdminDropdown() {
    document.getElementById("adminDropdownMenu")?.classList.add("hidden");
  }
  function applyTheme(theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    sessionStorage.setItem("adminTheme", theme);
    const icon = document.getElementById("themeToggleIcon");
    if (icon) {
      icon.setAttribute("data-lucide", theme === "dark" ? "sun" : "moon");
      if (window.lucide) lucide.createIcons();
    }
    const label = document.getElementById("themeToggleLabel");
    if (label) label.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
  }
  async function fetchPasscode() {
    const db2 = getDb();
    if (!db2) return ADMIN_PASSCODE;
    try {
      const snap = await db2.ref("adminConfig/passcode").once("value");
      return snap.exists() ? String(snap.val()) : ADMIN_PASSCODE;
    } catch {
      return ADMIN_PASSCODE;
    }
  }
  function getLoginAttempts() {
    return parseInt(sessionStorage.getItem("adminLoginAttempts") || "0", 10);
  }
  function setLoginAttempts(n) {
    sessionStorage.setItem("adminLoginAttempts", String(n));
  }
  function getLockoutUntil() {
    return parseInt(sessionStorage.getItem("adminLockoutUntil") || "0", 10);
  }
  function setLockoutUntil(ts) {
    sessionStorage.setItem("adminLockoutUntil", String(ts));
  }
  function showLoginScreen() {
    document.getElementById("adminLoginScreen")?.classList.remove("hidden");
    document.getElementById("adminDashboard")?.classList.add("hidden");
    stopRealtimeDashboard();
  }
  function showDashboard() {
    document.getElementById("adminLoginScreen")?.classList.add("hidden");
    document.getElementById("adminDashboard")?.classList.remove("hidden");
    adminState.isAuthenticated = true;
    startRealtimeDashboard();
    resetInactivityTimer();
    if (window.lucide) lucide.createIcons();
  }
  function logout() {
    sessionStorage.removeItem("adminAuth");
    stopRealtimeDashboard();
    if (inactivityTimer) clearTimeout(inactivityTimer);
    showLoginScreen();
    const pw = document.getElementById("adminLoginPassword");
    if (pw) pw.value = "";
    hideLoginError();
  }
  function hideLoginError() {
    const el = document.getElementById("adminLoginError");
    if (el) {
      el.classList.add("hidden");
      el.textContent = "";
    }
  }
  function showLoginError(msg) {
    const el = document.getElementById("adminLoginError");
    if (el) {
      el.textContent = msg;
      el.classList.remove("hidden");
    }
  }
  function updateLockoutUI() {
    const lockoutEl = document.getElementById("adminLockoutMsg");
    const loginBtn = document.getElementById("btnAdminLogin");
    const pwInput = document.getElementById("adminLoginPassword");
    const until = getLockoutUntil();
    const remaining = until - Date.now();
    if (remaining > 0) {
      const secs = Math.ceil(remaining / 1e3);
      if (lockoutEl) {
        lockoutEl.textContent = `Too many attempts. Try again in ${secs} seconds.`;
        lockoutEl.classList.remove("hidden");
      }
      hideLoginError();
      if (loginBtn) loginBtn.disabled = true;
      if (pwInput) pwInput.disabled = true;
      return;
    }
    if (lockoutEl) lockoutEl.classList.add("hidden");
    if (loginBtn) loginBtn.disabled = false;
    if (pwInput) pwInput.disabled = false;
    setLockoutUntil(0);
  }
  function startLockoutCountdown() {
    if (lockoutInterval) clearInterval(lockoutInterval);
    updateLockoutUI();
    lockoutInterval = setInterval(() => {
      updateLockoutUI();
      if (getLockoutUntil() <= Date.now() && lockoutInterval) {
        clearInterval(lockoutInterval);
        lockoutInterval = null;
      }
    }, 1e3);
  }
  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      alert("Session expired due to inactivity. Please log in again.");
      logout();
    }, INACTIVITY_MS);
  }
  function onAdminActivity() {
    if (adminState.isAuthenticated) resetInactivityTimer();
  }
  async function handleLogin() {
    const until = getLockoutUntil();
    if (until > Date.now()) {
      updateLockoutUI();
      return;
    }
    const pwInput = document.getElementById("adminLoginPassword");
    const entered = pwInput?.value || "";
    if (entered === currentPasscode) {
      setLoginAttempts(0);
      setLockoutUntil(0);
      hideLoginError();
      sessionStorage.setItem("adminAuth", "true");
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
    if (pwInput) pwInput.value = "";
  }
  function clearSettingsMessages() {
    const err = document.getElementById("settingsPasswordError");
    const ok = document.getElementById("settingsPasswordSuccess");
    if (err) {
      err.classList.add("hidden");
      err.textContent = "";
    }
    if (ok) ok.classList.add("hidden");
  }
  function showSettingsError(msg) {
    const el = document.getElementById("settingsPasswordError");
    if (el) {
      el.textContent = msg;
      el.classList.remove("hidden");
    }
    document.getElementById("settingsPasswordSuccess")?.classList.add("hidden");
  }
  async function saveNewPassword() {
    clearSettingsMessages();
    const current = document.getElementById("settingsCurrentPassword").value;
    const newPw = document.getElementById("settingsNewPassword").value;
    const confirm2 = document.getElementById("settingsConfirmPassword").value;
    if (current !== currentPasscode) {
      showSettingsError("Current password is incorrect.");
      return;
    }
    if (newPw.length < 6) {
      showSettingsError("New password must be at least 6 characters.");
      return;
    }
    if (newPw !== confirm2) {
      showSettingsError("New password and confirmation do not match.");
      return;
    }
    const db2 = getDb();
    if (!db2) {
      showSettingsError("Database is not connected.");
      return;
    }
    try {
      showLoader("Saving...", "Updating admin password...");
      await db2.ref("adminConfig/passcode").set(newPw);
      currentPasscode = newPw;
      hideLoader();
      const ok = document.getElementById("settingsPasswordSuccess");
      if (ok) {
        ok.textContent = "Password updated successfully.";
        ok.classList.remove("hidden");
      }
      document.getElementById("settingsCurrentPassword").value = "";
      document.getElementById("settingsNewPassword").value = "";
      document.getElementById("settingsConfirmPassword").value = "";
    } catch (err) {
      hideLoader();
      console.error("Password update error:", err);
      const msg = String(err?.message || err || "");
      if (msg.includes("PERMISSION_DENIED") || msg.includes("permission_denied")) {
        showSettingsError("Firebase denied the write. Add adminConfig rules in Firebase Console (see database.rules.json in project).");
      } else {
        showSettingsError("Failed to update password. Please try again.");
      }
    }
  }
  function setupListeners() {
    document.getElementById("adminTableFilter")?.addEventListener("input", filterAdminLogs);
    document.getElementById("adminStatusSelector")?.addEventListener("change", filterAdminLogs);
    document.getElementById("adminLoginPassword")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLogin();
      }
    });
    ["click", "keydown", "mousemove", "touchstart"].forEach((evt) => {
      document.addEventListener(evt, onAdminActivity, { passive: true });
    });
  }
  function handleGlobalClicks(e) {
    const target = e.target.closest("button");
    if (!target) return;
    const id = target.id;
    if (id === "adminDropdownToggle") {
      e.stopPropagation();
      document.getElementById("adminDropdownMenu")?.classList.toggle("hidden");
      return;
    }
    if (id === "btnAdminLogin") {
      handleLogin();
      return;
    }
    if (id === "btnRefreshAdmin") {
      closeAdminDropdown();
      if (state.dbConnected) refreshAdminDashboard();
      else alert("Database disconnected.");
      return;
    }
    if (id === "btnArchiveLogs") {
      closeAdminDropdown();
      if (state.dbConnected) archiveOldSessions();
      else alert("Database disconnected.");
      return;
    }
    if (id === "btnPagePrev") {
      if (adminState.currentPage > 1) {
        adminState.currentPage--;
        renderCurrentPage();
      }
      return;
    }
    if (id === "btnPageNext") {
      const totalPages = Math.ceil(adminState.filteredCache.length / getPageSize());
      if (adminState.currentPage < totalPages) {
        adminState.currentPage++;
        renderCurrentPage();
      }
      return;
    }
    if (target.classList.contains("btn-approve-session")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) approveTransaction(refNum);
      return;
    }
    if (target.classList.contains("btn-end-session")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) endSession(refNum);
      return;
    }
    if (target.classList.contains("btn-mark-paid")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) markAwaitingAsPaid(refNum);
      else if (!state.dbConnected) alert("Database disconnected.");
      return;
    }
    if (target.classList.contains("btn-cancel-awaiting")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) cancelAwaitingPayment(refNum);
      else if (!state.dbConnected) alert("Database disconnected.");
      return;
    }
    if (id === "btnSalesReport") {
      closeAdminDropdown();
      openSalesReportModal();
      return;
    }
    if (id === "btnCloseSalesReport") closeSalesReportModal();
    if (id === "btnDownloadSalesReport") downloadSalesReport();
    if (id === "btnThemeToggle") {
      closeAdminDropdown();
      const isDark = document.documentElement.classList.contains("dark");
      applyTheme(isDark ? "light" : "dark");
      return;
    }
    if (id === "btnOpenSettings") {
      closeAdminDropdown();
      clearSettingsMessages();
      document.getElementById("settingsModal")?.classList.remove("hidden");
      if (window.lucide) lucide.createIcons();
      return;
    }
    if (id === "btnCloseSettings") {
      document.getElementById("settingsModal")?.classList.add("hidden");
      return;
    }
    if (id === "btnSavePassword") {
      saveNewPassword();
      return;
    }
    if (id === "btnLogout") {
      closeAdminDropdown();
      logout();
      return;
    }
    if (target.classList.contains("btn-admin-extend")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) extendSessionAdmin(refNum);
      else if (!state.dbConnected) alert("Database disconnected.");
    }
  }
  async function init() {
    const savedTheme = sessionStorage.getItem("adminTheme");
    if (savedTheme) applyTheme(savedTheme);
    const db2 = initFirebase();
    if (window.lucide) lucide.createIcons();
    if (db2) {
      startAutoExpireWatcher();
      db2.ref(".info/connected").on("value", (snap) => {
        state.dbConnected = snap.val() === true;
      });
      currentPasscode = await fetchPasscode();
    }
    window.addEventListener("click", handleGlobalClicks, { capture: true, passive: false });
    document.addEventListener("click", () => closeAdminDropdown());
    setupListeners();
    if (getLockoutUntil() > Date.now()) startLockoutCountdown();
    if (sessionStorage.getItem("adminAuth") === "true") {
      showDashboard();
    } else {
      showLoginScreen();
    }
  }
  var lastBreakpoint = window.innerWidth < 768 ? "mobile" : "desktop";
  window.addEventListener("resize", () => {
    const current = window.innerWidth < 768 ? "mobile" : "desktop";
    if (current !== lastBreakpoint) {
      lastBreakpoint = current;
      if (adminState.isAuthenticated && adminState.filteredCache.length > 0) {
        adminState.currentPage = 1;
        renderCurrentPage();
      }
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    init();
  });
})();
