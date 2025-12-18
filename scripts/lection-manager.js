// ============================================
// LECTION MANAGER - UI Logic for Managing Lections
// ============================================

let editingLectionId = null;
let draggedElement = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', async function() {
    // Wait for Firebase auth to initialize (if available)
    if (typeof window.initFirebaseAuth === 'function') {
        await window.initFirebaseAuth();
        console.log('✅ Firebase auth ready on manage page');
    } else {
        // If Firebase not loaded yet, wait a bit
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    initializeDefaultLections();
    await displayLections();
    
    // Setup import default lections button
    const importDefaultBtn = document.getElementById('importDefaultLectionsBtn');
    if (importDefaultBtn) {
        importDefaultBtn.addEventListener('click', importDefaultLections);
    }
});

// Display all lections
async function displayLections() {
    const lectionsList = document.getElementById('lectionsList');
    const lections = getAllLections();
    
    if (lections.length === 0) {
        lectionsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p>No lections yet. Add your first lection above!</p>
            </div>
        `;
    } else {
        lectionsList.innerHTML = '';
        
        lections.forEach((lection, index) => {
            const card = createLectionCard(lection, index, false);
            lectionsList.appendChild(card);
        });
    }
    
    // Add separator for commonWords section
    const separator = document.createElement('div');
    separator.className = 'lection-separator';
    separator.innerHTML = '<h2>Common Spanish Words (Read-Only)</h2>';
    lectionsList.appendChild(separator);
    
    // Load and display commonWords lections
    const commonWordsLections = await loadCommonWordsLections();
    
    if (commonWordsLections.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.color = '#666';
        emptyMsg.textContent = 'No common words available.';
        lectionsList.appendChild(emptyMsg);
    } else {
        commonWordsLections.forEach((lection) => {
            const card = createLectionCard(lection, null, true);
            lectionsList.appendChild(card);
        });
    }
}

// Create a lection card element
function createLectionCard(lection, index, isReadOnly = false) {
    const div = document.createElement('div');
    div.className = isReadOnly ? 'lection-card read-only-card' : 'lection-card';
    div.draggable = !isReadOnly; // Disable dragging for read-only cards
    div.dataset.lectionId = lection.id;
    
    // Only add drag and drop event listeners for non-read-only cards
    if (!isReadOnly) {
        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragend', handleDragEnd);
        div.addEventListener('dragover', handleDragOver);
        div.addEventListener('drop', handleDrop);
        div.addEventListener('dragleave', handleDragLeave);
    }
    
    // For read-only cards, show CW name directly without index number
    const displayName = isReadOnly ? lection.name : `${index}`;
    const lectionName = isReadOnly ? `(${lection.vocabularies.length} words)` : lection.name;
    
    if (isReadOnly) {
        // Read-only card: no edit/delete buttons
        div.innerHTML = `
            <div class="lection-header">
                <div class="lection-title">
                    <span class="lection-number">${displayName}</span>
                    <span class="lection-name">${lectionName}</span>
                </div>
            </div>
            <div class="lection-vocab-count">
                ${lection.vocabularies.length} vocabularies
            </div>
        `;
    } else {
        // Regular card: with edit/delete buttons
        div.innerHTML = `
            <div class="lection-header">
                <div class="lection-title">
                    <span class="lection-number">${displayName}</span>
                    <span class="lection-name">${lectionName}</span>
                </div>
                <div class="lection-actions">
                    <button class="drag-handle" title="Drag to reorder">⋮⋮</button>
                    <button class="btn-edit" onclick="editLection('${lection.id}')">✏️ Edit</button>
                    <button class="btn-delete" onclick="deleteLection('${lection.id}')">🗑️ Delete</button>
                </div>
            </div>
            <div class="lection-vocab-count">
                ${lection.vocabularies.length} vocabularies
            </div>
        `;
    }
    
    return div;
}

// Add new lection
function addLection() {
    const name = document.getElementById('lectionName').value.trim();
    const content = document.getElementById('lectionContent').value.trim();
    
    if (!name) {
        alert('Please enter a lection name.');
        return;
    }
    
    if (!content) {
        alert('Please enter vocabularies.');
        return;
    }
    
    const vocabularies = parseVocabularyContent(content);
    
    if (vocabularies.length === 0) {
        alert('No valid vocabularies found. Please use the format: spanish ## german');
        return;
    }
    
    const id = generateLectionId();
    const lection = {
        id: id,
        name: name,
        vocabularies: vocabularies
    };
    
    // Save to localStorage
    if (saveLectionToStorage(lection)) {
        // Add to order
        const order = getLectionOrder();
        order.push(id);
        saveLectionOrder(order);
        
        // Clear form
        document.getElementById('lectionName').value = '';
        document.getElementById('lectionContent').value = '';
        
        // Refresh display
        displayLections();
        
        alert(`Lection "${name}" added successfully with ${vocabularies.length} vocabularies!`);
    }
}

// Edit lection
function editLection(id) {
    const lectionData = localStorage.getItem(`lection_${id}`);
    if (!lectionData) {
        alert('Lection not found.');
        return;
    }
    
    const lection = JSON.parse(lectionData);
    editingLectionId = id;
    
    // Fill edit form
    document.getElementById('editLectionName').value = lection.name;
    document.getElementById('editLectionContent').value = vocabulariesToText(lection.vocabularies);
    
    // Show edit form, hide add form
    document.getElementById('addForm').style.display = 'none';
    document.getElementById('editForm').style.display = 'block';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Save edited lection
function saveLection() {
    if (!editingLectionId) return;
    
    const name = document.getElementById('editLectionName').value.trim();
    const content = document.getElementById('editLectionContent').value.trim();
    
    if (!name) {
        alert('Please enter a lection name.');
        return;
    }
    
    if (!content) {
        alert('Please enter vocabularies.');
        return;
    }
    
    const vocabularies = parseVocabularyContent(content);
    
    if (vocabularies.length === 0) {
        alert('No valid vocabularies found. Please use the format: spanish ## german');
        return;
    }
    
    const lection = {
        id: editingLectionId,
        name: name,
        vocabularies: vocabularies
    };
    
    // Save to localStorage
    if (saveLectionToStorage(lection)) {
        cancelEdit();
        displayLections();
        alert(`Lection "${name}" updated successfully!`);
    }
}

// Cancel edit
function cancelEdit() {
    editingLectionId = null;
    document.getElementById('addForm').style.display = 'block';
    document.getElementById('editForm').style.display = 'none';
    document.getElementById('editLectionName').value = '';
    document.getElementById('editLectionContent').value = '';
}

// Delete lection
function deleteLection(id) {
    const lectionData = localStorage.getItem(`lection_${id}`);
    if (!lectionData) {
        alert('Lection not found.');
        return;
    }
    
    const lection = JSON.parse(lectionData);
    
    // Double confirmation
    if (!confirm(`Are you sure you want to delete "${lection.name}"?`)) {
        return;
    }
    
    if (!confirm(`This will permanently delete "${lection.name}" with ${lection.vocabularies.length} vocabularies. This cannot be undone. Are you absolutely sure?`)) {
        return;
    }
    
    // Delete from storage
    deleteLectionFromStorage(id);
    
    // Refresh display
    displayLections();
    
    alert(`Lection "${lection.name}" deleted successfully.`);
}

// Drag and drop handlers
function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    
    // Remove all drag-over classes
    document.querySelectorAll('.lection-card').forEach(card => {
        card.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    e.dataTransfer.dropEffect = 'move';
    
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
    
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        // Get current order
        const order = getLectionOrder();
        
        const draggedId = draggedElement.dataset.lectionId;
        const droppedOnId = this.dataset.lectionId;
        
        const draggedIndex = order.indexOf(draggedId);
        const droppedOnIndex = order.indexOf(droppedOnId);
        
        // Remove dragged element from array
        order.splice(draggedIndex, 1);
        
        // Insert at new position
        const newIndex = draggedIndex < droppedOnIndex ? droppedOnIndex : droppedOnIndex;
        order.splice(newIndex, 0, draggedId);
        
        // Save new order
        saveLectionOrder(order);
        
        // Refresh display
        displayLections();
    }
    
    this.classList.remove('drag-over');
    
    return false;
}

// Import all default lections from text files
async function importDefaultLections() {
    const defaultLections = [
        { file: '0-Para Empezar.txt', name: 'Para Empezar' },
        { file: '1-Leccion 1.txt', name: 'Lección 1' },
        { file: '2-Leccion 2.txt', name: 'Lección 2' },
        { file: '3-Leccion 3.txt', name: 'Lección 3' },
        { file: '4-Lecction 4.txt', name: 'Lección 4' },
        { file: '5-adjectivos.txt', name: 'Adjetivos' }
    ];
    
    if (!confirm(`Import all ${defaultLections.length} default lections? This will add them to your existing lections.`)) {
        return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const lectionInfo of defaultLections) {
        try {
            const response = await fetch(`lections/${lectionInfo.file}`);
            
            if (!response.ok) {
                console.error(`Failed to load ${lectionInfo.file}`);
                errorCount++;
                continue;
            }
            
            const content = await response.text();
            const vocabularies = parseVocabularyContent(content);
            
            if (vocabularies.length === 0) {
                console.error(`No vocabularies found in ${lectionInfo.file}`);
                errorCount++;
                continue;
            }
            
            // Check if lection with same name already exists
            const existingLections = getAllLections();
            const alreadyExists = existingLections.some(l => l.name === lectionInfo.name);
            
            if (alreadyExists) {
                console.log(`Skipping ${lectionInfo.name} - already exists`);
                continue;
            }
            
            // Create new lection
            const id = generateLectionId();
            const lection = {
                id: id,
                name: lectionInfo.name,
                vocabularies: vocabularies
            };
            
            // Save to localStorage and Firebase
            if (saveLectionToStorage(lection)) {
                // Update order
                const order = getLectionOrder();
                order.push(id);
                saveLectionOrder(order);
                
                successCount++;
                console.log(`✅ Imported: ${lectionInfo.name} (${vocabularies.length} vocabularies)`);
            } else {
                errorCount++;
            }
            
        } catch (error) {
            console.error(`Error importing ${lectionInfo.file}:`, error);
            errorCount++;
        }
    }
    
    // Refresh display
    displayLections();
    
    // Show result
    if (successCount > 0) {
        alert(`✅ Successfully imported ${successCount} lection(s)!${errorCount > 0 ? `\n⚠️ ${errorCount} file(s) failed to import.` : ''}`);
    } else {
        alert(`❌ No new lections imported.${errorCount > 0 ? `\n${errorCount} file(s) failed or already exist.` : ''}`);
    }
}
