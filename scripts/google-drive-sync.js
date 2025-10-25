// ============================================
// GOOGLE DRIVE SYNC MODULE - Auto-sync with Google Drive
// ============================================

const SYNC_CONFIG = {
    FILENAME: 'spanish-vocabulary-data.json',
    FOLDER_NAME: 'Spanish Vocabulary Trainer',
    AUTO_SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutes in milliseconds
    MIME_TYPE: 'application/json'
};

let syncState = {
    fileId: null,
    lastSyncTime: null,
    isSyncing: false,
    autoSyncTimer: null
};

// Initialize sync system
function initGoogleDriveSync() {
    // Load saved fileId from localStorage
    const savedFileId = localStorage.getItem('googleDriveFileId');
    if (savedFileId) {
        syncState.fileId = savedFileId;
    }
    
    const lastSync = localStorage.getItem('lastSyncTime');
    if (lastSync) {
        syncState.lastSyncTime = new Date(lastSync);
    }
    
    // Setup auto-sync interval (every 5 minutes)
    if (syncState.autoSyncTimer) {
        clearInterval(syncState.autoSyncTimer);
    }
    
    syncState.autoSyncTimer = setInterval(() => {
        if (isGoogleAuthenticated()) {
            autoSyncToGoogleDrive();
        }
    }, SYNC_CONFIG.AUTO_SYNC_INTERVAL);
    
    // Sync on page unload (closing/leaving page)
    window.addEventListener('beforeunload', () => {
        if (isGoogleAuthenticated()) {
            // Use sendBeacon for reliable sync on page close
            syncOnPageClose();
        }
    });
}

// Auto-sync to Google Drive (silent, no alerts)
async function autoSyncToGoogleDrive() {
    if (syncState.isSyncing) return;
    
    try {
        await syncToGoogleDrive(true); // silent = true
    } catch (error) {
        console.error('Auto-sync failed:', error);
    }
}

// Sync to Google Drive
async function syncToGoogleDrive(silent = false) {
    if (!isGoogleAuthenticated()) {
        if (!silent) alert('Please sign in to Google first.');
        return;
    }
    
    if (syncState.isSyncing) {
        if (!silent) alert('Sync already in progress...');
        return;
    }
    
    syncState.isSyncing = true;
    updateSyncStatusUI('syncing');
    
    try {
        // Ensure token is set in gapi client
        if (googleAuth.accessToken) {
            gapi.client.setToken({ access_token: googleAuth.accessToken });
        }
        
        // Get current data
        const data = {
            version: '1.0',
            lastModified: new Date().toISOString(),
            lections: getAllLections(),
            progress: state.learningProgress
        };
        
        // Check if file exists
        if (!syncState.fileId) {
            // Search for existing file
            syncState.fileId = await findOrCreateFile();
        }
        
        // Upload data to Google Drive
        await updateFileInDrive(syncState.fileId, data);
        
        syncState.lastSyncTime = new Date();
        localStorage.setItem('lastSyncTime', syncState.lastSyncTime.toISOString());
        
        updateSyncStatusUI('synced');
        if (!silent) alert('✅ Synced to Google Drive successfully!');
        
    } catch (error) {
        console.error('Sync to Drive failed:', error);
        
        // Check if it's an auth error
        if (error.status === 401 || error.result?.error?.code === 401) {
            console.log('Auth error during sync, clearing token');
            clearAuthState();
            updateGoogleAuthUI(false);
            if (!silent) alert('❌ Session expired. Please sign in again.');
        } else {
            updateSyncStatusUI('error');
            if (!silent) alert('❌ Failed to sync to Google Drive: ' + error.message);
        }
    } finally {
        syncState.isSyncing = false;
    }
}

// Sync from Google Drive (load data)
async function syncFromGoogleDrive(silent = false) {
    if (!isGoogleAuthenticated()) {
        if (!silent) alert('Please sign in to Google first.');
        return;
    }
    
    if (syncState.isSyncing) {
        if (!silent) alert('Sync already in progress...');
        return;
    }
    
    syncState.isSyncing = true;
    updateSyncStatusUI('syncing');
    
    try {
        // Ensure token is set in gapi client
        if (googleAuth.accessToken) {
            gapi.client.setToken({ access_token: googleAuth.accessToken });
        }
        
        // Find file
        if (!syncState.fileId) {
            syncState.fileId = await findOrCreateFile();
        }
        
        // Download data from Google Drive
        const driveData = await downloadFileFromDrive(syncState.fileId);
        
        if (!driveData) {
            // No data in Drive yet, upload current data
            await syncToGoogleDrive(true);
            return;
        }
        
        // Compare timestamps and merge (newest wins)
        const localLastModified = localStorage.getItem('lastSyncTime') || new Date(0).toISOString();
        const driveLastModified = driveData.lastModified || new Date(0).toISOString();
        
        if (driveLastModified > localLastModified) {
            // Drive data is newer, use it
            localStorage.setItem('lections', JSON.stringify(driveData.lections));
            localStorage.setItem('vocabularyProgress', JSON.stringify(driveData.progress));
            state.learningProgress = driveData.progress;
            
            syncState.lastSyncTime = new Date(driveLastModified);
            localStorage.setItem('lastSyncTime', driveLastModified);
            
            if (!silent) {
                alert('✅ Loaded newer data from Google Drive! Page will reload.');
                location.reload();
            } else {
                // Silent reload for auto-sync
                location.reload();
            }
        } else {
            // Local data is newer or same, upload to Drive
            await syncToGoogleDrive(true);
        }
        
        updateSyncStatusUI('synced');
        
    } catch (error) {
        console.error('Sync from Drive failed:', error);
        
        // Check if it's an auth error
        if (error.status === 401 || error.result?.error?.code === 401) {
            console.log('Auth error during sync, clearing token');
            clearAuthState();
            updateGoogleAuthUI(false);
            if (!silent) alert('❌ Session expired. Please sign in again.');
        } else {
            updateSyncStatusUI('error');
            if (!silent) alert('❌ Failed to load from Google Drive: ' + error.message);
        }
    } finally {
        syncState.isSyncing = false;
    }
}

// Find existing file or create new one
async function findOrCreateFile() {
    try {
        // Search for file
        const response = await gapi.client.drive.files.list({
            q: `name='${SYNC_CONFIG.FILENAME}' and mimeType='${SYNC_CONFIG.MIME_TYPE}' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            // File exists
            const fileId = response.result.files[0].id;
            localStorage.setItem('googleDriveFileId', fileId);
            return fileId;
        } else {
            // Create new file
            const fileId = await createFileInDrive();
            localStorage.setItem('googleDriveFileId', fileId);
            return fileId;
        }
    } catch (error) {
        console.error('Error finding/creating file:', error);
        throw error;
    }
}

// Create new file in Google Drive
async function createFileInDrive() {
    const metadata = {
        name: SYNC_CONFIG.FILENAME,
        mimeType: SYNC_CONFIG.MIME_TYPE,
        description: 'Spanish Vocabulary Trainer - Auto-synced data'
    };
    
    const initialData = {
        version: '1.0',
        lastModified: new Date().toISOString(),
        lections: getAllLections(),
        progress: state.learningProgress
    };
    
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    
    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + SYNC_CONFIG.MIME_TYPE + '\r\n\r\n' +
        JSON.stringify(initialData, null, 2) +
        close_delim;
    
    const request = gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: {
            'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        body: multipartRequestBody
    });
    
    const response = await request;
    return response.result.id;
}

// Update existing file in Google Drive
async function updateFileInDrive(fileId, data) {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    
    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify({ mimeType: SYNC_CONFIG.MIME_TYPE }) +
        delimiter +
        'Content-Type: ' + SYNC_CONFIG.MIME_TYPE + '\r\n\r\n' +
        JSON.stringify(data, null, 2) +
        close_delim;
    
    const request = gapi.client.request({
        path: '/upload/drive/v3/files/' + fileId,
        method: 'PATCH',
        params: { uploadType: 'multipart' },
        headers: {
            'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        body: multipartRequestBody
    });
    
    await request;
}

// Download file from Google Drive
async function downloadFileFromDrive(fileId) {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        
        return response.result;
    } catch (error) {
        console.error('Error downloading file:', error);
        return null;
    }
}

// Sync on page close (using fetch with keepalive for reliability)
function syncOnPageClose() {
    if (!isGoogleAuthenticated() || syncState.isSyncing || !syncState.fileId) return;

    // Use fetch with keepalive to ensure the request is sent even if the page unloads.
    // This is more reliable than a standard async call in 'beforeunload'.
    const data = {
        version: '1.0',
        lastModified: new Date().toISOString(),
        lections: getAllLections(),
        progress: state.learningProgress
    };

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify({ mimeType: SYNC_CONFIG.MIME_TYPE }) +
        delimiter +
        'Content-Type: ' + SYNC_CONFIG.MIME_TYPE + '\r\n\r\n' +
        JSON.stringify(data, null, 2) +
        close_delim;

    const headers = {
        'Content-Type': `multipart/related; boundary="${boundary}"`,
        'Authorization': `Bearer ${googleAuth.accessToken}`
    };

    const url = `https://www.googleapis.com/upload/drive/v3/files/${syncState.fileId}?uploadType=multipart`;

    try {
        // Note: We don't await this. `keepalive` handles it.
        if (navigator.sendBeacon) {
            const blob = new Blob([multipartRequestBody], { type: `multipart/related; boundary="${boundary}"` });
            const didSend = navigator.sendBeacon(url, blob);
            if (didSend) {
                console.log('Pending sync request sent via sendBeacon on page close.');
            } else {
                console.error('sendBeacon failed to queue the sync request.');
            }
        } else {
            fetch(url, {
                method: 'PATCH',
                headers: headers,
                body: multipartRequestBody,
                keepalive: true
            });
            console.log('Pending sync request sent via fetch(keepalive) on page close.');
        }
    } catch (error) {
        console.error('Could not initiate final sync on page close:', error);
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
    
    if (lastSyncTimeEl) {
        if (syncState.lastSyncTime && status !== 'not-synced') {
            const timeAgo = getTimeAgo(syncState.lastSyncTime);
            lastSyncTimeEl.textContent = `Last synced: ${timeAgo}`;
            lastSyncTimeEl.className = 'last-sync-time';
        } else {
            lastSyncTimeEl.textContent = '';
        }
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

// Manual sync button handler
function handleManualSync() {
    if (!isGoogleAuthenticated()) {
        alert('Please sign in to Google first.');
        return;
    }
    
    syncFromGoogleDrive(false);
}

// Call this function to initialize the Google Drive sync module
initGoogleDriveSync();
