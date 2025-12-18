// ============================================
// LECTION STORAGE MODULE - LocalStorage Management
// ============================================

// Get all lections from localStorage
function getAllLections() {
    const lections = [];
    const lectionOrder = JSON.parse(localStorage.getItem('lectionOrder') || '[]');
    
    for (const id of lectionOrder) {
        const lectionData = localStorage.getItem(`lection_${id}`);
        if (lectionData) {
            try {
                const lection = JSON.parse(lectionData);
                lections.push(lection);
            } catch (e) {
                console.error(`Error parsing lection ${id}:`, e);
            }
        }
    }
    
    return lections;
}

// Save a lection to localStorage
function saveLectionToStorage(lection) {
    try {
        localStorage.setItem(`lection_${lection.id}`, JSON.stringify(lection));
        
        // Sync to Firebase if authenticated (async, don't wait)
        setTimeout(() => {
            if (typeof window.syncLectionToFirebase === 'function') {
                window.syncLectionToFirebase(lection);
                console.log('🔄 Syncing lection to Firebase:', lection.name);
            } else {
                console.log('⚠️ Firebase sync not available yet');
            }
        }, 100);
        
        return true;
    } catch (e) {
        console.error('Error saving lection:', e);
        alert('Error: Storage quota exceeded. Please delete some lections.');
        return false;
    }
}

// Delete a lection from localStorage
function deleteLectionFromStorage(id) {
    localStorage.removeItem(`lection_${id}`);
    
    // Update order
    const lectionOrder = JSON.parse(localStorage.getItem('lectionOrder') || '[]');
    const newOrder = lectionOrder.filter(lectionId => lectionId !== id);
    localStorage.setItem('lectionOrder', JSON.stringify(newOrder));
    
    // Sync to Firebase if authenticated (async, don't wait)
    setTimeout(() => {
        if (typeof window.deleteLectionFromFirebase === 'function') {
            window.deleteLectionFromFirebase(id);
            console.log('🔄 Deleting lection from Firebase:', id);
        }
    }, 100);
}

// Get lection order
function getLectionOrder() {
    return JSON.parse(localStorage.getItem('lectionOrder') || '[]');
}

// Save lection order
function saveLectionOrder(order) {
    localStorage.setItem('lectionOrder', JSON.stringify(order));
    
    // Sync to Firebase if authenticated (async, don't wait)
    setTimeout(() => {
        if (typeof window.syncLectionOrderToFirebase === 'function') {
            window.syncLectionOrderToFirebase(order);
            console.log('🔄 Syncing lection order to Firebase');
        }
    }, 100);
}

// Generate unique ID for new lection
function generateLectionId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${timestamp}_${random}`;
}

// Parse vocabulary content (same format as before: spanish ## german)
function parseVocabularyContent(content) {
    const lines = content.split('\n');
    const vocabularies = [];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && trimmedLine.includes('##')) {
            const parts = trimmedLine.split('##');
            if (parts.length === 2) {
                vocabularies.push({
                    spanish: parts[0].trim(),
                    german: parts[1].trim()
                });
            }
        }
    }

    return vocabularies;
}

// Convert vocabularies array back to text format
function vocabulariesToText(vocabularies) {
    return vocabularies.map(v => `${v.spanish} ## ${v.german}`).join('\n');
}

// Initialize with default lection if none exist
// Now accepts a parameter to skip initialization if we expect data from Firebase
function initializeDefaultLections(skipIfSignedIn = false) {
    // If user might have Firebase data, don't create defaults yet
    if (skipIfSignedIn && typeof isFirebaseAuthenticated === 'function' && isFirebaseAuthenticated()) {
        console.log('⏳ Skipping default lection creation - waiting for Firebase sync');
        return false; // Indicate that defaults were not created
    }
    
    const lections = getAllLections();
    
    if (lections.length === 0) {
        console.log('📝 Creating default lection (no Drive data expected)');
        // Create default "Para Empezar" lection
        const defaultId = generateLectionId();
        const defaultLection = {
            id: defaultId,
            name: 'Para Empezar',
            vocabularies: [
                { spanish: 'hola', german: 'Hallo' },
                { spanish: 'buenos días', german: 'Guten Morgen' },
                { spanish: 'gracias', german: 'danke' },
                { spanish: 'por favor', german: 'bitte' }
            ]
        };
        
        saveLectionToStorage(defaultLection);
        saveLectionOrder([defaultId]);
        return true; // Indicate that defaults were created
    }
    
    return false; // Already had lections
}

// ============================================
// COMMON WORDS LECTIONS - Read-only Default Lections
// ============================================

// List of all commonWords files
const COMMON_WORDS_FILES = [
    '1-100.txt',
    '101-200.txt',
    '201-300.txt',
    '301-400.txt',
    '401-500.txt',
    '501-600.txt',
    '601-700.txt',
    '701-800.txt',
    '801-900.txt',
    '901-1000.txt',
    '1001-1100.txt',
    '1101-1200.txt',
    '1201-1300.txt',
    '1301-1400.txt',
    '1401-1500.txt',
    '1501-1600.txt'
];

// Load all commonWords lections from text files
async function loadCommonWordsLections() {
    const lections = [];
    
    for (let i = 0; i < COMMON_WORDS_FILES.length; i++) {
        const filename = COMMON_WORDS_FILES[i];
        const cwNumber = i + 1;
        const range = filename.replace('.txt', '');
        
        try {
            const response = await fetch(`commonWords/${filename}`);
            if (!response.ok) {
                console.warn(`Failed to load ${filename}`);
                continue;
            }
            
            const content = await response.text();
            const vocabularies = parseVocabularyContent(content);
            
            if (vocabularies.length > 0) {
                lections.push({
                    id: `commonWords_${range}`,
                    name: `CW${cwNumber}: ${range}`,
                    vocabularies: vocabularies,
                    isCommonWord: true,
                    range: range,
                    cwNumber: cwNumber
                });
            }
        } catch (error) {
            console.error(`Error loading ${filename}:`, error);
        }
    }
    
    return lections;
}
