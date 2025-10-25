// ============================================
// GOOGLE AUTH MODULE - OAuth 2.0 Authentication (New GIS Library)
// ============================================


const GOOGLE_CONFIG = {
    CLIENT_ID: '931861801833-fr47cejssp6g1ug7shshptrf0ph423da.apps.googleusercontent.com',
    API_KEY: 'AIzaSyBbhYUWpa0YuvX2Xb1Uv9Hm8qqfrgQK_Qk',
    SCOPES: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'
};

let googleAuth = {
    isSignedIn: false,
    user: null,
    accessToken: null,
    tokenClient: null
};

// Initialize Google API
function initGoogleAuth() {
    return new Promise((resolve, reject) => {
        // Load the Google API client library
        gapi.load('client', async () => {
            try {
                console.log('Initializing gapi client...');
                
                await gapi.client.init({
                    apiKey: GOOGLE_CONFIG.API_KEY,
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
                });

                console.log('Gapi client initialized successfully');

                // Initialize the Token Client for OAuth
                googleAuth.tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CONFIG.CLIENT_ID,
                    scope: GOOGLE_CONFIG.SCOPES,
                    callback: (response) => {
                        console.log('OAuth callback received:', response);
                        
                        if (response.error) {
                            console.error('Token error:', response);
                            updateGoogleAuthUI(false);
                            return;
                        }
                        
                        if (!response.access_token) {
                            console.error('No access token in response');
                            updateGoogleAuthUI(false);
                            return;
                        }
                        
                        // Set token in all places immediately
                        googleAuth.accessToken = response.access_token;
                        googleAuth.isSignedIn = true;
                        
                        // Set token in gapi client for API calls
                        gapi.client.setToken({ access_token: response.access_token });
                        
                        // Store token for persistence
                        localStorage.setItem('googleAccessToken', response.access_token);
                        
                        console.log('Token set, calling getUserInfo...');
                        
                        // Small delay to ensure token is properly set
                        setTimeout(() => {
                            getUserInfo();
                        }, 100);
                    },
                });

                // Check if we have a stored token and user info
                const storedToken = localStorage.getItem('googleAccessToken');
                const storedUser = localStorage.getItem('googleUser');
                
                if (storedToken && storedUser) {
                    googleAuth.accessToken = storedToken;
                    googleAuth.user = JSON.parse(storedUser);
                    googleAuth.isSignedIn = true;
                    gapi.client.setToken({ access_token: storedToken });
                    
                    // Validate token by checking if it still works
                    validateAndRefreshToken();
                } else {
                    updateGoogleAuthUI(false);
                }
                
                resolve();
            } catch (error) {
                console.error('Error initializing Google Auth:', error);
                reject(error);
            }
        });
    });
}

// Validate token and refresh if expired
async function validateAndRefreshToken() {
    if (!googleAuth.accessToken) {
        console.error('No access token to validate');
        clearAuthState();
        updateGoogleAuthUI(false);
        return;
    }
    
    try {
        // Set token in gapi client for Drive API calls
        gapi.client.setToken({ access_token: googleAuth.accessToken });
        
        // Validate token using fetch (userinfo endpoint doesn't work well with gapi.client)
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${googleAuth.accessToken}`
            }
        });
        
        if (response.ok) {
            // Token is valid
            updateGoogleAuthUI(true);
            console.log('Token validated. Signed in as:', googleAuth.user.email);
            
            // Auto-sync on successful validation
            if (typeof syncFromGoogleDrive === 'function') {
                syncFromGoogleDrive(true); // silent mode
            }
        } else if (response.status === 401) {
            // Token expired, need to re-authenticate
            console.log('Token expired, clearing auth state');
            clearAuthState();
            updateGoogleAuthUI(false);
        }
    } catch (error) {
        console.error('Error validating token:', error);
        clearAuthState();
        updateGoogleAuthUI(false);
    }
}

// Get user information
async function getUserInfo() {
    console.log('getUserInfo called, token:', googleAuth.accessToken ? 'present' : 'missing');
    
    if (!googleAuth.accessToken) {
        console.error('No access token available');
        return;
    }
    
    try {
        console.log('Making request to userinfo endpoint...');
        
        // Use fetch with Authorization header for userinfo endpoint
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${googleAuth.accessToken}`
            }
        });
        
        console.log('Userinfo response status:', response.status);
        
        if (response.ok) {
            const userInfo = await response.json();
            googleAuth.user = {
                name: userInfo.name,
                email: userInfo.email,
                imageUrl: userInfo.picture
            };
            
            // Store user info for persistence
            localStorage.setItem('googleUser', JSON.stringify(googleAuth.user));
            
            updateGoogleAuthUI(true);
            console.log('Signed in as:', googleAuth.user.email);
            
            // Auto-sync on sign-in
            if (typeof syncFromGoogleDrive === 'function') {
                syncFromGoogleDrive(true); // silent mode
            }
        } else if (response.status === 401) {
            console.log('Token expired during getUserInfo');
            clearAuthState();
            updateGoogleAuthUI(false);
        }
    } catch (error) {
        console.error('Error getting user info:', error);
        clearAuthState();
        updateGoogleAuthUI(false);
    }
}

// Clear auth state
function clearAuthState() {
    googleAuth.isSignedIn = false;
    googleAuth.user = null;
    googleAuth.accessToken = null;
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleUser');
    gapi.client.setToken(null);
}

// Sign in to Google
function signInToGoogle() {
    if (googleAuth.tokenClient) {
        googleAuth.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        alert('Google Sign-In is not initialized yet. Please try again in a moment.');
    }
}

// Sign out from Google
function signOutFromGoogle() {
    if (confirm('Sign out from Google Drive sync? Your data will remain in localStorage.')) {
        if (googleAuth.accessToken) {
            // Revoke the token
            google.accounts.oauth2.revoke(googleAuth.accessToken, () => {
                console.log('Token revoked');
            });
        }
        
        // Clear auth state
        clearAuthState();
        
        updateGoogleAuthUI(false);
        alert('Signed out from Google Drive sync.');
    }
}

// Update UI based on auth status
function updateGoogleAuthUI(isSignedIn) {
    const signInBtn = document.getElementById('googleSignInBtn');
    const userInfo = document.getElementById('googleUserInfo');
    const manualSyncBtn = document.getElementById('manualSyncBtn');
    
    if (isSignedIn) {
        // Store token for persistence
        if (googleAuth.accessToken) {
            localStorage.setItem('googleAccessToken', googleAuth.accessToken);
            gapi.client.setToken({ access_token: googleAuth.accessToken });
        }
        
        if (signInBtn) {
            signInBtn.innerHTML = '<span class="btn-icon">🔓</span><span>Sign Out</span>';
            signInBtn.onclick = signOutFromGoogle;
            signInBtn.classList.add('signed-in');
        }
        
        if (userInfo && googleAuth.user) {
            userInfo.innerHTML = `
                <img src="${googleAuth.user.imageUrl}" alt="Profile" class="profile-img">
                <span class="user-email">${googleAuth.user.email}</span>
            `;
            userInfo.style.display = 'flex';
        }
        
        if (manualSyncBtn) {
            manualSyncBtn.style.display = 'inline-block';
        }
        
        // Use the updateSyncStatusUI function from google-drive-sync
        if (typeof updateSyncStatusUI === 'function') {
            updateSyncStatusUI('synced');
        }
    } else {
        if (signInBtn) {
            signInBtn.innerHTML = '<span class="btn-icon">🔒</span><span>Sign in with Google</span>';
            signInBtn.onclick = signInToGoogle;
            signInBtn.classList.remove('signed-in');
        }
        
        if (userInfo) {
            userInfo.style.display = 'none';
            userInfo.innerHTML = '';
        }
        
        if (manualSyncBtn) {
            manualSyncBtn.style.display = 'none';
        }
        
        // Use the updateSyncStatusUI function from google-drive-sync
        if (typeof updateSyncStatusUI === 'function') {
            updateSyncStatusUI('not-synced');
        }
    }
}

// Check if user is authenticated
function isGoogleAuthenticated() {
    return googleAuth.isSignedIn && googleAuth.accessToken;
}

// Get current user info
function getGoogleUser() {
    return googleAuth.user;
}
