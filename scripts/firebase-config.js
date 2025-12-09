// ============================================
// FIREBASE CONFIG - Initialize Firebase
// ============================================

// Import Firebase modules (using modular SDK v9+)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase, ref, set, get, onValue, remove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDjpUX2t1lXoGlHEjmLlYznPgVJysZNNSk",
    authDomain: "spanishvocabulary-69ed6.firebaseapp.com",
    databaseURL: "https://spanishvocabulary-69ed6-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "spanishvocabulary-69ed6",
    storageBucket: "spanishvocabulary-69ed6.firebasestorage.app",
    messagingSenderId: "226938642282",
    appId: "1:226938642282:web:a10041a860b3776c190f13"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Export Firebase instances and functions
export {
    auth,
    database,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    ref,
    set,
    get,
    onValue,
    remove
};

console.log('🔥 Firebase initialized successfully');
