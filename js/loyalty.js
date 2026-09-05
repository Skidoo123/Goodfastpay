// Goodfastpay Platform - VIP Gamified Loyalty Tiers & Cashback Rewards Engine

const VIP_TIER_CONFIG = [
    { name: "Bronze Trader", minVol: 0, maxVol: 500000, bonus: 0.0, icon: "fa-shield", color: "#94a3b8", desc: "Base rate trading, 24/7 automated support" },
    { name: "Silver VIP", minVol: 500000, maxVol: 2000000, bonus: 0.5, icon: "fa-award", color: "#cbd5e1", desc: "+0.5% Cash bonus per trade, priority queue" },
    { name: "Gold Elite", minVol: 2000000, maxVol: 5000000, bonus: 1.0, icon: "fa-crown", color: "#f59e0b", desc: "+1.0% Cash bonus per trade, dedicated agent, 0 withdrawal fees" },
    { name: "Diamond Titan", minVol: 5000000, maxVol: Infinity, bonus: 1.5, icon: "fa-gem", color: "#38bdf8", desc: "+1.5% Cash bonus per trade, instant automated payouts, VIP concierge" }
];

/**
 * Calculate User VIP Rank and Loyalty Benefits based on Volume
 * @param {Number} totalVolume - Total accumulated volume in Naira
 * @returns {Object} Tier breakdown
 */
function getUserLoyaltyTier(totalVolume = 0) {
    let currentTier = VIP_TIER_CONFIG[0];
    let nextTier = VIP_TIER_CONFIG[1];

    for (let i = 0; i < VIP_TIER_CONFIG.length; i++) {
        if (totalVolume >= VIP_TIER_CONFIG[i].minVol) {
            currentTier = VIP_TIER_CONFIG[i];
            nextTier = VIP_TIER_CONFIG[i + 1] || null;
        }
    }

    let progressPct = 100;
    if (nextTier) {
        const range = nextTier.minVol - currentTier.minVol;
        const currentProgress = totalVolume - currentTier.minVol;
        progressPct = Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100)));
    }

    return {
        currentTier,
        nextTier,
        progressPct,
        totalVolume
    };
}

/**
 * Calculate total user volume from localStorage trade ledger
 */
function calculateUserTotalVolume() {
    let total = 0;
    try {
        const state = JSON.parse(localStorage.getItem("goodfastpay_portal_state") || "{}");
        const trades = state.trades || [];
        trades.forEach(t => {
            if (t.status === "COMPLETED" || t.status === "SUCCESS") {
                const amt = parseFloat(t.payout || t.amount || 0);
                if (!isNaN(amt)) total += amt;
            }
        });
    } catch (e) {
        console.warn("Volume calculation error:", e);
    }
    return total;
}

/**
 * Get Loyalty Rate Multiplier for Sell Rate Calculations
 * @returns {Number} Multiplier (e.g., 1.01 for +1%)
 */
function getLoyaltyRateMultiplier() {
    const vol = calculateUserTotalVolume();
    const tierData = getUserLoyaltyTier(vol);
    return 1 + (tierData.currentTier.bonus / 100);
}

/**
 * Render Gamified VIP Loyalty Widget in Portal Dashboard
 */
function renderLoyaltyWidget() {
    const container = document.getElementById("vip-loyalty-widget-container");
    if (!container) return;

    const vol = calculateUserTotalVolume();
    const { currentTier, nextTier, progressPct } = getUserLoyaltyTier(vol);

    container.innerHTML = `
        <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%); border: 1px solid ${currentTier.color}40; border-radius: 18px; padding: 22px; margin-bottom: 24px; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3); backdrop-filter: blur(10px);">
            <!-- Background Glow Effect -->
            <div style="position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; border-radius: 50%; background: ${currentTier.color}; filter: blur(60px); opacity: 0.15; pointer-events: none;"></div>

            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 48px; height: 48px; border-radius: 14px; background: rgba(255,255,255,0.05); border: 2px solid ${currentTier.color}; display: flex; align-items: center; justify-content: center; color: ${currentTier.color}; font-size: 1.4rem; box-shadow: 0 0 15px ${currentTier.color}40;">
                        <i class="fas ${currentTier.icon}"></i>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff; margin: 0;">${currentTier.name}</h3>
                            <span style="background: ${currentTier.color}20; color: ${currentTier.color}; border: 1px solid ${currentTier.color}50; font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 99px;">
                                +${currentTier.bonus}% Cashback Rate
                            </span>
                        </div>
                        <p style="font-size: 0.8rem; color: #94a3b8; margin: 2px 0 0 0;">${currentTier.desc}</p>
                    </div>
                </div>

                <div style="text-align: right;">
                    <span style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Traded Volume</span>
                    <div style="font-size: 1.1rem; font-weight: 800; color: #10b981;">₦${vol.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                </div>
            </div>

            <!-- Tier Progress Bar -->
            ${nextTier ? `
                <div style="margin-top: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #94a3b8; font-weight: 600; margin-bottom: 6px;">
                        <span>Level Progress: ${progressPct}%</span>
                        <span>Next Rank: <strong style="color: ${nextTier.color};">${nextTier.name}</strong> (₦${nextTier.minVol.toLocaleString()})</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.08); height: 8px; border-radius: 99px; overflow: hidden;">
                        <div style="width: ${progressPct}%; height: 100%; background: linear-gradient(90deg, ${currentTier.color}, ${nextTier.color}); border-radius: 99px; transition: width 0.6s ease;"></div>
                    </div>
                </div>
            ` : `
                <div style="font-size: 0.78rem; color: #38bdf8; font-weight: 700; display: flex; align-items: center; gap: 6px; margin-top: 8px;">
                    <i class="fas fa-crown"></i> Maximum VIP Tier Achieved! Enjoy maximum rates & instant VIP perks.
                </div>
            `}
        </div>
    `;
}

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(renderLoyaltyWidget, 500);
});
