// ============================================
// LECTION MANAGER - UI Logic for Managing Lections
// ============================================

let editingLectionId = null;
let draggedElement = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializeDefaultLections();
    displayLections();
});

// Display all lections
function displayLections() {
    const lectionsList = document.getElementById('lectionsList');
    const lections = getAllLections();
    
    if (lections.length === 0) {
        lectionsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p>No lections yet. Add your first lection above!</p>
            </div>
        `;
        return;
    }
    
    lectionsList.innerHTML = '';
    
    lections.forEach((lection, index) => {
        const card = createLectionCard(lection, index);
        lectionsList.appendChild(card);
    });
}

// Create a lection card element
function createLectionCard(lection, index) {
    const div = document.createElement('div');
    div.className = 'lection-card';
    div.draggable = true;
    div.dataset.lectionId = lection.id;
    
    // Drag and drop event listeners
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragend', handleDragEnd);
    div.addEventListener('dragover', handleDragOver);
    div.addEventListener('drop', handleDrop);
    div.addEventListener('dragleave', handleDragLeave);
    
    div.innerHTML = `
        <div class="lection-header">
            <div class="lection-title">
                <span class="lection-number">${index}</span>
                <span class="lection-name">${lection.name}</span>
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
