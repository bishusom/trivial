const firebaseApp = window.firebase?.app();
const db = firebaseApp ? getDatabase() : null;
const firestore = firebaseApp ? getFirestore() : null;

// Game messages
const wordGameMessages = {
    win: [
        "🎉 Word Wizard! You've mastered this challenge!",
        "🏆 Vocabulary Virtuoso! Perfect score!",
        "✨ Lexicon Legend! Flawless victory!"
    ],
    nearWin: [
        "📖 Almost perfect! One more try?",
        "🧠 Great memory! Can you get them all next time?",
        "💡 So close! Your word skills are impressive"
    ],
    default: [
        "🔍 Nice effort! Try again to improve",
        "📚 Every game makes you better",
        "🔄 Practice makes perfect"
    ]
};

// Sound effects
const sounds = {
    correct: document.getElementById('correct-sound'),
    wrong: document.getElementById('wrong-sound'),
    win: document.getElementById('win-sound'),
    lose: document.getElementById('lose-sound'),
    hint: document.getElementById('hint-sound'),
    tick: document.getElementById('tick-sound')
};

// Difficulty settings
const difficultySettings = {
    easy: { maxAttempts: 8, maxHints: 3, revealLetters: 2, timePerGuess: 90, scoreMultiplier: 1 },
    medium: { maxAttempts: 6, maxHints: 2, revealLetters: 1, timePerGuess: 60, scoreMultiplier: 1.5 },
    hard: { maxAttempts: 4, maxHints: 1, revealLetters: 0, timePerGuess: 30, scoreMultiplier: 2 }
};

// Game state
const wordState = {
    targetWord: '',
    category: '',
    difficulty: 'medium',
    attemptsLeft: 6,
    maxAttempts: 6,
    guesses: [],
    hintsUsed: 0,
    maxHints: 2,
    revealedLetters: [],
    timeLeft: 60,
    timer: null,
    score: 0,
    isDailyChallenge: false,
    isMuted: false,
    isPlaying: false
};

// DOM elements
const wordGameEls = {
    gameContainer: document.getElementById('word-game-container'),
    wordDisplay: document.getElementById('word-display'),
    input: document.getElementById('word-input'),
    timer: document.getElementById('word-timer'),
    scoreDisplay: document.getElementById('word-score'),
    startBtn: document.getElementById('start-word-game'),
    results: document.getElementById('word-results'),
    hintBtn: document.getElementById('hint-btn'),
    muteBtn: document.getElementById('mute-btn'),
    feedback: document.getElementById('word-feedback')
};

// Cache constants
const WORD_CACHE = { 
    WORDS: 'word-game-words-v1', 
    EXPIRY: 24 * 60 * 60 * 1000 // 24 hours
};

// Updated fetchWords function with caching similar to fetchfbQuiz
async function fetchWords() {
    const now = new Date();
    const cacheKey = `word-list-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const cached = JSON.parse(localStorage.getItem(WORD_CACHE.WORDS))?.[cacheKey];
    
    // Return cached words if available and not expired
    if (cached && Date.now() - cached.timestamp < WORD_CACHE.EXPIRY) {
        console.log('Using cached word list');
        return cached.words;
    }

    if (!db) {
        console.warn("Firebase not initialized. Using fallback words.");
        return getFallbackWords();
    }

    try {
        // Fetch from Firebase
        const snapshot = await get(ref(db, 'wordLists'));
        if (!snapshot.exists()) {
            console.warn("No word lists found in Firebase");
            return getFallbackWords();
        }

        const words = snapshot.val();
        
        // Cache the result
        localStorage.setItem(WORD_CACHE.WORDS, JSON.stringify({
            ...JSON.parse(localStorage.getItem(WORD_CACHE.WORDS) || '{}'),
            [cacheKey]: { 
                words, 
                timestamp: Date.now() 
            }
        }));

        return words;
    } catch (error) {
        console.error("Firebase fetch failed:", error);
        return getFallbackWords();
    }
}

// Helper function for fallback words
function getFallbackWords() {
    return {
        animal: { 
            easy: ['lion', 'frog', 'duck'],
            medium: ['zebra', 'panda'],
            hard: ['chameleon']
        },
        bird: {
            easy: ['crow', 'dove'],
            medium: ['eagle', 'heron'],
            hard: ['flamingo']
        },
        // Add more fallback categories as needed
        food: {
            easy: ['apple', 'bread', 'pizza'],
            medium: ['banana', 'carrot'],
            hard: ['avocado']
        }
    };
}

// Initialize game with words from Firebase
async function startNewGame(difficulty = 'medium') {
    const words = await fetchWords();
    wordState.difficulty = difficulty;
    const settings = difficultySettings[difficulty];

    // Apply difficulty settings
    wordState.maxAttempts = settings.maxAttempts;
    wordState.maxHints = settings.maxHints;
    wordState.timeLeft = settings.timePerGuess;
    wordState.score = 0;
    wordState.isPlaying = true;

    // Select random category and word
    const categoryKeys = Object.keys(words);
    wordState.category = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
    const wordPool = words[wordState.category][difficulty];
    wordState.targetWord = wordPool[Math.floor(Math.random() * wordPool.length)].toLowerCase();

    // Reset game state
    wordState.attemptsLeft = settings.maxAttempts;
    wordState.guesses = [];
    wordState.hintsUsed = 0;
    wordState.revealedLetters = [];

    // Reveal letters based on difficulty
    for (let i = 0; i < settings.revealLetters; i++) {
        const randomPos = Math.floor(Math.random() * wordState.targetWord.length);
        if (!wordState.revealedLetters.includes(randomPos)) {
            wordState.revealedLetters.push(randomPos);
        }
    }

    // Update UI
    wordGameEls.startBtn.disabled = true;
    wordGameEls.scoreDisplay.textContent = '0';
    wordGameEls.results.innerHTML = '';
    wordGameEls.input.value = '';
    wordGameEls.input.focus();
    wordGameEls.hintBtn.disabled = false;

    startTimer();
    updateWordGameUI();
    playSound('start');
}

// Timer functions
function startTimer() {
    clearInterval(wordState.timer);
    updateTimerDisplay();
    wordState.timer = setInterval(() => {
        wordState.timeLeft--;
        updateTimerDisplay();
        
        if (wordState.timeLeft <= 0) {
            endWordGame(false);
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(wordState.timeLeft / 60);
    const seconds = wordState.timeLeft % 60;
    wordGameEls.timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Sound functions
function playSound(type) {
    if (wordState.isMuted) return;
    if (sounds[type]) {
        sounds[type].currentTime = 0;
        sounds[type].play().catch(e => console.warn("Sound blocked:", e));
    }
}

function stopAllSounds() {
    Object.values(sounds).forEach(sound => {
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    });
}

// Game logic
function handleGuessSubmit() {
    if (!wordState.isPlaying) return;
    
    const guess = wordGameEls.input.value.toLowerCase().trim();
    wordGameEls.input.value = '';

    if (!guess || guess.length !== wordState.targetWord.length) {
        wordGameEls.feedback.textContent = `Please enter a ${wordState.targetWord.length}-letter word`;
        wordGameEls.feedback.className = 'word-feedback feedback-wrong';
        playSound('wrong');
        return;
    }

    wordState.guesses.push(guess);
    wordState.attemptsLeft--;

    // Calculate score for this guess
    let correctLetters = 0;
    for (let i = 0; i < guess.length; i++) {
        if (guess[i] === wordState.targetWord[i]) {
            correctLetters++;
        }
    }

    // Update score
    const settings = difficultySettings[wordState.difficulty];
    const pointsEarned = correctLetters * 10 * settings.scoreMultiplier;
    wordState.score += pointsEarned;
    wordGameEls.scoreDisplay.textContent = wordState.score;

    // Show feedback
    const feedback = document.createElement('div');
    feedback.className = correctLetters === wordState.targetWord.length ? 
        'word-feedback correct' : 'word-feedback';
    feedback.textContent = `${guess.toUpperCase()} - ${correctLetters} correct (${pointsEarned}pts)`;
    wordGameEls.results.appendChild(feedback);

    if (guess === wordState.targetWord) {
        endWordGame(true);
    } else if (wordState.attemptsLeft <= 0) {
        endWordGame(false);
    }

    updateWordGameUI();
}

function giveHint() {
    if (!wordState.isPlaying || wordState.hintsUsed >= wordState.maxHints) return;

    playSound('hint');
    wordState.hintsUsed++;

    // Find a position that hasn't been revealed yet
    const unrevealedPositions = [];
    for (let i = 0; i < wordState.targetWord.length; i++) {
        if (!wordState.revealedLetters.includes(i)) {
            unrevealedPositions.push(i);
        }
    }

    if (unrevealedPositions.length === 0) return;

    const hintPosition = unrevealedPositions[Math.floor(Math.random() * unrevealedPositions.length)];
    wordState.revealedLetters.push(hintPosition);
    wordState.score = Math.max(0, wordState.score - 50); // Penalty for using hint
    wordGameEls.scoreDisplay.textContent = wordState.score;

    updateWordGameUI();
    wordGameEls.hintBtn.textContent = `Hints (${wordState.maxHints - wordState.hintsUsed} left)`;
    if (wordState.hintsUsed >= wordState.maxHints) {
        wordGameEls.hintBtn.disabled = true;
    }
}

function endWordGame(isWin) {
    clearInterval(wordState.timer);
    wordState.isPlaying = false;
    wordGameEls.startBtn.disabled = false;

    if (isWin) {
        playSound('win');
        wordGameEls.feedback.textContent = '🎉 Correct! You guessed the word!';
        wordGameEls.feedback.className = 'word-feedback feedback-correct';
    } else {
        playSound('lose');
        wordGameEls.feedback.textContent = `Game Over! The word was ${wordState.targetWord.toUpperCase()}`;
        wordGameEls.feedback.className = 'word-feedback feedback-wrong';
    }

    // Show summary message
    const messageCategory = isWin ? 'win' : 
                         wordState.score >= 150 ? 'nearWin' : 'default';
    const message = wordGameMessages[messageCategory][Math.floor(Math.random() * wordGameMessages[messageCategory].length)];

    const summary = document.createElement('div');
    summary.className = 'word-game-summary';
    summary.innerHTML = `
        <h3>${isWin ? 'You Won!' : 'Game Over'}</h3>
        <p>Your score: ${wordState.score}</p>
        <p class="feedback-message">${message}</p>
    `;
    wordGameEls.results.appendChild(summary);

    // Save score if it's high enough
    if (wordState.score > 100) {
        saveWordGameScore();
    }
}

async function saveWordGameScore() {
    if (!firestore) {
        console.warn("Firestore not available - score not saved");
        return;
    }

    const name = prompt('Enter your name for the leaderboard:', 'Anonymous') || 'Anonymous';
    try {
        await addDoc(collection(firestore, 'wordGameScores'), {
            name: name,
            score: wordState.score,
            difficulty: wordState.difficulty,
            timestamp: new Date(),
            word: wordState.targetWord
        });
    } catch (error) {
        console.error("Error saving score:", error);
    }
}

// UI updates
function updateWordGameUI() {
    // Display the word with revealed letters
    let displayWord = '';
    for (let i = 0; i < wordState.targetWord.length; i++) {
        if (wordState.revealedLetters.includes(i) || 
            wordState.guesses.some(guess => guess[i] === wordState.targetWord[i])) {
            displayWord += wordState.targetWord[i].toUpperCase();
        } else {
            displayWord += '_';
        }
    }
    wordGameEls.wordDisplay.textContent = displayWord.split('').join(' ');

    // Update attempts display
    wordGameEls.hintBtn.textContent = `Hints (${wordState.maxHints - wordState.hintsUsed} left)`;
}

// Event setup
function setupWordGameEvents() {
    // Game controls
    wordGameEls.startBtn.addEventListener('click', startNewGame);
    wordGameEls.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (!wordState.isPlaying) {
                startNewGame();
            } else {
                handleGuessSubmit();
            }
        }
    });
    wordGameEls.hintBtn.addEventListener('click', giveHint);

    // Mute toggle
    wordGameEls.muteBtn?.addEventListener('click', () => {
        wordState.isMuted = !wordState.isMuted;
        localStorage.setItem('wordGameMuteState', wordState.isMuted);
        wordGameEls.muteBtn.querySelector('.material-icons').textContent = 
            wordState.isMuted ? 'volume_off' : 'volume_up';
        if (wordState.isMuted) stopAllSounds();
    });

    // Load mute state
    wordState.isMuted = JSON.parse(localStorage.getItem('wordGameMuteState') || false;
    if (wordGameEls.muteBtn) {
        wordGameEls.muteBtn.querySelector('.material-icons').textContent = 
            wordState.isMuted ? 'volume_off' : 'volume_up';
    }
}

// Initialize
async function initWordGame() {
    await fetchWords();
    setupWordGameEvents();
    updateWordGameUI();
}

export { initWordGame };