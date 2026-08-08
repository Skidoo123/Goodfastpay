// Goodfastpay Platform - Customer Portal Controller JS

let currentUser = null;
let currentDB = null;
let currentBuyBrandFilter = "ALL";
let lastUnreadCount = null;

// Initialize on DOM Load
window.addEventListener("DOMContentLoaded", () => {
    initTheme();
    loadSession();
    
    // Listen for live system notifications
    window.addEventListener('goodfastpay_notification', (e) => {
        if (e.detail.userId === currentUser.email) {
            loadSession(); // reload data
            showToast(`New Notification: ${e.detail.notification.title}`, "info");
        }
    });

    // Listen for cross-tab storage updates to synchronize database state instantly
    window.addEventListener('storage', (e) => {
        if (e.key === 'goodfastpay_db') {
            const db = getDB();
            const session = getSessionUser();
            if (session && db.users[session.email]) {
                const status = db.users[session.email].status;
                if (status === "SUSPENDED") {
                    clearSession();
                    window.location.href = "index.html?suspended=true";
                    return;
                } else if (status === "BANNED") {
                    clearSession();
                    window.location.href = "index.html?banned=true";
                    return;
                }
            }
            loadSession();
        }
    });

    // Populate dynamic drop downs on Sell Card tab
    populateSellOptions();
    initBankDropdown();
    setupUserSupportRealTimeCheck();

    // Hook up form submissions and brand listeners defensively after DOM load
    const sellBrandEl = document.getElementById("sell-brand");
    if (sellBrandEl) {
        sellBrandEl.addEventListener("change", updateSellCurrencyOptions);
    }
    
    const cardForm = document.getElementById("card-submission-form");
    if (cardForm) cardForm.addEventListener("submit", handleCardSubmit);
    
    const withdrawForm = document.getElementById("withdrawal-request-form");
    if (withdrawForm) withdrawForm.addEventListener("submit", handleWithdrawalSubmit);
    
    const bankForm = document.getElementById("bank-settings-form");
    if (bankForm) bankForm.addEventListener("submit", handleBankUpdate);
    
    const passwordForm = document.getElementById("password-settings-form");
    if (passwordForm) passwordForm.addEventListener("submit", handlePasswordUpdate);
    
    const pinForm = document.getElementById("pin-settings-form");
    if (pinForm) pinForm.addEventListener("submit", handlePinUpdate);
});

// Security validation helper simulating API endpoint middleware guards
function validateUserStatusActive() {
    const db = getDB();
    const session = getSessionUser();
    if (!session) {
        window.location.href = "index.html";
        return false;
    }
    const user = db.users[session.email];
    if (!user) {
        window.location.href = "index.html";
        return false;
    }
    if (user.status === "SUSPENDED") {
        clearSession();
        window.location.href = "index.html?suspended=true";
        return false;
    }
    if (user.status === "BANNED") {
        clearSession();
        window.location.href = "index.html?banned=true";
        return false;
    }
    return true;
}

// Load user details
function loadSession() {
    currentUser = getSessionUser();
    currentDB = getDB();
    
    if (!currentUser) {
        window.location.href = "index.html";
        return;
    }
    
    // Check if user is suspended or banned in the database (source of truth)
    if (currentDB.users[currentUser.email]) {
        const dbUser = currentDB.users[currentUser.email];
        if (dbUser.status === "SUSPENDED") {
            clearSession();
            window.location.href = "index.html?suspended=true";
            return;
        } else if (dbUser.status === "BANNED") {
            clearSession();
            window.location.href = "index.html?banned=true";
            return;
        }
    }
    
    if (currentUser.role === "ADMIN") {
        window.location.href = "admin.html";
        return;
    }
    
    // Update Welcome title
    document.getElementById("welcome-title").textContent = `Welcome back, ${currentUser.name}!`;
    
    populateSellOptions();
    populateBuyCountryFilters();
    
    // Check and update Bank Account details warning banners
    updateBankWarningBanners();
    
    // Render all stats
    updateDashboardStats();
    
    // Render lists
    renderTransactionTable();
    renderSellHistory();
    renderWithdrawHistory();
    renderBuyStockTable();
    renderPurchasedHistoryTable();
    renderNotifications();
    renderSecurityLogs();
    
    // Update tab title and play notification sound if new notification arrives
    const unreadCount = currentUser.notifications ? currentUser.notifications.filter(n => !n.read).length : 0;
    if (lastUnreadCount !== null && unreadCount > lastUnreadCount) {
        playNotificationSound();
    }
    lastUnreadCount = unreadCount;
    
    if (unreadCount > 0) {
        document.title = `(${unreadCount}) Goodfastpay - Customer Portal`;
    } else {
        document.title = "Goodfastpay - Customer Portal";
    }

    // Attach Cloud Firestore Realtime Sync Listener
    initPortalFirestoreListeners();
}

let isFirestoreListening = false;
function initPortalFirestoreListeners() {
    if (isFirestoreListening || !currentUser) return;
    if (typeof listenToUserCloudUpdates === "function") {
        listenToUserCloudUpdates(currentUser.email, (cloudUser) => {
            console.log("⚡ Realtime cloud update received for user profile");
            loadSession();
        });
    }
    if (typeof listenToCollectionCloudUpdates === "function") {
        listenToCollectionCloudUpdates("submissions", () => {
            loadSession();
        });
        listenToCollectionCloudUpdates("tickets", () => {
            if (typeof renderUserTickets === "function") renderUserTickets();
        });
    }
    isFirestoreListening = true;
}

// Side drawer toggling for mobile layout
function toggleSidebar() {
    const sidebar = document.getElementById("portal-sidebar");
    const overlay = document.getElementById("portal-sidebar-overlay");
    if (sidebar) sidebar.classList.toggle("active");
    if (overlay) overlay.classList.toggle("active");
}

// Switch between workspace tabs
function switchSection(sectionId, element) {
    // Hide all sections
    const sections = document.querySelectorAll(".portal-section");
    sections.forEach(sec => sec.classList.remove("active"));
    
    // Show selected section
    const targetSection = document.getElementById(`section-${sectionId}`);
    if (targetSection) targetSection.classList.add("active");
    
    // Update active class on sidebar links
    const links = document.querySelectorAll(".sidebar-link");
    links.forEach(lnk => lnk.classList.remove("active"));
    
    if (element) {
        element.classList.add("active");
    } else {
        const matchingLink = Array.from(links).find(lnk => lnk.getAttribute("onclick") && lnk.getAttribute("onclick").includes(`'${sectionId}'`));
        if (matchingLink) matchingLink.classList.add("active");
    }
    
    // Close sidebar and overlay on mobile
    const sidebar = document.getElementById("portal-sidebar");
    const overlay = document.getElementById("portal-sidebar-overlay");
    if (sidebar) sidebar.classList.remove("active");
    if (overlay) overlay.classList.remove("active");
    
    // Special section-based triggers
    if (sectionId === "withdraw") {
        populateWithdrawConfirmDetails();
    } else if (sectionId === "bank") {
        prepopulateBankForm();
    } else if (sectionId === "support") {
        loadSupportPortal();
    }
}

// Check if user has bank account details linked
function updateBankWarningBanners() {
    const db = getDB();
    const user = db.users[currentUser.email];
    
    const dashWarning = document.getElementById("dashboard-bank-warning");
    const withdrawWarning = document.getElementById("withdraw-bank-warning");
    const withdrawWorkspace = document.getElementById("withdraw-workspace");
    
    if (!user.bankDetails) {
        if (dashWarning) dashWarning.style.display = "flex";
        if (withdrawWarning) withdrawWarning.style.display = "flex";
        if (withdrawWorkspace) withdrawWorkspace.style.display = "none";
    } else {
        if (dashWarning) dashWarning.style.display = "none";
        if (withdrawWarning) withdrawWarning.style.display = "none";
        if (withdrawWorkspace) withdrawWorkspace.style.display = "grid";
    }
}

// Calculate wallets totals
function updateDashboardStats() {
    const db = getDB();
    const user = db.users[currentUser.email];
    
    // Calculate pending balance from pending card submissions
    let pending = 0;
    const userSubmissions = db.submissions.filter(sub => sub.userId === user.email);
    userSubmissions.forEach(sub => {
        if (sub.status === "PENDING") {
            // Estimate pending payout based on current rate
            const rateMap = db.settings.rates[sub.brand];
            const rate = (rateMap && rateMap[sub.currency]) ? rateMap[sub.currency] : 0;
            pending += sub.cardValue * rate;
        }
    });
    
    // Save calculated pending balance locally
    user.wallet.pendingBalance = pending;
    db.users[user.email] = user;
    saveDB(db);
    
    // Available Balance display
    const balanceText = "₦" + user.wallet.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const isHidden = localStorage.getItem("hideBalance") === "true";
    
    const balanceEl = document.getElementById("stat-wallet-balance");
    if (balanceEl) {
        balanceEl.textContent = isHidden ? "₦••••••••" : balanceText;
    }
    const balanceHeroEl = document.getElementById("stat-wallet-balance-hero");
    if (balanceHeroEl) {
        balanceHeroEl.textContent = isHidden ? "₦••••••••" : balanceText;
    }
    
    updateBalanceIconState(isHidden);
    
    // Pending Balance display
    document.getElementById("stat-pending-balance").textContent = "₦" + pending.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    // Card Trades Counter
    document.getElementById("stat-card-trades").textContent = userSubmissions.length;
    
    // Completed Withdrawals Counter
    const userWithdrawals = db.withdrawals.filter(wd => wd.userId === user.email && wd.status === "COMPLETED");
    const statWithdrawalsEl = document.getElementById("stat-withdrawals");
    if (statWithdrawalsEl) {
        statWithdrawalsEl.textContent = userWithdrawals.length;
    }
    
    // Total Purchases Counter
    const userPurchases = db.inventory ? db.inventory.filter(item => item.status === "SOLD" && item.purchasedBy === user.email) : [];
    const statPurchasesEl = document.getElementById("stat-purchases");
    if (statPurchasesEl) {
        statPurchasesEl.textContent = userPurchases.length;
    }
    
    // Update notifications count badge in sidebar
    const unreadCount = user.notifications.filter(n => !n.read).length;
    const countBadge = document.getElementById("nav-notif-count");
    if (unreadCount > 0) {
        countBadge.textContent = unreadCount;
        countBadge.style.display = "inline-flex";
    } else {
        countBadge.style.display = "none";
    }
}

// Populate Selling dropdown elements
function populateSellOptions() {
    const db = getDB();
    const rates = db.settings.rates;
    
    const brandSelect = document.getElementById("sell-brand");
    if (!brandSelect) return;
    
    // Save selected brand to restore later
    const selectedBrand = brandSelect.value;
    
    brandSelect.innerHTML = "";
    
    Object.keys(GIFT_CARD_CATEGORIES).forEach(category => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = category;
        
        GIFT_CARD_CATEGORIES[category].forEach(brand => {
            if (rates[brand]) {
                const opt = document.createElement("option");
                opt.value = brand;
                opt.textContent = brand;
                optgroup.appendChild(opt);
            }
        });
        
        if (optgroup.children.length > 0) {
            brandSelect.appendChild(optgroup);
        }
    });
    
    // Restore selection if still exists
    if (selectedBrand) {
        brandSelect.value = selectedBrand;
    }
    
    updateSellCurrencyOptions();
}

function updateSellCurrencyOptions() {
    const db = getDB();
    const rates = db.settings.rates;
    const brandSelect = document.getElementById("sell-brand");
    const selectedBrand = brandSelect ? brandSelect.value : "";
    const currencySelect = document.getElementById("sell-currency");
    
    if (!currencySelect) return;
    const selectedCurr = currencySelect.value;
    currencySelect.innerHTML = "";
    
    const activeCurrencies = db.currencies || {};
    
    if (selectedBrand && rates[selectedBrand]) {
        Object.keys(rates[selectedBrand]).forEach(curr => {
            let isAllowed = true;
            if (curr === "USD" || curr === "USA" || ["Canada", "Australia", "Switzerland (CHF)", "Japan (JPY)", "China (CNY)", "Hong Kong (HKD)", "Singapore (SGD)", "New Zealand (NZD)", "UAE (AED)", "Saudi Arabia (SAR)", "South Africa (ZAR)", "India (INR)"].includes(curr)) {
                isAllowed = activeCurrencies["USD"] ? activeCurrencies["USD"].status === "ACTIVE" : true;
            } else if (curr === "EUR" || curr === "Europe (EUR)" || ["Germany", "France", "Italy", "Spain", "Netherlands", "UK"].includes(curr)) {
                isAllowed = activeCurrencies["EUR"] ? activeCurrencies["EUR"].status === "ACTIVE" : true;
            } else if (curr === "NGN") {
                isAllowed = activeCurrencies["NGN"] ? activeCurrencies["NGN"].status === "ACTIVE" : true;
            } else if (activeCurrencies[curr]) {
                isAllowed = activeCurrencies[curr].status === "ACTIVE";
            }
            
            if (isAllowed) {
                const opt = document.createElement("option");
                opt.value = curr;
                opt.textContent = curr;
                currencySelect.appendChild(opt);
            }
        });
    }
    
    // Restore selected currency if still exists in the new list
    if (selectedCurr && Array.from(currencySelect.options).some(o => o.value === selectedCurr)) {
        currencySelect.value = selectedCurr;
    }
    
    updateSellRate();
}

// Populate Buy Gift Card country filter options dynamically
function populateBuyCountryFilters() {
    const db = getDB();
    const filter = document.getElementById("buy-country-filter");
    if (!filter) return;
    
    const selectedFilter = filter.value;
    
    const activeCurrencies = db.currencies || {};
    const hasUSD = activeCurrencies["USD"] ? activeCurrencies["USD"].status === "ACTIVE" : true;
    const hasEUR = activeCurrencies["EUR"] ? activeCurrencies["EUR"].status === "ACTIVE" : true;
    
    let html = `<option value="ALL">All Regions</option>`;
    if (hasUSD) {
        html += `
            <option value="USA">USA</option>
            <option value="Canada">Canada</option>
            <option value="Australia">Australia</option>
        `;
    }
    if (hasEUR) {
        html += `
            <option value="Europe (EUR)">Europe</option>
            <option value="UK">UK</option>
        `;
    }
    
    Object.keys(activeCurrencies).forEach(code => {
        if (code !== "USD" && code !== "EUR" && code !== "NGN") {
            if (activeCurrencies[code].status === "ACTIVE") {
                html += `<option value="${code}">${code}</option>`;
            }
        }
    });
    
    filter.innerHTML = html;
    
    if (selectedFilter && Array.from(filter.options).some(o => o.value === selectedFilter)) {
        filter.value = selectedFilter;
    }
}

// Update live estimation rate in trade workspace
function updateSellRate() {
    const db = getDB();
    const rates = db.settings.rates;
    const brandSelect = document.getElementById("sell-brand");
    const currencySelect = document.getElementById("sell-currency");
    const valueInput = document.getElementById("sell-value");
    
    if (!brandSelect || !currencySelect || !valueInput) return;
    
    const brand = brandSelect.value;
    const currency = currencySelect.value;
    
    let val = parseFloat(valueInput.value);
    if (isNaN(val) || val <= 0) val = 0;
    
    let rate = 0;
    if (brand && currency && rates[brand] && rates[brand][currency]) {
        rate = rates[brand][currency];
    }
    
    const payout = val * rate;
    
    const symbol = getCurrencySymbol(currency);
    
    const exchangeTextEl = document.getElementById("sell-exchange-text");
    if (exchangeTextEl) exchangeTextEl.textContent = `₦${rate.toLocaleString()} / ${symbol}1`;
    
    const payoutResultEl = document.getElementById("sell-payout-result");
    if (payoutResultEl) payoutResultEl.textContent = "₦" + payout.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// Process base64 file preview uploads and downscale/compress with HTML5 Canvas to prevent database quota overflow
function previewUpload(input, previewId) {
    const preview = document.getElementById(previewId);
    const box = input.closest(".upload-box");
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                
                // Keep dimensions compact (fintech dashboard preview size)
                const MAX_WIDTH = 400;
                const MAX_HEIGHT = 240;
                
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                
                // Export compressed JPEG (0.6 quality gives very small footprint ~15KB while remaining clear)
                const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6);
                
                if (preview) {
                    preview.src = compressedBase64;
                    preview.style.display = "block";
                }
                input.setAttribute("data-base64", compressedBase64);
                if (box) box.classList.add("has-preview");
            };
            img.src = e.target.result;
        }
        
        reader.readAsDataURL(input.files[0]);
    } else {
        if (preview) {
            preview.src = "";
            preview.style.display = "none";
        }
        input.removeAttribute("data-base64");
        if (box) box.classList.remove("has-preview");
    }
}

// Handle Gift Card Submissions
function handleCardSubmit(e) {
    e.preventDefault();
    if (!validateUserStatusActive()) return;
    
    const submitBtn = e.target.querySelector("button[type='submit']");
    const originalText = submitBtn ? submitBtn.innerHTML : "Submit Card to Admin Review";
    
    const brand = document.getElementById("sell-brand").value;
    const currency = document.getElementById("sell-currency").value;
    const value = parseFloat(document.getElementById("sell-value").value);
    const code = document.getElementById("sell-code").value.trim();
    
    const inputFront = document.getElementById("sell-img-front");
    const inputBack = document.getElementById("sell-img-back");
    
    if (isNaN(value) || value <= 0) {
        showToast("Please enter a valid card face value.", "danger");
        return;
    }
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin" style="margin-right: 8px;"></i> Verifying & Securing Trade...`;
    }
    
    // Fraud Detection: Checks if this exact card code was submitted before
    setTimeout(() => {
        if (isDuplicateCardCode(code)) {
            showToast("Security Alert: Duplicate card pin key sequence intercepted! This trade is blocked.", "danger");
            
            // Log attempt
            const db = getDB();
            db.users[currentUser.email].logs.unshift({
                event: "Security Breach: Duplicate card submitted",
                timestamp: new Date().toISOString(),
                ip: "197.34.120.44"
            });
            saveDB(db);
            
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            return;
        }
        
        // Fallback to high-quality dynamic SVG mock graphics if files aren't chosen
        const defaultFrontSVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180' viewBox='0 0 300 180'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e3a8a'/><stop offset='100%' stop-color='%233b82f6'/></linearGradient></defs><rect width='300' height='180' rx='10' fill='url(%23g)'/><text x='150' y='70' fill='white' font-family='sans-serif' font-weight='bold' font-size='18' text-anchor='middle'>${brand} Gift Card</text><text x='150' y='100' fill='white' font-family='sans-serif' font-weight='bold' font-size='15' text-anchor='middle'>${currency} ${value}</text><text x='150' y='130' fill='white' font-family='monospace' font-size='11' opacity='0.7' text-anchor='middle'>PIN: ${code}</text></svg>`;
        const defaultBackSVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180' viewBox='0 0 300 180'><rect width='300' height='180' rx='10' fill='%23111827'/><rect x='20' y='30' width='260' height='40' fill='white'/><text x='150' y='110' fill='white' font-family='sans-serif' font-weight='bold' font-size='12' text-anchor='middle'>SECURITY BARCODE</text></svg>`;
        
        const frontBase64 = inputFront ? (inputFront.getAttribute("data-base64") || defaultFrontSVG) : defaultFrontSVG;
        const backBase64 = inputBack ? (inputBack.getAttribute("data-base64") || defaultBackSVG) : defaultBackSVG;
        
        const db = getDB();
        const submissionId = "GC-" + Math.floor(1000 + Math.random() * 9000);
        
        // Add trade submission entry
        const newSubmission = {
            id: submissionId,
            userId: currentUser.email,
            brand: brand,
            cardValue: value,
            currency: currency,
            cardCode: code,
            frontImageUrl: frontBase64,
            backImageUrl: backBase64,
            status: "PENDING",
            payoutAmount: null,
            rejectionReason: null,
            createdAt: new Date().toISOString()
        };
        
        db.submissions.unshift(newSubmission);
        
        // Log user activity
        db.users[currentUser.email].logs.unshift({
            event: `Submitted Gift Card Trade: ${brand} (${currency} ${value})`,
            timestamp: new Date().toISOString(),
            ip: "197.34.120.44"
        });
        
        saveDB(db);
        
        // Send local notification alerts
        dispatchNotification(
            currentUser.email,
            "Gift Card Trade Submitted",
            `Your ${brand} card worth ${currency} ${value} has been submitted successfully and is pending admin validation.`
        );
        
        showToast("Gift card submitted successfully to admin review team.", "success");
        
        // Reset forms and previews defensively
        const cardFormEl = document.getElementById("card-submission-form");
        if (cardFormEl) cardFormEl.reset();
        
        const previewFront = document.getElementById("preview-front");
        if (previewFront) {
            previewFront.style.display = "none";
            previewFront.src = "";
        }
        
        const previewBack = document.getElementById("preview-back");
        if (previewBack) {
            previewBack.style.display = "none";
            previewBack.src = "";
        }
        
        if (inputFront) inputFront.removeAttribute("data-base64");
        if (inputBack) inputBack.removeAttribute("data-base64");
        
        const boxes = document.querySelectorAll(".upload-box");
        boxes.forEach(box => box.classList.remove("has-preview"));
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
        
        // Reload components
        loadSession();
    }, 850);
}

// Populate Withdrawal panel confirmation details
function populateWithdrawConfirmDetails() {
    const db = getDB();
    const user = db.users[currentUser.email];
    
    document.getElementById("withdraw-avail-balance").textContent = "₦" + user.wallet.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    if (user.bankDetails) {
        document.getElementById("withdraw-bank-name").textContent = user.bankDetails.bankName;
        document.getElementById("withdraw-bank-number").textContent = user.bankDetails.accountNumber;
        document.getElementById("withdraw-bank-holder").textContent = user.bankDetails.accountHolderName;
    }
}

// State for custom PIN verification modal
let pendingPinAction = null; // "withdraw" or "purchase"
let pendingPinData = null;  // holds { amount } or { cardId }

function openPinVerificationModal(action, data) {
    pendingPinAction = action;
    pendingPinData = data;
    const modal = document.getElementById("pin-verification-modal");
    if (modal) {
        modal.classList.add("active");
        
        // Update modal descriptive text based on action to make it extremely premium!
        const modalDesc = modal.querySelector("p");
        if (modalDesc) {
            if (action === "withdraw") {
                modalDesc.textContent = `Please enter your secure 4-digit Transaction PIN to authorize this withdrawal of ₦${data.amount.toLocaleString()}.`;
            } else if (action === "purchase") {
                const db = getDB();
                const card = db.inventory.find(item => item.id === data.cardId);
                const descText = card ? `${card.brand} (${card.currency} ${card.cardValue}) for ₦${card.price.toLocaleString()}` : "this purchase";
                modalDesc.textContent = `Please enter your secure 4-digit Transaction PIN to authorize purchase of ${descText}.`;
            }
        }
        
        // Clear all inputs
        const inputs = modal.querySelectorAll(".pin-box");
        inputs.forEach(input => input.value = "");
        if (inputs[0]) inputs[0].focus();
    }
}

function closePinVerificationModal() {
    const modal = document.getElementById("pin-verification-modal");
    if (modal) {
        modal.classList.remove("active");
    }
    pendingPinAction = null;
    pendingPinData = null;
}

function handlePinInput(input, index) {
    // Strip non-digits instantly
    input.value = input.value.replace(/\D/g, "");
    
    // Auto-focus next input
    if (input.value.length >= 1) {
        const inputs = document.querySelectorAll("#pin-auth-form .pin-box");
        const next = inputs[index];
        if (next) {
            next.focus();
        } else if (index === 4) {
            // Instantly submit and verify when the 4th digit is typed!
            const form = document.getElementById("pin-auth-form");
            if (form) {
                form.requestSubmit();
            }
        }
    }
}

function handlePinKeydown(e, input, index) {
    // Backspace handler: go back to previous input on delete
    if (e.key === "Backspace" && input.value.length === 0) {
        const inputs = document.querySelectorAll("#pin-auth-form .pin-box");
        const prev = inputs[index - 2];
        if (prev) {
            prev.focus();
            prev.value = "";
        }
    }
}

function handlePinAuthSubmit(e) {
    e.preventDefault();
    
    const db = getDB();
    const user = db.users[currentUser.email];
    
    const inputs = document.querySelectorAll("#pin-auth-form .pin-box");
    let enteredPin = "";
    inputs.forEach(input => enteredPin += input.value);
    
    if (enteredPin.length !== 4) {
        showToast("Please enter a valid 4-digit PIN.", "danger");
        return;
    }
    
    if (enteredPin !== user.transactionPin) {
        showToast("Security Alert: Invalid Transaction PIN. Authorization failed.", "danger");
        inputs.forEach(input => input.value = "");
        if (inputs[0]) inputs[0].focus();
        return;
    }
    
    // Auth success! Close modal and execute the corresponding action
    const action = pendingPinAction;
    const data = pendingPinData;
    
    closePinVerificationModal();
    
    if (action === "withdraw") {
        executeWithdrawal(data.amount);
    } else if (action === "purchase") {
        executeCardPurchase(data.cardId);
    }
}

function executeWithdrawal(amount) {
    const db = getDB();
    const user = db.users[currentUser.email];
    
    // Deduct immediately (Pending balance transition)
    user.wallet.balance -= amount;
    db.users[currentUser.email] = user;
    
    const withdrawalId = "WD-" + Math.floor(1000 + Math.random() * 9000);
    const newRequest = {
        id: withdrawalId,
        userId: currentUser.email,
        amount: amount,
        bankName: user.bankDetails.bankName,
        accountNumber: user.bankDetails.accountNumber,
        accountHolderName: user.bankDetails.accountHolderName,
        status: "PENDING",
        declineReason: null,
        createdAt: new Date().toISOString()
    };
    
    db.withdrawals.unshift(newRequest);
    
    // Log user activity
    db.users[currentUser.email].logs.unshift({
        event: `Withdrawal Requested: ₦${amount.toLocaleString()}`,
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });
    
    saveDB(db);
    
    dispatchNotification(
        currentUser.email,
        "Withdrawal Request Logged",
        `You have requested a withdrawal of ₦${amount.toLocaleString()} to ${user.bankDetails.bankName}. Pending admin payout approval.`
    );
    
    showToast("Withdrawal request created successfully.", "success");
    
    // Reset amount
    const amountField = document.getElementById("withdraw-amount");
    if (amountField) amountField.value = "";
    
    loadSession();
}

// Handle Withdrawals Submit Request
function handleWithdrawalSubmit(e) {
    e.preventDefault();
    if (!validateUserStatusActive()) return;
    
    const amount = parseFloat(document.getElementById("withdraw-amount").value);
    
    if (isNaN(amount) || amount < 1000) {
        showToast("Minimum withdrawal limit is ₦1,000.00.", "danger");
        return;
    }
    
    const db = getDB();
    const user = db.users[currentUser.email];
    
    if (amount > user.wallet.balance) {
        showToast("Insufficient wallet balance to fulfill withdrawal.", "danger");
        return;
    }
    
    if (!user.bankDetails) {
        showToast("Destination bank credentials not found. Configure settings first.", "danger");
        return;
    }
    
    // PIN Verification check
    if (user.transactionPin) {
        openPinVerificationModal("withdraw", { amount: amount });
    } else {
        executeWithdrawal(amount);
    }
}

// Prepopulate bank profiles updates
function prepopulateBankForm() {
    const db = getDB();
    const user = db.users[currentUser.email];
    
    if (user.bankDetails) {
        const bankNameInput = document.getElementById("bank-name");
        if (bankNameInput) {
            bankNameInput.value = user.bankDetails.bankName;
        }
        
        updateTriggerDisplay(user.bankDetails.bankName);
        
        // Mark as selected in list
        const items = document.querySelectorAll("#bank-list-ul li");
        items.forEach(li => {
            if (li.getAttribute("data-value") === user.bankDetails.bankName) {
                li.classList.add("selected");
            } else {
                li.classList.remove("selected");
            }
        });
        
        // Update active class in popular bank cards
        const cards = document.querySelectorAll(".popular-bank-card");
        cards.forEach(card => {
            const onclickAttr = card.getAttribute("onclick");
            if (onclickAttr && onclickAttr.includes(user.bankDetails.bankName)) {
                card.classList.add("selected");
            } else {
                card.classList.remove("selected");
            }
        });
        
        document.getElementById("bank-account-number").value = user.bankDetails.accountNumber;
        document.getElementById("bank-account-holder").value = user.bankDetails.accountHolderName;
        
        // Show verified badge
        const statusContainer = document.getElementById("account-verification-status");
        if (statusContainer) {
            statusContainer.innerHTML = `<span style="font-size:0.68rem; font-weight:800; display:inline-flex; align-items:center; gap:4px; color:#10b981;"><i class="fas fa-circle-check"></i> ✓ Verified</span>`;
        }
        
        const saveBtn = document.getElementById("save-bank-btn");
        if (saveBtn) {
            saveBtn.disabled = false;
        }
    }
}

// Handle Bank details linking submit
function handleBankUpdate(e) {
    e.preventDefault();
    if (!validateUserStatusActive()) return;
    
    const bankName = document.getElementById("bank-name").value;
    const number = document.getElementById("bank-account-number").value.trim();
    const holder = document.getElementById("bank-account-holder").value.trim();
    
    if (!/^\d{10}$/.test(number)) {
        showToast("Bank account number must be exactly 10 digits.", "danger");
        return;
    }
    
    if (holder.length < 2) {
        showToast("Please enter a valid account holder name.", "danger");
        return;
    }
    
    const db = getDB();
    db.users[currentUser.email].bankDetails = {
        bankName: bankName,
        accountNumber: number,
        accountHolderName: holder
    };
    
    // Log event
    db.users[currentUser.email].logs.unshift({
        event: `Bank Account Linked: ${bankName} (${number})`,
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });
    
    saveDB(db);
    
    dispatchNotification(
        currentUser.email,
        "Bank Details Configured",
        `Your destination payout bank account has been updated successfully: ${bankName} (${number}).`
    );
    
    showToast("Bank credentials linked successfully.", "success");
    
    // Go to dashboard overview
    switchSection("dashboard", document.querySelector(".sidebar-link"));
    
    loadSession();
}

// Render Combined transactions ledger table
function renderTransactionTable() {
    const db = getDB();
    const tbody = document.getElementById("dashboard-tx-tbody");
    tbody.innerHTML = "";
    
    const userSubs = db.submissions.filter(s => s.userId === currentUser.email);
    const userWds = db.withdrawals.filter(w => w.userId === currentUser.email);
    const userPurchases = db.inventory.filter(item => item.status === "SOLD" && item.purchasedBy === currentUser.email);
    
    // Merge list items
    const list = [];
    userSubs.forEach(s => {
        list.push({
            id: s.id,
            date: new Date(s.createdAt),
            type: "Card Trade",
            details: `${s.brand} (${s.currency} ${s.cardValue})`,
            amount: s.payoutAmount !== null ? s.payoutAmount : 0,
            status: s.status,
            rejection: s.rejectionReason
        });
    });
    
    userWds.forEach(w => {
        list.push({
            id: w.id,
            date: new Date(w.createdAt),
            type: "Cash Withdrawal",
            details: `${w.bankName} (${w.accountNumber.substring(0,3)}***)`,
            amount: w.amount,
            status: w.status,
            rejection: w.declineReason
        });
    });
    
    userPurchases.forEach(p => {
        list.push({
            id: p.id,
            date: new Date(p.purchasedAt),
            type: "Card Purchase",
            details: `${p.brand} (${p.currency} ${p.cardValue})`,
            amount: p.price,
            status: "COMPLETED",
            rejection: null
        });
    });
    
    // Sort descending by date
    list.sort((a,b) => b.date - a.date);
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted);">No transaction activities found.</td></tr>`;
        return;
    }
    
    list.forEach(tx => {
        const tr = document.createElement("tr");
        
        let statusBadge = "";
        if (tx.status === "PENDING") statusBadge = `<span class="badge badge-warning"><span class="pulse-indicator warning"></span> Reviewing</span>`;
        else if (tx.status === "COMPLETED") statusBadge = `<span class="badge badge-success">Completed</span>`;
        else if (tx.status === "REJECTED" || tx.status === "DECLINED") {
            const reason = tx.rejection ? `title="${tx.rejection}"` : '';
            statusBadge = `<span class="badge badge-danger" ${reason} style="cursor:help;">Declined <i class="fas fa-circle-question" style="font-size:0.75rem; margin-left:4px;"></i></span>`;
        }
        
        const dateStr = tx.date.toLocaleString();
        
        let amountText = "";
        if (tx.type === "Card Trade") {
            // Card Trade adds balance (if completed)
            amountText = tx.status === "COMPLETED" ? `+₦${tx.amount.toLocaleString(undefined, {minimumFractionDigits:2})}` : `₦${tx.amount.toLocaleString(undefined, {minimumFractionDigits:2})} (Est.)`;
            tr.style.color = tx.status === "COMPLETED" ? "var(--accent)" : "inherit";
        } else {
            // Withdrawal or purchase deducts balance
            amountText = `-₦${tx.amount.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            tr.style.color = tx.status === "DECLINED" ? "var(--text-muted)" : "var(--danger)";
        }
        
        tr.innerHTML = `
            <td><code>${tx.id}</code></td>
            <td>${dateStr}</td>
            <td><strong>${tx.type}</strong></td>
            <td>${tx.details}</td>
            <td style="font-weight: 800;" class="text-right">${amountText}</td>
            <td class="text-center">${statusBadge}</td>
        `;
        
        tbody.appendChild(tr);
    });
}

// Render Selling Trade History panel table
function renderSellHistory() {
    const db = getDB();
    const tbody = document.getElementById("sell-history-tbody");
    tbody.innerHTML = "";
    
    const list = db.submissions.filter(s => s.userId === currentUser.email);
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--text-muted);">No trade submissions found.</td></tr>`;
        return;
    }
    
    list.forEach(s => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.title = "Click to inspect card submission details";
        tr.onclick = () => inspectTradeSubmission(s.id);
        
        let statusBadge = "";
        if (s.status === "PENDING") statusBadge = `<span class="badge badge-warning">Pending</span>`;
        else if (s.status === "COMPLETED") statusBadge = `<span class="badge badge-success">Completed</span>`;
        else statusBadge = `<span class="badge badge-danger" title="${s.rejectionReason || ''}">Rejected</span>`;
        
        // Payout calculate
        const rateMap = db.settings.rates[s.brand];
        const rate = (rateMap && rateMap[s.currency]) ? rateMap[s.currency] : 0;
        const estPayout = s.payoutAmount !== null ? s.payoutAmount : (s.cardValue * rate);
        
        const symbol = getCurrencySymbol(s.currency);
        tr.innerHTML = `
            <td><strong>${s.brand}</strong></td>
            <td>${symbol}${s.cardValue} (${s.currency})</td>
            <td style="font-weight:800;">₦${estPayout.toLocaleString()}</td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Render withdrawal history table
function renderWithdrawHistory() {
    const db = getDB();
    const tbody = document.getElementById("withdraw-history-tbody");
    tbody.innerHTML = "";
    
    const list = db.withdrawals.filter(w => w.userId === currentUser.email);
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--text-muted);">No withdrawal logs found.</td></tr>`;
        return;
    }
    
    list.forEach(w => {
        const tr = document.createElement("tr");
        
        let statusBadge = "";
        if (w.status === "PENDING") statusBadge = `<span class="badge badge-warning">Pending</span>`;
        else if (w.status === "COMPLETED") statusBadge = `<span class="badge badge-success">Sent</span>`;
        else statusBadge = `<span class="badge badge-danger" title="${w.declineReason || ''}">Failed</span>`;
        
        tr.innerHTML = `
            <td>${new Date(w.createdAt).toLocaleDateString()}</td>
            <td style="font-weight:800;" class="text-right">₦${w.amount.toLocaleString()}</td>
            <td>${w.bankName}</td>
            <td class="text-center">${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Render Notifications
function renderNotifications() {
    const db = getDB();
    const user = db.users[currentUser.email];
    
    // 1. Update navigation bell count badge
    const unread = user.notifications.filter(n => !n.read);
    const navCount = document.getElementById("nav-notif-count");
    if (navCount) {
        if (unread.length > 0) {
            navCount.textContent = unread.length;
            navCount.style.display = "flex";
        } else {
            navCount.style.display = "none";
        }
    }
    
    // 2. Populate header dropdown notifications
    const dropList = document.getElementById("notif-dropdown-list");
    if (dropList) {
        dropList.innerHTML = "";
        
        if (user.notifications.length === 0) {
            dropList.innerHTML = `<div style="padding: 24px 20px; text-align: center; color: var(--text-muted); font-size: 0.8rem;"><i class="fas fa-bell-slash" style="margin-bottom: 8px; font-size: 1.2rem; display: block; opacity: 0.5;"></i>No notifications.</div>`;
        } else {
            // Display latest 5 notifications in dropdown
            user.notifications.slice(0, 5).forEach(n => {
                const item = document.createElement("div");
                item.className = `notif-dropdown-item ${!n.read ? 'unread' : ''}`;
                
                const dateStr = new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // Dot indicator for unread
                const dotHTML = !n.read ? `<span style="width: 6px; height: 6px; background: var(--primary); border-radius: 50%; display: inline-block; flex-shrink: 0; margin-top: 1px;"></span>` : '';
                
                item.innerHTML = `
                    <span class="notif-dropdown-item-title" style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.85rem; color: var(--text-primary);">
                        ${dotHTML}
                        ${n.title}
                    </span>
                    <span class="notif-dropdown-item-msg" style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">${n.message}</span>
                    <span class="notif-dropdown-item-time" style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px; display: block;">${dateStr}</span>
                `;
                
                item.onclick = () => {
                    markNotificationRead(n.id);
                    
                    // Smart navigation based on notification content
                    const titleLower = n.title.toLowerCase();
                    const msgLower = n.message.toLowerCase();
                    
                    let targetSection = null;
                    if (titleLower.includes("trade") || titleLower.includes("card") || msgLower.includes("card")) {
                        targetSection = "sell";
                    } else if (titleLower.includes("withdrawal") || titleLower.includes("transfer") || msgLower.includes("withdraw")) {
                        targetSection = "withdraw";
                    } else if (titleLower.includes("bank") || msgLower.includes("bank")) {
                        targetSection = "bank";
                    }
                    
                    if (targetSection) {
                        const link = document.querySelector(`.sidebar-link[onclick*="'${targetSection}'"]`);
                        switchSection(targetSection, link);
                    }
                    
                    // Close dropdown
                    const pane = document.getElementById("notif-dropdown-pane");
                    if (pane) pane.classList.remove("active");
                };
                
                dropList.appendChild(item);
            });
        }
    }
    
    // 3. Populate notifications section panel
    const container = document.getElementById("notifications-list-container");
    if (container) {
        container.innerHTML = "";
        
        if (user.notifications.length === 0) {
            container.innerHTML = `<div class="card" style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fas fa-bell-slash" style="font-size:2rem; margin-bottom:12px; display:block;"></i> Your notifications inbox is empty.</div>`;
            return;
        }
        
        user.notifications.forEach(n => {
            const div = document.createElement("div");
            div.className = `notification-item ${!n.read ? 'unread' : ''}`;
            
            const dateStr = new Date(n.createdAt).toLocaleString();
            
            div.innerHTML = `
                <div>
                    <h4 style="font-weight: 700; margin-bottom: 4px;">${n.title}</h4>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4;">${n.message}</p>
                    <span style="font-size: 0.7rem; color: var(--text-muted); display: block; margin-top: 6px;">${dateStr}</span>
                </div>
                ${!n.read ? `<button class="btn btn-secondary btn-sm" onclick="markNotificationRead('${n.id}')">Read</button>` : ''}
            `;
            container.appendChild(div);
        });
    }
}

function markNotificationRead(id) {
    const db = getDB();
    const user = db.users[currentUser.email];
    
    const index = user.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
        user.notifications[index].read = true;
        db.users[currentUser.email] = user;
        saveDB(db);
        loadSession();
    }
}

function markAllNotificationsRead() {
    const db = getDB();
    const user = db.users[currentUser.email];
    
    user.notifications.forEach(n => n.read = true);
    db.users[currentUser.email] = user;
    saveDB(db);
    loadSession();
    showToast("All notifications marked as read.", "success");
}

function markAllNotifRead() {
    markAllNotificationsRead();
    const pane = document.getElementById("notif-dropdown-pane");
    if (pane) pane.classList.remove("active");
}

function viewAllNotifications() {
    switchSection("notifications");
    
    // Remove active class from all sidebar links since notifications is a special section
    const links = document.querySelectorAll(".sidebar-link");
    links.forEach(lnk => lnk.classList.remove("active"));
    
    // Close dropdown
    const pane = document.getElementById("notif-dropdown-pane");
    if (pane) pane.classList.remove("active");
}

// Render Security logs
function renderSecurityLogs() {
    const db = getDB();
    const user = db.users[currentUser.email];
    const tbody = document.getElementById("logs-tbody");
    tbody.innerHTML = "";
    
    user.logs.forEach(log => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-size: 0.85rem; color: var(--text-secondary);">${new Date(log.timestamp).toLocaleString()}</td>
            <td><strong>${log.event}</strong></td>
            <td><code>${log.ip}</code></td>
        `;
        tbody.appendChild(tr);
    });
}

// Handle User logout
function handleLogout() {
    const db = getDB();
    db.users[currentUser.email].logs.unshift({
        event: "User Logged Out",
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });
    saveDB(db);
    clearSession();
    showToast("Signed out successfully.", "success");
    setTimeout(() => {
        window.location.href = "index.html";
    }, 1000);
}

// ================= BUY GIFT CARD SYSTEM =================

// Helper to render customized circular brand logo badges
function getBrandLogoHTML(brand) {
    let iconClass = "fas fa-ticket";
    let bgColor = "var(--primary)";
    
    const brandLower = brand.toLowerCase();
    
    // Shopping & Retail
    if (brandLower.includes("amazon")) { iconClass = "fab fa-amazon"; bgColor = "#FF9900"; }
    else if (brandLower.includes("walmart")) { iconClass = "fas fa-store"; bgColor = "#0071CE"; }
    else if (brandLower.includes("best buy")) { iconClass = "fas fa-tag"; bgColor = "#FFF200"; }
    else if (brandLower.includes("target")) { iconClass = "fas fa-bullseye"; bgColor = "#CC0000"; }
    else if (brandLower.includes("costco")) { iconClass = "fas fa-warehouse"; bgColor = "#005EA6"; }
    else if (brandLower.includes("ebay")) { iconClass = "fab fa-ebay"; bgColor = "#0064D2"; }
    else if (brandLower.includes("macy")) { iconClass = "fas fa-star"; bgColor = "#E21A22"; }
    else if (brandLower.includes("nordstrom")) { iconClass = "fas fa-bag-shopping"; bgColor = "#111111"; }
    else if (brandLower.includes("sephora")) { iconClass = "fas fa-wand-magic-sparkles"; bgColor = "#E00034"; }
    
    // Gaming
    else if (brandLower.includes("steam")) { iconClass = "fab fa-steam"; bgColor = "#171a21"; }
    else if (brandLower.includes("playstation") || brandLower.includes("psn")) { iconClass = "fab fa-playstation"; bgColor = "#0037AE"; }
    else if (brandLower.includes("xbox")) { iconClass = "fab fa-xbox"; bgColor = "#107C10"; }
    else if (brandLower.includes("nintendo")) { iconClass = "fas fa-gamepad"; bgColor = "#E60012"; }
    else if (brandLower.includes("roblox")) { iconClass = "fas fa-cube"; bgColor = "#E31B23"; }
    else if (brandLower.includes("riot")) { iconClass = "fas fa-fist-raised"; bgColor = "#D12630"; }
    
    // Entertainment
    else if (brandLower.includes("apple") || brandLower.includes("itunes")) { iconClass = "fab fa-apple"; bgColor = "#111111"; }
    else if (brandLower.includes("google play")) { iconClass = "fab fa-google-play"; bgColor = "#34A853"; }
    else if (brandLower.includes("netflix")) { iconClass = "fas fa-film"; bgColor = "#E50914"; }
    else if (brandLower.includes("spotify")) { iconClass = "fab fa-spotify"; bgColor = "#1DB954"; }
    else if (brandLower.includes("hulu")) { iconClass = "fas fa-tv"; bgColor = "#1CE685"; }
    else if (brandLower.includes("disney")) { iconClass = "fas fa-video"; bgColor = "#113CCF"; }
    else if (brandLower.includes("youtube")) { iconClass = "fab fa-youtube"; bgColor = "#FF0000"; }
    
    // Food & Restaurants
    else if (brandLower.includes("starbucks")) { iconClass = "fas fa-mug-hot"; bgColor = "#00704A"; }
    else if (brandLower.includes("mcdonald")) { iconClass = "fas fa-hamburger"; bgColor = "#FFC72C"; }
    else if (brandLower.includes("kfc")) { iconClass = "fas fa-drumstick-bite"; bgColor = "#A30000"; }
    else if (brandLower.includes("burger king")) { iconClass = "fas fa-burger"; bgColor = "#F47321"; }
    else if (brandLower.includes("uber")) { iconClass = "fab fa-uber"; bgColor = "#090909"; }
    else if (brandLower.includes("doordash")) { iconClass = "fas fa-motorcycle"; bgColor = "#FF3008"; }
    
    // Travel
    else if (brandLower.includes("airbnb")) { iconClass = "fab fa-airbnb"; bgColor = "#FF5A5F"; }
    else if (brandLower.includes("booking")) { iconClass = "fas fa-hotel"; bgColor = "#003580"; }
    
    // Finance & Crypto
    else if (brandLower.includes("visa")) { iconClass = "fab fa-cc-visa"; bgColor = "#1A1F71"; }
    else if (brandLower.includes("mastercard")) { iconClass = "fab fa-cc-mastercard"; bgColor = "#EB001B"; }
    else if (brandLower.includes("american express") || brandLower.includes("amex")) { iconClass = "fab fa-cc-amex"; bgColor = "#016FD0"; }
    else if (brandLower.includes("paypal")) { iconClass = "fab fa-paypal"; bgColor = "#003087"; }
    
    // Fashion
    else if (brandLower.includes("nike")) { iconClass = "fas fa-shoe-prints"; bgColor = "#111111"; }
    else if (brandLower.includes("adidas")) { iconClass = "fas fa-socks"; bgColor = "#0072CE"; }
    
    // Digital
    else if (brandLower.includes("razer")) { iconClass = "fas fa-coins"; bgColor = "#252525"; }
    else if (brandLower.includes("twitch")) { iconClass = "fab fa-twitch"; bgColor = "#9146FF"; }
    else if (brandLower.includes("discord")) { iconClass = "fab fa-discord"; bgColor = "#5865F2"; }
    
    let textColor = "#ffffff";
    if (bgColor === "#FFF200" || bgColor === "#FFC72C") textColor = "#111111";
    
    return `<div class="brand-logo-container" style="width: 32px; height: 32px; background: ${bgColor}; color: ${textColor}; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.95rem;"><i class="${iconClass}"></i></div>`;
}

// Helper to render beautiful brand card gradients
function getBrandCardGradient(brand) {
    const brandLower = brand.toLowerCase();
    
    if (brandLower.includes("amazon")) return "linear-gradient(135deg, #FF9900 0%, #111111 100%)";
    if (brandLower.includes("apple") || brandLower.includes("itunes")) return "linear-gradient(135deg, #111111 0%, #444444 100%)";
    if (brandLower.includes("google play")) return "linear-gradient(135deg, #34A853 0%, #4285F4 100%)";
    if (brandLower.includes("steam")) return "linear-gradient(135deg, #171a21 0%, #2a475e 100%)";
    if (brandLower.includes("walmart")) return "linear-gradient(135deg, #0071CE 0%, #FFC220 100%)";
    if (brandLower.includes("target")) return "linear-gradient(135deg, #CC0000 0%, #FF8888 100%)";
    if (brandLower.includes("sephora")) return "linear-gradient(135deg, #E00034 0%, #000000 100%)";
    if (brandLower.includes("playstation") || brandLower.includes("psn")) return "linear-gradient(135deg, #0037AE 0%, #001030 100%)";
    if (brandLower.includes("xbox")) return "linear-gradient(135deg, #107C10 0%, #052005 100%)";
    if (brandLower.includes("nintendo")) return "linear-gradient(135deg, #E60012 0%, #8A000A 100%)";
    if (brandLower.includes("netflix")) return "linear-gradient(135deg, #E50914 0%, #000000 100%)";
    if (brandLower.includes("spotify")) return "linear-gradient(135deg, #1DB954 0%, #191414 100%)";
    if (brandLower.includes("hulu")) return "linear-gradient(135deg, #1CE685 0%, #05301B 100%)";
    if (brandLower.includes("airbnb")) return "linear-gradient(135deg, #FF5A5F 0%, #A52D32 100%)";
    if (brandLower.includes("uber")) return "linear-gradient(135deg, #090909 0%, #333333 100%)";
    if (brandLower.includes("twitch")) return "linear-gradient(135deg, #9146FF 0%, #3a0094 100%)";
    if (brandLower.includes("discord")) return "linear-gradient(135deg, #5865F2 0%, #202773 100%)";
    
    return "linear-gradient(135deg, var(--primary) 0%, #1e3a8a 100%)";
}

// Helper to get country flag emoji
function getCountryFlagEmoji(region) {
    if (region === "USA" || region === "USD") return "🇺🇸";
    if (region === "UK" || region === "GBP") return "🇬🇧";
    if (region === "Canada" || region === "CAD") return "🇨🇦";
    if (region === "Australia" || region === "AUD") return "🇦🇺";
    if (["EUR", "Europe (EUR)", "Germany", "France", "Italy", "Spain", "Netherlands"].includes(region)) return "🇪🇺";
    if (region.includes("Switzerland") || region === "CHF") return "🇨🇭";
    if (region.includes("Japan") || region === "JPY") return "🇯🇵";
    if (region.includes("China") || region === "CNY") return "🇨🇳";
    if (region.includes("Hong Kong") || region === "HKD") return "🇭🇰";
    if (region.includes("Singapore") || region === "SGD") return "🇸🇬";
    if (region.includes("New Zealand") || region === "NZD") return "🇳🇿";
    if (region.includes("UAE") || region === "AED") return "🇦🇪";
    if (region.includes("Saudi") || region === "SAR") return "🇸🇦";
    if (region.includes("South Africa") || region === "ZAR") return "🇿🇦";
    if (region.includes("India") || region === "INR") return "🇮🇳";
    return "🌐";
}

// Render available stock in the Buy tab (backward compatibility wrapper)
function renderBuyStockTable() {
    filterAndRenderBuyStock();
}

// Main logic to filter, sort, and render stock items as product cards
function filterAndRenderBuyStock() {
    const db = getDB();
    const grid = document.getElementById("buy-stock-grid");
    if (!grid) return;
    
    grid.innerHTML = "";
    
    // Filter available cards in stock
    let list = db.inventory ? db.inventory.filter(item => item.status === "AVAILABLE") : [];
    
    // 1. Filter by Search Query
    const searchInput = document.getElementById("buy-search-input");
    const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : "";
    if (searchQuery) {
        list = list.filter(item => 
            item.brand.toLowerCase().includes(searchQuery) ||
            item.id.toLowerCase().includes(searchQuery)
        );
    }
    
    // 2. Filter by Country/Region
    const countryFilter = document.getElementById("buy-country-filter");
    const regionVal = countryFilter ? countryFilter.value : "ALL";
    if (regionVal !== "ALL") {
        list = list.filter(item => {
            const currency = item.currency;
            if (regionVal === "USA") return currency === "USD" || currency === "USA";
            if (regionVal === "UK") return currency === "GBP" || currency === "UK";
            if (regionVal === "Canada") return currency === "CAD" || currency === "Canada";
            if (regionVal === "Australia") return currency === "AUD" || currency === "Australia";
            if (regionVal === "Europe (EUR)") return ["EUR", "Europe (EUR)", "Germany", "France", "Italy", "Spain", "Netherlands"].includes(currency);
            return currency === regionVal;
        });
    }
    
    // 3. Sort List
    const sortFilter = document.getElementById("buy-sort-filter");
    const sortVal = sortFilter ? sortFilter.value : "DEFAULT";
    if (sortVal === "PRICE_LOW_HIGH") {
        list.sort((a, b) => a.price - b.price);
    } else if (sortVal === "PRICE_HIGH_LOW") {
        list.sort((a, b) => b.price - a.price);
    } else if (sortVal === "STOCK_HIGH_LOW") {
        list.sort((a, b) => b.cardValue - a.cardValue);
    } else {
        list.sort((a, b) => b.id.localeCompare(a.id));
    }
    
    if (list.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-muted);">
                <i class="fas fa-ticket" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.5;"></i>
                <p style="font-size: 1rem; font-weight: 600;">No Gift Cards Available</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">There are no available gift cards matching your filters in stock right now.</p>
            </div>
        `;
        return;
    }
    
    list.forEach(item => {
        const cardDiv = document.createElement("div");
        cardDiv.className = "product-card";
        
        const logoHTML = getBrandLogoHTML(item.brand);
        const flagEmoji = getCountryFlagEmoji(item.currency);
        const currencySymbol = getCurrencySymbol(item.currency);
        const cardGradient = getBrandCardGradient(item.brand);
        
        cardDiv.innerHTML = `
            <div class="product-card-banner">
                <div class="product-card-logo-badge">
                    ${logoHTML}
                </div>
                <div class="product-card-flag" title="${item.currency}">
                    ${flagEmoji}
                </div>
                <div class="product-card-graphic" style="background: ${cardGradient};">
                    <span style="font-weight:700; font-size:0.65rem;">${item.brand}</span>
                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <span style="font-weight:800; font-size:0.75rem;">${currencySymbol}${item.cardValue}</span>
                        <span style="font-size:0.45rem; opacity:0.8;">Goodfastpay</span>
                    </div>
                </div>
            </div>
            <div class="product-card-body">
                <h4 class="product-card-title">${item.brand}</h4>
                <div class="product-card-meta">
                    <span>Value: <strong>${currencySymbol}${item.cardValue}</strong></span>
                    <span class="product-card-stock in-stock">In Stock</span>
                </div>
                <div style="margin-top:auto; display:flex; justify-content:space-between; align-items:flex-end; padding-top:12px;">
                    <div>
                        <div class="product-card-price-label">Sale Price</div>
                        <div class="product-card-price">₦${item.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="purchaseGiftCard('${item.id}')" style="display:inline-flex; align-items:center; gap:4px; padding:6px 12px; font-size:0.8rem; height:32px;"><i class="fas fa-shopping-cart"></i> Buy</button>
                </div>
            </div>
        `;
        
        grid.appendChild(cardDiv);
    });
}

// Purchase gift card using wallet balance
function purchaseGiftCard(cardId) {
    const db = getDB();
    const card = db.inventory.find(item => item.id === cardId);
    
    if (!card || card.status !== "AVAILABLE") {
        showToast("Gift card is no longer available for purchase.", "danger");
        return;
    }
    
    const user = db.users[currentUser.email];
    
    if (user.wallet.balance < card.price) {
        showToast(`Insufficient wallet balance. You need ₦${card.price.toLocaleString()} to buy this card. Available balance: ₦${user.wallet.balance.toLocaleString()}`, "danger");
        return;
    }
    
    // PIN Verification check
    if (user.transactionPin) {
        openPinVerificationModal("purchase", { cardId: cardId });
    } else {
        if (confirm(`Are you sure you want to purchase this ${card.brand} (${card.currency} ${card.cardValue}) for ₦${card.price.toLocaleString()}? The price will be deducted from your wallet balance.`)) {
            executeCardPurchase(cardId);
        }
    }
}

function executeCardPurchase(cardId) {
    const db = getDB();
    const card = db.inventory.find(item => item.id === cardId);
    if (!card) return;
    
    const user = db.users[currentUser.email];
    
    // Deduct balance
    user.wallet.balance -= card.price;
    
    // Mark card as SOLD
    card.status = "SOLD";
    card.purchasedBy = user.email;
    card.purchasedAt = new Date().toISOString();
    
    // Save back in inventory list
    const idx = db.inventory.findIndex(item => item.id === cardId);
    db.inventory[idx] = card;
    
    // Log in user log
    user.logs.unshift({
        event: `Purchased Gift Card (ID: ${card.id}): ${card.brand} (${card.currency} ${card.cardValue}) for -₦${card.price.toLocaleString()}`,
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });
    
    db.users[currentUser.email] = user;
    
    // Log in Admin Audit logs
    db.auditTrail.unshift({
        operator: user.email,
        event: "Gift Card Purchased",
        timestamp: new Date().toISOString(),
        details: `Purchased Stock ID: ${card.id} - ${card.brand} ${card.currency} ${card.cardValue} for ₦${card.price.toLocaleString()}`
    });
    
    saveDB(db);
    
    // Dispatch notifications
    dispatchNotification(
        user.email,
        "Gift Card Purchased Successfully",
        `You have successfully purchased a ${card.brand} card worth ${card.currency} ${card.cardValue} for ₦${card.price.toLocaleString()}. The revealed code is available under your Purchased Codes history.`
    );
    
    showToast("Gift card purchased successfully! PIN code revealed.", "success");
    
    // Reload all data
    loadSession();
}

// Render purchased codes list with copy PIN helper
function renderPurchasedHistoryTable() {
    const db = getDB();
    const tbody = document.getElementById("buy-history-tbody");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    
    // Filter cards purchased by current user
    const list = db.inventory.filter(item => item.status === "SOLD" && item.purchasedBy === currentUser.email);
    
    // Sort descending by purchase date
    list.sort((a,b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--text-muted);">No purchased gift cards found.</td></tr>`;
        return;
    }
    
    list.forEach(item => {
        const tr = document.createElement("tr");
        
        const symbol = getCurrencySymbol(item.currency);
        const dateStr = new Date(item.purchasedAt).toLocaleDateString();
        
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td><strong>${item.brand}</strong><br><span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700;">${symbol}${item.cardValue} (${item.currency})</span></td>
            <td style="font-weight:800; color:var(--danger);" class="text-right">-₦${item.price.toLocaleString()}</td>
            <td class="text-center">
                <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                    <code style="background:var(--bg-tertiary); padding: 3px 6px; border-radius:4px; font-weight:800; font-size:0.76rem;">${item.code}</code>
                    <button class="btn btn-secondary btn-sm" onclick="copyCardPinCode('${item.code}')" title="Copy Pin"><i class="fas fa-copy"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Helper to copy pin code to clipboard
function copyCardPinCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast("Card PIN code copied to clipboard!", "success");
    }).catch(err => {
        showToast("Failed to copy PIN to clipboard.", "danger");
    });
}

// Select a suggestion denomination value
function selectDenomination(val) {
    const valueInput = document.getElementById("sell-value");
    if (valueInput) {
        valueInput.value = val;
        updateSellRate();
    }
}

function getCurrencySymbol(curr) {
    if (!curr) return "$";
    if (curr === "UK" || curr === "GBP") return "£";
    if (["Europe (EUR)", "EUR", "Germany", "France", "Italy", "Spain", "Netherlands"].includes(curr)) return "€";
    if (curr.includes("Switzerland") || curr === "CHF") return "CHF";
    if (curr.includes("Japan") || curr === "JPY") return "¥";
    if (curr.includes("China") || curr === "CNY") return "¥";
    if (curr.includes("Hong Kong") || curr === "HKD") return "HK$";
    if (curr.includes("Singapore") || curr === "SGD") return "S$";
    if (curr.includes("New Zealand") || curr === "NZD") return "NZ$";
    if (curr.includes("UAE") || curr === "AED") return "AED";
    if (curr.includes("Saudi") || curr === "SAR") return "SR";
    if (curr.includes("South Africa") || curr === "ZAR") return "R";
    if (curr.includes("India") || curr === "INR") return "₹";
    return "$";
}

// Switch Settings tabs (Bank details, Password Change, Transaction PIN)
function switchSettingsTab(tab, btn) {
    const contents = document.querySelectorAll(".settings-tab-content");
    contents.forEach(c => c.style.display = "none");
    
    const activeTab = document.getElementById("settings-tab-" + tab);
    if (activeTab) activeTab.style.display = "block";
    
    const buttons = btn.parentElement.querySelectorAll(".tab-btn");
    buttons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    if (tab === "security-pin") {
        const db = getDB();
        const user = db.users[currentUser.email];
        const pinGroup = document.getElementById("settings-current-pin-group");
        const submitBtn = document.querySelector("#pin-settings-form button[type='submit']");
        
        if (user.transactionPin) {
            pinGroup.style.display = "block";
            submitBtn.textContent = "Update Transaction PIN";
            document.getElementById("settings-current-pin").required = true;
        } else {
            pinGroup.style.display = "none";
            submitBtn.textContent = "Set Transaction PIN";
            document.getElementById("settings-current-pin").required = false;
        }
    }
}

// Handle login password update
function handlePasswordUpdate(e) {
    e.preventDefault();
    if (!validateUserStatusActive()) return;
    const currentPassword = document.getElementById("settings-current-password").value;
    const newPassword = document.getElementById("settings-new-password").value;
    const confirmPassword = document.getElementById("settings-confirm-password").value;
    
    const db = getDB();
    const user = db.users[currentUser.email];
    
    if (user.passwordHash !== currentPassword) {
        showToast("Incorrect current password.", "danger");
        return;
    }
    
    if (newPassword.length < 8) {
        showToast("New password must be at least 8 characters long.", "danger");
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast("New password confirmation mismatch.", "danger");
        return;
    }
    
    if (checkPasswordStrength(newPassword) < 2) {
        showToast("Password is too weak. Please include letters, numbers, or symbols.", "warning");
        return;
    }
    
    user.passwordHash = newPassword;
    
    user.logs.unshift({
        event: "Changed login password from Settings",
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });
    
    db.users[currentUser.email] = user;
    saveDB(db);
    
    currentUser.passwordHash = newPassword;
    showToast("Password updated successfully.", "success");
    document.getElementById("password-settings-form").reset();
}

// Handle transaction PIN update/creation
function handlePinUpdate(e) {
    e.preventDefault();
    if (!validateUserStatusActive()) return;
    const currentPin = document.getElementById("settings-current-pin").value;
    const newPin = document.getElementById("settings-new-pin").value;
    const confirmPin = document.getElementById("settings-confirm-pin").value;
    
    const db = getDB();
    const user = db.users[currentUser.email];
    const hadPin = !!user.transactionPin;
    
    if (hadPin) {
        if (user.transactionPin !== currentPin) {
            showToast("Incorrect current transaction PIN.", "danger");
            return;
        }
    }
    
    if (!/^\d{4}$/.test(newPin)) {
        showToast("Transaction PIN must be exactly 4 digits.", "danger");
        return;
    }
    
    if (newPin !== confirmPin) {
        showToast("PIN confirmation mismatch.", "danger");
        return;
    }
    
    user.transactionPin = newPin;
    
    user.logs.unshift({
        event: hadPin ? "Updated transaction PIN" : "Set transaction PIN",
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });
    
    db.users[currentUser.email] = user;
    saveDB(db);
    
    currentUser.transactionPin = newPin;
    showToast(hadPin ? "Transaction PIN updated successfully." : "Transaction PIN set successfully.", "success");
    
    document.getElementById("pin-settings-form").reset();
    
    // Refresh display
    switchSettingsTab('security-pin', document.querySelector('.tab-headers .tab-btn:nth-child(3)'));
}

// User-facing trade inspector modal populator
function inspectTradeSubmission(subId) {
    const db = getDB();
    const sub = db.submissions.find(s => s.id === subId);
    if (!sub) return;
    
    const modal = document.getElementById("trade-inspect-modal");
    const body = document.getElementById("trade-inspect-body");
    if (!modal || !body) return;
    
    let statusBadge = "";
    if (sub.status === "PENDING") statusBadge = `<span class="badge badge-warning">Pending Review</span>`;
    else if (sub.status === "COMPLETED") statusBadge = `<span class="badge badge-success">Completed</span>`;
    else statusBadge = `<span class="badge badge-danger">Rejected</span>`;
    
    let decisionHTML = "";
    if (sub.status === "COMPLETED") {
        decisionHTML = `
            <div style="border-top:1px solid var(--border-color); padding-top:16px; margin-top:16px; color:var(--accent); text-align:center;">
                <i class="fas fa-circle-check" style="font-size:2rem; margin-bottom:8px;"></i>
                <h4 style="font-weight:700;">Approved & Paid</h4>
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:4px;">Payout of <strong>₦${sub.payoutAmount.toLocaleString()}</strong> has been credited to your wallet.</p>
            </div>
        `;
    } else if (sub.status === "REJECTED") {
        decisionHTML = `
            <div style="border-top:1px solid var(--border-color); padding-top:16px; margin-top:16px; color:var(--danger); text-align:center;">
                <i class="fas fa-circle-xmark" style="font-size:2rem; margin-bottom:8px;"></i>
                <h4 style="font-weight:700;">Declined / Rejected</h4>
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:4px;">Reason: <em>${sub.rejectionReason}</em></p>
            </div>
        `;
    } else {
        decisionHTML = `
            <div style="border-top:1px solid var(--border-color); padding-top:16px; margin-top:16px; color:var(--warning); text-align:center;">
                <i class="fas fa-hourglass-half" style="font-size:2rem; margin-bottom:8px;"></i>
                <h4 style="font-weight:700;">Pending Verification</h4>
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:4px;">Our review team is currently verifying this card. Payout will credit instantly upon approval.</p>
            </div>
        `;
    }
    
    const rateMap = db.settings.rates[sub.brand];
    const rate = (rateMap && rateMap[sub.currency]) ? rateMap[sub.currency] : 0;
    const estPayout = sub.payoutAmount !== null ? sub.payoutAmount : (sub.cardValue * rate);
    const symbol = getCurrencySymbol(sub.currency);
    
    body.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
                <strong style="font-size: 1.15rem; display:block;">${sub.brand}</strong>
                <span style="font-size:0.75rem; color:var(--text-muted);">Trade ID: <code>${sub.id}</code> • Submitted: ${new Date(sub.createdAt).toLocaleString()}</span>
            </div>
            <div>${statusBadge}</div>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:10px; background:var(--bg-tertiary); padding:16px; border-radius:8px; margin-bottom:20px; font-size:0.9rem;">
            <div style="display:flex; justify-content:space-between;"><span>Face Value:</span> <strong>${symbol}${sub.cardValue}</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>Exchange Rate:</span> <strong>₦${rate.toLocaleString()} / ${symbol}1</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>Expected Payout:</span> <strong style="color:var(--accent);">₦${estPayout.toLocaleString()}</strong></div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>PIN Code:</span>
                <span style="font-family:monospace; background:var(--bg-secondary); padding:2px 8px; border-radius:4px; font-weight:700;">${sub.cardCode}</span>
            </div>
        </div>
        
        <h4 style="font-weight:700; margin: 16px 0 10px; font-size:0.95rem;">Card Images Scanned</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
            <div style="background:var(--bg-tertiary); padding:8px; border-radius:6px; text-align:center;">
                <span style="font-size:0.7rem; display:block; color:var(--text-secondary); margin-bottom:6px;">Card Front</span>
                <img src="${sub.frontImageUrl}" alt="Card Front" style="width:100%; max-height:120px; object-fit:contain; border-radius:4px; border:1px solid var(--border-color); background:#000;">
            </div>
            <div style="background:var(--bg-tertiary); padding:8px; border-radius:6px; text-align:center;">
                <span style="font-size:0.7rem; display:block; color:var(--text-secondary); margin-bottom:6px;">Card Back</span>
                <img src="${sub.backImageUrl}" alt="Card Back" style="width:100%; max-height:120px; object-fit:contain; border-radius:4px; border:1px solid var(--border-color); background:#000;">
            </div>
        </div>
        
        ${decisionHTML}
    `;
    
    modal.classList.add("active");
}

function closeTradeInspectModal() {
    const modal = document.getElementById("trade-inspect-modal");
    if (modal) modal.classList.remove("active");
}

// Generate beautiful notification chime synth tone
function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 fundamental
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5 chime transition
        
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime); // soft volume feedback
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
        console.log("Audio chime blocked or not supported by browser autoplay settings:", e);
    }
}

// Toggle notifications panel dropdown visibility and mark all notifications as read when opening
function toggleNotifDropdown() {
    const pane = document.getElementById("notif-dropdown-pane");
    if (!pane) return;
    
    const isOpening = !pane.classList.contains("active");
    pane.classList.toggle("active");
    
    if (isOpening) {
        const db = getDB();
        const user = db.users[currentUser.email];
        
        let changed = false;
        user.notifications.forEach(n => {
            if (!n.read) {
                n.read = true;
                changed = true;
            }
        });
        
        if (changed) {
            db.users[currentUser.email] = user;
            saveDB(db);
            loadSession();
        }
    }
}

// Searchable bank selection dropdown details
const NIGERIAN_BANKS = [
    "Access Bank", "Access Bank (Diamond)", "ALAT by WEMA", "Amju Unique MFB",
    "ASO Savings and Loans", "Baines Credit MFB", "Bowen Microfinance Bank",
    "Carbon", "CEMCS Microfinance Bank", "Citibank Nigeria", "Coronation Merchant Bank",
    "Ecobank Nigeria", "Ekondo Microfinance Bank", "Eyowo", "Fidelity Bank",
    "First Bank of Nigeria", "First City Monument Bank (FCMB)", "FSDH Merchant Bank",
    "Globus Bank", "Greenwich Merchant Bank", "Guaranty Trust Bank (GTBank)",
    "Hackman Microfinance Bank", "Hasal Microfinance Bank", "Heritage Bank",
    "HopePSB", "Ibile Microfinance Bank", "Infinity MFB", "Jaiz Bank",
    "Keystone Bank", "Kuda Bank", "Links MFB", "Lotus Bank", "Mayfair MFB",
    "Mint MFB", "Moniepoint MFB", "Nova Merchant Bank", "OPay", "Page Financials",
    "Palms MFB", "Parallex Bank", "Parkway ReadyCash", "Polaris Bank",
    "PremiumTrust Bank", "Providus Bank", "Quick Fund MFB", "Rubies MFB",
    "Safe Haven MFB", "Sparkle Microfinance Bank", "Stanbic IBTC Bank",
    "Standard Chartered Bank", "Sterling Bank", "Suntrust Bank", "TAJ Bank",
    "Triumphant MFB", "Union Bank of Nigeria", "United Bank for Africa (UBA)",
    "Unity Bank", "VFD Microfinance Bank", "Wema Bank", "Zenith Bank"
];

function initBankDropdown() {
    const listUl = document.getElementById("bank-list-ul");
    if (!listUl) return;
    
    listUl.innerHTML = "";
    NIGERIAN_BANKS.forEach(bank => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.alignItems = "center";
        li.style.gap = "10px";
        
        // Generate initials
        const parts = bank.split(" ");
        let initials = parts[0].substring(0, 1);
        if (parts[1] && !parts[1].startsWith("(")) {
            initials += parts[1].substring(0, 1);
        }
        initials = initials.toUpperCase().substring(0, 2);
        
        // Generate stable background colors based on initials charcodes
        const colors = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#3b82f6", "#ef4444"];
        const charCodeSum = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
        const color = colors[charCodeSum % colors.length];
        
        const avatar = document.createElement("div");
        avatar.className = "bank-avatar";
        avatar.textContent = initials;
        avatar.style.background = color;
        
        const nameSpan = document.createElement("span");
        nameSpan.textContent = bank;
        
        li.appendChild(avatar);
        li.appendChild(nameSpan);
        li.setAttribute("data-value", bank);
        li.onclick = () => selectBank(bank);
        listUl.appendChild(li);
    });

    // Close dropdown on click outside
    document.addEventListener("click", function(e) {
        const dropdown = document.getElementById("bank-name-dropdown");
        const container = document.getElementById("bank-name-search-container");
        if (dropdown && container && !container.contains(e.target)) {
            dropdown.classList.remove("active");
        }
    });
}

function toggleBankDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById("bank-name-dropdown");
    if (dropdown) {
        const isActive = dropdown.classList.toggle("active");
        if (isActive) {
            const searchInput = document.getElementById("bank-search-input");
            if (searchInput) {
                searchInput.value = "";
                filterBanks("");
                searchInput.focus();
            }
        }
    }
}

function selectPopularBank(bankName) {
    selectBank(bankName);
}

function selectBank(bankName) {
    const hiddenInput = document.getElementById("bank-name");
    const dropdown = document.getElementById("bank-name-dropdown");
    
    if (hiddenInput) {
        hiddenInput.value = bankName;
        hiddenInput.dispatchEvent(new Event("change"));
    }
    
    updateTriggerDisplay(bankName);
    
    // Update selected class in dropdown list
    const items = document.querySelectorAll("#bank-list-ul li");
    items.forEach(li => {
        if (li.getAttribute("data-value") === bankName) {
            li.classList.add("selected");
        } else {
            li.classList.remove("selected");
        }
    });
    
    // Update active class in popular bank cards
    const cards = document.querySelectorAll(".popular-bank-card");
    cards.forEach(card => {
        const onclickAttr = card.getAttribute("onclick");
        if (onclickAttr && onclickAttr.includes(bankName)) {
            card.classList.add("selected");
        } else {
            card.classList.remove("selected");
        }
    });
    
    if (dropdown) {
        dropdown.classList.remove("active");
    }
    
    handleBankAccountInput();
}

function updateTriggerDisplay(bankName) {
    const triggerLogo = document.getElementById("bank-name-trigger-logo");
    const triggerText = document.getElementById("bank-name-trigger-text");
    
    if (!triggerText) return;
    
    if (!bankName) {
        triggerText.textContent = "Select Bank Name";
        if (triggerLogo) triggerLogo.style.display = "none";
        return;
    }
    
    triggerText.textContent = bankName;
    
    if (triggerLogo) {
        // Generate initials
        const parts = bankName.split(" ");
        let initials = parts[0].substring(0, 1);
        if (parts[1] && !parts[1].startsWith("(")) {
            initials += parts[1].substring(0, 1);
        }
        initials = initials.toUpperCase().substring(0, 2);
        
        const colors = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#3b82f6", "#ef4444"];
        const charCodeSum = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
        const color = colors[charCodeSum % colors.length];
        
        triggerLogo.textContent = initials;
        triggerLogo.style.background = color;
        triggerLogo.style.display = "flex";
    }
}

let verificationTimeout = null;

function handleBankAccountInput() {
    const numInput = document.getElementById("bank-account-number");
    const bankInput = document.getElementById("bank-name");
    const holderInput = document.getElementById("bank-account-holder");
    const statusContainer = document.getElementById("account-verification-status");
    const saveBtn = document.getElementById("save-bank-btn");
    
    if (!numInput || !bankInput || !holderInput || !statusContainer) return;
    
    // Clean non-digits
    numInput.value = numInput.value.replace(/[^0-9]/g, '');
    
    // If not exactly 10 digits or no bank selected, reset verification status
    if (numInput.value.length < 10 || !bankInput.value) {
        holderInput.value = "";
        holderInput.placeholder = "Awaiting account details...";
        statusContainer.innerHTML = "";
        if (saveBtn) saveBtn.disabled = true;
        return;
    }
    
    // Debounce and trigger simulated resolver
    if (verificationTimeout) clearTimeout(verificationTimeout);
    
    statusContainer.innerHTML = `<span style="font-size:0.7rem; color:var(--primary); font-weight:700; display:flex; align-items:center; gap:4px;"><i class="fas fa-circle-notch fa-spin"></i> Verifying...</span>`;
    holderInput.value = "Resolving account name...";
    if (saveBtn) saveBtn.disabled = true;
    
    verificationTimeout = setTimeout(() => {
        // Resolve a mock verified name
        const mockName = (currentUser.name || "Abdallah").toUpperCase() + " " + bankInput.value.split(" ")[0].toUpperCase();
        holderInput.value = mockName;
        
        statusContainer.innerHTML = `<span style="font-size:0.68rem; font-weight:800; display:inline-flex; align-items:center; gap:4px; color:#10b981;"><i class="fas fa-circle-check"></i> ✓ Verified</span>`;
        if (saveBtn) saveBtn.disabled = false;
        showToast("Bank account verified successfully!", "success");
    }, 750);
}

function filterBanks(query) {
    const cleanQuery = query.toLowerCase().trim();
    const items = document.querySelectorAll("#bank-list-ul li");
    items.forEach(li => {
        const bankName = li.getAttribute("data-value").toLowerCase();
        if (bankName.includes(cleanQuery)) {
            li.style.display = "flex";
        } else {
            li.style.display = "none";
        }
    });
}

// Wallet Balance Hiding & Toggling with Smooth Fade Transitions
function toggleBalanceVisibility() {
    const balanceEl = document.getElementById("stat-wallet-balance");
    const balanceHeroEl = document.getElementById("stat-wallet-balance-hero");
    
    // Step 1: Trigger fade-out animation
    if (balanceEl) balanceEl.classList.add("balance-anim-fade-out");
    if (balanceHeroEl) balanceHeroEl.classList.add("balance-anim-fade-out");
    
    // Step 2: Swap values after fade-out transition completes (150ms)
    setTimeout(() => {
        const currentHidden = localStorage.getItem("hideBalance") === "true";
        localStorage.setItem("hideBalance", !currentHidden ? "true" : "false");
        
        // Re-calculate stats and update texts synchronously
        updateDashboardStats();
        
        // Step 3: Trigger fade-in animation
        setTimeout(() => {
            if (balanceEl) balanceEl.classList.remove("balance-anim-fade-out");
            if (balanceHeroEl) balanceHeroEl.classList.remove("balance-anim-fade-out");
        }, 40);
    }, 150);
}

function updateBalanceIconState(isHidden) {
    const icon = document.getElementById("toggle-balance-icon");
    const btn = document.getElementById("toggle-balance-btn");
    if (icon) {
        if (isHidden) {
            icon.className = "fas fa-eye-slash";
        } else {
            icon.className = "fas fa-eye";
        }
    }
    if (btn) {
        btn.setAttribute("title", isHidden ? "Show Balance" : "Hide Balance");
        btn.setAttribute("aria-label", isHidden ? "Show Balance" : "Hide Balance");
    }
}

// ==========================================
// HELP & SUPPORT SYSTEM MODULE (PORTAL LOGIC)
// ==========================================

let activeUserTicketId = null;
let userTicketFilename = "";
let userTicketBase64 = "";
let userChatFilename = "";
let userChatBase64 = "";
let typingTimeout = null;
let supportSkeletonsRendered = false;

// Initial Support panel workspace loading trigger
function loadSupportPortal() {
    if (!currentUser) return;
    
    // Reset skeleton loader state
    supportSkeletonsRendered = false;
    
    // Clear ticket form and file attachments
    const form = document.getElementById("user-ticket-form");
    if (form) form.reset();
    clearSelectedAttachment(null);
    validateTicketForm();
    
    // Prepopulate linked transaction values defensively
    onCategoryChange();
    
    // Render My Tickets list
    renderUserTicketsQueue();
    
    // Bind drag and drop zone listeners
    setupTicketDragAndDrop();
}

// Bind drag and drop listeners
function setupTicketDragAndDrop() {
    const dropzone = document.getElementById("tkt-dropzone");
    const fileInput = document.getElementById("tkt-attachment");
    if (!dropzone || !fileInput) return;
    
    // Click behavior
    dropzone.onclick = (e) => {
        // Prevent click trigger if they clicked remove file button
        if (e.target.closest('.btn-remove-file')) return;
        fileInput.click();
    };
    
    // Drag behaviors
    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
    });
    
    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("dragover");
    });
    
    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            fileInput.files = e.dataTransfer.files;
            handleUserTicketAttachmentSelect();
        }
    });
}

// Watch Category change to conditionally link transactions dynamically
function onCategoryChange() {
    const category = document.getElementById("tkt-category").value;
    const linkGroup = document.getElementById("tkt-link-tx-group");
    const linkSelect = document.getElementById("tkt-linked-tx");
    const linkLabel = document.getElementById("tkt-link-tx-label");
    
    if (!linkGroup || !linkSelect) return;
    
    const db = getDB();
    
    if (category === "Failed Gift Card Transaction") {
        linkGroup.style.display = "block";
        if (linkLabel) linkLabel.textContent = "Link Gift Card Submission";
        linkSelect.innerHTML = `<option value="">-- Choose Gift Card Submission --</option>`;
        
        // Find gift card reviews from submissions for current user
        const cards = (db.submissions || []).filter(sub => sub.userId === currentUser.email);
        if (cards.length === 0) {
            linkSelect.innerHTML = `<option value="">No recent gift card sales found</option>`;
        } else {
            cards.forEach(c => {
                const dateStr = new Date(c.createdAt).toLocaleDateString();
                linkSelect.innerHTML += `<option value="${c.id}">ID: ${c.id} - ${c.brand} ($${c.amount}) - [${c.status}] (${dateStr})</option>`;
            });
        }
    } else if (category === "Failed Withdrawal" || category === "Report Payment Delay") {
        linkGroup.style.display = "block";
        if (linkLabel) linkLabel.textContent = "Link Cash Withdrawal Request";
        linkSelect.innerHTML = `<option value="">-- Choose Cash Withdrawal --</option>`;
        
        // Find withdrawals for current user
        const cash = (db.withdrawals || []).filter(w => w.userId === currentUser.email);
        if (cash.length === 0) {
            linkSelect.innerHTML = `<option value="">No recent cash withdrawals found</option>`;
        } else {
            cash.forEach(w => {
                const dateStr = new Date(w.createdAt).toLocaleDateString();
                linkSelect.innerHTML += `<option value="${w.id}">ID: ${w.id} - ₦${w.amount.toLocaleString()} - [${w.status}] (${dateStr})</option>`;
            });
        }
    } else {
        linkGroup.style.display = "none";
        linkSelect.innerHTML = "";
    }
}

// Validate form state and toggle submit button
function validateTicketForm() {
    const subject = document.getElementById("tkt-subject").value.trim();
    const desc = document.getElementById("tkt-description").value.trim();
    const btn = document.getElementById("tkt-submit-btn");
    if (!btn) return;
    
    if (subject.length > 0 && desc.length > 0) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

// User side ticket creation file selection
function handleUserTicketAttachmentSelect() {
    const input = document.getElementById("tkt-attachment");
    const dzDefault = document.getElementById("tkt-dz-default");
    const progressContainer = document.getElementById("tkt-progress-container");
    const progressBar = document.getElementById("tkt-progress-bar");
    const progressPercent = document.getElementById("tkt-progress-percentage");
    const previewBox = document.getElementById("tkt-preview-box");
    const previewImg = document.getElementById("tkt-preview-img");
    const previewThumb = document.getElementById("tkt-preview-thumbnail-container");
    const previewIcon = document.getElementById("tkt-preview-icon-container");
    const previewFilename = document.getElementById("tkt-preview-filename");
    const previewFilesize = document.getElementById("tkt-preview-filesize");
    
    if (!input || !input.files || !input.files[0]) return;
    
    const file = input.files[0];
    
    // Size check
    if (file.size > 1.5 * 1024 * 1024) {
        showToast("Attachment size limit exceeded (Max 1.5MB).", "danger");
        clearSelectedAttachment(null);
        return;
    }
    
    // Hide default view, show progress bar container
    if (dzDefault) dzDefault.style.display = "none";
    if (previewBox) previewBox.style.display = "none";
    if (progressContainer) progressContainer.style.display = "block";
    
    // Start progress simulation
    let progress = 0;
    if (progressBar) progressBar.style.width = "0%";
    if (progressPercent) progressPercent.textContent = "0%";
    
    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 25) + 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            
            // Finish upload simulation
            setTimeout(() => {
                if (progressContainer) progressContainer.style.display = "none";
                if (previewBox) previewBox.style.display = "flex";
                
                // Set text metadata
                if (previewFilename) previewFilename.textContent = file.name;
                
                // Format size
                let sizeStr = "";
                if (file.size < 1024 * 1024) {
                    sizeStr = (file.size / 1024).toFixed(1) + " KB";
                } else {
                    sizeStr = (file.size / (1024 * 1024)).toFixed(1) + " MB";
                }
                if (previewFilesize) previewFilesize.textContent = sizeStr;
                
                // Preview images or files
                const isImage = file.type.startsWith("image/");
                if (isImage) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        userTicketFilename = file.name;
                        userTicketBase64 = e.target.result;
                        if (previewImg) previewImg.src = e.target.result;
                        if (previewThumb) previewThumb.style.display = "block";
                        if (previewIcon) previewIcon.style.display = "none";
                    };
                    reader.readAsDataURL(file);
                } else {
                    // PDF or Doc icon
                    userTicketFilename = file.name;
                    // Mock file contents
                    userTicketBase64 = "data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4c+...."; 
                    if (previewThumb) previewThumb.style.display = "none";
                    if (previewIcon) {
                        previewIcon.style.display = "block";
                        if (file.type === "application/pdf") {
                            previewIcon.innerHTML = `<i class="fas fa-file-pdf" style="color:#ef4444;"></i>`;
                        } else {
                            previewIcon.innerHTML = `<i class="fas fa-file-word" style="color:#3b82f6;"></i>`;
                        }
                    }
                }
                
                validateTicketForm();
            }, 200);
        }
        
        if (progressBar) progressBar.style.width = progress + "%";
        if (progressPercent) progressPercent.textContent = progress + "%";
    }, 100);
}

// Clear selected attachment
function clearSelectedAttachment(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    
    const input = document.getElementById("tkt-attachment");
    if (input) input.value = "";
    
    userTicketFilename = "";
    userTicketBase64 = "";
    
    const dzDefault = document.getElementById("tkt-dz-default");
    const progressContainer = document.getElementById("tkt-progress-container");
    const previewBox = document.getElementById("tkt-preview-box");
    
    if (dzDefault) dzDefault.style.display = "block";
    if (progressContainer) progressContainer.style.display = "none";
    if (previewBox) previewBox.style.display = "none";
    
    validateTicketForm();
}

// Submit ticket form handler
function handleUserSubmitTicket(e) {
    e.preventDefault();
    if (!validateUserStatusActive()) return;
    if (!currentUser) return;
    
    const subject = document.getElementById("tkt-subject").value.trim();
    const category = document.getElementById("tkt-category").value;
    const priority = document.getElementById("tkt-priority").value;
    const linkedTx = document.getElementById("tkt-linked-tx").value;
    const desc = document.getElementById("tkt-description").value.trim();
    const fileInput = document.getElementById("tkt-attachment");
    
    const processSubmit = () => {
        const db = getDB();
        if (!db.tickets) db.tickets = [];
        
        const newTicketId = "TKT-" + Math.floor(10000 + Math.random() * 90000);
        
        const newTicketObj = {
            id: newTicketId,
            userId: currentUser.email,
            title: subject,
            category: category,
            priority: priority,
            status: "OPEN",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            description: desc,
            attachments: userTicketBase64 ? [{ name: userTicketFilename, data: userTicketBase64 }] : [],
            assignedTo: "Unassigned",
            messages: [
                {
                    sender: "USER",
                    senderEmail: currentUser.email,
                    text: desc,
                    timestamp: new Date().toISOString(),
                    attachments: userTicketBase64 ? [{ name: userTicketFilename, data: userTicketBase64 }] : []
                }
            ],
            userUnread: false,
            adminUnread: true,
            userTyping: false,
            adminTyping: false,
            linkedTransactionId: linkedTx || null
        };
        
        db.tickets.push(newTicketObj);
        
        // Log ticket submission inside user security audit log
        if (!db.auditLogs) db.auditLogs = [];
        db.auditLogs.unshift({
            timestamp: new Date().toISOString(),
            userId: currentUser.email,
            event: "Support Ticket Opened",
            ip: "197.210.64.82"
        });
        
        saveDB(db);
        
        showToast(`Support Ticket ${newTicketId} opened successfully!`, "success");
        
        // Reset form variables
        document.getElementById("user-ticket-form").reset();
        clearSelectedAttachment(null);
        validateTicketForm();
        
        // Reload list and select this newly submitted ticket to inspect
        renderUserTicketsQueue();
        selectUserTicket(newTicketId);
        
        // Trigger cross-tab sync custom event
        window.dispatchEvent(new CustomEvent('goodfastpay_support_update', {
            detail: { ticketId: newTicketId, action: "CREATE" }
        }));
    };
    
    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(evt) {
            userTicketFilename = file.name;
            userTicketBase64 = evt.target.result;
            processSubmit();
        };
        reader.readAsDataURL(file);
    } else {
        processSubmit();
    }
}

// Render dynamic tickets queue on user desk
function renderUserTicketsQueue() {
    const db = getDB();
    const container = document.getElementById("user-tickets-container");
    if (!container) return;
    
    // Skeleton loader check
    if (!supportSkeletonsRendered) {
        container.innerHTML = `
            <div class="skeleton-card" style="margin-bottom: 12px;">
                <div class="skeleton-shimmer"></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <div class="skeleton-text" style="width: 30%; height: 10px; margin: 0;"></div>
                    <div class="skeleton-text" style="width: 20%; height: 10px; margin: 0;"></div>
                </div>
                <div class="skeleton-text" style="width: 85%; height: 14px; margin-bottom: 8px;"></div>
                <div style="display:flex; gap: 8px;">
                    <div class="skeleton-text" style="width: 15%; height: 12px; border-radius: 50px; margin: 0;"></div>
                    <div class="skeleton-text" style="width: 20%; height: 12px; border-radius: 50px; margin: 0;"></div>
                </div>
            </div>
            <div class="skeleton-card" style="margin-bottom: 12px;">
                <div class="skeleton-shimmer"></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <div class="skeleton-text" style="width: 25%; height: 10px; margin: 0;"></div>
                    <div class="skeleton-text" style="width: 25%; height: 10px; margin: 0;"></div>
                </div>
                <div class="skeleton-text" style="width: 60%; height: 14px; margin-bottom: 8px;"></div>
                <div style="display:flex; gap: 8px;">
                    <div class="skeleton-text" style="width: 15%; height: 12px; border-radius: 50px; margin: 0;"></div>
                    <div class="skeleton-text" style="width: 20%; height: 12px; border-radius: 50px; margin: 0;"></div>
                </div>
            </div>
        `;
        supportSkeletonsRendered = true;
        setTimeout(() => {
            renderUserTicketsQueue();
        }, 450);
        return;
    }
    
    container.innerHTML = "";
    const userTickets = (db.tickets || []).filter(t => t.userId === currentUser.email && t.status !== "ARCHIVED");
    
    if (userTickets.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-secondary); font-size: 0.85rem;">You have not submitted any support tickets yet.</div>`;
        return;
    }
    
    // Sort tickets by updated timestamp descending
    userTickets.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    userTickets.forEach(t => {
        const item = document.createElement("div");
        item.className = "user-ticket-item-card" + (t.id === activeUserTicketId ? " active" : "");
        item.onclick = () => selectUserTicket(t.id);
        
        let priorityStyle = "";
        if (t.priority === "CRITICAL") priorityStyle = "background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);";
        else if (t.priority === "HIGH") priorityStyle = "background: rgba(245, 158, 11, 0.1); color: #f59e0b;";
        else if (t.priority === "MEDIUM") priorityStyle = "background: rgba(59, 130, 246, 0.1); color: #3b82f6;";
        else priorityStyle = "background: rgba(156, 163, 175, 0.1); color: #9ca3af;";
        
        const priorityBadge = `<span class="ticket-priority-badge" style="${priorityStyle}">${t.priority}</span>`;
        
        // Status styling with colors requested:
        // Open (Green), Pending (Orange), Closed (Gray), Resolved (Blue)
        let statusStyle = "background: var(--bg-tertiary); color: var(--text-muted);";
        if (t.status === "OPEN") {
            statusStyle = "background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);";
        } else if (t.status === "PENDING") {
            statusStyle = "background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2);";
        } else if (t.status === "CLOSED" || t.status === "ARCHIVED") {
            statusStyle = "background: rgba(156, 163, 175, 0.1); color: #9ca3af; border: 1px solid rgba(156, 163, 175, 0.2);";
        } else if (t.status === "RESOLVED" || t.status === "IN_PROGRESS") {
            statusStyle = "background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2);";
        }
        
        const statusBadge = `<span class="currency-pill-badge" style="${statusStyle}">${t.status}</span>`;
        const unreadDot = t.userUnread ? `<div class="ticket-unread-dot"></div>` : "";
        
        const dateCreated = new Date(t.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: '2-digit'});
        const dateUpdated = new Date(t.updatedAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit'});
        const agentName = t.assignedTo || "Unassigned";
        
        item.innerHTML = `
            ${unreadDot}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                <span style="font-family: monospace; font-size: 0.72rem; color: var(--text-muted);">${t.id}</span>
                <span style="font-size: 0.68rem; color: var(--text-secondary);" title="Created Date"><i class="far fa-calendar" style="margin-right: 3px;"></i> ${dateCreated}</span>
            </div>
            <strong style="font-size: 0.88rem; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; display: block; max-width: 90%; margin-bottom: 4px;">${t.title}</strong>
            <div style="display:flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                ${priorityBadge}
                ${statusBadge}
                <span style="font-size: 0.72rem; color: var(--text-secondary); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.category}</span>
            </div>
            
            <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px; border-top: 1px dashed var(--border-color); padding-top: 6px; margin-top: 6px;">
                <div><span style="color:var(--text-secondary);">Last Update:</span> ${dateUpdated}</div>
                <div><span style="color:var(--text-secondary);">Assigned Agent:</span> <span style="font-weight:700; color:var(--text-primary);"><i class="fas fa-headset" style="font-size:0.7rem; color:var(--primary); margin-right: 3px;"></i> ${agentName}</span></div>
            </div>
            
            <div style="display:flex; justify-content: flex-end; gap: 8px; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                <button class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding: 4px 8px;" onclick="event.stopPropagation(); selectUserTicket('${t.id}')">View Details</button>
                ${t.status !== 'CLOSED' ? `
                    <button class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding: 4px 8px;" onclick="event.stopPropagation(); quickReplyTicket('${t.id}')"><i class="fas fa-reply"></i> Reply</button>
                    <button class="btn btn-danger btn-sm" style="font-size:0.72rem; padding: 4px 8px; background: rgba(239, 68, 68, 0.08); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);" onclick="event.stopPropagation(); closeTicketDirectly('${t.id}')">Close</button>
                ` : ''}
            </div>
        `;
        container.appendChild(item);
    });
}

// Quick Reply trigger (scroll/focus chat area)
function quickReplyTicket(ticketId) {
    selectUserTicket(ticketId);
    setTimeout(() => {
        const input = document.getElementById("user-chat-input");
        if (input) {
            input.focus();
            input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 120);
}

// Directly Close ticket from user-side card
function closeTicketDirectly(ticketId) {
    if (!confirm("Are you sure you want to mark this support ticket as closed?")) return;
    
    const db = getDB();
    const idx = db.tickets.findIndex(t => t.id === ticketId);
    if (idx === -1) return;
    
    db.tickets[idx].status = "CLOSED";
    db.tickets[idx].updatedAt = new Date().toISOString();
    db.tickets[idx].adminUnread = true; // Alerts admin
    
    // Add system alert in chat history
    db.tickets[idx].messages.push({
        sender: "SYSTEM",
        senderEmail: "system",
        text: "Ticket marked as CLOSED by the User.",
        timestamp: new Date().toISOString()
    });
    
    saveDB(db);
    showToast("Ticket closed successfully.", "success");
    
    // Redraw
    renderUserTicketsQueue();
    if (activeUserTicketId === ticketId) {
        selectUserTicket(ticketId);
    }
    
    window.dispatchEvent(new CustomEvent('goodfastpay_support_update', {
        detail: { ticketId: ticketId, action: "CLOSE_USER" }
    }));
}

// Select ticket to open active chat pane
function selectUserTicket(ticketId) {
    const db = getDB();
    const ticketIdx = (db.tickets || []).findIndex(t => t.id === ticketId);
    if (ticketIdx === -1) return;
    
    const t = db.tickets[ticketIdx];
    activeUserTicketId = ticketId;
    
    // Clear userUnread status immediately since user clicked it
    if (t.userUnread) {
        db.tickets[ticketIdx].userUnread = false;
        saveDB(db);
        updateUserSupportBadge();
    }
    
    const chatPane = document.getElementById("user-chat-console");
    if (chatPane) chatPane.style.display = "flex";
    
    const subjectEl = document.getElementById("user-chat-subject");
    if (subjectEl) subjectEl.textContent = t.title;
    const metaEl = document.getElementById("user-chat-meta");
    if (metaEl) metaEl.textContent = `Ticket ID: ${t.id} • Category: ${t.category}`;
    
    const statusEl = document.getElementById("user-chat-status");
    if (statusEl) {
        statusEl.className = "currency-pill-badge";
        statusEl.textContent = t.status;
        if (t.status === "OPEN") statusEl.style.background = "rgba(16, 185, 129, 0.1)";
        else if (t.status === "IN_PROGRESS") statusEl.style.background = "rgba(37, 99, 235, 0.1)";
    }
    
    // Reset file input variables in chat reply form
    const filenameEl = document.getElementById("user-chat-filename");
    if (filenameEl) filenameEl.textContent = "";
    const fileInput = document.getElementById("user-chat-attachment");
    if (fileInput) fileInput.value = "";
    userChatFilename = "";
    userChatBase64 = "";
    
    // Render Chat Messages
    renderUserChatMessages(t);
    
    // Refresh queue highlighting
    renderUserTicketsQueue();
}

// Draw messages timeline inside user side chat panel
function renderUserChatMessages(ticket) {
    const feed = document.getElementById("user-chat-feed");
    if (!feed) return;
    feed.innerHTML = "";
    
    const messages = ticket.messages || [];
    
    messages.forEach(msg => {
        if (msg.sender === "INTERNAL_NOTE") return;
        
        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.alignItems = msg.sender === "USER" ? "flex-end" : "flex-start";
        
        if (msg.sender === "SYSTEM") {
            const systemBubble = document.createElement("div");
            systemBubble.className = "chat-msg-system";
            systemBubble.textContent = msg.text;
            container.appendChild(systemBubble);
            feed.appendChild(container);
            return;
        }
        
        const bubble = document.createElement("div");
        bubble.className = "chat-msg-bubble " + (msg.sender === "USER" ? "chat-msg-user" : "chat-msg-admin");
        
        const senderLabel = `<span style="font-size: 0.65rem; font-weight:700; margin-bottom: 2px; color: ${msg.sender === "USER" ? "rgba(255,255,255,0.85)" : "var(--primary)"};">${msg.sender === "USER" ? "You" : "Support Agent"}</span>`;
        
        const textContent = `<p style="margin: 0; white-space: pre-wrap;">${msg.text || ""}</p>`;
        
        // Show file attachments if present
        let attachmentHTML = "";
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach(file => {
                attachmentHTML += `
                    <div style="margin-top: 8px; border: 1px solid ${msg.sender === 'USER' ? 'rgba(255,255,255,0.2)' : 'var(--border-color)'}; padding: 6px 10px; border-radius: 6px; background: ${msg.sender === 'USER' ? 'rgba(255,255,255,0.06)' : 'var(--bg-tertiary)'}; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; color: ${msg.sender === 'USER' ? 'white' : 'var(--text-primary)'};">${file.name}</span>
                        <a href="${file.data}" download="${file.name}" style="color: ${msg.sender === 'USER' ? 'white' : 'var(--primary)'}; font-size: 0.8rem;"><i class="fas fa-download"></i></a>
                    </div>
                `;
            });
        }
        
        const timestampVal = msg.timestamp ? new Date(msg.timestamp) : new Date();
        const dateStr = timestampVal.toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit'
        });
        
        // Read Receipt Checkmarks for USER messages
        let receiptHTML = "";
        if (msg.sender === "USER") {
            // If admin has read the ticket (adminUnread === false), show double checkmarks
            const isReadByAdmin = ticket.adminUnread === false;
            receiptHTML = isReadByAdmin 
                ? `<span style="color:#60a5fa; font-size:0.75rem; margin-left: 6px;" title="Read by Admin"><i class="fas fa-check-double"></i></span>`
                : `<span style="color:rgba(255,255,255,0.6); font-size:0.75rem; margin-left: 6px;" title="Sent"><i class="fas fa-check"></i></span>`;
        }
        
        bubble.innerHTML = `
            ${senderLabel}
            ${textContent}
            ${attachmentHTML}
            <div style="display:flex; justify-content:flex-end; align-items:center;">
                <span class="chat-msg-meta">${dateStr}</span>
                ${receiptHTML}
            </div>
        `;
        
        container.appendChild(bubble);
        feed.appendChild(container);
    });
    
    // Auto scroll bottom
    feed.scrollTop = feed.scrollHeight;
}

// User side chat file attachment selection
function handleUserChatAttachmentSelect() {
    const input = document.getElementById("user-chat-attachment");
    const nameEl = document.getElementById("user-chat-filename");
    if (!input || !nameEl) return;
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 1.5 * 1024 * 1024) {
            showToast("Attachment file exceeds 1.5MB size limit.", "danger");
            input.value = "";
            nameEl.textContent = "";
            return;
        }
        nameEl.textContent = file.name;
    }
}

// Typing notification triggered when user enters inputs
function handleUserTyping() {
    if (!activeUserTicketId) return;
    
    const db = getDB();
    const idx = (db.tickets || []).findIndex(t => t.id === activeUserTicketId);
    if (idx !== -1) {
        db.tickets[idx].userTyping = true;
        saveDB(db);
        
        window.dispatchEvent(new CustomEvent('goodfastpay_support_update', {
            detail: { ticketId: activeUserTicketId, action: "TYPING_USER" }
        }));
        
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            const db2 = getDB();
            const idx2 = db2.tickets.findIndex(t => t.id === activeUserTicketId);
            if (idx2 !== -1) {
                db2.tickets[idx2].userTyping = false;
                saveDB(db2);
                window.dispatchEvent(new CustomEvent('goodfastpay_support_update', {
                    detail: { ticketId: activeUserTicketId, action: "TYPING_USER_STOP" }
                }));
            }
        }, 1500);
    }
}

// Send chat message reply from user console
function handleUserChatReply(e) {
    e.preventDefault();
    if (!validateUserStatusActive()) return;
    if (!currentUser || !activeUserTicketId) return;
    
    const replyInput = document.getElementById("user-chat-input");
    const fileInput = document.getElementById("user-chat-attachment");
    const filenameEl = document.getElementById("user-chat-filename");
    
    const text = replyInput.value.trim();
    if (text === "" && !fileInput.files[0]) return;
    
    const db = getDB();
    const ticketIdx = db.tickets.findIndex(t => t.id === activeUserTicketId);
    if (ticketIdx === -1) return;
    
    const appendReply = () => {
        const newMsg = {
            sender: "USER",
            senderEmail: currentUser.email,
            text: text || "Sent an attachment.",
            timestamp: new Date().toISOString(),
            attachments: userChatBase64 ? [{ name: userChatFilename, data: userChatBase64 }] : []
        };
        
        db.tickets[ticketIdx].messages.push(newMsg);
        db.tickets[ticketIdx].updatedAt = new Date().toISOString();
        db.tickets[ticketIdx].adminUnread = true; // Alerts admin
        db.tickets[ticketIdx].userTyping = false; // Stop typing
        
        // Reopen ticket automatically if Closed/Resolved and user replies
        if (db.tickets[ticketIdx].status === "CLOSED" || db.tickets[ticketIdx].status === "RESOLVED") {
            db.tickets[ticketIdx].status = "OPEN";
            db.tickets[ticketIdx].messages.push({
                sender: "SYSTEM",
                senderEmail: "system",
                text: "Ticket has been automatically reopened due to user response.",
                timestamp: new Date().toISOString()
            });
        }
        
        saveDB(db);
        
        replyInput.value = "";
        fileInput.value = "";
        filenameEl.textContent = "";
        userChatFilename = "";
        userChatBase64 = "";
        
        // Redraw
        renderUserChatMessages(db.tickets[ticketIdx]);
        selectUserTicket(activeUserTicketId);
        
        // Trigger cross-tab sync
        window.dispatchEvent(new CustomEvent('goodfastpay_support_update', {
            detail: { ticketId: activeUserTicketId, action: "REPLY_USER" }
        }));
    };
    
    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(evt) {
            userChatFilename = file.name;
            userChatBase64 = evt.target.result;
            appendReply();
        };
        reader.readAsDataURL(file);
    } else {
        appendReply();
    }
}

// Help center FAQs Search filtering with matching word highlights
function filterFAQs() {
    const searchInput = document.getElementById("faq-search");
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    const items = document.querySelectorAll("#faq-container .faq-item");
    
    items.forEach(item => {
        const questionSpan = item.querySelector(".faq-trigger span");
        const answerP = item.querySelector(".faq-content p");
        
        // Cache original values on first load defensively
        if (!questionSpan.hasAttribute("data-orig-text")) {
            questionSpan.setAttribute("data-orig-text", questionSpan.innerHTML);
        }
        if (!answerP.hasAttribute("data-orig-text")) {
            answerP.setAttribute("data-orig-text", answerP.innerHTML);
        }
        
        const origQuestion = questionSpan.getAttribute("data-orig-text");
        const origAnswer = answerP.getAttribute("data-orig-text");
        
        if (query === "") {
            // Restore originals
            questionSpan.innerHTML = origQuestion;
            answerP.innerHTML = origAnswer;
            item.style.display = "block";
            return;
        }
        
        // Match checking
        const lowercaseQuestion = origQuestion.toLowerCase();
        const lowercaseAnswer = origAnswer.toLowerCase();
        const lowercaseQuery = query.toLowerCase();
        
        const matchesQuestion = lowercaseQuestion.includes(lowercaseQuery);
        const matchesAnswer = lowercaseAnswer.includes(lowercaseQuery);
        
        if (matchesQuestion || matchesAnswer) {
            item.style.display = "block";
            
            // Highlight matches using regex replace
            const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
            
            if (matchesQuestion) {
                questionSpan.innerHTML = origQuestion.replace(regex, "<mark>$1</mark>");
            } else {
                questionSpan.innerHTML = origQuestion;
            }
            
            if (matchesAnswer) {
                answerP.innerHTML = origAnswer.replace(regex, "<mark>$1</mark>");
            } else {
                answerP.innerHTML = origAnswer;
            }
        } else {
            item.style.display = "none";
        }
    });
}

// Regex escape helper
function escapeRegex(string) {
    const specials = ["-", "[", "]", "/", "{", "}", "(", ")", "*", "+", "?", ".", "\\", "^", "$", "|"];
    const regex = new RegExp("[" + specials.map(s => "\\" + s).join("") + "]", "g");
    return string.replace(regex, '\\$&');
}

// Collapsible accordion drawer trigger
function toggleFAQ(element) {
    const parent = element.parentElement;
    const isActive = parent.classList.contains("active");
    
    // Collapse all
    document.querySelectorAll("#faq-container .faq-item").forEach(item => {
        item.classList.remove("active");
        item.querySelector(".faq-content").style.maxHeight = "0";
    });
    
    if (!isActive) {
        parent.classList.add("active");
        const content = parent.querySelector(".faq-content");
        content.style.maxHeight = content.scrollHeight + "px";
    }
}

// Update sidebar unread support ticket notifications badge
function updateUserSupportBadge() {
    if (!currentUser) return;
    const db = getDB();
    
    const unreadCount = (db.tickets || []).filter(t => t.userId === currentUser.email && t.userUnread === true).length;
    
    const badge = document.getElementById("badge-user-support");
    if (badge) {
        if (unreadCount > 0) {
            badge.style.display = "inline-block";
            badge.textContent = unreadCount;
        } else {
            badge.style.display = "none";
        }
    }
}

// Real-time update checks for new admin replies
function setupUserSupportRealTimeCheck() {
    // Immediate calculation of unread badges
    updateUserSupportBadge();
    
    // Cross-tab storage listeners sync
    window.addEventListener('storage', (e) => {
        if (e.key === 'goodfastpay_db') {
            updateUserSupportBadge();
            syncUserActiveChat();
        }
    });
    
    // Custom support update sync listener
    window.addEventListener('goodfastpay_support_update', () => {
        updateUserSupportBadge();
        syncUserActiveChat();
    });
    
    // Poll loop checks (every 1.5 seconds)
    setInterval(() => {
        syncUserActiveChat();
        updateUserSupportBadge();
    }, 1500);
}

// Synchronize active chat messages and typing indicator status in real-time
function syncUserActiveChat() {
    if (!currentUser || !activeUserTicketId) return;
    
    const supportSection = document.getElementById("section-support");
    if (!supportSection || !supportSection.classList.contains("active")) return;
    
    const db = getDB();
    const t = (db.tickets || []).find(ticket => ticket.id === activeUserTicketId);
    if (!t) return;
    
    // 1. Sync messages length
    const msgBox = document.getElementById("user-chat-feed");
    const renderedCount = msgBox ? msgBox.childElementCount : 0;
    if (t.messages.length !== renderedCount) {
        renderUserChatMessages(t);
        
        // Clear unread flag automatically since user is viewing it
        if (t.userUnread) {
            const idx = db.tickets.findIndex(ticket => ticket.id === activeUserTicketId);
            if (idx !== -1) {
                db.tickets[idx].userUnread = false;
                saveDB(db);
                updateUserSupportBadge();
            }
        }
    }
    
    // 2. Sync admin typing indicator status
    const typingIndicator = document.getElementById("user-chat-typing");
    if (typingIndicator) {
        typingIndicator.style.display = t.adminTyping ? "inline-flex" : "none";
    }
    
    // 3. Sync status label
    const statusEl = document.getElementById("user-chat-status");
    if (statusEl && statusEl.textContent !== t.status) {
        statusEl.textContent = t.status;
        if (t.status === "OPEN") statusEl.style.background = "rgba(16, 185, 129, 0.1)";
        else if (t.status === "IN_PROGRESS") statusEl.style.background = "rgba(37, 99, 235, 0.1)";
        else statusEl.style.background = "var(--bg-tertiary)";
    }
}



