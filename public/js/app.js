(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/config.ts
  function getPageSize() {
    return window.innerWidth < 768 ? 5 : 10;
  }
  var firebaseConfig, PRICING, HOURLY_RATE, CLOSING_TIME, ADMIN_PASSCODE, PAGE_SIZE;
  var init_config = __esm({
    "src/config.ts"() {
      firebaseConfig = {
        apiKey: "AIzaSyC6piJ_bLMZeOMZZb62PYmanilcA-JW3FM",
        authDomain: "studyhub-f1fbe.firebaseapp.com",
        projectId: "studyhub-f1fbe",
        databaseURL: "https://studyhub-f1fbe-default-rtdb.asia-southeast1.firebasedatabase.app",
        storageBucket: "studyhub-f1fbe.firebasestorage.app",
        messagingSenderId: "466465286377",
        appId: "1:466465286377:web:972eb3d4c45832933f6878"
      };
      PRICING = {
        "Table": { "1 Hour": 25, "3+1 Hours": 75 },
        "Cubicle": { "1 Hour": 50, "3+1 Hours": 150 }
      };
      HOURLY_RATE = {
        "Table": 25,
        "Cubicle": 50
      };
      CLOSING_TIME = "22:00";
      ADMIN_PASSCODE = "admin123";
      PAGE_SIZE = 10;
    }
  });

  // src/firebase.ts
  var firebase_exports = {};
  __export(firebase_exports, {
    getDb: () => getDb,
    initFirebase: () => initFirebase
  });
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
  var db;
  var init_firebase = __esm({
    "src/firebase.ts"() {
      init_config();
      db = null;
    }
  });

  // src/main.ts
  init_firebase();

  // src/state.ts
  init_config();
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
  init_config();
  var currentTicketRecord = null;
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
    localStorage.setItem("activeTab", tabId);
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
    currentTicketRecord = record;
    const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
    const isOpenTime = record.duration === "Open Time";
    const amountText = isOpenTime ? `\u20B1${rate.toFixed(2)}/hr` : `\u20B1${Number(record.amount).toFixed(2)}`;
    const instructions = isOpenTime ? `Proceed to the Study Hub cashier desk and present this Reference Number. Your session will be billed at \u20B1${rate}.00 per hour when you end your session.` : `Proceed to the Study Hub cashier desk and present this Reference Number. The cashier will receive your payment of \u20B1${Number(record.amount).toFixed(2)} and activate your session.`;
    document.getElementById("ticketRef").innerText = record.referenceNumber;
    document.getElementById("ticketName").innerText = record.fullName;
    document.getElementById("ticketHours").innerText = record.duration;
    document.getElementById("ticketAmount").innerText = amountText;
    document.getElementById("ticketInstructions").innerText = instructions;
    const methodEl = document.getElementById("ticketMethod");
    if (methodEl) methodEl.innerText = record.paymentMethod || "CASH";
    document.getElementById("ticketModal").classList.remove("hidden");
  }
  function closeTicketModal() {
    document.getElementById("ticketModal").classList.add("hidden");
    if (currentTicketRecord) {
      const name = currentTicketRecord.fullName;
      currentTicketRecord = null;
      switchTab("check");
      const searchInput = document.getElementById("searchName");
      if (searchInput) {
        searchInput.value = name;
        setTimeout(() => {
          const btnSearch = document.getElementById("btnSearchSession");
          if (btnSearch) btnSearch.click();
        }, 150);
      }
    }
  }
  function closeAdminAuth() {
    document.getElementById("adminAuthModal").classList.add("hidden");
  }
  function downloadReceipt() {
    const record = currentTicketRecord;
    if (!record) return;
    const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
    const isOpenTime = record.duration === "Open Time";
    const amountText = isOpenTime ? `\u20B1${rate.toFixed(2)}/hr (billed at end)` : `\u20B1${Number(record.amount).toFixed(2)}`;
    const W = 480;
    const H = 680;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#535C3B";
    roundRect(ctx, 0, 0, W, 110, 0);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("STUDY HUB WiFi", W / 2, 48);
    ctx.font = "13px Arial, sans-serif";
    ctx.fillStyle = "#E5D3B3";
    ctx.fillText("Official Booking Receipt", W / 2, 74);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "11px Arial, sans-serif";
    ctx.fillText((/* @__PURE__ */ new Date()).toLocaleString(), W / 2, 96);
    ctx.fillStyle = "#F4F1EC";
    roundRect(ctx, 32, 126, W - 64, 70, 12);
    ctx.fill();
    ctx.strokeStyle = "#E8E2D9";
    ctx.lineWidth = 1;
    roundRect(ctx, 32, 126, W - 64, 70, 12);
    ctx.stroke();
    ctx.fillStyle = "#707070";
    ctx.font = "10px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("REFERENCE NUMBER", W / 2, 148);
    ctx.fillStyle = "#535C3B";
    ctx.font = "bold 30px Arial, monospace";
    ctx.fillText(record.referenceNumber, W / 2, 183);
    ctx.strokeStyle = "#E8E2D9";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(32, 214);
    ctx.lineTo(W - 32, 214);
    ctx.stroke();
    ctx.setLineDash([]);
    const details = [
      ["Customer Name", record.fullName],
      ["Seat Type", record.seatType],
      ["Duration", record.duration],
      ["Date", record.bookingDate],
      ["Session Time", `${record.startTime} \u2013 ${record.endTime}`],
      ["Payment Method", record.paymentMethod || "CASH"],
      ["Amount", amountText],
      ["Status", record.status]
    ];
    ctx.textAlign = "left";
    let y = 244;
    details.forEach(([label, value], i) => {
      if (i % 2 === 0) {
        ctx.fillStyle = "#FAFAF8";
        ctx.fillRect(32, y - 14, W - 64, 34);
      }
      ctx.fillStyle = "#707070";
      ctx.font = "11px Arial, sans-serif";
      ctx.fillText(label, 48, y + 6);
      ctx.fillStyle = "#373737";
      ctx.font = label === "Amount" ? "bold 13px Arial, sans-serif" : "12px Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(value, W - 48, y + 6);
      ctx.textAlign = "left";
      y += 36;
    });
    ctx.fillStyle = "#F4F1EC";
    ctx.fillRect(0, H - 80, W, 80);
    ctx.strokeStyle = "#E8E2D9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 80);
    ctx.lineTo(W, H - 80);
    ctx.stroke();
    ctx.fillStyle = "#707070";
    ctx.font = "10px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Thank you for visiting Study Hub!", W / 2, H - 50);
    ctx.fillText("Present this reference number to the cashier.", W / 2, H - 33);
    ctx.font = "bold 10px Arial, sans-serif";
    ctx.fillStyle = "#535C3B";
    ctx.fillText("study-hub-captive-portal", W / 2, H - 14);
    const link = document.createElement("a");
    link.download = `StudyHub-Receipt-${record.referenceNumber}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
  function roundRect(ctx, x, y, w, h, r) {
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

  // src/booking.ts
  init_config();
  init_firebase();
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
    const timeGrid = document.getElementById("previewTimeGrid");
    const priceLabel = document.getElementById("previewPriceLabel");
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
    if (duration === "Open Time") {
      if (priceLabel) priceLabel.textContent = "Rate / Hour";
      document.getElementById("previewPrice").textContent = `\u20B1${amount.toFixed(2)}/hr`;
      openTimeNote?.classList.remove("hidden");
      timeGrid?.classList.add("hidden");
    } else {
      if (priceLabel) priceLabel.textContent = "Total";
      document.getElementById("previewPrice").textContent = `\u20B1${amount.toFixed(2)}`;
      openTimeNote?.classList.add("hidden");
      timeGrid?.classList.remove("hidden");
      document.getElementById("previewStart").textContent = times.startTime;
      document.getElementById("previewEnd").textContent = times.endTime;
    }
    if (window.lucide) lucide.createIcons();
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
    await initiateCashCheckout(sessionData);
  }
  async function initiateCashCheckout(sessionData) {
    const db2 = getDb();
    try {
      showLoader("Processing...", "Creating your WiFi session...");
      const data = { ...sessionData, status: "PENDING SESSION", paymentMethod: "CASH" };
      if (db2) {
        await db2.ref("sessions/" + data.referenceNumber).set(data);
        hideLoader();
        openQRPaymentModal(data);
      }
    } catch (error) {
      console.error("Checkout Error:", error);
      hideLoader();
      alert("Checkout failed. Check your internet connection.");
    }
  }

  // src/session.ts
  init_config();
  init_firebase();
  var countdownInterval = null;
  var elapsedInterval = null;
  var autoExpireHandled = false;
  var currentViewingRecord = null;
  var stopSessionData = null;
  var extendData = null;
  function clearCountdown() {
    if (countdownInterval !== null) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (elapsedInterval !== null) {
      clearInterval(elapsedInterval);
      elapsedInterval = null;
    }
  }
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
  async function autoExpireAndOfferExtend(record) {
    const db2 = getDb();
    if (!db2) return;
    try {
      await db2.ref("sessions/" + record.referenceNumber).update({ status: "EXPIRED" });
    } catch (e) {
    }
    openExtendModal(record.referenceNumber, record, true);
  }
  function startCountdown(endTime, bookingDate) {
    clearCountdown();
    autoExpireHandled = false;
    function tick() {
      const end = parseSessionTime(endTime, bookingDate);
      const remaining = end.getTime() - Date.now();
      const countdownEl = document.getElementById("sessionCountdown");
      const warningEl = document.getElementById("sessionWarningBanner");
      if (!countdownEl) {
        clearCountdown();
        return;
      }
      if (remaining <= 0) {
        countdownEl.textContent = "00:00";
        warningEl?.classList.remove("hidden");
        clearCountdown();
        if (!autoExpireHandled && currentViewingRecord) {
          autoExpireHandled = true;
          autoExpireAndOfferExtend(currentViewingRecord);
        }
        return;
      }
      const totalSecs = Math.floor(remaining / 1e3);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      countdownEl.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
      if (remaining <= 5 * 60 * 1e3) {
        warningEl?.classList.remove("hidden");
        countdownEl.classList.add("text-rose-600", "animate-pulse");
      } else {
        warningEl?.classList.add("hidden");
        countdownEl.classList.remove("text-rose-600", "animate-pulse");
      }
    }
    tick();
    countdownInterval = setInterval(tick, 1e3);
  }
  function startElapsedTimer(startTimestamp) {
    clearCountdown();
    function tick() {
      const el = document.getElementById("sessionElapsed");
      if (!el) {
        clearCountdown();
        return;
      }
      const elapsedMs = Date.now() - new Date(startTimestamp).getTime();
      const totalSecs = Math.floor(elapsedMs / 1e3);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor(totalSecs % 3600 / 60);
      const secs = totalSecs % 60;
      el.textContent = hrs > 0 ? `${hrs}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s` : `${mins}m ${secs.toString().padStart(2, "0")}s`;
    }
    tick();
    elapsedInterval = setInterval(tick, 1e3);
  }
  async function checkSessionStatus() {
    clearCountdown();
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
    currentViewingRecord = record;
    autoExpireHandled = false;
    const resultsDiv = document.getElementById("checkResultContainer");
    const statusColor = record.status === "ACTIVE" ? "text-emerald-600 bg-emerald-50 border-emerald-200" : record.status === "PENDING SESSION" ? "text-amber-600 bg-amber-50 border-amber-200" : "text-brand-neutral bg-brand-light border-brand-border";
    const isOpenTime = record.duration === "Open Time" || record.duration.startsWith("Open Time");
    const isActive = record.status === "ACTIVE";
    const isExpired = record.status === "EXPIRED";
    const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
    const amountDisplay = isOpenTime && isActive ? `\u20B1${rate}/hr` : `\u20B1${Number(record.amount).toFixed(2)}`;
    let timerSection = "";
    if (isActive && !isOpenTime && record.endTime) {
      timerSection = `
      <div id="sessionWarningBanner" class="hidden p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs font-semibold text-rose-700 animate-pulse">
        <i data-lucide="alarm-clock" class="w-4 h-4 shrink-0"></i>
        <span>Your session is almost over! Please prepare to wrap up or extend.</span>
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
      <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
        <span class="text-[10px] text-emerald-700 uppercase font-bold block mb-1">Time Remaining</span>
        <span id="sessionCountdown" class="text-3xl font-extrabold font-['Outfit'] text-emerald-700 block digital-clock">--:--</span>
      </div>
      <button data-ref="${record.referenceNumber}" class="btn-extend-session w-full py-3 px-4 rounded-xl text-sm font-bold bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-primary flex items-center justify-center gap-2 transition-all">
        <i data-lucide="clock-arrow-up" class="w-4 h-4"></i>
        Extend Session
      </button>`;
    } else if (isActive && isOpenTime) {
      timerSection = `
      <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center">
        <span class="text-[10px] text-amber-700 uppercase font-bold block mb-1">Time Elapsed</span>
        <span id="sessionElapsed" class="text-2xl font-extrabold font-['Outfit'] text-amber-700 block digital-clock">0m 00s</span>
        <span class="text-[10px] text-amber-600 mt-1 block">Billing at \u20B1${rate}/hr \u2014 15-min increments</span>
      </div>
      <button data-ref="${record.referenceNumber}" class="btn-customer-stop-session w-full py-3 px-4 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-2 transition-all">
        <i data-lucide="timer-off" class="w-4 h-4"></i>
        Stop My Session
      </button>`;
    } else if (isExpired && !isOpenTime) {
      timerSection = `
      <div class="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center">
        <span class="text-[10px] text-rose-600 uppercase font-bold block mb-1">Session Ended</span>
        <span class="text-sm font-semibold text-rose-700">Your time is up.</span>
      </div>
      <button data-ref="${record.referenceNumber}" class="btn-extend-session w-full py-3 px-4 rounded-xl text-sm font-bold bg-brand-primary hover:bg-brand-primary/90 text-white flex items-center justify-center gap-2 transition-all">
        <i data-lucide="clock-arrow-up" class="w-4 h-4"></i>
        Extend &amp; Continue
      </button>`;
    } else {
      timerSection = `
      <div class="grid grid-cols-2 gap-3">
        <div class="p-3 bg-brand-light rounded-xl border border-brand-border text-center">
          <span class="text-[9px] text-brand-neutral uppercase block mb-1">Start</span>
          <span class="text-sm font-bold text-brand-dark font-mono">${record.startTime}</span>
        </div>
        <div class="p-3 bg-brand-light rounded-xl border border-brand-border text-center">
          <span class="text-[9px] text-brand-neutral uppercase block mb-1">End</span>
          <span class="text-sm font-bold text-brand-dark font-mono">${record.endTime}</span>
        </div>
      </div>`;
    }
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
          <span class="text-brand-neutral">${isOpenTime && isActive ? "Rate" : "Amount"}</span>
          <span class="font-black font-['Outfit'] text-brand-primary text-lg">${amountDisplay}</span>
        </div>
      </div>
      ${timerSection}
      <button id="btnClearSearch" class="w-full py-3 px-4 rounded-xl text-xs font-bold bg-brand-light border border-brand-border hover:bg-brand-secondary/20 text-brand-dark transition-all">Search Again</button>
    </div>
  `;
    if (window.lucide) lucide.createIcons();
    if (isActive && !isOpenTime && record.endTime) {
      setTimeout(() => startCountdown(record.endTime, record.bookingDate), 50);
    } else if (isActive && isOpenTime && record.timestamp) {
      setTimeout(() => startElapsedTimer(record.timestamp), 50);
    }
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
        <p class="text-xs text-brand-neutral mt-1">No session found for "<strong>${name}</strong>".</p>
      </div>
      <button id="btnRetrySearch" class="mt-2 px-4 py-2 text-xs font-bold rounded-lg bg-brand-light border border-brand-border hover:bg-brand-secondary/20 text-brand-dark transition-all">Try Again</button>
    </div>
  `;
    if (window.lucide) lucide.createIcons();
  }
  function clearSearchLookup() {
    clearCountdown();
    currentViewingRecord = null;
    document.getElementById("searchName").value = "";
    document.getElementById("checkResultContainer").classList.add("hidden");
    document.getElementById("checkEmptyState").classList.remove("hidden");
  }
  function openExtendModal(refNum, record, isExpired = false) {
    extendData = { refNum, record };
    const titleEl = document.getElementById("extendModalTitle");
    const subtitleEl = document.getElementById("extendModalSubtitle");
    if (titleEl) titleEl.textContent = isExpired ? "Time's Up! Extend?" : "Extend Your Session";
    if (subtitleEl) subtitleEl.textContent = isExpired ? "Your session has ended. Pay to extend and keep your seat." : "Add more time to your current session.";
    const defaultRadio = document.querySelector('input[name="extendDuration"][value="1"]');
    if (defaultRadio) defaultRadio.checked = true;
    updateExtendCostPreview();
    document.getElementById("extendSessionModal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  }
  function closeExtendModal() {
    document.getElementById("extendSessionModal").classList.add("hidden");
    extendData = null;
  }
  function updateExtendCostPreview() {
    if (!extendData) return;
    const { record } = extendData;
    const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
    const selected = document.querySelector('input[name="extendDuration"]:checked');
    const hours = selected ? parseFloat(selected.value) : 1;
    const cost = Math.round(hours * rate * 100) / 100;
    const label = hours === 0.5 ? "30 minutes" : `${hours} hour${hours > 1 ? "s" : ""}`;
    const costEl = document.getElementById("extendCostPreview");
    const labelEl = document.getElementById("extendDurationLabel");
    const rateEl = document.getElementById("extendRateNote");
    if (costEl) costEl.textContent = `\u20B1${cost.toFixed(2)}`;
    if (labelEl) labelEl.textContent = `+${label}`;
    if (rateEl) rateEl.textContent = `\u20B1${rate}/hr \u2014 ${record.seatType}`;
  }
  async function confirmExtendCash() {
    if (!extendData) return;
    const { refNum, record } = extendData;
    const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
    const selected = document.querySelector('input[name="extendDuration"]:checked');
    const hours = selected ? parseFloat(selected.value) : 1;
    const cost = Math.round(hours * rate * 100) / 100;
    const hoursLabel = hours === 0.5 ? "30 min" : `${hours}hr`;
    closeExtendModal();
    alert(`Extension Request \u2014 Ref#: ${refNum}

Duration: +${hoursLabel}
Amount due: \u20B1${cost.toFixed(2)}

Please proceed to the cashier desk and show this reference number. The cashier will extend your session once payment is received.`);
  }
  async function stopOpenTimeSession(refNum) {
    const db2 = getDb();
    if (!db2) return;
    showLoader("Calculating...", "Computing your session billing...");
    const snapshot = await db2.ref("sessions/" + refNum).once("value");
    const record = snapshot.val();
    hideLoader();
    if (!record) return;
    const elapsedMs = Date.now() - new Date(record.timestamp).getTime();
    const elapsedHours = elapsedMs / (1e3 * 60 * 60);
    const roundedHours = Math.max(0.25, Math.ceil(elapsedHours * 4) / 4);
    const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
    const finalAmount = Math.round(roundedHours * rate * 100) / 100;
    const hrs = Math.floor(roundedHours);
    const mins = Math.round((roundedHours - hrs) * 60);
    const timeLabel = `${hrs > 0 ? hrs + "h " : ""}${mins > 0 ? mins + "m" : ""}`.trim() || "15m";
    stopSessionData = { refNum, record, finalAmount, timeLabel };
    const stopTimeEl = document.getElementById("stopTimeUsed");
    const stopAmtEl = document.getElementById("stopAmountDue");
    if (stopTimeEl) stopTimeEl.textContent = timeLabel;
    if (stopAmtEl) stopAmtEl.textContent = `\u20B1${finalAmount.toFixed(2)}`;
    document.getElementById("stopSessionModal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  }
  async function confirmStopCash() {
    if (!stopSessionData) return;
    const { refNum, finalAmount, timeLabel } = stopSessionData;
    const db2 = getDb();
    if (!db2) return;
    try {
      showLoader("Stopping...", "Ending your session...");
      const endTime = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      await db2.ref("sessions/" + refNum).update({
        status: "EXPIRED",
        amount: finalAmount,
        endTime,
        duration: `Open Time (${timeLabel})`
      });
      hideLoader();
      document.getElementById("stopSessionModal").classList.add("hidden");
      stopSessionData = null;
      alert(`Session stopped.

Ref#: ${refNum}
Time Used: ${timeLabel}
Amount Due: \u20B1${finalAmount.toFixed(2)}

Please proceed to the cashier desk to complete your payment.`);
      clearSearchLookup();
    } catch (err) {
      hideLoader();
      console.error("Stop session error:", err);
      alert("Failed to stop session. Please try again.");
    }
  }

  // ============================================================
  // QR PAYMENT MODAL
  // CONFIG: Set QR image paths below to your actual QR code images.
  // Place your QR images in /public/img/ and update paths here.
  // ============================================================
  var QR_CONFIG = {
    gcash:   { label: "GCash — Scan to Pay",        image: "/img/qr-gcash.png"   },
    paymaya: { label: "PayMaya / Maya — Scan to Pay", image: "/img/qr-paymaya.png" }
  };
  var _pendingQRRecord = null;
  function openQRPaymentModal(record) {
    _pendingQRRecord = record;
    document.getElementById("qrStep1").classList.remove("hidden");
    document.getElementById("qrStep2").classList.add("hidden");
    document.getElementById("qrStep3").classList.add("hidden");
    document.getElementById("qrPaymentModal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  }
  function selectQRMethod(method) {
    if (method === "other") {
      showQRStep3();
      return;
    }
    const config = QR_CONFIG[method];
    const imgEl = document.getElementById("qrCodeImage");
    const titleEl = document.getElementById("qrStep2Title");
    if (imgEl && config) imgEl.src = config.image;
    if (titleEl && config) titleEl.textContent = config.label;
    document.getElementById("qrStep1").classList.add("hidden");
    document.getElementById("qrStep2").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  }
  function showQRStep3() {
    document.getElementById("qrStep1").classList.add("hidden");
    document.getElementById("qrStep2").classList.add("hidden");
    document.getElementById("qrStep3").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  }
  function closeQRAndViewSession() {
    document.getElementById("qrPaymentModal").classList.add("hidden");
    if (_pendingQRRecord) {
      const name = _pendingQRRecord.fullName;
      _pendingQRRecord = null;
      switchTab("check");
      const searchInput = document.getElementById("searchName");
      if (searchInput) {
        searchInput.value = name;
        setTimeout(() => {
          const btnSearch = document.getElementById("btnSearchSession");
          if (btnSearch) btnSearch.click();
        }, 150);
      }
    }
  }

  // src/admin.ts
  init_config();
  init_firebase();
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
        actionHtml = `
        <div class="flex flex-col gap-1">
          <button data-ref="${row.referenceNumber}" class="btn-end-session px-3 py-1 bg-rose-500 text-white rounded text-[10px] font-semibold">${isOpenTime ? "End & Bill" : "End"}</button>
          ${!isOpenTime ? `<button data-ref="${row.referenceNumber}" class="btn-admin-extend px-3 py-1 bg-brand-primary/10 border border-brand-primary/30 text-brand-primary rounded text-[10px] font-semibold whitespace-nowrap">Extend</button>` : ""}
        </div>`;
      } else if (row.status === "AWAITING PAYMENT") {
        actionHtml = `
        <div class="flex flex-col gap-1">
          <button data-ref="${row.referenceNumber}" class="btn-mark-paid px-3 py-1 bg-emerald-600 text-white rounded text-[10px] font-semibold whitespace-nowrap">Mark Paid</button>
          <button data-ref="${row.referenceNumber}" class="btn-cancel-awaiting px-3 py-1 bg-rose-100 text-rose-600 border border-rose-200 rounded text-[10px] font-semibold whitespace-nowrap">Cancel</button>
        </div>`;
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
  function toggleAdminActionsDropdown() {
    const dropdown = document.getElementById("adminActionsDropdown");
    const chevron = document.getElementById("adminActionsChevron");
    const isHidden = dropdown.classList.contains("hidden");
    if (isHidden) {
      dropdown.classList.remove("hidden");
      chevron?.classList.add("rotate-180");
    } else {
      closeAdminActionsDropdown();
    }
  }
  function closeAdminActionsDropdown() {
    const dropdown = document.getElementById("adminActionsDropdown");
    const chevron = document.getElementById("adminActionsChevron");
    dropdown?.classList.add("hidden");
    chevron?.classList.remove("rotate-180");
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

  // src/main.ts
  init_config();
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
      window.updateExtendPreview = () => {
        updateExtendCostPreview();
        document.querySelectorAll(".extend-option").forEach((opt) => {
          const radio = opt.querySelector('input[type="radio"]');
          const card = opt.querySelector(".extend-label");
          if (!card) return;
          if (radio?.checked) {
            card.classList.add("border-brand-primary", "bg-brand-primary/5");
            card.classList.remove("border-brand-border", "bg-brand-light");
          } else {
            card.classList.remove("border-brand-primary", "bg-brand-primary/5");
            card.classList.add("border-brand-border", "bg-brand-light");
          }
        });
      };
      setupListeners();
      if (localStorage.getItem("adminAuthenticated") === "true") {
        adminState.isAuthenticated = true;
        unlockAdminMode();
      } else {
        const savedTab = localStorage.getItem("activeTab");
        if (savedTab === "check") switchTab("check");
      }
      handleUrlParams();
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
  function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const ref = params.get("ref");
    if (tab === "check" && ref) {
      const db2 = getDb();
      if (db2) {
        switchTab("check");
        db2.ref("sessions/" + ref).once("value").then((snap) => {
          if (snap.exists()) {
            const record = snap.val();
            const searchInput = document.getElementById("searchName");
            if (searchInput && record.fullName) {
              searchInput.value = record.fullName;
              setTimeout(() => {
                const btn = document.getElementById("btnSearchSession");
                if (btn) btn.click();
              }, 300);
            }
          }
        }).catch(() => {
          switchTab("check");
        });
      }
      window.history.replaceState({}, document.title, "/");
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
  }
  function handleGlobalClicks(e) {
    if (!document.getElementById("adminActionsMenu")?.contains(e.target)) {
      closeAdminActionsDropdown();
    }
    const target = e.target.closest("button, #adminTriggerIcon");
    if (!target) return;
    const id = target.id;
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
    if (id === "btnDownloadReceipt") {
      e.stopPropagation();
      downloadReceipt();
    }
    if (id === "btnRefreshAdmin") {
      closeAdminActionsDropdown();
      if (state.dbConnected) refreshAdminDashboard();
      else alert("Database disconnected.");
    }
    if (id === "btnArchiveLogs") {
      closeAdminActionsDropdown();
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
    if (target.classList.contains("btn-mark-paid")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) markAwaitingAsPaid(refNum);
      else if (!state.dbConnected) alert("Database disconnected.");
    }
    if (target.classList.contains("btn-cancel-awaiting")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) cancelAwaitingPayment(refNum);
      else if (!state.dbConnected) alert("Database disconnected.");
    }
    if (id === "btnAdminActions") toggleAdminActionsDropdown();
    if (id === "btnSalesReport") { closeAdminActionsDropdown(); openSalesReportModal(); }
    if (id === "btnCloseSalesReport") closeSalesReportModal();
    if (id === "btnDownloadSalesReport") downloadSalesReport();
    if (target.classList.contains("btn-admin-extend")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) extendSessionAdmin(refNum);
      else if (!state.dbConnected) alert("Database disconnected.");
    }
    if (target.classList.contains("btn-extend-session")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) {
        Promise.resolve().then(() => (init_firebase(), firebase_exports)).then(({ getDb: getDb2 }) => {
          const db2 = getDb2();
          if (!db2) return;
          db2.ref("sessions/" + refNum).once("value").then((snap) => {
            const rec = snap.val();
            if (rec) openExtendModal(refNum, rec, rec.status === "EXPIRED");
          });
        });
      } else if (!state.dbConnected) alert("Database disconnected.");
    }
    if (id === "btnCloseExtend") closeExtendModal();
    if (id === "btnExtendPayCash") confirmExtendCash();
    if (target.classList.contains("btn-customer-stop-session")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) stopOpenTimeSession(refNum);
      else if (!state.dbConnected) alert("Cannot stop session while database is disconnected.");
    }
    if (id === "btnCancelStop") {
      document.getElementById("stopSessionModal").classList.add("hidden");
    }
    if (id === "btnStopPayCash") {
      confirmStopCash();
    }
    if (target.classList.contains("qr-method-btn")) {
      const method = target.getAttribute("data-method");
      if (method) selectQRMethod(method);
    }
    if (id === "btnQRDonePayment") showQRStep3();
    if (id === "btnQRBack") {
      document.getElementById("qrStep2").classList.add("hidden");
      document.getElementById("qrStep1").classList.remove("hidden");
      if (window.lucide) lucide.createIcons();
    }
    if (id === "btnQRViewSession") closeQRAndViewSession();
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
