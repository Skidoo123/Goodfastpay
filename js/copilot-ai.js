// Goodfastpay Platform - FastPay AI Copilot Interactive Assistant Engine

/**
 * Initialize and Mount FastPay AI Copilot Floating Drawer Widget
 */
function initCopilotWidget() {
    if (document.getElementById("copilot-widget-container")) return;

    const widgetHTML = `
    <div id="copilot-widget-container" style="position: fixed; bottom: 24px; right: 24px; z-index: 99999; font-family: inherit; user-select: none;">
        <!-- Floating Action Trigger Button -->
        <button id="copilot-trigger-btn" onclick="toggleCopilotDrawer()" style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #06b6d4); border: 2px solid rgba(255,255,255,0.2); color: #fff; font-size: 1.4rem; cursor: grab; box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4); display: flex; align-items: center; justify-content: center; position: relative; transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);" title="FastPay AI Copilot (Drag to move)">
            <i class="fas fa-robot"></i>
            <span style="position: absolute; top: 0; right: 0; width: 14px; height: 14px; background: #10b981; border: 2px solid #0f172a; border-radius: 50%; animation: pulse-ring 2s infinite;"></span>
        </button>

        <!-- Slide-Up Chat Drawer Window -->
        <div id="copilot-drawer" style="display: none; position: absolute; bottom: 70px; right: 0; width: 360px; max-width: calc(100vw - 32px); height: 500px; max-height: calc(100vh - 120px); background: #0f172a; border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); overflow: hidden; flex-direction: column; color: #fff; backdrop-filter: blur(12px);">
            <!-- Drawer Header (Draggable Handle) -->
            <div id="copilot-header-drag-handle" style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; cursor: move;" title="Drag to move Copilot">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 34px; height: 34px; border-radius: 10px; background: rgba(99,102,241,0.2); border: 1px solid #6366f1; display: flex; align-items: center; justify-content: center; color: #6366f1; font-size: 1.05rem;">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div>
                        <div style="font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                            FastPay AI Copilot <span style="font-size: 0.65rem; background: rgba(16,185,129,0.2); color: #10b981; border: 1px solid rgba(16,185,129,0.4); padding: 1px 6px; border-radius: 99px; font-weight: 700;">ONLINE</span>
                        </div>
                        <div style="font-size: 0.72rem; color: #94a3b8;">Instant Rate & Trade Intelligence (Drag header to move)</div>
                    </div>
                </div>
                <button type="button" onclick="toggleCopilotDrawer()" style="background: none; border: none; color: #64748b; font-size: 1.1rem; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- Quick Prompt Suggestions Bar -->
            <div style="padding: 10px 14px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06); overflow-x: auto; white-space: nowrap; display: flex; gap: 8px;" class="copilot-chips-row">
                <button type="button" onclick="sendCopilotQuickPrompt('What is the current rate for Steam $100?')" class="copilot-chip">⚡ Steam Rate</button>
                <button type="button" onclick="sendCopilotQuickPrompt('How fast is cash withdrawal to my bank?')" class="copilot-chip">🚀 Payout Time</button>
                <button type="button" onclick="sendCopilotQuickPrompt('What are VIP Tier bonuses?')" class="copilot-chip">💎 VIP Perks</button>
                <button type="button" onclick="sendCopilotQuickPrompt('How do I sell a gift card?')" class="copilot-chip">💡 How to Sell</button>
            </div>

            <!-- Chat Messages Log Container -->
            <div id="copilot-messages-list" style="flex-grow: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem;">
                <div class="copilot-msg bot-msg" style="align-self: flex-start; max-width: 85%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding: 12px 14px; border-radius: 14px; border-top-left-radius: 2px; color: #e2e8f0; line-height: 1.45;">
                    👋 Hello! I am your <strong>FastPay AI Copilot</strong>. Ask me anything about live gift card rates, cashout speeds, or platform features!
                </div>
            </div>

            <!-- Input Bar -->
            <form onsubmit="handleCopilotSubmit(event)" style="padding: 12px 14px; background: #1e293b; border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: 8px; align-items: center;">
                <input type="text" id="copilot-input-field" placeholder="Ask AI Copilot..." required autocomplete="off" style="flex-grow: 1; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 14px; color: #fff; font-size: 0.85rem;">
                <button type="submit" style="width: 38px; height: 38px; border-radius: 10px; background: #6366f1; border: none; color: #fff; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </form>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML("beforeend", widgetHTML);

    // Inject Chip & Pulse Styles
    if (!document.getElementById("copilot-styles")) {
        const style = document.createElement("style");
        style.id = "copilot-styles";
        style.textContent = `
            @keyframes pulse-ring {
                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
            }
            .copilot-chip {
                background: rgba(99, 102, 241, 0.15);
                border: 1px solid rgba(99, 102, 241, 0.3);
                color: #a5b4fc;
                font-size: 0.73rem;
                font-weight: 700;
                padding: 4px 10px;
                border-radius: 99px;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
            }
            .copilot-chip:hover {
                background: #6366f1;
                color: #fff;
            }
            .copilot-msg.user-msg {
                align-self: flex-end;
                background: #6366f1;
                color: #fff;
                border-radius: 14px;
                border-bottom-right-radius: 2px;
                padding: 10px 14px;
                max-width: 85%;
            }
        `;
        document.head.appendChild(style);
    }

    // Attach Draggable Functionality
    makeCopilotDraggable();
}

/**
 * Enable Dragging for AI Copilot (Mouse + Touch support)
 */
function makeCopilotDraggable() {
    const container = document.getElementById("copilot-widget-container");
    const triggerBtn = document.getElementById("copilot-trigger-btn");
    const header = document.getElementById("copilot-header-drag-handle");
    if (!container) return;

    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let initialLeft = 0, initialTop = 0;
    let hasMoved = false;

    function onDragStart(e) {
        const target = e.target;
        // Allow dragging from button or drawer header
        const isHeader = header && (header.contains(target) || header === target);
        const isButton = triggerBtn && (triggerBtn.contains(target) || triggerBtn === target);
        
        if (!isHeader && !isButton) return;
        
        // Exclude interactive buttons inside header (like close X button)
        if (target.closest("button") && !isButton) return;

        isDragging = true;
        hasMoved = false;

        const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;

        dragStartX = clientX;
        dragStartY = clientY;

        const rect = container.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        // Convert position to top/left coordinates
        container.style.bottom = "auto";
        container.style.right = "auto";
        container.style.left = `${initialLeft}px`;
        container.style.top = `${initialTop}px`;

        if (triggerBtn) triggerBtn.style.cursor = "grabbing";
        if (header) header.style.cursor = "grabbing";

        document.addEventListener("mousemove", onDragMove);
        document.addEventListener("mouseup", onDragEnd);
        document.addEventListener("touchmove", onDragMove, { passive: false });
        document.addEventListener("touchend", onDragEnd);
    }

    function onDragMove(e) {
        if (!isDragging) return;

        const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - dragStartX;
        const deltaY = clientY - dragStartY;

        if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
            hasMoved = true;
        }

        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;

        // Viewport Boundary Protection
        const padding = 10;
        const maxLeft = window.innerWidth - container.offsetWidth - padding;
        const maxTop = window.innerHeight - container.offsetHeight - padding;

        newLeft = Math.max(padding, Math.min(newLeft, maxLeft));
        newTop = Math.max(padding, Math.min(newTop, maxTop));

        container.style.left = `${newLeft}px`;
        container.style.top = `${newTop}px`;

        if (e.cancelable) e.preventDefault();
    }

    function onDragEnd() {
        if (!isDragging) return;
        isDragging = false;

        if (triggerBtn) triggerBtn.style.cursor = "grab";
        if (header) header.style.cursor = "move";

        document.removeEventListener("mousemove", onDragMove);
        document.removeEventListener("mouseup", onDragEnd);
        document.removeEventListener("touchmove", onDragMove);
        document.removeEventListener("touchend", onDragEnd);
    }

    container.addEventListener("mousedown", onDragStart);
    container.addEventListener("touchstart", onDragStart, { passive: true });

    // Prevent trigger button click action if user was dragging
    if (triggerBtn) {
        triggerBtn.addEventListener("click", (e) => {
            if (hasMoved) {
                e.stopImmediatePropagation();
                e.preventDefault();
                hasMoved = false;
            }
        }, true);
    }
}

function toggleCopilotDrawer() {
    initCopilotWidget();
    const drawer = document.getElementById("copilot-drawer");
    const container = document.getElementById("copilot-widget-container");
    const btn = document.getElementById("copilot-trigger-btn");
    if (!drawer || !container) return;

    if (drawer.style.display === "none" || drawer.style.display === "") {
        // Adapt drawer open orientation based on screen position
        const rect = container.getBoundingClientRect();
        if (rect.top < 520) {
            drawer.style.bottom = "auto";
            drawer.style.top = "70px";
        } else {
            drawer.style.top = "auto";
            drawer.style.bottom = "70px";
        }

        if (rect.left < 380) {
            drawer.style.right = "auto";
            drawer.style.left = "0";
        } else {
            drawer.style.left = "auto";
            drawer.style.right = "0";
        }

        drawer.style.display = "flex";
        if (btn) btn.style.transform = "scale(0.9)";
    } else {
        drawer.style.display = "none";
        if (btn) btn.style.transform = "scale(1)";
    }
}

function sendCopilotQuickPrompt(promptText) {
    const input = document.getElementById("copilot-input-field");
    if (input) {
        input.value = promptText;
        handleCopilotSubmit(new Event("submit"));
    }
}

function handleCopilotSubmit(e) {
    e.preventDefault();
    const input = document.getElementById("copilot-input-field");
    const msgList = document.getElementById("copilot-messages-list");
    if (!input || !msgList) return;

    const userText = input.value.trim();
    if (!userText) return;

    // Render User Message
    const userMsgElem = document.createElement("div");
    userMsgElem.className = "copilot-msg user-msg";
    userMsgElem.textContent = userText;
    msgList.appendChild(userMsgElem);

    input.value = "";
    msgList.scrollTop = msgList.scrollHeight;

    // Show AI Typing Indicator
    const typingElem = document.createElement("div");
    typingElem.className = "copilot-msg bot-msg";
    typingElem.style.cssText = "align-self: flex-start; max-width: 85%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding: 10px 14px; border-radius: 14px; color: #94a3b8;";
    typingElem.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> FastPay AI is thinking...`;
    msgList.appendChild(typingElem);
    msgList.scrollTop = msgList.scrollHeight;

    // Generate AI Smart Response
    setTimeout(() => {
        const replyText = getAISmartResponse(userText);
        typingElem.innerHTML = replyText;
        msgList.scrollTop = msgList.scrollHeight;
    }, 750);
}

/**
 * FastPay AI Helper: Auto-fill trade workspace form and navigate user directly
 */
function copilotAutoFillTrade(brand, currency, value) {
    if (typeof switchSection === "function") {
        switchSection("sell-card");
    }
    
    setTimeout(() => {
        const brandSelect = document.getElementById("sell-brand");
        const currSelect = document.getElementById("sell-currency");
        const valInput = document.getElementById("sell-value");

        if (brandSelect && brand) {
            brandSelect.value = brand;
            brandSelect.dispatchEvent(new Event("change"));
        }

        setTimeout(() => {
            if (currSelect && currency) {
                currSelect.value = currency;
                currSelect.dispatchEvent(new Event("change"));
            }
            if (valInput && value) {
                valInput.value = value;
                valInput.dispatchEvent(new Event("input"));
            }
            if (typeof updateSellRate === "function") {
                updateSellRate();
            }

            const targetSection = document.getElementById("sell-card-section") || document.getElementById("sell-card");
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }, 150);
    }, 100);
}

/**
 * FastPay AI Response Rules Engine connected to Live Database
 * @param {String} query - User input string
 * @returns {String} HTML response text
 */
function getAISmartResponse(query) {
    const q = query.toLowerCase();

    // Fetch Live Database instance
    let db = null;
    try {
        if (typeof getDB === "function") {
            db = getDB();
        }
    } catch (err) {
        console.warn("Copilot DB fetch warning:", err);
    }

    // 1. Live Wallet Balance & Account Inquiry
    if (q.includes("balance") || q.includes("wallet") || q.includes("vault") || q.includes("my money") || q.includes("account balance")) {
        let user = null;
        if (window.currentUser) {
            user = window.currentUser;
        } else if (db && db.users && db.users.length > 0) {
            user = db.users[0];
        }

        if (user && user.wallet) {
            const ngnBal = (user.wallet.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2});
            const usdBal = (user.wallet.usdBalance || 0).toFixed(2);
            const tier = user.vipTier || user.loyaltyTier || "Bronze Tier";

            return `💳 <strong>Your Live Account Overview:</strong><br>
            • <strong>Main NGN Wallet:</strong> ₦${ngnBal}<br>
            • <strong>Global USD Vault:</strong> $${usdBal} USD<br>
            • <strong>VIP Rank:</strong> <span style="color:#10b981; font-weight:700;">${tier}</span><br><br>
            <div style="display:flex; gap:8px; margin-top:6px;">
                <button onclick="if(typeof switchSection==='function') switchSection('withdraw');" class="copilot-chip" style="background:#10b981; color:#fff;">💸 Withdraw NGN</button>
                <button onclick="copilotAutoFillTrade('Steam', 'USD', 100);" class="copilot-chip" style="background:#6366f1; color:#fff;">⚡ Sell Gift Card</button>
            </div>`;
        } else {
            return `💳 <strong>Account Balance:</strong><br>
            Please log in to your dashboard to view your live NGN wallet and USD Vault balances!`;
        }
    }

    // 2. Live Rate Query (Queries db.settings.rates in real-time)
    const knownBrands = ["steam", "apple", "amazon", "google", "razer", "sephora", "ebay", "nordstrom", "vanilla", "nike", "walmart", "footlocker", "xbox", "playstation"];
    const isRateQuery = q.includes("rate") || q.includes("how much") || knownBrands.some(b => q.includes(b));

    if (isRateQuery && db && db.settings && db.settings.rates) {
        const rates = db.settings.rates;
        let matchedBrand = knownBrands.find(b => q.includes(b));
        
        let multiplier = 1.0;
        if (typeof getLoyaltyRateMultiplier === "function") {
            multiplier = getLoyaltyRateMultiplier();
        }

        if (matchedBrand) {
            // Find capitalized key in rates matrix
            const brandKey = Object.keys(rates).find(k => k.toLowerCase().includes(matchedBrand));
            if (brandKey && rates[brandKey]) {
                const bRates = rates[brandKey];
                let listHTML = `📊 <strong>Live Rate for ${brandKey}:</strong><br>`;
                for (const [curr, r] of Object.entries(bRates)) {
                    const finalRate = Math.round(r * multiplier);
                    const sym = curr === "USD" ? "$" : curr === "EUR" ? "€" : curr === "GBP" ? "£" : curr;
                    listHTML += `• <strong>${curr}:</strong> ₦${finalRate.toLocaleString()} per ${sym}1<br>`;
                }
                if (multiplier > 1.0) {
                    listHTML += `<em>(Includes your active VIP Loyalty Bonus multiplier!)</em><br>`;
                }
                listHTML += `<div style="margin-top:8px;">
                    <button onclick="copilotAutoFillTrade('${brandKey}', 'USD', 100);" class="copilot-chip" style="background:#6366f1; color:#fff;">⚡ Trade ${brandKey} Now</button>
                </div>`;
                return listHTML;
            }
        }

        // Return Top Live Rates Summary
        let summaryHTML = `📊 <strong>Live Platform Exchange Rates (per $1):</strong><br>`;
        const topBrands = ["Steam", "Apple", "Amazon", "Razer Gold", "Google Play"];
        topBrands.forEach(b => {
            if (rates[b] && rates[b]["USD"]) {
                const rate = Math.round(rates[b]["USD"] * multiplier);
                summaryHTML += `• <strong>${b} USD:</strong> ₦${rate.toLocaleString()} / $1<br>`;
            }
        });
        summaryHTML += `<div style="margin-top:8px; display:flex; gap:6px;">
            <button onclick="copilotAutoFillTrade('Steam', 'USD', 100);" class="copilot-chip">⚡ Steam $100</button>
            <button onclick="copilotAutoFillTrade('Apple', 'USD', 100);" class="copilot-chip">⚡ Apple $100</button>
        </div>`;
        return summaryHTML;
    }

    // 3. Payout & Withdrawal Speed
    if (q.includes("payout") || q.includes("fast") || q.includes("time") || q.includes("withdrawal") || q.includes("withdraw")) {
        return `⚡ <strong>Automated Instant Payouts:</strong><br>
        All withdrawals are processed via our automated Interbank NIBSS Gateway and land in your bank account in <strong>under 2 minutes</strong>! 🚀<br>
        <div style="margin-top:8px;">
            <button onclick="if(typeof switchSection==='function') switchSection('withdraw');" class="copilot-chip" style="background:#10b981; color:#fff;">💸 Open Withdrawal Portal</button>
        </div>`;
    }

    // 4. VIP Tier Perks
    if (q.includes("vip") || q.includes("tier") || q.includes("rank") || q.includes("bonus")) {
        return `💎 <strong>VIP Loyalty Tier Perks:</strong><br>
        • <strong>Bronze:</strong> Standard rates<br>
        • <strong>Silver VIP (₦500k+):</strong> +0.5% Cash Bonus<br>
        • <strong>Gold Elite (₦2M+):</strong> +1.0% Cash Bonus + Zero Withdrawal Fees<br>
        • <strong>Diamond Titan (₦5M+):</strong> +1.5% Cash Bonus + Dedicated Concierge<br>
        <div style="margin-top:8px;">
            <button onclick="if(typeof switchSection==='function') switchSection('loyalty');" class="copilot-chip" style="background:#6366f1; color:#fff;">💎 View My VIP Progress</button>
        </div>`;
    }

    // 5. How to Sell / Trade Assistance
    if (q.includes("sell") || q.includes("trade") || q.includes("how to")) {
        return `💡 <strong>How to Sell a Gift Card:</strong><br>
        1. Click below to auto-open the trade workspace.<br>
        2. Upload your card scan (our <strong>AI OCR Scanner</strong> will extract PIN automatically!).<br>
        3. Select payout in <strong>NGN ₦ Wallet</strong> or <strong>USD $ Vault</strong>.<br>
        4. Tap <strong>Sell Now</strong> for instant payout!<br>
        <div style="margin-top:8px;">
            <button onclick="copilotAutoFillTrade('Steam', 'USD', 100);" class="copilot-chip" style="background:#10b981; color:#fff;">🚀 Start Trade Now</button>
        </div>`;
    }

    // 6. Security & Legitimacy
    if (q.includes("safe") || q.includes("security") || q.includes("legit") || q.includes("trust")) {
        return `🛡️ <strong>100% Guaranteed & Encrypted:</strong><br>
        Goodfastpay utilizes SSL 256-bit encryption, automated fraud interceptors, and instant reserve vault settlement to guarantee 100% payout security.`;
    }

    // Fallback response with live database hint
    return `🤖 Hi! I am connected to live Goodfastpay rates & user balances. Ask me:
    • <em>"What is the live rate for Steam $100?"</em>
    • <em>"Check my wallet balance"</em>
    • <em>"How fast are bank payouts?"</em>`;
}

document.addEventListener("DOMContentLoaded", () => {
    initCopilotWidget();
});

