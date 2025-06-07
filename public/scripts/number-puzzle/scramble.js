/* global gtag, confetti */

export function initPuzzle() {
    console.log('Starting Number Scramble');

    const gameState = {
        numbers: [],
        target: null,
        score: 0,
        currentExpression: '',
        usedNumbers: [],
        usedIndices: [],
        level: 1,
        xp: 0,
        coins: 0,
        difficulty: 'easy',
        gamesPlayed: { easy: 0, medium: 0, hard: 0 },
        consecutiveHardWins: 0,
        unlockedFeatures: [],
        challengeMode: null,
        stats: {
            puzzlesSolved: 0,
            totalPoints: 0,
            hintsUsed: 0,
        },
        isMuted: JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false,
        timeLeft: 60,
        timerInterval: null,
    };

    const audioElements = {
        select: new Audio('/audio/click.mp3'),
        found: new Audio('/audio/correct.mp3'),
        win: new Audio('/audio/win.mp3'),
        error: new Audio('/audio/wrong.mp3')
    };

    const elements = {
        tilesContainer: document.getElementById('scramble-tiles'),
        operatorsContainer: document.getElementById('scramble-operators'),
        submitBtn: document.getElementById('scramble-submit'),
        clearBtn: document.getElementById('scramble-clear'),
        newBtn: document.getElementById('scramble-new'),
        hintBtn: document.getElementById('scramble-hint'),
        targetEl: document.getElementById('scramble-target'),
        scoreEl: document.getElementById('scramble-score'),
        levelEl: document.getElementById('scramble-level'),
        timeEl: document.getElementById('scramble-time') || createTimeElement(),
        expressionEl: document.getElementById('scramble-expression') || createExpressionElement(),
        coinsEl: document.getElementById('scramble-coins')
    };

    function playSound(type) {
        if (gameState.isMuted) {
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

    function createTimeElement() {
        const element = document.createElement('span');
        element.id = 'scramble-time';
        element.className = 'timer-value';
        const meta = document.querySelector('.puzzle-meta');
        if (meta) meta.appendChild(element);
        return element;
    }

    function createExpressionElement() {
        const element = document.createElement('div');
        element.id = 'scramble-expression';
        element.className = 'scramble-expression';
        const targetEl = document.getElementById('scramble-target');
        if (targetEl) targetEl.parentNode.insertBefore(element, targetEl.nextSibling);
        return element;
    }

    function startTimer() {
        console.log('Starting timer');
        if (gameState.timerInterval) {
            clearInterval(gameState.timerInterval);
        }
        gameState.timeLeft = 60;
        updateTimer();
        gameState.timerInterval = setInterval(() => {
            console.log(`Timer tick: ${gameState.timeLeft}`);
            gameState.timeLeft = Math.max(0, gameState.timeLeft - 1);
            updateTimer();
            if (gameState.timeLeft <= 0) {
                console.log('Timer expired');
                clearInterval(gameState.timerInterval);
                gameState.timerInterval = null;
                updateFeedback('error', "Time's up!");
                gameState.consecutiveHardWins = 0;
                playSound('error');
                setTimeout(generateNewPuzzle, 2000);
            }
        }, 1000);
    }

    function updateTimer() {
        if (elements.timeEl) {
            const minutes = Math.floor(gameState.timeLeft / 60);
            const seconds = gameState.timeLeft % 60;
            elements.timeEl.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            elements.timeEl.className = `timer-value ${gameState.timeLeft <= 10 ? 'time-critical' : ''}`;
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

    function trackEvent(action, category, label, value) {
        if (typeof gtag !== 'undefined') {
            gtag('event', action, { event_category: category, event_label: label, value: value });
        }
    }

    function clearInput() {
        gameState.currentExpression = '';
        gameState.usedNumbers = [];
        gameState.usedIndices = [];
        renderTiles();
        renderExpression();
        updateFeedback('info', 'Cleared');
        playSound('select');
    }

    function initGame() {
        setupEventListeners();
        generateNewPuzzle();
        updateUI();
        if (gameState.isMuted) {
            stopAllSounds();
        }
        const muteBtnIcon = document.querySelector('#mute-btn .material-icons');
        if (muteBtnIcon) {
            muteBtnIcon.textContent = gameState.isMuted ? 'volume_off' : 'volume_up';
        }
    }

    function generateNewPuzzle() {
        trackEvent('scramble_started', 'number_scramble', 1);
        gameState.currentExpression = '';
        gameState.usedNumbers = [];
        gameState.usedIndices = [];
        gameState.numbers = generateNumbers();
        gameState.target = generateTarget();
        renderTiles();
        renderOperators();
        renderExpression();
        updateUI();
        startTimer();
        flashTarget();
    }

    function flashTarget() {
        elements.targetEl.style.transition = 'all 0.3s';
        elements.targetEl.style.transform = 'scale(1.2)';
        elements.targetEl.style.color = '#ffd700';
        setTimeout(() => {
            elements.targetEl.style.transform = 'scale(1)';
            elements.targetEl.style.color = '';
        }, 500);
    }

    function generateNumbers() {
        const count = 6 + Math.floor(gameState.level / 5);
        const numbers = [];
        for (let i = 0; i < count; i++) {
            let max = 9;
            if (gameState.difficulty === 'medium') max = 15;
            if (gameState.difficulty === 'hard') max = 25;
            if (gameState.difficulty === 'expert') max = 50;
            numbers.push(Math.floor(Math.random() * max) + 1);
        }
        return numbers;
    }

    function generateTarget() {
        let min = 10, max = 100;
        if (gameState.difficulty === 'medium') {
            min = 50;
            max = 200;
        } else if (gameState.difficulty === 'hard') {
            min = 100;
            max = 500;
        } else if (gameState.difficulty === 'expert') {
            min = 200;
            max = 1000;
        }
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function updateDifficulty() {
        if (gameState.gamesPlayed.easy < 5) {
            gameState.difficulty = 'easy';
        } else if (gameState.gamesPlayed.medium < 5) {
            gameState.difficulty = 'medium';
        } else {
            gameState.difficulty = 'hard';
        }
    }

    function renderTiles() {
        elements.tilesContainer.innerHTML = '';
        gameState.numbers.forEach((num, index) => {
            const tile = document.createElement('div');
            tile.className = `scramble-tile ${gameState.usedIndices.includes(index) ? 'used' : ''}`;
            tile.textContent = num;
            tile.dataset.index = index;
            tile.addEventListener('click', () => selectNumber(index));
            elements.tilesContainer.appendChild(tile);
        });
    }

    function renderOperators() {
        elements.operatorsContainer.innerHTML = '';
        const operators = ['+', '-', '*', '/'];
        operators.forEach(op => {
            const btn = document.createElement('button');
            btn.className = 'btn small';
            btn.textContent = op;
            btn.addEventListener('click', () => addOperator(op));
            elements.operatorsContainer.appendChild(btn);
        });
    }

    function renderExpression() {
        elements.expressionEl.innerHTML = gameState.currentExpression ?
            `Current: <span class="expression-value">${gameState.currentExpression}</span>` :
            'Current: <span class="expression-value">Empty</span>';
        elements.expressionEl.className = 'scramble-expression';
    }

    function selectNumber(index) {
        if (!gameState.usedIndices.includes(index)) {
            gameState.currentExpression += gameState.numbers[index];
            gameState.usedIndices.push(index);
            gameState.usedNumbers.push(gameState.numbers[index]);
            renderTiles();
            renderExpression();
            updateFeedback('info', `Current: ${gameState.currentExpression}`);
            playSound('select');
        }
    }

    function addOperator(op) {
        gameState.currentExpression += op;
        renderExpression();
        updateFeedback('info', `Current: ${gameState.currentExpression}`);
        playSound('select');
    }

    function submitSolution() {
        if (!gameState.currentExpression || gameState.currentExpression === gameState.target.toString()) {
            updateFeedback('error', 'Create an expression using the numbers!');
            playSound('error');
            return;
        }

        if (!/[\+\-\*\/]/.test(gameState.currentExpression)) {
            updateFeedback('error', 'Use at least one operator (+, -, *, /)');
            playSound('error');
            return;
        }

        try {
            const result = eval(gameState.currentExpression);
            if (Math.abs(result - gameState.target) < 0.0001) {
                handleCorrectSolution();
            } else {
                handleIncorrectSolution(result);
            }
        } catch (error) {
            console.error('Invalid expression:', error);
            updateFeedback('error', 'Invalid mathematical expression');
            playSound('error');
        }
    }

    function handleCorrectSolution() {
        let points = 10;

        if (gameState.difficulty === 'medium') points *= 1.5;
        if (gameState.difficulty === 'hard') points *= 2;
        if (gameState.difficulty === 'expert') points *= 3;

        points = Math.round(points) || 0;

        gameState.score += points;
        gameState.stats.puzzlesSolved++;
        gameState.stats.totalPoints += points;
        gameState.gamesPlayed[gameState.difficulty]++;
        if (gameState.difficulty === 'hard') {
            gameState.consecutiveHardWins++;
            if (gameState.consecutiveHardWins >= 5) {
                endGame();
                trackEvent('scramble_end', 'number_scramble', 1);
                return;
            }
        } else {
            gameState.consecutiveHardWins = 0;
        }

        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
        addXP(points);
        addCoins(Math.floor(points / 2));
        updateDifficulty();
        updateFeedback('success', `Correct! ${gameState.currentExpression} = ${gameState.target} (+${points} points)`);
        playSound('win');
        showConfetti();
        updateUI();

        setTimeout(() => {
            renderExpression();
            generateNewPuzzle();
        }, 1500);
    }

    function handleIncorrectSolution(result) {
        updateFeedback('error', `Incorrect! ${gameState.currentExpression} = ${result} (Target: ${gameState.target})`);
        if (gameState.difficulty === 'hard') {
            gameState.consecutiveHardWins = 0;
        }
        playSound('error');
    }

    function endGame() {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
        updateFeedback('success', 'Congratulations! You won the game with 5 consecutive hard-level victories!');
        elements.submitBtn.disabled = true;
        elements.clearBtn.disabled = true;
        elements.newBtn.disabled = true;
        elements.hintBtn.disabled = true;
        elements.tilesContainer.innerHTML = '';
        elements.operatorsContainer.innerHTML = '';
        elements.expressionEl.innerHTML = '';
        const victoryScreen = document.createElement('div');
        victoryScreen.className = 'victory-screen';
        victoryScreen.innerHTML = `
            <h2>Victory!</h2>
            <p>Congratulations! You won with 5 consecutive hard-level victories!</p>
            <p>Score: ${gameState.score} | Level: ${gameState.level}</p>
            <div class="countdown">Starting new game in 5...</div>
        `;
        document.body.appendChild(victoryScreen);
        showConfetti({ particleCount: 200, spread: 100 });
        let countdown = 5;
        const countdownElement = victoryScreen.querySelector('.countdown');
        const countdownInterval = setInterval(() => {
            countdown--;
            countdownElement.textContent = `Starting new game in ${countdown}...`;
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                victoryScreen.remove();
                gameState.consecutiveHardWins = 0;
                gameState.score = 0;
                gameState.level = 1;
                gameState.xp = 0;
                gameState.gamesPlayed = { easy: 0, medium: 0, hard: 0 };
                initGame();
            }
        }, 1000);
    }

    function addXP(amount) {
        gameState.xp += amount;
        const xpNeeded = gameState.level * 100;
        if (gameState.xp >= xpNeeded) {
            gameState.level++;
            gameState.xp = gameState.xp - xpNeeded;
            showRewardNotification(`Level Up! Now level ${gameState.level}`, 100);
            showConfetti({ particleCount: 150, spread: 80 });
        }
        updateUI();
    }

    function addCoins(amount) {
        gameState.coins += amount;
        if (amount > 0) {
            showRewardNotification(`+${amount} Coins`, amount);
        }
        updateUI();
    }

    function showRewardNotification(message, amount) {
        const notification = document.createElement('div');
        notification.className = 'reward-notification';
        notification.innerHTML = `
            <div>${message}</div>
            ${amount ? `<div class="reward-amount">+${amount}</div>` : ''}
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    function updateFeedback(type, message) {
        elements.expressionEl.textContent = message;
        elements.expressionEl.className = `scramble-expression feedback-${type}`;
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                renderExpression();
            }, 1500);
        }
    }

    function updateUI() {
        elements.targetEl.innerHTML = `
            Target: <span class="difficulty-${gameState.difficulty}"><b>${gameState.target}</b></span>
            <span class="difficulty-${gameState.difficulty}">(${gameState.difficulty})</span>
        `;
        elements.scoreEl.textContent = `Score: ${gameState.score}`;
        if (elements.levelEl) {
            elements.levelEl.textContent = `Level: ${gameState.level}`;
        }
        if (elements.coinsEl) {
            elements.coinsEl.textContent = `Coins: ${gameState.coins}`;
        }
    }

    function setupEventListeners() {
        elements.submitBtn.addEventListener('click', submitSolution);
        elements.clearBtn.addEventListener('click', clearInput);
        elements.newBtn.addEventListener('click', generateNewPuzzle);
        elements.hintBtn.addEventListener('click', showHint);
        const muteBtn = document.getElementById('mute-btn');
        const muteBtnIcon = document.querySelector('#mute-btn .material-icons');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                gameState.isMuted = !gameState.isMuted;
                localStorage.setItem('triviaMastermuteState', gameState.isMuted);
                if (muteBtnIcon) {
                    muteBtnIcon.textContent = gameState.isMuted ? 'volume_off' : 'volume_up';
                }
                if (gameState.isMuted) {
                    stopAllSounds();
                }
            });
        }
    }

    function showHint() {
        gameState.stats.hintsUsed++;
        if (gameState.numbers.length > 0) {
            updateFeedback('hint', `Try starting with ${gameState.numbers[0]}`);
            playSound('select');
        }
    }

    initGame();
}

document.addEventListener('DOMContentLoaded', () => {
    initPuzzle();
});