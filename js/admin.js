// Goodfastpay Platform - Administrative Console Controller JS

let currentAdmin = null;
let activeUserInspectEmail = null;
let activeInspectTab = "bank";
let activeCardInspectId = null;
let activeWithdrawalInspectId = null;
let currentCardsFilter = "PENDING";
let currentWithdrawalsFilter = "PENDING";
let lastPendingCount = null;

// Inventory State Variables
let inventoryPage = 1;
let inventoryRowsPerPage = 10;
let visiblePins = {}; // track pin visibility toggles

// Initialize on DOM load
window.addEventListener("DOMContentLoaded", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    loadAdminSession();
    setupAdminSupportRealTimeCheck();
    // Announce broadcast logs loading
    renderBroadcastList();

    // Listen for cross-tab storage updates to synchronize database state instantly
    window.addEventListener('storage', (e) => {
        if (e.key === 'goodfastpay_db') {
            loadAdminSession();
            renderBroadcastList();
            
            // Auto-refresh active user profile inspections if open
            if (activeUserInspectEmail && document.getElementById("user-inspect-modal").classList.contains("active")) {
                const activeTab = activeInspectTab;
                inspectUserProfile(activeUserInspectEmail);
                toggleInspectTab(activeTab);
            }
            // Auto-refresh active card review panel
            if (activeCardInspectId) {
                const decPayout = document.getElementById("dec-payout");
                const isPayoutFocused = decPayout && document.activeElement === decPayout;
                const currentPayoutVal = decPayout ? decPayout.value : "";
                
                inspectCardSubmission(activeCardInspectId);
                
                // Restore custom payout value if the admin was actively typing
                const newDecPayout = document.getElementById("dec-payout");
                if (isPayoutFocused && newDecPayout) {
                    newDecPayout.value = currentPayoutVal;
                    newDecPayout.focus();
                }
            }
            // Auto-refresh active withdrawal review panel
            if (activeWithdrawalInspectId) {
                inspectWithdrawalRequest(activeWithdrawalInspectId);
            }
        }
    });
});

// Load admin session and refresh counters
function loadAdminSession() {
    currentAdmin = getSessionUser();
    
    if (!currentAdmin) {
        window.location.href = "index.html";
        return;
    }
    
    if (currentAdmin.role !== "ADMIN") {
        window.location.href = "portal.html";
        return;
    }
    
    // Refresh stats and tables
    refreshAdminStats();
    renderUsersList();
    renderCardsQueue();
    renderWithdrawalsQueue();
    
    // Skip re-rendering rates if admin is currently editing inputs to prevent losing cursor position/selections
    if (!document.activeElement || !document.activeElement.classList.contains("rate-input")) {
        renderRatesConfigurator();
    }
    
    populateBrandFilterOptions();
    renderAdminInventoryTable();
    renderInventoryStats();
    populateInventoryFormOptions();
    renderAdminAuditLogs();
    renderCurrencyManager();
    renderRatesHistoryTable();
    
    // Update tab title and play notification sound if new review items arrive
    const db = getDB();
    const pendingCards = db.submissions.filter(s => s.status === "PENDING").length;
    const pendingWithdrawals = db.withdrawals.filter(w => w.status === "PENDING").length;
    const totalPending = pendingCards + pendingWithdrawals;
    
    if (lastPendingCount !== null && totalPending > lastPendingCount) {
        playNotificationSound();
    }
    lastPendingCount = totalPending;
    
    if (totalPending > 0) {
        document.title = `(${totalPending}) Goodfastpay - Administrative Console`;
    }
}

// Side drawer toggling for mobile layout
function toggleAdminSidebar() {
    const sidebar = document.getElementById("admin-sidebar");
    const overlay = document.getElementById("admin-sidebar-overlay");
    if (sidebar) sidebar.classList.toggle("active");
    if (overlay) overlay.classList.toggle("active");
}

// Switch between workspace tabs
function switchAdminSection(sectionId, element) {
    
    // Hide all sections
    const sections = document.querySelectorAll(".admin-section");
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
    const sidebar = document.getElementById("admin-sidebar");
    const overlay = document.getElementById("admin-sidebar-overlay");
    if (sidebar) sidebar.classList.remove("active");
    if (overlay) overlay.classList.remove("active");
    
    // Reload state if necessary
    if (sectionId === "audit") {
        renderAdminAuditLogs();
    } else if (sectionId === "rates") {
        renderRatesConfigurator();
    } else if (sectionId === "inventory") {
        populateBrandFilterOptions();
        renderAdminInventoryTable();
    } else if (sectionId === "support-manager") {
        renderSupportAnalytics();
        renderAdminTicketsQueue();
    }
}

// Compute statistics counts
function refreshAdminStats() {
    const db = getDB();
    
    // Users count (excluding ADMIN)
    const userEmails = Object.keys(db.users).filter(email => db.users[email].role !== "ADMIN");
    document.getElementById("stat-total-users").textContent = userEmails.length;
    
    // Platform Assets Held (sum of all available balances)
    let totalBalances = 0;
    userEmails.forEach(email => {
        totalBalances += db.users[email].wallet.balance;
    });
    document.getElementById("stat-assets-held").textContent = "₦" + totalBalances.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    // Pending card reviews
    const pendingCards = db.submissions.filter(s => s.status === "PENDING").length;
    document.getElementById("stat-pending-reviews").textContent = pendingCards;
    
    // Side badges for cards trade queue
    const badgeCards = document.getElementById("badge-card-reviews");
    if (pendingCards > 0) {
        badgeCards.textContent = pendingCards;
        badgeCards.style.display = "inline-flex";
    } else {
        badgeCards.style.display = "none";
    }
    
    // Pending withdrawals
    const pendingWithdrawals = db.withdrawals.filter(w => w.status === "PENDING").length;
    document.getElementById("stat-pending-withdrawals").textContent = pendingWithdrawals;
    
    // Side badges for withdrawals requests queue
    const badgeWds = document.getElementById("badge-withdrawal-requests");
    if (pendingWithdrawals > 0) {
        badgeWds.textContent = pendingWithdrawals;
        badgeWds.style.display = "inline-flex";
    } else {
        badgeWds.style.display = "none";
    }
}

// Render Platform Users Table List
function renderUsersList() {
    const db = getDB();
    const tbody = document.getElementById("admin-users-tbody");
    const searchQuery = document.getElementById("user-search-input").value.toLowerCase().trim();
    tbody.innerHTML = "";
    
    const userEmails = Object.keys(db.users).filter(email => db.users[email].role !== "ADMIN");
    let matches = 0;
    
    userEmails.forEach(email => {
        const user = db.users[email];
        const nameMatch = user.name.toLowerCase().includes(searchQuery);
        const emailMatch = user.email.toLowerCase().includes(searchQuery);
        
        if (searchQuery === "" || nameMatch || emailMatch) {
            matches++;
            const tr = document.createElement("tr");
            
            let statusBadge = `<span class="badge badge-success">Active</span>`;
            if (user.status === "SUSPENDED") {
                statusBadge = `<span class="badge badge-danger">Suspended</span>`;
            }
            
            const bankStatus = user.bankDetails ? `<span style="color:var(--accent); font-weight:600;"><i class="fas fa-circle-check"></i> Linked</span>` : `<span style="color:var(--text-muted);"><i class="fas fa-circle-xmark"></i> Missing</span>`;
            
            tr.innerHTML = `
                <td><strong>${user.name}</strong></td>
                <td><code>${user.email}</code></td>
                <td style="font-weight:700;" class="text-right">₦${user.wallet.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-center">${bankStatus}</td>
                <td style="font-size: 0.8rem; color: var(--text-secondary);">${new Date(user.createdAt).toLocaleDateString()}</td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-center">
                    <button class="btn btn-secondary btn-sm" onclick="inspectUserProfile('${user.email}')"><i class="fas fa-eye"></i> Details</button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });
    
    if (matches === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted);">No platform user accounts found.</td></tr>`;
    }
}

// Inspect User Profile Modals Operations
function inspectUserProfile(email) {
    activeUserInspectEmail = email;
    const db = getDB();
    const user = db.users[email];
    if (!user) return;
    
    // Dynamically calculate trade totals for simulated KYC profile
    const userSubmissions = db.submissions.filter(s => s.userId === email);
    const totalGiftCardTrades = userSubmissions.length;
    
    const userWithdrawals = db.withdrawals.filter(w => w.userId === email);
    const totalWithdrawalsCount = userWithdrawals.length;
    const totalWithdrawalsAmount = userWithdrawals
        .filter(w => w.status === "COMPLETED")
        .reduce((sum, w) => sum + w.amount, 0);

    const detailsContainer = document.getElementById("user-inspect-details");
    
    let statusBadgeHtml = "";
    if (user.status === "SUSPENDED") {
        statusBadgeHtml = `<span class="badge badge-danger" style="font-size: 0.7rem; padding: 2px 8px; vertical-align: middle; margin-left: 8px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.15);">SUSPENDED</span>`;
    } else if (user.status === "BANNED") {
        statusBadgeHtml = `<span class="badge badge-danger" style="font-size: 0.7rem; padding: 2px 8px; vertical-align: middle; margin-left: 8px; background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); font-weight: 800;">BANNED</span>`;
    } else {
        statusBadgeHtml = `<span class="badge badge-success" style="font-size: 0.7rem; padding: 2px 8px; vertical-align: middle; margin-left: 8px; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.15);">ACTIVE</span>`;
    }

    detailsContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div>
                <h4 style="font-size: 1.25rem; font-weight:800; display: inline-block; vertical-align: middle; margin: 0;">${user.name}</h4>
                ${statusBadgeHtml}
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-top: 4px;"><code>${user.email}</code></p>
            </div>
        </div>
        
        <!-- Premium Layout Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; font-size: 0.85rem; background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="line-height: 1.8;">
                <strong>KYC Status:</strong> <span class="badge badge-success" style="padding: 2px 6px; font-size: 0.7rem; background:rgba(16, 185, 129, 0.1); color:#10b981; border:1px solid rgba(16,185,129,0.15); font-weight:700;">Verified (Level 2)</span><br>
                <strong>Transaction PIN:</strong> ${user.transactionPin ? `<span style="color:#10b981; font-weight:700;"><i class="fas fa-shield-halved"></i> Configured (••••)</span>` : `<span style="color:#f59e0b; font-weight:600;"><i class="fas fa-triangle-exclamation"></i> Not Set</span>`}<br>
                <strong>Email Verification:</strong> <span style="color: ${user.emailVerified ? 'var(--secondary)' : 'var(--warning)'}; font-weight:600;"><i class="fas ${user.emailVerified ? 'fa-check-circle' : 'fa-circle-xmark'}"></i> ${user.emailVerified ? 'Verified' : 'Pending'}</span><br>
                <strong>Phone Verification:</strong> <span style="color: ${user.phoneVerified ? 'var(--secondary)' : 'var(--warning)'}; font-weight:600;"><i class="fas ${user.phoneVerified ? 'fa-check-circle' : 'fa-circle-xmark'}"></i> ${user.phoneVerified ? 'Verified' : 'Pending'}</span><br>
                <strong>Last Login:</strong> <span style="color: var(--text-primary); font-weight: 500;">${user.logs[0] ? new Date(user.logs[0].timestamp).toLocaleString() : 'N/A'}</span><br>
                <strong>Last IP Address:</strong> <span style="color: var(--text-primary); font-weight: 500; font-family: monospace;">${user.logs[0] ? user.logs[0].ip : '127.0.0.1'}</span>
            </div>
            <div style="line-height: 1.8;">
                <strong>Account Type:</strong> <span style="color: var(--accent); font-weight:700;">Standard Trader</span><br>
                <strong>Total Deposits:</strong> <span style="font-weight: 600; color: var(--text-primary);">₦1,250,000.00</span><br>
                <strong>Total Withdrawals:</strong> <span style="font-weight: 600; color: var(--text-primary);">₦${totalWithdrawalsAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} (${totalWithdrawalsCount} claims)</span><br>
                <strong>Total Gift Card Trades:</strong> <span style="font-weight: 600; color: var(--text-primary);">${totalGiftCardTrades} submissions</span><br>
                <strong>Total Crypto Trades:</strong> <span style="font-weight: 600; color: var(--text-primary);">0 (No trades)</span>
            </div>
        </div>
        
        <div class="detail-item"><span>Phone Number:</span> <strong>${user.phone || '-'}</strong></div>
        <div class="detail-item"><span>Wallet Balance:</span> <strong style="color:var(--accent);">₦${user.wallet.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></div>
        <div class="detail-item"><span>Wallet Pending:</span> <strong style="color:var(--warning);">₦${user.wallet.pendingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></div>

        <!-- Premium Operations Action Bar -->
        <div style="border-top: 1px solid var(--border-color); padding-top: 16px; margin-top: 16px;">
            <h5 style="font-weight: 800; font-size: 0.78rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 12px; letter-spacing:0.5px;">Admin Control Operations</h5>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;" id="inspect-action-bar">
                ${(user.status === "SUSPENDED" || user.status === "BANNED") 
                    ? `<button class="btn btn-secondary btn-sm" style="background:#10b981 !important; color:#fff !important; border:none;" id="btn-inspect-toggle-status" onclick="toggleUserStatus('${email}', 'ACTIVE')"><i class="fas fa-circle-check"></i> Activate User</button>`
                    : `<button class="btn btn-danger btn-sm" id="btn-inspect-toggle-status" onclick="toggleUserStatus('${email}', 'SUSPENDED')"><i class="fas fa-ban"></i> Suspend User</button>`
                }
                <button class="btn btn-secondary btn-sm" onclick="modalEditUser('${email}')"><i class="fas fa-edit"></i> Edit User</button>
                <button class="btn btn-secondary btn-sm" onclick="modalAdjustWallet('${email}')"><i class="fas fa-wallet"></i> Adjust Wallet</button>
                <button class="btn btn-secondary btn-sm" onclick="modalResetPassword('${email}')"><i class="fas fa-lock"></i> Reset Password</button>
                <button class="btn btn-secondary btn-sm" onclick="modalResetTransactionPin('${email}')"><i class="fas fa-key"></i> Reset PIN</button>
                <button class="btn btn-secondary btn-sm" onclick="modalVerifyEmail('${email}')"><i class="fas fa-envelope"></i> Verify Email</button>
                <button class="btn btn-secondary btn-sm" onclick="modalVerifyPhone('${email}')"><i class="fas fa-phone"></i> Verify Phone</button>
                <button class="btn btn-danger btn-sm" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.15);" onclick="modalBanDevice('${email}')"><i class="fas fa-shield-halved"></i> Ban Device</button>
                <button class="btn btn-secondary btn-sm" onclick="toggleInspectTab('logs')"><i class="fas fa-clipboard-list"></i> Activity Log</button>
            </div>
        </div>
    `;
    
    // Prep sub-tab content values
    document.getElementById("ins-adjust-email").value = email;
    document.getElementById("ins-adjust-amount").value = "";
    
    // Prepopulate user bank details
    if (user.bankDetails) {
        document.getElementById("ins-bank-name").textContent = user.bankDetails.bankName;
        document.getElementById("ins-bank-number").textContent = user.bankDetails.accountNumber;
        document.getElementById("ins-bank-holder").textContent = user.bankDetails.accountHolderName;
    } else {
        document.getElementById("ins-bank-name").textContent = "No Linked Bank Profile";
        document.getElementById("ins-bank-number").textContent = "-";
        document.getElementById("ins-bank-holder").textContent = "-";
    }
    
    // Render inspection security logs list
    const logBody = document.getElementById("ins-logs-tbody");
    logBody.innerHTML = "";
    user.logs.forEach(log => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-size:0.75rem; color:var(--text-secondary);">${new Date(log.timestamp).toLocaleDateString()}</td>
            <td>${log.event}</td>
            <td><code>${log.ip}</code></td>
        `;
        logBody.appendChild(tr);
    });
    
    // Toggle active tab back to bank
    toggleInspectTab("bank");
    
    document.getElementById("user-inspect-modal").classList.add("active");
}

function closeUserInspectModal() {
    document.getElementById("user-inspect-modal").classList.remove("active");
}

function toggleInspectTab(tabId) {
    activeInspectTab = tabId;
    
    // Toggle buttons classes
    const tabs = ["bank", "logs", "adjust"];
    tabs.forEach(t => {
        const btn = document.getElementById(`btn-inspect-${t}`);
        const panel = document.getElementById(`tab-inspect-${t}`);
        if (t === tabId) {
            btn.classList.add("active");
            panel.style.display = "block";
        } else {
            btn.classList.remove("active");
            panel.style.display = "none";
        }
    });
}

// Toggle User account status (Ban/Activate)
function toggleUserStatus(email, newStatus) {
    // Only Super Admins can activate or suspend users
    if (currentAdmin.email !== "admin@goodfastpay.com") {
        showToast("Permission Denied: Only Super Admins can activate or suspend user accounts.", "danger");
        return;
    }
    
    // Confirmation Dialogs
    let confirmMsg = "";
    if (newStatus === "ACTIVE") {
        confirmMsg = "Are you sure you want to activate this user?";
    } else {
        confirmMsg = "Are you sure you want to suspend this user? This will disable all account activity.";
    }
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    let reason = "N/A";
    if (newStatus === "SUSPENDED") {
        reason = prompt("Please enter the reason for suspension:");
        if (reason === null) return; // cancel
        if (!reason.trim()) reason = "No reason provided";
    } else if (newStatus === "ACTIVE") {
        reason = prompt("Please enter the reason for activation:");
        if (reason === null) return; // cancel
        if (!reason.trim()) reason = "Account reactivation authorized by Admin";
    }
    
    const btn = document.getElementById("btn-inspect-toggle-status");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
    }
    
    // Simulate API network request latency
    setTimeout(() => {
        const db = getDB();
        if (db.users[email]) {
            const previousStatus = db.users[email].status || "ACTIVE";
            db.users[email].status = newStatus;
            
            // Log changes in user logs
            db.users[email].logs.unshift({
                event: `Account Status Modified by Admin: ${newStatus} (Previous: ${previousStatus}) | Reason: ${reason}`,
                timestamp: new Date().toISOString(),
                ip: "system"
            });
            
            saveDB(db);
            
            // Push update to Supabase Cloud
            if (typeof supabaseAdminUpdateUserStatus === "function") {
                supabaseAdminUpdateUserStatus(email, newStatus, reason);
            }
            
            // Write Audit Log
            writeAuditLog(
                currentAdmin.email,
                "User Status Changed",
                `User: ${email} status set to ${newStatus} (Previous: ${previousStatus}) | Reason: ${reason}`
            );
            
            showToast(`User account status updated: ${newStatus}`, "success");
            
            inspectUserProfile(email); // reload details
            renderUsersList(); // reload grid
            refreshAdminStats(); // refresh counts
        } else {
            showToast("Failed to update status: User profile not found in database.", "danger");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = newStatus === "ACTIVE" 
                    ? `<i class="fas fa-circle-check"></i> Activate User` 
                    : `<i class="fas fa-ban"></i> Suspend User`;
            }
        }
    }, 850);
}

// Auxiliary Operations Actions
function modalEditUser(email) {
    const db = getDB();
    const user = db.users[email];
    if (!user) return;
    
    const newName = prompt("Edit user name:", user.name);
    if (newName === null) return;
    if (!newName.trim()) {
        showToast("User name cannot be empty.", "danger");
        return;
    }
    
    const newPhone = prompt("Edit user phone number:", user.phone || "");
    if (newPhone === null) return;
    
    db.users[email].name = newName.trim();
    db.users[email].phone = newPhone.trim();
    db.users[email].logs.unshift({
        event: `Profile updated by Admin: name set to "${newName}", phone to "${newPhone}"`,
        timestamp: new Date().toISOString(),
        ip: "system"
    });
    saveDB(db);

    if (typeof supabaseUpdateProfile === "function") {
        supabaseUpdateProfile({ name: newName.trim(), phone: newPhone.trim() }, email);
    }
    
    writeAuditLog(currentAdmin.email, "User Profile Edited", `User: ${email} updated by Admin.`);
    showToast("User profile successfully updated.", "success");
    inspectUserProfile(email);
    renderUsersList();
}

function modalResetPassword(email) {
    const db = getDB();
    const user = db.users[email];
    if (!user) return;
    
    const newPassword = prompt(`Enter new password for ${user.name}:`);
    if (newPassword === null) return;
    if (newPassword.length < 6) {
        showToast("Password must be at least 6 characters.", "danger");
        return;
    }
    
    db.users[email].passwordHash = newPassword;
    db.users[email].logs.unshift({
        event: "Account password reset by Admin",
        timestamp: new Date().toISOString(),
        ip: "system"
    });
    saveDB(db);
    
    writeAuditLog(currentAdmin.email, "User Password Reset", `Reset password for user: ${email}`);
    showToast(`Password successfully reset for ${user.name}.`, "success");
}

function modalResetTransactionPin(email) {
    const db = getDB();
    const user = db.users[email];
    if (!user) return;

    const action = prompt(`Manage Transaction PIN for ${user.name}:\n\nEnter 'RESET' to clear PIN (prompts user to set new PIN),\nor enter a new 4-digit PIN (e.g. 1234):`, "1234");
    if (action === null) return; // cancel

    const trimmed = action.trim();
    if (trimmed.toUpperCase() === "RESET" || trimmed.toUpperCase() === "CLEAR") {
        db.users[email].transactionPin = null;
        db.users[email].logs.unshift({
            event: "Transaction PIN Cleared by Admin (User prompted on next transaction)",
            timestamp: new Date().toISOString(),
            ip: "system"
        });
        saveDB(db);

        if (typeof supabaseUpdateProfile === "function") {
            supabaseUpdateProfile({ transactionPin: null }, email);
        }

        writeAuditLog(currentAdmin.email, "User PIN Cleared", `Cleared Transaction PIN for user: ${email}`);
        showToast(`Transaction PIN cleared for ${user.name}. User will be prompted to set a new PIN.`, "success");
    } else if (/^\d{4}$/.test(trimmed)) {
        db.users[email].transactionPin = trimmed;
        db.users[email].logs.unshift({
            event: `Transaction PIN Manually Updated by Admin to ${trimmed}`,
            timestamp: new Date().toISOString(),
            ip: "system"
        });
        saveDB(db);

        if (typeof supabaseUpdateProfile === "function") {
            supabaseUpdateProfile({ transactionPin: trimmed }, email);
        }

        writeAuditLog(currentAdmin.email, "User PIN Reset", `Updated Transaction PIN for user: ${email}`);
        showToast(`Transaction PIN updated to '${trimmed}' for ${user.name}.`, "success");
    } else {
        showToast("Invalid input. PIN must be exactly 4 numeric digits or 'RESET'.", "danger");
        return;
    }

    inspectUserProfile(email);
}

function modalVerifyEmail(email) {
    const db = getDB();
    const user = db.users[email];
    if (!user) return;
    
    if (user.emailVerified) {
        showToast("User email is already verified.", "info");
        return;
    }
    
    db.users[email].emailVerified = true;
    db.users[email].logs.unshift({
        event: "Email manually verified by Admin",
        timestamp: new Date().toISOString(),
        ip: "system"
    });
    saveDB(db);

    if (typeof supabaseUpdateProfile === "function") {
        supabaseUpdateProfile({ emailVerified: true }, email);
    }
    
    writeAuditLog(currentAdmin.email, "User Email Verified", `Manually verified email for user: ${email}`);
    showToast(`Email verified successfully for ${user.name}.`, "success");
    inspectUserProfile(email);
}

function modalVerifyPhone(email) {
    const db = getDB();
    const user = db.users[email];
    if (!user) return;
    
    if (user.phoneVerified) {
        showToast("User phone number is already verified.", "info");
        return;
    }
    
    db.users[email].phoneVerified = true;
    db.users[email].logs.unshift({
        event: "Phone number manually verified by Admin",
        timestamp: new Date().toISOString(),
        ip: "system"
    });
    saveDB(db);

    if (typeof supabaseUpdateProfile === "function") {
        supabaseUpdateProfile({ phoneVerified: true }, email);
    }
    
    writeAuditLog(currentAdmin.email, "User Phone Verified", `Manually verified phone for user: ${email}`);
    showToast(`Phone number verified successfully for ${user.name}.`, "success");
    inspectUserProfile(email);
}

function modalBanDevice(email) {
    const db = getDB();
    const user = db.users[email];
    if (!user) return;
    
    // Only Super Admins can ban
    if (currentAdmin.email !== "admin@goodfastpay.com") {
        showToast("Permission Denied: Only Super Admins can ban devices or suspend users.", "danger");
        return;
    }
    
    if (!confirm(`Are you sure you want to ban the device associated with user: ${user.name}? This will permanently ban the account and block all subsequent logins.`)) {
        return;
    }
    
    const reason = prompt("Please enter the reason for this permanent ban:");
    if (reason === null) return; // cancel
    const finalReason = reason.trim() ? reason.trim() : "Violation of platform security terms";
    
    const previousStatus = user.status || "ACTIVE";
    db.users[email].status = "BANNED";
    db.users[email].deviceBanned = true;
    db.users[email].logs.unshift({
        event: `Device and account permanently banned by Admin. Reason: ${finalReason}`,
        timestamp: new Date().toISOString(),
        ip: "system"
    });
    saveDB(db);

    if (typeof supabaseAdminUpdateUserStatus === "function") {
        supabaseAdminUpdateUserStatus(email, "BANNED", finalReason);
    }
    
    writeAuditLog(
        currentAdmin.email,
        "Device Banned",
        `User: ${email} permanently banned (Previous: ${previousStatus}) | Reason: ${finalReason}`
    );
    showToast("Device banned and user account permanently banned.", "success");
    inspectUserProfile(email);
    renderUsersList();
}

function modalAdjustWallet(email) {
    toggleInspectTab("adjust");
}

// Handle Admin Wallet manual adjustment updates
function handleManualWalletAdjust(e) {
    e.preventDefault();
    
    const email = document.getElementById("ins-adjust-email").value;
    const type = document.getElementById("ins-adjust-type").value;
    const amount = parseFloat(document.getElementById("ins-adjust-amount").value);
    
    if (isNaN(amount) || amount <= 0) {
        showToast("Please enter a valid positive adjustment amount.", "danger");
        return;
    }
    
    const db = getDB();
    const user = db.users[email];

    if (!user) {
        showToast("User account not found.", "danger");
        return;
    }
    
    if (!db.adjustments) db.adjustments = [];
    const adjId = "ADJ-" + Math.floor(100000 + Math.random() * 900000);
    
    if (type === "CREDIT") {
        user.wallet.balance += amount;
        
        // Log user log
        user.logs.unshift({
            event: `Admin Wallet Adjustment: +₦${amount.toLocaleString()} Credited`,
            timestamp: new Date().toISOString(),
            ip: "system"
        });

        // Record Adjustment Transaction for Customer Ledger History
        db.adjustments.unshift({
            id: adjId,
            userId: email,
            type: "Wallet Credit",
            adjustmentType: "CREDIT",
            amount: amount,
            balanceAfter: user.wallet.balance,
            operator: currentAdmin.email,
            reason: "Wallet credited by Admin",
            status: "COMPLETED",
            createdAt: new Date().toISOString()
        });
        
        db.users[email] = user;
        saveDB(db);
        
        if (typeof supabaseAdminUpdateUserBalance === "function") {
            supabaseAdminUpdateUserBalance(email, user.wallet.balance, amount, 'CREDIT');
        }
        
        writeAuditLog(
            currentAdmin.email,
            "Wallet Manually Credited",
            `Credited ₦${amount.toLocaleString()} to ${email}`
        );
        
        dispatchNotification(
            email,
            "Wallet Balance Credited",
            `Your wallet available balance has been manually credited with ₦${amount.toLocaleString()} by the administrator.`
        );
        
        showToast(`Wallet credited successfully.`, "success");
    } else {
        if (amount > user.wallet.balance) {
            showToast("Adjustment deduction amount exceeds user available balance.", "danger");
            return;
        }
        user.wallet.balance -= amount;
        
        // Log user log
        user.logs.unshift({
            event: `Admin Wallet Adjustment: -₦${amount.toLocaleString()} Deducted`,
            timestamp: new Date().toISOString(),
            ip: "system"
        });

        // Record Adjustment Transaction for Customer Ledger History
        db.adjustments.unshift({
            id: adjId,
            userId: email,
            type: "Wallet Deduction",
            adjustmentType: "DEBIT",
            amount: amount,
            balanceAfter: user.wallet.balance,
            operator: currentAdmin.email,
            reason: "Wallet deducted by Admin",
            status: "COMPLETED",
            createdAt: new Date().toISOString()
        });
        
        db.users[email] = user;
        saveDB(db);
        
        if (typeof supabaseAdminUpdateUserBalance === "function") {
            supabaseAdminUpdateUserBalance(email, user.wallet.balance, amount, 'DEBIT');
        }
        
        writeAuditLog(
            currentAdmin.email,
            "Wallet Manually Deducted",
            `Deducted ₦${amount.toLocaleString()} from ${email}`
        );
        
        dispatchNotification(
            email,
            "Wallet Balance Deducted",
            `Your wallet available balance has been manually adjusted: ₦${amount.toLocaleString()} was deducted.`
        );
        
        showToast(`Wallet balance deducted successfully.`, "success");
    }
    
    inspectUserProfile(email); // reload details
    renderUsersList(); // reload grid
    refreshAdminStats();
}

// RENDER GIFT CARD SUBMISSION REVIEWS QUEUE
function filterCardsQueue(filterVal, element) {
    currentCardsFilter = filterVal;
    
    // Toggle active class on rates filtering
    const buttons = document.querySelectorAll("#card-filter-bar button");
    buttons.forEach(btn => btn.classList.remove("active"));
    if (element) element.classList.add("active");
    
    renderCardsQueue();
}

function renderCardsQueue() {
    const db = getDB();
    const container = document.getElementById("admin-cards-list");
    container.innerHTML = "";
    
    let list = db.submissions;
    if (currentCardsFilter !== "ALL") {
        list = db.submissions.filter(s => s.status === currentCardsFilter);
    }
    
    if (list.length === 0) {
        container.innerHTML = `<p style="padding: 24px; text-align:center; color: var(--text-muted);">No submissions found matching filter.</p>`;
        return;
    }
    
    list.forEach(s => {
        const div = document.createElement("div");
        div.className = `ticket-row ${activeCardInspectId === s.id ? 'active' : ''}`;
        div.onclick = () => inspectCardSubmission(s.id);
        
        let badge = "";
        if (s.status === "PENDING") badge = `<span class="badge badge-warning btn-sm" style="font-size:0.65rem; padding: 2px 4px;">Pending</span>`;
        else if (s.status === "COMPLETED") badge = `<span class="badge badge-success btn-sm" style="font-size:0.65rem; padding: 2px 4px;">Completed</span>`;
        else badge = `<span class="badge badge-danger btn-sm" style="font-size:0.65rem; padding: 2px 4px;">Rejected</span>`;
        
        div.innerHTML = `
            <div>
                <strong style="display:block;">${s.brand}</strong>
                <span style="font-size:0.75rem; color:var(--text-secondary);">${s.currency} ${s.cardValue} • <code>${s.userId}</code></span>
            </div>
            <div>${badge}</div>
        `;
        
        container.appendChild(div);
    });
    
    // Maintain active panel highlighted
    if (activeCardInspectId) {
        highlightActiveCardItem();
    }
}

function highlightActiveCardItem() {
    const rows = document.querySelectorAll("#admin-cards-list .ticket-row");
    rows.forEach(row => {
        row.classList.remove("active");
    });
    // Find item
    const db = getDB();
    const index = db.submissions.findIndex(s => s.id === activeCardInspectId && (currentCardsFilter === "ALL" || s.status === currentCardsFilter));
    if (index !== -1 && rows[index]) {
        rows[index].classList.add("active");
    }
}

// Inspect details of card submission
function inspectCardSubmission(id) {
    activeCardInspectId = id;
    const db = getDB();
    const sub = db.submissions.find(s => s.id === id);
    const panel = document.getElementById("admin-card-inspect-panel");
    
    if (!sub) {
        panel.innerHTML = `<div style="text-align: center; padding: 100px 20px; color: var(--text-muted);"><p>Submission not found.</p></div>`;
        return;
    }
    
    // Highlight sidebar select
    renderCardsQueue();
    
    // Calculate default payout estimate
    const rateMap = db.settings.rates[sub.brand];
    const rate = (rateMap && rateMap[sub.currency]) ? rateMap[sub.currency] : 0;
    const defaultPayout = sub.cardValue * rate;
    
    let decisionHTML = "";
    if (sub.status === "PENDING") {
        decisionHTML = `
            <div style="border-top:1px solid var(--border-color); padding-top:20px; margin-top:20px;">
                <h4 style="font-weight:700; margin-bottom:12px;">Process Card Verification</h4>
                <div class="grid-2" style="gap:16px;">
                    <!-- Approve form block -->
                    <div style="border-right: 1px solid var(--border-color); padding-right:16px;">
                        <span class="input-label" style="display:block; margin-bottom:8px; font-size:0.75rem;">Credit Payout Amount (NGN)</span>
                        <input type="number" id="dec-payout" class="input-field" style="padding:10px 14px; margin-bottom:12px;" value="${defaultPayout}">
                        <button class="btn btn-accent btn-sm" style="width:100%;" onclick="approveCardTrade('${sub.id}')"><i class="fas fa-check"></i> Approve Trade</button>
                    </div>
                    
                    <!-- Reject form block -->
                    <div>
                        <span class="input-label" style="display:block; margin-bottom:8px; font-size:0.75rem;">Rejection Reason</span>
                        <select id="dec-reject-reason" class="input-field" style="padding:10px 14px; margin-bottom:12px;">
                            <option value="Invalid code or pin number already redeemed.">Invalid or already redeemed</option>
                            <option value="Denomination value mismatch.">Denomination mismatch</option>
                            <option value="Unreadable card scan images uploaded.">Unreadable image scans</option>
                            <option value="Fraud duplicate code sequence intercepted.">Security Breach: Duplicate code</option>
                        </select>
                        <button class="btn btn-danger btn-sm" style="width:100%;" onclick="rejectCardTrade('${sub.id}')"><i class="fas fa-xmark"></i> Reject Trade</button>
                    </div>
                </div>
            </div>
        `;
    } else if (sub.status === "COMPLETED") {
        decisionHTML = `
            <div style="border-top:1px solid var(--border-color); padding-top:20px; margin-top:20px; color:var(--accent); text-align:center;">
                <i class="fas fa-circle-check" style="font-size:2rem; margin-bottom:8px;"></i>
                <h4 style="font-weight:700;">Approved & Wallet Credited</h4>
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:4px;">Payout amount of <strong>₦${sub.payoutAmount.toLocaleString()}</strong> has been posted to user balance.</p>
            </div>
        `;
    } else {
        decisionHTML = `
            <div style="border-top:1px solid var(--border-color); padding-top:20px; margin-top:20px; color:var(--danger); text-align:center;">
                <i class="fas fa-circle-xmark" style="font-size:2rem; margin-bottom:8px;"></i>
                <h4 style="font-weight:700;">Rejected & Declined</h4>
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:4px;">Reason: <em>${sub.rejectionReason}</em></p>
            </div>
        `;
    }
    
    panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
                <h3 style="font-weight:800; font-size:1.25rem;">Trade Detail Review</h3>
                <span style="font-size:0.75rem; color:var(--text-muted);">Trade ID: <code>${sub.id}</code> • Submitted: ${new Date(sub.createdAt).toLocaleString()}</span>
            </div>
            <div>
                <span class="badge ${sub.status === 'PENDING' ? 'badge-warning' : (sub.status === 'COMPLETED' ? 'badge-success' : 'badge-danger')}">${sub.status}</span>
            </div>
        </div>
        
        <div class="detail-item"><span>User Email:</span> <strong><code>${sub.userId}</code></strong></div>
        <div class="detail-item"><span>Brand:</span> <strong>${sub.brand}</strong></div>
        <div class="detail-item"><span>Denomination:</span> <strong>${sub.currency} ${sub.cardValue}</strong></div>
        <div class="detail-item"><span>PIN Code/Serial:</span> <strong style="font-family:monospace; background:var(--bg-tertiary); padding: 2px 6px; border-radius:4px; font-size: 1rem;">${sub.cardCode}</strong></div>
        
        <h4 style="font-weight:700; margin: 16px 0 10px;">Scanned Verification Images</h4>
        <div class="inspect-card-images">
            <div class="card-img-panel">
                <span class="input-label" style="font-size:0.7rem; display:block; margin-bottom:6px;">Card Front</span>
                <img src="${sub.frontImageUrl}" alt="Card Front" onclick="zoomImage(this.src)">
            </div>
            <div class="card-img-panel">
                <span class="input-label" style="font-size:0.7rem; display:block; margin-bottom:6px;">Card Back</span>
                <img src="${sub.backImageUrl}" alt="Card Back" onclick="zoomImage(this.src)">
            </div>
        </div>
        
        ${decisionHTML}
    `;
}

// Approve gift card trades payouts
function approveCardTrade(id) {
    const payoutAmount = parseFloat(document.getElementById("dec-payout").value);
    
    if (isNaN(payoutAmount) || payoutAmount <= 0) {
        showToast("Please enter a valid payout credit amount.", "danger");
        return;
    }
    
    const db = getDB();
    const subIndex = db.submissions.findIndex(s => s.id === id);
    if (subIndex === -1) return;
    
    const sub = db.submissions[subIndex];
    let user = db.users[sub.userId];
    if (!user) {
        syncLocalUserAccount(sub.userId);
        user = db.users[sub.userId];
    }
    
    // Approve credit to available balance
    user.wallet.balance += payoutAmount;
    
    // Change submission state
    sub.status = "COMPLETED";
    sub.payoutAmount = payoutAmount;
    db.submissions[subIndex] = sub;
    
    // Log in user activity
    user.logs.unshift({
        event: `Gift Card Trade APPROVED: ${sub.brand} (${sub.currency} ${sub.cardValue}) -> +₦${payoutAmount.toLocaleString()}`,
        timestamp: new Date().toISOString(),
        ip: "system"
    });
    
    db.users[sub.userId] = user;
    saveDB(db);
    
    // Push updates to Supabase Cloud
    if (typeof supabaseAdminUpdateSubmission === "function") {
        supabaseAdminUpdateSubmission(id, { status: "COMPLETED", payoutAmount: payoutAmount }, sub.userId);
    }
    if (typeof supabaseAdminUpdateUserBalance === "function") {
        supabaseAdminUpdateUserBalance(sub.userId, user.wallet.balance, payoutAmount, 'CREDIT');
    }
    
    // Log Admin Audits
    writeAuditLog(
        currentAdmin.email,
        "Approved Gift Card Trade",
        `Approved Trade ID: ${id} for ${sub.userId} (Payout: ₦${payoutAmount.toLocaleString()})`
    );
    
    // Notify User
    dispatchNotification(
        sub.userId,
        "Gift Card Trade APPROVED",
        `Congratulations! Your ${sub.brand} card worth ${sub.currency} ${sub.cardValue} has been approved. ₦${payoutAmount.toLocaleString()} has been credited to your wallet.`
    );
    
    showToast("Gift card trade approved and payout credited.", "success");
    
    // Refresh GUI
    loadAdminSession();
    inspectCardSubmission(id); // reload inspect details
}

// Reject gift card trades
function rejectCardTrade(id) {
    const reason = document.getElementById("dec-reject-reason").value;
    
    const db = getDB();
    const subIndex = db.submissions.findIndex(s => s.id === id);
    if (subIndex === -1) return;
    
    const sub = db.submissions[subIndex];
    let user = db.users[sub.userId];
    if (!user) {
        syncLocalUserAccount(sub.userId);
        user = db.users[sub.userId];
    }
    
    // Change submission state
    sub.status = "REJECTED";
    sub.rejectionReason = reason;
    db.submissions[subIndex] = sub;
    
    // Log in user activity
    user.logs.unshift({
        event: `Gift Card Trade REJECTED: ${sub.brand} (${sub.currency} ${sub.cardValue})`,
        timestamp: new Date().toISOString(),
        ip: "system"
    });
    
    db.users[sub.userId] = user;
    saveDB(db);
    
    // Push updates to Supabase Cloud
    if (typeof supabaseAdminUpdateSubmission === "function") {
        supabaseAdminUpdateSubmission(id, { status: "REJECTED", rejectionReason: reason }, sub.userId);
    }
    
    // Log Admin Audits
    writeAuditLog(
        currentAdmin.email,
        "Rejected Gift Card Trade",
        `Rejected Trade ID: ${id} for ${sub.userId}. Reason: ${reason}`
    );
    
    // Notify User
    dispatchNotification(
        sub.userId,
        "Gift Card Trade REJECTED",
        `Attention: Your ${sub.brand} card worth ${sub.currency} ${sub.cardValue} was rejected by administrative reviews. Reason: ${reason}`
    );
    
    showToast("Gift card trade rejected successfully.", "warning");
    
    // Refresh GUI
    loadAdminSession();
    inspectCardSubmission(id); // reload inspect details
}

// Scanned Images Zoom Display
function zoomImage(src) {
    // Create quick overlay image modal
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay active";
    overlay.style.zIndex = "3000";
    overlay.onclick = () => overlay.remove();
    
    overlay.innerHTML = `
        <div style="max-width: 90vw; max-height: 90vh; position: relative;">
            <img src="${src}" style="max-width: 100%; max-height: 80vh; border-radius: var(--radius-md); box-shadow: var(--card-shadow); border: 2px solid var(--border-color);">
            <p style="text-align: center; color: #ffffff; font-size: 0.9rem; margin-top:12px; font-weight:600;"><i class="fas fa-xmark"></i> Click anywhere to close zoom preview</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

// RENDER WITHDRAWALS SETTLEMENTS QUEUE
function filterWithdrawalsQueue(filterVal, element) {
    currentWithdrawalsFilter = filterVal;
    
    // Toggle active class on rates filtering
    const buttons = element.parentNode.querySelectorAll("button");
    buttons.forEach(btn => btn.classList.remove("active"));
    if (element) element.classList.add("active");
    
    renderWithdrawalsQueue();
}

function renderWithdrawalsQueue() {
    const db = getDB();
    const container = document.getElementById("admin-withdrawals-list");
    container.innerHTML = "";
    
    let list = db.withdrawals;
    if (currentWithdrawalsFilter !== "ALL") {
        list = db.withdrawals.filter(w => w.status === currentWithdrawalsFilter);
    }
    
    if (list.length === 0) {
        container.innerHTML = `<p style="padding: 24px; text-align:center; color: var(--text-muted);">No withdrawals found matching filter.</p>`;
        return;
    }
    
    list.forEach(w => {
        const div = document.createElement("div");
        div.className = `ticket-row ${activeWithdrawalInspectId === w.id ? 'active' : ''}`;
        div.onclick = () => inspectWithdrawalRequest(w.id);
        
        let badge = "";
        if (w.status === "PENDING") badge = `<span class="badge badge-warning btn-sm" style="font-size:0.65rem; padding: 2px 4px;">Pending</span>`;
        else if (w.status === "COMPLETED") badge = `<span class="badge badge-success btn-sm" style="font-size:0.65rem; padding: 2px 4px;">Completed</span>`;
        else badge = `<span class="badge badge-danger btn-sm" style="font-size:0.65rem; padding: 2px 4px;">Declined</span>`;
        
        div.innerHTML = `
            <div>
                <strong style="display:block;">₦${w.amount.toLocaleString()}</strong>
                <span style="font-size:0.75rem; color:var(--text-secondary);">${w.bankName} • <code>${w.userId}</code></span>
            </div>
            <div>${badge}</div>
        `;
        
        container.appendChild(div);
    });
}

// Inspect details of cash withdrawal requests
function inspectWithdrawalRequest(id) {
    activeWithdrawalInspectId = id;
    const db = getDB();
    const wd = db.withdrawals.find(w => w.id === id);
    const panel = document.getElementById("admin-withdrawal-inspect-panel");
    
    if (!wd) {
        panel.innerHTML = `<div style="text-align: center; padding: 100px 20px; color: var(--text-muted);"><p>Withdrawal request not found.</p></div>`;
        return;
    }
    
    // Highlight sidebar select
    renderWithdrawalsQueue();
    
    let decisionHTML = "";
    if (wd.status === "PENDING") {
        decisionHTML = `
            <div style="border-top:1px solid var(--border-color); padding-top:20px; margin-top:20px;">
                <h4 style="font-weight:700; margin-bottom:12px;">Settle Payout Transfer</h4>
                <p style="color:var(--text-secondary); font-size:0.8rem; line-height:1.5; margin-bottom:16px;">
                    Ensure manually transferring <strong>₦${wd.amount.toLocaleString()}</strong> to the beneficiary bank details listed below via your payment gateway (Paystack / GTBank) before marking this as completed.
                </p>
                <div style="display:flex; gap:16px;">
                    <button class="btn btn-accent btn-sm" style="flex:1;" onclick="approveWithdrawalPayout('${wd.id}')"><i class="fas fa-check"></i> Approve Transfer Payout</button>
                    
                    <button class="btn btn-danger btn-sm" style="flex:1;" onclick="declineWithdrawalPayout('${wd.id}')"><i class="fas fa-xmark"></i> Decline & Revert Funds</button>
                </div>
            </div>
        `;
    } else if (wd.status === "COMPLETED") {
        decisionHTML = `
            <div style="border-top:1px solid var(--border-color); padding-top:20px; margin-top:20px; color:var(--accent); text-align:center;">
                <i class="fas fa-circle-check" style="font-size:2rem; margin-bottom:8px;"></i>
                <h4 style="font-weight:700;">Payout Completed</h4>
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:4px;">Funds have been sent and ledger balances updated.</p>
            </div>
        `;
    } else {
        decisionHTML = `
            <div style="border-top:1px solid var(--border-color); padding-top:20px; margin-top:20px; color:var(--danger); text-align:center;">
                <i class="fas fa-circle-xmark" style="font-size:2rem; margin-bottom:8px;"></i>
                <h4 style="font-weight:700;">Declined / Returned</h4>
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:4px;">Funds were returned to user wallet disponível balance. Reason: Transfer failed or cancelled.</p>
            </div>
        `;
    }
    
    panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
                <h3 style="font-weight:800; font-size:1.25rem;">Withdrawal Settlement Detail</h3>
                <span style="font-size:0.75rem; color:var(--text-muted);">WD ID: <code>${wd.id}</code> • Requested: ${new Date(wd.createdAt).toLocaleString()}</span>
            </div>
            <div>
                <span class="badge ${wd.status === 'PENDING' ? 'badge-warning' : (wd.status === 'COMPLETED' ? 'badge-success' : 'badge-danger')}">${wd.status}</span>
            </div>
        </div>
        
        <div class="detail-item"><span>User Email:</span> <strong><code>${wd.userId}</code></strong></div>
        <div class="detail-item"><span>Payout Amount:</span> <strong style="font-size:1.15rem; color:var(--danger);">₦${wd.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></div>
        
        <h4 style="font-weight:700; margin: 16px 0 10px;">Linked Payout Bank Profile</h4>
        <div style="padding:16px; border: 1px solid var(--border-color); background:var(--bg-tertiary); border-radius: var(--radius-md); font-size: 0.9rem; line-height: 1.6;">
            <strong>Bank:</strong> ${wd.bankName}<br>
            <strong>Account Number:</strong> <code>${wd.accountNumber}</code><br>
            <strong>Beneficiary Name:</strong> ${wd.accountHolderName}
        </div>
        
        ${decisionHTML}
    `;
}

// Approve manual banking transfers
function approveWithdrawalPayout(id) {
    const db = getDB();
    const wdIndex = db.withdrawals.findIndex(w => w.id === id);
    if (wdIndex === -1) return;
    
    const wd = db.withdrawals[wdIndex];
    
    // Available Balance was already deducted from user on request, so we only change request status to COMPLETED
    wd.status = "COMPLETED";
    db.withdrawals[wdIndex] = wd;
    
    saveDB(db);
    
    // Push updates to Supabase Cloud
    if (typeof supabaseAdminUpdateWithdrawal === "function") {
        supabaseAdminUpdateWithdrawal(id, { status: "COMPLETED", amount: wd.amount }, wd.userId);
    }
    
    // Log Admin Audit Trail
    writeAuditLog(
        currentAdmin.email,
        "Approved Withdrawal Request",
        `Approved Cash Payout WD ID: ${id} for ${wd.userId} (Amount: ₦${wd.amount.toLocaleString()})`
    );
    
    // Notify User
    dispatchNotification(
        wd.userId,
        "Withdrawal Completed Successfully",
        `Your withdrawal request of ₦${wd.amount.toLocaleString()} has been processed and sent to your bank account.`
    );
    
    showToast("Withdrawal payout transfer completed.", "success");
    
    // Reload UI
    loadAdminSession();
    inspectWithdrawalRequest(id);
}

// Decline manual transfers and refund wallets balance
function declineWithdrawalPayout(id) {
    const db = getDB();
    const wdIndex = db.withdrawals.findIndex(w => w.id === id);
    if (wdIndex === -1) return;
    
    const wd = db.withdrawals[wdIndex];
    let user = db.users[wd.userId];
    if (!user) {
        syncLocalUserAccount(wd.userId);
        user = db.users[wd.userId];
    }
    
    // Refund amount back to available balance
    user.wallet.balance += wd.amount;
    
    // Change request state
    wd.status = "DECLINED";
    wd.declineReason = "Administrative reject or invalid gateway routing.";
    db.withdrawals[wdIndex] = wd;
    
    // Log user log
    user.logs.unshift({
        event: `Withdrawal DECLINED: ₦${wd.amount.toLocaleString()} Refunded`,
        timestamp: new Date().toISOString(),
        ip: "system"
    });
    
    db.users[wd.userId] = user;
    saveDB(db);
    
    // Push updates to Supabase Cloud
    if (typeof supabaseAdminUpdateWithdrawal === "function") {
        supabaseAdminUpdateWithdrawal(id, { status: "DECLINED", declineReason: wd.declineReason }, wd.userId, wd.amount);
    }
    if (typeof supabaseAdminUpdateUserBalance === "function") {
        supabaseAdminUpdateUserBalance(wd.userId, user.wallet.balance, wd.amount, 'REFUND');
    }
    
    // Log Admin Audit Trail
    writeAuditLog(
        currentAdmin.email,
        "Declined Withdrawal Request",
        `Declined Payout WD ID: ${id} for ${wd.userId}. Refunded ₦${wd.amount.toLocaleString()} back to wallet available.`
    );
    
    // Notify User
    dispatchNotification(
        wd.userId,
        "Withdrawal DECLINED / REVERTED",
        `Your withdrawal request of ₦${wd.amount.toLocaleString()} was declined. The funds have been returned to your wallet balance.`
    );
    
    showToast("Withdrawal declined. Wallet balance refunded.", "warning");
    
    // Reload UI
    loadAdminSession();
    inspectWithdrawalRequest(id);
}

// EXCHANGE RATES CONFIGURATORS
function renderRatesConfigurator() {
    const db = getDB();
    const theadRow = document.getElementById("admin-rates-thead-row");
    const tbody = document.getElementById("admin-rates-tbody");
    if (!tbody || !theadRow) return;
    
    const activeCurrencies = Object.keys(db.currencies || {}).filter(code => db.currencies[code].status === "ACTIVE");
    
    // Generate headers
    let headersHTML = `<th>Card Brand</th>`;
    activeCurrencies.forEach(code => {
        headersHTML += `<th style="width: 20%; text-align: right;" class="text-right">USA Rate (${code})</th>`;
    });
    theadRow.innerHTML = headersHTML;
    
    tbody.innerHTML = "";
    
    const rates = db.settings.rates;
    Object.keys(rates).forEach(brand => {
        const tr = document.createElement("tr");
        
        // Brand logo + name
        const logoHTML = getBrandLogoHTML(brand);
        
        let colsHTML = `
            <td>
                <div style="display: flex; align-items: center;">
                    ${logoHTML}
                    <strong>${brand}</strong>
                </div>
            </td>
        `;
        
        activeCurrencies.forEach(code => {
            const val = rates[brand] && rates[brand][code] !== undefined ? rates[brand][code] : (db.currencies[code] ? db.currencies[code].rate : 1000);
            colsHTML += `<td class="text-right"><input type="number" class="input-field rate-input text-right" style="padding: 6px 12px; width: 100%; max-width: 130px; margin-left: auto; background: var(--bg-tertiary);" data-brand="${brand}" data-curr="${code}" value="${val}"></td>`;
        });
        
        tr.innerHTML = colsHTML;
        tbody.appendChild(tr);
    });
}

function saveAdminRates() {
    const db = getDB();
    const inputs = document.querySelectorAll(".rate-input");
    
    let isDirty = false;
    inputs.forEach(input => {
        const brand = input.getAttribute("data-brand");
        const curr = input.getAttribute("data-curr"); // "USD", "EUR", or "NGN"
        const val = parseFloat(input.value);
        
        if (!isNaN(val) && val >= 0) {
            if (!db.settings.rates[brand]) {
                db.settings.rates[brand] = {};
            }
            if (db.settings.rates[brand][curr] !== val) {
                db.settings.rates[brand][curr] = val;
                
                // Propagate updates to corresponding country/region keys for user portal
                if (curr === "USD") {
                    db.settings.rates[brand]["USA"] = val;
                    db.settings.rates[brand]["Canada"] = Math.floor(val * 0.80);
                    db.settings.rates[brand]["Australia"] = Math.floor(val * 0.75);
                    db.settings.rates[brand]["Switzerland (CHF)"] = Math.floor(val * 1.15);
                    db.settings.rates[brand]["Japan (JPY)"] = Math.floor(val * 0.008);
                    db.settings.rates[brand]["China (CNY)"] = Math.floor(val * 0.16);
                    db.settings.rates[brand]["Hong Kong (HKD)"] = Math.floor(val * 0.15);
                    db.settings.rates[brand]["Singapore (SGD)"] = Math.floor(val * 0.85);
                    db.settings.rates[brand]["New Zealand (NZD)"] = Math.floor(val * 0.70);
                    db.settings.rates[brand]["UAE (AED)"] = Math.floor(val * 0.32);
                    db.settings.rates[brand]["Saudi Arabia (SAR)"] = Math.floor(val * 0.31);
                    db.settings.rates[brand]["South Africa (ZAR)"] = Math.floor(val * 0.06);
                    db.settings.rates[brand]["India (INR)"] = Math.floor(val * 0.014);
                } else if (curr === "EUR") {
                    db.settings.rates[brand]["Europe (EUR)"] = val;
                    db.settings.rates[brand]["Germany"] = val;
                    db.settings.rates[brand]["France"] = val;
                    db.settings.rates[brand]["Italy"] = val;
                    db.settings.rates[brand]["Spain"] = val;
                    db.settings.rates[brand]["Netherlands"] = val;
                    db.settings.rates[brand]["UK"] = Math.floor(val * 1.10); // derive UK GBP from EUR
                } else if (curr === "NGN") {
                    db.settings.rates[brand]["NGN"] = val;
                }
                
                isDirty = true;
            }
        }
    });
    
    if (isDirty) {
        saveDB(db);
        
        // Push rates to Supabase Cloud
        if (typeof supabaseAdminSyncCurrenciesAndRates === "function") {
            supabaseAdminSyncCurrenciesAndRates(db.currencies, db.settings.rates);
        }
        
        writeAuditLog(
            currentAdmin.email,
            "Exchange Rates Modified",
            `System multipliers configuration modified.`
        );
        showToast("Exchange rates updated successfully.", "success");
        loadAdminSession();
    } else {
        showToast("No rate multipliers changed.", "info");
    }
}

// Bulk update USD base rate for all brands
function bulkUpdateUSDRate() {
    const rateStr = prompt("Enter new baseline USD Exchange Rate in NGN (e.g. 1500):");
    if (rateStr === null) return; // cancelled
    
    const rateVal = parseFloat(rateStr);
    if (isNaN(rateVal) || rateVal <= 0) {
        showToast("Please enter a valid rate.", "danger");
        return;
    }
    
    const db = getDB();
    
    // Update rates for all brands in the settings
    Object.keys(db.settings.rates).forEach(brand => {
        // Set new USD rate
        db.settings.rates[brand]["USD"] = rateVal;
        
        // Propagate updates to corresponding country/region keys for user portal
        db.settings.rates[brand]["USA"] = rateVal;
        db.settings.rates[brand]["Canada"] = Math.floor(rateVal * 0.80);
        db.settings.rates[brand]["Australia"] = Math.floor(rateVal * 0.75);
        db.settings.rates[brand]["Switzerland (CHF)"] = Math.floor(rateVal * 1.15);
        db.settings.rates[brand]["Japan (JPY)"] = Math.floor(rateVal * 0.008);
        db.settings.rates[brand]["China (CNY)"] = Math.floor(rateVal * 0.16);
        db.settings.rates[brand]["Hong Kong (HKD)"] = Math.floor(rateVal * 0.15);
        db.settings.rates[brand]["Singapore (SGD)"] = Math.floor(rateVal * 0.85);
        db.settings.rates[brand]["New Zealand (NZD)"] = Math.floor(rateVal * 0.70);
        db.settings.rates[brand]["UAE (AED)"] = Math.floor(rateVal * 0.32);
        db.settings.rates[brand]["Saudi Arabia (SAR)"] = Math.floor(rateVal * 0.31);
        db.settings.rates[brand]["South Africa (ZAR)"] = Math.floor(rateVal * 0.06);
        db.settings.rates[brand]["India (INR)"] = Math.floor(rateVal * 0.014);
    });
    
    // Sync central currency registry USD rate as well
    if (db.currencies && db.currencies["USD"]) {
        db.currencies["USD"].rate = rateVal;
    }
    
    // Log event
    db.auditTrail.unshift({
        operator: currentAdmin.email,
        event: "Bulk USD Rate Updated",
        timestamp: new Date().toISOString(),
        details: `Bulk updated all brands USD base rate to ₦${rateVal.toLocaleString()}`
    });
    
    saveDB(db);
    showToast(`Bulk updated USD base rate to ₦${rateVal.toLocaleString()} successfully.`, "success");
    loadAdminSession();
}

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
    
    return `<div class="brand-logo-container" style="width: 32px; height: 32px; background: ${bgColor}; color: ${textColor}; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 1rem;"><i class="${iconClass}"></i></div>`;
}

// GENERAL ANNOUNCEMENT BROADCASTING
function handleSendBroadcast(e) {
    e.preventDefault();
    
    const title = document.getElementById("bc-title").value.trim();
    const category = document.getElementById("bc-category").value;
    const msg = document.getElementById("bc-message").value.trim();
    
    const db = getDB();
    const emails = Object.keys(db.users).filter(email => db.users[email].role !== "ADMIN");
    
    if (emails.length === 0) {
        showToast("No active platform users to dispatch announcements.", "danger");
        return;
    }
    
    // Broadcast notifications to all users
    emails.forEach(email => {
        const notification = {
            id: "nt-" + Math.floor(Math.random() * 1000000),
            title: `📢 Announcement: ${title}`,
            message: msg,
            read: false,
            createdAt: new Date().toISOString()
        };
        db.users[email].notifications.unshift(notification);
        
        // Add log
        db.users[email].logs.unshift({
            event: `Broadcast Announcement Received: ${title}`,
            timestamp: new Date().toISOString(),
            ip: "system"
        });
    });
    
    saveDB(db);
    
    // Push broadcast to Supabase Cloud
    if (typeof supabaseAdminDispatchBroadcast === "function") {
        supabaseAdminDispatchBroadcast(title, msg);
    }
    
    // Track Announcement inside Admin Audits
    writeAuditLog(
        currentAdmin.email,
        `Broadcast Announcement Dispatched: ${title}`,
        `Message: ${msg} (Sent to ${emails.length} accounts)`
    );
    
    showToast("General broadcast announcement dispatched successfully to all user inboxes.", "success");
    
    // Reset form and reload list logs
    document.getElementById("admin-broadcast-form").reset();
    renderBroadcastList();
}

function renderBroadcastList() {
    const db = getDB();
    const container = document.getElementById("admin-broadcast-list");
    container.innerHTML = "";
    
    // Filter announcements from auditTrail
    const broadcasts = db.auditTrail.filter(log => log.event.startsWith("Broadcast Announcement Dispatched:"));
    
    if (broadcasts.length === 0) {
        container.innerHTML = `<p style="padding:20px; text-align:center; color:var(--text-muted);">No broadcast announcement history found.</p>`;
        return;
    }
    
    broadcasts.forEach(bc => {
        const div = document.createElement("div");
        div.style.padding = "16px";
        div.style.border = "1px solid var(--border-color)";
        div.style.borderRadius = "var(--radius-md)";
        div.style.background = "var(--bg-tertiary)";
        div.style.marginBottom = "12px";
        
        const titleStr = bc.event.replace("Broadcast Announcement Dispatched: ", "");
        const dateStr = new Date(bc.timestamp).toLocaleString();
        
        div.innerHTML = `
            <h5 style="font-weight:800; font-size:0.95rem; margin-bottom:4px;"><i class="fas fa-bullhorn" style="color:var(--primary); margin-right:6px;"></i> ${titleStr}</h5>
            <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.4; margin-bottom:8px;">${bc.details}</p>
            <span style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</span>
        `;
        container.appendChild(div);
    });
}

// RENDER SYSTEM AUDIT LOGS
function renderAdminAuditLogs() {
    const db = getDB();
    const tbody = document.getElementById("admin-audit-tbody");
    tbody.innerHTML = "";
    
    db.auditTrail.forEach(log => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-size: 0.8rem; color: var(--text-secondary);">${new Date(log.timestamp).toLocaleString()}</td>
            <td><code>${log.operator}</code></td>
            <td><strong>${log.event}</strong></td>
            <td style="font-size: 0.85rem; color: var(--text-secondary); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.details}">${log.details}</td>
        `;
        tbody.appendChild(tr);
    });
}

// EXPORTS DB BACKUP AS JSON
function exportAdminDB() {
    const db = getDB();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 4));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "goodfastpay_sandbox_db_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Database backup file downloaded.", "success");
}

// CONFIRM AND RESET DB SANDBOX FOR TEST REFRESHES
function confirmResetDB() {
    if (confirm("WARNING: Are you sure you want to restore the sandbox database to its default factory state? This will delete all user card trade submissions, cashout withdrawals, and linked bank accounts!")) {
        localStorage.removeItem("goodfastpay_db");
        showToast("Database sandbox restored to default credentials successfully! Reloading...", "warning");
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    }
}

// Admin logout
function handleAdminLogout() {
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

// ================= ADMIN INVENTORY MANAGEMENT SYSTEM =================

// Populate brand filter options in Stock Ledger dynamically
function populateBrandFilterOptions() {
    const filterBrand = document.getElementById("filter-inv-brand");
    if (!filterBrand) return;
    
    const db = getDB();
    const inventory = db.inventory || [];
    
    // Get unique brand names
    const brands = ["ALL"];
    inventory.forEach(item => {
        if (!brands.includes(item.brand)) {
            brands.push(item.brand);
        }
    });
    
    filterBrand.innerHTML = "";
    brands.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b === "ALL" ? "All Brands" : b;
        filterBrand.appendChild(opt);
    });
}

// Reset page to 1 and reload table when search/filter/sort changes
function onInventoryFilterChange() {
    inventoryPage = 1;
    renderAdminInventoryTable();
}

// Reset page and reload table when rows limit changes
function onInventoryRowsLimitChange() {
    inventoryRowsPerPage = parseInt(document.getElementById("pagination-rows-limit").value) || 10;
    inventoryPage = 1;
    renderAdminInventoryTable();
}

// Helper to get country flags and region name
function getCountryFlagEmoji(region) {
    if (region === "USA" || region === "USD") return "🇺🇸 USA";
    if (region === "UK" || region === "GBP") return "🇬🇧 UK";
    if (region === "Canada" || region === "CAD") return "🇨🇦 Canada";
    if (region === "Australia" || region === "AUD") return "🇦🇺 Australia";
    if (["EUR", "Europe (EUR)", "Germany", "France", "Italy", "Spain", "Netherlands"].includes(region)) {
        if (region === "Germany") return "🇩🇪 Germany";
        if (region === "France") return "🇫🇷 France";
        if (region === "Italy") return "🇮🇹 Italy";
        if (region === "Spain") return "🇪🇸 Spain";
        if (region === "Netherlands") return "🇳🇱 Netherlands";
        return "🇪🇺 Europe";
    }
    if (region.includes("Switzerland") || region === "CHF") return "🇨🇭 Switzerland";
    if (region.includes("Japan") || region === "JPY") return "🇯🇵 Japan";
    if (region.includes("China") || region === "CNY") return "🇨🇳 China";
    if (region.includes("Hong Kong") || region === "HKD") return "🇭🇰 Hong Kong";
    if (region.includes("Singapore") || region === "SGD") return "🇸🇬 Singapore";
    if (region.includes("New Zealand") || region === "NZD") return "🇳🇿 New Zealand";
    if (region.includes("UAE") || region === "AED") return "🇦🇪 UAE";
    if (region.includes("Saudi") || region === "SAR") return "🇸🇦 Saudi Arabia";
    if (region.includes("South Africa") || region === "ZAR") return "🇿🇦 South Africa";
    if (region.includes("India") || region === "INR") return "🇮🇳 India";
    return "🌐 " + region;
}

// Helper to get currency symbol and code
function getCurrencyDetails(region) {
    if (region === "USA" || region === "USD") return { symbol: "$", code: "USD" };
    if (region === "UK" || region === "GBP") return { symbol: "£", code: "GBP" };
    if (region === "Canada" || region === "CAD") return { symbol: "$", code: "CAD" };
    if (region === "Australia" || region === "AUD") return { symbol: "$", code: "AUD" };
    if (["EUR", "Europe (EUR)", "Germany", "France", "Italy", "Spain", "Netherlands"].includes(region)) return { symbol: "€", code: "EUR" };
    if (region.includes("Switzerland") || region === "CHF") return { symbol: "CHF", code: "CHF" };
    if (region.includes("Japan") || region === "JPY") return { symbol: "¥", code: "JPY" };
    if (region.includes("China") || region === "CNY") return { symbol: "¥", code: "CNY" };
    if (region.includes("Hong Kong") || region === "HKD") return { symbol: "HK$", code: "HKD" };
    if (region.includes("Singapore") || region === "SGD") return { symbol: "S$", code: "SGD" };
    if (region.includes("New Zealand") || region === "NZD") return { symbol: "NZ$", code: "NZD" };
    if (region.includes("UAE") || region === "AED") return { symbol: "AED", code: "AED" };
    if (region.includes("Saudi") || region === "SAR") return { symbol: "SR", code: "SAR" };
    if (region.includes("South Africa") || region === "ZAR") return { symbol: "R", code: "ZAR" };
    if (region.includes("India") || region === "INR") return { symbol: "₹", code: "INR" };
    return { symbol: "$", code: "USD" };
}

// Render complete stock directory table with full filtering, sorting, and pagination
function renderAdminInventoryTable() {
    const db = getDB();
    const tbody = document.getElementById("admin-inventory-tbody");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    
    let list = db.inventory || [];
    
    // 1. Search Query Filter (Matches Brand, Code/PIN, or ID)
    const searchQuery = (document.getElementById("inv-search-input")?.value || "").trim().toLowerCase();
    if (searchQuery) {
        list = list.filter(item => 
            item.id.toLowerCase().includes(searchQuery) ||
            item.brand.toLowerCase().includes(searchQuery) ||
            item.code.toLowerCase().includes(searchQuery)
        );
    }
    
    // 2. Brand Filter
    const brandFilter = document.getElementById("filter-inv-brand")?.value || "ALL";
    if (brandFilter !== "ALL") {
        list = list.filter(item => item.brand === brandFilter);
    }
    
    // 3. Currency Filter
    const currencyFilter = document.getElementById("filter-inv-currency")?.value || "ALL";
    if (currencyFilter !== "ALL") {
        list = list.filter(item => {
            const details = getCurrencyDetails(item.currency);
            return details.code === currencyFilter;
        });
    }
    
    // 4. Status Filter
    const statusFilter = document.getElementById("filter-inv-status")?.value || "ALL";
    if (statusFilter !== "ALL") {
        list = list.filter(item => item.status === statusFilter);
    }
    
    // 5. Sorting
    const sortVal = document.getElementById("filter-inv-sort")?.value || "LATEST";
    if (sortVal === "LATEST") {
        list.sort((a, b) => b.id.localeCompare(a.id));
    } else if (sortVal === "OLDEST") {
        list.sort((a, b) => a.id.localeCompare(b.id));
    } else if (sortVal === "PRICE_DESC") {
        list.sort((a, b) => b.price - a.price);
    } else if (sortVal === "PRICE_ASC") {
        list.sort((a, b) => a.price - b.price);
    } else if (sortVal === "VAL_DESC") {
        list.sort((a, b) => b.cardValue - a.cardValue);
    } else if (sortVal === "VAL_ASC") {
        list.sort((a, b) => a.cardValue - b.cardValue);
    }
    
    const totalEntries = list.length;
    
    if (totalEntries === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 32px; color: var(--text-muted);">No matching stock records found.</td></tr>`;
        document.getElementById("pagination-info").textContent = "Showing 0-0 of 0 entries";
        document.getElementById("pagination-buttons-container").innerHTML = "";
        return;
    }
    
    // 6. Pagination Slice
    const totalPages = Math.ceil(totalEntries / inventoryRowsPerPage);
    if (inventoryPage > totalPages) inventoryPage = totalPages || 1;
    
    const startIndex = (inventoryPage - 1) * inventoryRowsPerPage;
    const endIndex = Math.min(startIndex + inventoryRowsPerPage, totalEntries);
    
    const paginatedList = list.slice(startIndex, endIndex);
    
    // 7. Render Rows
    paginatedList.forEach(item => {
        const tr = document.createElement("tr");
        
        // Brand logo next to brand name
        const logoHTML = getBrandLogoHTML(item.brand);
        
        // Flag emoji and country name
        const flagHTML = getCountryFlagEmoji(item.currency);
        
        // Currency details
        const currency = getCurrencyDetails(item.currency);
        
        // Format prices and values with thousands separator and two decimal places
        const faceValueText = `${currency.symbol}${item.cardValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        const sellingPriceText = `₦${item.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        // Dynamic status badge styling
        let statusBadge = "";
        if (item.status === "AVAILABLE") {
            statusBadge = `<span class="stock-ledger-badge stock-ledger-badge-available">Available</span>`;
        } else if (item.status === "SOLD") {
            statusBadge = `<span class="stock-ledger-badge stock-ledger-badge-sold">Sold</span>`;
        } else if (item.status === "RESERVED") {
            statusBadge = `<span class="stock-ledger-badge stock-ledger-badge-reserved">Reserved</span>`;
        } else {
            statusBadge = `<span class="stock-ledger-badge stock-ledger-badge-expired">Expired</span>`;
        }
        
        // Buyer / Date Info
        const dateSoldStr = item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString() : "";
        const dateAddedStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "7/28/2026";
        
        const buyerOrDate = item.status === "SOLD" 
            ? `<span title="Buyer: ${item.purchasedBy} (on ${dateSoldStr})"><code>${item.purchasedBy}</code></span>` 
            : `<span style="font-size:0.8rem; color:var(--text-secondary);" title="Date Added: ${dateAddedStr}"><i class="fas fa-calendar-days" style="opacity:0.5; margin-right:4px;"></i> ${dateAddedStr}</span>`;
            
        // PIN / Code column layout (Masked by default with tooltip showing full code on hover if toggled visible)
        const isPinVisible = !!visiblePins[item.id];
        const codeDisplay = isPinVisible ? item.code : "••••••••";
        const eyeIcon = isPinVisible ? "fa-eye-slash" : "fa-eye";
        
        const pinColumnHTML = `
            <code style="background:var(--bg-tertiary); padding: 4px 8px; border-radius:4px; font-family:monospace; font-size:0.85rem;" title="${isPinVisible ? 'PIN Code: ' + item.code : 'PIN is hidden (click View icon in Actions to reveal)'}">${codeDisplay}</code>
        `;
        
        // Actions Column containing compact icon buttons: View PIN, Copy PIN, Edit, Delete, Mark as Sold
        let actionsHTML = `<div style="display:flex; gap:6px; justify-content:center; align-items:center;">`;
        actionsHTML += `<button class="stock-ledger-action-btn" onclick="togglePinVisibility('${item.id}')" title="View PIN" style="width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;"><i class="fas ${eyeIcon}" style="font-size:0.75rem;"></i></button>`;
        actionsHTML += `<button class="stock-ledger-action-btn" onclick="copyPin('${item.code}')" title="Copy PIN" style="width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;"><i class="fas fa-copy" style="font-size:0.75rem;"></i></button>`;
        actionsHTML += `<button class="stock-ledger-action-btn" onclick="editInventoryItem('${item.id}')" title="Edit Price/PIN" style="width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;"><i class="fas fa-pen-to-square" style="font-size:0.75rem;"></i></button>`;
        if (item.status === "AVAILABLE") {
            actionsHTML += `<button class="stock-ledger-action-btn btn-sold" onclick="markInventoryAsSold('${item.id}')" title="Mark as Sold" style="width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;"><i class="fas fa-check-double" style="font-size:0.75rem;"></i></button>`;
        }
        actionsHTML += `<button class="stock-ledger-action-btn btn-delete" onclick="deleteInventoryItem('${item.id}')" title="Delete Card" style="width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;"><i class="fas fa-trash-can" style="font-size:0.75rem;"></i></button>`;
        actionsHTML += `</div>`;
        
        tr.innerHTML = `
            <td title="${item.brand} (${item.id})">
                <div style="display:flex; align-items:center; gap:8px;">
                    ${logoHTML}
                    <div style="line-height:1.2; text-align:left;">
                        <strong>${item.brand}</strong><br>
                        <span style="font-size:0.7rem; color:var(--text-muted); font-family:monospace;">${item.id}</span>
                    </div>
                </div>
            </td>
            <td title="${flagHTML}"><strong>${flagHTML}</strong></td>
            <td title="${currency.code}"><code>${currency.code}</code></td>
            <td style="font-weight:600;" title="Face Value: ${faceValueText}">${faceValueText}</td>
            <td style="font-weight:700; color:var(--secondary);" title="Selling Price: ${sellingPriceText}">${sellingPriceText}</td>
            <td>${pinColumnHTML}</td>
            <td>${statusBadge}</td>
            <td>${buyerOrDate}</td>
            <td>${actionsHTML}</td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // 8. Update Pagination Info & Controls
    document.getElementById("pagination-info").textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalEntries} entries`;
    
    const pagContainer = document.getElementById("pagination-buttons-container");
    pagContainer.innerHTML = "";
    
    // Prev Button
    const prevBtn = document.createElement("button");
    prevBtn.className = "stock-ledger-page-btn";
    prevBtn.disabled = (inventoryPage === 1);
    prevBtn.innerHTML = `<i class="fas fa-chevron-left"></i>`;
    prevBtn.onclick = () => changeInventoryPage(inventoryPage - 1);
    pagContainer.appendChild(prevBtn);
    
    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement("button");
        pageBtn.className = `stock-ledger-page-btn ${inventoryPage === i ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => changeInventoryPage(i);
        pagContainer.appendChild(pageBtn);
    }
    
    // Next Button
    const nextBtn = document.createElement("button");
    nextBtn.className = "stock-ledger-page-btn";
    nextBtn.disabled = (inventoryPage === totalPages);
    nextBtn.innerHTML = `<i class="fas fa-chevron-right"></i>`;
    nextBtn.onclick = () => changeInventoryPage(inventoryPage + 1);
    pagContainer.appendChild(nextBtn);
}

// Switch pages
function changeInventoryPage(page) {
    inventoryPage = page;
    renderAdminInventoryTable();
}

// Toggle PIN display visibility
function togglePinVisibility(itemId) {
    visiblePins[itemId] = !visiblePins[itemId];
    renderAdminInventoryTable();
}

// Helper to copy pin code to clipboard
function copyPin(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast("PIN code copied to clipboard!", "success");
    }).catch(err => {
        showToast("Failed to copy PIN to clipboard.", "danger");
    });
}

// Settle admin manual stock deletion
function deleteInventoryItem(itemId) {
    if (confirm(`Are you sure you want to delete stock item ${itemId} from the inventory? This action is irreversible.`)) {
        const db = getDB();
        const index = db.inventory.findIndex(item => item.id === itemId);
        if (index === -1) return;
        
        const item = db.inventory[index];
        db.inventory.splice(index, 1);
        
        // Log event
        db.auditTrail.unshift({
            operator: currentAdmin.email,
            event: "Stock Item Deleted",
            timestamp: new Date().toISOString(),
            details: `Deleted card ID: ${itemId} - ${item.brand} (${item.currency} ${item.cardValue})`
        });
        
        saveDB(db);
        
        // Push deletion to Supabase Cloud
        if (typeof supabaseAdminDeleteInventory === "function") {
            supabaseAdminDeleteInventory(itemId);
        }
        
        showToast(`Stock item ${itemId} deleted successfully.`, "warning");
        loadAdminSession();
    }
}

// Mark available stock item as manually sold
function markInventoryAsSold(itemId) {
    if (confirm(`Are you sure you want to manually mark stock item ${itemId} as SOLD?`)) {
        const db = getDB();
        const index = db.inventory.findIndex(item => item.id === itemId);
        if (index === -1) return;
        
        const item = db.inventory[index];
        item.status = "SOLD";
        item.purchasedBy = "admin_manual@goodfastpay.com";
        item.purchasedAt = new Date().toISOString();
        
        // Log event
        db.auditTrail.unshift({
            operator: currentAdmin.email,
            event: "Stock Item Marked Sold",
            timestamp: new Date().toISOString(),
            details: `Marked card ID: ${itemId} as manually sold to admin_manual@goodfastpay.com`
        });
        
        saveDB(db);
        showToast(`Stock item ${itemId} marked as sold.`, "success");
        loadAdminSession();
    }
}

// Calculate and render stock stats
function renderInventoryStats() {
    const db = getDB();
    const inventory = db.inventory || [];
    
    const total = inventory.length;
    const inStock = inventory.filter(item => item.status === "AVAILABLE").length;
    const sold = inventory.filter(item => item.status === "SOLD").length;
    const reserved = inventory.filter(item => item.status === "RESERVED").length;
    const stockValue = inventory.filter(item => item.status === "AVAILABLE").reduce((sum, item) => sum + item.price, 0);
    const revenue = inventory.filter(item => item.status === "SOLD").reduce((sum, item) => sum + item.price, 0);
    
    const totalEl = document.getElementById("stat-inv-total");
    const inStockEl = document.getElementById("stat-inv-instock");
    const soldEl = document.getElementById("stat-inv-sold");
    const reservedEl = document.getElementById("stat-inv-reserved");
    const valueEl = document.getElementById("stat-inv-value");
    const revenueEl = document.getElementById("stat-inv-revenue");
    
    if (totalEl) totalEl.textContent = total;
    if (inStockEl) inStockEl.textContent = inStock;
    if (soldEl) soldEl.textContent = sold;
    if (reservedEl) reservedEl.textContent = reserved;
    if (valueEl) valueEl.textContent = `₦${stockValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (revenueEl) revenueEl.textContent = `₦${revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// Reset all inventory search, filter, and sorting dropdowns
function resetInventoryFilters() {
    const searchInput = document.getElementById("inv-search-input");
    const filterBrand = document.getElementById("filter-inv-brand");
    const filterCurrency = document.getElementById("filter-inv-currency");
    const filterStatus = document.getElementById("filter-inv-status");
    const filterSort = document.getElementById("filter-inv-sort");
    
    if (searchInput) searchInput.value = "";
    if (filterBrand) filterBrand.value = "ALL";
    if (filterCurrency) filterCurrency.value = "ALL";
    if (filterStatus) filterStatus.value = "ALL";
    if (filterSort) filterSort.value = "LATEST";
    
    inventoryPage = 1;
    renderAdminInventoryTable();
}

// Edit available stock card details (Price and PIN)
function editInventoryItem(itemId) {
    const db = getDB();
    const index = db.inventory.findIndex(item => item.id === itemId);
    if (index === -1) return;
    
    const item = db.inventory[index];
    
    const newPriceStr = prompt(`Edit Sale Price for ${item.brand} (current: ₦${item.price.toLocaleString()}):`, item.price);
    if (newPriceStr === null) return; // cancelled
    
    const newPrice = parseFloat(newPriceStr);
    if (isNaN(newPrice) || newPrice <= 0) {
        showToast("Please enter a valid price.", "danger");
        return;
    }
    
    const newCode = prompt(`Edit PIN Code for ${item.brand} (current: ${item.code}):`, item.code);
    if (newCode === null) return; // cancelled
    const trimmedCode = newCode.trim();
    if (!trimmedCode) {
        showToast("Please enter a valid PIN code.", "danger");
        return;
    }
    
    item.price = newPrice;
    item.code = trimmedCode;
    db.inventory[index] = item;
    
    // Log event
    db.auditTrail.unshift({
        operator: currentAdmin.email,
        event: "Stock Item Edited",
        timestamp: new Date().toISOString(),
        details: `Edited card ID: ${itemId} - New Price: ₦${newPrice.toLocaleString()}, New PIN: ${trimmedCode}`
    });
    
    saveDB(db);
    showToast(`Stock item ${itemId} updated successfully.`, "success");
    loadAdminSession();
}

// Handle adding new stock cards
function handleAddInventory(event) {
    event.preventDefault();
    
    const brand = document.getElementById("inv-brand").value;
    const currency = document.getElementById("inv-currency").value;
    const cardValue = parseFloat(document.getElementById("inv-value").value);
    const code = document.getElementById("inv-code").value.trim();
    const price = parseFloat(document.getElementById("inv-price").value);
    
    if (isNaN(cardValue) || cardValue <= 0) {
        showToast("Please enter a valid face value.", "danger");
        return;
    }
    
    if (!code) {
        showToast("Please enter the actual gift card PIN code.", "danger");
        return;
    }
    
    if (isNaN(price) || price <= 0) {
        showToast("Please enter a valid NGN sale price.", "danger");
        return;
    }
    
    const db = getDB();
    
    // Generate incremental Stock ID
    const stockId = "STK-" + (9000 + (db.inventory ? db.inventory.length : 0) + 1);
    
    const newItem = {
        id: stockId,
        brand: brand,
        cardValue: cardValue,
        currency: currency,
        code: code,
        price: price,
        status: "AVAILABLE",
        purchasedBy: null,
        purchasedAt: null,
        createdAt: new Date().toISOString()
    };
    
    if (!db.inventory) {
        db.inventory = [];
    }
    
    db.inventory.push(newItem);
    
    // Log audit trail
    db.auditTrail.unshift({
        operator: currentAdmin.email,
        event: "Gift Card Added to Stock",
        timestamp: new Date().toISOString(),
        details: `Uploaded ${brand} (${currency} ${cardValue}) Card ID: ${stockId}. Selling Price: ₦${price.toLocaleString()}`
    });
    
    saveDB(db);
    
    // Push stock item to Supabase Cloud
    if (typeof supabaseAdminInsertInventory === "function") {
        supabaseAdminInsertInventory(newItem);
    }
    
    showToast(`Stock item ${stockId} uploaded successfully.`, "success");
    
    // Reset form
    document.getElementById("admin-inventory-form").reset();
    
    // Reload data
    loadAdminSession();
}

// Populate admin inventory upload form options dynamically
function populateInventoryFormOptions() {
    const brandSelect = document.getElementById("inv-brand");
    const currencySelect = document.getElementById("inv-currency");
    if (!brandSelect || !currencySelect) return;
    
    // Populate brand select if empty
    if (brandSelect.children.length === 0) {
        brandSelect.innerHTML = "";
        Object.keys(GIFT_CARD_CATEGORIES).forEach(category => {
            const optgroup = document.createElement("optgroup");
            optgroup.label = category;
            
            GIFT_CARD_CATEGORIES[category].forEach(brand => {
                const opt = document.createElement("option");
                opt.value = brand;
                opt.textContent = brand;
                optgroup.appendChild(opt);
            });
            
            brandSelect.appendChild(optgroup);
        });
    }
    
    // Always load currency selections dynamically based on active currencies in DB
    populateInventoryCurrencyFilters();
}

// Populate inv-currency and filter-inv-currency dropdowns dynamically based on database active states
function populateInventoryCurrencyFilters() {
    const db = getDB();
    const invCurrency = document.getElementById("inv-currency");
    const filterCurrency = document.getElementById("filter-inv-currency");
    if (!invCurrency) return;

    const savedInvCurr = invCurrency.value;
    const savedFilterCurr = filterCurrency ? filterCurrency.value : "ALL";

    const activeCurrencies = db.currencies || {};
    const hasUSD = activeCurrencies["USD"] ? activeCurrencies["USD"].status === "ACTIVE" : true;
    const hasEUR = activeCurrencies["EUR"] ? activeCurrencies["EUR"].status === "ACTIVE" : true;
    const hasNGN = activeCurrencies["NGN"] ? activeCurrencies["NGN"].status === "ACTIVE" : true;

    // Populate inv-currency select dropdown
    let invHtml = "";
    if (hasUSD) {
        invHtml += `
            <option value="USD">USD ($)</option>
            <option value="CAD">CAD ($)</option>
            <option value="AUD">AUD ($)</option>
        `;
    }
    if (hasEUR) {
        invHtml += `
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
        `;
    }
    if (hasNGN) {
        invHtml += `<option value="NGN">NGN (₦)</option>`;
    }
    Object.keys(activeCurrencies).forEach(code => {
        if (!["USD", "EUR", "NGN", "CAD", "AUD", "GBP"].includes(code)) {
            if (activeCurrencies[code].status === "ACTIVE") {
                invHtml += `<option value="${code}">${code}</option>`;
            }
        }
    });
    invCurrency.innerHTML = invHtml;
    if (savedInvCurr && Array.from(invCurrency.options).some(o => o.value === savedInvCurr)) {
        invCurrency.value = savedInvCurr;
    }

    // Populate filter-inv-currency select dropdown
    if (filterCurrency) {
        let filterHtml = `<option value="ALL">All Currencies</option>`;
        if (hasUSD) {
            filterHtml += `
                <option value="USD">USD ($)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
            `;
        }
        if (hasEUR) {
            filterHtml += `
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
            `;
        }
        if (hasNGN) {
            filterHtml += `<option value="NGN">NGN (₦)</option>`;
        }
        Object.keys(activeCurrencies).forEach(code => {
            if (!["USD", "EUR", "NGN", "CAD", "AUD", "GBP"].includes(code)) {
                if (activeCurrencies[code].status === "ACTIVE") {
                    filterHtml += `<option value="${code}">${code}</option>`;
                }
            }
        });
        filterCurrency.innerHTML = filterHtml;
        if (savedFilterCurr && Array.from(filterCurrency.options).some(o => o.value === savedFilterCurr)) {
            filterCurrency.value = savedFilterCurr;
        }
    }
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

// RENDER CURRENCY REGISTRY LIST
function renderCurrencyManager() {
    const db = getDB();
    const tbody = document.getElementById("admin-currencies-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const currencies = db.currencies || {};
    
    Object.keys(currencies).forEach(code => {
        const c = currencies[code];
        const tr = document.createElement("tr");
        
        tr.style.borderBottom = "1px solid var(--border-color)";
        tr.style.height = "46px";
        
        const flagHTML = getCountryFlagEmoji(code);
        const flagEmoji = flagHTML.split(" ")[0] || "🌐";
        
        const statusBadge = c.status === "ACTIVE" 
            ? `<span class="currency-pill-badge currency-pill-badge-active" onclick="toggleCurrencyStatus('${code}')">Active</span>`
            : `<span class="currency-pill-badge currency-pill-badge-disabled" onclick="toggleCurrencyStatus('${code}')">Disabled</span>`;
            
        tr.innerHTML = `
            <td style="width: 20%; text-align: left; vertical-align: middle; padding: 10px 12px; white-space: nowrap;">
                <span style="font-size: 1.05rem; margin-right: 6px; vertical-align: middle;">${flagEmoji}</span>
                <strong style="font-family: monospace; font-size: 0.88rem; vertical-align: middle; color: var(--text-primary);">${c.code}</strong>
            </td>
            <td style="width: 30%; text-align: left; vertical-align: middle; padding: 10px 12px; font-weight: 500; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${c.name}">
                ${c.name}
            </td>
            <td style="width: 20%; text-align: right; vertical-align: middle; padding: 10px 12px; font-weight: 700; font-family: monospace; color: var(--text-primary); white-space: nowrap;">
                ₦${c.rate.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </td>
            <td style="width: 15%; text-align: center; vertical-align: middle; padding: 10px 12px; white-space: nowrap;">
                ${statusBadge}
            </td>
            <td style="width: 15%; text-align: center; vertical-align: middle; padding: 10px 12px; white-space: nowrap;">
                <div style="display: flex; gap: 6px; justify-content: center; align-items: center; white-space: nowrap;">
                    <button class="currency-action-btn" onclick="editCurrencyRate('${code}')" title="Edit Currency"><i class="fas fa-pen" style="font-size: 0.7rem;"></i></button>
                    <button class="currency-action-btn btn-delete" onclick="deleteCurrency('${code}')" title="Delete Currency"><i class="fas fa-trash-can" style="font-size: 0.7rem;"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// HANDLE ADD NEW CURRENCY FORM ACTION
function handleAddCurrency(e) {
    e.preventDefault();
    const code = document.getElementById("add-curr-code").value.trim().toUpperCase();
    const name = document.getElementById("add-curr-name").value.trim();
    const rate = parseFloat(document.getElementById("add-curr-rate").value);
    const status = document.getElementById("add-curr-status").value;
    
    if (code.length !== 3) {
        showToast("Currency Code must be exactly 3 characters.", "danger");
        return;
    }
    if (isNaN(rate) || rate <= 0) {
        showToast("Base Exchange Rate must be a positive non-zero number.", "danger");
        return;
    }
    
    const db = getDB();
    if (db.currencies && db.currencies[code]) {
        showToast(`Currency code ${code} already exists.`, "danger");
        return;
    }
    
    db.currencies[code] = { code, name, rate, status };
    
    // Log audit trail
    writeAuditLog(
        currentAdmin.email,
        "Currency Created",
        `Created Currency: ${code} (${name}) with rate ₦${rate.toLocaleString()} and status ${status}`
    );
    
    // Record in rate history
    if (!db.currencyHistory) db.currencyHistory = [];
    db.currencyHistory.unshift({
        currency: code,
        oldRate: rate,
        newRate: rate,
        operator: currentAdmin.email,
        timestamp: new Date().toISOString()
    });
    
    // Initialize default brand rates for this currency
    Object.keys(db.settings.rates).forEach(brand => {
        db.settings.rates[brand][code] = rate; // Default card rate matches base rate
    });
    
    saveDB(db);
    showToast(`Currency ${code} added successfully!`, "success");
    
    // Reset form
    document.getElementById("admin-add-currency-form").reset();
    
    // Refresh views
    loadAdminSession();
}

// TOGGLE CURRENCY ENABLE/DISABLE STATUS
function toggleCurrencyStatus(code) {
    const db = getDB();
    if (!db.currencies || !db.currencies[code]) return;
    
    const currentStatus = db.currencies[code].status;
    const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
    db.currencies[code].status = newStatus;
    
    writeAuditLog(
        currentAdmin.email,
        "Currency Status Toggled",
        `Currency: ${code} status changed from ${currentStatus} to ${newStatus}`
    );
    
    saveDB(db);
    showToast(`Currency ${code} is now ${newStatus.toLowerCase()}.`, "success");
    loadAdminSession();
}

// EDIT BASE EXCHANGE RATE & NAME
function editCurrencyRate(code) {
    const db = getDB();
    if (!db.currencies || !db.currencies[code]) return;
    
    const c = db.currencies[code];
    
    const newName = prompt(`Enter new name for ${code} (currently: ${c.name}):`, c.name);
    if (newName === null) return; // cancelled
    const cleanName = newName.trim();
    if (cleanName === "") {
        showToast("Currency Name cannot be empty.", "danger");
        return;
    }
    
    const newRateStr = prompt(`Enter new base rate in NGN for ${code} (currently: ${c.rate}):`, c.rate);
    if (newRateStr === null) return; // cancelled
    const newRate = parseFloat(newRateStr);
    if (isNaN(newRate) || newRate <= 0) {
        showToast("Base Exchange Rate must be a positive non-zero number.", "danger");
        return;
    }
    
    const oldRate = c.rate;
    
    // Apply edits
    c.name = cleanName;
    c.rate = newRate;
    db.currencies[code] = c;
    
    // Directly synchronize all card rates matching this currency
    Object.keys(db.settings.rates).forEach(brand => {
        if (!db.settings.rates[brand]) db.settings.rates[brand] = {};
        db.settings.rates[brand][code] = newRate;
        
        // Propagate matching sub-regions
        if (code === "USD") {
            db.settings.rates[brand]["USA"] = newRate;
        } else if (code === "EUR") {
            db.settings.rates[brand]["Europe (EUR)"] = newRate;
            db.settings.rates[brand]["Germany"] = newRate;
            db.settings.rates[brand]["France"] = newRate;
            db.settings.rates[brand]["Italy"] = newRate;
            db.settings.rates[brand]["Spain"] = newRate;
            db.settings.rates[brand]["Netherlands"] = newRate;
        } else if (code === "GBP") {
            db.settings.rates[brand]["UK"] = newRate;
        } else if (code === "CAD") {
            db.settings.rates[brand]["Canada"] = newRate;
        } else if (code === "AUD") {
            db.settings.rates[brand]["Australia"] = newRate;
        } else if (code === "CHF") {
            db.settings.rates[brand]["Switzerland (CHF)"] = newRate;
        } else if (code === "SGD") {
            db.settings.rates[brand]["Singapore (SGD)"] = newRate;
        } else if (code === "NZD") {
            db.settings.rates[brand]["New Zealand (NZD)"] = newRate;
        } else if (code === "AED") {
            db.settings.rates[brand]["UAE (AED)"] = newRate;
        } else if (code === "SAR") {
            db.settings.rates[brand]["Saudi Arabia (SAR)"] = newRate;
        } else if (code === "ZAR") {
            db.settings.rates[brand]["South Africa (ZAR)"] = newRate;
        } else if (code === "CNY") {
            db.settings.rates[brand]["China (CNY)"] = newRate;
        } else if (code === "HKD") {
            db.settings.rates[brand]["Hong Kong (HKD)"] = newRate;
        } else if (code === "JPY") {
            db.settings.rates[brand]["Japan (JPY)"] = newRate;
        } else if (code === "INR") {
            db.settings.rates[brand]["India (INR)"] = newRate;
        }
    });
    
    // Record in rate history
    if (!db.currencyHistory) db.currencyHistory = [];
    db.currencyHistory.unshift({
        currency: code,
        oldRate: oldRate,
        newRate: newRate,
        operator: currentAdmin.email,
        timestamp: new Date().toISOString()
    });
    
    writeAuditLog(
        currentAdmin.email,
        "Currency Rate Updated",
        `Updated base rate for ${code} from ₦${oldRate} to ₦${newRate}. Scaled all card presets.`
    );
    
    saveDB(db);
    showToast(`Base rate for ${code} updated to ₦${newRate.toLocaleString()} successfully!`, "success");
    loadAdminSession();
}

// DELETE CURRENCY
function deleteCurrency(code) {
    if (code === "USD" || code === "EUR" || code === "NGN") {
        showToast(`Base system currency ${code} cannot be deleted.`, "danger");
        return;
    }
    
    if (!confirm(`Are you sure you want to delete the currency ${code}? This will remove it from all calculator options.`)) {
        return;
    }
    
    const db = getDB();
    if (!db.currencies || !db.currencies[code]) return;
    
    delete db.currencies[code];
    
    // Clean up settings rates
    Object.keys(db.settings.rates).forEach(brand => {
        if (db.settings.rates[brand]) {
            delete db.settings.rates[brand][code];
        }
    });
    
    writeAuditLog(
        currentAdmin.email,
        "Currency Deleted",
        `Deleted Currency: ${code}`
    );
    
    saveDB(db);
    showToast(`Currency ${code} deleted successfully.`, "success");
    loadAdminSession();
}

// RENDER RATES HISTORY TABLE
function renderRatesHistoryTable() {
    const db = getDB();
    const tbody = document.getElementById("admin-rates-history-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const history = db.currencyHistory || [];
    
    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-muted);">No currency rate updates recorded.</td></tr>`;
        return;
    }
    
    history.forEach(log => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-size: 0.8rem; color: var(--text-secondary);">${new Date(log.timestamp).toLocaleString()}</td>
            <td><strong>${log.currency}</strong></td>
            <td class="text-right" style="text-align: right;">₦${log.oldRate.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="text-right" style="text-align: right; font-weight:700; color:var(--accent);">₦${log.newRate.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td><code>${log.operator}</code></td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// HELP & SUPPORT SYSTEM MODULE (ADMIN LOGIC)
// ==========================================

let activeAdminTicketId = null;
let adminChatFilename = "";
let adminChatBase64 = "";
let knownTicketIds = []; // Track known tickets to trigger new ticket notifications
let adminTypingTimeout = null;

// Render statistics indicators on support manager dashboard
function renderSupportAnalytics() {
    const db = getDB();
    const tickets = db.tickets || [];
    
    const total = tickets.length;
    const open = tickets.filter(t => ["OPEN", "PENDING", "IN_PROGRESS"].includes(t.status)).length;
    
    // Resolved today (resolved/closed status with updated date matching today)
    const todayStr = new Date().toDateString();
    const resolvedToday = tickets.filter(t => {
        const isResolved = ["RESOLVED", "CLOSED"].includes(t.status);
        const isToday = new Date(t.updatedAt).toDateString() === todayStr;
        return isResolved && isToday;
    }).length;
    
    const bugs = tickets.filter(t => t.category === "Report Bug").length;
    const fraud = tickets.filter(t => t.category === "Security Center (Fraud/Suspicious)").length;
    
    const totalEl = document.getElementById("stat-total-tickets");
    if (totalEl) totalEl.textContent = total;
    const openEl = document.getElementById("stat-open-tickets");
    if (openEl) openEl.textContent = open;
    const resolvedEl = document.getElementById("stat-resolved-today");
    if (resolvedEl) resolvedEl.textContent = resolvedToday;
    const bugsEl = document.getElementById("stat-bugs-reported");
    if (bugsEl) bugsEl.textContent = bugs;
    const fraudEl = document.getElementById("stat-fraud-reports");
    if (fraudEl) fraudEl.textContent = fraud;
}

// Handle filters change
function onAdminTicketFilterChange() {
    renderAdminTicketsQueue();
}

// Centered Status Badge Generator
function getTicketStatusBadgeHtml(status) {
    let bg = "";
    let color = "";
    let border = "";
    if (status === "OPEN") {
        bg = "rgba(16, 185, 129, 0.1)"; // Green 🟢
        color = "#10b981";
        border = "rgba(16, 185, 129, 0.25)";
    } else if (status === "PENDING") {
        bg = "rgba(245, 158, 11, 0.1)"; // Yellow 🟡
        color = "#f59e0b";
        border = "rgba(245, 158, 11, 0.25)";
    } else if (status === "IN_PROGRESS") {
        bg = "rgba(59, 130, 246, 0.1)"; // Blue 🔵
        color = "#3b82f6";
        border = "rgba(59, 130, 246, 0.25)";
    } else if (status === "ESCALATED") {
        bg = "rgba(139, 92, 246, 0.1)"; // Purple 🟣
        color = "#8b5cf6";
        border = "rgba(139, 92, 246, 0.25)";
    } else if (status === "RESOLVED") {
        bg = "rgba(20, 184, 166, 0.1)"; // Teal ✅
        color = "#20b8a6";
        border = "rgba(20, 184, 166, 0.25)";
    } else {
        bg = "rgba(156, 163, 175, 0.1)"; // Gray ⚫
        color = "#9ca3af";
        border = "rgba(156, 163, 175, 0.25)";
    }
    return `<span class="currency-pill-badge" style="background: ${bg}; color: ${color}; border: 1px solid ${border}; font-size: 0.72rem; padding: 2px 8px; border-radius: 50px; font-weight: 700; display: inline-block;">${status}</span>`;
}

// Render left column tickets resolution queue list
function renderAdminTicketsQueue() {
    const db = getDB();
    const container = document.getElementById("admin-tickets-queue-container");
    if (!container) return;
    container.innerHTML = "";
    
    const tickets = db.tickets || [];
    
    const searchEl = document.getElementById("admin-ticket-search");
    const searchQuery = searchEl ? searchEl.value.toLowerCase().trim() : "";
    
    const statusEl = document.getElementById("admin-ticket-status-filter");
    const statusFilter = statusEl ? statusEl.value : "ALL";
    
    const categoryEl = document.getElementById("admin-ticket-category-filter");
    const categoryFilter = categoryEl ? categoryEl.value : "ALL";
    
    const priorityEl = document.getElementById("admin-ticket-priority-filter");
    const priorityFilter = priorityEl ? priorityEl.value : "ALL";

    const assigneeEl = document.getElementById("admin-ticket-assignee-filter");
    const assigneeFilter = assigneeEl ? assigneeEl.value : "ALL";
    
    const startEl = document.getElementById("admin-ticket-date-start");
    const startDate = startEl && startEl.value ? new Date(startEl.value) : null;
    
    const endEl = document.getElementById("admin-ticket-date-end");
    const endDate = endEl && endEl.value ? new Date(endEl.value) : null;
    if (endDate) {
        endDate.setHours(23, 59, 59, 999);
    }
    
    const filteredTickets = tickets.filter(t => {
        // Exclude archived tickets unless status filter explicitly sets ARCHIVED
        if (t.status === "ARCHIVED" && statusFilter !== "ARCHIVED" && statusFilter !== "ALL") return false;
        
        // Search matches (Ticket ID, Title, User email, or User Name)
        const userObj = db.users[t.userId] || {};
        const userName = userObj.name ? userObj.name.toLowerCase() : "";
        const matchesSearch = t.id.toLowerCase().includes(searchQuery) || 
                              t.title.toLowerCase().includes(searchQuery) || 
                              (t.userId && t.userId.toLowerCase().includes(searchQuery)) ||
                              userName.includes(searchQuery);
                              
        // Filters
        const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
        const matchesCategory = categoryFilter === "ALL" || t.category === categoryFilter;
        const matchesPriority = priorityFilter === "ALL" || t.priority === priorityFilter;
        const matchesAssignee = assigneeFilter === "ALL" || (t.assignedTo || "Unassigned") === assigneeFilter;
        
        // Date range match
        let matchesDate = true;
        if (t.createdAt) {
            const ticketDate = new Date(t.createdAt);
            if (startDate && ticketDate < startDate) matchesDate = false;
            if (endDate && ticketDate > endDate) matchesDate = false;
        }
        
        return matchesSearch && matchesStatus && matchesCategory && matchesPriority && matchesDate && matchesAssignee;
    });
    
    if (filteredTickets.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">No tickets match filters.</div>`;
        return;
    }
    
    filteredTickets.forEach(t => {
        const card = document.createElement("div");
        card.className = "admin-ticket-card" + (t.id === activeAdminTicketId ? " active" : "");
        card.onclick = () => selectAdminTicket(t.id);
        
        // Priority Badge styling
        let priorityStyle = "";
        if (t.priority === "CRITICAL") priorityStyle = "background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);";
        else if (t.priority === "HIGH") priorityStyle = "background: rgba(245, 158, 11, 0.1); color: #f59e0b;";
        else if (t.priority === "MEDIUM") priorityStyle = "background: rgba(59, 130, 246, 0.1); color: #3b82f6;";
        else priorityStyle = "background: rgba(156, 163, 175, 0.1); color: #9ca3af;";
        
        const priorityBadge = `<span class="ticket-priority-badge" style="${priorityStyle}">${t.priority}</span>`;
        const statusBadge = getTicketStatusBadgeHtml(t.status);
        
        const userObj = db.users[t.userId] || {};
        const userName = userObj.name || "Unregistered User";
        
        // Displaying unread messages count or active dot
        const unreadBadge = t.adminUnread 
            ? `<span style="background: var(--primary); color: #ffffff; font-size: 0.68rem; font-weight: 800; border-radius: 20px; padding: 2px 8px; margin-left: auto;">New</span>` 
            : "";
            
        const lastActStr = new Date(t.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        card.innerHTML = `
            <div style="display:flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
                <span style="font-family: monospace; font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">${t.id}</span>
                <span style="font-size: 0.68rem; color: var(--text-secondary);">${lastActStr}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <strong style="font-size: 0.9rem; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 100%; display:block;">${userName}</strong>
                <span style="font-size: 0.78rem; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 100%; display:block;">${t.title}</span>
            </div>
            <div style="display:flex; gap: 8px; align-items:center; margin-top: 4px; flex-wrap: wrap;">
                ${priorityBadge}
                ${statusBadge}
                <span style="font-size: 0.7rem; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${t.category}</span>
                ${unreadBadge}
            </div>
        `;
        container.appendChild(card);
    });
}

// Select ticket to inspect and respond
function selectAdminTicket(ticketId) {
    const db = getDB();
    const ticketIndex = (db.tickets || []).findIndex(t => t.id === ticketId);
    if (ticketIndex === -1) return;
    
    const t = db.tickets[ticketIndex];
    activeAdminTicketId = ticketId;
    
    // Clear adminUnread status
    if (t.adminUnread) {
        db.tickets[ticketIndex].adminUnread = false;
        saveDB(db);
        updateAdminSupportBadge();
    }
    
    // Display panels
    const placeholder = document.getElementById("admin-support-chat-placeholder");
    if (placeholder) placeholder.style.display = "none";
    const chatBoard = document.getElementById("admin-support-chat-board");
    if (chatBoard) chatBoard.style.display = "flex";
    
    // Header labels
    const titleEl = document.getElementById("admin-chat-ticket-title");
    if (titleEl) titleEl.textContent = t.title || "";
    const idEl = document.getElementById("admin-chat-ticket-id");
    if (idEl) idEl.textContent = t.id;
    const userEl = document.getElementById("admin-chat-ticket-user");
    if (userEl) userEl.textContent = t.userId || "";
    
    const categoryEl = document.getElementById("admin-chat-ticket-category");
    if (categoryEl) {
        categoryEl.textContent = t.category || "";
    }
    
    const priorityEl = document.getElementById("admin-chat-ticket-priority");
    if (priorityEl) {
        priorityEl.className = "ticket-priority-badge priority-" + (t.priority ? t.priority.toLowerCase() : "medium");
        priorityEl.textContent = t.priority || "MEDIUM";
    }
    
    // Setup select drop downs in sidebar
    const statusEl = document.getElementById("admin-ticket-status");
    if (statusEl) statusEl.value = t.status || "OPEN";
    const assigneeEl = document.getElementById("admin-ticket-assignee");
    if (assigneeEl) assigneeEl.value = t.assignedTo || "Unassigned";
    
    // Populate details sidebar inspector panel
    const detId = document.getElementById("det-ticket-id");
    if (detId) detId.textContent = t.id;
    
    const detCreated = document.getElementById("det-ticket-created");
    if (detCreated) detCreated.textContent = new Date(t.createdAt).toLocaleString();
    
    const detLastReply = document.getElementById("det-ticket-last-reply");
    if (detLastReply) {
        if (t.messages && t.messages.length > 0) {
            const lastMsg = t.messages[t.messages.length - 1];
            detLastReply.textContent = new Date(lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } else {
            detLastReply.textContent = "No messages";
        }
    }
    
    const detResponse = document.getElementById("det-ticket-response-time");
    if (detResponse) {
        const firstAdminReply = t.messages.find(m => m.sender === "ADMIN");
        if (firstAdminReply) {
            const diffMs = new Date(firstAdminReply.timestamp) - new Date(t.createdAt);
            const diffMins = Math.round(diffMs / 60000);
            detResponse.textContent = `${diffMins} mins`;
        } else {
            detResponse.textContent = "N/A";
        }
    }
    
    const user = db.users[t.userId];
    const detName = document.getElementById("det-user-name");
    const detEmail = document.getElementById("det-user-email");
    const detPhone = document.getElementById("det-user-phone");
    const detBalance = document.getElementById("det-user-balance");
    const detAvatar = document.getElementById("det-user-avatar");
    const detStatus = document.getElementById("det-user-status");
    const detKyc = document.getElementById("det-user-kyc");
    const detRegistered = document.getElementById("det-user-registered");
    const detLastLogin = document.getElementById("det-user-lastlogin");
    const ticketHistoryList = document.getElementById("admin-detail-ticket-history-list");
    
    if (user) {
        if (detName) detName.textContent = user.name || "Unknown";
        if (detEmail) {
            detEmail.textContent = user.email || t.userId;
            detEmail.title = user.email || t.userId;
        }
        if (detPhone) detPhone.textContent = user.phone || "-";
        if (detBalance) detBalance.textContent = "₦" + (user.wallet.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2});
        
        // Avatar circle
        if (detAvatar) {
            detAvatar.textContent = user.name ? user.name[0].toUpperCase() : "U";
        }
        
        // KYC Verification Status
        if (detKyc) {
            const isKycVerified = user.kycStatus === "VERIFIED" || user.kycVerified;
            detKyc.textContent = isKycVerified ? "Verified" : "Unverified";
            detKyc.style.color = isKycVerified ? "var(--success)" : "var(--danger)";
        }
        
        // Account status
        if (detStatus) {
            const statusText = user.status || "ACTIVE";
            detStatus.textContent = statusText;
            detStatus.className = "badge " + (statusText === "ACTIVE" ? "badge-success" : "badge-danger");
        }
        
        // Registration Date
        if (detRegistered) {
            detRegistered.textContent = user.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : "N/A";
        }
        
        // Last Login
        if (detLastLogin) {
            detLastLogin.textContent = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never";
        }
    } else {
        if (detName) detName.textContent = "Unregistered Customer";
        if (detEmail) {
            detEmail.textContent = t.userId;
            detEmail.title = t.userId;
        }
        if (detPhone) detPhone.textContent = "-";
        if (detBalance) detBalance.textContent = "₦0.00";
        if (detAvatar) detAvatar.textContent = "U";
        if (detKyc) {
            detKyc.textContent = "Unverified";
            detKyc.style.color = "var(--danger)";
        }
        if (detStatus) {
            detStatus.textContent = "ACTIVE";
            detStatus.className = "badge badge-success";
        }
        if (detRegistered) detRegistered.textContent = "N/A";
        if (detLastLogin) detLastLogin.textContent = "Never";
    }
    
    // Ticket History List
    if (ticketHistoryList) {
        ticketHistoryList.innerHTML = "";
        const userTickets = (db.tickets || []).filter(tk => tk.userId === t.userId && tk.id !== t.id);
        if (userTickets.length === 0) {
            ticketHistoryList.innerHTML = `<span style="font-size:0.75rem; color:var(--text-muted);">No prior tickets.</span>`;
        } else {
            userTickets.forEach(ut => {
                const histItem = document.createElement("div");
                histItem.style.display = "flex";
                histItem.style.justifyContent = "space-between";
                histItem.style.alignItems = "center";
                histItem.style.fontSize = "0.75rem";
                histItem.style.padding = "4px 0";
                histItem.style.borderBottom = "1px dashed rgba(255,255,255,0.03)";
                histItem.innerHTML = `
                    <span style="color:var(--primary); cursor:pointer; font-weight:600;" onclick="selectAdminTicket('${ut.id}')">${ut.id}</span>
                    <span style="color:var(--text-secondary); max-width: 140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ut.title}</span>
                    <span>${getTicketStatusBadgeHtml(ut.status)}</span>
                `;
                ticketHistoryList.appendChild(histItem);
            });
        }
    }
    
    // Sidebar attachments lists
    const attachTitle = document.getElementById("det-attach-title");
    const attachList = document.getElementById("admin-detail-ticket-attachments-list");
    if (attachList) {
        attachList.innerHTML = "";
        
        if (t.attachments && t.attachments.length > 0) {
            if (attachTitle) attachTitle.style.display = "block";
            t.attachments.forEach(file => {
                const btn = document.createElement("a");
                btn.href = file.data;
                btn.download = file.name;
                btn.className = "btn btn-secondary btn-sm";
                btn.style.display = "flex";
                btn.style.alignItems = "center";
                btn.style.gap = "8px";
                btn.style.fontSize = "0.75rem";
                btn.style.width = "100%";
                btn.innerHTML = `<i class="fas fa-download"></i> ${file.name}`;
                attachList.appendChild(btn);
            });
        } else {
            if (attachTitle) attachTitle.style.display = "none";
        }
    }
    
    // Render messages feed list
    renderAdminChatMessages(t);
    
    // Highlight active list card
    renderAdminTicketsQueue();
}

// Action Bar Helper Triggers
function copyTicketIdToClipboard() {
    if (!activeAdminTicketId) return;
    navigator.clipboard.writeText(activeAdminTicketId).then(() => {
        showToast(`Copied Ticket ID: ${activeAdminTicketId}`, "success");
    });
}

function btnReopenTicket() {
    if (!activeAdminTicketId) return;
    const db = getDB();
    const idx = db.tickets.findIndex(t => t.id === activeAdminTicketId);
    if (idx === -1) return;
    const t = db.tickets[idx];
    if (t.status === "OPEN" || t.status === "IN_PROGRESS") {
        showToast("Ticket is already active.", "info");
        return;
    }
    const oldStatus = t.status;
    t.status = "OPEN";
    t.updatedAt = new Date().toISOString();
    t.messages.push({
        sender: "SYSTEM",
        senderEmail: "system",
        text: `Ticket reopened by Admin (Previous: ${oldStatus}).`,
        timestamp: new Date().toISOString()
    });
    saveDB(db);
    
    if (typeof supabaseUpdateTicketMeta === "function") {
        supabaseUpdateTicketMeta(activeAdminTicketId, { status: "OPEN", userUnread: true });
    }
    if (typeof supabasePushTicketMessage === "function") {
        const lastMsg = t.messages[t.messages.length - 1];
        supabasePushTicketMessage(activeAdminTicketId, lastMsg);
    }
    
    writeAuditLog(currentAdmin.email, "Support Ticket Reopened", `Reopened ticket ${activeAdminTicketId}`);
    showToast("Ticket reopened successfully.", "success");
    selectAdminTicket(activeAdminTicketId);
    renderAdminTicketsQueue();
}

function btnEscalateTicket() {
    if (!activeAdminTicketId) return;
    const db = getDB();
    const idx = db.tickets.findIndex(t => t.id === activeAdminTicketId);
    if (idx === -1) return;
    const t = db.tickets[idx];
    if (t.status === "ESCALATED") {
        showToast("Ticket is already escalated.", "info");
        return;
    }
    const oldStatus = t.status;
    t.status = "ESCALATED";
    t.updatedAt = new Date().toISOString();
    t.messages.push({
        sender: "SYSTEM",
        senderEmail: "system",
        text: `Ticket escalated to Senior Support Tier by Admin.`,
        timestamp: new Date().toISOString()
    });
    saveDB(db);
    
    if (typeof supabaseUpdateTicketMeta === "function") {
        supabaseUpdateTicketMeta(activeAdminTicketId, { status: "ESCALATED", userUnread: true });
    }
    if (typeof supabasePushTicketMessage === "function") {
        const lastMsg = t.messages[t.messages.length - 1];
        supabasePushTicketMessage(activeAdminTicketId, lastMsg);
    }
    
    writeAuditLog(currentAdmin.email, "Support Ticket Escalated", `Escalated ticket ${activeAdminTicketId}`);
    showToast("Ticket escalated successfully.", "success");
    selectAdminTicket(activeAdminTicketId);
    renderAdminTicketsQueue();
}

function btnAddInternalNote() {
    if (!activeAdminTicketId) return;
    const noteText = prompt("Enter internal note content (visible only to support staff):");
    if (noteText === null) return;
    if (!noteText.trim()) {
        showToast("Internal note content cannot be empty.", "danger");
        return;
    }
    const db = getDB();
    const idx = db.tickets.findIndex(t => t.id === activeAdminTicketId);
    if (idx === -1) return;
    const t = db.tickets[idx];
    t.messages.push({
        sender: "INTERNAL_NOTE",
        senderEmail: currentAdmin.email,
        text: noteText.trim(),
        timestamp: new Date().toISOString()
    });
    t.updatedAt = new Date().toISOString();
    saveDB(db);
    
    if (typeof supabaseUpdateTicketMeta === "function") {
        supabaseUpdateTicketMeta(activeAdminTicketId, {});
    }
    if (typeof supabasePushTicketMessage === "function") {
        const lastMsg = t.messages[t.messages.length - 1];
        supabasePushTicketMessage(activeAdminTicketId, lastMsg);
    }
    
    showToast("Internal note added successfully.", "success");
    selectAdminTicket(activeAdminTicketId);
}

function btnInspectCustomer() {
    if (!activeAdminTicketId) return;
    const db = getDB();
    const t = db.tickets.find(tk => tk.id === activeAdminTicketId);
    if (t) {
        inspectUserProfile(t.userId);
    }
}

function btnCustomerTxHistory() {
    if (!activeAdminTicketId) return;
    const db = getDB();
    const t = db.tickets.find(tk => tk.id === activeAdminTicketId);
    if (t) {
        inspectUserProfile(t.userId);
        toggleInspectTab("logs");
    }
}

function btnDownloadConversation() {
    if (!activeAdminTicketId) return;
    const db = getDB();
    const t = db.tickets.find(tk => tk.id === activeAdminTicketId);
    if (!t) return;
    const textContent = t.messages.map(m => {
        const date = new Date(m.timestamp).toLocaleString();
        if (m.sender === "SYSTEM") return `[${date}] SYSTEM: ${m.text}`;
        if (m.sender === "INTERNAL_NOTE") return `[${date}] INTERNAL NOTE (by ${m.senderEmail}): ${m.text}`;
        return `[${date}] ${m.sender === "USER" ? "Customer" : "Admin"}: ${m.text}`;
    }).join("\n");
    const header = `Ticket Report\nID: ${t.id}\nTitle: ${t.title}\nUser: ${t.userId}\nCategory: ${t.category}\nPriority: ${t.priority}\nStatus: ${t.status}\nCreated: ${new Date(t.createdAt).toLocaleString()}\n\n`;
    const blob = new Blob([header + textContent], {type: "text/plain;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${t.id}_transcript.txt`;
    a.click();
    showToast("Conversation transcript downloaded.", "success");
}

function btnPrintTicket() {
    if (!activeAdminTicketId) return;
    const db = getDB();
    const t = db.tickets.find(tk => tk.id === activeAdminTicketId);
    if (!t) return;
    const printWindow = window.open("", "_blank");
    const messagesHtml = t.messages.map(m => {
        const date = new Date(m.timestamp).toLocaleString();
        let senderLabel = m.sender;
        let color = "#fff";
        if (m.sender === "USER") {
            senderLabel = "Customer";
            color = "#10b981";
        } else if (m.sender === "ADMIN") {
            senderLabel = "Support Agent";
            color = "#3b82f6";
        } else if (m.sender === "SYSTEM") {
            senderLabel = "SYSTEM EVENT";
            color = "#f59e0b";
        } else if (m.sender === "INTERNAL_NOTE") {
            senderLabel = `INTERNAL NOTE (by ${m.senderEmail})`;
            color = "#c084fc";
        }
        return `<div style="margin-bottom: 12px; padding: 8px; border-left: 3px solid ${color};">
            <span style="font-size: 0.8rem; font-weight: 700; color: ${color};">${senderLabel}</span>
            <span style="font-size: 0.72rem; color: #94a3b8; margin-left: 8px;">${date}</span>
            <p style="margin: 4px 0 0 0; font-size: 0.9rem; line-height: 1.5;">${m.text}</p>
        </div>`;
    }).join("");
    
    printWindow.document.write(`
        <html>
        <head>
            <title>Print Ticket - ${t.id}</title>
            <style>
                body { font-family: sans-serif; background: #0f172a; color: #ffffff; padding: 40px; }
                h1 { margin-bottom: 4px; }
                hr { border: 1px solid #334155; margin: 20px 0; }
            </style>
        </head>
        <body>
            <h1>Ticket Transcript: ${t.id}</h1>
            <p><strong>Title:</strong> ${t.title}</p>
            <p><strong>Customer:</strong> ${t.userId}</p>
            <p><strong>Category:</strong> ${t.category} | <strong>Priority:</strong> ${t.priority} | <strong>Status:</strong> ${t.status}</p>
            <p><strong>Created:</strong> ${new Date(t.createdAt).toLocaleString()}</p>
            <hr>
            ${messagesHtml}
            <script>
                window.onload = function() { window.print(); window.close(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Collapsible User Context drawer toggle
function toggleAdminUserContextDrawer() {
    const drawer = document.getElementById("admin-user-context-drawer");
    const arrow = document.getElementById("admin-context-arrow");
    
    if (drawer.style.display === "none") {
        drawer.style.display = "block";
        arrow.style.transform = "rotate(180deg)";
    } else {
        drawer.style.display = "none";
        arrow.style.transform = "rotate(0deg)";
    }
}

// Load profile detail context inside the chat inspector panel drawer
function loadUserContextDrawer(email) {
    const db = getDB();
    const user = db.users[email];
    
    const nameEl = document.getElementById("context-user-name");
    const emailEl = document.getElementById("context-user-email");
    const statusEl = document.getElementById("context-user-status");
    const balanceEl = document.getElementById("context-user-balance");
    const pendingEl = document.getElementById("context-user-pending");
    const bankEl = document.getElementById("context-user-bank");
    const numberEl = document.getElementById("context-user-bank-number");
    const txBody = document.getElementById("context-user-tx-tbody");
    
    if (!user) {
        if (nameEl) nameEl.textContent = "Unknown User";
        if (emailEl) emailEl.textContent = email;
        if (statusEl) statusEl.innerHTML = `<span class="currency-pill-badge currency-pill-badge-disabled">UNREGISTERED</span>`;
        if (balanceEl) balanceEl.textContent = "₦0.00";
        if (pendingEl) pendingEl.textContent = "₦0.00";
        if (bankEl) bankEl.textContent = "N/A";
        if (numberEl) numberEl.textContent = "N/A";
        if (txBody) txBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); font-size:0.75rem; padding: 12px;">No transaction details found.</td></tr>`;
        return;
    }
    
    if (nameEl) nameEl.textContent = user.name || "";
    if (emailEl) emailEl.textContent = user.email || "";
    
    if (statusEl) {
        const verifiedBadge = user.status === "ACTIVE" 
            ? `<span class="currency-pill-badge currency-pill-badge-active"><i class="fas fa-circle-check"></i> Active</span>`
            : `<span class="currency-pill-badge currency-pill-badge-disabled">Disabled</span>`;
        statusEl.innerHTML = verifiedBadge;
    }
    
    if (balanceEl) balanceEl.textContent = "₦" + (user.wallet.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2});
    if (pendingEl) pendingEl.textContent = "₦" + (user.wallet.pendingBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2});
    
    if (user.bankDetails) {
        if (bankEl) bankEl.textContent = user.bankDetails.bankName || "Not Linked";
        if (numberEl) numberEl.textContent = user.bankDetails.accountNumber || "Not Linked";
    } else {
        if (bankEl) bankEl.textContent = "Not Linked";
        if (numberEl) numberEl.textContent = "Not Linked";
    }
    
    // Render dynamic transaction logs context (both card reviews and cash withdrawals)
    if (txBody) {
        txBody.innerHTML = "";
        const cardReviews = (db.submissions || []).filter(sub => sub.userId === email);
        const withdrawals = (db.withdrawals || []).filter(w => w.userId === email);
        
        const mergedTx = [];
        cardReviews.forEach(c => {
            mergedTx.push({
                id: c.id,
                type: `${c.brand} Sale`,
                amount: `$${c.amount}`,
                status: c.status,
                timestamp: c.createdAt
            });
        });
        withdrawals.forEach(w => {
            mergedTx.push({
                id: w.id,
                type: "Withdrawal",
                amount: `₦${w.amount.toLocaleString()}`,
                status: w.status,
                timestamp: w.createdAt
            });
        });
        
        // Sort transactions by date descending
        mergedTx.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (mergedTx.length === 0) {
            txBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); font-size:0.75rem; padding: 12px;">No transaction details found.</td></tr>`;
            return;
        }
        
        // Show only top 4 recent transactions
        mergedTx.slice(0, 4).forEach(tx => {
            const tr = document.createElement("tr");
            
            let statusClass = "currency-pill-badge-disabled";
            if (tx.status === "APPROVED" || tx.status === "COMPLETED" || tx.status === "SUCCESS") statusClass = "currency-pill-badge-active";
            else if (tx.status === "PENDING" || tx.status === "REVIEW") statusClass = "currency-pill-badge-disabled";
            
            tr.innerHTML = `
                <td style="font-family: monospace; font-size: 0.72rem; color: var(--text-secondary);">${tx.id}</td>
                <td style="font-size: 0.75rem; font-weight:700; color: var(--text-primary);">${tx.type}</td>
                <td style="font-size: 0.75rem; font-weight:700; color: var(--text-primary);">${tx.amount}</td>
                <td><span class="currency-pill-badge ${statusClass}">${tx.status}</span></td>
            `;
            txBody.appendChild(tr);
        });
    }
}

// Draw messages list inside admin inspector
function renderAdminChatMessages(ticket) {
    const feed = document.getElementById("admin-chat-messages-container");
    if (!feed) return;
    feed.innerHTML = "";
    
    const messages = ticket.messages || [];
    
    messages.forEach(msg => {
        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.alignItems = msg.sender === "ADMIN" ? "flex-end" : "flex-start";
        
        if (msg.sender === "SYSTEM") {
            const systemBubble = document.createElement("div");
            systemBubble.className = "chat-msg-system";
            systemBubble.textContent = msg.text;
            container.appendChild(systemBubble);
            feed.appendChild(container);
            return;
        }
        
        if (msg.sender === "INTERNAL_NOTE") {
            const noteBubble = document.createElement("div");
            noteBubble.className = "chat-msg-system";
            noteBubble.style.background = "rgba(245, 158, 11, 0.08)";
            noteBubble.style.color = "#f59e0b";
            noteBubble.style.border = "1px dashed rgba(245, 158, 11, 0.25)";
            noteBubble.style.padding = "10px 14px";
            noteBubble.style.borderRadius = "8px";
            noteBubble.style.margin = "8px 0";
            noteBubble.style.fontSize = "0.82rem";
            noteBubble.style.alignSelf = "stretch";
            noteBubble.innerHTML = `<i class="fas fa-clipboard-question"></i> <strong>INTERNAL NOTE (by ${msg.senderEmail}):</strong> ${msg.text}`;
            container.appendChild(noteBubble);
            feed.appendChild(container);
            return;
        }
        
        const bubble = document.createElement("div");
        bubble.className = "admin-chat-bubble " + (msg.sender === "ADMIN" ? "admin" : "customer");
        
        const senderName = msg.sender === "ADMIN" ? "You (Support)" : "Customer";
        const senderLabel = `<span style="font-size: 0.65rem; font-weight:700; margin-bottom: 4px; display:block; color: ${msg.sender === "ADMIN" ? "rgba(255,255,255,0.85)" : "var(--primary)"};">${senderName}</span>`;
        
        const textContent = `<p style="margin: 0; white-space: pre-wrap;">${msg.text || ""}</p>`;
        
        let attachmentHTML = "";
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach(file => {
                attachmentHTML += `
                    <div style="margin-top: 8px; border: 1px solid ${msg.sender === 'ADMIN' ? 'rgba(255,255,255,0.2)' : 'var(--border-color)'}; padding: 6px 10px; border-radius: 6px; background: ${msg.sender === 'ADMIN' ? 'rgba(255,255,255,0.06)' : 'var(--bg-tertiary)'}; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; color: ${msg.sender === 'ADMIN' ? 'white' : 'var(--text-primary)'};">${file.name}</span>
                        <a href="${file.data}" download="${file.name}" style="color: ${msg.sender === 'ADMIN' ? 'white' : 'var(--primary)'}; font-size: 0.8rem;"><i class="fas fa-download"></i></a>
                    </div>
                `;
            });
        }
        
        const timestampVal = msg.timestamp ? new Date(msg.timestamp) : new Date();
        const dateStr = timestampVal.toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit'
        });
        
        // Read Receipt Checkmarks
        let receiptHTML = "";
        if (msg.sender === "USER") {
            const isReadByAdmin = ticket.adminUnread === false;
            receiptHTML = isReadByAdmin 
                ? `<span class="admin-chat-receipt" style="color:#60a5fa; margin-left:6px;" title="Read"><i class="fas fa-check-double"></i></span>`
                : `<span class="admin-chat-receipt" style="color:var(--text-muted); margin-left:6px;" title="Sent"><i class="fas fa-check"></i></span>`;
        } else if (msg.sender === "ADMIN") {
            const isReadByUser = ticket.userUnread === false;
            receiptHTML = isReadByUser
                ? `<span class="admin-chat-receipt" style="color:#e0e7ff; margin-left:6px;" title="Read"><i class="fas fa-check-double"></i></span>`
                : `<span class="admin-chat-receipt" style="color:rgba(255,255,255,0.6); margin-left:6px;" title="Sent"><i class="fas fa-check"></i></span>`;
        }
        
        bubble.innerHTML = `
            ${senderLabel}
            ${textContent}
            ${attachmentHTML}
            <div style="display:flex; justify-content:flex-end; align-items:center;" class="admin-chat-time">
                <span>${dateStr}</span>
                ${receiptHTML}
            </div>
        `;
        
        container.appendChild(bubble);
        feed.appendChild(container);
    });
    
    // Auto scroll bottom
    feed.scrollTop = feed.scrollHeight;
}

// Attachment selection event
function handleAdminChatAttachmentSelect() {
    const input = document.getElementById("admin-chat-reply-attachment");
    const nameEl = document.getElementById("admin-chat-reply-filename");
    if (!input || !nameEl) return;
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 1.5 * 1024 * 1024) {
            showToast("Attachment file exceeds 1.5MB.", "danger");
            input.value = "";
            nameEl.textContent = "";
            return;
        }
        nameEl.textContent = file.name;
    }
}

// Admin typing hook listener
function handleAdminTyping() {
    if (!activeAdminTicketId) return;
    
    const db = getDB();
    const idx = (db.tickets || []).findIndex(t => t.id === activeAdminTicketId);
    if (idx !== -1) {
        db.tickets[idx].adminTyping = true;
        saveDB(db);
        
        window.dispatchEvent(new CustomEvent('goodfastpay_support_update', {
            detail: { ticketId: activeAdminTicketId, action: "TYPING_ADMIN" }
        }));
        
        clearTimeout(adminTypingTimeout);
        adminTypingTimeout = setTimeout(() => {
            const db2 = getDB();
            const idx2 = db2.tickets.findIndex(t => t.id === activeAdminTicketId);
            if (idx2 !== -1) {
                db2.tickets[idx2].adminTyping = false;
                saveDB(db2);
                window.dispatchEvent(new CustomEvent('goodfastpay_support_update', {
                    detail: { ticketId: activeAdminTicketId, action: "TYPING_ADMIN_STOP" }
                }));
            }
        }, 1500);
    }
}

// Textarea Auto-Resize and Send triggers
function handleAdminChatInputResize() {
    const textarea = document.getElementById("admin-chat-reply-input");
    if (!textarea) return;
    
    // Trigger typing notification updates
    handleAdminTyping();
    
    // Reset height to calculate scrollHeight accurately
    textarea.style.height = "120px";
    
    // Expand height if needed up to 160px
    const scrollHeight = textarea.scrollHeight;
    if (scrollHeight > 120) {
        textarea.style.height = Math.min(scrollHeight, 160) + "px";
    }
}

function handleAdminChatInputKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const form = document.getElementById("admin-chat-reply-form");
        if (form) {
            if (form.reportValidity()) {
                const fakeEvent = { preventDefault: () => {} };
                handleAdminChatReply(fakeEvent);
            }
        }
    }
}

// Handle reply from admin
function handleAdminChatReply(e) {
    e.preventDefault();
    if (!activeAdminTicketId || !currentAdmin) return;
    
    const replyInput = document.getElementById("admin-chat-reply-input");
    const fileInput = document.getElementById("admin-chat-reply-attachment");
    const filenameEl = document.getElementById("admin-chat-reply-filename");
    
    const text = replyInput.value.trim();
    if (text === "" && !fileInput.files[0]) return;
    
    const db = getDB();
    const ticketIndex = db.tickets.findIndex(t => t.id === activeAdminTicketId);
    if (ticketIndex === -1) return;
    
    const appendReply = () => {
        const newMsg = {
            sender: "ADMIN",
            senderEmail: currentAdmin.email,
            text: text || "Sent an attachment.",
            timestamp: new Date().toISOString(),
            attachments: adminChatBase64 ? [{ name: adminChatFilename, data: adminChatBase64 }] : []
        };
        
        db.tickets[ticketIndex].messages.push(newMsg);
        db.tickets[ticketIndex].updatedAt = new Date().toISOString();
        db.tickets[ticketIndex].userUnread = true; // Alerts user
        db.tickets[ticketIndex].adminTyping = false; // Stop typing
        
        // Auto mark as IN_PROGRESS if OPEN
        if (db.tickets[ticketIndex].status === "OPEN" || db.tickets[ticketIndex].status === "PENDING") {
            db.tickets[ticketIndex].status = "IN_PROGRESS";
        }
        
        saveDB(db);
        
        if (typeof supabasePushTicketMessage === "function") {
            supabasePushTicketMessage(activeAdminTicketId, newMsg);
        }
        if (typeof supabaseUpdateTicketMeta === "function") {
            supabaseUpdateTicketMeta(activeAdminTicketId, {
                status: db.tickets[ticketIndex].status,
                userUnread: true
            });
        }
        
        replyInput.value = "";
        replyInput.style.height = "120px"; // Reset height
        fileInput.value = "";
        filenameEl.textContent = "";
        adminChatFilename = "";
        adminChatBase64 = "";
        
        // Redraw
        renderAdminChatMessages(db.tickets[ticketIndex]);
        selectAdminTicket(activeAdminTicketId);
        renderSupportAnalytics();
        
        // Dispatch cross-tab sync
        window.dispatchEvent(new CustomEvent('goodfastpay_support_update', {
            detail: { ticketId: activeAdminTicketId, action: "REPLY_ADMIN" }
        }));
    };
    
    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(evt) {
            adminChatFilename = file.name;
            adminChatBase64 = evt.target.result;
            appendReply();
        };
        reader.readAsDataURL(file);
    } else {
        appendReply();
    }
}

// Update status select dropdown
function updateTicketStatus() {
    if (!activeAdminTicketId || !currentAdmin) return;
    const status = document.getElementById("admin-ticket-status").value;
    
    const db = getDB();
    const ticketIndex = db.tickets.findIndex(t => t.id === activeAdminTicketId);
    if (ticketIndex === -1) return;
    
    const oldStatus = db.tickets[ticketIndex].status;
    db.tickets[ticketIndex].status = status;
    db.tickets[ticketIndex].updatedAt = new Date().toISOString();
    db.tickets[ticketIndex].userUnread = true; // Alerts user
    
    // Also push a system alert into messages timeline
    db.tickets[ticketIndex].messages.push({
        sender: "SYSTEM",
        senderEmail: "system",
        text: `Ticket status updated from ${oldStatus} to ${status} by Support Staff.`,
        timestamp: new Date().toISOString()
    });
    
    writeAuditLog(
        currentAdmin.email,
        "Support Ticket Updated",
        `Changed ticket ${activeAdminTicketId} status from ${oldStatus} to ${status}`
    );
    
    saveDB(db);
    
    if (typeof supabaseUpdateTicketMeta === "function") {
        supabaseUpdateTicketMeta(activeAdminTicketId, { status: status, userUnread: true });
    }
    if (typeof supabasePushTicketMessage === "function") {
        const lastMsg = db.tickets[ticketIndex].messages[db.tickets[ticketIndex].messages.length - 1];
        supabasePushTicketMessage(activeAdminTicketId, lastMsg);
    }
    
    showToast(`Ticket status updated to ${status}.`, "success");
    selectAdminTicket(activeAdminTicketId);
    renderSupportAnalytics();
    
    window.dispatchEvent(new CustomEvent('goodfastpay_support_update', {
        detail: { ticketId: activeAdminTicketId, action: "STATUS_CHANGED" }
    }));
}

// Update assignee staff dropdown
function updateTicketAssignee() {
    if (!activeAdminTicketId || !currentAdmin) return;
    const assignee = document.getElementById("admin-ticket-assignee").value;
    
    const db = getDB();
    const ticketIndex = db.tickets.findIndex(t => t.id === activeAdminTicketId);
    if (ticketIndex === -1) return;
    
    const oldAssignee = db.tickets[ticketIndex].assignedTo || "Unassigned";
    db.tickets[ticketIndex].assignedTo = assignee;
    db.tickets[ticketIndex].updatedAt = new Date().toISOString();
    
    // Push system update alert into messages
    db.tickets[ticketIndex].messages.push({
        sender: "SYSTEM",
        senderEmail: "system",
        text: `Ticket assigned from ${oldAssignee} to ${assignee}.`,
        timestamp: new Date().toISOString()
    });
    
    writeAuditLog(
        currentAdmin.email,
        "Support Ticket Reassigned",
        `Changed ticket ${activeAdminTicketId} assignee from ${oldAssignee} to ${assignee}`
    );
    
    saveDB(db);
    
    if (typeof supabaseUpdateTicketMeta === "function") {
        supabaseUpdateTicketMeta(activeAdminTicketId, { assignedTo: assignee });
    }
    if (typeof supabasePushTicketMessage === "function") {
        const lastMsg = db.tickets[ticketIndex].messages[db.tickets[ticketIndex].messages.length - 1];
        supabasePushTicketMessage(activeAdminTicketId, lastMsg);
    }
    
    showToast(`Staff assignee set to ${assignee}.`, "success");
    selectAdminTicket(activeAdminTicketId);
    
    window.dispatchEvent(new CustomEvent('goodfastpay_support_update', {
        detail: { ticketId: activeAdminTicketId, action: "ASSIGNEE_CHANGED" }
    }));
}

// Archive Ticket
function handleArchiveTicket() {
    if (!activeAdminTicketId || !currentAdmin) return;
    
    if (!confirm("Are you sure you want to archive this support ticket? This will move it to the archived repository and clean it from active queues.")) return;
    
    const btn = document.getElementById("btn-archive-ticket");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Archiving...`;
    }
    
    // Simulate API Network Request Latency
    setTimeout(() => {
        const db = getDB();
        const idx = db.tickets.findIndex(t => t.id === activeAdminTicketId);
        if (idx === -1) {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fas fa-box-archive"></i> Archive`;
            }
            return;
        }
        
        db.tickets[idx].status = "ARCHIVED";
        db.tickets[idx].updatedAt = new Date().toISOString();
        
        // Push system alert into messages timeline
        db.tickets[idx].messages.push({
            sender: "SYSTEM",
            senderEmail: "system",
            text: `Ticket archived by Admin ${currentAdmin.email}.`,
            timestamp: new Date().toISOString()
        });
        
        writeAuditLog(
            currentAdmin.email,
            "Support Ticket Archived",
            `Archived support ticket ${activeAdminTicketId}`
        );
        
        saveDB(db);
        
        if (typeof supabaseUpdateTicketMeta === "function") {
            supabaseUpdateTicketMeta(activeAdminTicketId, { status: "ARCHIVED" });
        }
        if (typeof supabasePushTicketMessage === "function") {
            const lastMsg = db.tickets[idx].messages[db.tickets[idx].messages.length - 1];
            supabasePushTicketMessage(activeAdminTicketId, lastMsg);
        }
        
        showToast(`Support Ticket ${activeAdminTicketId} has been archived.`, "success");
        
        activeAdminTicketId = null;
        document.getElementById("admin-support-chat-placeholder").style.display = "flex";
        document.getElementById("admin-support-chat-board").style.display = "none";
        
        renderSupportAnalytics();
        renderAdminTicketsQueue();
        
        window.dispatchEvent(new CustomEvent('goodfastpay_support_update', {
            detail: { ticketId: activeAdminTicketId, action: "ARCHIVE" }
        }));
    }, 750);
}

// Delete Support Ticket Completely
function handleDeleteTicket() {
    if (!activeAdminTicketId || !currentAdmin) return;
    
    if (!confirm("Are you sure you want to permanently delete this support ticket? This action cannot be undone and will erase all conversation history.")) return;
    
    const btn = document.getElementById("btn-delete-ticket");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Deleting...`;
    }
    
    // Simulate API Network Request Latency
    setTimeout(() => {
        const db = getDB();
        const idx = db.tickets.findIndex(t => t.id === activeAdminTicketId);
        if (idx === -1) {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fas fa-trash-can"></i> Delete`;
            }
            return;
        }
        
        db.tickets.splice(idx, 1);
        
        writeAuditLog(
            currentAdmin.email,
            "Support Ticket Deleted",
            `Permanently deleted support ticket ${activeAdminTicketId}`
        );
        
        saveDB(db);
        showToast(`Support Ticket ${activeAdminTicketId} deleted permanently.`, "danger");
        
        activeAdminTicketId = null;
        document.getElementById("admin-support-chat-placeholder").style.display = "flex";
        document.getElementById("admin-support-chat-board").style.display = "none";
        
        renderSupportAnalytics();
        renderAdminTicketsQueue();
        
        window.dispatchEvent(new CustomEvent('goodfastpay_support_update', {
            detail: { ticketId: activeAdminTicketId, action: "DELETE" }
        }));
    }, 750);
}

// Update unread support ticket notifications badge on sidebar
function updateAdminSupportBadge() {
    const db = getDB();
    const unreadCount = (db.tickets || []).filter(t => t.adminUnread === true).length;
    
    const badge = document.getElementById("badge-admin-unread-tickets");
    if (badge) {
        if (unreadCount > 0) {
            badge.style.display = "inline-block";
            badge.textContent = unreadCount;
        } else {
            badge.style.display = "none";
        }
    }
}

// Periodic check for new tickets & chat replies to simulate real-time WebSockets
function setupAdminSupportRealTimeCheck() {
    // Read initial ticket list to prevent alerts on already existing items on load
    const initialDb = getDB();
    knownTicketIds = (initialDb.tickets || []).map(t => t.id);
    
    // Run unread calculation immediately
    updateAdminSupportBadge();
    
    // Sync storage events
    window.addEventListener('storage', (e) => {
        if (e.key === 'goodfastpay_db') {
            updateAdminSupportBadge();
            syncAdminActiveChat();
        }
    });
    
    // Sync custom events
    window.addEventListener('goodfastpay_support_update', () => {
        updateAdminSupportBadge();
        syncAdminActiveChat();
    });
    
    // Start loop interval
    setInterval(() => {
        if (!currentAdmin) return;
        
        const db = getDB();
        const currentTickets = db.tickets || [];
        
        // 1. Sync unread notification badges
        updateAdminSupportBadge();
        
        // 2. Play audio alerts on new incoming tickets or high priority escalations
        const currentIds = currentTickets.map(t => t.id);
        const newTickets = currentTickets.filter(t => !knownTicketIds.includes(t.id));
        
        if (newTickets.length > 0) {
            newTickets.forEach(t => {
                playNotificationSound();
                showToast(`🚨 New support request: ${t.id} - ${t.category}`, "warning");
            });
            knownTicketIds = currentIds; // update known list
        }
        
        syncAdminActiveChat();
    }, 1500);
}

// Sync active chat feed message updates, user typing states, and metadata in real-time
function syncAdminActiveChat() {
    const supportSection = document.getElementById("section-support-manager");
    if (!supportSection || !supportSection.classList.contains("active")) return;
    
    const db = getDB();
    renderSupportAnalytics();
    
    // Check if there is a selected ticket details pane open
    if (activeAdminTicketId) {
        const currentTicket = (db.tickets || []).find(t => t.id === activeAdminTicketId);
        if (currentTicket) {
            const msgContainer = document.getElementById("admin-chat-messages-container");
            const currentMsgCount = msgContainer ? msgContainer.childElementCount : 0;
            
            // Sync message length
            if (currentTicket.messages.length !== currentMsgCount) {
                renderAdminChatMessages(currentTicket);
                
                // Clear adminUnread status instantly since admin is viewing it
                if (currentTicket.adminUnread) {
                    const idx = db.tickets.findIndex(t => t.id === activeAdminTicketId);
                    if (idx !== -1) {
                        db.tickets[idx].adminUnread = false;
                        saveDB(db);
                        updateAdminSupportBadge();
                    }
                }
            }
            
            // Sync user typing indicator status
            const typingIndicator = document.getElementById("admin-chat-typing");
            if (typingIndicator) {
                typingIndicator.style.display = currentTicket.userTyping ? "inline-block" : "none";
            }
            
            // Periodically refresh user context info to get live balance updates
            loadUserContextDrawer(currentTicket.userId);
        }
    } else {
        // Otherwise refresh left queue grid list
        renderAdminTicketsQueue();
    }
}


