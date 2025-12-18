// ============================================
// LECTIONS MODULE - Loading and Managing Lections from LocalStorage
// ============================================

// Load lections from localStorage
async function loadLections() {
    const lectionList = document.getElementById('lectionList');
    lectionList.innerHTML = '';
    state.lections = [];
    state.selectedLections.clear();

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
            vocabularies: lection.vocabularies,
            isCommonWord: false
        };
        
        state.lections.push(stateLection);
        createLectionCheckbox(stateLection, lectionList);
    });

    // Sort lections by number (already in order from localStorage)
    state.lections.sort((a, b) => a.number - b.number);
    
    // Add separator for commonWords section
    const separator = document.createElement('div');
    separator.className = 'lection-separator';
    separator.innerHTML = '<h3>Common Spanish Words (Read-Only)</h3>';
    lectionList.appendChild(separator);
    
    // Load and add commonWords lections
    const commonWordsLections = await loadCommonWordsLections();
    const userLectionsCount = state.lections.length;
    
    commonWordsLections.forEach((lection, index) => {
        const stateLection = {
            number: userLectionsCount + index,
            name: lection.name,
            id: lection.id,
            vocabularies: lection.vocabularies,
            isCommonWord: true,
            cwNumber: lection.cwNumber,
            range: lection.range
        };
        
        state.lections.push(stateLection);
        createLectionCheckbox(stateLection, lectionList);
    });
}

// Create checkbox for lection
function createLectionCheckbox(lection, container) {
    const div = document.createElement('div');
    div.className = lection.isCommonWord ? 'lection-item common-word-item' : 'lection-item';

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
    
    // Show CW number for commonWords, regular number for user lections
    if (lection.isCommonWord) {
        label.textContent = `${lection.name} (${lection.vocabularies.length} words)`;
    } else {
        label.textContent = `${lection.number} - ${lection.name}`;
    }

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
    
    // Only add select-up-to button for user lections
    if (!lection.isCommonWord) {
        div.appendChild(selectUpToBtn);
    }

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

    savePreferences(); // Save selected lections
    updateVocabularyCount();
    updatePhaseCountDisplay();
    
    // Update forecast display when vocabularies change
    if (typeof updateForecastDisplay === 'function') {
        updateForecastDisplay();
    }
    
    resetCard();
}

// Update vocabulary count display
function updateVocabularyCount() {
    const countElement = document.getElementById('vocabCount');
    const totalLoaded = state.vocabularies.length;
    
    if (state.selectionMode === 'spaced') {
        // Show total loaded + due for review in current direction
        const currentDirection = state.mode === 'random' ? 'spanishToGerman' : state.mode;
        const dueCount = getDueVocabulariesCount(currentDirection);
        const remainingInSession = getSessionPoolCount();
        
        if (remainingInSession > 0) {
            countElement.textContent = `${totalLoaded} loaded | ${dueCount} due for review | ${remainingInSession} remaining`;
        } else {
            countElement.textContent = `${totalLoaded} loaded | ${dueCount} due for review`;
        }
    } else {
        // Random mode: just show total loaded
        const remainingInSession = getSessionPoolCount();
        
        if (remainingInSession > 0 && remainingInSession < totalLoaded) {
            countElement.textContent = `${totalLoaded} loaded | ${remainingInSession} remaining`;
        } else {
            countElement.textContent = `${totalLoaded} vocabularies loaded`;
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
