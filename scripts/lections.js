// ============================================
// LECTIONS MODULE - Loading and Managing Lections
// ============================================

// Load lection files
async function loadLections() {
    // Load lection list from JSON file
    let lectionFiles = [];
    try {
        const response = await fetch('lections.json');
        if (response.ok) {
            lectionFiles = await response.json();
        }
    } catch (error) {
        console.error('Error loading lections.json:', error);
        // Fallback to default lections
        lectionFiles = [
            '0-Para Empezar.txt',
            '1-Leccion 1.txt'
        ];
    }

    const lectionList = document.getElementById('lectionList');
    lectionList.innerHTML = '';

    for (const file of lectionFiles) {
        const match = file.match(/^(\d+)-(.+)\.txt$/);
        if (match) {
            const number = match[1];
            const name = match[2];
            
            const lection = {
                number: parseInt(number),
                name: name,
                filename: file,
                vocabularies: []
            };

            // Try to load the file
            try {
                const response = await fetch(`lections/${file}`);
                if (response.ok) {
                    const content = await response.text();
                    lection.vocabularies = parseVocabularies(content);
                    state.lections.push(lection);
                    
                    // Create checkbox for this lection
                    createLectionCheckbox(lection, lectionList);
                }
            } catch (error) {
                console.error(`Error loading ${file}:`, error);
            }
        }
    }

    // Sort lections by number
    state.lections.sort((a, b) => a.number - b.number);
}

// Parse vocabulary file content
function parseVocabularies(content) {
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
