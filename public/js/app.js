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
  var PRICING = {
    "Table": { "1 Hour": 25, "3+1 Hours": 75 },
    "Cubicle": { "1 Hour": 50, "3+1 Hours": 150 }
  };
  var HOURLY_RATE = {
    "Table": 25,
    "Cubicle": 50
  };
  var CLOSING_TIME = "22:00";
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

  // src/ui.ts
  function showLoader(title, msg) {
    document.getElementById("loadingTitle").innerText = title;
    document.getElementById("loadingMsg").innerText = msg;
    document.getElementById("loadingOverlay").classList.remove("hidden");
  }
  function hideLoader() {
    document.getElementById("loadingOverlay").classList.add("hidden");
  }
  function showFormError(msg) {
    const el = document.getElementById("stepErrorMessage");
    el.innerText = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 3e3);
  }
  function switchTab(tabId) {
    state.currentTab = tabId;
    const btnAvail = document.getElementById("tabAvail");
    const btnCheck = document.getElementById("tabCheck");
    const secAvail = document.getElementById("sectionAvail");
    const secCheck = document.getElementById("sectionCheck");
    const activeClass = "py-3 px-4 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 bg-brand-primary text-white shadow-soft font-['Outfit']";
    const inactiveClass = "py-3 px-4 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 text-brand-neutral hover:text-brand-dark";
    if (tabId === "avail") {
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
  function updateConnectionStatus(connected) {
    const dot = document.querySelector(".text-brand-neutral span.rounded-full");
    if (dot) {
      dot.className = `w-1.5 h-1.5 rounded-full mr-1.5 ${connected ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`;
    }
  }
  function showTicketModal(record) {
    const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
    const isOpenTime = record.duration === "Open Time";
    const amountText = isOpenTime ? `\u20B1${rate.toFixed(2)}/hr` : `\u20B1${Number(record.amount).toFixed(2)}`;
    const instructions = isOpenTime ? `Proceed to the Study Hub cashier desk and present this Reference Number. Your session will be billed at \u20B1${rate}.00 per hour when you end your session.` : `Proceed to the Study Hub cashier desk and present this Reference Number. The cashier will receive your payment of \u20B1${Number(record.amount).toFixed(2)} and activate your session.`;
    document.getElementById("ticketRef").innerText = record.referenceNumber;
    document.getElementById("ticketName").innerText = record.fullName;
    document.getElementById("ticketHours").innerText = record.duration;
    document.getElementById("ticketAmount").innerText = amountText;
    document.getElementById("ticketInstructions").innerText = instructions;
    document.getElementById("ticketModal").classList.remove("hidden");
  }
  function closeTicketModal() {
    document.getElementById("ticketModal").classList.add("hidden");
  }
  function closeAdminAuth() {
    document.getElementById("adminAuthModal").classList.add("hidden");
  }

  // src/booking.ts
  function computeSessionTimes(hours, duration) {
    const now = /* @__PURE__ */ new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    now.setMinutes(roundedMinutes);
    now.setSeconds(0);
    const startTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    let endTime;
    if (duration === "Open Time") {
      const [closeHour, closeMin] = CLOSING_TIME.split(":");
      const closingDate = new Date(now);
      closingDate.setHours(parseInt(closeHour), parseInt(closeMin), 0, 0);
      endTime = closingDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    } else {
      const end = new Date(now.getTime() + hours * 60 * 60 * 1e3);
      endTime = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    }
    return { startTime, endTime };
  }
  function onDurationChange() {
    const duration = document.getElementById("durationSelect").value;
    const wrapper = document.getElementById("customDurationWrapper");
    if (wrapper) {
      wrapper.classList.toggle("hidden", duration !== "Custom");
    }
    updateFormPreview();
  }
  function updateFormPreview() {
    const seatType = document.getElementById("seatTypeSelect").value;
    const duration = document.getElementById("durationSelect").value;
    const card = document.getElementById("pricePreviewCard");
    if (!seatType || !duration) {
      card?.classList.add("hidden");
      return;
    }
    if (duration === "Custom") {
      const hrs = parseFloat(document.getElementById("customHours").value);
      if (!hrs || hrs < 1) {
        card?.classList.add("hidden");
        return;
      }
    }
    card?.classList.remove("hidden");
    const rate = HOURLY_RATE[seatType] || 25;
    let amount = 0;
    let displayDuration = duration;
    let hoursValue = 0;
    if (duration === "1 Hour") {
      amount = PRICING[seatType]["1 Hour"];
      hoursValue = 1;
    } else if (duration === "3+1 Hours") {
      amount = PRICING[seatType]["3+1 Hours"];
      hoursValue = 4;
      displayDuration = "3+1 Hours (4 hrs)";
    } else if (duration === "Open Time") {
      amount = rate;
      hoursValue = 0;
    } else if (duration === "Custom") {
      hoursValue = parseFloat(document.getElementById("customHours").value) || 0;
      amount = hoursValue * rate;
      displayDuration = `${hoursValue} Hour${hoursValue !== 1 ? "s" : ""}`;
    }
    const times = computeSessionTimes(hoursValue, duration);
    const openTimeNote = document.getElementById("openTimeNote");
    document.getElementById("previewSeat").textContent = seatType;
    document.getElementById("previewDuration").textContent = displayDuration;
    document.getElementById("previewDate").textContent = state.booking.bookingDate;
    document.getElementById("previewStart").textContent = times.startTime;
    document.getElementById("previewEnd").textContent = times.endTime;
    if (duration === "Open Time") {
      document.getElementById("previewPrice").textContent = `\u20B1${amount.toFixed(2)}/hr`;
      openTimeNote?.classList.remove("hidden");
    } else {
      document.getElementById("previewPrice").textContent = `\u20B1${amount.toFixed(2)}`;
      openTimeNote?.classList.add("hidden");
    }
    if (window.lucide) lucide.createIcons();
  }
  function selectPaymentMethod(method) {
    state.paymentMethod = method;
    const cashBtn = document.getElementById("payMethodCash");
    const onlineBtn = document.getElementById("payMethodOnline");
    const onlineNote = document.getElementById("onlinePayNote");
    const btnLabel = document.getElementById("btnConfirmLabel");
    const active = ["border-brand-primary", "bg-brand-primary/10", "text-brand-primary"];
    const inactive = ["border-brand-border", "bg-brand-surface", "text-brand-neutral"];
    if (method === "cash") {
      cashBtn.classList.remove(...inactive);
      cashBtn.classList.add(...active);
      onlineBtn.classList.remove(...active);
      onlineBtn.classList.add(...inactive);
      onlineNote?.classList.add("hidden");
      if (btnLabel) btnLabel.innerHTML = "Confirm &amp; Book";
    } else {
      onlineBtn.classList.remove(...inactive);
      onlineBtn.classList.add(...active);
      cashBtn.classList.remove(...active);
      cashBtn.classList.add(...inactive);
      onlineNote?.classList.remove("hidden");
      if (btnLabel) btnLabel.textContent = "Pay Online \u2192";
    }
  }
  async function initiateCheckout() {
    const fullName = document.getElementById("fullName").value.trim();
    const seatType = document.getElementById("seatTypeSelect").value;
    const duration = document.getElementById("durationSelect").value;
    if (!fullName) {
      showFormError("Please enter your full name.");
      return;
    }
    if (!seatType) {
      showFormError("Please select a seat type.");
      return;
    }
    if (!duration) {
      showFormError("Please select a duration.");
      return;
    }
    const rate = HOURLY_RATE[seatType] || 25;
    let hours = 0;
    let amount = 0;
    if (duration === "1 Hour") {
      hours = 1;
      amount = PRICING[seatType]["1 Hour"];
    } else if (duration === "3+1 Hours") {
      hours = 4;
      amount = PRICING[seatType]["3+1 Hours"];
    } else if (duration === "Open Time") {
      hours = 0;
      amount = 0;
    } else if (duration === "Custom") {
      hours = parseFloat(document.getElementById("customHours").value);
      if (!hours || hours < 1) {
        showFormError("Please enter a valid number of hours (minimum 1).");
        return;
      }
      amount = Math.round(hours * rate * 100) / 100;
    }
    if (state.paymentMethod === "online" && duration === "Open Time") {
      showFormError("Online payment is not available for Open Time. Please use Cash or choose a fixed duration.");
      return;
    }
    const times = computeSessionTimes(hours, duration);
    const refNumber = Math.random().toString(36).substring(2, 10).toUpperCase();
    const durationLabel = duration === "Custom" ? `${hours} Hour${hours !== 1 ? "s" : ""} (Custom)` : duration;
    const sessionData = {
      referenceNumber: refNumber,
      fullName,
      seatType,
      duration: durationLabel,
      amount,
      hourlyRate: rate,
      bookingDate: state.booking.bookingDate,
      startTime: times.startTime,
      endTime: times.endTime,
      status: "PENDING SESSION",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (state.paymentMethod === "online") {
      await initiateOnlinePayment(sessionData);
    } else {
      await initiateCashCheckout(sessionData);
    }
  }
  async function initiateCashCheckout(sessionData) {
    const db2 = getDb();
    try {
      showLoader("Processing...", "Creating your WiFi session...");
      const data = { ...sessionData, status: "PENDING SESSION", paymentMethod: "CASH" };
      if (db2) {
        await db2.ref("sessions/" + data.referenceNumber).set(data);
        showTicketModal(data);
        resetBookingState();
      }
    } catch (error) {
      console.error("Checkout Error:", error);
      alert("Checkout failed. Check your internet connection.");
    } finally {
      hideLoader();
    }
  }
  async function initiateOnlinePayment(sessionData) {
    try {
      showLoader("Redirecting...", "Creating your secure payment link...");
      const res = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData)
      });
      const data = await res.json();
      if (!res.ok || !data.invoiceUrl) {
        hideLoader();
        alert(data.error || "Failed to create payment link. Please try again.");
        return;
      }
      window.location.href = data.invoiceUrl;
    } catch (error) {
      console.error("Online payment error:", error);
      hideLoader();
      alert("Could not connect to payment gateway. Please try Cash payment instead.");
    }
  }
  function resetBookingState() {
    location.reload();
  }

  // src/session.ts
  async function checkSessionStatus() {
    const db2 = getDb();
    const name = document.getElementById("searchName").value.trim();
    if (!name || !db2) return;
    const resultsDiv = document.getElementById("checkResultContainer");
    const emptyState = document.getElementById("checkEmptyState");
    emptyState.classList.add("hidden");
    resultsDiv.classList.remove("hidden");
    resultsDiv.innerHTML = `<div class="p-12 text-center"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto text-brand-primary"></i></div>`;
    if (window.lucide) lucide.createIcons();
    try {
      const snapshot = await db2.ref("sessions").orderByChild("fullName").equalTo(name).once("value");
      if (snapshot.exists()) {
        const records = Object.values(snapshot.val());
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
  function renderSessionCard(record) {
    const resultsDiv = document.getElementById("checkResultContainer");
    const statusColor = record.status === "ACTIVE" ? "text-emerald-600 bg-emerald-50 border-emerald-200" : record.status === "PENDING SESSION" ? "text-amber-600 bg-amber-50 border-amber-200" : "text-brand-neutral bg-brand-light border-brand-border";
    const isOpenTime = record.duration === "Open Time";
    const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
    const amountDisplay = isOpenTime && record.status === "ACTIVE" ? `\u20B1${rate}/hr (Open)` : `\u20B1${Number(record.amount).toFixed(2)}`;
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
  function renderNoRecordFound(name) {
    const resultsDiv = document.getElementById("checkResultContainer");
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
  function clearSearchLookup() {
    document.getElementById("searchName").value = "";
    document.getElementById("checkResultContainer").classList.add("hidden");
    document.getElementById("checkEmptyState").classList.remove("hidden");
  }

  // src/admin.ts
  function handleAdminTrigger() {
    adminState.clickCount++;
    if (adminState.clickTimer) clearTimeout(adminState.clickTimer);
    adminState.clickTimer = setTimeout(() => {
      adminState.clickCount = 0;
    }, 2e3);
    if (adminState.clickCount >= 3) {
      adminState.clickCount = 0;
      document.getElementById("adminAuthModal").classList.remove("hidden");
      document.getElementById("adminPassword").focus();
    }
  }
  function submitAdminAuth() {
    const pass = document.getElementById("adminPassword").value;
    if (pass === ADMIN_PASSCODE) {
      adminState.isAuthenticated = true;
      localStorage.setItem("adminAuthenticated", "true");
      closeAdminAuth();
      unlockAdminMode();
    } else {
      document.getElementById("adminAuthError").classList.remove("hidden");
    }
  }
  function unlockAdminMode() {
    document.getElementById("publicClientView").classList.add("hidden");
    document.getElementById("privateAdminView").classList.remove("hidden");
    document.getElementById("btnBackToUser").classList.remove("hidden");
    startRealtimeDashboard();
  }
  function exitAdminMode() {
    const db2 = getDb();
    localStorage.removeItem("adminAuthenticated");
    if (db2 && adminState.unsubscribe) {
      db2.ref("sessions").off("value", adminState.unsubscribe);
      adminState.unsubscribe = null;
    }
    location.reload();
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
    const records = adminState.filteredCache;
    const tbody = document.getElementById("adminTableBody");
    const cardBody = document.getElementById("adminCardBody");
    tbody.innerHTML = "";
    cardBody.innerHTML = "";
    if (records.length === 0) {
      const emptyMsg = `<div class="flex flex-col items-center justify-center space-y-2 py-12 text-brand-neutral text-xs"><i data-lucide="inbox" class="w-5 h-5"></i><span>No records found.</span></div>`;
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-12 text-brand-neutral">No records found.</td></tr>`;
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
      const rate = row.hourlyRate || HOURLY_RATE[row.seatType] || 25;
      const amountDisplay = row.duration === "Open Time" && row.status === "ACTIVE" ? `\u20B1${rate}/hr` : `\u20B1${Number(row.amount).toFixed(2)}`;
      const isOpenTime = row.duration === "Open Time";
      let actionHtml = "";
      if (row.status === "PENDING SESSION") {
        actionHtml = `<button data-ref="${row.referenceNumber}" class="btn-approve-session px-3 py-1 bg-brand-primary text-white rounded text-[10px] font-semibold">Approve</button>`;
      } else if (row.status === "ACTIVE") {
        actionHtml = `<button data-ref="${row.referenceNumber}" class="btn-end-session px-3 py-1 bg-rose-500 text-white rounded text-[10px] font-semibold">${isOpenTime ? "End & Bill" : "End"}</button>`;
      }
      const statusColor = row.status === "ACTIVE" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : row.status === "PENDING SESSION" ? "text-amber-700 bg-amber-50 border-amber-200" : row.status === "AWAITING PAYMENT" ? "text-blue-700 bg-blue-50 border-blue-200" : "text-brand-neutral bg-brand-light border-brand-border";
      const tr = document.createElement("tr");
      tr.className = "hover:bg-brand-light";
      tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold">${row.referenceNumber}</td>
      <td class="py-3 px-4 font-semibold">${row.fullName}</td>
      <td class="py-3 px-4">${row.seatType}</td>
      <td class="py-3 px-4">${row.duration}</td>
      <td class="py-3 px-4 font-bold">${amountDisplay}</td>
      <td class="py-3 px-4"><span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${statusColor}">${row.status}</span></td>
      <td class="py-3 px-4 text-[10px]">${row.startTime} \u2013 ${row.endTime}</td>
      <td class="py-3 px-4 text-center">${actionHtml || "\u2013"}</td>
    `;
      tbody.appendChild(tr);
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
          <span class="font-semibold text-brand-dark text-[10px]">${row.startTime} \u2013 ${row.endTime}</span>
        </div>
      </div>
      ${actionHtml ? `<div class="pt-1">${actionHtml.replace("rounded text-[10px]", "rounded-lg text-xs w-full py-2")}</div>` : ""}
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
      const matchesStatus = status === "ALL" || status === "ACTIVE" && r.status === "ACTIVE" || status === "PENDING" && r.status === "PENDING SESSION" || status === "EXPIRED" && r.status === "EXPIRED";
      return matchesQuery && matchesStatus;
    });
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    adminState.filteredCache = filtered;
    adminState.currentPage = 1;
    renderCurrentPage();
  }
  async function approveTransaction(refNum) {
    const db2 = getDb();
    if (confirm("Approve session " + refNum + "?") && db2) {
      await db2.ref("sessions/" + refNum).update({ status: "ACTIVE" });
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
  async function archiveOldSessions() {
    const db2 = getDb();
    const DAYS = 30;
    const cutoff = Date.now() - DAYS * 24 * 60 * 60 * 1e3;
    const expired = adminState.recordsCache.filter(
      (r) => r.status === "EXPIRED" && new Date(r.timestamp).getTime() < cutoff
    );
    if (expired.length === 0) {
      alert(`No expired sessions older than ${DAYS} days found.`);
      return;
    }
    if (!confirm(`Archive ${expired.length} expired session${expired.length !== 1 ? "s" : ""} older than ${DAYS} days?

This permanently removes them from the database.`)) return;
    try {
      showLoader("Archiving...", `Removing ${expired.length} old records...`);
      const updates = {};
      expired.forEach((r) => {
        updates[`sessions/${r.referenceNumber}`] = null;
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

  // src/main.ts
  console.log("Study Hub Portal loading...");
  function init() {
    console.log("Study Hub Portal Initializing...");
    try {
      const db2 = initFirebase();
      if (window.lucide) lucide.createIcons();
      if (db2) {
        db2.ref(".info/connected").on("value", (snap) => {
          const connected = snap.val() === true;
          state.dbConnected = connected;
          updateConnectionStatus(connected);
          console.log(`Firebase Realtime Database: ${connected ? "Connected" : "Disconnected"}`);
        }, (err) => {
          console.error("Connection Check Failed:", err);
          updateConnectionStatus(false);
        });
      } else {
        updateConnectionStatus(false);
      }
      window.addEventListener("click", handleGlobalClicks, { capture: true, passive: false });
      setupListeners();
      if (localStorage.getItem("adminAuthenticated") === "true") {
        adminState.isAuthenticated = true;
        unlockAdminMode();
      }
      console.log("Study Hub Portal Ready.");
    } catch (err) {
      console.error("Initialization Failed:", err);
      const debugDiv = document.getElementById("debugStatus");
      if (debugDiv) {
        debugDiv.classList.remove("hidden");
        debugDiv.innerHTML = `\u26A0\uFE0F App Init Failed: ${err.message}`;
      }
    }
  }
  function setupListeners() {
    document.getElementById("searchName")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        checkSessionStatus();
      }
    });
    document.getElementById("adminPassword")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitAdminAuth();
      }
    });
    document.getElementById("adminTableFilter")?.addEventListener("input", filterAdminLogs);
    document.getElementById("adminStatusSelector")?.addEventListener("change", filterAdminLogs);
    document.getElementById("seatTypeSelect")?.addEventListener("change", updateFormPreview);
    document.getElementById("durationSelect")?.addEventListener("change", onDurationChange);
    document.getElementById("customHours")?.addEventListener("input", updateFormPreview);
    document.getElementById("payMethodCash")?.addEventListener("click", () => selectPaymentMethod("cash"));
    document.getElementById("payMethodOnline")?.addEventListener("click", () => selectPaymentMethod("online"));
  }
  function handleGlobalClicks(e) {
    const target = e.target.closest("button, #adminTriggerIcon");
    if (!target) return;
    const id = target.id;
    console.log("Interactive click detected:", id || target.className);
    if (id === "tabAvail") switchTab("avail");
    if (id === "tabCheck") switchTab("check");
    if (id === "btnConfirmBooking") {
      if (state.dbConnected) initiateCheckout();
      else alert("Database is currently disconnected. Please check your internet and try again.");
    }
    if (id === "btnSearchSession") {
      if (state.dbConnected) checkSessionStatus();
      else alert("Cannot search while database is disconnected.");
    }
    if (id === "btnClearSearch" || id === "btnRetrySearch") clearSearchLookup();
    if (id === "adminTriggerIcon") {
      e.stopPropagation();
      handleAdminTrigger();
    }
    if (id === "btnCancelAdminAuth") closeAdminAuth();
    if (id === "btnSubmitAdminAuth") submitAdminAuth();
    if (id === "btnCloseTicket" || id === "btnDoneTicket") closeTicketModal();
    if (id === "btnRefreshAdmin") {
      if (state.dbConnected) refreshAdminDashboard();
      else alert("Database disconnected.");
    }
    if (id === "btnArchiveLogs") {
      if (state.dbConnected) archiveOldSessions();
      else alert("Database disconnected.");
    }
    if (id === "btnPagePrev") {
      if (adminState.currentPage > 1) {
        adminState.currentPage--;
        renderCurrentPage();
      }
    }
    if (id === "btnPageNext") {
      const totalPages = Math.ceil(adminState.filteredCache.length / getPageSize());
      if (adminState.currentPage < totalPages) {
        adminState.currentPage++;
        renderCurrentPage();
      }
    }
    if (id === "btnBackToUser") exitAdminMode();
    if (target.classList.contains("btn-approve-session")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) approveTransaction(refNum);
    }
    if (target.classList.contains("btn-end-session")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) endSession(refNum);
    }
  }
  document.addEventListener("DOMContentLoaded", init);
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
})();
