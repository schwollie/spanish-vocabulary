// ============================================
// FIREBASE SYNC MODULE - Real-time Database Sync
// ============================================

import {
    database,
    ref,
    set,
    get,
    onValue,
    remove
} from './firebase-config.js';

let syncListeners = {
    lections: null,
    lectionOrder: null,
    progress: null
};

let syncState = {
    isSyncing: false,
    lastSyncTime: null
};

function getNormalizedProgress(progress) {
    if (typeof window !== 'undefined' && typeof window.normalizeLearningProgressData === 'function') {
        return window.normalizeLearningProgressData(progress);
    }
    return progress || {};
}

function getProgressTimestamp(entry) {
    if (!entry || !entry.lastUpdated) {
        return 0;
    }
    const timestamp = Date.parse(entry.lastUpdated);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function mergeProgressSnapshots(localProgress = {}, remoteProgress = {}) {
    const normalizedLocal = getNormalizedProgress(localProgress);
    const normalizedRemote = getNormalizedProgress(remoteProgress);
    const merged = {};
    const allKeys = Array.from(new Set([
        ...Object.keys(normalizedLocal),
        ...Object.keys(normalizedRemote)
    ]));
    allKeys.forEach((key) => {
        const localEntry = normalizedLocal[key];
        const remoteEntry = normalizedRemote[key];
        if (!remoteEntry) {
            merged[key] = localEntry;
            return;
        }
        if (!localEntry) {
            merged[key] = remoteEntry;
            return;
        }
        const localTs = getProgressTimestamp(localEntry);
        const remoteTs = getProgressTimestamp(remoteEntry);
        if (localTs > remoteTs) {
            merged[key] = localEntry;
        } else if (remoteTs > localTs) {
            merged[key] = remoteEntry;
        } else if ((localEntry.correctCount || 0) >= (remoteEntry.correctCount || 0)) {
            merged[key] = localEntry;
        } else {
            merged[key] = remoteEntry;
        }
    });
    return {
        merged,
        normalizedLocal,
        normalizedRemote
    };
}

function areEntriesEqual(entryA = {}, entryB = {}) {
    const keysA = Object.keys(entryA);
    const keysB = Object.keys(entryB);
    if (keysA.length !== keysB.length) {
        return false;
    }
    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(entryB, key)) {
            return false;
        }
        if (entryA[key] !== entryB[key]) {
            return false;
        }
    }
    return true;
}

function areProgressMapsEqual(a = {}, b = {}) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    for (const key of aKeys) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) {
            return false;
        }
        if (!areEntriesEqual(a[key], b[key])) {
            return false;
        }
    }
    return true;
}

// Initialize Firebase real-time sync
function initFirebaseSync() {
    const userId = getFirebaseUserId();
    
    if (!userId) {
        console.error('❌ Cannot init sync: No user ID');
        return;
    }
    
    console.log('🔄 Starting Firebase real-time sync for user:', userId);
    
    // Stop any existing listeners first
    stopFirebaseSync();
    
    // Set up real-time listeners for lections and progress
    setupLectionsListener(userId);
    setupProgressListener(userId);
    
    updateSyncStatusUI('synced');
}

// Stop all Firebase listeners
function stopFirebaseSync() {
    if (syncListeners.lections) {
        syncListeners.lections();
        syncListeners.lections = null;
    }
    
    if (syncListeners.lectionOrder) {
        syncListeners.lectionOrder();
        syncListeners.lectionOrder = null;
    }
    
    if (syncListeners.progress) {
        syncListeners.progress();
        syncListeners.progress = null;
    }
    
    console.log('🛑 Firebase sync listeners stopped');
}

// Set up real-time listener for lections
function setupLectionsListener(userId) {
    const lectionsRef = ref(database, `users/${userId}/lections`);
    const orderRef = ref(database, `users/${userId}/lectionOrder`);
    
    // Listen for lection order changes
    syncListeners.lectionOrder = onValue(orderRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.log('📭 No lection order in Firebase');
            return;
        }
        
        const order = snapshot.val();
        console.log('📥 Lection order updated from Firebase:', order);
        
        // Update localStorage
        localStorage.setItem('lectionOrder', JSON.stringify(order));
        
        // Reload UI if needed
        if (typeof loadLections === 'function') {
            loadLections();
        }
    });
    
    // Listen for individual lection changes
    syncListeners.lections = onValue(lectionsRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.log('📭 No lections in Firebase');
            
            // If Firebase is empty but we have local data, upload it
            const localLections = getAllLections();
            if (localLections.length > 0) {
                console.log('📤 Uploading local lections to Firebase...');
                syncAllLectionsToFirebase();
            }
            return;
        }
        
        const firebaseLections = snapshot.val();
        console.log('📥 Lections updated from Firebase:', Object.keys(firebaseLections).length, 'lections');
        
        // Clear all existing lections from localStorage first
        const localOrder = JSON.parse(localStorage.getItem('lectionOrder') || '[]');
        localOrder.forEach(lectionId => {
            localStorage.removeItem(`lection_${lectionId}`);
        });
        
        // Update localStorage with Firebase data
        Object.entries(firebaseLections).forEach(([lectionId, lection]) => {
            localStorage.setItem(`lection_${lectionId}`, JSON.stringify(lection));
        });
        
        syncState.lastSyncTime = new Date();
        updateSyncStatusUI('synced');
        
        // Reload UI if needed
        if (typeof loadLections === 'function') {
            loadLections();
        }
    });
}

// Set up real-time listener for progress
function setupProgressListener(userId) {
    const progressRef = ref(database, `users/${userId}/progress`);
    const resetRef = ref(database, `users/${userId}/lastProgressReset`);
    
    // Listen for reset events
    onValue(resetRef, (snapshot) => {
        if (snapshot.exists()) {
            const remoteResetTime = snapshot.val();
            const localResetTime = state.lastProgressReset || '1970-01-01T00:00:00.000Z';
            
            // If remote reset is newer than local data, clear local progress
            if (remoteResetTime > localResetTime) {
                console.log('🗑️ Remote reset detected, clearing local progress');
                state.learningProgress = {};
                state.lastProgressReset = remoteResetTime;
                localStorage.removeItem('vocabularyProgress');
                localStorage.setItem('lastProgressReset', remoteResetTime);
                
                if (typeof updateStatistics === 'function') {
                    updateStatistics();
                }
                if (typeof updateVocabularyCount === 'function') {
                    updateVocabularyCount();
                }
                if (typeof displayVocabulary === 'function') {
                    displayVocabulary();
                }
            }
        }
    });
    
    syncListeners.progress = onValue(progressRef, async (snapshot) => {
        if (!snapshot.exists()) {
            console.log('📭 No progress in Firebase');
            
            // If Firebase is empty but we have local progress, upload it
            if (state.learningProgress && Object.keys(state.learningProgress).length > 0) {
                console.log('📤 Uploading local progress to Firebase...');
                await uploadProgressToFirebase();
            }
            return;
        }
        
        const remoteData = snapshot.val() || {};
        const remoteProgress = remoteData.progress || {};
        const remoteTimestamp = remoteData.lastUpload || '1970-01-01T00:00:00.000Z';
        const localTimestamp = state.lastLocalUpdate || '1970-01-01T00:00:00.000Z';
        
        // If local changes are newer than last upload, upload to Firebase
        if (localTimestamp > remoteTimestamp) {
            console.log('📤 Local changes detected, uploading to Firebase...');
            await uploadProgressToFirebase();
        } else if (remoteTimestamp > localTimestamp) {
            // Firebase is newer, accept remote data
            console.log('📥 Accepting newer data from Firebase:', Object.keys(remoteProgress).length, 'items');
            state.learningProgress = getNormalizedProgress(remoteProgress);
            state.lastLocalUpdate = remoteTimestamp;
            localStorage.setItem('vocabularyProgress', JSON.stringify(state.learningProgress));
            localStorage.setItem('lastLocalUpdate', remoteTimestamp);
            
            if (typeof updateStatistics === 'function') {
                updateStatistics();
            }
            if (typeof updateVocabularyCount === 'function') {
                updateVocabularyCount();
            }
        } else {
            console.log('ℹ️ Progress in sync with Firebase');
        }
        
        syncState.lastSyncTime = new Date();
    });
}

// Sync a single lection to Firebase
async function syncLectionToFirebase(lection) {
    const userId = getFirebaseUserId();
    
    if (!userId) {
        console.log('⚠️ Not syncing: User not authenticated');
        return;
    }
    
    try {
        updateSyncStatusUI('syncing');
        
        const lectionRef = ref(database, `users/${userId}/lections/${lection.id}`);
        await set(lectionRef, lection);
        
        console.log('✅ Lection synced to Firebase:', lection.name);
        
        // Also update lection order
        const order = getLectionOrder();
        if (!order.includes(lection.id)) {
            order.push(lection.id);
            await syncLectionOrderToFirebase(order);
        }
        
        syncState.lastSyncTime = new Date();
        updateSyncStatusUI('synced');
        
    } catch (error) {
        console.error('❌ Error syncing lection to Firebase:', error);
        updateSyncStatusUI('error');
    }
}

// Sync lection order to Firebase
async function syncLectionOrderToFirebase(order) {
    const userId = getFirebaseUserId();
    
    if (!userId) return;
    
    try {
        const orderRef = ref(database, `users/${userId}/lectionOrder`);
        await set(orderRef, order);
        
        console.log('✅ Lection order synced to Firebase');
        
    } catch (error) {
        console.error('❌ Error syncing lection order:', error);
    }
}

// Delete a lection from Firebase
async function deleteLectionFromFirebase(lectionId) {
    const userId = getFirebaseUserId();
    
    if (!userId) return;
    
    try {
        updateSyncStatusUI('syncing');
        
        const lectionRef = ref(database, `users/${userId}/lections/${lectionId}`);
        await remove(lectionRef);
        
        console.log('✅ Lection deleted from Firebase:', lectionId);
        
        // Update lection order
        const order = getLectionOrder();
        const newOrder = order.filter(id => id !== lectionId);
        await syncLectionOrderToFirebase(newOrder);
        
        syncState.lastSyncTime = new Date();
        updateSyncStatusUI('synced');
        
    } catch (error) {
        console.error('❌ Error deleting lection from Firebase:', error);
        updateSyncStatusUI('error');
    }
}

// Sync all lections to Firebase
async function syncAllLectionsToFirebase() {
    const userId = getFirebaseUserId();
    
    if (!userId) return;
    
    try {
        const lections = getAllLections();
        const order = getLectionOrder();
        
        // Upload all lections
        for (const lection of lections) {
            const lectionRef = ref(database, `users/${userId}/lections/${lection.id}`);
            await set(lectionRef, lection);
        }
        
        // Upload lection order
        await syncLectionOrderToFirebase(order);
        
        console.log('✅ All lections synced to Firebase:', lections.length);
        
    } catch (error) {
        console.error('❌ Error syncing all lections:', error);
    }
}

// Upload progress to Firebase with timestamp
async function uploadProgressToFirebase() {
    const userId = getFirebaseUserId();
    
    if (!userId) {
        console.log('⚠️ Not syncing progress: User not authenticated');
        return;
    }
    
    try {
        const now = new Date().toISOString();
        const progressRef = ref(database, `users/${userId}/progress`);
        
        await set(progressRef, {
            progress: state.learningProgress || {},
            lastUpload: now
        });
        
        state.lastLocalUpdate = now;
        localStorage.setItem('lastLocalUpdate', now);
        
        console.log('✅ Progress uploaded to Firebase:', Object.keys(state.learningProgress || {}).length, 'items');
        syncState.lastSyncTime = new Date();
        
    } catch (error) {
        console.error('❌ Error uploading progress to Firebase:', error);
    }
}

// Legacy function for compatibility
async function syncProgressToFirebase() {
    await uploadProgressToFirebase();
}

async function forceUploadProgressToFirebase(progressOverride) {
    const userId = getFirebaseUserId();
    if (!userId) {
        console.log('⚠️ Not syncing progress: User not authenticated');
        return;
    }

    try {
        const progressRef = ref(database, `users/${userId}/progress`);
        const payload = progressOverride ?? state.learningProgress ?? {};
        await set(progressRef, payload);
        console.log('✅ Progress force-uploaded to Firebase:', Object.keys(payload).length, 'items');
        syncState.lastSyncTime = new Date();
    } catch (error) {
        console.error('❌ Error force-uploading progress to Firebase:', error);
    }
}

async function deleteAllProgressFromFirebase() {
    const userId = getFirebaseUserId();
    if (!userId) {
        console.log('⚠️ Not deleting progress: User not authenticated');
        return;
    }

    try {
        const progressRef = ref(database, `users/${userId}/progress`);
        await remove(progressRef);
        console.log('🗑️ All progress deleted from Firebase');
        syncState.lastSyncTime = new Date();
    } catch (error) {
        console.error('❌ Error deleting progress from Firebase:', error);
    }
}

async function syncProgressResetToFirebase(resetTimestamp) {
    const userId = getFirebaseUserId();
    if (!userId) {
        console.log('⚠️ Not syncing reset: User not authenticated');
        return;
    }

    try {
        // Clear progress
        const progressRef = ref(database, `users/${userId}/progress`);
        await set(progressRef, {});
        
        // Set reset timestamp
        const resetRef = ref(database, `users/${userId}/lastProgressReset`);
        await set(resetRef, resetTimestamp);
        
        console.log('✅ Progress reset synced to Firebase:', resetTimestamp);
        syncState.lastSyncTime = new Date();
    } catch (error) {
        console.error('❌ Error syncing reset to Firebase:', error);
    }
}

// Manual sync function (for button)
async function handleManualSync() {
    if (!isFirebaseAuthenticated()) {
        alert('Please sign in to Google first.');
        return;
    }
    
    try {
        updateSyncStatusUI('syncing');
        
        console.log('🔄 Manual sync triggered');
        
        // Upload all current data
        await syncAllLectionsToFirebase();
        await syncProgressToFirebase();
        
        updateSyncStatusUI('synced');
        alert('✅ Manual sync completed!');
        
    } catch (error) {
        console.error('❌ Manual sync error:', error);
        updateSyncStatusUI('error');
        alert('❌ Sync failed: ' + error.message);
    }
}

// Update sync status UI
function updateSyncStatusUI(status) {
    const syncStatus = document.getElementById('syncStatus');
    const lastSyncTimeEl = document.getElementById('lastSyncTime');
    
    if (syncStatus) {
        switch (status) {
            case 'syncing':
                syncStatus.textContent = '🔄 Syncing...';
                syncStatus.className = 'sync-status syncing';
                break;
            case 'synced':
                syncStatus.textContent = '☁️ Synced';
                syncStatus.className = 'sync-status synced';
                break;
            case 'error':
                syncStatus.textContent = '⚠️ Sync Error';
                syncStatus.className = 'sync-status error';
                break;
            case 'not-synced':
                syncStatus.textContent = '📴 Not synced';
                syncStatus.className = 'sync-status';
                break;
        }
    }
    
    if (lastSyncTimeEl && syncState.lastSyncTime) {
        const timeAgo = getTimeAgo(syncState.lastSyncTime);
        lastSyncTimeEl.textContent = `Last synced: ${timeAgo}`;
    }
}

// Get human-readable time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

// Expose functions globally for compatibility
window.initFirebaseSync = initFirebaseSync;
window.stopFirebaseSync = stopFirebaseSync;
window.syncLectionToFirebase = syncLectionToFirebase;
window.syncLectionOrderToFirebase = syncLectionOrderToFirebase;
window.deleteLectionFromFirebase = deleteLectionFromFirebase;
window.syncProgressToFirebase = syncProgressToFirebase;
window.uploadProgressToFirebase = uploadProgressToFirebase;
window.forceUploadProgressToFirebase = forceUploadProgressToFirebase;
window.deleteAllProgressFromFirebase = deleteAllProgressFromFirebase;
window.syncProgressResetToFirebase = syncProgressResetToFirebase;
window.handleManualSync = handleManualSync;
window.updateSyncStatusUI = updateSyncStatusUI;
