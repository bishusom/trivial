// Game configuration
const GAME_CONFIG = {
    winsNeededForLevelUp: 3, // Number of wins needed to advance to next level
    baseRange: 20,           // Starting range (1-20)
    rangeIncrement: 10,      // How much to increase range each level
    baseAttempts: 6,         // Starting number of attempts
    baseHints: 2,            // Starting number of hints
    pointsPerLevel: 50       // Base points multiplied by level
};

// Puzzle state
const puzzleState = {
    targetNumber: 0,
    attemptsLeft: GAME_CONFIG.baseAttempts,
    maxAttempts: GAME_CONFIG.baseAttempts,
    minRange: 1,
    maxRange: GAME_CONFIG.baseRange,
    guesses: [],
    hintsUsed: 0,
    maxHints: GAME_CONFIG.baseHints,
    level: 1,
    winsThisLevel: 0,
    streak: 0,
    maxStreak: 0,
    points: 0,
    timerStart: null,
    timerEnd: null,
    currentChallenge: null,
    gameStarted: false,
    unlockedFeatures: {
        doublePoints: false,
        extraHints: false,
        timeBonus: false
    }
};

// Challenge modes
const CHALLENGES = [
    { 
        name: "Blind Mode", 
        description: "No feedback after guesses!", 
        modifier: (state) => { state.blindMode = true; }
    },
    { 
        name: "Speed Run", 
        description: "Solve in under 30 seconds for bonus!", 
        modifier: (state) => { state.speedRun = true; }
    },
    { 
        name: "Precision", 
        description: "Number range doubled!", 
        modifier: (state) => { state.maxRange *= 2; }
    }
];

// Track events
function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, { event_category: category, event_label: label, value: value });
    }
}

// Start a new puzzle
function startNewPuzzle() {
    // Calculate range based on level
    const levelRange = GAME_CONFIG.baseRange + ((puzzleState.level - 1) * GAME_CONFIG.rangeIncrement);
    
    // Set up puzzle with level-appropriate range
    puzzleState.minRange = 1;
    puzzleState.maxRange = levelRange;
    puzzleState.targetNumber = Math.floor(Math.random() * levelRange) + 1;
    
    // Scale attempts slightly with level
    puzzleState.attemptsLeft = GAME_CONFIG.baseAttempts + Math.floor(puzzleState.level / 3);
    puzzleState.maxAttempts = puzzleState.attemptsLeft;
    
    // Reset game state
    puzzleState.guesses = [];
    puzzleState.hintsUsed = 0;
    puzzleState.maxHints = puzzleState.unlockedFeatures.extraHints ? 3 : GAME_CONFIG.baseHints;
    puzzleState.timerStart = null;
    puzzleState.timerEnd = null;
    puzzleState.gameStarted = false;
    puzzleState.blindMode = false;
    puzzleState.speedRun = false;
    
    // Apply challenge every 3 levels
    if (puzzleState.level % 3 === 0) {
        puzzleState.currentChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
        puzzleState.currentChallenge.modifier(puzzleState);
        showChallengeBanner();
    } else {
        puzzleState.currentChallenge = null;
        hideChallengeBanner();
    }
    
    updatePuzzleUI();
    const guessInput = document.getElementById('number-guess');
    const feedback = document.getElementById('puzzle-feedback');
    if (guessInput) {
        guessInput.value = '';
        guessInput.min = puzzleState.minRange;
        guessInput.max = puzzleState.maxRange;
        guessInput.placeholder = `Guess (${puzzleState.minRange}-${puzzleState.maxRange})`;
    }
    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'puzzle-feedback';
    }
    
    setTimeout(() => { guessInput.focus(); }, 100);
}

// Show challenge banner
function showChallengeBanner() {
    const banner = document.getElementById('challenge-banner');
    const desc = document.getElementById('challenge-description');
    if (banner && desc && puzzleState.currentChallenge) {
        banner.classList.remove('hidden');
        desc.textContent = puzzleState.currentChallenge.description;
    }
}

// Hide challenge banner
function hideChallengeBanner() {
    const banner = document.getElementById('challenge-banner');
    if (banner) banner.classList.add('hidden');
}

// Calculate score
function calculateScore() {
    if (!puzzleState.timerStart) return 0;
    
    const timeTaken = (puzzleState.timerEnd - puzzleState.timerStart) / 1000;
    const timeThreshold = puzzleState.speedRun ? 30 : 60;
    
    let basePoints = GAME_CONFIG.pointsPerLevel * puzzleState.level;
    let streakBonus = puzzleState.streak * 20;
    let timeBonus = Math.max(0, timeThreshold - timeTaken) * 5;
    let hintPenalty = puzzleState.hintsUsed * 30;
    let challengeBonus = puzzleState.currentChallenge ? 200 : 0;
    let rangeBonus = Math.floor(puzzleState.maxRange / 10);
    
    // Apply unlocked features
    if (puzzleState.unlockedFeatures.doublePoints) basePoints *= 2;
    if (puzzleState.unlockedFeatures.timeBonus) timeBonus *= 1.5;
    
    return Math.floor(basePoints + streakBonus + timeBonus + challengeBonus + rangeBonus - hintPenalty);
}

// Handle guess submission
function handleGuessSubmit() {
    const guessInput = document.getElementById('number-guess');
    const feedback = document.getElementById('puzzle-feedback');
    const guess = parseInt(guessInput.value);

    // Start timer on first valid guess
    if (!puzzleState.gameStarted && !isNaN(guess) && 
        guess >= puzzleState.minRange && guess <= puzzleState.maxRange) {
        puzzleState.timerStart = Date.now();
        puzzleState.gameStarted = true;
    }

    if (isNaN(guess)) {
        if (feedback) {
            feedback.textContent = 'Please enter a valid number';
            feedback.className = 'puzzle-feedback feedback-wrong';
        }
        return;
    }

    if (guess < puzzleState.minRange || guess > puzzleState.maxRange) {
        if (feedback) {
            feedback.textContent = `Please enter between ${puzzleState.minRange}-${puzzleState.maxRange}`;
            feedback.className = 'puzzle-feedback feedback-wrong';
        }
        return;
    }

    puzzleState.guesses.push(guess);
    puzzleState.attemptsLeft--;

    if (guess === puzzleState.targetNumber) {
        // Correct guess
        puzzleState.timerEnd = Date.now();
        puzzleState.streak++;
        puzzleState.maxStreak = Math.max(puzzleState.streak, puzzleState.maxStreak);
        puzzleState.winsThisLevel++;
        
        const pointsEarned = calculateScore();
        puzzleState.points += pointsEarned;
        
        const timeTaken = puzzleState.timerStart ? 
            (puzzleState.timerEnd - puzzleState.timerStart) / 1000 : 0;
        
        if (feedback) {
            feedback.innerHTML = `
                <div class="feedback-message">
                    <strong>🎉 Correct! (Level ${puzzleState.level})</strong><br>
                    Time: ${timeTaken.toFixed(1)}s | Streak: ${puzzleState.streak}<br>
                    Wins at this level: ${puzzleState.winsThisLevel}/${GAME_CONFIG.winsNeededForLevelUp}<br>
                    Points: +${pointsEarned}
                </div>
            `;
            feedback.className = 'puzzle-feedback feedback-correct';
        }
        
        const submitButton = document.getElementById('submit-guess');
        if (submitButton) submitButton.disabled = true;
        
        trackEvent('puzzle_solved', 'number_puzzle', puzzleState.maxAttempts - puzzleState.attemptsLeft);
        
        // Check for unlocks
        checkForUnlocks();
        
        // Check if player should level up
        if (puzzleState.winsThisLevel >= GAME_CONFIG.winsNeededForLevelUp) {
            puzzleState.level++;
            puzzleState.winsThisLevel = 0;
            setTimeout(() => {
                feedback.innerHTML += `<br><br>Advancing to Level ${puzzleState.level} (1-${GAME_CONFIG.baseRange + ((puzzleState.level - 1) * GAME_CONFIG.rangeIncrement)})!`;
                setTimeout(startNewPuzzle, 3000);
            }, 1500);
        } else {
            setTimeout(startNewPuzzle, 3000);
        }
    } else if (puzzleState.attemptsLeft <= 0) {
        // Out of attempts
        puzzleState.timerEnd = Date.now();
        puzzleState.streak = 0;
        puzzleState.winsThisLevel = 0;
        
        if (feedback) {
            feedback.innerHTML = `
                <div class="feedback-message">
                    <strong>Game Over!</strong><br>
                    The number was ${puzzleState.targetNumber}<br>
                    Level: ${puzzleState.level} (1-${puzzleState.maxRange})
                </div>
            `;
            feedback.className = 'puzzle-feedback feedback-wrong';
        }
        
        const submitButton = document.getElementById('submit-guess');
        if (submitButton) submitButton.disabled = true;
        trackEvent('puzzle_failed', 'number_puzzle', puzzleState.targetNumber);
        
        setTimeout(startNewPuzzle, 3000);
    } else if (!puzzleState.blindMode) {
        // Give feedback (unless in blind mode)
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
    } else {
        // Blind mode - no feedback
        if (feedback) {
            feedback.textContent = 'Guess submitted (Blind Mode)';
            feedback.className = 'puzzle-feedback';
        }
    }

    updatePuzzleUI();
    if (guessInput) guessInput.value = '';
}

// Check for unlocked features
function checkForUnlocks() {
    if (puzzleState.level >= 3 && !puzzleState.unlockedFeatures.extraHints) {
        puzzleState.unlockedFeatures.extraHints = true;
        const feedback = document.getElementById('puzzle-feedback');
        if (feedback) {
            feedback.innerHTML += `<br><br>✨ Unlocked: Extra Hints! (3 per game now)`;
        }
        trackEvent('feature_unlock', 'game', 'extra_hints');
    }
    if (puzzleState.level >= 5 && !puzzleState.unlockedFeatures.doublePoints) {
        puzzleState.unlockedFeatures.doublePoints = true;
        const feedback = document.getElementById('puzzle-feedback');
        if (feedback) {
            feedback.innerHTML += `<br><br>✨ Unlocked: Double Points!`;
        }
        trackEvent('feature_unlock', 'game', 'double_points');
    }
    if (puzzleState.streak >= 3 && !puzzleState.unlockedFeatures.timeBonus) {
        puzzleState.unlockedFeatures.timeBonus = true;
        const feedback = document.getElementById('puzzle-feedback');
        if (feedback) {
            feedback.innerHTML += `<br><br>✨ Unlocked: Time Bonus! (50% more points for fast solves)`;
        }
        trackEvent('feature_unlock', 'game', 'time_bonus');
    }
}

// Provide a hint
function giveHint() {
    if (puzzleState.hintsUsed >= puzzleState.maxHints) {
        const feedback = document.getElementById('puzzle-feedback');
        if (feedback) {
            feedback.textContent = 'You have used all your hints!';
            feedback.className = 'puzzle-feedback feedback-wrong';
        }
        return;
    }

    puzzleState.hintsUsed++;
    const hintRange = Math.floor((puzzleState.maxRange - puzzleState.minRange) / 4);
    const hint = `The number is between ${Math.max(puzzleState.minRange, puzzleState.targetNumber - hintRange)} 
                 and ${Math.min(puzzleState.maxRange, puzzleState.targetNumber + hintRange)}`;

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
    const levelDisplay = document.getElementById('current-level');
    const streakDisplay = document.getElementById('current-streak');
    const pointsDisplay = document.getElementById('current-points');
    const timeDisplay = document.getElementById('current-time');
    const progressFill = document.getElementById('progress-fill');

    if (attempts) {
        attempts.textContent = `Attempts left: ${puzzleState.attemptsLeft}/${puzzleState.maxAttempts}`;
    }
    if (hint) {
        hint.textContent = `Level ${puzzleState.level}: Between ${puzzleState.minRange}-${puzzleState.maxRange}`;
    }
    if (historyElement) {
        // Clear previous content
        historyElement.innerHTML = '';
        
        // Add current guesses in horizontal layout
        puzzleState.guesses.forEach(guess => {
            const direction = 
                guess < puzzleState.targetNumber ? '↑' :
                guess > puzzleState.targetNumber ? '↓' : '✓';
                
            const className = 
                guess === puzzleState.targetNumber ? 'correct' :
                guess < puzzleState.targetNumber ? 'low' : 'high';
                
            const guessElement = document.createElement('div');
            guessElement.className = `guess-entry ${className}`;
            guessElement.innerHTML = `
                <span>${guess}</span>
                <span>${direction}</span>
            `;
            historyElement.appendChild(guessElement);
        });
    }
    if (hintButton) {
        hintButton.textContent = `Get Hint (${puzzleState.maxHints - puzzleState.hintsUsed} left)`;
        hintButton.disabled = puzzleState.hintsUsed >= puzzleState.maxHints;
    }
    if (levelDisplay) {
        levelDisplay.textContent = puzzleState.level;
    }
    if (streakDisplay) {
        streakDisplay.textContent = puzzleState.streak;
    }
    if (pointsDisplay) {
        pointsDisplay.textContent = puzzleState.points;
    }
    if (timeDisplay) {
        if (puzzleState.timerStart) {
            const timeElapsed = puzzleState.timerEnd ? 
                (puzzleState.timerEnd - puzzleState.timerStart) / 1000 : 
                (Date.now() - puzzleState.timerStart) / 1000;
            timeDisplay.textContent = timeElapsed.toFixed(1);
        } else {
            timeDisplay.textContent = '0.0';
        }
    }
    if (progressFill) {
        const progress = ((puzzleState.maxAttempts - puzzleState.attemptsLeft) / puzzleState.maxAttempts) * 100;
        progressFill.style.width = `${progress}%`;
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

// Initialize the puzzle
function initPuzzle() {
    setupPuzzleEvents();
    startNewPuzzle();
    
    // Update time display every second
    setInterval(() => {
        const timeDisplay = document.getElementById('current-time');
        if (timeDisplay && puzzleState.timerStart && !puzzleState.timerEnd) {
            const timeElapsed = (Date.now() - puzzleState.timerStart) / 1000;
            timeDisplay.textContent = timeElapsed.toFixed(1);
        }
    }, 100);
}

export { initPuzzle };