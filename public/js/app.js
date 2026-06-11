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
  var firebaseConfig, PRICING, HOURLY_RATE, CLOSING_TIME;
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
    }
  });

  // src/firebase.ts
  var firebase_exports = {};
  __export(firebase_exports, {
    getDb: () => getDb,
    initFirebase: () => initFirebase,
    sessionKey: () => sessionKey
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
  function sessionKey(record) {
    return record.fullName + "_" + record.referenceNumber;
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

  // src/auto-expire.ts
  init_firebase();
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
    updateOnlineNoteVisibility();
  }
  function updateOnlineNoteVisibility() {
    const duration = document.getElementById("durationSelect").value;
    const onlineNote = document.getElementById("onlinePayNote");
    const onlineOpenTimeNote = document.getElementById("onlineOpenTimeNote");
    if (state.paymentMethod === "online") {
      if (duration === "Open Time") {
        onlineNote?.classList.add("hidden");
        onlineOpenTimeNote?.classList.remove("hidden");
      } else {
        onlineNote?.classList.remove("hidden");
        onlineOpenTimeNote?.classList.add("hidden");
      }
    } else {
      onlineNote?.classList.add("hidden");
      onlineOpenTimeNote?.classList.add("hidden");
    }
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
  function selectPaymentMethod(method) {
    state.paymentMethod = method;
    const cashBtn = document.getElementById("payMethodCash");
    const onlineBtn = document.getElementById("payMethodOnline");
    const btnLabel = document.getElementById("btnConfirmLabel");
    const active = ["border-brand-primary", "bg-brand-primary/10", "text-brand-primary"];
    const inactive = ["border-brand-border", "bg-brand-surface", "text-brand-neutral"];
    if (method === "cash") {
      cashBtn.classList.remove(...inactive);
      cashBtn.classList.add(...active);
      onlineBtn.classList.remove(...active);
      onlineBtn.classList.add(...inactive);
      if (btnLabel) btnLabel.innerHTML = "Confirm &amp; Book";
    } else {
      onlineBtn.classList.remove(...inactive);
      onlineBtn.classList.add(...active);
      cashBtn.classList.remove(...active);
      cashBtn.classList.add(...inactive);
      if (btnLabel) btnLabel.textContent = "Pay Online \u2192";
    }
    updateOnlineNoteVisibility();
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
    if (state.paymentMethod === "online" && duration !== "Open Time") {
      await initiateOnlinePayment(sessionData);
    } else {
      await initiateCashCheckout(sessionData);
    }
  }
  async function initiateCashCheckout(sessionData) {
    const db2 = getDb();
    try {
      showLoader("Processing...", "Creating your WiFi session...");
      const payMethod = state.paymentMethod === "online" ? "ONLINE" : "CASH";
      const data = { ...sessionData, status: "PENDING SESSION", paymentMethod: payMethod };
      if (db2) {
        await db2.ref("sessions/" + sessionKey(data)).set(data);
        hideLoader();
        showTicketModal(data);
      }
    } catch (error) {
      console.error("Checkout Error:", error);
      hideLoader();
      alert("Checkout failed. Check your internet connection.");
    }
  }
  async function initiateOnlinePayment(sessionData) {
    const db2 = getDb();
    try {
      showLoader("Redirecting...", "Creating your secure payment link...");
      const pendingSession = { ...sessionData, status: "AWAITING PAYMENT", paymentMethod: "ONLINE" };
      if (db2) {
        await db2.ref("sessions/" + sessionKey(pendingSession)).set(pendingSession);
      }
      const res = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData)
      });
      const result = await res.json();
      if (!res.ok || !result.invoiceUrl) {
        hideLoader();
        alert(result.error || "Failed to create payment link. Please try again.");
        return;
      }
      window.location.href = result.invoiceUrl;
    } catch (error) {
      console.error("Online payment error:", error);
      hideLoader();
      alert("Could not connect to payment gateway. Please try Cash payment instead.");
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
      await db2.ref("sessions/" + sessionKey(record)).update({ status: "EXPIRED" });
    } catch (e) {
    }
    openExtendModal(sessionKey(record), record, true);
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
      <button data-ref="${sessionKey(record)}" class="btn-extend-session w-full py-3 px-4 rounded-xl text-sm font-bold bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-primary flex items-center justify-center gap-2 transition-all">
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
      <button data-ref="${sessionKey(record)}" class="btn-customer-stop-session w-full py-3 px-4 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-2 transition-all">
        <i data-lucide="timer-off" class="w-4 h-4"></i>
        Stop My Session
      </button>`;
    } else if (isExpired && !isOpenTime) {
      timerSection = `
      <div class="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center">
        <span class="text-[10px] text-rose-600 uppercase font-bold block mb-1">Session Ended</span>
        <span class="text-sm font-semibold text-rose-700">Your time is up.</span>
      </div>
      <button data-ref="${sessionKey(record)}" class="btn-extend-session w-full py-3 px-4 rounded-xl text-sm font-bold bg-brand-primary hover:bg-brand-primary/90 text-white flex items-center justify-center gap-2 transition-all">
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
    } else if (isActive && isOpenTime) {
      const activatedTs = record.activatedAt || record.timestamp;
      setTimeout(() => startElapsedTimer(activatedTs), 50);
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
    alert(`Extension Request \u2014 Ref#: ${record.referenceNumber}

Duration: +${hoursLabel}
Amount due: \u20B1${cost.toFixed(2)}

Please proceed to the cashier desk and show this reference number. The cashier will extend your session once payment is received.`);
  }
  async function confirmExtendOnline() {
    if (!extendData) return;
    const { refNum, record } = extendData;
    const rate = record.hourlyRate || HOURLY_RATE[record.seatType] || 25;
    const selected = document.querySelector('input[name="extendDuration"]:checked');
    const hours = selected ? parseFloat(selected.value) : 1;
    const cost = Math.round(hours * rate * 100) / 100;
    const hoursLabel = hours === 0.5 ? "30 min" : `${hours}hr`;
    try {
      showLoader("Preparing...", "Setting up your extension payment...");
      const res = await fetch("/api/create-extend-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceNumber: record.referenceNumber,
          fullName: record.fullName,
          seatType: record.seatType,
          extensionHours: hours,
          amount: cost
        })
      });
      const data = await res.json();
      hideLoader();
      if (data.invoiceUrl) {
        closeExtendModal();
        window.location.href = data.invoiceUrl;
      } else {
        alert(`Could not create payment link. Please pay at the cashier desk.

Ref#: ${record.referenceNumber}
Extension: +${hoursLabel}
Amount: \u20B1${cost.toFixed(2)}`);
      }
    } catch (err) {
      hideLoader();
      console.error("Online extend payment error:", err);
      alert("Payment link creation failed. Please pay at the cashier instead.");
    }
  }
  async function stopOpenTimeSession(refNum) {
    const db2 = getDb();
    if (!db2) return;
    showLoader("Calculating...", "Computing your session billing...");
    const snapshot = await db2.ref("sessions/" + refNum).once("value");
    const record = snapshot.val();
    hideLoader();
    if (!record) return;
    const elapsedMs = Date.now() - new Date(record.activatedAt || record.timestamp).getTime();
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

Ref#: ${stopSessionData.record.referenceNumber}
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
  async function confirmStopOnline() {
    if (!stopSessionData) return;
    const { refNum, record, finalAmount, timeLabel } = stopSessionData;
    const db2 = getDb();
    if (!db2) return;
    try {
      showLoader("Preparing...", "Setting up your online payment...");
      const endTime = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      await db2.ref("sessions/" + refNum).update({
        status: "EXPIRED",
        amount: finalAmount,
        endTime,
        duration: `Open Time (${timeLabel})`
      });
      const res = await fetch("/api/create-stop-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceNumber: record.referenceNumber,
          fullName: record.fullName,
          seatType: record.seatType,
          duration: `Open Time (${timeLabel})`,
          amount: finalAmount
        })
      });
      const data = await res.json();
      hideLoader();
      if (data.invoiceUrl) {
        document.getElementById("stopSessionModal").classList.add("hidden");
        stopSessionData = null;
        window.location.href = data.invoiceUrl;
      } else {
        alert("Could not create payment link. Please pay at the cashier desk instead.\n\nRef#: " + record.referenceNumber + "\nAmount: \u20B1" + finalAmount.toFixed(2));
      }
    } catch (err) {
      hideLoader();
      console.error("Online stop payment error:", err);
      alert("Payment link creation failed. Please pay at the cashier instead.");
    }
  }

  // src/main.ts
  console.log("Study Hub Portal loading...");
  function init() {
    console.log("Study Hub Portal Initializing...");
    try {
      const db2 = initFirebase();
      if (window.lucide) lucide.createIcons();
      if (db2) {
        startAutoExpireWatcher();
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
      const savedTab = localStorage.getItem("activeTab");
      if (savedTab === "check") switchTab("check");
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
        db2.ref("sessions").orderByChild("referenceNumber").equalTo(ref).once("value").then((snap) => {
          if (snap.exists()) {
            const record = Object.values(snap.val())[0];
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
  function closeFormDropdowns() {
    document.querySelectorAll(".form-dropdown-menu").forEach((menu) => {
      menu.classList.add("hidden");
    });
  }
  function setupFormDropdowns() {
    document.addEventListener("click", () => closeFormDropdowns());
    document.getElementById("seatTypeSelect")?.addEventListener("change", updateFormPreview);
    document.getElementById("durationSelect")?.addEventListener("change", onDurationChange);
  }
  function setupListeners() {
    document.getElementById("searchName")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        checkSessionStatus();
      }
    });
    setupFormDropdowns();
    document.getElementById("customHours")?.addEventListener("input", updateFormPreview);
    document.getElementById("payMethodCash")?.addEventListener("click", () => selectPaymentMethod("cash"));
    document.getElementById("payMethodOnline")?.addEventListener("click", () => selectPaymentMethod("online"));
  }
  function handleGlobalClicks(e) {
    const target = e.target.closest("button");
    if (!target) return;
    const id = target.id;
    if (id === "seatTypeDropdownToggle" || id === "durationDropdownToggle") {
      e.stopPropagation();
      const menuId = id === "seatTypeDropdownToggle" ? "seatTypeDropdownMenu" : "durationDropdownMenu";
      const menu = document.getElementById(menuId);
      const wasOpen = menu && !menu.classList.contains("hidden");
      closeFormDropdowns();
      if (menu && !wasOpen) menu.classList.remove("hidden");
      return;
    }
    if (target.classList.contains("form-dropdown-option")) {
      e.stopPropagation();
      const selectId = target.getAttribute("data-select");
      const value = target.getAttribute("data-value") ?? "";
      const label = target.getAttribute("data-label") ?? "";
      const select = document.getElementById(selectId);
      if (select) {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const labelId = selectId === "seatTypeSelect" ? "seatTypeDropdownLabel" : "durationDropdownLabel";
      const labelEl = document.getElementById(labelId);
      if (labelEl) {
        labelEl.textContent = label;
        labelEl.classList.toggle("text-brand-neutral", !value);
        labelEl.classList.toggle("text-brand-dark", !!value);
      }
      closeFormDropdowns();
      return;
    }
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
    if (id === "btnCloseTicket" || id === "btnDoneTicket") closeTicketModal();
    if (id === "btnDownloadReceipt") {
      e.stopPropagation();
      downloadReceipt();
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
    if (id === "btnExtendPayOnline") confirmExtendOnline();
    if (target.classList.contains("btn-customer-stop-session")) {
      const refNum = target.getAttribute("data-ref");
      if (refNum && state.dbConnected) stopOpenTimeSession(refNum);
      else if (!state.dbConnected) alert("Cannot stop session while database is disconnected.");
    }
    if (id === "btnCancelStop") {
      document.getElementById("stopSessionModal").classList.add("hidden");
    }
    if (id === "btnStopPayCash") confirmStopCash();
    if (id === "btnStopPayOnline") confirmStopOnline();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
