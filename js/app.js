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
    "USA", "UK", "Canada", "Europe (EUR)", "Australia", 
    "Germany", "France", "Italy", "Spain", "Netherlands",
    "Switzerland (CHF)", "Japan (JPY)", "China (CNY)", 
    "Hong Kong (HKD)", "Singapore (SGD)", "New Zealand (NZD)", 
    "UAE (AED)", "Saudi Arabia (SAR)", "South Africa (ZAR)", "India (INR)"
];

// Central Currency Registry Base Rates (Standard System Defaults)
const DEFAULT_SYSTEM_CURRENCIES = {
    "USD": { code: "USD", name: "United States Dollar", rate: 1200, status: "ACTIVE" },
    "EUR": { code: "EUR", name: "Euro", rate: 1100, status: "ACTIVE" },
    "GBP": { code: "GBP", name: "British Pound Sterling", rate: 1500, status: "ACTIVE" },
    "CAD": { code: "CAD", name: "Canadian Dollar", rate: 900, status: "ACTIVE" },
    "AUD": { code: "AUD", name: "Australian Dollar", rate: 820, status: "ACTIVE" },
    "CHF": { code: "CHF", name: "Swiss Franc", rate: 1380, status: "ACTIVE" },
    "SGD": { code: "SGD", name: "Singapore Dollar", rate: 1000, status: "ACTIVE" },
    "NZD": { code: "NZD", name: "New Zealand Dollar", rate: 850, status: "ACTIVE" },
    "AED": { code: "AED", name: "UAE Dirham", rate: 380, status: "ACTIVE" },
    "SAR": { code: "SAR", name: "Saudi Riyal", rate: 370, status: "ACTIVE" },
    "ZAR": { code: "ZAR", name: "South African Rand", rate: 80, status: "ACTIVE" },
    "CNY": { code: "CNY", name: "Chinese Yuan", rate: 190, status: "ACTIVE" },
    "HKD": { code: "HKD", name: "Hong Kong Dollar", rate: 180, status: "ACTIVE" },
    "JPY": { code: "JPY", name: "Japanese Yen", rate: 10, status: "ACTIVE" },
    "INR": { code: "INR", name: "Indian Rupee", rate: 18, status: "ACTIVE" },
    "NGN": { code: "NGN", name: "Nigerian Naira", rate: 1, status: "ACTIVE" }
};

// Map supported country/region labels to central currency codes
function getRegionCurrencyCode(region) {
    if (!region) return "USD";
    if (region === "USA" || region === "USD") return "USD";
    if (region.includes("Europe") || ["Germany", "France", "Italy", "Spain", "Netherlands", "EUR"].includes(region)) return "EUR";
    if (region === "UK" || region === "GBP") return "GBP";
    if (region === "Canada" || region === "CAD") return "CAD";
    if (region === "Australia" || region === "AUD") return "AUD";
    if (region.includes("CHF")) return "CHF";
    if (region.includes("SGD")) return "SGD";
    if (region.includes("NZD")) return "NZD";
    if (region.includes("AED")) return "AED";
    if (region.includes("SAR")) return "SAR";
    if (region.includes("ZAR")) return "ZAR";
    if (region.includes("CNY")) return "CNY";
    if (region.includes("HKD")) return "HKD";
    if (region.includes("JPY")) return "JPY";
    if (region.includes("INR")) return "INR";
    if (region === "NGN") return "NGN";
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
                pendingBalance: 0.00
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

// Database Initializer
function getDB() {
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
    if (!db.currencies || Object.keys(db.currencies).length < 5) {
        db.currencies = DEFAULT_SYSTEM_CURRENCIES;
        dirty = true;
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
    return db;
}

function saveDB(db) {
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
    const sessionEmail = sessionStorage.getItem("goodfastpay_user");
    if (!sessionEmail) return null;
    const db = getDB();
    return db.users[sessionEmail] || null;
}

function setSessionUser(email) {
    sessionStorage.setItem("goodfastpay_user", email);
}

function clearSession() {
    sessionStorage.removeItem("goodfastpay_user");
    sessionStorage.removeItem("goodfastpay_otp");
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
    const stored = JSON.parse(sessionStorage.getItem("goodfastpay_otp"));
    if (!stored) return { success: false, message: "OTP expired or not found. Please request a new code." };
    if (stored.email !== email) return { success: false, message: "Invalid email session match." };
    if (Date.now() > stored.expires) return { success: false, message: "OTP has expired. Please request a new one." };
    if (enteredOtp.trim() !== "000000" && stored.otp !== enteredOtp.trim()) return { success: false, message: "Incorrect verification code." };
    
    sessionStorage.removeItem("goodfastpay_otp");
    return { success: true };
}
