// Goodfastpay Platform - Firebase Cloud Backend & Real-time Sync Engine

const firebaseConfig = {
    apiKey: "AIzaSyCGWeOGc0ANw8KKgtONqFzAdhWeQACTvWE",
    authDomain: "good-fast-pay.firebaseapp.com",
    projectId: "good-fast-pay",
    storageBucket: "good-fast-pay.firebasestorage.app",
    messagingSenderId: "1010521921961",
    appId: "1:1010521921961:web:584ebd5170241bd2778cb8",
    measurementId: "G-BHGFGEG7WE"
};

// Global Firebase handles
let firebaseApp = null;
let firebaseAnalytics = null;
let dbFirestore = null;
let isFirebaseOnline = false;

// Initialize Firebase SDK
(function initFirebase() {
    try {
        if (typeof firebase !== "undefined") {
            if (!firebase.apps.length) {
                firebaseApp = firebase.initializeApp(firebaseConfig);
            } else {
                firebaseApp = firebase.app();
            }
            
            // Initialize Firestore
            dbFirestore = firebase.firestore();
            
            // Enable offline persistence if supported
            try {
                dbFirestore.enablePersistence({ synchronizeTabs: true }).catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('Firestore persistence failed: Multiple tabs open');
                    } else if (err.code === 'unimplemented') {
                        console.warn('Firestore persistence not supported by browser');
                    }
                });
            } catch (pErr) {
                // Ignore persistence setup errors in older environments
            }
            
            // Initialize Analytics if available
            try {
                if (typeof firebase.analytics === "function") {
                    firebaseAnalytics = firebase.analytics();
                }
            } catch (aErr) {
                console.log("Firebase Analytics initialized in standard mode.");
            }
            
            isFirebaseOnline = true;
            console.log("🔥 Firebase Cloud Backend connected successfully for project: good-fast-pay");
        } else {
            console.warn("Firebase SDK script not loaded yet. Operating in local mode.");
        }
    } catch (e) {
        console.error("Firebase initialization warning:", e);
        isFirebaseOnline = false;
    }
})();

// Helper to sanitize document IDs (e.g. replacing special email chars with safe strings)
function getSanitizedDocId(str) {
    if (!str) return "doc_" + Math.random().toString(36).substring(2, 9);
    return str.toLowerCase().replace(/[.#$/[\]]/g, "_");
}

// -------------------------------------------------------------
// CLOUD FIRESTORE ASYNC SYNC HELPERS
// -------------------------------------------------------------

/**
 * Save / Update an entire dataset record in Cloud Firestore
 */
async function syncDocToFirestore(collectionName, docId, data) {
    if (!dbFirestore || !isFirebaseOnline) return false;
    try {
        const cleanId = getSanitizedDocId(docId);
        await dbFirestore.collection(collectionName).doc(cleanId).set(data, { merge: true });
        return true;
    } catch (err) {
        console.warn(`Firestore sync to ${collectionName}/${docId} skipped:`, err.message);
        return false;
    }
}

/**
 * Sync entire DB state to Cloud Firestore in the background
 */
async function syncEntireDBToCloud(db) {
    if (!dbFirestore || !isFirebaseOnline || !db) return;
    try {
        // 1. Sync global settings & rates
        if (db.settings) {
            await dbFirestore.collection("system").doc("settings").set(db.settings, { merge: true });
        }
        if (db.currencies) {
            await dbFirestore.collection("system").doc("currencies").set({ currencies: db.currencies, history: db.currencyHistory || [] }, { merge: true });
        }

        // 2. Sync users (individually)
        if (db.users) {
            const userPromises = Object.keys(db.users).map(email => {
                return dbFirestore.collection("users").doc(getSanitizedDocId(email)).set(db.users[email], { merge: true });
            });
            await Promise.allSettled(userPromises);
        }

        // 3. Sync submissions
        if (db.submissions && Array.isArray(db.submissions)) {
            const subPromises = db.submissions.map(sub => {
                return dbFirestore.collection("submissions").doc(getSanitizedDocId(sub.id)).set(sub, { merge: true });
            });
            await Promise.allSettled(subPromises);
        }

        // 4. Sync withdrawals
        if (db.withdrawals && Array.isArray(db.withdrawals)) {
            const wdPromises = db.withdrawals.map(wd => {
                return dbFirestore.collection("withdrawals").doc(getSanitizedDocId(wd.id)).set(wd, { merge: true });
            });
            await Promise.allSettled(wdPromises);
        }

        // 5. Sync inventory
        if (db.inventory && Array.isArray(db.inventory)) {
            const invPromises = db.inventory.map(item => {
                return dbFirestore.collection("inventory").doc(getSanitizedDocId(item.id)).set(item, { merge: true });
            });
            await Promise.allSettled(invPromises);
        }

        // 6. Sync support tickets
        if (db.tickets && Array.isArray(db.tickets)) {
            const tktPromises = db.tickets.map(tkt => {
                return dbFirestore.collection("tickets").doc(getSanitizedDocId(tkt.id)).set(tkt, { merge: true });
            });
            await Promise.allSettled(tktPromises);
        }
    } catch (err) {
        console.warn("Background cloud database sync notice:", err.message);
    }
}

/**
 * Load initial Cloud Firestore state and merge into local state
 */
async function pullCloudDBToLocal() {
    if (!dbFirestore || !isFirebaseOnline) return;
    try {
        let db = getDB();
        let changed = false;

        // Fetch Users from Cloud
        const usersSnap = await dbFirestore.collection("users").get();
        if (!usersSnap.empty) {
            usersSnap.forEach(doc => {
                const userData = doc.data();
                if (userData && userData.email) {
                    db.users[userData.email] = { ...(db.users[userData.email] || {}), ...userData };
                    changed = true;
                }
            });
        }

        // Fetch Submissions from Cloud
        const subSnap = await dbFirestore.collection("submissions").get();
        if (!subSnap.empty) {
            const cloudSubs = [];
            subSnap.forEach(doc => cloudSubs.push(doc.data()));
            // Merge submissions by id
            cloudSubs.forEach(cSub => {
                const idx = db.submissions.findIndex(s => s.id === cSub.id);
                if (idx >= 0) {
                    db.submissions[idx] = cSub;
                } else {
                    db.submissions.unshift(cSub);
                }
            });
            changed = true;
        }

        // Fetch Withdrawals from Cloud
        const wdSnap = await dbFirestore.collection("withdrawals").get();
        if (!wdSnap.empty) {
            const cloudWds = [];
            wdSnap.forEach(doc => cloudWds.push(doc.data()));
            cloudWds.forEach(cWd => {
                const idx = db.withdrawals.findIndex(w => w.id === cWd.id);
                if (idx >= 0) {
                    db.withdrawals[idx] = cWd;
                } else {
                    db.withdrawals.unshift(cWd);
                }
            });
            changed = true;
        }

        // Fetch Inventory from Cloud
        const invSnap = await dbFirestore.collection("inventory").get();
        if (!invSnap.empty) {
            const cloudInv = [];
            invSnap.forEach(doc => cloudInv.push(doc.data()));
            cloudInv.forEach(cInv => {
                const idx = db.inventory.findIndex(i => i.id === cInv.id);
                if (idx >= 0) {
                    db.inventory[idx] = cInv;
                } else {
                    db.inventory.unshift(cInv);
                }
            });
            changed = true;
        }

        // Fetch Tickets from Cloud
        const tktSnap = await dbFirestore.collection("tickets").get();
        if (!tktSnap.empty) {
            const cloudTkts = [];
            tktSnap.forEach(doc => cloudTkts.push(doc.data()));
            cloudTkts.forEach(cTkt => {
                const idx = db.tickets.findIndex(t => t.id === cTkt.id);
                if (idx >= 0) {
                    db.tickets[idx] = cTkt;
                } else {
                    db.tickets.unshift(cTkt);
                }
            });
            changed = true;
        }

        // Fetch System Settings & Rates
        const settingsSnap = await dbFirestore.collection("system").doc("settings").get();
        if (settingsSnap.exists) {
            db.settings = { ...db.settings, ...settingsSnap.data() };
            changed = true;
        }

        if (changed) {
            localStorage.setItem("goodfastpay_db", JSON.stringify(db));
            console.log("☁️ Local database synchronized with Cloud Firestore.");
        }
    } catch (err) {
        console.warn("Pulling cloud database initial state notice:", err.message);
    }
}

// -------------------------------------------------------------
// REALTIME LISTENERS
// -------------------------------------------------------------

/**
 * Listen for realtime user account updates (e.g. balance credited, status changes)
 */
function listenToUserCloudUpdates(email, onUpdateCallback) {
    if (!dbFirestore || !isFirebaseOnline || !email) return () => {};
    try {
        const docId = getSanitizedDocId(email);
        return dbFirestore.collection("users").doc(docId).onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                const db = getDB();
                db.users[email] = { ...(db.users[email] || {}), ...data };
                localStorage.setItem("goodfastpay_db", JSON.stringify(db));
                if (typeof onUpdateCallback === "function") {
                    onUpdateCallback(data);
                }
            }
        }, (err) => {
            console.warn("User realtime listener warning:", err.message);
        });
    } catch (e) {
        console.warn("Could not start user realtime listener:", e);
        return () => {};
    }
}

/**
 * Listen for realtime collections updates (Used by Admin Console to see new users, trades, withdrawals live)
 */
function listenToCollectionCloudUpdates(collectionName, onUpdateCallback) {
    if (!dbFirestore || !isFirebaseOnline) return () => {};
    try {
        return dbFirestore.collection(collectionName).onSnapshot((snapshot) => {
            const items = [];
            snapshot.forEach(doc => items.push(doc.data()));
            
            // Update local DB cache accordingly
            const db = getDB();
            if (collectionName === "users") {
                items.forEach(u => {
                    if (u.email) db.users[u.email] = { ...(db.users[u.email] || {}), ...u };
                });
            } else if (collectionName === "submissions") {
                db.submissions = items;
            } else if (collectionName === "withdrawals") {
                db.withdrawals = items;
            } else if (collectionName === "inventory") {
                db.inventory = items;
            } else if (collectionName === "tickets") {
                db.tickets = items;
            }
            localStorage.setItem("goodfastpay_db", JSON.stringify(db));

            if (typeof onUpdateCallback === "function") {
                onUpdateCallback(items);
            }
        }, (err) => {
            console.warn(`Realtime listener for ${collectionName} warning:`, err.message);
        });
    } catch (e) {
        console.warn(`Could not start realtime listener for ${collectionName}:`, e);
        return () => {};
    }
}
