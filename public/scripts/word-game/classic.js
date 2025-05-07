import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD476kdtlngttCBw6vMnc73QWA7P1OnHdg",
    authDomain: "triviaahdb.firebaseapp.com",
    projectId: "triviaahdb",
    storageBucket: "triviaahdb.appspot.com",
    messagingSenderId: "758082588437",
    appId: "1:758082588437:web:9eada609e974b9e458631c",
    measurementId: "G-ZT8Q78QYDQ"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);

// Constants
const WINS_REQUIRED_FOR_NEXT_LEVEL = 5;
const GAME_STATE_KEY = 'word-game-state';
const SESSION_USED_WORDS_KEY = 'word-game-session-used-words';

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
const wordState = JSON.parse(localStorage.getItem(GAME_STATE_KEY)) || {
    targetWord: '',
    category: '',
    difficulty: 'easy',
    attemptsLeft: 8,
    maxAttempts: 8,
    guesses: [],
    hintsUsed: 0,
    maxHints: 3,
    revealedLetters: [],
    timeLeft: 90,
    score: 0,
    isDailyChallenge: false,
    isMuted: JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false,
    isPlaying: false,
    letterChoices: [],
    currentLetterIndex: 0,
    guessedLetters: [],
    usedWords: JSON.parse(localStorage.getItem('word-game-used-words')) || [],
    sessionUsedWords: JSON.parse(sessionStorage.getItem(SESSION_USED_WORDS_KEY)) || [],
    winsAtCurrentDifficulty: 0,
    lastPlayed: null
};

// DOM elements
const wordGameEls = {
    gameContainer: document.getElementById('word-game-container'),
    wordDisplay: document.getElementById('word-display'),
    timer: document.getElementById('word-timer'),
    scoreDisplay: document.getElementById('word-score'),
    startBtn: document.getElementById('start-word-game'),
    results: document.getElementById('word-results'),
    hintBtn: document.getElementById('hint-btn'),
    muteBtn: document.getElementById('cwg-mute-btn'),
    feedback: document.getElementById('word-feedback'),
    attemptsDisplay: document.getElementById('word-attempts'),
    newWordBtn: document.getElementById('new-word')
};

// Cache constants
const WORD_CACHE = { 
    WORDS: 'word-game-words-v1', 
    EXPIRY: 24 * 60 * 60 * 1000 // 24 hours
};

// Fallback word list
const FALLBACK_WORDS = [
    { word: "apple", category: "Fruit", hint: "A common fruit" },
    { word: "house", category: "Building", hint: "Where people live" },
    { word: "computer", category: "Technology", hint: "A device for computing" },
    { word: "elephant", category: "Animal", hint: "A large mammal with a trunk" },
    { word: "ocean", category: "Geography", hint: "Vast body of salt water" },
    { word: "guitar", category: "Music", hint: "Stringed musical instrument" },
    { word: "mountain", category: "Geography", hint: "Large natural elevation" },
    { word: "piano", category: "Music", hint: "Keyboard musical instrument" },
    { word: "telephone", category: "Technology", hint: "Device for communication" },
    { word: "television", category: "Technology", hint: "Device for viewing programs" },
    { word: "bicycle", category: "Transport", hint: "Two-wheeled vehicle" },
    { word: "airplane", category: "Transport", hint: "Flying vehicle" },
    { word: "restaurant", category: "Place", hint: "Where meals are served" },
    { word: "library", category: "Place", hint: "Where books are kept" },
    { word: "hospital", category: "Place", hint: "Where sick people are treated" }
];

function updateDifficultyDisplay() {
    const difficultyDisplay = document.getElementById('current-difficulty');
    const progressDisplay = document.getElementById('progress-display');
    
    const difficultyName = wordState.difficulty.charAt(0).toUpperCase() + wordState.difficulty.slice(1);
    difficultyDisplay.textContent = `Difficulty: ${difficultyName}`;
    progressDisplay.textContent = `Progress: ${wordState.winsAtCurrentDifficulty}/${WINS_REQUIRED_FOR_NEXT_LEVEL}`;
    
    difficultyDisplay.style.color = 
        wordState.difficulty === 'easy' ? '#4CAF50' :
        wordState.difficulty === 'medium' ? '#FFC107' : '#F44336';
}

function saveGameState() {
    const stateToSave = {
        ...wordState,
        timer: null,
        isPlaying: false
    };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(stateToSave));
    sessionStorage.setItem(SESSION_USED_WORDS_KEY, JSON.stringify(wordState.sessionUsedWords));
}

async function fetchWords() {
    try {
        const cacheKey = `word-list-${wordState.difficulty}`;
        const cached = JSON.parse(localStorage.getItem(WORD_CACHE.WORDS))?.[cacheKey];
        
        if (cached && Date.now() - cached.timestamp < WORD_CACHE.EXPIRY) {
            return cached.words;
        }

        const wordsRef = collection(firestore, 'wordLists');
        const randomFloor = Math.floor(Math.random() * 1000);
        
        const q = query(
            wordsRef,
            where('difficulty', '==', wordState.difficulty),
            where('randomIndex', '>=', randomFloor),
            orderBy('randomIndex'),
            limit(100)
        );
        
        const querySnapshot = await getDocs(q);
        const words = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            words.push({
                word: data.word,
                category: data.category,
                hint: data.hint || 'No hint available'
            });
        });

        if (words.length < 50) {
            const fallbackQ = query(
                wordsRef,
                where('difficulty', '==', wordState.difficulty),
                where('randomIndex', '>=', 0),
                orderBy('randomIndex'),
                limit(200)
            );
            
            const fallbackSnapshot = await getDocs(fallbackQ);
            fallbackSnapshot.forEach((doc) => {
                const data = doc.data();
                if (!words.some(w => w.word === data.word)) {
                    words.push({
                        word: data.word,
                        category: data.category,
                        hint: data.hint || 'No hint available'
                    });
                }
            });
        }

        if (words.length > 0) {
            localStorage.setItem(WORD_CACHE.WORDS, JSON.stringify({
                [cacheKey]: {
                    words,
                    timestamp: Date.now()
                }
            }));
        }

        return words.length ? words : FALLBACK_WORDS;
    } catch (error) {
        console.error('Error fetching words:', error);
        return FALLBACK_WORDS;
    }
}

function selectRandomWord(words) {
    if (!words || words.length === 0) {
        return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
    }
    
    // Filter words by difficulty and if they haven't been used in this session
    const availableWords = words.filter(word => {
        const length = word.word.length;
        let difficultyMatch = false;
        
        if (wordState.difficulty === 'easy') difficultyMatch = length <= 5;
        else if (wordState.difficulty === 'medium') difficultyMatch = length > 5 && length <= 8;
        else difficultyMatch = length > 8;
        
        return difficultyMatch && 
               !wordState.usedWords.includes(word.word) &&
               !wordState.sessionUsedWords.includes(word.word);
    });
    
    if (availableWords.length === 0) {
        // If no words left, clear session used words and try again
        wordState.sessionUsedWords = [];
        sessionStorage.setItem(SESSION_USED_WORDS_KEY, JSON.stringify(wordState.sessionUsedWords));
        return selectRandomWord(words);
    }
    
    const selected = availableWords[Math.floor(Math.random() * availableWords.length)];
    wordState.usedWords.push(selected.word);
    wordState.sessionUsedWords.push(selected.word);
    
    if (wordState.usedWords.length > 50) {
        wordState.usedWords = wordState.usedWords.slice(-25);
    }
    
    localStorage.setItem('word-game-used-words', JSON.stringify(wordState.usedWords));
    sessionStorage.setItem(SESSION_USED_WORDS_KEY, JSON.stringify(wordState.sessionUsedWords));
    
    return selected;
}

function generateLetterChoices(word) {
    const letters = word.split('');
    const extraLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const choices = [...letters];
    
    while (choices.length < 10 && extraLetters.length > 0) {
        const randomIndex = Math.floor(Math.random() * extraLetters.length);
        choices.push(extraLetters.splice(randomIndex, 1)[0]);
    }
    
    for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    
    return choices;
}

function initializeGame() {
    const settings = difficultySettings[wordState.difficulty];
    wordState.maxAttempts = settings.maxAttempts;
    wordState.attemptsLeft = settings.maxAttempts;
    wordState.maxHints = settings.maxHints;
    wordState.hintsUsed = 0;
    wordState.timeLeft = settings.timePerGuess;
    wordState.score = 0;
    wordState.guesses = [];
    wordState.revealedLetters = [];
    wordState.isPlaying = false;
    wordState.letterChoices = [];
    wordState.currentLetterIndex = 0;
    wordState.guessedLetters = [];
    
    const winsData = JSON.parse(localStorage.getItem('word-game-wins')) || {};
    wordState.winsAtCurrentDifficulty = winsData[wordState.difficulty] || 0;
    
    updateDifficultyDisplay();
    updateGameUI();
    saveGameState();
}

async function startWordGame() {
    wordState.isPlaying = true;
    localStorage.removeItem(WORD_CACHE.WORDS);
    
    const words = await fetchWords();
    const selectedWord = selectRandomWord(words);
    
    wordState.targetWord = selectedWord.word.toUpperCase();
    wordState.category = selectedWord.category;
    wordState.hint = selectedWord.hint;
    wordState.letterChoices = generateLetterChoices(wordState.targetWord);
    
    const settings = difficultySettings[wordState.difficulty];
    wordState.revealedLetters = Array(wordState.targetWord.length).fill(false);
    wordState.guessedLetters = Array(wordState.targetWord.length).fill('');
    
    let lettersToReveal = settings.revealLetters;
    while (lettersToReveal > 0) {
        const randomIndex = Math.floor(Math.random() * wordState.targetWord.length);
        if (!wordState.revealedLetters[randomIndex]) {
            wordState.revealedLetters[randomIndex] = true;
            wordState.guessedLetters[randomIndex] = wordState.targetWord[randomIndex];
            lettersToReveal--;
        }
    }
    
    wordState.attemptsLeft = settings.maxAttempts;
    wordState.timeLeft = settings.timePerGuess;
    wordState.guesses = [];
    
    updateGameUI();
    startTimer();
    saveGameState();
    
    if (!wordState.isMuted) sounds.start?.play();
}

function updateGameUI() {
    wordGameEls.attemptsDisplay.textContent = `Attempts left: ${wordState.attemptsLeft}`;
    
    const minutes = Math.floor(wordState.timeLeft / 60);
    const seconds = wordState.timeLeft % 60;
    wordGameEls.timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    wordGameEls.scoreDisplay.textContent = `Score: ${wordState.score}`;
    
    let wordDisplayHTML = `
        <div class="word-display-info">${wordState.category} (${wordState.targetWord.length} letters)</div>
        <div class="word-hint">Hint: ${wordState.hint || 'No hint available'}</div>
        <div class="word-display-letters">`;
    
    for (let i = 0; i < wordState.targetWord.length; i++) {
        const letter = wordState.revealedLetters[i] ? wordState.targetWord[i] : wordState.guessedLetters[i];
        wordDisplayHTML += `
            <div class="letter-container">
                ${wordState.revealedLetters[i] || wordState.guessedLetters[i]
                    ? `<span class="letter">${letter}</span>`
                    : '<span class="empty-letter">_</span>'}
                ${!wordState.revealedLetters[i] && wordState.guessedLetters[i]
                    ? `<button class="remove-letter" data-index="${i}">×</button>`
                    : ''}
            </div>
        `;
    }
    
    wordDisplayHTML += '</div>';
    wordGameEls.wordDisplay.innerHTML = wordDisplayHTML;
    
    const choicesHTML = wordState.letterChoices.map(letter => `
        <button class="letter-choice" 
                data-letter="${letter}"
                ${!wordState.isPlaying ? 'disabled' : ''}>
            ${letter}
        </button>
    `).join('');
    
    wordGameEls.results.innerHTML = `
        <div class="letter-choices">${choicesHTML}</div>
        ${wordState.guesses.map(guess => createGuessRow(guess)).join('')}
    `;
}

function createGuessRow(guess) {
    let rowHTML = '<div class="guess-row">';
    for (let i = 0; i < guess.length; i++) {
        const letter = guess[i];
        let className = 'letter-box';
        if (letter === wordState.targetWord[i]) {
            className += ' correct';
        } else if (wordState.targetWord.includes(letter)) {
            className += ' present';
        } else {
            className += ' absent';
        }
        rowHTML += `<div class="${className}">${letter}</div>`;
    }
    rowHTML += '</div>';
    return rowHTML;
}

function startTimer() {
    if (wordState.timer) clearInterval(wordState.timer);
    
    wordState.timer = setInterval(() => {
        wordState.timeLeft--;
        updateGameUI();
        
        if (wordState.timeLeft <= 10 && !wordState.isMuted) {
            sounds.tick?.play();
        }
        
        if (wordState.timeLeft <= 0) {
            endWordGame(false);
        }
    }, 1000);
}

async function makeGuess(letter) {
    if (!wordState.isPlaying) return;

    const letterInWord = wordState.targetWord.includes(letter);
    
    if (letterInWord) {
        let placedCorrectly = false;
        for (let i = 0; i < wordState.targetWord.length; i++) {
            if (wordState.targetWord[i] === letter && 
                !wordState.revealedLetters[i] && 
                !wordState.guessedLetters[i]) {
                wordState.guessedLetters[i] = letter;
                placedCorrectly = true;
                
                const letterBox = document.querySelectorAll('.letter-container')[i];
                letterBox.classList.add('correct-feedback');
                setTimeout(() => {
                    letterBox.classList.remove('correct-feedback');
                }, 2000);
            }
        }
        
        if (placedCorrectly) {
            if (!wordState.isMuted) sounds.correct?.play();
            updateGameUI();
            saveGameState();
            
            const isComplete = wordState.guessedLetters.every((char, i) => 
                char || wordState.revealedLetters[i]
            );
            
            if (isComplete) {
                const guess = wordState.guessedLetters.join('');
                wordState.attemptsLeft--;
                
                if (guess === wordState.targetWord) {
                    wordState.score += Math.floor(wordState.timeLeft * difficultySettings[wordState.difficulty].scoreMultiplier);
                    endWordGame(true);
                    return;
                }
                
                const resultRow = createGuessRow(guess);
                wordState.guesses.push(guess);
                wordGameEls.results.prepend(resultRow);
                
                wordState.guessedLetters = Array(wordState.targetWord.length).fill('').map((_, i) => 
                    wordState.revealedLetters[i] ? wordState.targetWord[i] : ''
                );
                
                if (wordState.attemptsLeft <= 0) {
                    endWordGame(false);
                } else {
                    updateGameUI();
                    saveGameState();
                    if (!wordState.isMuted) sounds.wrong?.play();
                }
            }
            return;
        }
    }
    
    const emptyIndex = wordState.guessedLetters.findIndex((char, i) => 
        !char && !wordState.revealedLetters[i]
    );
    
    if (emptyIndex === -1) return;
    
    wordState.guessedLetters[emptyIndex] = letter;
    updateGameUI();
    saveGameState();
    
    const letterBtn = document.querySelector(`.letter-choice[data-letter="${letter}"]`);
    const letterBox = document.querySelectorAll('.letter-container')[emptyIndex];
    
    if (letterInWord) {
        letterBox.classList.add('present-feedback');
        if (!wordState.isMuted) sounds.correct?.play();
        
        setTimeout(() => {
            letterBox.classList.remove('present-feedback');
        }, 2000);
    } else {
        letterBox.classList.add('wrong-feedback');
        if (!wordState.isMuted) sounds.wrong?.play();
        
        setTimeout(() => {
            letterBox.classList.remove('wrong-feedback');
            wordState.guessedLetters[emptyIndex] = '';
            updateGameUI();
            saveGameState();
        }, 2000);
        
        letterBtn.classList.add('disabled-letter');
    }
    
    const isComplete = wordState.guessedLetters.every((char, i) => 
        char || wordState.revealedLetters[i]
    );
    
    if (isComplete) {
        const guess = wordState.guessedLetters.join('');
        wordState.attemptsLeft--;
        
        if (guess === wordState.targetWord) {
            wordState.score += Math.floor(wordState.timeLeft * difficultySettings[wordState.difficulty].scoreMultiplier);
            endWordGame(true);
            return;
        }
        
        const resultRow = createGuessRow(guess);
        wordState.guesses.push(guess);
        wordGameEls.results.prepend(resultRow);
        
        wordState.guessedLetters = Array(wordState.targetWord.length).fill('').map((_, i) => 
            wordState.revealedLetters[i] ? wordState.targetWord[i] : ''
        );
        
        if (wordState.attemptsLeft <= 0) {
            endWordGame(false);
        } else {
            updateGameUI();
            saveGameState();
            if (!wordState.isMuted) sounds.wrong?.play();
        }
    }
}

function getHint() {
    if (wordState.hintsUsed >= wordState.maxHints || !wordState.isPlaying) return;
    
    const unrevealedIndices = wordState.revealedLetters
        .map((revealed, index) => !revealed ? index : -1)
        .filter(index => index !== -1);
    
    if (unrevealedIndices.length === 0) return;
    
    const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
    wordState.revealedLetters[randomIndex] = true;
    wordState.guessedLetters[randomIndex] = wordState.targetWord[randomIndex];
    wordState.hintsUsed++;
    
    updateGameUI();
    saveGameState();
    if (!wordState.isMuted) sounds.hint?.play();
}

async function endWordGame(won) {
    wordState.isPlaying = false;
    clearInterval(wordState.timer);

    Object.values(sounds).forEach(sound => {
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    });

    let message;
    if (won) {
        message = wordGameMessages.win[Math.floor(Math.random() * wordGameMessages.win.length)];
        wordState.winsAtCurrentDifficulty++;
        const winsData = JSON.parse(localStorage.getItem('word-game-wins')) || {};
        winsData[wordState.difficulty] = wordState.winsAtCurrentDifficulty;
        localStorage.setItem('word-game-wins', JSON.stringify(winsData));
        if (!wordState.isMuted) sounds.win?.play();

        if (wordState.winsAtCurrentDifficulty >= WINS_REQUIRED_FOR_NEXT_LEVEL) {
            if (wordState.difficulty === 'easy') {
                wordState.difficulty = 'medium';
                message += `<br><br>Great job! You've won ${WINS_REQUIRED_FOR_NEXT_LEVEL} games on Easy. Advancing to Medium difficulty!`;
            } else if (wordState.difficulty === 'medium') {
                wordState.difficulty = 'hard';
                message += `<br><br>Excellent! You've won ${WINS_REQUIRED_FOR_NEXT_LEVEL} games on Medium. Now try Hard difficulty!`;
            } else {
                message += `<br><br>Mastered Hard mode! You're a word game champion!`;
            }
            wordState.winsAtCurrentDifficulty = 0;
            winsData[wordState.difficulty] = 0;
            localStorage.setItem('word-game-wins', JSON.stringify(winsData));
        } else {
            const winsLeft = WINS_REQUIRED_FOR_NEXT_LEVEL - wordState.winsAtCurrentDifficulty;
            message += `<br><br>${winsLeft} more win${winsLeft === 1 ? '' : 's'} to advance to the next level!`;
        }

        setTimeout(() => {
            initializeGame();
            startWordGame();
        }, 2000);
    } else {
        message = wordState.score > 0 
            ? wordGameMessages.nearWin[Math.floor(Math.random() * wordGameMessages.nearWin.length)]
            : wordGameMessages.default[Math.floor(Math.random() * wordGameMessages.default.length)];
        message += `<br><br>The word was: <strong>${wordState.targetWord}</strong>`;
        if (!wordState.isMuted) sounds.lose?.play();
    }

    wordGameEls.feedback.innerHTML = message;
    wordGameEls.feedback.className = `word-feedback ${won ? 'feedback-correct' : 'feedback-wrong'}`;
    wordGameEls.wordDisplay.innerHTML = `
        <div class="word-display-info">${wordState.category} (${wordState.targetWord.length} letters)</div>
        <div class="word-display-letters">${wordState.targetWord.split('').join(' ')}</div>
    `;

    updateDifficultyDisplay();
    // Clear the target word to prevent restoring an ended game
    wordState.targetWord = '';
    wordState.category = '';
    wordState.hint = '';
    wordState.letterChoices = [];
    wordState.guessedLetters = [];
    wordState.revealedLetters = [];
    saveGameState();

    if (wordState.score > 0) {
        try {
            await addDoc(collection(firestore, 'word-game-scores'), {
                score: wordState.score,
                difficulty: wordState.difficulty,
                timestamp: new Date(),
                isDailyChallenge: wordState.isDailyChallenge
            });
        } catch (error) {
            console.error('Error saving score:', error);
        }
    }

    updateGameUI();
}

function toggleMute() {
    wordState.isMuted = !wordState.isMuted;
    localStorage.setItem('triviaMasterMuteState', wordState.isMuted);
    wordGameEls.muteBtn.innerHTML = `<span class="material-icons">${wordState.isMuted ? 'volume_off' : 'volume_up'}</span>`;
    
    Object.values(sounds).forEach(sound => {
        if (sound) {
            sound.muted = wordState.isMuted;
            if (wordState.isMuted) {
                sound.pause();
                sound.currentTime = 0;
            }
        }
    });
    saveGameState();
}

function setupWordGameEvents() {
    wordGameEls.startBtn.addEventListener('click', startWordGame);
    wordGameEls.newWordBtn.addEventListener('click', startWordGame);
    wordGameEls.hintBtn.addEventListener('click', getHint);
    wordGameEls.muteBtn.addEventListener('click', toggleMute);
    
    document.addEventListener('click', (e) => {
        const letterBtn = e.target.closest('.letter-choice');
        if (letterBtn && wordState.isPlaying) {
            makeGuess(letterBtn.dataset.letter);
            return;
        }
    
        const removeBtn = e.target.closest('.remove-letter');
        if (removeBtn && wordState.isPlaying) {
            const index = parseInt(removeBtn.dataset.index);
            if (!wordState.revealedLetters[index]) {
                wordState.guessedLetters[index] = '';
                updateGameUI();
                saveGameState();
                if (!wordState.isMuted) sounds.wrong?.play();
            }
            return;
        }
    });
}

async function initWordGame() {
    const savedState = JSON.parse(localStorage.getItem(GAME_STATE_KEY));
    const today = new Date().toISOString().split('T')[0];

    // Restore session used words regardless of saved state
    wordState.sessionUsedWords = JSON.parse(sessionStorage.getItem(SESSION_USED_WORDS_KEY)) || [];

    if (savedState && savedState.lastPlayed === today && savedState.targetWord && savedState.isPlaying) {
        // Only restore the state if the game was actively playing
        Object.assign(wordState, savedState);
        updateDifficultyDisplay();
        updateGameUI();
        await startWordGame(); // Resume the game
    } else {
        // Otherwise, start a fresh game
        wordState.sessionUsedWords = [];
        sessionStorage.setItem(SESSION_USED_WORDS_KEY, JSON.stringify(wordState.sessionUsedWords));
        initializeGame();
        wordState.lastPlayed = today;
        saveGameState();
        await startWordGame();
    }

    // Set up mute state
    wordState.isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;
    wordGameEls.muteBtn.innerHTML = `<span class="material-icons">${wordState.isMuted ? 'volume_off' : 'volume_up'}</span>`;
    Object.values(sounds).forEach(sound => {
        if (sound) {
            sound.muted = wordState.isMuted;
        }
    });

    setupWordGameEvents();
}
export { initWordGame };