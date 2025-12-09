# Spanish Vocabulary Trainer 🇪🇸

A web-based flashcard application for learning Spanish vocabulary with spaced repetition, text-to-speech, and Google Drive sync.

## Features

### 🎯 Learning Modes
- **ES → DE**: Spanish to German translation
- **DE → ES**: German to Spanish translation  
- **Random**: Mixed direction for both ways practice

### 📚 Lection Management
- Create and organize vocabulary lists (lections)
- Import vocabulary from text files
- Edit, duplicate, and delete lections
- Select multiple lections for combined practice

### 🧠 Spaced Repetition System
- **Phase-based learning** (0-5 phases)
- Vocabularies advance through phases with correct answers
- Automatic scheduling based on performance
- **Random mode**: All vocabularies in session
- **Spaced mode**: Only due vocabularies shown

### 🔊 Text-to-Speech
- Automatic Spanish pronunciation
- Click speaker icon to hear words again
- Helps with proper pronunciation learning

### ☁️ Firebase Real-time Sync
- Sign in with Google account
- Real-time sync across all devices
- Data stored securely in Firebase
- Instant updates when changes occur
- Offline-capable with localStorage cache

## How It Works

### Learning Flow
1. **Select lections** from the left panel
2. **Choose learning mode** (ES→DE, DE→ES, or Random)
3. **Tap the card** to reveal the answer
4. **Rate yourself**:
   - ✓ **Correct** → Advances to next phase
   - ✗ **Wrong** → Resets to Phase 0
5. **Progress** is automatically saved

### Phase System
- **Phase 0**: New/failed vocabulary
- **Phase 1-4**: Increasing mastery levels
- **Phase 5**: Fully learned (less frequent reviews)

Correct answers advance phases, wrong answers reset to Phase 0.

### Session Pool
Each learning session contains all selected vocabularies. Once you answer a vocabulary (correct or wrong), it's removed from the current session. The session resets when:
- All vocabularies are answered
- You reload the page
- You change lection selection

## File Structure

```
├── index.html              # Main learning interface
├── manage-lections.html    # Lection management page
├── styles.css              # Application styles
├── app.js                  # Main application logic
├── lections.json           # Default lection data
├── scripts/
│   ├── vocabulary.js       # Card display & interaction
│   ├── lections.js         # Lection loading & selection
│   ├── lection-storage.js  # CRUD operations for lections
│   ├── lection-manager.js  # Management page logic
│   ├── storage.js          # Learning progress tracking
│   ├── speech.js           # Text-to-speech functionality
│   ├── firebase-config.js  # Firebase initialization
│   ├── firebase-auth.js    # Google OAuth with Firebase
│   └── firebase-sync.js    # Real-time database sync
└── lections/               # Sample vocabulary files
    ├── 0-Para Empezar.txt
    └── 1-Leccion 1.txt
```

## Setup

### Local Use
1. Clone or download the repository
2. Open `index.html` in a web browser
3. Start learning immediately with default lections

### With Firebase Sync
1. Open the app in a browser
2. Click **"Sign in with Google"**
3. Grant permissions
4. Your data syncs in real-time across all devices

## Usage

### Adding Custom Lections
1. Go to **Manage Lections** (📚 icon)
2. Click **"Import from .txt file"**
3. Format: `Spanish word/phrase = German translation` (one per line)
4. Or manually add vocabularies using the form

### Example .txt Format
```
hola = hallo
buenos días = guten Morgen
¿Cómo estás? = Wie geht es dir?
gracias = danke
```

### Learning Tips
- Use **Random mode** to practice both directions
- Use **Spaced mode** for efficient review of due vocabularies
- Listen to pronunciations to improve speaking
- Be honest with correct/wrong ratings for optimal progress

## Technical Details

### Storage
- **localStorage**: Browser cache for offline access
- **Firebase Realtime Database**: Cloud storage and sync (optional)
- **Real-time sync**: Instant updates across all devices
- **Automatic sync**: Changes sync immediately when online

### Performance Optimizations
- Real-time database listeners (instant cross-device updates)
- localStorage caching (offline capability)
- Session-based vocabulary pool
- Efficient Firebase queries

### Browser Compatibility
- Modern browsers with ES6+ module support
- Chrome, Firefox, Edge, Safari
- Mobile browsers supported

## Data Privacy
- Vocabulary data stored locally in your browser
- Firebase sync is optional
- Data stored in your personal Firebase account only
- No third-party data collection
- Secure Firebase security rules (user-only access)

## Development
Pure vanilla JavaScript - no build tools or frameworks required. Simply edit the files and refresh your browser.

---

**Start learning Spanish vocabulary efficiently with spaced repetition!** 🚀
