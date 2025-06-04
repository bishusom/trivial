/* global gtag, confetti */

const GAME_CONFIG = {
    winsNeededForLevelUp: 3,
    baseRange: 20,
    rangeIncrement: 10,
    baseAttempts: 6,
    baseHints: 2,
    pointsPerLevel: 50,
    timeLimit: 60
};

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
    points: 0,
    timerStart: null,
    timerEnd: null,
    timerInterval: null,
    timeLeft: GAME_CONFIG.timeLimit,
    currentChallenge: null,
    gameStarted: false,
    isMuted: JSON.parse(localStorage.getItem('triviaMasterMuteState')) || 'false',
    unlockedFeatures: {
        doublePoints: false,
        extraHints: false,
        timeBonus: false
    }
};

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

const audioElements = {
    select: new Audio('/audio/click.mp3'),
    found: new Audio('/audio/correct.mp3'),
    win: new Audio('/audio/win.mp3'),
    error: new Audio('/audio/wrong.mp3')
};

function playSound(type) {
    if (puzzleState.isMuted) {
        console.log(`Sound ${type} skipped: muted`);
        return;
    }
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

function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, { event_category: category, event_label: label, value: value });
    }
}

function startTimer() {
    console.log('Starting timer');
    if (puzzleState.timerInterval) {
        clearInterval(puzzleState.timerInterval);
    }
    puzzleState.timeLeft = GAME_CONFIG.timeLimit;
    updateTimer();
    puzzleState.timerInterval = setInterval(() => {
        console.log(`Timer tick: ${puzzleState.timeLeft}`);
        puzzleState.timeLeft = Math.max(0, puzzleState.timeLeft - 1);
        updateTimer();
        if (puzzleState.timeLeft <= 0) {
            console.log('Timer expired');
            clearInterval(puzzleState.timerInterval);
            puzzleState.timerInterval = null;
            const feedback = document.getElementById('puzzle-feedback');
            if (feedback) {
                feedback.textContent = "Time's up!";
                feedback.className = 'puzzle-feedback feedback-wrong';
            }
            puzzleState.winsThisLevel = 0;
            playSound('error');
            setTimeout(startNewPuzzle, 2000);
        }
    }, 1000);
}

function updateTimer() {
    const timeElement = document.getElementById('puzzle-time');
    if (timeElement) {
        const minutes = Math.floor(puzzleState.timeLeft / 60);
        const seconds = puzzleState.timeLeft % 60;
        timeElement.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        timeElement.className = `timer-value ${puzzleState.timeLeft <= 10 ? 'time-critical' : ''}`;
    } else {
        console.warn('Timer element not found');
    }
}

function showConfetti(options = {}) {
    console.log('Triggering confetti');
    if (typeof confetti === 'undefined') {
        console.error('Confetti library not loaded');
        return;
    }
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

function startNewPuzzle() {
    const levelRange = GAME_CONFIG.baseRange + ((puzzleState.level - 1) * GAME_CONFIG.rangeIncrement);
    
    puzzleState.minRange = 1;
    puzzleState.maxRange = levelRange;
    puzzleState.targetNumber = Math.floor(Math.random() * levelRange) + 1;
    puzzleState.attemptsLeft = GAME_CONFIG.baseAttempts + Math.floor(puzzleState.level / 3);
    puzzleState.maxAttempts = puzzleState.attemptsLeft;
    puzzleState.guesses = [];
    puzzleState.hintsUsed = 0;
    puzzleState.maxHints = puzzleState.unlockedFeatures.extraHints ? 3 : GAME_CONFIG.baseHints;
    puzzleState.timerStart = null;
    puzzleState.timerEnd = null;
    puzzleState.gameStarted = false;
    puzzleState.blindMode = false;
    puzzleState.speedRun = false;
    
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
    
    startTimer();
    setTimeout(() => { guessInput && guessInput.focus(); }, 100);
}

function showChallengeBanner() {
    const banner = document.getElementById('challenge-banner');
    const desc = document.getElementById('challenge-description');
    if (banner && desc && puzzleState.currentChallenge) {
        banner.classList.remove('hidden');
        desc.textContent = puzzleState.currentChallenge.description;
    }
}

function hideChallengeBanner() {
    const banner = document.getElementById('challenge-banner');
    if (banner) banner.classList.add('hidden');
}

function calculateScore() {
    if (!puzzleState.timerStart) return 0;
    
    const timeTaken = (puzzleState.timerEnd - puzzleState.timerStart) / 1000;
    const timeThreshold = puzzleState.speedRun ? 30 : 60;
    
    let basePoints = GAME_CONFIG.pointsPerLevel * puzzleState.level;
    let timeBonus = Math.max(0, timeThreshold - timeTaken) * 5;
    let hintPenalty = puzzleState.hintsUsed * 30;
    let challengeBonus = puzzleState.currentChallenge ? 200 : 0;
    let rangeBonus = Math.floor(puzzleState.maxRange / 10);
    
    if (puzzleState.unlockedFeatures.doublePoints) basePoints *= 2;
    if (puzzleState.unlockedFeatures.timeBonus) timeBonus *= 1.5;
    
    return Math.floor(basePoints + timeBonus + challengeBonus + rangeBonus - hintPenalty);
}

function handleGuessSubmit() {
    const guessInput = document.getElementById('number-guess');
    const feedback = document.getElementById('puzzle-feedback');
    const guess = parseInt(guessInput.value);

    if (!puzzleState.gameStarted && !isNaN(guess) && 
        guess >= puzzleState.minRange && guess <= puzzleState.maxRange) {
        puzzleState.timerStart = Date.now();
        puzzleState.gameStarted = true;
        playSound('select');
    }

    if (isNaN(guess)) {
        if (feedback) {
            feedback.textContent = 'Please enter a valid number';
            feedback.className = 'puzzle-feedback feedback-wrong';
            playSound('error');
        }
        return;
    }

    if (guess < puzzleState.minRange || guess > puzzleState.maxRange) {
        if (feedback) {
            feedback.textContent = `Please enter between ${puzzleState.minRange} and ${puzzleState.maxRange}`;
            feedback.className = 'puzzle-feedback feedback-wrong';
            playSound('error');
        }
        return;
    }

    puzzleState.guesses.push(guess);
    puzzleState.attemptsLeft--;

    if (guess === puzzleState.targetNumber) {
        puzzleState.timerEnd = Date.now();
        clearInterval(puzzleState.timerInterval);
        puzzleState.timerInterval = null;
        puzzleState.winsThisLevel++;
        
        const pointsEarned = calculateScore();
        puzzleState.points += pointsEarned;
        
        const timeTaken = puzzleState.timerStart ? 
            (puzzleState.timerEnd - puzzleState.timerStart) / 1000 : 0;
        
        if (feedback) {
            feedback.innerHTML = `
                <div class="feedback-message">
                    <strong>🎉 Correct! (Level ${puzzleState.level})</strong><br>
                    Time: ${timeTaken.toFixed(1)}s<br>
                    Wins at this level: ${puzzleState.winsThisLevel}/${GAME_CONFIG.winsNeededForLevelUp}<br>
                    Points: +${pointsEarned}
                </div>
            `;
            feedback.className = 'puzzle-feedback feedback-correct';
        }
        
        playSound('win');
        showConfetti();
        
        const submitButton = document.getElementById('submit-guess');
        if (submitButton) submitButton.disabled = true;
        
        trackEvent('puzzle_solved', 'number_puzzle', puzzleState.maxAttempts - puzzleState.attemptsLeft);
        
        checkForUnlocks();
        
        if (puzzleState.winsThisLevel >= GAME_CONFIG.winsNeededForLevelUp) {
            puzzleState.level++;
            puzzleState.winsThisLevel = 0;
            setTimeout(() => {
                feedback.innerHTML += `<br><br>Advancing to Level ${puzzleState.level} (1-${GAME_CONFIG.baseRange + ((puzzleState.level - 1) * GAME_CONFIG.rangeIncrement)})!`;
                showConfetti({ particleCount: 200, spread: 100 });
                setTimeout(startNewPuzzle, 3000);
            }, 1500);
        } else {
            setTimeout(startNewPuzzle, 3000);
        }
    } else if (puzzleState.attemptsLeft <= 0) {
        puzzleState.timerEnd = Date.now();
        clearInterval(puzzleState.timerInterval);
        puzzleState.timerInterval = null;
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
            playSound('error');
        }
        
        const submitButton = document.getElementById('submit-guess');
        if (submitButton) submitButton.disabled = true;
        trackEvent('puzzle_failed', 'number_puzzle', puzzleState.targetNumber);
        
        setTimeout(startNewPuzzle, 3000);
    } else if (!puzzleState.blindMode) {
        if (guess < puzzleState.targetNumber) {
            puzzleState.minRange = guess + 1;
            if (feedback) {
                feedback.textContent = 'Too low! Try a higher number.';
                feedback.className = 'puzzle-feedback feedback-low';
                playSound('error');
            }
        } else {
            puzzleState.maxRange = guess - 1;
            if (feedback) {
                feedback.textContent = 'Too high! Try a lower number.';
                feedback.className = 'puzzle-feedback feedback-high';
                playSound('error');
            }
        }
    } else {
        if (feedback) {
            feedback.textContent = 'Guess submitted (Blind Mode)';
            feedback.className = 'puzzle-feedback';
            playSound('select');
        }
    }

    updatePuzzleUI();
    if (guessInput) guessInput.value = '';
}

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
    if (puzzleState.level >= 7 && !puzzleState.unlockedFeatures.timeBonus) {
        puzzleState.unlockedFeatures.timeBonus = true;
        const feedback = document.getElementById('puzzle-feedback');
        if (feedback) {
            feedback.innerHTML += `<br><br>✨ Unlocked: Time Bonus! (50% more points for fast solves)`;
        }
        trackEvent('feature_unlock', 'game', 'time_bonus');
    }
}

function giveHint() {
    if (puzzleState.hintsUsed >= puzzleState.maxHints) {
        const feedback = document.getElementById('puzzle-feedback');
        if (feedback) {
            feedback.textContent = 'You have used all your hints!';
            feedback.className = 'puzzle-feedback feedback-wrong';
            playSound('error');
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
        playSound('select');
    }
    updatePuzzleUI();
    trackEvent('puzzle_hint', 'number_puzzle', puzzleState.hintsUsed);
}

function updatePuzzleUI() {
    const attempts = document.getElementById('puzzle-attempts');
    const hint = document.getElementById('puzzle-hint');
    const historyElement = document.getElementById('guess-history');
    const hintButton = document.getElementById('puzzle-hint-btn');
    const levelDisplay = document.getElementById('current-level');
    const pointsDisplay = document.getElementById('current-points');
    const guessInput = document.getElementById('number-guess');

    if (attempts) {
        attempts.textContent = `Attempts left: ${puzzleState.attemptsLeft}/${puzzleState.maxAttempts}`;
    }
    if (hint) {
        hint.textContent = `Level ${puzzleState.level}: Between ${puzzleState.minRange}-${puzzleState.maxRange}`;
    }
    if (historyElement) {
        historyElement.innerHTML = '';
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
        levelDisplay.textContent = `Level: ${puzzleState.level}`;
    }
    if (pointsDisplay) {
        pointsDisplay.textContent = `Points: ${puzzleState.points}`;
    }
    if (guessInput) {
        guessInput.min = puzzleState.minRange;
        guessInput.max = puzzleState.maxRange;
        guessInput.placeholder = `Guess (${puzzleState.minRange}-${puzzleState.maxRange})`;
    }
}

function setupPuzzleEvents() {
    const submitButton = document.getElementById('submit-guess');
    const newPuzzleButton = document.getElementById('new-puzzle');
    const hintButton = document.getElementById('puzzle-hint-btn');
    const guessInput = document.getElementById('number-guess');
    const muteBtn = document.getElementById('mute-btn');
    const muteBtnIcon = document.querySelector('#mute-btn .material-icons');

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
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            puzzleState.isMuted = !puzzleState.isMuted;
            localStorage.setItem('triviaMasterMuteState', puzzleState.isMuted);
            if (muteBtnIcon) {
                muteBtnIcon.textContent = puzzleState.isMuted ? 'volume_off' : 'volume_up';
            }
            if (puzzleState.isMuted) {
                stopAllSounds();
            }
        });
    }
}

function initPuzzle() {
    setupPuzzleEvents();
    startNewPuzzle();
    
    const muteBtnIcon = document.querySelector('#mute-btn .material-icons');
    if (muteBtnIcon) {
        muteBtnIcon.textContent = puzzleState.isMuted ? 'volume_off' : 'volume_up';
    }
    if (puzzleState.isMuted) {
        stopAllSounds();
    }
}

export { initPuzzle };