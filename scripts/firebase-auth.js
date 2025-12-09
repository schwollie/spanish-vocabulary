// ============================================
// FIREBASE AUTH MODULE - Google Sign-In with Firebase
// ============================================

import {
    auth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from './firebase-config.js';

let firebaseAuth = {
    isSignedIn: false,
    user: null,
    userId: null
};

// Initialize Firebase Authentication
function initFirebaseAuth() {
    return new Promise((resolve) => {
        console.log('🔐 Initializing Firebase Authentication...');
        
        let firstCall = true;
        
        // Listen for auth state changes
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // User is signed in
                firebaseAuth.isSignedIn = true;
                firebaseAuth.user = {
                    name: user.displayName,
                    email: user.email,
                    imageUrl: user.photoURL
                };
                firebaseAuth.userId = user.uid;
                
                console.log('✅ User signed in:', firebaseAuth.user.email);
                updateFirebaseAuthUI(true);
                
                // Start real-time sync listeners
                if (typeof initFirebaseSync === 'function') {
                    initFirebaseSync();
                }
            } else {
                // User is signed out
                firebaseAuth.isSignedIn = false;
                firebaseAuth.user = null;
                firebaseAuth.userId = null;
                
                console.log('❌ User signed out');
                updateFirebaseAuthUI(false);
                
                // Stop sync listeners
                if (typeof stopFirebaseSync === 'function') {
                    stopFirebaseSync();
                }
            }
            
            // Resolve on first auth state check (signed in or out)
            if (firstCall) {
                firstCall = false;
                resolve();
            }
        });
    });
}

// Sign in with Google
async function signInToGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        
        console.log('✅ Sign-in successful:', result.user.email);
        // Auth state change listener will handle the rest
        
    } catch (error) {
        console.error('❌ Sign-in error:', error);
        
        if (error.code === 'auth/popup-closed-by-user') {
            // User closed popup, no alert needed
            return;
        }
        
        alert('Sign-in failed: ' + error.message);
    }
}

// Sign out from Google
async function signOutFromGoogle() {
    if (!confirm('Sign out from Firebase sync? Your data will remain in localStorage.')) {
        return;
    }
    
    try {
        await firebaseSignOut(auth);
        console.log('✅ Sign-out successful');
        alert('Signed out from Firebase sync.');
    } catch (error) {
        console.error('❌ Sign-out error:', error);
        alert('Sign-out failed: ' + error.message);
    }
}

// Update UI based on auth status
function updateFirebaseAuthUI(isSignedIn) {
    const signInBtn = document.getElementById('googleSignInBtn');
    const userInfo = document.getElementById('googleUserInfo');
    const manualSyncBtn = document.getElementById('manualSyncBtn');
    
    if (isSignedIn) {
        if (signInBtn) {
            signInBtn.innerHTML = '<span class="btn-icon">🔓</span><span>Sign Out</span>';
            signInBtn.onclick = signOutFromGoogle;
            signInBtn.classList.add('signed-in');
        }
        
        if (userInfo && firebaseAuth.user) {
            userInfo.innerHTML = `
                <img src="${firebaseAuth.user.imageUrl}" alt="Profile" class="profile-img">
                <span class="user-email">${firebaseAuth.user.email}</span>
            `;
            userInfo.style.display = 'flex';
        }
        
        if (manualSyncBtn) {
            manualSyncBtn.style.display = 'inline-block';
        }
        
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
        
        if (typeof updateSyncStatusUI === 'function') {
            updateSyncStatusUI('not-synced');
        }
    }
}

// Check if user is authenticated
function isFirebaseAuthenticated() {
    return firebaseAuth.isSignedIn && firebaseAuth.userId;
}

// Get current user info
function getFirebaseUser() {
    return firebaseAuth.user;
}

// Get current user ID
function getFirebaseUserId() {
    return firebaseAuth.userId;
}

// Expose functions globally for compatibility
window.initFirebaseAuth = initFirebaseAuth;
window.signInToGoogle = signInToGoogle;
window.signOutFromGoogle = signOutFromGoogle;
window.isFirebaseAuthenticated = isFirebaseAuthenticated;
window.getFirebaseUser = getFirebaseUser;
window.getFirebaseUserId = getFirebaseUserId;
