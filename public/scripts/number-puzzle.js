// /scripts/number-puzzle.js

// Puzzle state
const puzzleState = {
    targetNumber: 0,
    attemptsLeft: 5,
    maxAttempts: 5,
    minRange: 1,
    maxRange: 100,
    guesses: [],
    hintsUsed: 0,
    maxHints: 2
};

// Track events (reuse the trackEvent function from app.js, or redefine if needed)
function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, { event_category: category, event_label: label, value: value });
    }
}

// Start a new puzzle
function startNewPuzzle() {
    puzzleState.targetNumber = Math.floor(Math.random() * 100) + 1;
    puzzleState.attemptsLeft = 5;
    puzzleState.maxAttempts = 5;
    puzzleState.minRange = 1;
    puzzleState.maxRange = 100;
    puzzleState.guesses = [];
    puzzleState.hintsUsed = 0;
    puzzleState.maxHints = 2;

    updatePuzzleUI();
    const guessInput = document.getElementById('number-guess');
    const feedback = document.getElementById('puzzle-feedback');
    if (guessInput) guessInput.value = '';
    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'puzzle-feedback';
    }
}

// Handle guess submission
function handleGuessSubmit() {
    const guessInput = document.getElementById('number-guess');
    const feedback = document.getElementById('puzzle-feedback');
    const guess = parseInt(guessInput.value);

    if (isNaN(guess)) {
        if (feedback) {
            feedback.textContent = 'Please enter a valid number';
            feedback.className = 'puzzle-feedback feedback-wrong';
        }
        return;
    }

    if (guess < puzzleState.minRange || guess > puzzleState.maxRange) {
        if (feedback) {
            feedback.textContent = `Please enter a number between ${puzzleState.minRange} and ${puzzleState.maxRange}`;
            feedback.className = 'puzzle-feedback feedback-wrong';
        }
        return;
    }

    puzzleState.guesses.push(guess);
    puzzleState.attemptsLeft--;

    if (guess === puzzleState.targetNumber) {
        // Correct guess
        if (feedback) {
            feedback.textContent = '🎉 Correct! You guessed the number!';
            feedback.className = 'puzzle-feedback feedback-correct';
        }
        const submitButton = document.getElementById('submit-guess');
        if (submitButton) submitButton.disabled = true;
        trackEvent('puzzle_solved', 'number_puzzle', puzzleState.maxAttempts - puzzleState.attemptsLeft);
    } else if (puzzleState.attemptsLeft <= 0) {
        // Out of attempts
        if (feedback) {
            feedback.textContent = `Game Over! The number was ${puzzleState.targetNumber}`;
            feedback.className = 'puzzle-feedback feedback-wrong';
        }
        const submitButton = document.getElementById('submit-guess');
        if (submitButton) submitButton.disabled = true;
        trackEvent('puzzle_failed', 'number_puzzle', puzzleState.targetNumber);
    } else {
        // Give feedback
        if (guess < puzzleState.targetNumber) {
            puzzleState.minRange = guess + 1;
            if (feedback) {
                feedback.textContent = 'Too low! Try a higher number.';
                feedback.className = 'puzzle-feedback feedback-low';
            }
        } else {
            puzzleState.maxRange = guess - 1;
            if (feedback) {
                feedback.textContent = 'Too high! Try a lower number.';
                feedback.className = 'puzzle-feedback feedback-high';
            }
        }
    }

    updatePuzzleUI();
    if (guessInput) guessInput.value = '';
}

// Provide a hint
function giveHint() {
    if (puzzleState.hintsUsed >= puzzleState.maxHints) {
        alert('You have used all your hints!');
        return;
    }

    puzzleState.hintsUsed++;
    const hintRange = Math.floor((puzzleState.maxRange - puzzleState.minRange) / 4);
    const hint = `The number is between ${puzzleState.targetNumber - hintRange} and ${puzzleState.targetNumber + hintRange}`;

    const feedback = document.getElementById('puzzle-feedback');
    if (feedback) {
        feedback.textContent = hint;
        feedback.className = 'puzzle-feedback';
    }
    updatePuzzleUI();
    trackEvent('puzzle_hint', 'number_puzzle', puzzleState.hintsUsed);
}

// Update the puzzle UI
function updatePuzzleUI() {
    const attempts = document.getElementById('puzzle-attempts');
    const hint = document.getElementById('puzzle-hint');
    const historyElement = document.getElementById('guess-history');
    const hintButton = document.getElementById('puzzle-hint-btn');

    if (attempts) {
        attempts.textContent = `Attempts left: ${puzzleState.attemptsLeft}`;
    }
    if (hint) {
        hint.textContent = `Hint: It's between ${puzzleState.minRange} and ${puzzleState.maxRange}`;
    }
    if (historyElement) {
        historyElement.innerHTML = puzzleState.guesses
            .map((guess) => {
                const direction =
                    guess < puzzleState.targetNumber
                        ? '↑'
                        : guess > puzzleState.targetNumber
                        ? '↓'
                        : '✓';
                const className =
                    guess === puzzleState.targetNumber
                        ? 'correct'
                        : guess < puzzleState.targetNumber
                        ? 'low'
                        : 'high';
                return `<div class="guess-entry ${className}">
                    <span>${guess}</span>
                    <span>${direction}</span>
                </div>`;
            })
            .join('');
    }
    if (hintButton) {
        hintButton.textContent = `Get Hint (${puzzleState.maxHints - puzzleState.hintsUsed} left)`;
        hintButton.disabled = puzzleState.hintsUsed >= puzzleState.maxHints;
    }
}

// Setup event listeners
function setupPuzzleEvents() {
    const submitButton = document.getElementById('submit-guess');
    const newPuzzleButton = document.getElementById('new-puzzle');
    const hintButton = document.getElementById('puzzle-hint-btn');
    const guessInput = document.getElementById('number-guess');

    if (submitButton) {
        submitButton.addEventListener('click', handleGuessSubmit);
    }
    if (newPuzzleButton) {
        newPuzzleButton.addEventListener('click', startNewPuzzle);
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

// Initialize the puzzle when the screen is loaded
function initPuzzle() {
    setupPuzzleEvents();
    startNewPuzzle();
}

// Export the init function for use in router.js
export { initPuzzle };