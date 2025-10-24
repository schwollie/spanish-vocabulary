// ============================================
// STORAGE MODULE - Cookie Management & Learning Progress
// ============================================

// Spaced Repetition Intervals (phase -> days until next review)
const SPACED_INTERVALS = {
    0: 0,      // New vocabulary - show immediately
    1: 1,      // 1 day
    2: 3,      // 3 days
    3: 7,      // 1 week
    4: 14,     // 2 weeks
    5: 29,     // ~1 month
    6: 50,     // ~1.5 months
    7: 70,     // ~2.5 months
    8: 100,    // ~3 months
    9: 300     // ~10 months (for phase >= 9)
};

function getIntervalForPhase(phase) {
    if (phase >= 9) return SPACED_INTERVALS[9];
    return SPACED_INTERVALS[phase] || 0;
}

// Cookie management functions
function setCookie(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

// Learning progress functions
function getVocabKey(vocab) {
    // Create a unique key for the vocabulary
    return `${vocab.spanish}||${vocab.german}`;
}

function loadLearningProgress() {
    const progressData = getCookie('vocabularyProgress');
    if (progressData) {
        try {
            state.learningProgress = JSON.parse(progressData);
        } catch (e) {
            console.error('Error loading learning progress:', e);
            state.learningProgress = {};
        }
    }
}

function saveLearningProgress() {
    try {
        const progressData = JSON.stringify(state.learningProgress);
        setCookie('vocabularyProgress', progressData, 365);
    } catch (e) {
        console.error('Error saving learning progress:', e);
    }
}

function getVocabProgress(vocab) {
    const key = getVocabKey(vocab);
    return state.learningProgress[key] || {
        correctCount: 0,
        lastCorrect: null,
        lastWrong: null,
        nextReviewDate: null
    };
}

function updateVocabProgress(vocab, isCorrect) {
    const key = getVocabKey(vocab);
    const now = new Date();
    
    if (!state.learningProgress[key]) {
        state.learningProgress[key] = {
            correctCount: 0,
            lastCorrect: null,
            lastWrong: null,
            nextReviewDate: null
        };
    }
    
    if (isCorrect) {
        state.learningProgress[key].correctCount++;
        state.learningProgress[key].lastCorrect = now.toISOString();
        
        // Calculate next review date based on phase
        const phase = state.learningProgress[key].correctCount;
        const daysUntilReview = getIntervalForPhase(phase);
        const nextReview = new Date(now);
        nextReview.setDate(nextReview.getDate() + daysUntilReview);
        state.learningProgress[key].nextReviewDate = nextReview.toISOString();
    } else {
        // Reset to phase 0 on wrong answer
        state.learningProgress[key].correctCount = 0;
        state.learningProgress[key].lastWrong = now.toISOString();
        state.learningProgress[key].nextReviewDate = now.toISOString(); // Available immediately
    }
    
    saveLearningProgress();
}

function updateStatistics() {
    const totalLearned = Object.keys(state.learningProgress).filter(
        key => state.learningProgress[key].correctCount > 0
    ).length;
    
    const totalReviews = Object.values(state.learningProgress).reduce(
        (sum, progress) => sum + progress.correctCount, 0
    );
    
    document.getElementById('totalLearned').textContent = totalLearned;
    document.getElementById('totalReviews').textContent = totalReviews;
}

function resetLearningProgress() {
    if (confirm('Are you sure you want to reset all learning progress? This cannot be undone.')) {
        state.learningProgress = {};
        deleteCookie('vocabularyProgress');
        updateStatistics();
        displayVocabulary(); // Refresh display to hide progress badge
        alert('Learning progress has been reset.');
    }
}

// Check if a vocabulary is due for review
function isVocabularyDue(vocab) {
    const progress = getVocabProgress(vocab);
    
    // If vocabulary has never been reviewed, it's always due
    if (progress.correctCount === 0 && !progress.nextReviewDate) {
        return true;
    }
    
    // Check if next review date has passed (applies to all phases)
    if (!progress.nextReviewDate) {
        return true; // No review date set, consider it due
    }
    
    const now = new Date();
    const nextReview = new Date(progress.nextReviewDate);
    return now >= nextReview;
}

// Skip 1 day forward (for testing/adjustment)
function skipOneDay() {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    
    let updatedCount = 0;
    for (const key in state.learningProgress) {
        const progress = state.learningProgress[key];
        if (progress.nextReviewDate) {
            const nextReview = new Date(progress.nextReviewDate);
            nextReview.setDate(nextReview.getDate() - 1);
            progress.nextReviewDate = nextReview.toISOString();
            updatedCount++;
        }
    }
    
    saveLearningProgress();
    
    if (state.selectionMode === 'spaced') {
        updateVocabularies();
    }
    
    alert(`Advanced ${updatedCount} vocabularies by 1 day.`);
}

// Get count of vocabularies due for review
function getDueVocabulariesCount() {
    if (!state.vocabularies || state.vocabularies.length === 0) {
        return 0;
    }
    
    // Only calculate due count in spaced repetition mode
    if (state.selectionMode !== 'spaced') {
        return state.vocabularies.length;
    }
    
    return state.vocabularies.filter(vocab => isVocabularyDue(vocab)).length;
}
