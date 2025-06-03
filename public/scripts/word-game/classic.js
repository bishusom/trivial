// Constants
const WINS_REQUIRED_FOR_NEXT_LEVEL = 5;
const GAME_STATE_KEY = 'word-game-state';
const SESSION_USED_WORDS_KEY = 'word-game-session-used-words';
const TIME_LIMIT = 180; // 3 minutes in seconds

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

// Difficulty settings
const difficultySettings = {
    easy: { maxAttempts: 8, maxHints: 3, revealLetters: 2, scoreMultiplier: 1, timeLimit: 240 },
    medium: { maxAttempts: 6, maxHints: 2, revealLetters: 1, scoreMultiplier: 1.5, timeLimit: 180 },
    hard: { maxAttempts: 4, maxHints: 1, revealLetters: 0, scoreMultiplier: 2, timeLimit: 120 }
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
    score: 0,
    isDailyChallenge: false,
    isPlaying: false,
    letterChoices: [],
    currentLetterIndex: 0,
    guessedLetters: [],
    usedWords: JSON.parse(localStorage.getItem('word-game-used-words')) || [],
    sessionUsedWords: JSON.parse(sessionStorage.getItem(SESSION_USED_WORDS_KEY)) || [],
    winsAtCurrentDifficulty: 0,
    lastPlayed: null,
    timer: TIME_LIMIT,
    isMuted: JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false
};

// DOM elements
const wordGameEls = {
    gameContainer: document.getElementById('word-game-container'),
    wordDisplay: document.getElementById('word-display'),
    scoreDisplay: document.getElementById('word-score'),
    startBtn: document.getElementById('start-word-game'),
    results: document.getElementById('word-results'),
    hintBtn: document.getElementById('hint-btn'),
    feedback: document.getElementById('word-feedback'),
    attemptsDisplay: document.getElementById('word-attempts'),
    timeElement: document.getElementById('word-time') || createTimeElement(),
    muteBtn: document.getElementById('mute-btn'),
    muteBtnIcon: document.querySelector('#mute-btn .material-icons')
};

// Cache constants
const WORD_CACHE = { 
    WORDS: 'word-game-words-v1', 
    EXPIRY: 24 * 60 * 60 * 1000 // 24 hours
};

// Sound effects
const audioElements = {
    select: new Audio('/audio/click.mp3'),
    found: new Audio('/audio/correct.mp3'),
    win: new Audio('/audio/win.mp3'),
    error: new Audio('/audio/wrong.mp3')
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

function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, { event_category: category, event_label: label, value: value });
    }
}

function createTimeElement() {
    const element = document.createElement('div');
    element.id = 'word-time';
    element.className = 'word-game-timer';
    document.querySelector('.word-game-meta').appendChild(element);
    return element;
}

function playSound(type) {
    if (wordState.isMuted) {
        console.log(`Sound ${type} skipped: muted`);
        return;
    }
    console.log(`Playing sound: ${type}`);
    if (audioElements[type]) {
        audioElements[type].currentTime = 0;
        audioElements[type].play().catch(err => console.error(`Error playing ${type} sound:`, err));
    }
}

function stopSound(type) {
    if (audioElements[type]) {
        audioElements[type].pause();
        audioElements[type].currentTime = 0;
    }
}

function stopAllSounds() {
    Object.keys(audioElements).forEach(type => stopSound(type));
}

function loadMuteState() {
    wordState.isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;
    if (wordGameEls.muteBtnIcon) {
        wordGameEls.muteBtnIcon.textContent = wordState.isMuted ? 'volume_off' : 'volume_up';
    }
    if (wordState.isMuted) {
        stopAllSounds();
    }
}

function startTimer() {
    clearInterval(wordState.timerInterval);
    wordState.timer = difficultySettings[wordState.difficulty].timeLimit;
    updateTimer();
    wordState.timerInterval = setInterval(() => {
        wordState.timer--;
        updateTimer();
        if (wordState.timer <= 0) {
            clearInterval(wordState.timerInterval);
            wordGameEls.feedback.textContent = 'Time\'s up!';
            wordGameEls.feedback.className = 'word-feedback error';
            setTimeout(() => endWordGame(false), 2000);
        }
    }, 1000);
}

function updateTimer() {
    const minutes = Math.floor(wordState.timer / 60);
    const seconds = wordState.timer % 60;
    wordGameEls.timeElement.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function showConfetti(options = {}) {
    const defaults = {
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
    };
    
    confetti({
        ...defaults,
        ...options
    });
    
    if (Math.random() > 0.5) {
        setTimeout(() => {
            confetti({
                ...defaults,
                ...options,
                angle: Math.random() * 180 - 90,
                origin: { x: Math.random(), y: 0.6 }
            });
        }, 300);
    }
}

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
        isPlaying: false
    };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(stateToSave));
    sessionStorage.setItem(SESSION_USED_WORDS_KEY, JSON.stringify(wordState.sessionUsedWords));
    localStorage.setItem('triviaMasterMuteState', JSON.stringify(wordState.isMuted));
}

async function fetchWords() {
    try {
        const cacheKey = `word-list-${wordState.difficulty}`;
        const cached = JSON.parse(localStorage.getItem(WORD_CACHE.WORDS))?.[cacheKey];
        
        if (cached && Date.now() - cached.timestamp < WORD_CACHE.EXPIRY) {
            return cached.words;
        }

        const randomFloor = Math.floor(Math.random() * 1000);
        
        const query = db.collection('wordLists')
                     .where('difficulty', '==', wordState.difficulty)
                     .where('randomIndex', '>=', randomFloor)
                     .orderBy('randomIndex')
                     .limit(100);
        
        const querySnapshot = await query.get();
        const words = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            words.push({
                word: data.word,
                category: data.category,
                hint: data.hint || 'No hint available'
            });
        });

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
    wordState.score = 0;
    wordState.guesses = [];
    wordState.revealedLetters = [];
    wordState.isPlaying = false;
    wordState.letterChoices = [];
    wordState.currentLetterIndex = 0;
    wordState.guessedLetters = [];
    wordState.timer = settings.timeLimit;
    
    const winsData = JSON.parse(localStorage.getItem('word-game-wins')) || {};
    wordState.winsAtCurrentDifficulty = winsData[wordState.difficulty] || 0;
    
    updateDifficultyDisplay();
    updateGameUI();
    updateTimer();
    saveGameState();
    trackEvent('guess_word_started', 'guess_word', 1);
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
    wordState.guesses = [];
    wordState.timer = settings.timeLimit;
    
    updateGameUI();
    startTimer();
    saveGameState();
}

function updateGameUI() {
    wordGameEls.attemptsDisplay.textContent = `Attempts left: ${wordState.attemptsLeft}`;
    wordGameEls.scoreDisplay.textContent = `Score: ${wordState.score}`;
    wordGameEls.timeElement.textContent = `Time: ${Math.floor(wordState.timer / 60)}:${(wordState.timer % 60).toString().padStart(2, '0')}`;
    
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

async function makeGuess(letter) {
    if (!wordState.isPlaying) return;

    playSound('select');
    
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
                playSound('found');
                setTimeout(() => {
                    letterBox.classList.remove('correct-feedback');
                }, 2000);
            }
        }
        
        if (placedCorrectly) {
            updateGameUI();
            saveGameState();
            
            const isComplete = wordState.guessedLetters.every((char, i) => 
                char || wordState.revealedLetters[i]
            );
            
            if (isComplete) {
                const guess = wordState.guessedLetters.join('');
                wordState.attemptsLeft--;
                
                if (guess === wordState.targetWord) {
                    wordState.score += difficultySettings[wordState.difficulty].scoreMultiplier * 10;
                    playSound('win');
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
                    playSound('error');
                    endWordGame(false);
                } else {
                    updateGameUI();
                    saveGameState();
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
        setTimeout(() => {
            letterBox.classList.remove('present-feedback');
        }, 2000);
    } else {
        letterBox.classList.add('wrong-feedback');
        playSound('error');
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
            wordState.score += difficultySettings[wordState.difficulty].scoreMultiplier * 10;
            playSound('win');
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
            playSound('error');
            endWordGame(false);
        } else {
            updateGameUI();
            saveGameState();
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
}

async function endWordGame(won) {
    wordState.isPlaying = false;
    clearInterval(wordState.timerInterval);

    let message;
    if (won) {
        message = wordGameMessages.win[Math.floor(Math.random() * wordGameMessages.win.length)];
        wordState.winsAtCurrentDifficulty++;
        const winsData = JSON.parse(localStorage.getItem('word-game-wins')) || {};
        winsData[wordState.difficulty] = wordState.winsAtCurrentDifficulty;
        localStorage.setItem('word-game-wins', JSON.stringify(winsData));

        setTimeout(() => {
            const victoryScreen = document.createElement('div');
            victoryScreen.className = 'victory-screen';
            
            showConfetti();

            if (wordState.winsAtCurrentDifficulty >= WINS_REQUIRED_FOR_NEXT_LEVEL) {
                if (wordState.difficulty === 'easy') {
                    wordState.difficulty = 'medium';
                    message += `<br><br>Great job! You've won ${WINS_REQUIRED_FOR_NEXT_LEVEL} games on Easy. Advancing to Medium difficulty!`;
                    setTimeout(() => showConfetti({ particleCount: 200, spread: 100 }), 600);
                } else if (wordState.difficulty === 'medium') {
                    wordState.difficulty = 'hard';
                    message += `<br><br>Excellent! You've won ${WINS_REQUIRED_FOR_NEXT_LEVEL} games on Medium. Now try Hard difficulty!`;
                    setTimeout(() => showConfetti({ particleCount: 200, spread: 100 }), 600);
                } else {
                    message += `<br><br>Mastered Hard mode! You're a word game champion!`;
                    setTimeout(() => showConfetti({ particleCount: 200, spread: 100 }), 600);
                }
                wordState.winsAtCurrentDifficulty = 0;
                winsData[wordState.difficulty] = [];
                localStorage.setItem('word-game-wins', JSON.stringify(winsData));
            } else {
                const winsLeft = WINS_REQUIRED_FOR_NEXT_LEVEL - wordState.winsAtCurrentDifficulty;
                message += `<br><br>${winsLeft} more win${winsLeft === 1 ? '' : 's'} to advance to the next level!`;
            }

            victoryScreen.innerHTML = `
                <h2>Victory!</h2>
                <p>${message}</p>
                <p>Score: ${wordState.score}</p>
                <div class="countdown">Next game starting in 5...</div>
            `;
            
            document.body.appendChild(victoryScreen);
            
            let countdown = 5;
            const countdownElement = victoryScreen.querySelector('.countdown');
            const countdownInterval = setInterval(() => {
                countdown--;
                countdownElement.textContent = `Next game starting in ${countdown}...`;
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    victoryScreen.remove();
                    initializeGame();
                    startWordGame();
                }
            }, 1000);
        }, 2000); // 2-second delay before showing victory screen and confetti
    } else {
        message = wordState.score > 0 
            ? wordGameMessages.nearWin[Math.floor(Math.random() * wordGameMessages.nearWin.length)]
            : wordGameMessages.default[Math.floor(Math.random() * wordGameMessages.default.length)];
        message += `<br><br>The word was: <strong>${wordState.targetWord}</strong>`;
        wordGameEls.feedback.innerHTML = message;
        wordGameEls.feedback.className = `word-feedback feedback-wrong`;
    }

    wordGameEls.wordDisplay.innerHTML = `
        <div class="word-display-info">${wordState.category} (${wordState.targetWord.length} letters)</div>
        <div class="word-display-letters">${wordState.targetWord.split('').join(' ')}</div>
    `;

    updateDifficultyDisplay();
    wordState.targetWord = '';
    wordState.category = '';
    wordState.hint = '';
    wordState.letterChoices = [];
    wordState.guessedLetters = [];
    wordState.revealedLetters = [];
    saveGameState();

    if (!won) {
        updateGameUI();
    }
}

function setupWordGameEvents() {
    wordGameEls.startBtn.addEventListener('click', startWordGame);
    wordGameEls.hintBtn.addEventListener('click', getHint);
    
    if (wordGameEls.muteBtn) {
        wordGameEls.muteBtn.addEventListener('click', () => {
            wordState.isMuted = !wordState.isMuted;
            localStorage.setItem('triviaMasterMuteState', JSON.stringify(wordState.isMuted));
            if (wordGameEls.muteBtnIcon) {
                wordGameEls.muteBtnIcon.textContent = wordState.isMuted ? 'volume_off' : 'volume_up';
            }
            if (wordState.isMuted) {
                stopAllSounds();
            }
        });
    }
    
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
            }
            return;
        }
    });
}

async function initWordGame() {
    wordState.sessionUsedWords = JSON.parse(sessionStorage.getItem(SESSION_USED_WORDS_KEY)) || [];
    wordState.usedWords = JSON.parse(localStorage.getItem('word-game-used-words')) || [];
    
    Object.assign(wordState, {
        targetWord: '',
        category: '',
        difficulty: 'easy',
        attemptsLeft: difficultySettings.easy.maxAttempts,
        maxAttempts: difficultySettings.easy.maxAttempts,
        guesses: [],
        hintsUsed: 0,
        maxHints: difficultySettings.easy.maxHints,
        revealedLetters: [],
        score: 0,
        isDailyChallenge: false,
        isPlaying: false,
        letterChoices: [],
        currentLetterIndex: 0,
        guessedLetters: [],
        winsAtCurrentDifficulty: JSON.parse(localStorage.getItem('word-game-wins'))?.[wordState.difficulty] || 0,
        lastPlayed: new Date().toISOString().split('T')[0],
        timer: difficultySettings.easy.timeLimit,
        isMuted: JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false
    });

    initializeGame();
    setupWordGameEvents();
    loadMuteState();
    await startWordGame();
    
    saveGameState();
}
export { initWordGame };