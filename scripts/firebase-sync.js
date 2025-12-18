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

// Encode keys for Firebase (replace special characters)
function encodeFirebaseKey(key) {
    // Firebase doesn't allow: . # $ / [ ] and we use ||
    return key
        .replace(/\./g, '%2E')
        .replace(/#/g, '%23')
        .replace(/\$/g, '%24')
        .replace(/\//g, '%2F')
        .replace(/\[/g, '%5B')
        .replace(/\]/g, '%5D')
        .replace(/\|\|/g, '__PIPE__');
}

// Decode keys from Firebase
function decodeFirebaseKey(key) {
    return key
        .replace(/__PIPE__/g, '||')
        .replace(/%2E/g, '.')
        .replace(/%23/g, '#')
        .replace(/%24/g, '$')
        .replace(/%2F/g, '/')
        .replace(/%5B/g, '[')
        .replace(/%5D/g, ']');
}

// Encode progress object for Firebase
function encodeProgressForFirebase(progress) {
    const encoded = {};
    Object.entries(progress).forEach(([key, value]) => {
        const encodedKey = encodeFirebaseKey(key);
        encoded[encodedKey] = value;
    });
    return encoded;
}

// Decode progress object from Firebase
function decodeProgressFromFirebase(progress) {
    const decoded = {};
    Object.entries(progress).forEach(([key, value]) => {
        const decodedKey = decodeFirebaseKey(key);
        decoded[decodedKey] = value;
    });
    return decoded;
}

// Helper to update UI after progress changes
function updateProgressUI() {
    if (typeof updateStatistics === 'function') {
        updateStatistics();
    }
    if (typeof updateVocabularyCount === 'function') {
        updateVocabularyCount();
    }
    if (typeof updatePhaseCountDisplay === 'function') {
        updatePhaseCountDisplay();
    }
    if (typeof displayVocabulary === 'function') {
        displayVocabulary();
    }
}

// Check for newer data on page load (one-time check)
async function checkAndSyncOnLoad(userId) {
    console.log('🔍 Checking for newer data on page load...');
    
    try {
        // Check progress data
        const progressRef = ref(database, `users/${userId}/progress`);
        const progressSnapshot = await get(progressRef);
        
        if (progressSnapshot.exists()) {
            const remoteData = progressSnapshot.val() || {};
            const remoteProgressRaw = remoteData.progress || {};
            const remoteProgress = decodeProgressFromFirebase(remoteProgressRaw);
            const remoteTimestamp = remoteData.lastUpload || '1970-01-01T00:00:00.000Z';
            
            // Use the stale local timestamp from localStorage (loaded before Firebase init)
            // This is the timestamp from when the data was last saved, NOT from current session
            const localTimestamp = state._staleLocalUpdate || '1970-01-01T00:00:00.000Z';
            const hasLocalProgress = Object.keys(state.learningProgress).length > 0;
            
            console.log('📊 Timestamp comparison:', {
                local: localTimestamp,
                remote: remoteTimestamp,
                localNewer: localTimestamp > remoteTimestamp,
                hasLocalProgress
            });
            
            // Decision logic:
            // 1. If remote is newer OR local has no timestamp -> accept remote
            // 2. If local is newer AND has progress -> upload local
            // 3. Otherwise -> already in sync
            
            if (remoteTimestamp > localTimestamp || !localTimestamp || localTimestamp === '1970-01-01T00:00:00.000Z') {
                console.log('📥 Accepting data from Firebase (remote is newer or local is missing):', Object.keys(remoteProgress).length, 'items');
                state.learningProgress = getNormalizedProgress(remoteProgress);
                state.lastLocalUpdate = remoteTimestamp;
                localStorage.setItem('vocabularyProgress', JSON.stringify(state.learningProgress));
                localStorage.setItem('lastLocalUpdate', remoteTimestamp);
                
                // Clear the stale marker
                delete state._staleLocalUpdate;
                
                // Update UI
                updateProgressUI();
            } else if (localTimestamp > remoteTimestamp && hasLocalProgress) {
                console.log('📤 Local data is newer, uploading to Firebase...');
                state.lastLocalUpdate = localTimestamp; // Use the local timestamp
                delete state._staleLocalUpdate;
                await uploadProgressToFirebase();
            } else {
                console.log('✅ Data is in sync');
                state.lastLocalUpdate = localTimestamp;
                delete state._staleLocalUpdate;
            }
        } else if (Object.keys(state.learningProgress).length > 0) {
            // Firebase is empty but we have local progress - upload it
            console.log('📤 Firebase empty, uploading local progress...');
            const localTimestamp = state._staleLocalUpdate || new Date().toISOString();
            state.lastLocalUpdate = localTimestamp;
            delete state._staleLocalUpdate;
            await uploadProgressToFirebase();
        }
        
        // Check reset timestamp
        const resetRef = ref(database, `users/${userId}/lastProgressReset`);
        const resetSnapshot = await get(resetRef);
        
        if (resetSnapshot.exists()) {
            const remoteResetTime = resetSnapshot.val();
            const localResetTime = state.lastProgressReset || '1970-01-01T00:00:00.000Z';
            
            if (remoteResetTime > localResetTime) {
                console.log('🗑️ Remote reset detected on load, clearing local progress');
                state.learningProgress = {};
                state.lastProgressReset = remoteResetTime;
                state.lastLocalUpdate = null;
                localStorage.removeItem('vocabularyProgress');
                localStorage.removeItem('lastLocalUpdate');
                localStorage.setItem('lastProgressReset', remoteResetTime);
                delete state._staleLocalUpdate;
                
                updateProgressUI();
            }
        }
    } catch (error) {
        console.error('❌ Error checking for newer data:', error);
    }
}

// Initialize Firebase real-time sync
async function initFirebaseSync() {
    const userId = getFirebaseUserId();
    
    if (!userId) {
        console.error('❌ Cannot init sync: No user ID');
        return;
    }
    
    console.log('🔄 Starting Firebase real-time sync for user:', userId);
    
    // Stop any existing listeners first
    stopFirebaseSync();
    
    // First, check for newer data on load (one-time check)
    await checkAndSyncOnLoad(userId);
    
    // Then set up real-time listeners for ongoing sync
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
                
                updateProgressUI();
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
        const remoteProgressRaw = remoteData.progress || {};
        const remoteProgress = decodeProgressFromFirebase(remoteProgressRaw);
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
            
            updateProgressUI();
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
    
    // Don't sync commonWords lections to Firebase
    if (lection.isCommonWord || (lection.id && lection.id.startsWith('commonWords_'))) {
        console.log('⏭️ Skipping commonWords lection sync:', lection.name);
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
        
        // Upload all lections (excluding commonWords)
        for (const lection of lections) {
            // Skip commonWords lections
            if (lection.isCommonWord || (lection.id && lection.id.startsWith('commonWords_'))) {
                continue;
            }
            
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
        
        const encodedProgress = encodeProgressForFirebase(state.learningProgress || {});
        
        await set(progressRef, {
            progress: encodedProgress,
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
window.checkAndSyncOnLoad = checkAndSyncOnLoad;
window.syncLectionToFirebase = syncLectionToFirebase;
window.syncLectionOrderToFirebase = syncLectionOrderToFirebase;
window.deleteLectionFromFirebase = deleteLectionFromFirebase;
window.syncProgressToFirebase = syncProgressToFirebase;
window.uploadProgressToFirebase = uploadProgressToFirebase;
window.deleteAllProgressFromFirebase = deleteAllProgressFromFirebase;
window.syncProgressResetToFirebase = syncProgressResetToFirebase;
window.handleManualSync = handleManualSync;
window.updateSyncStatusUI = updateSyncStatusUI;
