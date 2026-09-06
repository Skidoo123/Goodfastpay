// Goodfastpay Platform - Core JS (Database Simulation, Auth & Utilities)

// Gift Card Categories & Brand Definitions
const GIFT_CARD_CATEGORIES = {
    "Shopping & Retail": ["Amazon", "Walmart", "Target", "Best Buy", "Costco", "eBay", "Macy’s", "Nordstrom", "Home Depot", "Lowe’s", "IKEA", "Sephora", "Ulta Beauty"],
    "Gaming": ["Steam", "PlayStation Store (PSN)", "Xbox", "Nintendo eShop", "Roblox", "Riot Games (League of Legends)", "Blizzard Battle.net", "PUBG Mobile UC", "Free Fire Diamonds", "Google Play Games"],
    "Entertainment": ["Apple/iTunes", "Google Play", "Netflix", "Spotify", "Hulu", "Disney+", "HBO Max", "Paramount+", "YouTube Premium", "Crunchyroll"],
    "Food & Restaurants": ["Starbucks", "McDonald’s", "KFC", "Burger King", "Domino’s Pizza", "Pizza Hut", "Subway", "Uber", "DoorDash"],
    "Travel": ["Airbnb", "Hotels.com", "Booking.com", "Expedia", "Delta Airlines", "American Airlines", "Emirates", "Southwest Airlines"],
    "Cryptocurrency & Finance": ["Visa Prepaid", "Mastercard Prepaid", "American Express Gift Card", "Vanilla Visa", "OneVanilla", "SecureSpend", "American Express Reward Card"],
    "Fashion": ["Nike", "Adidas", "H&M", "Zara", "ASOS", "Foot Locker", "JD Sports"],
    "Digital Services": ["PayPal Gift Card", "Razer Gold", "Skrill", "Paysafecard", "Twitch", "Discord Nitro", "LinkedIn Premium"],
    "Telecom": ["AT&T", "Verizon", "T-Mobile", "Vodafone", "MTN", "Airtel", "Glo", "9mobile"]
};

const SUPPORTED_REGIONS = [
    "USA (USD)", "UK (GBP)", "Europe (EUR)"
];

// Central Currency Registry Base Rates (Restricted to USD, EUR, GBP, NGN)
const DEFAULT_SYSTEM_CURRENCIES = {
    "USD": { code: "USD", name: "United States Dollar", rate: 1200, status: "ACTIVE" },
    "EUR": { code: "EUR", name: "Euro", rate: 1100, status: "ACTIVE" },
    "GBP": { code: "GBP", name: "British Pound Sterling", rate: 1500, status: "ACTIVE" },
    "NGN": { code: "NGN", name: "Nigerian Naira", rate: 1, status: "ACTIVE" }
};

// Map supported country/region labels to central currency codes
function getRegionCurrencyCode(region) {
    if (!region) return "USD";
    if (region === "USA" || region === "USD" || region === "$") return "USD";
    if (region.includes("Europe") || region === "EUR" || region === "€") return "EUR";
    if (region === "UK" || region === "GBP" || region === "£") return "GBP";
    if (region === "NGN" || region === "₦") return "NGN";
    return "USD";
}

// Generate default rates for all brands and regions dynamically from Central Currency Registry
const DEFAULT_CARD_RATES = {};
Object.keys(GIFT_CARD_CATEGORIES).forEach(cat => {
    GIFT_CARD_CATEGORIES[cat].forEach(brand => {
        DEFAULT_CARD_RATES[brand] = {};
        
        // Seed ISO currencies from standard currency manager defaults
        Object.keys(DEFAULT_SYSTEM_CURRENCIES).forEach(code => {
            DEFAULT_CARD_RATES[brand][code] = DEFAULT_SYSTEM_CURRENCIES[code].rate;
        });
        
        // Seed regional country labels from standard currency manager defaults
        SUPPORTED_REGIONS.forEach(region => {
            const currCode = getRegionCurrencyCode(region);
            const rateVal = DEFAULT_SYSTEM_CURRENCIES[currCode] ? DEFAULT_SYSTEM_CURRENCIES[currCode].rate : 1200;
            DEFAULT_CARD_RATES[brand][region] = rateVal;
        });
    });
});

// Initial Mock DB Setup
const INITIAL_DATABASE = {
    users: {
        "user@goodfastpay.com": {
            name: "Abdallah",
            email: "user@goodfastpay.com",
            passwordHash: "user123", // Simplified for demo simulation
            transactionPin: "1234", // 4-digit Transaction Security PIN
            phone: "+1 555-0199",
            role: "USER",
            status: "ACTIVE",
            createdAt: "2026-07-20T10:00:00Z",
            bankDetails: {
                bankName: "Guaranty Trust Bank",
                accountNumber: "0123456789",
                accountHolderName: "Abdallah"
            },
            wallet: {
                balance: 150000.00, // starting balance in NGN
                pendingBalance: 0.00,
                usdBalance: 250.00, // starting balance in USD ($)
                usdPending: 0.00
            },
            logs: [
                { event: "Account Created", timestamp: "2026-07-20T10:00:00Z", ip: "197.34.120.44" },
                { event: "Demo Wallet Pre-loaded", timestamp: "2026-07-20T10:05:00Z", ip: "system" }
            ],
            notifications: [
                { id: "nt-1", title: "Welcome to Goodfastpay!", message: "Get started by selling your first gift card. Ensure to add your bank details in settings for direct payouts.", read: false, createdAt: "2026-07-20T10:00:00Z" }
            ]
        },
        "admin@goodfastpay.com": {
            name: "Chief Admin",
            email: "admin@goodfastpay.com",
            passwordHash: "AdminGoodfastpay2026!",
            adminPin: "123456",
            staffRole: "SUPER_ADMIN",
            phone: "+1 555-0100",
            role: "ADMIN",
            status: "ACTIVE",
            createdAt: "2026-07-15T08:00:00Z",
            logs: [
                { event: "Admin Console Activated", timestamp: "2026-07-15T08:00:00Z", ip: "197.34.120.1" }
            ],
            notifications: []
        }
    },
    submissions: [
        {
            id: "GC-9011",
            userId: "user@goodfastpay.com",
            brand: "Apple/iTunes",
            cardValue: 100,
            currency: "USD",
            cardCode: "A1B2C3D4E5F6G7H8",
            frontImageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180' viewBox='0 0 300 180'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%238A2387'/><stop offset='50%' stop-color='%23E94057'/><stop offset='100%' stop-color='%23F27121'/></linearGradient></defs><rect width='300' height='180' rx='10' fill='url(%23g)'/><text x='150' y='80' fill='white' font-family='sans-serif' font-weight='bold' font-size='20' text-anchor='middle'>Apple Gift Card</text><text x='150' y='110' fill='white' font-family='monospace' font-size='12' opacity='0.8' text-anchor='middle'>PIN: A1B2C3D4E5F6G7H8</text><text x='150' y='140' fill='white' font-family='sans-serif' font-weight='bold' font-size='14' text-anchor='middle'>$100 USD</text></svg>",
            backImageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180' viewBox='0 0 300 180'><rect width='300' height='180' rx='10' fill='%231e1b4b'/><rect x='20' y='30' width='260' height='40' fill='white'/><line x1='40' y1='35' x2='40' y2='65' stroke='black' stroke-width='4'/><line x1='50' y1='35' x2='50' y2='65' stroke='black' stroke-width='2'/><line x1='60' y1='35' x2='60' y2='65' stroke='black' stroke-width='6'/><line x1='80' y1='35' x2='80' y2='65' stroke='black' stroke-width='2'/><line x1='90' y1='35' x2='90' y2='65' stroke='black' stroke-width='4'/><line x1='110' y1='35' x2='110' y2='65' stroke='black' stroke-width='8'/><line x1='130' y1='35' x2='130' y2='65' stroke='black' stroke-width='2'/><line x1='140' y1='35' x2='140' y2='65' stroke='black' stroke-width='4'/><line x1='160' y1='35' x2='160' y2='65' stroke='black' stroke-width='6'/><line x1='180' y1='35' x2='180' y2='65' stroke='black' stroke-width='2'/><line x1='190' y1='35' x2='190' y2='65' stroke='black' stroke-width='4'/><line x1='210' y1='35' x2='210' y2='65' stroke='black' stroke-width='8'/><line x1='230' y1='35' x2='230' y2='65' stroke='black' stroke-width='2'/><line x1='250' y1='35' x2='250' y2='65' stroke='black' stroke-width='4'/><text x='150' y='100' fill='white' font-family='sans-serif' font-size='8' opacity='0.6' text-anchor='middle'>DO NOT SHARE THIS CODE. FOR SECURITY VERIFICATION ONLY.</text><text x='150' y='120' fill='white' font-family='monospace' font-size='10' text-anchor='middle'>Bar Code ID: 9021102928821</text></svg>",
            status: "COMPLETED",
            payoutAmount: 125000.00, // 100 * 1250
            rejectionReason: null,
            createdAt: "2026-07-22T14:30:00Z"
        },
        {
            id: "GC-4022",
            userId: "user@goodfastpay.com",
            brand: "Amazon",
            cardValue: 50,
            currency: "EUR",
            cardCode: "AMZN-K9L2-P3O1",
            frontImageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180' viewBox='0 0 300 180'><defs><linearGradient id='g2' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%2311998e'/><stop offset='100%' stop-color='%2338ef7d'/></linearGradient></defs><rect width='300' height='180' rx='10' fill='url(%23g2)'/><text x='150' y='80' fill='white' font-family='sans-serif' font-weight='bold' font-size='20' text-anchor='middle'>Amazon Gift Card</text><text x='150' y='110' fill='white' font-family='monospace' font-size='12' opacity='0.8' text-anchor='middle'>PIN: AMZN-K9L2-P3O1</text><text x='150' y='140' fill='white' font-family='sans-serif' font-weight='bold' font-size='14' text-anchor='middle'>50 EUR (€)</text></svg>",
            backImageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180' viewBox='0 0 300 180'><rect width='300' height='180' rx='10' fill='%230f172a'/><rect x='20' y='30' width='260' height='40' fill='white'/><line x1='40' y1='35' x2='40' y2='65' stroke='black' stroke-width='4'/><line x1='50' y1='35' x2='50' y2='65' stroke='black' stroke-width='2'/><line x1='60' y1='35' x2='60' y2='65' stroke='black' stroke-width='6'/><line x1='80' y1='35' x2='80' y2='65' stroke='black' stroke-width='2'/><line x1='90' y1='35' x2='90' y2='65' stroke='black' stroke-width='4'/><line x1='110' y1='35' x2='110' y2='65' stroke='black' stroke-width='8'/><text x='150' y='100' fill='white' font-family='sans-serif' font-size='8' opacity='0.6' text-anchor='middle'>VERIFICATION STAMP ONLY</text></svg>",
            status: "PENDING",
            payoutAmount: 55000.00,
            rejectionReason: null,
            createdAt: "2026-07-29T11:20:00Z"
        }
    ],
    inventory: [
        {
            id: "STK-9001",
            brand: "Apple/iTunes",
            cardValue: 50,
            currency: "USD",
            code: "APPL-BUY-9021-9981",
            price: 60000.00,
            status: "AVAILABLE",
            purchasedBy: null,
            purchasedAt: null,
            createdAt: "2026-07-28T10:00:00Z"
        },
        {
            id: "STK-9002",
            brand: "Amazon",
            cardValue: 100,
            currency: "EUR",
            code: "AMZN-BUY-4081-3091",
            price: 120000.00,
            status: "AVAILABLE",
            purchasedBy: null,
            purchasedAt: null,
            createdAt: "2026-07-28T11:00:00Z"
        },
        {
            id: "STK-9003",
            brand: "Steam",
            cardValue: 50,
            currency: "USD",
            code: "STEM-BUY-1022-7744",
            price: 65000.00,
            status: "AVAILABLE",
            purchasedBy: null,
            purchasedAt: null,
            createdAt: "2026-07-28T12:00:00Z"
        },
        {
            id: "STK-9004",
            brand: "Google Play",
            cardValue: 25,
            currency: "USD",
            code: "GOPL-BUY-1033-2882",
            price: 28000.00,
            status: "AVAILABLE",
            purchasedBy: null,
            purchasedAt: null,
            createdAt: "2026-07-28T13:00:00Z"
        }
    ],
    withdrawals: [
        {
            id: "WD-1020",
            userId: "user@goodfastpay.com",
            amount: 25000.00,
            bankName: "Guaranty Trust Bank",
            accountNumber: "0123456789",
            accountHolderName: "Abdallah",
            status: "COMPLETED",
            declineReason: null,
            createdAt: "2026-07-23T09:15:00Z"
        }
    ],
    auditTrail: [
        { operator: "system", event: "Mock Database Initialized", timestamp: "2026-07-29T18:00:00Z", details: "Initial structure created." }
    ],
    settings: {
        siteName: "Goodfastpay",
        maintenanceMode: false,
        rates: DEFAULT_CARD_RATES
    },
    currencies: DEFAULT_SYSTEM_CURRENCIES,
    currencyHistory: [
        { currency: "USD", oldRate: 1200, newRate: 1200, operator: "system", timestamp: "2026-07-29T18:00:00Z" },
        { currency: "EUR", oldRate: 1100, newRate: 1100, operator: "system", timestamp: "2026-07-29T18:00:00Z" },
        { currency: "GBP", oldRate: 1500, newRate: 1500, operator: "system", timestamp: "2026-07-29T18:00:00Z" },
        { currency: "NGN", oldRate: 1, newRate: 1, operator: "system", timestamp: "2026-07-29T18:00:00Z" }
    ],
    adjustments: []
};

// Database In-Memory Cache for Maximum Performance & Zero-Lag Operations
let cachedDB = null;

function invalidateDBCache() {
    cachedDB = null;
}

if (typeof window !== "undefined") {
    window.addEventListener('storage', (e) => {
        if (e.key === 'goodfastpay_db') {
            invalidateDBCache();
        }
    });
}

// Database Initializer
function getDB() {
    if (cachedDB) return cachedDB;

    if (!localStorage.getItem("goodfastpay_db")) {
        localStorage.setItem("goodfastpay_db", JSON.stringify(INITIAL_DATABASE));
    }
    let db = JSON.parse(localStorage.getItem("goodfastpay_db"));
    let dirty = false;

    if (!db.submissions) {
        db.submissions = INITIAL_DATABASE.submissions || [];
        dirty = true;
    }
    if (!db.withdrawals) {
        db.withdrawals = INITIAL_DATABASE.withdrawals || [];
        dirty = true;
    }
    if (!db.inventory) {
        db.inventory = INITIAL_DATABASE.inventory || [];
        dirty = true;
    }
    if (!db.adjustments) {
        db.adjustments = [];
        dirty = true;
    }
    if (!db.currencies) {
        db.currencies = DEFAULT_SYSTEM_CURRENCIES;
        dirty = true;
    }
    // Auto-migrate dual wallet balances (NGN & USD) for all users
    if (db.users) {
        Object.keys(db.users).forEach(email => {
            if (!db.users[email].wallet) {
                db.users[email].wallet = { balance: 0.00, pendingBalance: 0.00, usdBalance: 0.00, usdPending: 0.00 };
                dirty = true;
            }
            if (db.users[email].wallet.usdBalance === undefined) {
                db.users[email].wallet.usdBalance = 250.00;
                db.users[email].wallet.usdPending = 0.00;
                dirty = true;
            }
            if (db.users[email].wallet.balance === undefined) {
                db.users[email].wallet.balance = 0.00;
                db.users[email].wallet.pendingBalance = 0.00;
                dirty = true;
            }
        });
    }
    // Auto-migrate transactionPin for demo user if missing in existing localStorage
    if (db.users && db.users["user@goodfastpay.com"] && db.users["user@goodfastpay.com"].transactionPin === undefined) {
        db.users["user@goodfastpay.com"].transactionPin = "1234";
        dirty = true;
    }
    // Auto-migrate adminPin and staffRole for admin users if missing in existing localStorage
    if (db.users) {
        Object.keys(db.users).forEach(email => {
            if (db.users[email].role === "ADMIN") {
                if (!db.users[email].adminPin) {
                    db.users[email].adminPin = "123456";
                    dirty = true;
                }
                if (!db.users[email].staffRole) {
                    db.users[email].staffRole = "SUPER_ADMIN";
                    dirty = true;
                }
            }
        });
    }
    // Auto-migrate rates in database settings if missing or updating
    if (!db.settings.rates || Object.keys(db.settings.rates).length < 20 || !db.settings.rates["Amazon"] || !db.settings.rates["Amazon"]["USD"]) {
        db.settings.rates = DEFAULT_CARD_RATES;
        dirty = true;
    }
    if (!db.currencyHistory) {
        db.currencyHistory = [
            { currency: "USD", oldRate: 1200, newRate: 1200, operator: "system", timestamp: new Date().toISOString() },
            { currency: "EUR", oldRate: 1100, newRate: 1100, operator: "system", timestamp: new Date().toISOString() },
            { currency: "GBP", oldRate: 1500, newRate: 1500, operator: "system", timestamp: new Date().toISOString() },
            { currency: "NGN", oldRate: 1, newRate: 1, operator: "system", timestamp: new Date().toISOString() }
        ];
        dirty = true;
    }
    if (!db.tickets) {
        db.tickets = [
            {
                id: "TKT-10492",
                userId: "user@goodfastpay.com",
                title: "Amazon Gift Card Sale Pending Review",
                category: "Failed Gift Card Transaction",
                priority: "HIGH",
                status: "OPEN",
                createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
                updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
                description: "I submitted an Amazon gift card front/back scans but it is still pending review. Please verify it.",
                attachments: [],
                assignedTo: "Support Staff A",
                messages: [
                    {
                        sender: "USER",
                        senderEmail: "user@goodfastpay.com",
                        text: "I submitted an Amazon gift card front/back scans but it is still pending review. Please verify it.",
                        timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
                    }
                ],
                userUnread: false,
                adminUnread: true
            },
            {
                id: "TKT-10511",
                userId: "user@goodfastpay.com",
                title: "Withdrawal Delay to GTBank",
                category: "Report Payment Delay",
                priority: "CRITICAL",
                status: "PENDING",
                createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
                updatedAt: new Date(Date.now() - 3600000 * 23).toISOString(),
                description: "My withdrawal of ₦50,000 to my Guaranty Trust Bank account is delayed.",
                attachments: [],
                assignedTo: "Support Staff B",
                messages: [
                    {
                        sender: "USER",
                        senderEmail: "user@goodfastpay.com",
                        text: "My withdrawal of ₦50,000 to my Guaranty Trust Bank account is delayed.",
                        timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
                    },
                    {
                        sender: "ADMIN",
                        senderEmail: "admin@goodfastpay.com",
                        text: "Hi Abdallah, we are investigating the bank settlement node. We will update you shortly.",
                        timestamp: new Date(Date.now() - 3600000 * 23).toISOString()
                    }
                ],
                userUnread: true,
                adminUnread: false
            }
        ];
        dirty = true;
    }
    if (dirty) {
        localStorage.setItem("goodfastpay_db", JSON.stringify(db));
    }
    cachedDB = db;
    return cachedDB;
}

function saveDB(db) {
    cachedDB = db;
    try {
        localStorage.setItem("goodfastpay_db", JSON.stringify(db));
    } catch (e) {
        console.error("Storage quota exceeded! Clearing older images to save space...", e);
        if (db.submissions && db.submissions.length > 0) {
            // Keep only the 3 most recent submissions with full preview images, clear the rest
            db.submissions.forEach((sub, idx) => {
                if (idx > 2) {
                    sub.frontImageUrl = "stripped";
                    sub.backImageUrl = "stripped";
                }
            });
            try {
                localStorage.setItem("goodfastpay_db", JSON.stringify(db));
            } catch (err2) {
                // Clear all images if space is still tight
                db.submissions.forEach(sub => {
                    sub.frontImageUrl = "stripped";
                    sub.backImageUrl = "stripped";
                });
                try {
                    localStorage.setItem("goodfastpay_db", JSON.stringify(db));
                } catch (err3) {
                    console.error("Critical: Could not save database even after stripping images.", err3);
                }
            }
        }
    }

}

// Session Helpers
function getSessionUser() {
    const sessionEmail = sessionStorage.getItem("goodfastpay_user") || localStorage.getItem("goodfastpay_user");
    if (!sessionEmail) return null;
    const db = getDB();
    if (!db.users[sessionEmail]) {
        if (typeof syncLocalUserAccount === "function") {
            syncLocalUserAccount(sessionEmail, { email: sessionEmail });
        } else {
            db.users[sessionEmail] = {
                id: null,
                name: sessionEmail.split("@")[0],
                email: sessionEmail,
                passwordHash: "password123",
                phone: "",
                role: sessionEmail === "admin@goodfastpay.com" ? "ADMIN" : "USER",
                status: "ACTIVE",
                createdAt: new Date().toISOString(),
                bankDetails: null,
                wallet: { balance: 0.00, pendingBalance: 0.00, usdBalance: 250.00, usdPending: 0.00 },
                logs: [],
                notifications: []
            };
            saveDB(db);
        }
    }
    return db.users[sessionEmail] || null;
}

function setSessionUser(email) {
    if (!email) return;
    sessionStorage.setItem("goodfastpay_user", email);
    localStorage.setItem("goodfastpay_user", email);
}

function clearSession() {
    sessionStorage.removeItem("goodfastpay_user");
    sessionStorage.removeItem("goodfastpay_otp");
    localStorage.removeItem("goodfastpay_user");
}

// Rate Limiting Simulator
const RATE_LIMIT_STRIKES = {};
function checkRateLimit(ipOrEmail, maxAttempts = 5, cooldownSecs = 60) {
    const now = Date.now();
    if (!RATE_LIMIT_STRIKES[ipOrEmail]) {
        RATE_LIMIT_STRIKES[ipOrEmail] = { attempts: 1, resetTime: now + (cooldownSecs * 1000) };
        return { allowed: true };
    }

    const client = RATE_LIMIT_STRIKES[ipOrEmail];
    if (now > client.resetTime) {
        RATE_LIMIT_STRIKES[ipOrEmail] = { attempts: 1, resetTime: now + (cooldownSecs * 1000) };
        return { allowed: true };
    }

    client.attempts += 1;
    if (client.attempts > maxAttempts) {
        const remaining = Math.ceil((client.resetTime - now) / 1000);
        return { allowed: false, cooldown: remaining };
    }
    return { allowed: true };
}

// Password Strength Verifier
function checkPasswordStrength(pw) {
    if (!pw || pw.length < 4) return 0;
    let score = 1;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score; // 1 to 5 scale for valid passwords
}

// Fraud Detection: Checks if this exact card code was submitted before
function isDuplicateCardCode(code) {
    if (!code) return false;
    const cleanCode = code.trim().replace(/[-\s]/g, "").toUpperCase();
    const db = getDB();
    
    // Check all approved or pending submissions
    return db.submissions.some(sub => {
        const subCode = sub.cardCode ? sub.cardCode.trim().replace(/[-\s]/g, "").toUpperCase() : "";
        return subCode === cleanCode && sub.status !== "REJECTED";
    });
}

// Notification System Dispatcher
function dispatchNotification(userId, title, message) {
    const db = getDB();
    if (db.users[userId]) {
        const notification = {
            id: "nt-" + Math.floor(Math.random() * 1000000),
            title: title,
            message: message,
            read: false,
            createdAt: new Date().toISOString()
        };
        db.users[userId].notifications.unshift(notification);
        
        // Write event to user logs
        db.users[userId].logs.unshift({
            event: `Notification Sent: ${title}`,
            timestamp: new Date().toISOString(),
            ip: "system"
        });
        
        saveDB(db);

        if (typeof supabasePushNotification === "function") {
            supabasePushNotification(userId, notification);
        }
        
        // Dispatch live browser event for instant dashboard updating
        window.dispatchEvent(new CustomEvent('goodfastpay_notification', { detail: { userId, notification } }));
    }
}

// Audit Log Writer (Admin Events)
function writeAuditLog(operator, event, details = "") {
    const db = getDB();
    db.auditTrail.unshift({
        operator: operator,
        event: event,
        timestamp: new Date().toISOString(),
        details: details
    });
    saveDB(db);
}

// Global Toast Popup Creator
function showToast(message, type = "info") {
    let container = document.getElementById("toast-holder");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-holder";
        container.className = "toast-container";
        document.body.appendChild(container);
    }
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    if (type === "warning") icon = "fa-circle-exclamation";
    if (type === "danger") icon = "fa-triangle-exclamation";
    
    toast.innerHTML = `
        <i class="fas ${icon}" style="font-size: 1.25rem; margin-top: 2px;"></i>
        <div>
            <h4 style="margin-bottom: 4px; font-weight: 700; font-size: 0.9rem;">${type.toUpperCase()}</h4>
            <p style="font-size: 0.8rem; line-height: 1.4; color: var(--text-secondary);">${message}</p>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Trigger transition
    setTimeout(() => toast.classList.add("active"), 50);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove("active");
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

// Initialize Active Theme
function initTheme() {
    const savedTheme = localStorage.getItem("goodfastpay_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    const themeBtnIcon = document.querySelector(".theme-toggle-btn i");
    if (themeBtnIcon) {
        themeBtnIcon.className = savedTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("goodfastpay_theme", newTheme);
    
    const themeBtnIcon = document.querySelector(".theme-toggle-btn i");
    if (themeBtnIcon) {
        themeBtnIcon.className = newTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
    }
}

// Generate Mock OTP
function generateOTP(email) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    sessionStorage.setItem("goodfastpay_otp", JSON.stringify({ email, otp, expires: Date.now() + (5 * 60 * 1000) }));
    console.log(`[SIMULATED EMAIL / OTP for ${email}]: Your Goodfastpay code is: ${otp}`);
    return otp;
}

// Verify Mock OTP
function verifyOTP(email, enteredOtp) {
    const cleanInput = (enteredOtp || "").trim();
    // Master demo OTP "000000" always passes instantly
    if (cleanInput === "000000") return { success: true };
    
    const stored = JSON.parse(sessionStorage.getItem("goodfastpay_otp") || "{}");
    if (!stored || !stored.otp) {
        // Fallback for seamless demo verification on mobile devices
        return { success: true };
    }
    
    if (stored.otp === cleanInput) {
        sessionStorage.removeItem("goodfastpay_otp");
        return { success: true };
    }
    
    return { success: false, message: "Incorrect verification code. Use 000000 or tap Auto-fill." };
}

/**
 * Universal Brand Visual Details Engine
 * Provides authentic icons, background colors, text contrast, and gradients for all platform gift cards.
 */
function getBrandVisualDetails(brand) {
    const b = (brand || "").toLowerCase();
    
    // Default fallback
    let details = {
        iconClass: "fa-solid fa-gift",
        bgColor: "#6366f1",
        textColor: "#ffffff",
        gradient: "linear-gradient(135deg, #6366f1 0%, #1e1b4b 100%)"
    };

    // 1. Shopping & Retail
    if (b.includes("amazon")) {
        details = { iconClass: "fa-brands fa-amazon", bgColor: "#232F3E", textColor: "#FF9900", gradient: "linear-gradient(135deg, #131921 0%, #FF9900 100%)" };
    } else if (b.includes("walmart")) {
        details = { iconClass: "fa-solid fa-sparkles", bgColor: "#0071CE", textColor: "#FFC220", gradient: "linear-gradient(135deg, #0071CE 0%, #004F8B 100%)" };
    } else if (b.includes("target")) {
        details = { iconClass: "fa-solid fa-bullseye", bgColor: "#CC0000", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #CC0000 0%, #770000 100%)" };
    } else if (b.includes("best buy")) {
        details = { iconClass: "fa-solid fa-tag", bgColor: "#003B64", textColor: "#FFF200", gradient: "linear-gradient(135deg, #003B64 0%, #FFF200 100%)" };
    } else if (b.includes("costco")) {
        details = { iconClass: "fa-solid fa-warehouse", bgColor: "#E31837", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #E31837 0%, #005EA6 100%)" };
    } else if (b.includes("ebay")) {
        details = { iconClass: "fa-brands fa-ebay", bgColor: "#0064D2", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #E53238 0%, #0064D2 100%)" };
    } else if (b.includes("macy")) {
        details = { iconClass: "fa-solid fa-star", bgColor: "#E21A22", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #E21A22 0%, #880000 100%)" };
    } else if (b.includes("nordstrom")) {
        details = { iconClass: "fa-solid fa-bag-shopping", bgColor: "#111111", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #111111 0%, #333333 100%)" };
    } else if (b.includes("home depot")) {
        details = { iconClass: "fa-solid fa-hammer", bgColor: "#F96302", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #F96302 0%, #B84300 100%)" };
    } else if (b.includes("lowe")) {
        details = { iconClass: "fa-solid fa-house", bgColor: "#004990", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #004990 0%, #002244 100%)" };
    } else if (b.includes("ikea")) {
        details = { iconClass: "fa-solid fa-box", bgColor: "#0051BA", textColor: "#FFDA1A", gradient: "linear-gradient(135deg, #0051BA 0%, #FFDA1A 100%)" };
    } else if (b.includes("sephora")) {
        details = { iconClass: "fa-solid fa-wand-magic-sparkles", bgColor: "#000000", textColor: "#E00034", gradient: "linear-gradient(135deg, #000000 0%, #E00034 100%)" };
    } else if (b.includes("ulta")) {
        details = { iconClass: "fa-solid fa-heart", bgColor: "#E35205", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #E35205 0%, #993000 100%)" };
    
    // 2. Gaming
    } else if (b.includes("steam")) {
        details = { iconClass: "fa-brands fa-steam", bgColor: "#171A21", textColor: "#66C0F4", gradient: "linear-gradient(135deg, #171A21 0%, #2A475E 100%)" };
    } else if (b.includes("playstation") || b.includes("psn")) {
        details = { iconClass: "fa-brands fa-playstation", bgColor: "#0037AE", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #0037AE 0%, #001030 100%)" };
    } else if (b.includes("xbox")) {
        details = { iconClass: "fa-brands fa-xbox", bgColor: "#107C10", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #107C10 0%, #052005 100%)" };
    } else if (b.includes("nintendo")) {
        details = { iconClass: "fa-solid fa-gamepad", bgColor: "#E60012", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #E60012 0%, #8A000A 100%)" };
    } else if (b.includes("roblox")) {
        details = { iconClass: "fa-solid fa-cube", bgColor: "#E31B23", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #E31B23 0%, #111111 100%)" };
    } else if (b.includes("riot") || b.includes("league of legends")) {
        details = { iconClass: "fa-solid fa-fist-raised", bgColor: "#D12630", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #D12630 0%, #111111 100%)" };
    } else if (b.includes("blizzard") || b.includes("battle.net")) {
        details = { iconClass: "fa-solid fa-snowflake", bgColor: "#0099E6", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #0099E6 0%, #003366 100%)" };
    } else if (b.includes("pubg")) {
        details = { iconClass: "fa-solid fa-crosshair", bgColor: "#111111", textColor: "#F3A918", gradient: "linear-gradient(135deg, #111111 0%, #F3A918 100%)" };
    } else if (b.includes("free fire")) {
        details = { iconClass: "fa-solid fa-gem", bgColor: "#FF4500", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #FF4500 0%, #8B0000 100%)" };
    } else if (b.includes("google play games")) {
        details = { iconClass: "fa-brands fa-google-play", bgColor: "#00E676", textColor: "#111111", gradient: "linear-gradient(135deg, #00E676 0%, #00897B 100%)" };

    // 3. Entertainment
    } else if (b.includes("apple") || b.includes("itunes")) {
        details = { iconClass: "fa-brands fa-apple", bgColor: "#111111", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #111111 0%, #FA2D48 100%)" };
    } else if (b.includes("google play")) {
        details = { iconClass: "fa-brands fa-google-play", bgColor: "#34A853", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #34A853 0%, #4285F4 100%)" };
    } else if (b.includes("netflix")) {
        details = { iconClass: "fa-solid fa-film", bgColor: "#E50914", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #E50914 0%, #000000 100%)" };
    } else if (b.includes("spotify")) {
        details = { iconClass: "fa-brands fa-spotify", bgColor: "#1DB954", textColor: "#191414", gradient: "linear-gradient(135deg, #1DB954 0%, #191414 100%)" };
    } else if (b.includes("hulu")) {
        details = { iconClass: "fa-solid fa-tv", bgColor: "#1CE685", textColor: "#05301B", gradient: "linear-gradient(135deg, #1CE685 0%, #05301B 100%)" };
    } else if (b.includes("disney")) {
        details = { iconClass: "fa-solid fa-video", bgColor: "#113CCF", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #113CCF 0%, #020B2D 100%)" };
    } else if (b.includes("hbo")) {
        details = { iconClass: "fa-solid fa-clapperboard", bgColor: "#5822B4", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #5822B4 0%, #1D0649 100%)" };
    } else if (b.includes("paramount")) {
        details = { iconClass: "fa-solid fa-mountain", bgColor: "#0064FF", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #0064FF 0%, #001A4D 100%)" };
    } else if (b.includes("youtube")) {
        details = { iconClass: "fa-brands fa-youtube", bgColor: "#FF0000", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #FF0000 0%, #282828 100%)" };
    } else if (b.includes("crunchyroll")) {
        details = { iconClass: "fa-solid fa-circle-play", bgColor: "#FF6600", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #FF6600 0%, #212121 100%)" };

    // 4. Food & Restaurants
    } else if (b.includes("starbucks")) {
        details = { iconClass: "fa-solid fa-mug-hot", bgColor: "#00704A", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #00704A 0%, #003624 100%)" };
    } else if (b.includes("mcdonald")) {
        details = { iconClass: "fa-solid fa-burger", bgColor: "#DA291C", textColor: "#FFC72C", gradient: "linear-gradient(135deg, #DA291C 0%, #FFC72C 100%)" };
    } else if (b.includes("kfc")) {
        details = { iconClass: "fa-solid fa-drumstick-bite", bgColor: "#A30000", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #A30000 0%, #5E0000 100%)" };
    } else if (b.includes("burger king")) {
        details = { iconClass: "fa-solid fa-burger", bgColor: "#F47321", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #F47321 0%, #502314 100%)" };
    } else if (b.includes("domino")) {
        details = { iconClass: "fa-solid fa-pizza-slice", bgColor: "#006491", textColor: "#E31837", gradient: "linear-gradient(135deg, #006491 0%, #E31837 100%)" };
    } else if (b.includes("pizza hut")) {
        details = { iconClass: "fa-solid fa-pizza-slice", bgColor: "#EE3124", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #EE3124 0%, #7A1009 100%)" };
    } else if (b.includes("subway")) {
        details = { iconClass: "fa-solid fa-utensils", bgColor: "#008C15", textColor: "#FFC220", gradient: "linear-gradient(135deg, #008C15 0%, #FFC220 100%)" };
    } else if (b.includes("uber")) {
        details = { iconClass: "fa-brands fa-uber", bgColor: "#000000", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #000000 0%, #333333 100%)" };
    } else if (b.includes("doordash")) {
        details = { iconClass: "fa-solid fa-motorcycle", bgColor: "#FF3008", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #FF3008 0%, #A81B00 100%)" };

    // 5. Travel
    } else if (b.includes("airbnb")) {
        details = { iconClass: "fa-brands fa-airbnb", bgColor: "#FF5A5F", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #FF5A5F 0%, #A52D32 100%)" };
    } else if (b.includes("hotels")) {
        details = { iconClass: "fa-solid fa-hotel", bgColor: "#D32F2F", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #D32F2F 0%, #7B0000 100%)" };
    } else if (b.includes("booking")) {
        details = { iconClass: "fa-solid fa-bed", bgColor: "#003580", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #003580 0%, #001B44 100%)" };
    } else if (b.includes("expedia")) {
        details = { iconClass: "fa-solid fa-plane", bgColor: "#00256C", textColor: "#FFCC00", gradient: "linear-gradient(135deg, #00256C 0%, #FFCC00 100%)" };
    } else if (b.includes("delta")) {
        details = { iconClass: "fa-solid fa-plane-departure", bgColor: "#003366", textColor: "#E51937", gradient: "linear-gradient(135deg, #E51937 0%, #003366 100%)" };
    } else if (b.includes("american airlines")) {
        details = { iconClass: "fa-solid fa-plane-up", bgColor: "#0078D2", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #0078D2 0%, #C8102E 100%)" };
    } else if (b.includes("emirates")) {
        details = { iconClass: "fa-solid fa-plane", bgColor: "#D71921", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #D71921 0%, #700B10 100%)" };
    } else if (b.includes("southwest")) {
        details = { iconClass: "fa-solid fa-plane", bgColor: "#304CB2", textColor: "#F9B233", gradient: "linear-gradient(135deg, #304CB2 0%, #F9B233 100%)" };

    // 6. Crypto & Finance
    } else if (b.includes("vanilla visa")) {
        details = { iconClass: "fa-solid fa-credit-card", bgColor: "#2D3748", textColor: "#D4AF37", gradient: "linear-gradient(135deg, #2D3748 0%, #D4AF37 100%)" };
    } else if (b.includes("onevanilla")) {
        details = { iconClass: "fa-solid fa-credit-card", bgColor: "#1A202C", textColor: "#E2E8F0", gradient: "linear-gradient(135deg, #2D3748 0%, #1A202C 100%)" };
    } else if (b.includes("securespend")) {
        details = { iconClass: "fa-solid fa-shield-halved", bgColor: "#1A365D", textColor: "#63B3ED", gradient: "linear-gradient(135deg, #1A365D 0%, #2B6CB0 100%)" };
    } else if (b.includes("visa")) {
        details = { iconClass: "fa-brands fa-cc-visa", bgColor: "#1A1F71", textColor: "#F7B600", gradient: "linear-gradient(135deg, #1A1F71 0%, #F7B600 100%)" };
    } else if (b.includes("mastercard")) {
        details = { iconClass: "fa-brands fa-cc-mastercard", bgColor: "#EB001B", textColor: "#FF5F00", gradient: "linear-gradient(135deg, #EB001B 0%, #FF5F00 100%)" };
    } else if (b.includes("american express") || b.includes("amex")) {
        details = { iconClass: "fa-brands fa-cc-amex", bgColor: "#016FD0", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #016FD0 0%, #002663 100%)" };

    // 7. Fashion
    } else if (b.includes("nike")) {
        details = { iconClass: "fa-solid fa-bolt", bgColor: "#000000", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #000000 0%, #444444 100%)" };
    } else if (b.includes("adidas")) {
        details = { iconClass: "fa-solid fa-shoe-prints", bgColor: "#000000", textColor: "#0072CE", gradient: "linear-gradient(135deg, #000000 0%, #0072CE 100%)" };
    } else if (b.includes("h&m")) {
        details = { iconClass: "fa-solid fa-shirt", bgColor: "#E50010", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #E50010 0%, #880000 100%)" };
    } else if (b.includes("zara")) {
        details = { iconClass: "fa-solid fa-shirt", bgColor: "#000000", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #000000 0%, #333333 100%)" };
    } else if (b.includes("asos")) {
        details = { iconClass: "fa-solid fa-bag-shopping", bgColor: "#2D2D2D", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #2D2D2D 0%, #111111 100%)" };
    } else if (b.includes("foot locker")) {
        details = { iconClass: "fa-solid fa-shoe-prints", bgColor: "#EB1C24", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #EB1C24 0%, #000000 100%)" };
    } else if (b.includes("jd sports")) {
        details = { iconClass: "fa-solid fa-shoe-prints", bgColor: "#000000", textColor: "#FFD700", gradient: "linear-gradient(135deg, #000000 0%, #FFD700 100%)" };

    // 8. Digital Services
    } else if (b.includes("paypal")) {
        details = { iconClass: "fa-brands fa-paypal", bgColor: "#003087", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #003087 0%, #0079C1 100%)" };
    } else if (b.includes("razer")) {
        details = { iconClass: "fa-solid fa-coins", bgColor: "#111111", textColor: "#00FF00", gradient: "linear-gradient(135deg, #111111 0%, #00FF00 100%)" };
    } else if (b.includes("skrill")) {
        details = { iconClass: "fa-solid fa-wallet", bgColor: "#811E44", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #811E44 0%, #400A20 100%)" };
    } else if (b.includes("paysafe")) {
        details = { iconClass: "fa-solid fa-lock", bgColor: "#00A3E0", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #00A3E0 0%, #005B7F 100%)" };
    } else if (b.includes("twitch")) {
        details = { iconClass: "fa-brands fa-twitch", bgColor: "#9146FF", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #9146FF 0%, #3A0094 100%)" };
    } else if (b.includes("discord")) {
        details = { iconClass: "fa-brands fa-discord", bgColor: "#5865F2", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #5865F2 0%, #202773 100%)" };
    } else if (b.includes("linkedin")) {
        details = { iconClass: "fa-brands fa-linkedin", bgColor: "#0A66C2", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #0A66C2 0%, #004182 100%)" };

    // 9. Telecom
    } else if (b.includes("at&t")) {
        details = { iconClass: "fa-solid fa-globe", bgColor: "#00A8E0", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #00A8E0 0%, #005A78 100%)" };
    } else if (b.includes("verizon")) {
        details = { iconClass: "fa-solid fa-check", bgColor: "#CD040B", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #CD040B 0%, #000000 100%)" };
    } else if (b.includes("t-mobile")) {
        details = { iconClass: "fa-solid fa-mobile-screen-button", bgColor: "#E20074", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #E20074 0%, #7A003E 100%)" };
    } else if (b.includes("vodafone")) {
        details = { iconClass: "fa-solid fa-circle-notch", bgColor: "#E60000", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #E60000 0%, #800000 100%)" };
    } else if (b.includes("mtn")) {
        details = { iconClass: "fa-solid fa-tower-cell", bgColor: "#FFCC00", textColor: "#000000", gradient: "linear-gradient(135deg, #FFCC00 0%, #CC9900 100%)" };
    } else if (b.includes("airtel")) {
        details = { iconClass: "fa-solid fa-signal", bgColor: "#E40000", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #E40000 0%, #8B0000 100%)" };
    } else if (b.includes("glo")) {
        details = { iconClass: "fa-solid fa-globe", bgColor: "#008000", textColor: "#FFFFFF", gradient: "linear-gradient(135deg, #008000 0%, #004D00 100%)" };
    } else if (b.includes("9mobile")) {
        details = { iconClass: "fa-solid fa-mobile-button", bgColor: "#005C2B", textColor: "#84B819", gradient: "linear-gradient(135deg, #005C2B 0%, #84B819 100%)" };
    }

    return details;
}
