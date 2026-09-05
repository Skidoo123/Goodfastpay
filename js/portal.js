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
    renderLinkedBanks();
    renderSettingsProfile();
    
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
    
    if (element && element.classList.contains("sidebar-link")) {
        element.classList.add("active");
    } else {
        const matchingLink = Array.from(links).find(lnk => lnk.getAttribute("onclick") && lnk.getAttribute("onclick").includes(`'${sectionId}'`));
        if (matchingLink) matchingLink.classList.add("active");
    }

    // Sync Mobile Bottom Navigation Items
    const mobItems = document.querySelectorAll(".mobile-nav-item");
    mobItems.forEach(item => item.classList.remove("active"));
    if (sectionId === "dashboard") {
        const h = document.getElementById("mob-nav-home");
        if (h) h.classList.add("active");
    } else if (sectionId === "buy") {
        const b = document.getElementById("mob-nav-buy");
        if (b) b.classList.add("active");
    } else if (sectionId === "sell") {
        const s = document.getElementById("mob-nav-sell");
        if (s) s.classList.add("active");
    } else if (sectionId === "withdraw") {
        const w = document.getElementById("mob-nav-wallet");
        if (w) w.classList.add("active");
    } else if (sectionId === "settings" || sectionId === "bank" || sectionId === "logs") {
        const m = document.getElementById("mob-nav-settings");
        if (m) m.classList.add("active");
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
        renderLinkedBanks();
    } else if (sectionId === "logs") {
        renderSecurityLogs();
    } else if (sectionId === "settings") {
        renderSettingsProfile();
    } else if (sectionId === "support") {
        loadSupportPortal();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
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

// Supported Popular & Extended Brand Catalog definitions
const POPULAR_BRANDS = ["Steam", "Amazon", "Google Play", "Apple/iTunes", "Razer Gold", "Sephora"];
let isAllBrandsExpanded = false;

// Helper to get FontAwesome Icon & brand color
function getBrandIconMarkup(brand) {
    const b = (brand || "").toLowerCase();
    if (b.includes("steam")) return `<i class="fa-brands fa-steam" style="color: #171a21;"></i>`;
    if (b.includes("amazon")) return `<i class="fa-brands fa-amazon" style="color: #ff9900;"></i>`;
    if (b.includes("google play")) return `<i class="fa-brands fa-google-play" style="color: #34a853;"></i>`;
    if (b.includes("apple") || b.includes("itunes")) return `<i class="fa-brands fa-apple" style="color: #a3a3a3;"></i>`;
    if (b.includes("razer")) return `<i class="fa-solid fa-gamepad" style="color: #00ff00;"></i>`;
    if (b.includes("sephora")) return `<i class="fa-solid fa-gem" style="color: #e11d48;"></i>`;
    if (b.includes("xbox")) return `<i class="fa-brands fa-xbox" style="color: #107c10;"></i>`;
    if (b.includes("playstation") || b.includes("psn")) return `<i class="fa-brands fa-playstation" style="color: #003791;"></i>`;
    if (b.includes("nintendo")) return `<i class="fa-solid fa-gamepad" style="color: #e60012;"></i>`;
    if (b.includes("netflix")) return `<i class="fa-solid fa-film" style="color: #e50914;"></i>`;
    if (b.includes("spotify")) return `<i class="fa-brands fa-spotify" style="color: #1db954;"></i>`;
    if (b.includes("walmart")) return `<i class="fa-solid fa-asterisk" style="color: #0071dc;"></i>`;
    if (b.includes("target")) return `<i class="fa-solid fa-bullseye" style="color: #cc0000;"></i>`;
    if (b.includes("ebay")) return `<i class="fa-brands fa-ebay" style="color: #e53238;"></i>`;
    if (b.includes("nike")) return `<i class="fa-solid fa-bolt" style="color: #f97316;"></i>`;
    if (b.includes("best buy")) return `<i class="fa-solid fa-tag" style="color: #ffe000;"></i>`;
    if (b.includes("starbucks")) return `<i class="fa-solid fa-mug-hot" style="color: #00704a;"></i>`;
    if (b.includes("roblox")) return `<i class="fa-solid fa-cube" style="color: #e11d48;"></i>`;
    if (b.includes("uber")) return `<i class="fa-brands fa-uber" style="color: #ffffff;"></i>`;
    if (b.includes("airbnb")) return `<i class="fa-brands fa-airbnb" style="color: #ff5a5f;"></i>`;
    if (b.includes("visa")) return `<i class="fa-brands fa-cc-visa" style="color: #1a1f71;"></i>`;
    if (b.includes("mastercard")) return `<i class="fa-brands fa-cc-mastercard" style="color: #eb001b;"></i>`;
    if (b.includes("amex") || b.includes("american express")) return `<i class="fa-brands fa-cc-amex" style="color: #006fcf;"></i>`;
    if (b.includes("paypal")) return `<i class="fa-brands fa-paypal" style="color: #003087;"></i>`;
    if (b.includes("discord")) return `<i class="fa-brands fa-discord" style="color: #5865f2;"></i>`;
    if (b.includes("twitch")) return `<i class="fa-brands fa-twitch" style="color: #9146ff;"></i>`;
    if (b.includes("h&m") || b.includes("zara") || b.includes("asos")) return `<i class="fa-solid fa-shirt" style="color: #f43f5e;"></i>`;
    return `<i class="fa-solid fa-gift" style="color: #10b981;"></i>`;
}

// Populate Selling dropdown elements & dynamic visual brand chips
function populateSellOptions() {
    const db = getDB();
    const rates = db.settings.rates || {};
    
    const brandSelect = document.getElementById("sell-brand");
    if (!brandSelect) return;
    
    // Save selected brand to restore later (defaults to Steam)
    let currentVal = brandSelect.value || "Steam";
    brandSelect.innerHTML = "";
    
    // Collect all brands across categories
    const allBrandsSet = new Set();
    Object.keys(GIFT_CARD_CATEGORIES).forEach(cat => {
        GIFT_CARD_CATEGORIES[cat].forEach(brand => allBrandsSet.add(brand));
    });
    // Add any existing rate brands
    Object.keys(rates).forEach(brand => allBrandsSet.add(brand));
    
    const allBrandsList = Array.from(allBrandsSet);
    
    // Populate hidden select options grouped by category
    Object.keys(GIFT_CARD_CATEGORIES).forEach(category => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = category;
        
        GIFT_CARD_CATEGORIES[category].forEach(brand => {
            const opt = document.createElement("option");
            opt.value = brand;
            opt.textContent = brand;
            optgroup.appendChild(opt);
        });
        
        if (optgroup.children.length > 0) {
            brandSelect.appendChild(optgroup);
        }
    });
    
    if (Array.from(brandSelect.options).some(o => o.value === currentVal)) {
        brandSelect.value = currentVal;
    } else if (brandSelect.options.length > 0) {
        brandSelect.value = brandSelect.options[0].value;
        currentVal = brandSelect.value;
    }
    
    // Render Popular and All Brand visual chips
    renderBrandChipsCatalog(currentVal, allBrandsList);
    
    updateSellCurrencyOptions();
}

// Render dynamic visual brand chips grid
function renderBrandChipsCatalog(selectedBrand, allBrandsList) {
    const popularContainer = document.getElementById("brand-select-popular");
    const allContainer = document.getElementById("brand-select-all");
    const countEl = document.getElementById("all-brands-count");
    
    if (popularContainer) popularContainer.innerHTML = "";
    if (allContainer) allContainer.innerHTML = "";
    
    // 1. Render Popular Brands
    POPULAR_BRANDS.forEach(brand => {
        if (popularContainer) {
            const isActive = brand.toLowerCase() === selectedBrand.toLowerCase() || 
                           (brand === "Apple/iTunes" && selectedBrand.toLowerCase().includes("apple"));
            const card = document.createElement("div");
            card.className = `brand-card-item ${isActive ? 'active' : ''}`;
            card.setAttribute("data-brand", brand.toLowerCase());
            card.onclick = () => selectBrandCard(brand, card);
            card.innerHTML = `
                ${getBrandIconMarkup(brand)}
                <span class="brand-name-label">${brand}</span>
            `;
            popularContainer.appendChild(card);
        }
    });
    
    // 2. Render All Other Brands
    const remainingBrands = allBrandsList.filter(b => !POPULAR_BRANDS.includes(b));
    if (countEl) countEl.textContent = `${allBrandsList.length}+`;
    
    if (allContainer) {
        remainingBrands.forEach(brand => {
            const isActive = brand.toLowerCase() === selectedBrand.toLowerCase();
            const card = document.createElement("div");
            card.className = `brand-card-item ${isActive ? 'active' : ''}`;
            card.setAttribute("data-brand", brand.toLowerCase());
            card.onclick = () => selectBrandCard(brand, card);
            card.innerHTML = `
                ${getBrandIconMarkup(brand)}
                <span class="brand-name-label">${brand}</span>
            `;
            allContainer.appendChild(card);
        });
    }
    
    // Update indicator
    const indicator = document.getElementById("selected-brand-indicator");
    if (indicator) indicator.textContent = `Selected: ${selectedBrand}`;
}

// Select Brand Card via Visual Chips (Screen 1 Fidelity)
function selectBrandCard(brandName, element) {
    // Remove active from all chips across all sections
    const allChips = document.querySelectorAll(".brand-card-item");
    allChips.forEach(chip => chip.classList.remove("active"));
    
    // Set active on matching cards
    const matchingChips = document.querySelectorAll(`.brand-card-item[data-brand="${brandName.toLowerCase()}"]`);
    matchingChips.forEach(chip => chip.classList.add("active"));
    if (element) element.classList.add("active");

    const indicator = document.getElementById("selected-brand-indicator");
    if (indicator) indicator.textContent = `Selected: ${brandName}`;

    const brandSelect = document.getElementById("sell-brand");
    if (brandSelect) {
        let match = Array.from(brandSelect.options).find(o => o.value.toLowerCase() === brandName.toLowerCase());
        if (!match) {
            match = Array.from(brandSelect.options).find(o => o.value.toLowerCase().includes(brandName.toLowerCase()) || brandName.toLowerCase().includes(o.value.toLowerCase()));
        }
        if (match) {
            brandSelect.value = match.value;
        } else {
            // Add custom option if not present
            const opt = document.createElement("option");
            opt.value = brandName;
            opt.textContent = brandName;
            brandSelect.appendChild(opt);
            brandSelect.value = brandName;
        }
        updateSellCurrencyOptions();
    }
}

// Toggle Show More / Show Less for All Brands Catalog
function toggleAllBrandsCatalog() {
    const container = document.getElementById("all-brands-container");
    const textEl = document.getElementById("toggle-brands-text");
    const iconEl = document.getElementById("toggle-brands-icon");
    if (!container) return;
    
    isAllBrandsExpanded = !isAllBrandsExpanded;
    
    if (isAllBrandsExpanded) {
        container.style.display = "block";
        if (textEl) textEl.textContent = "Show Less";
        if (iconEl) iconEl.className = "fas fa-chevron-up";
    } else {
        container.style.display = "none";
        if (textEl) textEl.textContent = "Show More";
        if (iconEl) iconEl.className = "fas fa-chevron-down";
    }
}

// Search and filter brands in real time
function filterBrandCatalog(query) {
    const q = (query || "").trim().toLowerCase();
    const allContainer = document.getElementById("all-brands-container");
    const popularHeader = document.getElementById("popular-brands-header");
    const allHeader = document.getElementById("all-brands-header");
    const emptyState = document.getElementById("brand-search-empty");
    const textEl = document.getElementById("toggle-brands-text");
    const iconEl = document.getElementById("toggle-brands-icon");
    
    const allCards = document.querySelectorAll(".brand-card-item");
    let matchCount = 0;
    
    if (q) {
        // Automatically reveal all brands during search
        if (allContainer) allContainer.style.display = "block";
        if (popularHeader) popularHeader.style.display = "none";
        if (allHeader) allHeader.style.display = "none";
        
        allCards.forEach(card => {
            const brand = card.getAttribute("data-brand") || "";
            if (brand.includes(q)) {
                card.style.display = "flex";
                matchCount++;
            } else {
                card.style.display = "none";
            }
        });
        
        if (emptyState) {
            emptyState.style.display = matchCount === 0 ? "block" : "none";
        }
    } else {
        // Reset to normal state
        if (popularHeader) popularHeader.style.display = "flex";
        if (allHeader) allHeader.style.display = "flex";
        if (emptyState) emptyState.style.display = "none";
        
        allCards.forEach(card => card.style.display = "flex");
        
        if (allContainer) {
            allContainer.style.display = isAllBrandsExpanded ? "block" : "none";
        }
        if (textEl) textEl.textContent = isAllBrandsExpanded ? "Show Less" : "Show More";
        if (iconEl) iconEl.className = isAllBrandsExpanded ? "fas fa-chevron-up" : "fas fa-chevron-down";
    }
}

function updateSellCurrencyOptions() {
    const db = getDB();
    const rates = db.settings.rates || {};
    const brandSelect = document.getElementById("sell-brand");
    const selectedBrand = brandSelect ? brandSelect.value : "Steam";
    const currencySelect = document.getElementById("sell-currency");
    
    if (!currencySelect) return;
    const selectedCurr = currencySelect.value;
    currencySelect.innerHTML = "";
    
    const activeCurrencies = db.currencies || {};
    
    // Look up exact or category-derived supported rates for selected brand
    let brandRates = rates[selectedBrand];
    if (!brandRates) {
        // Fallback default rates for newly selected catalog brand
        brandRates = DEFAULT_CARD_RATES[selectedBrand] || { USD: 1250, EUR: 1150, NGN: 1900 };
    }
    
    if (brandRates) {
        Object.keys(brandRates).forEach(curr => {
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

// Retrieve exact exchange rate synchronizing Currency Manager rates
function getCardExchangeRate(brand, currency) {
    const db = getDB();
    const currencies = db.currencies || {};
    const rates = db.settings ? (db.settings.rates || {}) : {};
    
    // Normalize currency keys to ISO currency standard code
    let code = currency || "USD";
    if (code === "USA" || code === "$") code = "USD";
    else if (code.includes("Europe") || ["Germany", "France", "Italy", "Spain", "Netherlands", "EUR", "€"].includes(code)) code = "EUR";
    else if (code === "UK" || code === "GBP" || code === "£") code = "GBP";
    else if (code === "Canada" || code === "CAD") code = "CAD";
    else if (code === "Australia" || code === "AUD") code = "AUD";
    else if (code.includes("CHF")) code = "CHF";
    else if (code.includes("JPY")) code = "JPY";
    else if (code.includes("CNY")) code = "CNY";
    else if (code.includes("HKD")) code = "HKD";
    else if (code.includes("SGD")) code = "SGD";
    else if (code.includes("NZD")) code = "NZD";
    else if (code.includes("AED")) code = "AED";
    else if (code.includes("SAR")) code = "SAR";
    else if (code.includes("ZAR")) code = "ZAR";
    else if (code.includes("INR")) code = "INR";
    else if (code === "NGN" || code === "₦") code = "NGN";

    // 1. Direct brand specific rate configured by Admin in Rates Manager (Ground Truth)
    if (brand && rates[brand]) {
        if (rates[brand][currency] !== undefined && rates[brand][currency] > 0) return rates[brand][currency];
        if (rates[brand][code] !== undefined && rates[brand][code] > 0) return rates[brand][code];
    }

    // 2. Direct Central Currency Manager base rate
    if (currencies[code] && currencies[code].rate !== undefined && currencies[code].rate > 0) {
        return currencies[code].rate;
    }
    if (currencies[currency] && currencies[currency].rate !== undefined && currencies[currency].rate > 0) {
        return currencies[currency].rate;
    }

    // 3. Fallback to active USD base rate or 1200
    if (currencies["USD"] && currencies["USD"].rate) {
        return currencies["USD"].rate;
    }
    return 1200;
}

// Update live estimation rate in trade workspace
function updateSellRate() {
    const brandSelect = document.getElementById("sell-brand");
    const currencySelect = document.getElementById("sell-currency");
    const valueInput = document.getElementById("sell-value");
    
    if (!brandSelect || !currencySelect || !valueInput) return;
    
    const brand = brandSelect.value;
    const currency = currencySelect.value;
    
    let val = parseFloat(valueInput.value);
    if (isNaN(val) || val <= 0) val = 0;
    
    let rate = getCardExchangeRate(brand, currency);
    if (typeof getLoyaltyRateMultiplier === "function") {
        rate = Math.round(rate * getLoyaltyRateMultiplier());
    }
    const payout = val * rate;
    const symbol = getCurrencySymbol(currency) || "$";
    
    // Update Currency Symbol Prefix in Input
    const currSymEl = document.getElementById("sell-currency-symbol");
    if (currSymEl) currSymEl.textContent = symbol;

    // Update Live Rate Tag Pill
    const rateBadgeEl = document.getElementById("sell-rate-badge-text");
    if (rateBadgeEl) rateBadgeEl.textContent = `Current Rate: ₦${rate.toLocaleString()} / ${symbol}1`;

    const exchangeTextEl = document.getElementById("sell-exchange-text");
    if (exchangeTextEl) exchangeTextEl.textContent = `₦${rate.toLocaleString()} / ${symbol}1`;
    
    const payoutResultEl = document.getElementById("sell-payout-result");
    if (payoutResultEl) payoutResultEl.textContent = payout.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// Process base64 file preview uploads with high resolution Canvas preservation for crisp admin viewing
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
                
                // High Quality resolution for crystal clear legibility in Admin Inspection
                const MAX_WIDTH = 1600;
                const MAX_HEIGHT = 1200;
                
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
                
                // Export crisp high quality JPEG (0.95 quality)
                const compressedBase64 = canvas.toDataURL("image/jpeg", 0.95);
                
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
    const rawCode = document.getElementById("sell-code").value.trim();
    
    const inputFront = document.getElementById("sell-img-front");
    const inputBack = document.getElementById("sell-img-back");
    
    const frontData = inputFront ? inputFront.getAttribute("data-base64") : null;
    const backData = inputBack ? inputBack.getAttribute("data-base64") : null;
    const hasImage = !!(frontData || backData);
    const hasCode = !!rawCode;

    if (isNaN(value) || value <= 0) {
        showToast("Please enter a valid card face value.", "danger");
        return;
    }

    if (!hasCode && !hasImage) {
        showToast("Please enter the card PIN code OR upload card front/back images.", "danger");
        return;
    }
    
    const code = rawCode || "(Uploaded Card Scan Only)";
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin" style="margin-right: 8px;"></i> Verifying & Securing Trade...`;
    }
    
    // Fraud Detection: Checks if this exact card code was submitted before (if code was typed)
    setTimeout(() => {
        if (hasCode && isDuplicateCardCode(code)) {
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
        const defaultFrontSVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='240' viewBox='0 0 400 240'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e3a8a'/><stop offset='100%' stop-color='%233b82f6'/></linearGradient></defs><rect width='400' height='240' rx='12' fill='url(%23g)'/><text x='200' y='90' fill='white' font-family='sans-serif' font-weight='bold' font-size='20' text-anchor='middle'>${brand} Gift Card</text><text x='200' y='130' fill='white' font-family='sans-serif' font-weight='bold' font-size='18' text-anchor='middle'>${currency} ${value}</text><text x='200' y='170' fill='white' font-family='monospace' font-size='13' opacity='0.8' text-anchor='middle'>PIN: ${code}</text></svg>`;
        const defaultBackSVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='240' viewBox='0 0 400 240'><rect width='400' height='240' rx='12' fill='%23111827'/><rect x='30' y='40' width='340' height='50' fill='white'/><text x='200' y='150' fill='white' font-family='sans-serif' font-weight='bold' font-size='14' text-anchor='middle'>SECURITY BARCODE SCAN</text></svg>`;
        
        const frontBase64 = frontData || defaultFrontSVG;
        const backBase64 = backData || defaultBackSVG;
        
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
        
        // Push asynchronously to Supabase Cloud Database
        if (typeof supabasePushSubmission === "function") {
            supabasePushSubmission(newSubmission);
        }
        if (typeof supabasePushSecurityLog === "function") {
            supabasePushSecurityLog(currentUser.email, `Submitted Gift Card Trade: ${brand} (${currency} ${value})`, "client_ip", navigator.userAgent, `Trade ID: ${newSubmission.id} - ${brand} ${currency} ${value}`);
        }
        dispatchNotification(
            currentUser.email,
            "Gift Card Trade Submitted",
            `Your ${brand} card worth ${currency} ${value} has been submitted successfully and is pending admin validation.`
        );
        
        showToast("Gift card submitted successfully to admin review team.", "success");
        if (typeof triggerLivePayoutTracker === "function") {
            triggerLivePayoutTracker({ ref: submissionId, amount: (value * rate), title: brand + " Trade" });
        }
        
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

// Populate Withdrawal panel confirmation details (Screen 3 Fidelity)
function populateWithdrawConfirmDetails() {
    const db = getDB();
    const user = db.users[currentUser.email];
    
    const balNum = user.wallet.balance;
    const availBalDisplay = document.getElementById("withdraw-avail-balance-num");
    if (availBalDisplay) {
        availBalDisplay.textContent = balNum.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    const availBalHidden = document.getElementById("withdraw-avail-balance");
    if (availBalHidden) {
        availBalHidden.textContent = "₦" + balNum.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
    
    const bankSelect = document.getElementById("withdraw-bank-select");
    if (bankSelect) {
        bankSelect.innerHTML = "";
        if (user.bankDetails) {
            const masked = user.bankDetails.accountNumber.length >= 4 
                ? "**** " + user.bankDetails.accountNumber.slice(-4)
                : user.bankDetails.accountNumber;
            const opt = document.createElement("option");
            opt.value = "PRIMARY";
            opt.textContent = `${user.bankDetails.bankName} - ${masked}`;
            bankSelect.appendChild(opt);

            const nameEl = document.getElementById("withdraw-bank-name");
            if (nameEl) nameEl.textContent = user.bankDetails.bankName;
            const numEl = document.getElementById("withdraw-bank-number");
            if (numEl) numEl.textContent = user.bankDetails.accountNumber;
            const holderEl = document.getElementById("withdraw-bank-holder");
            if (holderEl) holderEl.textContent = user.bankDetails.accountHolderName;
        } else {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "No Bank Linked (Link in Settings)";
            bankSelect.appendChild(opt);
        }
    }

    updateWithdrawalBreakdown();
}

// Quick "Withdraw All" handler
function handleWithdrawAll() {
    const user = currentUser;
    if (!user) return;
    const amountInput = document.getElementById("withdraw-amount");
    if (amountInput) {
        amountInput.value = user.wallet.balance;
        updateWithdrawalBreakdown();
    }
}

// Update Withdrawal Breakdown Calculation (Screen 3 Fidelity)
function updateWithdrawalBreakdown() {
    const user = currentUser;
    const amountInput = document.getElementById("withdraw-amount");
    let amount = amountInput ? parseFloat(amountInput.value) : 0;
    if (isNaN(amount) || amount < 0) amount = 0;

    const fee = 50.00;
    const net = Math.max(0, amount - fee);

    const calcAmountEl = document.getElementById("calc-withdraw-amount");
    if (calcAmountEl) calcAmountEl.textContent = "₦" + amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

    const calcNetEl = document.getElementById("calc-net-payout");
    if (calcNetEl) calcNetEl.textContent = "₦" + net.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

    // Dynamic Button State Validation
    const submitBtn = document.getElementById("btn-submit-withdraw");
    if (submitBtn) {
        const hasBank = user && user.bankDetails && user.bankDetails.bankName;
        const hasBalance = user && user.wallet && (amount <= user.wallet.balance);
        const isValidAmount = amount >= 500;

        if (hasBank && hasBalance && isValidAmount) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";
        } else {
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.55";
            submitBtn.style.cursor = "not-allowed";
        }
    }
}

// =========================================================
// SOLID TRANSACTION PIN SECURITY CONTROLLER
// =========================================================

// State for custom PIN verification modal & security guard
let pendingPinAction = null;     // "withdraw", "purchase", "link_bank", "unlink_bank", "change_password", etc.
let pendingPinData = null;       // context payload { amount, cardId, bankName, etc. }
let pendingPinCallback = null;   // callback to execute on authorized PIN verification
let pendingPinSetupAction = null;// stores action if user was prompted to set PIN first

let pinFailedAttempts = 0;       // tracks consecutive failed PIN attempts
let pinLockoutUntil = 0;         // timestamp when lockout cooldown expires
let pinLockoutTimer = null;      // timer interval for countdown

/**
 * Universal Security Gatekeeper: Enforces Transaction PIN authorization on any sensitive action.
 * If user has no PIN configured yet, seamlessly prompts them to set up their 4-digit PIN first.
 */
function requireTransactionPin(action, data = {}, onAuthorized = null) {
    const db = getDB();
    const user = db.users[currentUser.email];
    
    if (!user) {
        showToast("User session expired. Please sign in again.", "danger");
        return;
    }

    // Check if user has set a valid 4-digit PIN
    if (!user.transactionPin || !/^\d{4}$/.test(user.transactionPin)) {
        // Guide user to set up their PIN first
        openTransactionPinSettingsModal({ action, data, callback: onAuthorized });
        return;
    }

    // Open PIN verification modal
    openPinVerificationModal(action, data, onAuthorized);
}

function openPinVerificationModal(action, data = {}, callback = null) {
    pendingPinAction = action;
    pendingPinData = data;
    pendingPinCallback = callback;
    
    const modal = document.getElementById("pin-verification-modal");
    if (!modal) return;

    modal.classList.add("active");
    
    // Check if currently locked out
    checkPinLockoutState();

    const titleEl = document.getElementById("pin-modal-title");
    const descEl = document.getElementById("pin-modal-desc");
    const contextBox = document.getElementById("pin-context-box");
    const contextTitle = document.getElementById("pin-context-title");
    const contextValue = document.getElementById("pin-context-value");

    if (contextBox) contextBox.style.display = "block";

    const db = getDB();
    const user = db.users[currentUser.email];

    // Configure contextual descriptions
    if (action === "withdraw") {
        if (titleEl) titleEl.textContent = "Authorize Cash Withdrawal";
        if (descEl) descEl.textContent = "Please enter your 4-digit PIN to release funds to your bank.";
        if (contextTitle) contextTitle.textContent = "Withdrawal Transfer";
        const bankStr = (data.bankName || (user.bankDetails ? user.bankDetails.bankName : "Linked Bank"));
        if (contextValue) contextValue.textContent = `₦${(data.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} → ${bankStr}`;
    } else if (action === "purchase") {
        const card = db.inventory.find(item => item.id === data.cardId);
        const cardTitle = card ? `${card.brand} (${card.currency} ${card.cardValue})` : "Gift Card";
        const cardPrice = card ? `₦${card.price.toLocaleString()}` : "Wallet Payout";
        
        if (titleEl) titleEl.textContent = "Authorize Card Purchase";
        if (descEl) descEl.textContent = "Enter your 4-digit PIN to deduct wallet funds and reveal card code.";
        if (contextTitle) contextTitle.textContent = "Card Purchase";
        if (contextValue) contextValue.textContent = `${cardTitle} • ${cardPrice}`;
    } else if (action === "link_bank") {
        if (titleEl) titleEl.textContent = "Authorize Bank Update";
        if (descEl) descEl.textContent = "Enter your 4-digit PIN to confirm new destination bank account.";
        if (contextTitle) contextTitle.textContent = "Bank Destination Update";
        if (contextValue) contextValue.textContent = `${data.bankName || 'Bank'} (${data.accountNumber || 'Account'})`;
    } else if (action === "unlink_bank") {
        if (titleEl) titleEl.textContent = "Authorize Account Removal";
        if (descEl) descEl.textContent = "Enter your 4-digit PIN to unlink this bank account.";
        if (contextTitle) contextTitle.textContent = "Unlink Bank Account";
        if (contextValue) contextValue.textContent = user.bankDetails ? `${user.bankDetails.bankName} (${user.bankDetails.accountNumber})` : "Current Bank";
    } else if (action === "change_password") {
        if (titleEl) titleEl.textContent = "Security Verification";
        if (descEl) descEl.textContent = "Enter your 4-digit Transaction PIN to confirm password update.";
        if (contextTitle) contextTitle.textContent = "Security Profile Change";
        if (contextValue) contextValue.textContent = "Login Password Modification";
    } else {
        if (titleEl) titleEl.textContent = "Enter Transaction PIN";
        if (descEl) descEl.textContent = "Please enter your 4-digit PIN to authorize this request.";
        if (contextBox) contextBox.style.display = "none";
    }

    // Reset boxes & error styles
    resetPinVerificationBoxes();
}

function closePinVerificationModal() {
    const modal = document.getElementById("pin-verification-modal");
    if (modal) {
        modal.classList.remove("active");
    }
    resetPinVerificationBoxes();
    pendingPinAction = null;
    pendingPinData = null;
    pendingPinCallback = null;
}

function resetPinVerificationBoxes() {
    const inputs = document.querySelectorAll("#pin-auth-form .pin-box");
    inputs.forEach(input => {
        input.value = "";
        input.classList.remove("pin-error", "pin-success");
    });
    const boxesContainer = document.getElementById("pin-boxes-container");
    if (boxesContainer) boxesContainer.classList.remove("pin-shake");

    // Focus first input if not locked out
    if (Date.now() >= pinLockoutUntil && inputs[0]) {
        setTimeout(() => inputs[0].focus(), 80);
    }
}

// Check & update brute-force lockout status
function checkPinLockoutState() {
    const banner = document.getElementById("pin-lockout-banner");
    const textEl = document.getElementById("pin-lockout-text");
    const submitBtn = document.getElementById("btn-verify-pin-submit");
    const inputs = document.querySelectorAll("#pin-auth-form .pin-box");

    if (Date.now() < pinLockoutUntil) {
        const remainingSecs = Math.ceil((pinLockoutUntil - Date.now()) / 1000);
        if (banner) banner.style.display = "flex";
        if (textEl) textEl.textContent = `Security Lockout: Too many failed attempts. Try again in ${remainingSecs}s`;
        if (submitBtn) submitBtn.disabled = true;
        inputs.forEach(inEl => inEl.disabled = true);

        if (!pinLockoutTimer) {
            pinLockoutTimer = setInterval(() => {
                if (Date.now() >= pinLockoutUntil) {
                    clearInterval(pinLockoutTimer);
                    pinLockoutTimer = null;
                    if (banner) banner.style.display = "none";
                    if (submitBtn) submitBtn.disabled = false;
                    inputs.forEach(inEl => inEl.disabled = false);
                    pinFailedAttempts = 0;
                    resetPinVerificationBoxes();
                } else {
                    const secs = Math.ceil((pinLockoutUntil - Date.now()) / 1000);
                    if (textEl) textEl.textContent = `Security Lockout: Too many failed attempts. Try again in ${secs}s`;
                }
            }, 1000);
        }
    } else {
        if (banner) banner.style.display = "none";
        if (submitBtn) submitBtn.disabled = false;
        inputs.forEach(inEl => inEl.disabled = false);
    }
}

// Paste Handler & Digit Auto-focusing
function handlePinInput(input, index) {
    if (Date.now() < pinLockoutUntil) return;

    // Fast paste handler: If user pasted multiple characters
    if (input.value.length > 1) {
        const digits = input.value.replace(/\D/g, "").slice(0, 4);
        const inputs = document.querySelectorAll("#pin-auth-form .pin-box");
        for (let i = 0; i < 4; i++) {
            if (inputs[i]) {
                inputs[i].value = digits[i] || "";
            }
        }
        if (digits.length === 4) {
            const form = document.getElementById("pin-auth-form");
            if (form) form.requestSubmit();
        } else if (inputs[digits.length]) {
            inputs[digits.length].focus();
        }
        return;
    }

    // Strip non-digits
    input.value = input.value.replace(/\D/g, "");
    
    // Auto-focus next input
    if (input.value.length >= 1) {
        const inputs = document.querySelectorAll("#pin-auth-form .pin-box");
        const next = inputs[index];
        if (next) {
            next.focus();
        } else if (index === 4) {
            // Instantly submit when 4th digit is entered!
            const form = document.getElementById("pin-auth-form");
            if (form) {
                form.requestSubmit();
            }
        }
    }
}

function handlePinKeydown(e, input, index) {
    const inputs = document.querySelectorAll("#pin-auth-form .pin-box");
    
    // Backspace: go to previous input on delete
    if (e.key === "Backspace") {
        if (input.value.length === 0) {
            const prev = inputs[index - 2];
            if (prev) {
                prev.focus();
                prev.value = "";
            }
        }
    } else if (e.key === "ArrowLeft") {
        const prev = inputs[index - 2];
        if (prev) prev.focus();
    } else if (e.key === "ArrowRight") {
        const next = inputs[index];
        if (next) next.focus();
    }
}

function handlePinAuthSubmit(e) {
    e.preventDefault();
    
    if (Date.now() < pinLockoutUntil) {
        showToast("PIN input is temporarily locked due to failed attempts. Please wait.", "danger");
        return;
    }

    const db = getDB();
    const user = db.users[currentUser.email];
    
    const inputs = document.querySelectorAll("#pin-auth-form .pin-box");
    let enteredPin = "";
    inputs.forEach(input => enteredPin += input.value.trim());
    
    if (enteredPin.length !== 4) {
        showToast("Please enter all 4 digits of your Transaction PIN.", "warning");
        return;
    }
    
    // Validate PIN
    if (enteredPin !== user.transactionPin) {
        pinFailedAttempts++;
        const remainingTries = Math.max(0, 5 - pinFailedAttempts);

        // Visual error shake & red highlights
        const boxesContainer = document.getElementById("pin-boxes-container");
        if (boxesContainer) {
            boxesContainer.classList.remove("pin-shake");
            void boxesContainer.offsetWidth; // trigger reflow
            boxesContainer.classList.add("pin-shake");
        }
        inputs.forEach(input => {
            input.classList.add("pin-error");
            input.value = "";
        });

        if (pinFailedAttempts >= 5) {
            pinLockoutUntil = Date.now() + 60000; // 60s cooldown
            checkPinLockoutState();
            
            // Log security warning
            user.logs.unshift({
                event: "Security Lockout: 5 consecutive invalid Transaction PIN attempts",
                timestamp: new Date().toISOString(),
                ip: "197.34.120.44"
            });
            saveDB(db);

            showToast("Security Lockout: 5 failed PIN attempts. Locked for 60 seconds.", "danger");
        } else {
            showToast(`Incorrect Transaction PIN. ${remainingTries} attempt${remainingTries === 1 ? '' : 's'} remaining.`, "danger");
            if (inputs[0]) inputs[0].focus();
        }
        return;
    }
    
    // Auth Success!
    pinFailedAttempts = 0;
    inputs.forEach(input => input.classList.add("pin-success"));

    const action = pendingPinAction;
    const data = pendingPinData;
    const callback = pendingPinCallback;
    
    setTimeout(() => {
        closePinVerificationModal();
        
        // Execute authorization callback or built-in actions
        if (typeof callback === "function") {
            callback();
        } else if (action === "withdraw") {
            executeWithdrawal(data.amount);
        } else if (action === "purchase") {
            executeCardPurchase(data.cardId);
        }
    }, 150);
}

function openForgotPinFromAuthModal() {
    closePinVerificationModal();
    openTransactionPinSettingsModal();
    switchPinSettingsTab('reset');
}

// -------------------------------------------------------------
// WITHDRAWAL LOGIC
// -------------------------------------------------------------

function executeWithdrawal(amount) {
    const db = getDB();
    const user = db.users[currentUser.email];
    
    if (amount > user.wallet.balance) {
        showToast("Insufficient wallet balance for withdrawal.", "danger");
        return;
    }

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
        event: `Withdrawal Authorized via PIN: ₦${amount.toLocaleString()}`,
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });
    
    saveDB(db);
    
    // Push asynchronously to Supabase Cloud Database
    if (typeof supabasePushWithdrawal === "function") {
        supabasePushWithdrawal(newRequest);
    }
    if (typeof supabaseUpdateProfile === "function") {
        supabaseUpdateProfile({ wallet: user.wallet });
    }
    if (typeof supabasePushSecurityLog === "function") {
        supabasePushSecurityLog(currentUser.email, `Cash Withdrawal Requested: ₦${amount.toLocaleString()}`, "client_ip", navigator.userAgent, `WD ID: ${newRequest.id} - ₦${amount.toLocaleString()} to ${user.bankDetails.bankName}`);
    }
    dispatchNotification(
        currentUser.email,
        "Withdrawal Request Authorized",
        `Your withdrawal of ₦${amount.toLocaleString()} to ${user.bankDetails.bankName} was securely authorized with your Transaction PIN. Pending admin payout approval.`
    );
    
    showToast("Withdrawal request authorized and created successfully!", "success");
    if (typeof triggerLivePayoutTracker === "function") {
        triggerLivePayoutTracker({ ref: withdrawalId, amount: amount, title: "Bank Cashout" });
    }
    
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
    
    if (isNaN(amount) || amount < 500) {
        showToast("Minimum withdrawal limit is ₦500.00.", "danger");
        return;
    }
    
    const db = getDB();
    const user = db.users[currentUser.email];
    
    if (amount > user.wallet.balance) {
        showToast("Insufficient wallet balance to fulfill withdrawal.", "danger");
        return;
    }
    
    if (!user.bankDetails) {
        showToast("Destination bank credentials not found. Link your bank account first.", "danger");
        return;
    }
    
    // Mandatory Transaction PIN Gatekeeper
    requireTransactionPin("withdraw", { amount: amount }, () => executeWithdrawal(amount));
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

// Render Combined transactions ledger cards (Responsive Mobile & Desktop)
function renderTransactionTable() {
    const db = getDB();
    const container = document.getElementById("dashboard-tx-container");
    if (!container) return;
    container.innerHTML = "";
    
    const userSubs = db.submissions ? db.submissions.filter(s => s.userId === currentUser.email) : [];
    const userWds = db.withdrawals ? db.withdrawals.filter(w => w.userId === currentUser.email) : [];
    const userPurchases = db.inventory ? db.inventory.filter(item => item.status === "SOLD" && item.purchasedBy === currentUser.email) : [];
    const userAdjustments = db.adjustments ? db.adjustments.filter(a => a.userId === currentUser.email) : [];
    
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
            rejection: s.rejectionReason,
            iconClass: "icon-cards",
            icon: "fas fa-ticket"
        });
    });
    
    userWds.forEach(w => {
        const maskedAcct = (w.accountNumber || '').length >= 4 
            ? `${(w.accountNumber || '').substring(0, 3)}***` 
            : (w.accountNumber || '');
        list.push({
            id: w.id,
            date: new Date(w.createdAt),
            type: "Cash Withdrawal",
            details: `${w.bankName || 'Bank'} (${maskedAcct})`,
            amount: w.amount,
            status: w.status,
            rejection: w.declineReason,
            iconClass: "icon-withdraw",
            icon: "fas fa-money-bill-transfer"
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
            rejection: null,
            iconClass: "icon-wallet",
            icon: "fas fa-cart-shopping"
        });
    });

    userAdjustments.forEach(a => {
        const isCredit = a.adjustmentType === "CREDIT" || (a.type && a.type.toLowerCase().includes("credit"));
        list.push({
            id: a.id,
            date: new Date(a.createdAt),
            type: isCredit ? "Admin Credit" : "Admin Deduction",
            details: a.reason || (isCredit ? "Wallet credited by Admin" : "Wallet deducted by Admin"),
            amount: a.amount,
            status: a.status || "COMPLETED",
            rejection: null,
            isCredit: isCredit,
            iconClass: isCredit ? "icon-wallet" : "icon-withdraw",
            icon: isCredit ? "fas fa-circle-plus" : "fas fa-circle-minus"
        });
    });

    // Also parse user logs for any admin wallet adjustments not in db.adjustments
    const dbUser = db.users ? db.users[currentUser.email] : null;
    if (dbUser && dbUser.logs && dbUser.logs.length > 0) {
        dbUser.logs.forEach((log, idx) => {
            if (log.event && log.event.includes("Admin Wallet Adjustment:")) {
                const isCredit = log.event.includes("+") || log.event.includes("Credited");
                let amt = 0;
                const match = log.event.match(/₦([\d,]+(\.\d+)?)/);
                if (match) {
                    amt = parseFloat(match[1].replace(/,/g, ""));
                }
                const logDate = new Date(log.timestamp);
                
                const exists = list.some(item => Math.abs(item.date - logDate) < 3000 && item.amount === amt);
                if (!exists && amt > 0) {
                    list.push({
                        id: `ADJ-LOG-${idx}`,
                        date: logDate,
                        type: isCredit ? "Admin Credit" : "Admin Deduction",
                        details: isCredit ? "Wallet credited by Admin" : "Wallet deducted by Admin",
                        amount: amt,
                        status: "COMPLETED",
                        rejection: null,
                        isCredit: isCredit,
                        iconClass: isCredit ? "icon-wallet" : "icon-withdraw",
                        icon: isCredit ? "fas fa-circle-plus" : "fas fa-circle-minus"
                    });
                }
            }
        });
    }
    
    // Sort descending by date
    list.sort((a,b) => b.date - a.date);
    
    if (list.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align:center; padding: 36px 16px; color: var(--text-muted); border-radius: 16px;">
                <i class="fas fa-receipt" style="font-size: 2.2rem; opacity: 0.35; margin-bottom: 12px; display:block;"></i>
                <p style="font-size: 1rem; font-weight: 700; color: var(--text-primary);">No Transaction Activities Yet</p>
                <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 4px;">Sell or buy gift cards or withdraw cash to track all movements here.</p>
            </div>
        `;
        return;
    }
    
    list.forEach(tx => {
        let statusBadge = "";
        if (tx.status === "PENDING") {
            statusBadge = `<span class="tx-badge-review"><span class="tx-dot-warning"></span> Review</span>`;
        } else if (tx.status === "COMPLETED") {
            statusBadge = `<span class="tx-badge-success"><span class="tx-dot-success"></span> Completed</span>`;
        } else {
            const reason = tx.rejection ? `title="${tx.rejection}"` : '';
            statusBadge = `<span class="tx-badge-danger" ${reason}><span class="tx-dot-danger"></span> Declined</span>`;
        }
        
        const dateFormatted = tx.date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const timeFormatted = tx.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let amountFormatted = "";
        let amountClass = "";
        if (tx.type === "Card Trade") {
            if (tx.status === "COMPLETED") {
                amountFormatted = `+₦${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
                amountClass = "amount-credit";
            } else {
                amountFormatted = `₦${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})} (Est.)`;
                amountClass = "amount-neutral";
            }
        } else if (tx.type === "Admin Credit" || tx.isCredit) {
            amountFormatted = `+₦${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            amountClass = "amount-credit";
        } else {
            amountFormatted = `-₦${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            amountClass = "amount-debit";
        }
        
        const card = document.createElement("div");
        card.className = "recent-tx-card";
        card.innerHTML = `
            <div class="tx-card-main-row">
                <div class="tx-card-left">
                    <div class="tx-icon-pill ${tx.iconClass}">
                        <i class="${tx.icon}"></i>
                    </div>
                    <div class="tx-info-block">
                        <div class="tx-type-title">${tx.type}</div>
                        <div class="tx-details-subtitle">${tx.details}</div>
                    </div>
                </div>
                <div class="tx-card-right">
                    <div class="tx-amount-display ${amountClass}">${amountFormatted}</div>
                    <div class="tx-status-container">${statusBadge}</div>
                </div>
            </div>
            <div class="tx-card-meta-row" style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 0.75rem;">
                <span class="tx-timestamp">${dateFormatted} • ${timeFormatted}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="tx-ref-id">ID: ${tx.id}</span>
                    <button type="button" onclick="openTransactionReceipt('${tx.id}', '${tx.type}')" style="background: rgba(3, 181, 211, 0.12); color: #03b5d3; border: 1px solid rgba(3, 181, 211, 0.25); padding: 3px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="View Digital Receipt">
                        <i class="fas fa-receipt"></i> Receipt
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// -------------------------------------------------------------
// DIGITAL TRANSACTION RECEIPT GENERATOR ENGINE
// -------------------------------------------------------------
let currentActiveReceiptId = null;

function openTransactionReceipt(txId, txType) {
    const db = getDB();
    let tx = null;
    
    // Search across submissions
    if (db.submissions) {
        const sub = db.submissions.find(s => s.id === txId);
        if (sub) {
            tx = {
                id: sub.id,
                type: "Gift Card Sale",
                amount: sub.payoutAmount !== null ? sub.payoutAmount : (sub.cardValue * 1200),
                status: sub.status,
                date: new Date(sub.createdAt),
                details: `${sub.brand} (${sub.currency} ${sub.cardValue})`,
                fee: 0
            };
        }
    }
    
    // Search across withdrawals
    if (!tx && db.withdrawals) {
        const wd = db.withdrawals.find(w => w.id === txId);
        if (wd) {
            tx = {
                id: wd.id,
                type: "Cash Withdrawal",
                amount: wd.amount,
                status: wd.status,
                date: new Date(wd.createdAt),
                details: `${wd.bankName} - ${wd.accountNumber}`,
                fee: wd.fee || 50
            };
        }
    }
    
    // Search across inventory purchases
    if (!tx && db.inventory) {
        const item = db.inventory.find(i => i.id === txId);
        if (item) {
            tx = {
                id: item.id,
                type: "Gift Card Purchase",
                amount: item.price,
                status: "COMPLETED",
                date: new Date(item.purchasedAt || Date.now()),
                details: `${item.brand} (${item.currency} ${item.cardValue})`,
                fee: 0
            };
        }
    }
    
    // Search across wallet adjustments
    if (!tx && db.adjustments) {
        const adj = db.adjustments.find(a => a.id === txId);
        if (adj) {
            const isCredit = adj.adjustmentType === "CREDIT" || (adj.type && adj.type.toLowerCase().includes("credit"));
            tx = {
                id: adj.id,
                type: isCredit ? "Admin Balance Credit" : "Admin Balance Deduction",
                amount: adj.amount,
                status: adj.status || "COMPLETED",
                date: new Date(adj.createdAt),
                details: adj.reason || "Wallet Adjustment by Admin",
                fee: 0
            };
        }
    }

    if (!tx) {
        tx = {
            id: txId,
            type: txType || "Account Transaction",
            amount: 0,
            status: "COMPLETED",
            date: new Date(),
            details: "Official System Transaction Record",
            fee: 0
        };
    }

    currentActiveReceiptId = tx.id;

    const amountValEl = document.getElementById("rcpt-amount-val");
    if (amountValEl) amountValEl.textContent = `₦${Number(tx.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    const typeEl = document.getElementById("rcpt-type");
    if (typeEl) typeEl.textContent = tx.type;

    const refEl = document.getElementById("rcpt-ref");
    if (refEl) refEl.textContent = tx.id;

    const dateEl = document.getElementById("rcpt-date");
    if (dateEl) dateEl.textContent = tx.date.toLocaleString();

    const detailsEl = document.getElementById("rcpt-details");
    if (detailsEl) detailsEl.textContent = tx.details;

    const feeEl = document.getElementById("rcpt-fee");
    if (feeEl) feeEl.textContent = tx.fee ? `₦${Number(tx.fee).toLocaleString(undefined, {minimumFractionDigits: 2})}` : "₦0.00 (Waived)";

    const badgeEl = document.getElementById("rcpt-status-badge");
    if (badgeEl) {
        if (tx.status === "PENDING") {
            badgeEl.className = "tx-badge-review";
            badgeEl.innerHTML = `<i class="fas fa-hourglass-half" style="margin-right: 4px;"></i> PENDING VERIFICATION`;
            badgeEl.style.background = "rgba(245, 158, 11, 0.15)";
            badgeEl.style.color = "#f59e0b";
        } else if (tx.status === "COMPLETED") {
            badgeEl.className = "tx-badge-success";
            badgeEl.innerHTML = `<i class="fas fa-check-circle" style="margin-right: 4px;"></i> SUCCESSFUL & SETTLED`;
            badgeEl.style.background = "rgba(16, 185, 129, 0.15)";
            badgeEl.style.color = "#10b981";
        } else {
            badgeEl.className = "tx-badge-danger";
            badgeEl.innerHTML = `<i class="fas fa-xmark-circle" style="margin-right: 4px;"></i> DECLINED / FAILED`;
            badgeEl.style.background = "rgba(239, 68, 68, 0.15)";
            badgeEl.style.color = "#ef4444";
        }
    }

    document.getElementById("receipt-modal").classList.add("active");
}

function closeReceiptModal() {
    document.getElementById("receipt-modal").classList.remove("active");
}

function downloadTransactionReceiptPDF() {
    const element = document.getElementById("receipt-printable-area");
    if (!element) return;
    
    showToast("Generating official digital PDF receipt...", "info");

    const opt = {
        margin:       [0.2, 0.2, 0.2, 0.2],
        filename:     `Goodfastpay_Receipt_${currentActiveReceiptId || 'TX'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#1c1f2c' },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    if (typeof html2pdf === "function") {
        html2pdf().set(opt).from(element).save().then(() => {
            showToast("PDF Receipt downloaded successfully!", "success");
        }).catch(err => {
            window.print();
        });
    } else {
        window.print();
    }
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

// Render withdrawal history ledger (Responsive Cards)
function renderWithdrawHistory() {
    const db = getDB();
    const container = document.getElementById("withdraw-ledger-container");
    if (!container) return;
    container.innerHTML = "";
    
    const list = db.withdrawals ? db.withdrawals.filter(w => w.userId === currentUser.email) : [];
    
    // Sort descending by creation date
    list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (list.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align:center; padding: 36px 16px; color: var(--text-muted); border-radius: 14px;">
                <i class="fas fa-money-bill-transfer" style="font-size: 2.2rem; opacity: 0.4; margin-bottom: 12px; display:block;"></i>
                <p style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">No Withdrawal History Yet</p>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">Initiate a cash withdrawal above to track settlements in this ledger.</p>
            </div>
        `;
        return;
    }
    
    list.forEach(w => {
        let statusBadge = "";
        if (w.status === "PENDING") statusBadge = `<span class="badge badge-warning" style="padding:4px 10px; font-weight:700; font-size:0.75rem;">Pending</span>`;
        else if (w.status === "COMPLETED") statusBadge = `<span class="badge badge-success" style="padding:4px 10px; font-weight:700; font-size:0.75rem;">Sent</span>`;
        else statusBadge = `<span class="badge badge-danger" style="padding:4px 10px; font-weight:700; font-size:0.75rem;" title="${w.declineReason || ''}">Failed</span>`;
        
        const dateStr = new Date(w.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const card = document.createElement("div");
        card.className = "withdraw-ledger-card";
        card.innerHTML = `
            <div class="withdraw-ledger-card-top">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="bank-card-icon-pill" style="width: 38px; height: 38px; font-size: 1rem; flex-shrink: 0;">
                        <i class="fas fa-building-columns"></i>
                    </div>
                    <div>
                        <div style="font-weight: 800; font-size: 0.92rem; color: var(--text-primary);">${w.bankName || 'Bank Transfer'}</div>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">${dateStr} • ${timeStr}</div>
                    </div>
                </div>
                <div>
                    ${statusBadge}
                </div>
            </div>
            <div class="withdraw-ledger-card-bottom">
                <div>
                    <span style="font-size: 0.72rem; color: var(--text-muted);">Payout Amount:</span>
                    <div style="font-weight: 800; font-size: 1.15rem; color: #10b981;">₦${w.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 0.72rem; color: var(--text-muted);">Fee Deducted:</span>
                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">₦50.00</div>
                </div>
            </div>
        `;
        container.appendChild(card);
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

// Render Security logs (Screen 5 Fidelity)
function renderSecurityLogs() {
    const db = getDB();
    const user = db.users[currentUser.email];
    const container = document.getElementById("security-logs-cards-container");
    if (!container) return;
    container.innerHTML = "";
    
    if (!user.logs || user.logs.length === 0) {
        container.innerHTML = `<div class="card" style="text-align:center; padding:32px; color:var(--text-muted);">No activity recorded yet.</div>`;
        return;
    }

    user.logs.forEach(log => {
        const card = document.createElement("div");
        card.className = "security-log-card";

        const evLower = (log.event || "").toLowerCase();
        let iconClass = "fa-solid fa-arrow-right-to-bracket";
        let iconType = "icon-login";

        if (evLower.includes("login")) {
            iconClass = "fa-solid fa-arrow-right-to-bracket";
            iconType = "icon-login";
        } else if (evLower.includes("withdraw")) {
            iconClass = "fa-solid fa-money-bill-transfer";
            iconType = "icon-withdraw";
        } else if (evLower.includes("password") || evLower.includes("pin")) {
            iconClass = "fa-solid fa-key";
            iconType = "icon-security";
        } else if (evLower.includes("bank")) {
            iconClass = "fa-solid fa-building-columns";
            iconType = "icon-bank";
        } else if (evLower.includes("fail") || evLower.includes("suspend") || evLower.includes("warn")) {
            iconClass = "fa-solid fa-triangle-exclamation";
            iconType = "icon-warning";
        } else {
            iconClass = "fa-solid fa-shield-halved";
            iconType = "icon-security";
        }

        const logDate = new Date(log.timestamp);
        const timeStr = logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = logDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

        card.innerHTML = `
            <div style="display: flex; align-items: center; flex: 1;">
                <div class="log-icon-pill ${iconType}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="security-log-content">
                    <div class="security-log-title">${log.event}</div>
                    <div class="security-log-subtitle">Nigeria • Web Browser</div>
                    <div class="security-log-ip">IP: ${log.ip || '197.34.120.44'}</div>
                </div>
            </div>
            <div class="security-log-time">${timeStr} <span style="font-size:0.7rem; color:var(--text-muted); display:block; text-align:right;">${dateStr}</span></div>
        `;
        container.appendChild(card);
    });
}

// Render Linked Bank Accounts (Screen 4 Fidelity)
function renderLinkedBanks() {
    const db = getDB();
    const user = db.users[currentUser.email];
    const container = document.getElementById("linked-banks-list-container");
    if (!container) return;
    container.innerHTML = "";

    if (!user.bankDetails) {
        container.innerHTML = `
            <div class="card" style="text-align:center; padding: 36px 20px; border-radius: 16px; margin-bottom: 16px;">
                <div class="bank-card-icon-pill" style="margin: 0 auto 14px; width: 56px; height: 56px; font-size: 1.5rem;">
                    <i class="fa-solid fa-building-columns"></i>
                </div>
                <h4 style="font-weight: 800; margin-bottom: 4px;">No Bank Account Linked</h4>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 18px;">Link your bank account to start withdrawing cash directly.</p>
                <button type="button" onclick="openAddBankModal()" class="btn btn-primary btn-sm">Add Bank Account</button>
            </div>
        `;
        return;
    }

    const b = user.bankDetails;
    const masked = b.accountNumber && b.accountNumber.length >= 4 
        ? "**** " + b.accountNumber.slice(-4) 
        : (b.accountNumber || "**** 0000");

    const card = document.createElement("div");
    card.className = "linked-bank-card";
    card.innerHTML = `
        <div style="display: flex; align-items: center; flex: 1;">
            <div class="bank-card-icon-pill">
                <i class="fa-solid fa-building-columns"></i>
            </div>
            <div class="bank-card-details">
                <div class="bank-name-text">${b.bankName}</div>
                <div class="account-holder-text">${b.accountHolderName || user.name}</div>
                <div class="account-number-masked">${masked}</div>
            </div>
        </div>
        <div class="bank-card-actions">
            <div class="bank-card-action-icon" onclick="openAddBankModal(true)" title="Edit Bank Details">
                <i class="fa-solid fa-pen"></i>
            </div>
            <div class="bank-card-action-icon delete-icon" onclick="deleteLinkedBankAccount()" title="Remove Bank Account">
                <i class="fa-regular fa-trash-can"></i>
            </div>
        </div>
    `;
    container.appendChild(card);
}

// Default professional avatar SVG data URI
const DEFAULT_AVATAR_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'%3E%3Crect width='100' height='100' fill='%231e293b'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%2394a3b8'/%3E%3Cpath d='M22 84c0-15.464 12.536-28 28-28s28 12.536 28 28' fill='%2394a3b8'/%3E%3C/svg%3E";

// Update All Avatar Instances Across the UI
function updateGlobalAvatars(avatarUrl) {
    if (!currentUser) return;
    const effectiveAvatar = avatarUrl || currentUser.avatar || null;
    
    // 1. Settings card avatar
    const settingsAvatar = document.getElementById("settings-avatar-img");
    if (settingsAvatar) {
        settingsAvatar.src = effectiveAvatar || DEFAULT_AVATAR_SVG;
    }
    
    // 2. Sidebar avatar
    const sidebarAvatar = document.getElementById("sidebar-user-avatar");
    if (sidebarAvatar) {
        if (effectiveAvatar) {
            sidebarAvatar.textContent = "";
            sidebarAvatar.style.backgroundImage = `url("${effectiveAvatar}")`;
            sidebarAvatar.style.backgroundSize = "cover";
            sidebarAvatar.style.backgroundPosition = "center";
            sidebarAvatar.style.backgroundColor = "transparent";
        } else {
            sidebarAvatar.style.backgroundImage = "none";
            sidebarAvatar.style.backgroundColor = "var(--primary)";
            sidebarAvatar.textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U";
        }
    }

    // 3. Sidebar user name
    const sidebarName = document.getElementById("sidebar-user-name");
    if (sidebarName) {
        sidebarName.textContent = currentUser.name || "User";
    }
}

// Render Settings Profile Details (Screen 2 Fidelity)
function renderSettingsProfile() {
    if (!currentUser) return;
    const nameEl = document.getElementById("settings-user-fullname");
    if (nameEl) nameEl.textContent = currentUser.name;
    updateGlobalAvatars(currentUser.avatar);
    updateVerificationBadges();
    updateSettingsPinStatus();
}

// ================= ACCOUNT SETTINGS VERIFICATION REQUIREMENTS =================

function checkUserVerification(user) {
    if (!user) return { isVerified: false, completed: 0, total: 4, items: [] };
    
    const items = [
        {
            id: "name",
            title: "Full Legal Name",
            desc: "Full name configured on profile",
            isComplete: Boolean(user.name && user.name.trim().length >= 3),
            actionText: "Set Name"
        },
        {
            id: "phone",
            title: "Phone Number",
            desc: "Active mobile phone connected",
            isComplete: Boolean(user.phone && user.phone.trim().length >= 7),
            actionText: "Set Phone"
        },
        {
            id: "bank",
            title: "Linked Bank Account",
            desc: "10-digit NUBAN bank account linked",
            isComplete: Boolean(user.bankDetails && user.bankDetails.bankName && user.bankDetails.accountNumber && user.bankDetails.accountNumber.length === 10),
            actionText: "Link Bank"
        },
        {
            id: "pin",
            title: "Transaction Security PIN",
            desc: "4-digit PIN configured for all transactions & withdrawals",
            isComplete: Boolean(user.transactionPin && /^\d{4}$/.test(user.transactionPin)),
            actionText: "Set PIN"
        }
    ];

    const completed = items.filter(i => i.isComplete).length;
    const isVerified = completed === items.length;
    return { isVerified, completed, total: items.length, items };
}

function updateVerificationBadges() {
    if (!currentUser) return;
    const db = getDB();
    const user = db.users[currentUser.email] || currentUser;
    const status = checkUserVerification(user);

    // 1. Settings Card Badge
    const settingsBadge = document.getElementById("settings-verified-badge");
    if (settingsBadge) {
        if (status.isVerified) {
            settingsBadge.className = "verified-pill-badge badge-verified";
            settingsBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verified`;
            settingsBadge.title = "All account verification requirements met";
        } else {
            settingsBadge.className = "verified-pill-badge badge-unverified";
            settingsBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Unverified (${status.completed}/${status.total})`;
            settingsBadge.title = "Tap to view missing verification requirements";
        }
    }

    // 2. Sidebar Profile Status
    const sidebarStatus = document.getElementById("sidebar-profile-status");
    if (sidebarStatus) {
        if (status.isVerified) {
            sidebarStatus.className = "sidebar-profile-status status-verified";
            sidebarStatus.innerHTML = `<i class="fas fa-circle-check"></i> Verified`;
            sidebarStatus.title = "Account Verified";
        } else {
            sidebarStatus.className = "sidebar-profile-status status-unverified";
            sidebarStatus.innerHTML = `<i class="fas fa-circle-exclamation"></i> Unverified`;
            sidebarStatus.title = "Tap Settings to complete verification";
        }
    }
}

function openVerificationModal() {
    if (!currentUser) return;
    const db = getDB();
    const user = db.users[currentUser.email] || currentUser;
    const status = checkUserVerification(user);
    const container = document.getElementById("verification-checklist-container");
    
    if (container) {
        container.innerHTML = "";
        status.items.forEach(item => {
            const row = document.createElement("div");
            row.className = "verification-check-item " + (item.isComplete ? "complete" : "incomplete");
            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                    <div class="check-icon-circle ${item.isComplete ? 'icon-done' : 'icon-pending'}">
                        <i class="${item.isComplete ? 'fa-solid fa-check' : 'fa-solid fa-clock'}"></i>
                    </div>
                    <div>
                        <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${item.title}</div>
                        <div style="font-size: 0.74rem; color: var(--text-secondary); margin-top: 1px;">${item.desc}</div>
                    </div>
                </div>
                <div>
                    ${item.isComplete 
                        ? `<span class="check-done-pill">✓ Done</span>` 
                        : `<button type="button" class="btn-check-action" onclick="handleVerificationAction('${item.id}')">${item.actionText}</button>`
                    }
                </div>
            `;
            container.appendChild(row);
        });
    }

    const modal = document.getElementById("verification-requirements-modal");
    if (modal) modal.classList.add("active");
}

function closeVerificationModal() {
    const modal = document.getElementById("verification-requirements-modal");
    if (modal) modal.classList.remove("active");
}

function handleVerificationAction(itemId) {
    closeVerificationModal();
    if (itemId === "name" || itemId === "phone") {
        openEditProfileModal();
    } else if (itemId === "bank") {
        openAddBankModal();
    } else if (itemId === "pin") {
        openTransactionPinSettingsModal();
    }
}

// ================= PROFILE PICTURE INTERACTIVE CROP & MANAGEMENT =================

// Action Sheet Controls
function openAvatarActionSheet() {
    const modal = document.getElementById("avatar-actionsheet-modal");
    if (modal) modal.classList.add("active");
}

function closeAvatarActionSheet() {
    const modal = document.getElementById("avatar-actionsheet-modal");
    if (modal) modal.classList.remove("active");
}

function triggerAvatarInput(source) {
    closeAvatarActionSheet();
    if (source === 'camera') {
        const camIn = document.getElementById("avatar-camera-input");
        if (camIn) camIn.click();
    } else {
        const photoIn = document.getElementById("avatar-photo-input");
        if (photoIn) photoIn.click();
    }
}

// Cropper In-Memory State
let cropperState = {
    img: null,
    scale: 1,
    baseScale: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    startX: 0,
    startY: 0
};

// Handle Image Selected from File Input / Camera
function handleAvatarFileSelected(inputEl) {
    if (!inputEl || !inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];
    
    // Validate File Type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/heic", "image/heif"];
    if (!validTypes.includes(file.type.toLowerCase()) && !file.type.startsWith("image/")) {
        showToast("Unsupported file format. Please choose a JPG, PNG, or WebP image.", "danger");
        inputEl.value = "";
        return;
    }

    // Validate File Size (10MB max source limit)
    if (file.size > 10 * 1024 * 1024) {
        showToast("Image is too large. Please select a photo under 10MB.", "danger");
        inputEl.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            initCropperWithImage(img);
        };
        img.onerror = function() {
            showToast("Failed to load image. Please try another image.", "danger");
        };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        showToast("Error reading selected file.", "danger");
    };
    reader.readAsDataURL(file);
    inputEl.value = "";
}

// Initialize Cropper Canvas & State
function initCropperWithImage(img) {
    const canvas = document.getElementById("avatar-cropper-canvas");
    if (!canvas) return;
    
    const canvasSize = 280;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Determine scale to cover the canvas circle
    const minDim = Math.min(img.width, img.height);
    const baseScale = canvasSize / minDim;

    cropperState = {
        img: img,
        baseScale: baseScale,
        scale: 1,
        offsetX: (canvasSize - img.width * baseScale) / 2,
        offsetY: (canvasSize - img.height * baseScale) / 2,
        isDragging: false,
        startX: 0,
        startY: 0
    };

    // Reset zoom slider
    const slider = document.getElementById("cropper-zoom-slider");
    if (slider) slider.value = 1;

    // Attach canvas drag listeners (Touch & Mouse)
    attachCropperEventListeners(canvas);

    // Open Modal and draw initial frame
    const modal = document.getElementById("avatar-cropper-modal");
    if (modal) modal.classList.add("active");
    drawCropperFrame();
}

function attachCropperEventListeners(canvas) {
    if (canvas._hasCropperListeners) return;
    canvas._hasCropperListeners = true;

    // Mouse Drag Events
    canvas.addEventListener("mousedown", (e) => {
        cropperState.isDragging = true;
        cropperState.startX = e.clientX - cropperState.offsetX;
        cropperState.startY = e.clientY - cropperState.offsetY;
    });

    window.addEventListener("mousemove", (e) => {
        if (!cropperState.isDragging || !cropperState.img) return;
        cropperState.offsetX = e.clientX - cropperState.startX;
        cropperState.offsetY = e.clientY - cropperState.startY;
        drawCropperFrame();
    });

    window.addEventListener("mouseup", () => {
        cropperState.isDragging = false;
    });

    // Mobile Touch Drag Events
    canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) {
            cropperState.isDragging = true;
            cropperState.startX = e.touches[0].clientX - cropperState.offsetX;
            cropperState.startY = e.touches[0].clientY - cropperState.offsetY;
        }
    }, { passive: true });

    canvas.addEventListener("touchmove", (e) => {
        if (!cropperState.isDragging || !cropperState.img || e.touches.length !== 1) return;
        cropperState.offsetX = e.touches[0].clientX - cropperState.startX;
        cropperState.offsetY = e.touches[0].clientY - cropperState.startY;
        drawCropperFrame();
    }, { passive: true });

    canvas.addEventListener("touchend", () => {
        cropperState.isDragging = false;
    });
}

function drawCropperFrame() {
    const canvas = document.getElementById("avatar-cropper-canvas");
    if (!canvas || !cropperState.img) return;
    const ctx = canvas.getContext("2d");
    const canvasSize = canvas.width;

    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Draw background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Calculate scaled dimensions
    const currentScale = cropperState.baseScale * cropperState.scale;
    const drawWidth = cropperState.img.width * currentScale;
    const drawHeight = cropperState.img.height * currentScale;

    // Draw Image
    ctx.drawImage(cropperState.img, cropperState.offsetX, cropperState.offsetY, drawWidth, drawHeight);

    // Draw Dark Dim Overlay Outside the Circle
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.beginPath();
    ctx.rect(0, 0, canvasSize, canvasSize);
    ctx.arc(canvasSize / 2, canvasSize / 2, (canvasSize / 2) - 4, 0, Math.PI * 2, true);
    ctx.fill();

    // Draw Crisp Green Circular Guide Border
    ctx.beginPath();
    ctx.arc(canvasSize / 2, canvasSize / 2, (canvasSize / 2) - 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
}

function onCropperZoomInput(val) {
    const newZoom = parseFloat(val);
    const canvasSize = 280;
    
    // Zoom around center point
    const oldTotalScale = cropperState.baseScale * cropperState.scale;
    const newTotalScale = cropperState.baseScale * newZoom;
    
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    
    const relX = (centerX - cropperState.offsetX) / oldTotalScale;
    const relY = (centerY - cropperState.offsetY) / oldTotalScale;
    
    cropperState.scale = newZoom;
    cropperState.offsetX = centerX - (relX * newTotalScale);
    cropperState.offsetY = centerY - (relY * newTotalScale);
    
    drawCropperFrame();
}

function adjustCropperZoom(delta) {
    const slider = document.getElementById("cropper-zoom-slider");
    if (!slider) return;
    let nextVal = parseFloat(slider.value) + delta;
    nextVal = Math.max(1, Math.min(3, nextVal));
    slider.value = nextVal;
    onCropperZoomInput(nextVal);
}

function closeAvatarCropperModal() {
    const modal = document.getElementById("avatar-cropper-modal");
    if (modal) modal.classList.remove("active");
    cropperState.img = null;
}

// Save Cropped Circular Avatar to DB and LocalStorage
function saveCroppedAvatar() {
    if (!cropperState.img || !currentUser) return;
    const saveBtn = document.getElementById("btn-save-avatar");
    if (saveBtn) {
        saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;
        saveBtn.disabled = true;
    }

    try {
        // Create high-res offscreen canvas
        const exportSize = 300;
        const offCanvas = document.createElement("canvas");
        offCanvas.width = exportSize;
        offCanvas.height = exportSize;
        const offCtx = offCanvas.getContext("2d");

        const ratio = exportSize / 280;
        const currentScale = cropperState.baseScale * cropperState.scale * ratio;
        const drawX = cropperState.offsetX * ratio;
        const drawY = cropperState.offsetY * ratio;
        const drawWidth = cropperState.img.width * currentScale;
        const drawHeight = cropperState.img.height * currentScale;

        // Draw image onto circular mask
        offCtx.save();
        offCtx.beginPath();
        offCtx.arc(exportSize / 2, exportSize / 2, exportSize / 2, 0, Math.PI * 2);
        offCtx.closePath();
        offCtx.clip();

        offCtx.drawImage(cropperState.img, drawX, drawY, drawWidth, drawHeight);
        offCtx.restore();

        // Export as compressed WebP or JPEG data URI (~40-60KB)
        const croppedDataUrl = offCanvas.toDataURL("image/jpeg", 0.88);

        // Update database and current session
        const db = getDB();
        if (db.users[currentUser.email]) {
            db.users[currentUser.email].avatar = croppedDataUrl;
            db.users[currentUser.email].logs.unshift({
                event: "Profile Picture Updated",
                timestamp: new Date().toISOString(),
                ip: "197.34.120.44"
            });
            saveDB(db);
        }

        currentUser.avatar = croppedDataUrl;
        setSessionUser(currentUser);

        // Global UI Update
        updateGlobalAvatars(croppedDataUrl);

        closeAvatarCropperModal();
        showToast("Profile picture updated successfully!", "success");
    } catch (err) {
        console.error("Error cropping avatar:", err);
        showToast("Failed to save profile picture. Please try again.", "danger");
    } finally {
        if (saveBtn) {
            saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Save Photo`;
            saveBtn.disabled = false;
        }
    }
}

// Remove Profile Picture
function removeProfilePicture() {
    closeAvatarActionSheet();
    if (!currentUser) return;
    
    if (confirm("Are you sure you want to remove your profile picture?")) {
        const db = getDB();
        if (db.users[currentUser.email]) {
            db.users[currentUser.email].avatar = null;
            db.users[currentUser.email].logs.unshift({
                event: "Profile Picture Removed",
                timestamp: new Date().toISOString(),
                ip: "197.34.120.44"
            });
            saveDB(db);
        }
        
        currentUser.avatar = null;
        setSessionUser(currentUser);
        
        updateGlobalAvatars(null);
        showToast("Profile picture removed.", "info");
    }
}

// Open / Close Add Bank Modal
function openAddBankModal(isEdit = false) {
    const modal = document.getElementById("add-bank-modal");
    if (modal) {
        modal.classList.add("active");
        if (currentUser && currentUser.bankDetails) {
            const b = currentUser.bankDetails;
            const nameSel = document.getElementById("modal-bank-name");
            if (nameSel) nameSel.value = b.bankName;
            const numIn = document.getElementById("bank-account-number");
            if (numIn) numIn.value = b.accountNumber;
            const holdIn = document.getElementById("bank-account-holder");
            if (holdIn) holdIn.value = b.accountHolderName;
        }
    }
}

function closeAddBankModal() {
    const modal = document.getElementById("add-bank-modal");
    if (modal) modal.classList.remove("active");
}

function handleSaveBankForm(e) {
    e.preventDefault();
    const bankName = document.getElementById("modal-bank-name").value;
    const accountNumber = document.getElementById("bank-account-number").value.trim();
    const accountHolderName = document.getElementById("bank-account-holder").value.trim();

    if (!bankName || !accountNumber || !accountHolderName) {
        showToast("Please fill in all bank details.", "warning");
        return;
    }

    if (!/^\d{10}$/.test(accountNumber)) {
        showToast("Bank account number must be exactly 10 digits.", "danger");
        return;
    }

    const bankData = { bankName, accountNumber, accountHolderName };
    closeAddBankModal();

    // Enforce PIN Verification before committing bank coordinates
    requireTransactionPin("link_bank", bankData, () => executeSaveBank(bankData));
}

function executeSaveBank(bankData) {
    const db = getDB();
    const isUpdate = Boolean(db.users[currentUser.email].bankDetails);
    
    db.users[currentUser.email].bankDetails = {
        bankName: bankData.bankName,
        accountNumber: bankData.accountNumber,
        accountHolderName: bankData.accountHolderName
    };
    db.users[currentUser.email].logs.unshift({
        event: isUpdate 
            ? `Bank Account Updated (PIN Authorized): ${bankData.bankName} (${bankData.accountNumber})` 
            : `New Bank Account Added (PIN Authorized): ${bankData.bankName} (${bankData.accountNumber})`,
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });
    saveDB(db);
    
    // Push to Supabase Cloud Database
    if (typeof supabasePushBankAccount === "function") {
        supabasePushBankAccount(bankData);
    }
    if (typeof supabasePushSecurityLog === "function") {
        supabasePushSecurityLog(currentUser.email, isUpdate ? `Bank Account Updated: ${bankData.bankName}` : `New Bank Account Added: ${bankData.bankName}`, "client_ip", navigator.userAgent, `Account: ${bankData.accountNumber} (${bankData.accountHolderName})`);
    }
    
    dispatchNotification(
        currentUser.email,
        "Bank Coordinates Configured",
        `Your destination bank account (${bankData.bankName} - ${bankData.accountNumber}) has been securely authorized and updated.`
    );

    loadSession();
    renderLinkedBanks();
    showToast(isUpdate ? "Bank account updated successfully!" : "Bank account linked successfully!", "success");
}

function deleteLinkedBankAccount() {
    if (confirm("Are you sure you want to unlink this bank account? You will need your Transaction PIN to authorize this change.")) {
        requireTransactionPin("unlink_bank", {}, () => executeDeleteBank());
    }
}

function executeDeleteBank() {
    const db = getDB();
    const prevBank = db.users[currentUser.email].bankDetails ? db.users[currentUser.email].bankDetails.bankName : "Bank Account";
    db.users[currentUser.email].bankDetails = null;
    db.users[currentUser.email].logs.unshift({
        event: `Bank Account Unlinked (PIN Authorized): ${prevBank}`,
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });
    saveDB(db);

    if (typeof supabaseDeleteBankAccount === "function") {
        supabaseDeleteBankAccount();
    }

    dispatchNotification(
        currentUser.email,
        "Bank Account Removed",
        `Your linked bank account (${prevBank}) has been unlinked from your profile.`
    );

    loadSession();
    renderLinkedBanks();
    showToast("Bank account removed.", "info");
}

// Profile & Password Modal Handlers
function openEditProfileModal() {
    const modal = document.getElementById("edit-profile-modal");
    if (modal && currentUser) {
        document.getElementById("edit-profile-name").value = currentUser.name || "";
        document.getElementById("edit-profile-phone").value = currentUser.phone || "";
        modal.classList.add("active");
    }
}

function closeEditProfileModal() {
    const modal = document.getElementById("edit-profile-modal");
    if (modal) modal.classList.remove("active");
}

function handleEditProfileSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("edit-profile-name").value.trim();
    const phone = document.getElementById("edit-profile-phone").value.trim();

    const db = getDB();
    db.users[currentUser.email].name = name;
    db.users[currentUser.email].phone = phone;
    db.users[currentUser.email].logs.unshift({
        event: "Profile Updated",
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });
    saveDB(db);

    if (typeof supabaseUpdateProfile === "function") {
        supabaseUpdateProfile({ name: name, phone: phone });
    }

    closeEditProfileModal();
    loadSession();
    renderSettingsProfile();
    showToast("Profile updated successfully.", "success");
}

function openChangePasswordModal() {
    const modal = document.getElementById("change-password-modal");
    if (modal) modal.classList.add("active");
}

function closeChangePasswordModal() {
    const modal = document.getElementById("change-password-modal");
    if (modal) modal.classList.remove("active");
}

function handleChangePasswordSubmit(e) {
    e.preventDefault();
    const current = document.getElementById("settings-current-password").value;
    const newPw = document.getElementById("settings-new-password").value;
    const confirmPw = document.getElementById("settings-confirm-password").value;

    if (currentUser.passwordHash !== current) {
        showToast("Current password incorrect.", "danger");
        return;
    }
    if (newPw !== confirmPw) {
        showToast("New passwords do not match.", "danger");
        return;
    }
    if (newPw.length < 8) {
        showToast("Password must be at least 8 characters.", "warning");
        return;
    }

    const db = getDB();
    db.users[currentUser.email].passwordHash = newPw;
    db.users[currentUser.email].logs.unshift({
        event: "Password Changed",
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });
    saveDB(db);

    if (typeof supabaseUpdatePassword === "function") {
        supabaseUpdatePassword(newPw);
    }

    closeChangePasswordModal();
    showToast("Password updated successfully!", "success");
}

function handle2faToggle(checkbox) {
    const status = checkbox.checked ? "Enabled" : "Disabled";
    const db = getDB();
    db.users[currentUser.email].logs.unshift({
        event: `Two-Factor Authentication ${status}`,
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });
    saveDB(db);
    showToast(`Two-Factor Authentication ${status}.`, "success");
}

function applyUserThemeSelection(val) {
    const themeMode = (val || "dark").toLowerCase();
    if (themeMode === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("goodfastpay_theme", "dark");
    } else {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("goodfastpay_theme", "light");
    }
    showToast(`Theme updated to ${themeMode} mode.`, "info");
}

// Update General Settings Visual Value on selection
function updateSettingDisplay(type, selectEl) {
    if (!selectEl) return;
    const val = selectEl.value;
    if (type === 'language') {
        const textEl = document.getElementById('setting-language-text');
        if (textEl) textEl.textContent = val;
        showToast(`Language set to ${val}`, "success");
    } else if (type === 'currency') {
        const textEl = document.getElementById('setting-currency-text');
        if (textEl) textEl.textContent = val;
        showToast(`Display currency set to ${val}`, "success");
    } else if (type === 'theme') {
        const textEl = document.getElementById('setting-theme-text');
        if (textEl) textEl.textContent = val;
        applyUserThemeSelection(val.toLowerCase());
    }
}

// Full row interactive toggle for switches
function toggleSettingCheckbox(checkboxId) {
    const chk = document.getElementById(checkboxId);
    if (chk) {
        chk.checked = !chk.checked;
        chk.dispatchEvent(new Event('change'));
    }
}

// Handle User logout
function handleLogout() {
    if (currentUser) {
        const db = getDB();
        if (db.users[currentUser.email]) {
            db.users[currentUser.email].logs.unshift({
                event: "User Logged Out",
                timestamp: new Date().toISOString(),
                ip: "197.34.120.44"
            });
            saveDB(db);
        }
    }
    if (typeof supabaseAuthSignOut === "function") {
        supabaseAuthSignOut();
    } else {
        clearSession();
        showToast("Signed out successfully.", "success");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1000);
    }
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
    
    // Mandatory Transaction PIN Gatekeeper
    requireTransactionPin("purchase", { cardId: cardId }, () => executeCardPurchase(cardId));
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
    
    // Push purchase to Supabase Cloud Database
    if (typeof supabasePushPurchase === "function") {
        supabasePushPurchase(card.id, user.email, user.wallet.balance);
    }
    if (typeof supabasePushSecurityLog === "function") {
        supabasePushSecurityLog(user.email, `Gift Card Purchased: ${card.brand} (${card.currency} ${card.cardValue})`, "client_ip", navigator.userAgent, `Stock ID: ${card.id} - Cost: ₦${card.price.toLocaleString()}`);
    }
    
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

// Render purchased codes list with copy PIN helper (Responsive Cards)
function renderPurchasedHistoryTable() {
    const db = getDB();
    const container = document.getElementById("purchased-history-container");
    if (!container) return;
    
    container.innerHTML = "";
    
    // Filter cards purchased by current user
    const list = db.inventory ? db.inventory.filter(item => item.status === "SOLD" && item.purchasedBy === currentUser.email) : [];
    
    // Sort descending by purchase date
    list.sort((a,b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
    
    if (list.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align:center; padding: 36px 16px; color: var(--text-muted); border-radius: 14px;">
                <i class="fas fa-receipt" style="font-size: 2.2rem; opacity: 0.4; margin-bottom: 12px; display:block;"></i>
                <p style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">No Purchased Gift Cards Yet</p>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">Buy gift cards from available stock above to view and copy your redeemed PINs here.</p>
            </div>
        `;
        return;
    }
    
    list.forEach(item => {
        const symbol = getCurrencySymbol(item.currency);
        const dateStr = new Date(item.purchasedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const logoHTML = getBrandLogoHTML(item.brand);
        const flagEmoji = getCountryFlagEmoji(item.currency);
        
        const card = document.createElement("div");
        card.className = "purchased-history-card";
        card.innerHTML = `
            <div class="purchased-card-top">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 36px; height: 36px; border-radius: 8px; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">
                        ${logoHTML}
                    </div>
                    <div>
                        <div style="font-weight: 800; font-size: 0.92rem; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                            <span>${item.brand}</span>
                            <span style="font-size: 0.85rem;" title="${item.currency}">${flagEmoji}</span>
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">${dateStr}</div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 800; font-size: 0.92rem; color: var(--danger);">-₦${item.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-secondary);">Value: ${symbol}${item.cardValue}</div>
                </div>
            </div>
            <div class="purchased-card-pin-box">
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Redeemed PIN / Code:</div>
                <div class="pin-display-row">
                    <code class="purchased-pin-code">${item.code}</code>
                    <button class="btn-copy-pin-pill" onclick="copyCardPinCode('${item.code}')">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
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
    
    if (typeof supabaseUpdatePassword === "function") {
        supabaseUpdatePassword(newPassword);
    }
    
    currentUser.passwordHash = newPassword;
    showToast("Password updated successfully.", "success");
    document.getElementById("password-settings-form").reset();
}

// =========================================================
// TRANSACTION PIN MANAGEMENT & RESET HANDLERS
// =========================================================

function updateSettingsPinStatus() {
    if (!currentUser) return;
    const db = getDB();
    const user = db.users[currentUser.email] || currentUser;
    const pinSub = document.getElementById("settings-pin-status-sub");
    
    if (pinSub) {
        if (user.transactionPin && /^\d{4}$/.test(user.transactionPin)) {
            pinSub.innerHTML = `<span class="settings-pin-status-pill active"><i class="fa-solid fa-circle-check"></i> Active • 4-Digit PIN Configured</span>`;
        } else {
            pinSub.innerHTML = `<span class="settings-pin-status-pill inactive"><i class="fa-solid fa-triangle-exclamation"></i> Not Configured • Tap to Set Up</span>`;
        }
    }
}

function openTransactionPinSettingsModal(pendingAction = null) {
    if (!currentUser) return;
    pendingPinSetupAction = pendingAction;

    const modal = document.getElementById("transaction-pin-modal");
    if (!modal) return;

    modal.classList.add("active");

    const db = getDB();
    const user = db.users[currentUser.email] || currentUser;
    const hasPin = Boolean(user.transactionPin && /^\d{4}$/.test(user.transactionPin));

    const modalTitle = document.getElementById("transaction-pin-modal-title");
    const currentPinGroup = document.getElementById("settings-current-pin-group");
    const currentPinInput = document.getElementById("settings-current-pin");
    const newPinLabel = document.getElementById("settings-new-pin-label");
    const saveBtn = document.getElementById("btn-save-pin-submit");
    const noticeBox = document.getElementById("pin-setup-notice");
    const noticeText = document.getElementById("pin-setup-notice-text");

    // Reset forms
    const pinForm = document.getElementById("pin-settings-form");
    if (pinForm) pinForm.reset();
    const resetForm = document.getElementById("pin-reset-password-form");
    if (resetForm) resetForm.reset();

    // Default to manage tab
    switchPinSettingsTab("manage");

    if (hasPin) {
        if (modalTitle) modalTitle.textContent = "Change Transaction PIN";
        if (currentPinGroup) currentPinGroup.style.display = "block";
        if (currentPinInput) currentPinInput.required = true;
        if (newPinLabel) newPinLabel.textContent = "New 4-Digit PIN";
        if (saveBtn) saveBtn.innerHTML = `<i class="fa-solid fa-key" style="margin-right: 6px;"></i> Update Transaction PIN`;
        if (noticeBox) noticeBox.style.display = "none";
    } else {
        if (modalTitle) modalTitle.textContent = "Set Up Transaction PIN";
        if (currentPinGroup) currentPinGroup.style.display = "none";
        if (currentPinInput) currentPinInput.required = false;
        if (newPinLabel) newPinLabel.textContent = "Create 4-Digit PIN";
        if (saveBtn) saveBtn.innerHTML = `<i class="fa-solid fa-check" style="margin-right: 6px;"></i> Set Transaction PIN`;

        if (pendingAction && noticeBox) {
            noticeBox.style.display = "block";
            if (noticeText) {
                if (pendingAction.action === "withdraw") noticeText.textContent = "Please create your 4-digit PIN to securely authorize this cash withdrawal.";
                else if (pendingAction.action === "purchase") noticeText.textContent = "Please create your 4-digit PIN to securely authorize this gift card purchase.";
                else if (pendingAction.action === "link_bank") noticeText.textContent = "Please create your 4-digit PIN to protect and link your bank account.";
                else noticeText.textContent = "Set up your 4-digit PIN to proceed with this secure operation.";
            }
        } else if (noticeBox) {
            noticeBox.style.display = "none";
        }
    }

    // Auto-focus appropriate input
    setTimeout(() => {
        if (hasPin && currentPinInput) currentPinInput.focus();
        else {
            const newPin = document.getElementById("settings-new-pin");
            if (newPin) newPin.focus();
        }
    }, 100);
}

function closeTransactionPinSettingsModal() {
    const modal = document.getElementById("transaction-pin-modal");
    if (modal) modal.classList.remove("active");
    pendingPinSetupAction = null;
}

function switchPinSettingsTab(tab) {
    const manageBtn = document.getElementById("btn-pin-tab-manage");
    const resetBtn = document.getElementById("btn-pin-tab-reset");
    const managePanel = document.getElementById("panel-pin-manage");
    const resetPanel = document.getElementById("panel-pin-reset");

    if (tab === "reset") {
        if (manageBtn) manageBtn.classList.remove("active");
        if (resetBtn) resetBtn.classList.add("active");
        if (managePanel) managePanel.style.display = "none";
        if (resetPanel) resetPanel.style.display = "block";
        const pwInput = document.getElementById("reset-pin-account-password");
        if (pwInput) setTimeout(() => pwInput.focus(), 60);
    } else {
        if (manageBtn) manageBtn.classList.add("active");
        if (resetBtn) resetBtn.classList.remove("active");
        if (managePanel) managePanel.style.display = "block";
        if (resetPanel) resetPanel.style.display = "none";
    }
}

// Handle transaction PIN setup or update
function handlePinSetupOrChange(e) {
    e.preventDefault();
    if (!validateUserStatusActive()) return;

    const db = getDB();
    const user = db.users[currentUser.email];
    const hadPin = Boolean(user.transactionPin && /^\d{4}$/.test(user.transactionPin));

    const currentPinEl = document.getElementById("settings-current-pin");
    const currentPin = currentPinEl ? currentPinEl.value.trim() : "";
    const newPin = document.getElementById("settings-new-pin").value.trim();
    const confirmPin = document.getElementById("settings-confirm-pin").value.trim();

    if (hadPin) {
        if (currentPin !== user.transactionPin) {
            showToast("Current Transaction PIN is incorrect.", "danger");
            if (currentPinEl) {
                currentPinEl.value = "";
                currentPinEl.focus();
            }
            return;
        }
    }

    if (!/^\d{4}$/.test(newPin)) {
        showToast("Transaction PIN must be exactly 4 numeric digits.", "danger");
        return;
    }

    if (newPin !== confirmPin) {
        showToast("New PIN confirmation does not match.", "danger");
        return;
    }

    if (hadPin && newPin === currentPin) {
        showToast("New PIN cannot be identical to your current PIN.", "warning");
        return;
    }

    // Save PIN
    user.transactionPin = newPin;
    user.logs.unshift({
        event: hadPin ? "Transaction PIN Updated" : "Transaction PIN Configured",
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });

    db.users[currentUser.email] = user;
    saveDB(db);

    // Push to Supabase Cloud Database
    if (typeof supabaseUpdateProfile === "function") {
        supabaseUpdateProfile({ transactionPin: newPin });
    }

    currentUser.transactionPin = newPin;
    pinFailedAttempts = 0;

    dispatchNotification(
        currentUser.email,
        "Transaction PIN Updated",
        hadPin 
            ? "Your 4-digit Transaction PIN has been changed successfully." 
            : "Your 4-digit Transaction PIN has been configured successfully. All withdrawals and purchases are now protected."
    );

    showToast(hadPin ? "Transaction PIN updated successfully!" : "Transaction PIN created successfully!", "success");

    const savedPendingAction = pendingPinSetupAction;
    closeTransactionPinSettingsModal();

    // Refresh UI
    updateSettingsPinStatus();
    updateVerificationBadges();

    // If there was a pending transaction that prompted PIN setup, seamlessly prompt for authorization or execute
    if (savedPendingAction) {
        setTimeout(() => {
            if (savedPendingAction.callback) {
                openPinVerificationModal(savedPendingAction.action, savedPendingAction.data, savedPendingAction.callback);
            } else if (savedPendingAction.action === "withdraw") {
                openPinVerificationModal("withdraw", savedPendingAction.data, () => executeWithdrawal(savedPendingAction.data.amount));
            } else if (savedPendingAction.action === "purchase") {
                openPinVerificationModal("purchase", savedPendingAction.data, () => executeCardPurchase(savedPendingAction.data.cardId));
            }
        }, 300);
    }
}

// Alias for backwards compatibility
function handlePinUpdate(e) {
    handlePinSetupOrChange(e);
}

// Handle PIN reset using Account Login Password
function handlePinResetWithPassword(e) {
    e.preventDefault();
    if (!validateUserStatusActive()) return;

    const db = getDB();
    const user = db.users[currentUser.email];

    const passwordInput = document.getElementById("reset-pin-account-password").value;
    const newPin = document.getElementById("reset-pin-new").value.trim();
    const confirmPin = document.getElementById("reset-pin-confirm").value.trim();

    if (user.passwordHash !== passwordInput) {
        showToast("Incorrect account login password.", "danger");
        return;
    }

    if (!/^\d{4}$/.test(newPin)) {
        showToast("New Transaction PIN must be exactly 4 numeric digits.", "danger");
        return;
    }

    if (newPin !== confirmPin) {
        showToast("New PIN confirmation mismatch.", "danger");
        return;
    }

    // Update PIN & clear lockout strikes
    user.transactionPin = newPin;
    user.logs.unshift({
        event: "Transaction PIN Reset via Account Password",
        timestamp: new Date().toISOString(),
        ip: "197.34.120.44"
    });

    db.users[currentUser.email] = user;
    saveDB(db);

    if (typeof supabaseUpdateProfile === "function") {
        supabaseUpdateProfile({ transactionPin: newPin });
    }

    currentUser.transactionPin = newPin;
    pinFailedAttempts = 0;
    pinLockoutUntil = 0;

    dispatchNotification(
        currentUser.email,
        "Transaction PIN Reset",
        "Your Transaction PIN was successfully reset using your account password."
    );

    showToast("Transaction PIN has been reset successfully!", "success");
    closeTransactionPinSettingsModal();

    // Refresh UI
    updateSettingsPinStatus();
    updateVerificationBadges();
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
    const bankInput = document.getElementById("modal-bank-name") || document.getElementById("bank-name");
    const holderInput = document.getElementById("bank-account-holder");
    const statusContainer = document.getElementById("account-verification-status");
    const saveBtn = document.getElementById("save-bank-btn");
    
    if (!numInput || !bankInput || !holderInput) return;
    
    // Clean non-digits
    numInput.value = numInput.value.replace(/[^0-9]/g, '');
    
    // If not exactly 10 digits or no bank selected, reset verification status
    if (numInput.value.length < 10 || !bankInput.value) {
        if (holderInput && !holderInput.value) {
            holderInput.placeholder = "Awaiting account details...";
        }
        if (statusContainer) statusContainer.innerHTML = "";
        return;
    }
    
    // Debounce and trigger simulated resolver
    if (verificationTimeout) clearTimeout(verificationTimeout);
    
    if (statusContainer) {
        statusContainer.innerHTML = `<span style="font-size:0.7rem; color:var(--primary); font-weight:700; display:flex; align-items:center; gap:4px;"><i class="fas fa-circle-notch fa-spin"></i> Verifying...</span>`;
    }
    
    verificationTimeout = setTimeout(() => {
        // Resolve verified name if not manually entered
        if (!holderInput.value || holderInput.value.includes("Resolving") || holderInput.value.includes("Awaiting")) {
            const userName = currentUser ? (currentUser.name || "Customer") : "Customer";
            const mockName = userName.toUpperCase() + " " + (bankInput.value.split(" ")[0] || "BANK").toUpperCase();
            holderInput.value = mockName;
        }
        
        if (statusContainer) {
            statusContainer.innerHTML = `<span style="font-size:0.68rem; font-weight:800; display:inline-flex; align-items:center; gap:4px; color:#10b981;"><i class="fas fa-circle-check"></i> ✓ Verified</span>`;
        }
        if (saveBtn) saveBtn.disabled = false;
        showToast("Bank account verified successfully!", "success");
    }, 400);
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
        
        if (typeof supabasePushTicket === "function") {
            supabasePushTicket(newTicketObj);
        }
        if (typeof supabasePushTicketMessage === "function") {
            supabasePushTicketMessage(newTicketObj.id, newTicketObj.messages[0]);
        }
        
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
    
    if (typeof supabaseUpdateTicketMeta === "function") {
        supabaseUpdateTicketMeta(ticketId, { status: "CLOSED", adminUnread: true });
    }
    if (typeof supabasePushTicketMessage === "function") {
        const lastMsg = db.tickets[idx].messages[db.tickets[idx].messages.length - 1];
        supabasePushTicketMessage(ticketId, lastMsg);
    }
    
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
        
        if (typeof supabasePushTicketMessage === "function") {
            supabasePushTicketMessage(activeUserTicketId, newMsg);
            if (reopenMsg) {
                supabasePushTicketMessage(activeUserTicketId, reopenMsg);
            }
        }
        if (typeof supabaseUpdateTicketMeta === "function") {
            supabaseUpdateTicketMeta(activeUserTicketId, {
                status: db.tickets[ticketIdx].status,
                adminUnread: true
            });
        }
        
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



