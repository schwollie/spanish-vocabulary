// ============================================
// LECTIONS MODULE - Loading and Managing Lections from LocalStorage
// ============================================

// Load lections from localStorage
async function loadLections() {
    const lectionList = document.getElementById('lectionList');
    lectionList.innerHTML = '';

    // Initialize default lections if none exist
    // Skip if user is signed in - wait for Firebase sync instead
    initializeDefaultLections(true); // Pass true to skip if signed in
    
    // Get all lections from localStorage
    const lections = getAllLections();
    
    // Convert to state format with proper numbering
    lections.forEach((lection, index) => {
        const stateLection = {
            number: index,
            name: lection.name,
            id: lection.id,
            vocabularies: lection.vocabularies
        };
        
        state.lections.push(stateLection);
        createLectionCheckbox(stateLection, lectionList);
    });

    // Sort lections by number (already in order from localStorage)
    state.lections.sort((a, b) => a.number - b.number);
}

// Create checkbox for lection
function createLectionCheckbox(lection, container) {
    const div = document.createElement('div');
    div.className = 'lection-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `lection-${lection.number}`;
    checkbox.value = lection.number;
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            state.selectedLections.add(lection.number);
        } else {
            state.selectedLections.delete(lection.number);
        }
        updateVocabularies();
    });

    const label = document.createElement('label');
    label.htmlFor = `lection-${lection.number}`;
    label.textContent = `${lection.number} - ${lection.name}`;

    const selectUpToBtn = document.createElement('button');
    selectUpToBtn.className = 'select-up-to-btn';
    selectUpToBtn.innerHTML = '⤴';
    selectUpToBtn.title = `Select all lections up to ${lection.number}`;
    selectUpToBtn.addEventListener('click', (e) => {
        e.preventDefault();
        selectLectionsUpTo(lection.number);
    });

    div.appendChild(checkbox);
    div.appendChild(label);
    div.appendChild(selectUpToBtn);
    container.appendChild(div);
}

// Update vocabularies based on selected lections
function updateVocabularies() {
    state.vocabularies = [];
    
    for (const lection of state.lections) {
        if (state.selectedLections.has(lection.number)) {
            state.vocabularies.push(...lection.vocabularies);
        }
    }

    updateVocabularyCount();
    resetCard();
}

// Update vocabulary count display
function updateVocabularyCount() {
    const countElement = document.getElementById('vocabCount');
    
    if (state.selectionMode === 'spaced') {
        // Show remaining vocabularies in session pool
        const remainingInSession = getSessionPoolCount();
        const totalDue = getDueVocabulariesCount();
        
        if (remainingInSession > 0) {
            countElement.textContent = `${remainingInSession} remaining | ${totalDue} total due for review`;
        } else {
            countElement.textContent = `${totalDue} vocabularies due for review`;
        }
    } else {
        // Show remaining vocabularies in session pool
        const remainingInSession = getSessionPoolCount();
        
        if (remainingInSession > 0 && remainingInSession < state.vocabularies.length) {
            countElement.textContent = `${remainingInSession} remaining | ${state.vocabularies.length} total`;
        } else {
            countElement.textContent = `${state.vocabularies.length} vocabularies loaded`;
        }
    }
}

// Select lections up to a specific number
function selectLectionsUpTo(maxNumber) {
    for (const lection of state.lections) {
        if (lection.number <= maxNumber) {
            state.selectedLections.add(lection.number);
            const checkbox = document.getElementById(`lection-${lection.number}`);
            if (checkbox) checkbox.checked = true;
        }
    }
    updateVocabularies();
}

// Select all lections
function selectAllLections() {
    for (const lection of state.lections) {
        state.selectedLections.add(lection.number);
        const checkbox = document.getElementById(`lection-${lection.number}`);
        if (checkbox) checkbox.checked = true;
    }
    updateVocabularies();
}

// Clear all lections
function clearAllLections() {
    state.selectedLections.clear();
    for (const lection of state.lections) {
        const checkbox = document.getElementById(`lection-${lection.number}`);
        if (checkbox) checkbox.checked = false;
    }
    updateVocabularies();
}
