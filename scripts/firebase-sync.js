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
    
    syncListeners.progress = onValue(progressRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.log('📭 No progress in Firebase');
            
            // If Firebase is empty but we have local progress, upload it
            if (state.learningProgress && Object.keys(state.learningProgress).length > 0) {
                console.log('📤 Uploading local progress to Firebase...');
                syncProgressToFirebase();
            }
            return;
        }
        
        const firebaseProgress = snapshot.val();
        console.log('📥 Progress updated from Firebase:', Object.keys(firebaseProgress).length, 'items');
        
        // Update local state and localStorage
        state.learningProgress = firebaseProgress;
        localStorage.setItem('vocabularyProgress', JSON.stringify(firebaseProgress));
        
        // Update UI
        if (typeof updateStatistics === 'function') {
            updateStatistics();
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

// Sync progress to Firebase
async function syncProgressToFirebase() {
    const userId = getFirebaseUserId();
    
    if (!userId) {
        console.log('⚠️ Not syncing progress: User not authenticated');
        return;
    }
    
    try {
        const progressRef = ref(database, `users/${userId}/progress`);
        await set(progressRef, state.learningProgress);
        
        console.log('✅ Progress synced to Firebase:', Object.keys(state.learningProgress).length, 'items');
        
        syncState.lastSyncTime = new Date();
        
    } catch (error) {
        console.error('❌ Error syncing progress to Firebase:', error);
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
window.deleteLectionFromFirebase = deleteLectionFromFirebase;
window.syncProgressToFirebase = syncProgressToFirebase;
window.handleManualSync = handleManualSync;
window.updateSyncStatusUI = updateSyncStatusUI;
