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
 * FastPay AI Response Rules Engine
 * @param {String} query - User input string
 * @returns {String} HTML response text
 */
function getAISmartResponse(query) {
    const q = query.toLowerCase();

    if (q.includes("steam") || q.includes("apple") || q.includes("amazon") || q.includes("rate")) {
        return `📊 <strong>Live Rate Breakdown:</strong><br>
        • <strong>Steam USD:</strong> ₦860 / $1<br>
        • <strong>Apple USD:</strong> ₦840 / $1<br>
        • <strong>Amazon USD:</strong> ₦825 / $1<br>
        • <strong>Razer Gold:</strong> ₦875 / $1<br>
        <em>Note: VIP Silver/Gold/Diamond accounts automatically get up to +1.5% cashback bonus!</em>`;
    }

    if (q.includes("payout") || q.includes("fast") || q.includes("time") || q.includes("withdrawal")) {
        return `⚡ <strong>Automated Instant Payouts:</strong><br>
        All withdrawals are processed via our automated Interbank NIBSS Gateway and usually land in your bank account in <strong>under 2 minutes</strong>! 🚀`;
    }

    if (q.includes("vip") || q.includes("tier") || q.includes("rank") || q.includes("bonus")) {
        return `💎 <strong>VIP Loyalty Tier Perks:</strong><br>
        • <strong>Bronze:</strong> Standard rates<br>
        • <strong>Silver VIP (₦500k+):</strong> +0.5% Cash Bonus<br>
        • <strong>Gold Elite (₦2M+):</strong> +1.0% Cash Bonus + Zero Withdrawal Fees<br>
        • <strong>Diamond Titan (₦5M+):</strong> +1.5% Cash Bonus + Dedicated Concierge`;
    }

    if (q.includes("sell") || q.includes("how to")) {
        return `💡 <strong>How to Sell a Gift Card:</strong><br>
        1. Navigate to <strong>Sell Gift Card</strong> in your portal.<br>
        2. Select your brand & currency.<br>
        3. Upload card scan (our <strong>AI OCR Scanner</strong> will extract PIN automatically!).<br>
        4. Tap <strong>Sell Now</strong> to start instant settlement.`;
    }

    if (q.includes("safe") || q.includes("security") || q.includes("legit")) {
        return `🛡️ <strong>100% Guaranteed & Encrypted:</strong><br>
        Goodfastpay utilizes SSL 256-bit encryption, automated fraud interceptors, and instant reserve vault settlement to guarantee your payouts.`;
    }

    return `🤖 Thank you for reaching out! You can trade gift cards, withdraw funds instantly to bank, or check rates directly in your dashboard. If you need dedicated human support, open a ticket under <strong>Help & Support</strong>!`;
}

document.addEventListener("DOMContentLoaded", () => {
    initCopilotWidget();
});
