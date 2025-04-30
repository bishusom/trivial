// /scripts/word-game.js

// Word game state
const wordState = {
    targetWord: '',
    attemptsLeft: 6,
    maxAttempts: 6,
    guesses: [],
    hintsUsed: 0,
    maxHints: 2,
    wordList: ['apple', 'beach', 'chair', 'dance', 'eagle', 'flame', 'grape', 'house', 'image', 'jolly']
};

// Track events
function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, { event_category: category, event_label: label, value: value });
    }
}

// Start a new game
function startNewGame() {
    wordState.targetWord = wordState.wordList[Math.floor(Math.random() * wordState.wordList.length)];
    wordState.attemptsLeft = 6;
    wordState.maxAttempts = 6;
    wordState.guesses = [];
    wordState.hintsUsed = 0;
    wordState.maxHints = 2;

    updateWordGameUI();
    const guessInput = document.getElementById('word-guess');
    const feedback = document.getElementById('word-feedback');
    if (guessInput) guessInput.value = '';
    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'word-feedback';
    }
}

// Handle guess submission
function handleGuessSubmit() {
    const guessInput = document.getElementById('word-guess');
    const feedback = document.getElementById('word-feedback');
    const guess = guessInput.value.toLowerCase().trim();

    if (!/^[a-z]{5}$/.test(guess)) {
        if (feedback) {
            feedback.textContent = 'Please enter a valid 5-letter word';
            feedback.className = 'word-feedback feedback-wrong';
        }
        return;
    }

    if (!wordState.wordList.includes(guess)) {
        if (feedback) {
            feedback.textContent = 'Word not in list. Try another!';
            feedback.className = 'word-feedback feedback-wrong';
        }
        return;
    }

    wordState.guesses.push(guess);
    wordState.attemptsLeft--;

    if (guess === wordState.targetWord) {
        if (feedback) {
            feedback.textContent = '🎉 Correct! You guessed the word!';
            feedback.className = 'word-feedback feedback-correct';
        }
        const submitButton = document.getElementById('submit-word');
        if (submitButton) submitButton.disabled = true;
        trackEvent('word_game_solved', 'word_game', wordState.maxAttempts - wordState.attemptsLeft);
    } else if (wordState.attemptsLeft <= 0) {
        if (feedback) {
            feedback.textContent = `Game Over! The word was ${wordState.targetWord.toUpperCase()}`;
            feedback.className = 'word-feedback feedback-wrong';
        }
        const submitButton = document.getElementById('submit-word');
        if (submitButton) submitButton.disabled = true;
        trackEvent('word_game_failed', 'word_game', wordState.targetWord);
    } else {
        if (feedback) {
            feedback.textContent = 'Try again!';
            feedback.className = 'word-feedback';
        }
    }

    updateWordGameUI();
    if (guessInput) guessInput.value = '';
}

// Provide a hint
function giveHint() {
    if (wordState.hintsUsed >= wordState.maxHints) {
        alert('You have used all your hints!');
        return;
    }

    wordState.hintsUsed++;
    const unrevealedPositions = Array.from({ length: 5 }, (_, i) => i)
        .filter(i => !wordState.guesses.some(g => g[i] === wordState.targetWord[i]));
    if (unrevealedPositions.length === 0) {
        alert('No more hints available!');
        return;
    }
    const hintPosition = unrevealedPositions[Math.floor(Math.random() * unrevealedPositions.length)];
    const hint = `Letter ${hintPosition + 1} is ${wordState.targetWord[hintPosition].toUpperCase()}`;

    const feedback = document.getElementById('word-feedback');
    if (feedback) {
        feedback.textContent = hint;
        feedback.className = 'word-feedback';
    }
    updateWordGameUI();
    trackEvent('word_game_hint', 'word_game', wordState.hintsUsed);
}

// Update the game UI
function updateWordGameUI() {
    const attempts = document.getElementById('word-attempts');
    const hint = document.getElementById('word-hint');
    const grid = document.getElementById('guess-grid');
    const hintButton = document.getElementById('word-hint-btn');

    if (attempts) {
        attempts.textContent = `Attempts left: ${wordState.attemptsLeft}`;
    }
    if (hint) {
        hint.textContent = `Hint: It's a 5-letter word`;
    }
    if (grid) {
        grid.innerHTML = Array(6).fill().map((_, row) => {
            const guess = wordState.guesses[row] || '';
            return `<div class="guess-row">${
                Array(5).fill().map((_, col) => {
                    const letter = guess[col] || '';
                    let className = 'letter-box';
                    if (guess && letter) {
                        if (letter === wordState.targetWord[col]) {
                            className += ' correct';
                        } else if (wordState.targetWord.includes(letter)) {
                            className += ' present';
                        } else {
                            className += ' absent';
                        }
                    }
                    return `<span class="${className}">${letter.toUpperCase()}</span>`;
                }).join('')
            }</div>`;
        }).join('');
    }
    if (hintButton) {
        hintButton.textContent = `Get Hint (${wordState.maxHints - wordState.hintsUsed} left)`;
        hintButton.disabled = wordState.hintsUsed >= wordState.maxHints;
    }
}

// Setup event listeners
function setupWordGameEvents() {
    const submitButton = document.getElementById('submit-word');
    const newGameButton = document.getElementById('new-word');
    const hintButton = document.getElementById('word-hint-btn');
    const guessInput = document.getElementById('word-guess');

    if (submitButton) {
        submitButton.addEventListener('click', handleGuessSubmit);
    }
    if (newGameButton) {
        newGameButton.addEventListener('click', startNewGame);
    }
    if (hintButton) {
        hintButton.addEventListener('click', giveHint);
    }
    if (guessInput) {
        guessInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleGuessSubmit();
        });
    }
}

// Initialize the game
function initWordGame() {
    setupWordGameEvents();
    startNewGame();
}

export { initWordGame };