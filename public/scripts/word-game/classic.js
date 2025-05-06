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

// Difficulty progression: number of wins required to advance to next level
const DIFFICULTY_PROGRESSION = {
    easy: 3, // 3 wins to move from easy to medium
    medium: 3 // 3 wins to move from medium to hard
};

// Game state
const wordState = {
    targetWord: '',
    category: '',
    difficulty: 'easy', // Start with easy mode
    attemptsLeft: 8,
    maxAttempts: 8,
    guesses: [],
    hintsUsed: 0,
    maxHints: 3,
    revealedLetters: [],
    timeLeft: 90,
    timer: null,
    score: 0,
    isDailyChallenge: false,
    isMuted: JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false,
    isPlaying: false,
    letterChoices: [],
    currentLetterIndex: 0,
    guessedLetters: [],
    usedWords: JSON.parse(localStorage.getItem('word-game-used-words')) || [],
    winsAtCurrentDifficulty: 0
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

function setDifficulty(difficulty) {
    console.log('Setting difficulty to:', difficulty);
    if (wordState.isPlaying) {
        console.log('Difficulty cannot be changed during an active game');
        return;
    }
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
        console.warn(`Invalid difficulty: ${difficulty}`);
        return;
    }
    wordState.difficulty = difficulty;
    wordState.winsAtCurrentDifficulty = JSON.parse(localStorage.getItem('word-game-wins'))?.[difficulty] || 0;
    // Update UI to show active difficulty
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.difficulty-btn.${difficulty}`);
    if (activeBtn) activeBtn.classList.add('active');
}

async function fetchWords() {
    try {
        // Check if we have cached words
        const cacheKey = `word-list-${wordState.difficulty}`;
        const cached = JSON.parse(localStorage.getItem(WORD_CACHE.WORDS))?.[cacheKey];
        
        if (cached && Date.now() - cached.timestamp < WORD_CACHE.EXPIRY) {
            console.log('Using cached word list');
            return cached.words;
        }

        // Get words from Firestore with enhanced query
        const wordsRef = collection(firestore, 'wordLists');
        
        // Generate a random number between 0 and 999 for randomIndex filtering
        const randomFloor = Math.floor(Math.random() * 1000);
        
        // Build the query with all requested parameters
        const q = query(
            wordsRef,
            where('difficulty', '==', wordState.difficulty),
            where('randomIndex', '>=', randomFloor),
            orderBy('randomIndex'),
            limit(100) // Increased from 20 to 100
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

        // If we didn't get enough results, try again with a different random range
        if (words.length < 50) {
            const fallbackQ = query(
                wordsRef,
                where('difficulty', '==', wordState.difficulty),
                where('randomIndex', '>=', 0),  // Start from beginning
                orderBy('randomIndex'),
                limit(200) // Increased from 100 to 200
            );
            
            const fallbackSnapshot = await getDocs(fallbackQ);
            fallbackSnapshot.forEach((doc) => {
                const data = doc.data();
                // Only add if not already in words array
                if (!words.some(w => w.word === data.word)) {
                    words.push({
                        word: data.word,
                        category: data.category,
                        hint: data.hint || 'No hint available'
                    });
                }
            });
        }

        // Cache the words
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
        console.error('Error fetching words from Firestore:', error);
        return FALLBACK_WORDS;
    }
}

function selectRandomWord(words) {
    if (!Array.isArray(words) || words.length === 0) {
        console.warn('No valid words provided, using fallback');
        return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
    }
    
    // Filter words by difficulty and if they haven't been used
    const availableWords = words.filter(word => {
        const length = word.word.length;
        let difficultyMatch = false;
        
        if (wordState.difficulty === 'easy') difficultyMatch = length <= 5;
        else if (wordState.difficulty === 'medium') difficultyMatch = length > 5 && length <= 8;
        else difficultyMatch = length > 8;
        
        return difficultyMatch && !wordState.usedWords.includes(word.word);
    });
    
    if (!availableWords.length) {
        console.warn('No words available for selected difficulty, using fallback');
        return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
    }
    
    const selected = availableWords[Math.floor(Math.random() * availableWords.length)];
    wordState.usedWords.push(selected.word);
    
    // Prevent的变化usedWords from growing too large
    if (wordState.usedWords.length > 50) {
        wordState.usedWords = wordState.usedWords.slice(-25);
    }
    
    localStorage.setItem('word-game-used-words', JSON.stringify(wordState.usedWords));
    return selected;
}

function generateLetterChoices(word) {
    const letters = word.split('');
    const extraLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const choices = [...letters];
    
    // Add random letters to make up to 10 choices
    while (choices.length < 10 && extraLetters.length > 0) {
        const randomIndex = Math.floor(Math.random() * extraLetters.length);
        choices.push(extraLetters.splice(randomIndex, 1)[0]);
    }
    
    // Shuffle choices
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
    // Load wins for current difficulty
    wordState.winsAtCurrentDifficulty = JSON.parse(localStorage.getItem('word-game-wins'))?.[wordState.difficulty] || 0;
    
    updateGameUI();
}

async function startWordGame() {
    wordState.isPlaying = true;
    
    // Clear word cache to force fresh fetch
    localStorage.removeItem(WORD_CACHE.WORDS);
    
    // Disable difficulty buttons
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.disabled = true;
    });
    
    const words = await fetchWords();
    const selectedWord = selectRandomWord(words);
    
    wordState.targetWord = selectedWord.word.toUpperCase();
    wordState.category = selectedWord.category;
    wordState.hint = selectedWord.hint; // Store the hint in game state
    wordState.letterChoices = generateLetterChoices(wordState.targetWord);
    
    // Initialize revealed letters based on difficulty
    const settings = difficultySettings[wordState.difficulty];
    wordState.revealedLetters = Array(wordState.targetWord.length).fill(false);
    wordState.guessedLetters = Array(wordState.targetWord.length).fill('');
    
    // Reveal the specified number of letters
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
    
    if (!wordState.isMuted) sounds.start?.play();
}

function updateGameUI() {
    // Update attempts
    wordGameEls.attemptsDisplay.textContent = `Attempts left: ${wordState.attemptsLeft}`;
    
    // Update timer
    const minutes = Math.floor(wordState.timeLeft / 60);
    const seconds = wordState.timeLeft % 60;
    wordGameEls.timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Update score
    wordGameEls.scoreDisplay.textContent = `Score: ${wordState.score}`;
    
    // Update word display with remove buttons and hint
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
    
    // Update letter choices
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
    console.log('Making guess:', letter);
    if (!wordState.isPlaying) return;

    // Check if the letter exists in the target word
    const letterInWord = wordState.targetWord.includes(letter);
    
    if (letterInWord) {
        // Place the letter in all correct positions
        let placedCorrectly = false;
        for (let i = 0; i < wordState.targetWord.length; i++) {
            if (wordState.targetWord[i] === letter && 
                !wordState.revealedLetters[i] && 
                !wordState.guessedLetters[i]) {
                wordState.guessedLetters[i] = letter;
                placedCorrectly = true;
                
                // Add correct feedback animation
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
            
            // Check if all letters are filled
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
                
                // Display guess result
                const resultRow = createGuessRow(guess);
                wordState.guesses.push(guess);
                wordGameEls.results.prepend(resultRow);
                
                // Reset for next attempt
                wordState.guessedLetters = Array(wordState.targetWord.length).fill('').map((_, i) => 
                    wordState.revealedLetters[i] ? wordState.targetWord[i] : ''
                );
                
                if (wordState.attemptsLeft <= 0) {
                    endWordGame(false);
                } else {
                    updateGameUI();
                    if (!wordState.isMuted) sounds.wrong?.play();
                }
            }
            return;
        }
    }
    
    // If letter not in word or all correct positions already filled, place in first available position
    const emptyIndex = wordState.guessedLetters.findIndex((char, i) => 
        !char && !wordState.revealedLetters[i]
    );
    
    if (emptyIndex === -1) return; // No empty positions left
    
    // Place the letter in the first empty position
    wordState.guessedLetters[emptyIndex] = letter;
    
    // Update UI immediately
    updateGameUI();
    
    // Get the letter choice button and letter box
    const letterBtn = document.querySelector(`.letter-choice[data-letter="${letter}"]`);
    const letterBox = document.querySelectorAll('.letter-container')[emptyIndex];
    
    if (letterInWord) {
        // Letter is in word but not in this position - yellow glow
        letterBox.classList.add('present-feedback');
        if (!wordState.isMuted) sounds.correct?.play();
        
        setTimeout(() => {
            letterBox.classList.remove('present-feedback');
        }, 2000);
    } else {
        // Letter not in word at all - red glow
        letterBox.classList.add('wrong-feedback');
        if (!wordState.isMuted) sounds.wrong?.play();
        
        setTimeout(() => {
            letterBox.classList.remove('wrong-feedback');
            // Remove the incorrect letter after animation
            wordState.guessedLetters[emptyIndex] = '';
            updateGameUI();
        }, 2000);
        
        // Disable the wrong letter button
        letterBtn.classList.add('disabled-letter');
    }
    
    // Check if all letters are filled
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
        
        // Display guess result
        const resultRow = createGuessRow(guess);
        wordState.guesses.push(guess);
        wordGameEls.results.prepend(resultRow);
        
        // Reset for next attempt
        wordState.guessedLetters = Array(wordState.targetWord.length).fill('').map((_, i) => 
            wordState.revealedLetters[i] ? wordState.targetWord[i] : ''
        );
        
        if (wordState.attemptsLeft <= 0) {
            endWordGame(false);
        } else {
            updateGameUI();
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
    wordState.winsAtCurrentDifficulty = JSON.parse(localStorage.getItem('word-game-wins'))?.[wordState.difficulty] || 0;
    
    updateGameUI();
    if (!wordState.isMuted) sounds.hint?.play();
}

async function endWordGame(won) {
    wordState.isPlaying = false;
    clearInterval(wordState.timer);
    
    // Stop all sounds
    Object.values(sounds).forEach(sound => {
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    });
    
    // Re-enable difficulty buttons
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.disabled = false;
    });
    
    let message;
    if (won) {
        message = wordGameMessages.win[Math.floor(Math.random() * wordGameMessages.win.length)];
        wordState.winsAtCurrentDifficulty++;
        
        // Persist wins
        const winsData = JSON.parse(localStorage.getItem('word-game-wins')) || {};
        winsData[wordState.difficulty] = wordState.winsAtCurrentDifficulty;
        localStorage.setItem('word-game-wins', JSON.stringify(winsData));
        
        if (!wordState.isMuted) sounds.win?.play();
        
        // Check for difficulty progression
        const winsRequired = DIFFICULTY_PROGRESSION[wordState.difficulty];
        if (winsRequired && wordState.winsAtCurrentDifficulty >= winsRequired) {
            if (wordState.difficulty === 'easy') {
                setDifficulty('medium');
                wordState.winsAtCurrentDifficulty = 0;
                winsData.medium = 0;
                localStorage.setItem('word-game-wins', JSON.stringify(winsData));
                message += `<br><br>Great job! You've won ${winsRequired} times on Easy. Advancing to Medium difficulty!`;
            } else if (wordState.difficulty === 'medium') {
                setDifficulty('hard');
                wordState.winsAtCurrentDifficulty = 0;
                winsData.hard = 0;
                localStorage.setItem('word-game-wins', JSON.stringify(winsData));
                message += `<br><br>Excellent! You've won ${winsRequired} times on Medium. Now try Hard difficulty!`;
            }
        } else if (wordState.difficulty === 'hard') {
            message += `<br><br>Mastered Hard mode! You're a word game champion! (${wordState.winsAtCurrentDifficulty} wins on Hard)`;
        } else {
            const winsLeft = winsRequired - wordState.winsAtCurrentDifficulty;
            message += `<br><br>Nice work! ${winsLeft} more win${winsLeft === 1 ? '' : 's'} on ${wordState.difficulty} to advance!`;
        }
        
        // Automatically start next game
        setTimeout(() => {
            initializeGame();
            startWordGame();
        }, 2000); // Delay to show win message
    } else {
        message = wordState.score > 0 
            ? wordGameMessages.nearWin[Math.floor(Math.random() * wordGameMessages.nearWin.length)]
            : wordGameMessages.default[Math.floor(Math.random() * wordGameMessages.default.length)];
        // Add the correct answer to the message
        message += `<br><br>The word was: <strong>${wordState.targetWord}</strong>`;
        if (!wordState.isMuted) sounds.lose?.play();
    }
    
    wordGameEls.feedback.innerHTML = message;
    wordGameEls.feedback.className = `word-feedback ${won ? 'feedback-correct' : 'feedback-wrong'}`;
    
    // Show the full word
    wordGameEls.wordDisplay.innerHTML = `
        <div class="word-display-info">${wordState.category} (${wordState.targetWord.length} letters)</div>
        <div class="word-display-letters">${wordState.targetWord.split('').join(' ')}</div>
    `;
    
    // Save score to Firebase with limit
    if (wordState.score > 0) {
        try {
            const scoresQuery = query(
                collection(firestore, 'word-game-scores'),
                orderBy('timestamp', 'desc'),
                limit(10)
            );
            
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
    console.log('toggleMute called, current isMuted:', wordState.isMuted);
    wordState.isMuted = !wordState.isMuted;
    console.log('New isMuted:', wordState.isMuted);
    localStorage.setItem('triviaMasterMuteState', wordState.isMuted);
    wordGameEls.muteBtn.innerHTML = `<span class="material-icons">${wordState.isMuted ? 'volume_off' : 'volume_up'}</span>`;
    
    Object.values(sounds).forEach(sound => {
        if (sound) {
            console.log('Muting sound:', sound.id, 'to', wordState.isMuted);
            sound.muted = wordState.isMuted;
            if (wordState.isMuted) {
                sound.pause();
                sound.currentTime = 0;
            }
        } else {
            console.log('Sound element is null');
        }
    });
}

function setupWordGameEvents() {
    // Difficulty buttons
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const difficulty = btn.classList.contains('easy') ? 'easy' : 
                            btn.classList.contains('medium') ? 'medium' : 'hard';
            setDifficulty(difficulty);
        });
    });
    
    // Start button
    wordGameEls.startBtn.addEventListener('click', startWordGame);
    
    // New word button
    wordGameEls.newWordBtn.addEventListener('click', startWordGame);
    
    // Hint button
    wordGameEls.hintBtn.addEventListener('click', getHint);
    
    // Mute button
    wordGameEls.muteBtn.addEventListener('click', () => {
        console.log('Mute button clicked');
        toggleMute();
    });
    
    // Letter choices
    document.addEventListener('click', (e) => {
        // Handle letter choices
        const letterBtn = e.target.closest('.letter-choice');
        if (letterBtn && wordState.isPlaying) {
            makeGuess(letterBtn.dataset.letter);
            return; // Exit early if we handled a letter choice
        }
    
        // Handle remove buttons
        const removeBtn = e.target.closest('.remove-letter');
        if (removeBtn && wordState.isPlaying) {
            const index = parseInt(removeBtn.dataset.index);
            if (!wordState.revealedLetters[index]) {
                wordState.guessedLetters[index] = '';
                updateGameUI();
                if (!wordState.isMuted) sounds.wrong?.play();
            }
            return; // Exit early if we handled a remove action
        }
    });
}

async function initWordGame() {
    initializeGame();
    setDifficulty('easy'); // Start with easy mode
    
    wordState.isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;
    console.log('Initialized mute state:', wordState.isMuted);
    wordGameEls.muteBtn.innerHTML = `<span class="material-icons">${wordState.isMuted ? 'volume_off' : 'volume_up'}</span>`;
    
    Object.values(sounds).forEach(sound => {
        if (sound) {
            console.log('Setting initial mute for sound:', sound.id, 'to', wordState.isMuted);
            sound.muted = wordState.isMuted;
        }
    });
    
    setupWordGameEvents();
    
    const today = new Date().toISOString().split('T')[0];
    const lastPlayed = localStorage.getItem('word-game-last-played');
    
    if (lastPlayed !== today) {
        wordState.isDailyChallenge = true;
        localStorage.setItem('word-game-last-played', today);
    }
    
    // Start the game immediately
    await startWordGame();
}

export { initWordGame };