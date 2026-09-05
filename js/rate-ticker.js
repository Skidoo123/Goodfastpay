// Goodfastpay Platform - Live Financial Rate Ticker & Target Rate Alarm Engine

const LIVE_RATE_DATA = [
    { brand: "Steam", currency: "USD", rate: 860, change: "+2.4%", trend: "up", flag: "🇺🇸" },
    { brand: "Apple/iTunes", currency: "USD", rate: 840, change: "+1.8%", trend: "up", flag: "🇺🇸" },
    { brand: "Amazon", currency: "USD", rate: 825, change: "-0.5%", trend: "down", flag: "🇺🇸" },
    { brand: "Google Play", currency: "USD", rate: 830, change: "+3.1%", trend: "up", flag: "🇺🇸" },
    { brand: "Razer Gold", currency: "USD", rate: 875, change: "+4.2%", trend: "up", flag: "🇺🇸" },
    { brand: "Vanilla Visa", currency: "USD", rate: 850, change: "+1.2%", trend: "up", flag: "🇺🇸" },
    { brand: "Sephora", currency: "USD", rate: 820, change: "+0.8%", trend: "up", flag: "🇺🇸" },
    { brand: "Xbox", currency: "USD", rate: 810, change: "-1.0%", trend: "down", flag: "🇺🇸" },
    { brand: "Steam", currency: "EUR", rate: 910, change: "+2.0%", trend: "up", flag: "🇪🇺" },
    { brand: "Steam", currency: "GBP", rate: 1040, change: "+3.5%", trend: "up", flag: "🇬🇧" }
];

/**
 * Render Live Financial Rate Marquee Ticker in Target Elements
 */
function initRateTickerHeader() {
    const tickerContainers = document.querySelectorAll(".live-rate-marquee-container");
    if (!tickerContainers.length) return;

    const tickerItemsHTML = LIVE_RATE_DATA.map(item => `
        <div class="rate-ticker-chip" style="display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 4px 12px; border-radius: 99px; font-size: 0.78rem; font-weight: 600; white-space: nowrap; margin-right: 12px;">
            <span>${item.flag} ${item.brand} (${item.currency})</span>
            <strong style="color: var(--accent, #10b981);">₦${item.rate}/$1</strong>
            <span style="font-size: 0.7rem; color: ${item.trend === 'up' ? '#10b981' : '#ef4444'}; font-weight: 700;">
                <i class="fas fa-caret-${item.trend}"></i> ${item.change}
            </span>
        </div>
    `).join("");

    tickerContainers.forEach(container => {
        container.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.9); border-bottom: 1px solid rgba(255,255,255,0.08); overflow: hidden; display: flex; align-items: center; height: 36px; padding: 0 12px; backdrop-filter: blur(8px);">
                <div style="display: flex; align-items: center; gap: 6px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--primary, #6366f1); background: rgba(99,102,241,0.15); padding: 3px 8px; border-radius: 6px; margin-right: 12px; flex-shrink: 0;">
                    <i class="fas fa-chart-line"></i> LIVE RATES
                </div>
                <div style="flex-grow: 1; overflow: hidden; white-space: nowrap; position: relative;">
                    <div class="marquee-track" style="display: inline-block; animation: marquee-scroll 25s linear infinite;">
                        ${tickerItemsHTML}
                        ${tickerItemsHTML}
                    </div>
                </div>
                <button type="button" onclick="openRateAlarmModal()" style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #10b981; font-size: 0.72rem; font-weight: 700; padding: 4px 10px; border-radius: 99px; cursor: pointer; flex-shrink: 0; margin-left: 8px; display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-bell"></i> Target Alarm
                </button>
            </div>
        `;
    });

    // Add marquee CSS rule if missing
    if (!document.getElementById("rate-marquee-styles")) {
        const style = document.createElement("style");
        style.id = "rate-marquee-styles";
        style.textContent = `
            @keyframes marquee-scroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
            }
            .marquee-track:hover {
                animation-play-state: paused;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Create and Mount Target Rate Alarm Modal into Body
 */
function initRateAlarmModal() {
    if (document.getElementById("rate-alarm-modal")) return;

    const modalHTML = `
    <div id="rate-alarm-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(10, 15, 29, 0.85); backdrop-filter: blur(10px); z-index: 100000; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: #0f172a; border: 1px solid rgba(16,185,129,0.3); width: 100%; max-width: 440px; border-radius: 18px; box-shadow: 0 25px 50px rgba(0,0,0,0.5); overflow: hidden; color: #fff;">
            <div style="padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-bell-slash" style="color: #10b981; font-size: 1.2rem;"></i>
                    <h3 style="font-size: 1.05rem; font-weight: 800; margin: 0;">Set Target Rate Alarm</h3>
                </div>
                <button type="button" onclick="closeRateAlarmModal()" style="background: none; border: none; color: #64748b; font-size: 1.2rem; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form onsubmit="handleSaveRateAlarm(event)" style="padding: 24px;">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">Select Card Brand</label>
                    <select id="alarm-card-brand" style="width: 100%; background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 14px; color: #fff; font-size: 0.9rem;">
                        <option value="Steam">Steam Gift Card</option>
                        <option value="Apple/iTunes">Apple / iTunes Card</option>
                        <option value="Amazon">Amazon Gift Card</option>
                        <option value="Razer Gold">Razer Gold</option>
                        <option value="Google Play">Google Play</option>
                        <option value="Vanilla Visa">Vanilla Visa Card</option>
                    </select>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">Target Rate Threshold (₦ / $1)</label>
                    <input type="number" id="alarm-target-rate" placeholder="e.g. 880" min="500" max="2000" required style="width: 100%; background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 14px; color: #fff; font-size: 0.95rem; font-weight: 700;">
                    <span style="font-size: 0.75rem; color: #64748b; margin-top: 4px; display: block;">You will receive an instant toast alert when the exchange rate reaches or exceeds this price.</span>
                </div>

                <button type="submit" style="width: 100%; background: #10b981; border: none; color: #fff; font-weight: 800; padding: 12px; border-radius: 12px; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-check-circle"></i> Activate Rate Alarm
                </button>
            </form>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
}

function openRateAlarmModal() {
    initRateAlarmModal();
    const modal = document.getElementById("rate-alarm-modal");
    if (modal) modal.style.display = "flex";
}

function closeRateAlarmModal() {
    const modal = document.getElementById("rate-alarm-modal");
    if (modal) modal.style.display = "none";
}

function handleSaveRateAlarm(e) {
    e.preventDefault();
    const brand = document.getElementById("alarm-card-brand").value;
    const rate = document.getElementById("alarm-target-rate").value;

    let alarms = JSON.parse(localStorage.getItem("goodfastpay_rate_alarms") || "[]");
    alarms.push({ brand, targetRate: parseInt(rate, 10), timestamp: Date.now() });
    localStorage.setItem("goodfastpay_rate_alarms", JSON.stringify(alarms));

    closeRateAlarmModal();

    if (typeof showToast === "function") {
        showToast(`Rate Alarm Set! We will notify you when ${brand} reaches ₦${rate}/$1`, "success");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initRateTickerHeader();
    initRateAlarmModal();
});
