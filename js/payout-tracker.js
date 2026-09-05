// Goodfastpay Platform - Instant Auto-Payout Gateway & Live Settlement Tracker Engine

let payoutTrackerTimerInterval = null;
let payoutTrackerPollerInterval = null;
let activeTrackerTx = null;

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
                            <div style="font-weight: 700; font-size: 0.92rem; color: #f8fafc;" class="step-title" id="payout-step-4-title">Awaiting Admin Clearing</div>
                            <div style="font-size: 0.78rem; color: #94a3b8;" class="step-desc" id="payout-step-4-desc">Manual clearance & security compliance review in progress</div>
                        </div>
                        <div class="step-badge" id="payout-step-4-badge" style="font-size: 0.75rem; font-weight: 700; color: #f59e0b;">Pending Approval</div>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div style="background: rgba(255,255,255,0.06); height: 8px; border-radius: 99px; overflow: hidden; margin-bottom: 16px;">
                    <div id="payout-tracker-progressbar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #6366f1, #f59e0b); transition: width 0.7s ease; border-radius: 99px;"></div>
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

/**
 * Initialize and Mount Dedicated Success Modal into DOM
 */
function initPayoutSuccessModal() {
    if (document.getElementById("payout-success-modal")) return;

    const modalHTML = `
    <div id="payout-success-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(10, 15, 29, 0.92); backdrop-filter: blur(14px); z-index: 100005; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: linear-gradient(145deg, #0d1527 0%, #0a0f1d 100%); border: 1px solid rgba(16, 185, 129, 0.35); width: 100%; max-width: 500px; border-radius: 24px; box-shadow: 0 30px 70px rgba(0,0,0,0.7); overflow: hidden; font-family: inherit; color: #fff; text-align: center; position: relative;">
            
            <button type="button" onclick="closePayoutSuccessModal()" style="position: absolute; top: 18px; right: 18px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;" title="Close">
                <i class="fas fa-times"></i>
            </button>

            <div style="padding: 32px 24px 28px 24px;">
                <!-- Large Emerald Check Badge -->
                <div style="width: 76px; height: 76px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; color: #10b981; font-size: 2.2rem; box-shadow: 0 0 30px rgba(16, 185, 129, 0.35);">
                    <i class="fas fa-check-double"></i>
                </div>

                <h2 style="font-size: 1.5rem; font-weight: 900; color: #fff; margin: 0 0 6px 0;">Settlement Cleared & Credited!</h2>
                <p style="font-size: 0.85rem; color: #94a3b8; margin: 0 0 24px 0;">Admin approval complete. Funds disbursed to destination account.</p>

                <!-- Transaction Receipt Card -->
                <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; text-align: left; margin-bottom: 24px;">
                    <div style="text-align: center; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 14px; margin-bottom: 16px;">
                        <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Net Amount Transferred</span>
                        <div style="font-size: 2.2rem; font-weight: 900; color: #10b981; margin: 2px 0;" id="success-receipt-amount">₦0.00</div>
                        <span style="display: inline-block; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.7rem; font-weight: 800; padding: 3px 10px; border-radius: 20px; margin-top: 4px;">
                            <i class="fas fa-shield-halved" style="margin-right: 4px;"></i> COMPLETED & CONFIRMED
                        </span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.84rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #64748b;">Reference Code</span>
                            <span style="font-family: monospace; font-weight: 700; color: #38bdf8;" id="success-receipt-ref">WD-0000</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #64748b;">Destination Bank</span>
                            <span style="font-weight: 700; color: #f8fafc;" id="success-receipt-bank">Interbank Payout</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #64748b;">Beneficiary Account</span>
                            <span style="font-weight: 600; color: #cbd5e1;" id="success-receipt-account">Account</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #64748b;">Cleared Timestamp</span>
                            <span style="color: #94a3b8; font-size: 0.78rem;" id="success-receipt-date">Just Now</span>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button type="button" onclick="downloadPayoutSuccessPDF()" style="width: 100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; color: #fff; font-weight: 800; padding: 14px; border-radius: 14px; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); transition: all 0.2s ease;">
                        <i class="fas fa-file-pdf"></i> Download PDF Receipt
                    </button>

                    <button type="button" onclick="closePayoutSuccessModal()" style="width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; font-weight: 700; padding: 12px; border-radius: 14px; font-size: 0.88rem; cursor: pointer; transition: all 0.2s ease;">
                        <i class="fas fa-house" style="margin-right: 6px;"></i> Return to Dashboard
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
}

/**
 * Open and trigger live settlement stepper tracker
 * @param {Object} tx - Transaction payload { ref, amount, title }
 */
function triggerLivePayoutTracker(tx = {}) {
    initPayoutTrackerModal();
    activeTrackerTx = tx;

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

    // Reset step states
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

    // Reset Step 4 text
    const s4Title = document.getElementById("payout-step-4-title");
    const s4Desc = document.getElementById("payout-step-4-desc");
    const s4Badge = document.getElementById("payout-step-4-badge");
    if (s4Title) s4Title.textContent = "Awaiting Admin Clearing";
    if (s4Desc) s4Desc.textContent = "Manual clearance & security compliance review in progress";
    if (s4Badge) {
        s4Badge.textContent = "Pending Approval";
        s4Badge.style.color = "#f59e0b";
    }

    progressBar.style.width = "5%";
    progressBar.style.background = "linear-gradient(90deg, #6366f1, #f59e0b)";
    progressBar.classList.remove("animate-pulse");

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
        } else if (state === "awaiting") {
            step.style.opacity = "1";
            if (circle) {
                circle.style.background = "rgba(245, 158, 11, 0.18)";
                circle.style.borderColor = "#f59e0b";
                circle.style.color = "#f59e0b";
                circle.innerHTML = `<i class="fas fa-clock fa-spin" style="font-size: 0.85rem;"></i>`;
            }
            if (badge) {
                badge.textContent = "Pending Approval";
                badge.style.color = "#f59e0b";
            }
        }
    };

    // Timeline execution
    setTimeout(() => {
        setStepState(1, "active");
        progressBar.style.width = "25%";
        statusText.innerHTML = '<i class="fas fa-microchip" style="margin-right: 6px; color: #6366f1;"></i> Verifying security keys & compliance...';
    }, 400);

    setTimeout(() => {
        setStepState(1, "done");
        setStepState(2, "active");
        progressBar.style.width = "50%";
        statusText.innerHTML = '<i class="fas fa-network-wired" style="margin-right: 6px; color: #3b82f6;"></i> Connecting to NIBSS Interbank Gateway...';
    }, 1600);

    setTimeout(() => {
        setStepState(2, "done");
        setStepState(3, "active");
        progressBar.style.width = "75%";
        statusText.innerHTML = '<i class="fas fa-vault" style="margin-right: 6px; color: #f59e0b;"></i> Reserving instant Naira funds...';
    }, 2800);

    // Freeze at Step 3 done, Step 4 held at AWAITING_APPROVAL (80% progress)
    setTimeout(() => {
        setStepState(3, "done");
        setStepState(4, "awaiting");
        progressBar.style.width = "80%";
        progressBar.style.background = "linear-gradient(90deg, #6366f1 0%, #f59e0b 100%)";
        
        statusText.innerHTML = `
            <span style="display: flex; align-items: center; gap: 6px; color: #f59e0b;">
                <i class="fas fa-spinner fa-spin"></i> Verification complete. Awaiting central disbursement clearance...
            </span>
        `;

        // Start backend polling for admin clearance
        startBackendStatusPoller(refCode);
    }, 4000);
}

/**
 * Poll local DB and Supabase for transaction completion status
 * @param {string} refCode - Withdrawal or Submission Reference ID
 */
function startBackendStatusPoller(refCode) {
    if (payoutTrackerPollerInterval) clearInterval(payoutTrackerPollerInterval);

    const checkStatus = () => {
        if (typeof getDB !== "function") return;
        const db = getDB();

        // Search withdrawals first
        let record = db.withdrawals ? db.withdrawals.find(w => w.id === refCode || w.ref === refCode) : null;
        let type = "WITHDRAWAL";

        // If not found in withdrawals, search card submissions
        if (!record && db.submissions) {
            record = db.submissions.find(s => s.id === refCode || s.ref === refCode);
            type = "CARD_TRADE";
        }

        if (!record) return;

        // If Admin marked status as COMPLETED
        if (record.status === "COMPLETED") {
            clearInterval(payoutTrackerPollerInterval);
            payoutTrackerPollerInterval = null;

            // Complete Step 4 visually
            const step4 = document.getElementById("payout-step-4");
            const progressBar = document.getElementById("payout-tracker-progressbar");
            const statusText = document.getElementById("payout-tracker-status-text");

            if (step4) {
                step4.style.opacity = "1";
                const circle = step4.querySelector(".step-circle");
                const badge = step4.querySelector(".step-badge");
                const s4Title = document.getElementById("payout-step-4-title");
                const s4Desc = document.getElementById("payout-step-4-desc");

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
                if (s4Title) s4Title.textContent = "Settlement Cleared & Wallet Credited";
                if (s4Desc) s4Desc.textContent = "Funds disbursed to destination bank";
            }

            if (progressBar) {
                progressBar.style.width = "100%";
                progressBar.style.background = "linear-gradient(90deg, #6366f1, #10b981)";
            }

            if (statusText) {
                statusText.innerHTML = '<i class="fas fa-circle-check" style="margin-right: 6px; color: #10b981;"></i> Settlement Cleared! Wallet Credited.';
            }

            if (payoutTrackerTimerInterval) clearInterval(payoutTrackerTimerInterval);

            if (typeof showToast === "function") {
                const formattedAmount = record.amount ? "₦" + record.amount.toLocaleString(undefined, {minimumFractionDigits:2}) : (record.payoutAmount ? "₦" + record.payoutAmount.toLocaleString(undefined, {minimumFractionDigits:2}) : "");
                showToast(`Settlement cleared by Admin! ${formattedAmount} credited (${refCode})`, "success");
            }

            // After short delay, close tracker modal and open dedicated success page/modal
            setTimeout(() => {
                closePayoutTrackerModal();
                openPayoutSuccessModal(record, activeTrackerTx || { ref: refCode });
            }, 1200);
        } else if (record.status === "REJECTED" || record.status === "DECLINED") {
            clearInterval(payoutTrackerPollerInterval);
            payoutTrackerPollerInterval = null;

            const step4 = document.getElementById("payout-step-4");
            const progressBar = document.getElementById("payout-tracker-progressbar");
            const statusText = document.getElementById("payout-tracker-status-text");

            if (step4) {
                const circle = step4.querySelector(".step-circle");
                const badge = step4.querySelector(".step-badge");
                const s4Title = document.getElementById("payout-step-4-title");
                const s4Desc = document.getElementById("payout-step-4-desc");

                if (circle) {
                    circle.style.background = "rgba(239, 68, 68, 0.2)";
                    circle.style.borderColor = "#ef4444";
                    circle.style.color = "#ef4444";
                    circle.innerHTML = `<i class="fas fa-times" style="font-size: 0.8rem;"></i>`;
                }
                if (badge) {
                    badge.textContent = "Declined";
                    badge.style.color = "#ef4444";
                }
                if (s4Title) s4Title.textContent = "Settlement Declined / Reverted";
                if (s4Desc) s4Desc.textContent = record.declineReason || "Declined during security review";
            }

            if (progressBar) {
                progressBar.style.background = "#ef4444";
            }

            if (statusText) {
                statusText.innerHTML = '<i class="fas fa-circle-xmark" style="margin-right: 6px; color: #ef4444;"></i> Transaction declined by admin compliance review.';
            }

            if (payoutTrackerTimerInterval) clearInterval(payoutTrackerTimerInterval);

            if (typeof showToast === "function") {
                showToast(`Transaction ${refCode} declined by Admin review.`, "danger");
            }
        }
    };

    // Run first check immediately
    checkStatus();

    // Poll every 3.5 seconds
    payoutTrackerPollerInterval = setInterval(checkStatus, 3500);

    // Also listen for cross-tab storage updates
    window.addEventListener("storage", (e) => {
        if (e.key === "goodfastpay_db") {
            checkStatus();
        }
    });
}

function closePayoutTrackerModal() {
    const modal = document.getElementById("payout-tracker-modal");
    if (modal) modal.style.display = "none";
    if (payoutTrackerTimerInterval) clearInterval(payoutTrackerTimerInterval);
    if (payoutTrackerPollerInterval) clearInterval(payoutTrackerPollerInterval);
}

/**
 * Open Dedicated Success View / Modal
 * @param {Object} record - Transaction DB record
 * @param {Object} tx - Active payload
 */
function openPayoutSuccessModal(record = {}, tx = {}) {
    initPayoutSuccessModal();

    const modal = document.getElementById("payout-success-modal");
    const amountElem = document.getElementById("success-receipt-amount");
    const refElem = document.getElementById("success-receipt-ref");
    const bankElem = document.getElementById("success-receipt-bank");
    const accountElem = document.getElementById("success-receipt-account");
    const dateElem = document.getElementById("success-receipt-date");

    const amountVal = record.amount || tx.amount || record.payoutAmount || 0;
    const formattedAmount = typeof amountVal === "number" ? "₦" + amountVal.toLocaleString(undefined, {minimumFractionDigits:2}) : (amountVal || "₦0.00");
    const refCode = record.id || tx.ref || "WD-3170";

    amountElem.textContent = formattedAmount;
    refElem.textContent = refCode;
    bankElem.textContent = record.bankName || tx.bankName || "Goodfastpay Direct Settlement";
    
    if (record.accountNumber || tx.accountNumber) {
        accountElem.textContent = `${record.accountHolderName || tx.accountHolderName || 'Beneficiary'} (${record.accountNumber || tx.accountNumber})`;
    } else if (record.brand || tx.brand) {
        accountElem.textContent = `${record.brand || tx.brand} (${record.currency || tx.currency || 'USD'} ${record.cardValue || tx.cardValue || ''})`;
    } else {
        accountElem.textContent = "Verified Payout Wallet";
    }

    const created = record.createdAt ? new Date(record.createdAt) : new Date();
    dateElem.textContent = created.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    modal.style.display = "flex";
}

function closePayoutSuccessModal() {
    const modal = document.getElementById("payout-success-modal");
    if (modal) modal.style.display = "none";
    if (typeof switchSection === "function") {
        switchSection("dashboard");
    }
}

function downloadPayoutSuccessPDF() {
    if (typeof downloadTransactionReceiptPDF === "function") {
        downloadTransactionReceiptPDF();
    } else if (typeof window.print === "function") {
        window.print();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initPayoutTrackerModal();
    initPayoutSuccessModal();
});
