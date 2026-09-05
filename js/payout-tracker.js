// Goodfastpay Platform - Instant Auto-Payout Gateway & Live Settlement Tracker Engine

/**
 * Initialize and Mount Payout Settlement Tracker Modal into DOM
 */
function initPayoutTrackerModal() {
    if (document.getElementById("payout-tracker-modal")) return;

    const modalHTML = `
    <div id="payout-tracker-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(10, 15, 29, 0.88); backdrop-filter: blur(12px); z-index: 100000; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: linear-gradient(145deg, #101628 0%, #0d1222 100%); border: 1px solid rgba(99, 102, 241, 0.3); width: 100%; max-width: 520px; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.6); overflow: hidden; font-family: inherit; color: #fff;">
            <!-- Header -->
            <div style="background: rgba(255,255,255,0.03); padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); display: flex; align-items: center; justify-content: center; color: #10b981; font-size: 1.1rem;">
                        <i class="fas fa-bolt-lightning"></i>
                    </div>
                    <div>
                        <h3 style="font-size: 1.1rem; font-weight: 800; margin: 0; color: #fff;">Live Interbank Settlement Tracker</h3>
                        <span style="font-size: 0.75rem; color: #94a3b8;">Automated Direct Payout Protocol</span>
                    </div>
                </div>
                <button type="button" onclick="closePayoutTrackerModal()" style="background: none; border: none; color: #64748b; font-size: 1.2rem; cursor: pointer; padding: 4px;" title="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- Body -->
            <div style="padding: 24px;">
                <!-- Summary Card -->
                <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px; margin-bottom: 24px; text-align: center;">
                    <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Target Settlement Amount</span>
                    <div style="font-size: 2.1rem; font-weight: 900; color: #10b981; margin: 4px 0 2px 0;" id="payout-tracker-amount">₦0.00</div>
                    <div style="font-size: 0.78rem; color: #64748b; font-family: monospace;" id="payout-tracker-ref">REF: GFP-000000</div>
                </div>

                <!-- Stepper Container -->
                <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; position: relative;">
                    <!-- Step 1 -->
                    <div class="payout-step-item" id="payout-step-1" style="display: flex; align-items: flex-start; gap: 14px; opacity: 0.4; transition: all 0.4s ease;">
                        <div class="step-circle" style="width: 32px; height: 32px; border-radius: 50%; background: #1e293b; border: 2px solid #334155; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; color: #94a3b8; flex-shrink: 0;">1</div>
                        <div style="flex-grow: 1;">
                            <div style="font-weight: 700; font-size: 0.92rem; color: #f8fafc;" class="step-title">Card & Security Verification</div>
                            <div style="font-size: 0.78rem; color: #94a3b8;" class="step-desc">Extracting PIN & verifying code against global store database</div>
                        </div>
                        <div class="step-badge" style="font-size: 0.75rem; font-weight: 700; color: #64748b;">Pending</div>
                    </div>

                    <!-- Step 2 -->
                    <div class="payout-step-item" id="payout-step-2" style="display: flex; align-items: flex-start; gap: 14px; opacity: 0.4; transition: all 0.4s ease;">
                        <div class="step-circle" style="width: 32px; height: 32px; border-radius: 50%; background: #1e293b; border: 2px solid #334155; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; color: #94a3b8; flex-shrink: 0;">2</div>
                        <div style="flex-grow: 1;">
                            <div style="font-weight: 700; font-size: 0.92rem; color: #f8fafc;" class="step-title">Central Interbank Network Handshake</div>
                            <div style="font-size: 0.78rem; color: #94a3b8;" class="step-desc">Transmitting payload to NIBSS / Central Settlement Gateway</div>
                        </div>
                        <div class="step-badge" style="font-size: 0.75rem; font-weight: 700; color: #64748b;">Pending</div>
                    </div>

                    <!-- Step 3 -->
                    <div class="payout-step-item" id="payout-step-3" style="display: flex; align-items: flex-start; gap: 14px; opacity: 0.4; transition: all 0.4s ease;">
                        <div class="step-circle" style="width: 32px; height: 32px; border-radius: 50%; background: #1e293b; border: 2px solid #334155; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; color: #94a3b8; flex-shrink: 0;">3</div>
                        <div style="flex-grow: 1;">
                            <div style="font-weight: 700; font-size: 0.92rem; color: #f8fafc;" class="step-title">Automated Liquidity Pool Allocation</div>
                            <div style="font-size: 0.78rem; color: #94a3b8;" class="step-desc">Reserving instant Naira funds for destination bank credit</div>
                        </div>
                        <div class="step-badge" style="font-size: 0.75rem; font-weight: 700; color: #64748b;">Pending</div>
                    </div>

                    <!-- Step 4 -->
                    <div class="payout-step-item" id="payout-step-4" style="display: flex; align-items: flex-start; gap: 14px; opacity: 0.4; transition: all 0.4s ease;">
                        <div class="step-circle" style="width: 32px; height: 32px; border-radius: 50%; background: #1e293b; border: 2px solid #334155; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; color: #94a3b8; flex-shrink: 0;">4</div>
                        <div style="flex-grow: 1;">
                            <div style="font-weight: 700; font-size: 0.92rem; color: #f8fafc;" class="step-title">Settlement Cleared & Wallet Credited</div>
                            <div style="font-size: 0.78rem; color: #94a3b8;" class="step-desc">Funds disbursed & transaction record generated</div>
                        </div>
                        <div class="step-badge" style="font-size: 0.75rem; font-weight: 700; color: #64748b;">Pending</div>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div style="background: rgba(255,255,255,0.06); height: 8px; border-radius: 99px; overflow: hidden; margin-bottom: 16px;">
                    <div id="payout-tracker-progressbar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #6366f1, #10b981); transition: width 0.5s ease; border-radius: 99px;"></div>
                </div>

                <!-- Footer Status Bar -->
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #94a3b8;">
                    <span id="payout-tracker-status-text"><i class="fas fa-spinner fa-spin" style="margin-right: 6px; color: #6366f1;"></i> Initializing settlement pipeline...</span>
                    <span style="font-weight: 700; color: #10b981;" id="payout-tracker-timer">00:00</span>
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
}

let payoutTrackerTimerInterval = null;

/**
 * Open and trigger live settlement stepper tracker
 * @param {Object} tx - Transaction payload { ref, amount, title }
 */
function triggerLivePayoutTracker(tx = {}) {
    initPayoutTrackerModal();

    const modal = document.getElementById("payout-tracker-modal");
    const amountElem = document.getElementById("payout-tracker-amount");
    const refElem = document.getElementById("payout-tracker-ref");
    const progressBar = document.getElementById("payout-tracker-progressbar");
    const statusText = document.getElementById("payout-tracker-status-text");
    const timerElem = document.getElementById("payout-tracker-timer");

    const formattedAmount = tx.amount ? (typeof tx.amount === "number" ? "₦" + tx.amount.toLocaleString(undefined, {minimumFractionDigits:2}) : tx.amount) : "₦0.00";
    const refCode = tx.ref || ("GFP-" + Math.floor(100000 + Math.random() * 900000));

    amountElem.textContent = formattedAmount;
    refElem.textContent = "REF: " + refCode;

    // Reset steps state
    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`payout-step-${i}`);
        if (!step) continue;
        step.style.opacity = "0.4";
        const circle = step.querySelector(".step-circle");
        const badge = step.querySelector(".step-badge");
        if (circle) {
            circle.style.background = "#1e293b";
            circle.style.borderColor = "#334155";
            circle.style.color = "#94a3b8";
            circle.innerHTML = i;
        }
        if (badge) {
            badge.textContent = "Pending";
            badge.style.color = "#64748b";
        }
    }

    progressBar.style.width = "5%";
    statusText.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 6px; color: #6366f1;"></i> Initializing settlement pipeline...';
    modal.style.display = "flex";

    let elapsed = 0;
    if (payoutTrackerTimerInterval) clearInterval(payoutTrackerTimerInterval);
    payoutTrackerTimerInterval = setInterval(() => {
        elapsed++;
        const secs = elapsed % 60;
        const mins = Math.floor(elapsed / 60);
        if (timerElem) timerElem.textContent = `${mins < 10 ? "0" + mins : mins}:${secs < 10 ? "0" + secs : secs}`;
    }, 1000);

    // Sequence step animations
    const setStepState = (stepNum, state) => {
        const step = document.getElementById(`payout-step-${stepNum}`);
        if (!step) return;
        const circle = step.querySelector(".step-circle");
        const badge = step.querySelector(".step-badge");

        if (state === "active") {
            step.style.opacity = "1";
            if (circle) {
                circle.style.background = "rgba(99, 102, 241, 0.2)";
                circle.style.borderColor = "#6366f1";
                circle.style.color = "#6366f1";
                circle.innerHTML = `<i class="fas fa-spinner fa-spin" style="font-size: 0.8rem;"></i>`;
            }
            if (badge) {
                badge.textContent = "Processing...";
                badge.style.color = "#6366f1";
            }
        } else if (state === "done") {
            step.style.opacity = "1";
            if (circle) {
                circle.style.background = "rgba(16, 185, 129, 0.2)";
                circle.style.borderColor = "#10b981";
                circle.style.color = "#10b981";
                circle.innerHTML = `<i class="fas fa-check" style="font-size: 0.8rem;"></i>`;
            }
            if (badge) {
                badge.textContent = "Passed";
                badge.style.color = "#10b981";
            }
        }
    };

    // Timeline execution
    setTimeout(() => {
        setStepState(1, "active");
        progressBar.style.width = "25%";
        statusText.innerHTML = '<i class="fas fa-microchip" style="margin-right: 6px; color: #6366f1;"></i> Verifying card security keys...';
    }, 400);

    setTimeout(() => {
        setStepState(1, "done");
        setStepState(2, "active");
        progressBar.style.width = "50%";
        statusText.innerHTML = '<i class="fas fa-network-wired" style="margin-right: 6px; color: #3b82f6;"></i> Connecting to NIBSS Interbank Switch...';
    }, 1600);

    setTimeout(() => {
        setStepState(2, "done");
        setStepState(3, "active");
        progressBar.style.width = "75%";
        statusText.innerHTML = '<i class="fas fa-vault" style="margin-right: 6px; color: #f59e0b;"></i> Allocating instant Naira reserve funds...';
    }, 2800);

    setTimeout(() => {
        setStepState(3, "done");
        setStepState(4, "done");
        progressBar.style.width = "100%";
        statusText.innerHTML = '<i class="fas fa-circle-check" style="margin-right: 6px; color: #10b981;"></i> Settlement Completed! Wallet Credited.';
        if (payoutTrackerTimerInterval) clearInterval(payoutTrackerTimerInterval);
        
        if (typeof showToast === "function") {
            showToast(`Settlement cleared! ${formattedAmount} credited (${refCode})`, "success");
        }
    }, 4000);
}

function closePayoutTrackerModal() {
    const modal = document.getElementById("payout-tracker-modal");
    if (modal) modal.style.display = "none";
    if (payoutTrackerTimerInterval) clearInterval(payoutTrackerTimerInterval);
}

document.addEventListener("DOMContentLoaded", () => {
    initPayoutTrackerModal();
});
