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
}

// Get lection order
function getLectionOrder() {
    return JSON.parse(localStorage.getItem('lectionOrder') || '[]');
}

// Save lection order
function saveLectionOrder(order) {
    localStorage.setItem('lectionOrder', JSON.stringify(order));
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
function initializeDefaultLections() {
    const lections = getAllLections();
    
    if (lections.length === 0) {
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
    }
}
