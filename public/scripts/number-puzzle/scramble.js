export function initPuzzle() {
    console.log('Initializing Enhanced Number Scramble game');
    
    // Enhanced Game State
    const gameState = {
        numbers: [],
        target: 0,
        score: 0,
        currentExpression: '',
        usedNumbers: [],
        usedIndices: [],
        streak: 0,
        bestStreak: 0,
        level: 1,
        xp: 0,
        coins: 0,
        difficulty: 'easy',
        gamesPlayed: { easy: 0, medium: 0, hard: 0 },
        consecutiveHardWins: 0,
        unlockedFeatures: ['basic'],
        challengeMode: null,
        stats: {
            puzzlesSolved: 0,
            totalPoints: 0,
            hintsUsed: 0,
            perfectSolutions: 0
        }
    };
    
    // DOM elements
    const elements = {
        tilesContainer: document.getElementById('scramble-tiles'),
        operatorsContainer: document.getElementById('scramble-operators'),
        submitBtn: document.getElementById('scramble-submit'),
        clearBtn: document.getElementById('scramble-clear'),
        newBtn: document.getElementById('scramble-new'),
        hintBtn: document.getElementById('scramble-hint'),
        feedbackEl: document.getElementById('scramble-feedback'),
        targetEl: document.getElementById('scramble-target'),
        scoreEl: document.getElementById('scramble-score'),
        levelEl: document.getElementById('scramble-level'),
        streakEl: document.getElementById('scramble-streak'),
        progressEl: document.getElementById('scramble-progress'),
        xpBar: document.getElementById('scramble-xp-bar'),
        coinsEl: document.getElementById('scramble-coins')
    };

    // Clear current input
    function clearInput() {
        gameState.currentExpression = '';
        gameState.usedNumbers = [];
        renderTiles();
        updateFeedback('info', 'Cleared');
    }

    // Initialize the game
    function initGame() {
        setupEventListeners();
        generateNewPuzzle();
        updateUI();
    }
    
    // Generate new puzzle with progressive difficulty
    function generateNewPuzzle() {
        // Clear previous state
        gameState.currentExpression = '';
        gameState.usedNumbers = [];
        
        // Generate new puzzle
        gameState.numbers = generateNumbers();
        gameState.target = generateTarget();
        
        // Update UI
        renderTiles();
        renderOperators();
        updateUI();
        
        // Flash the new target
        flashTarget();
    }

    function flashTarget() {
        const targetEl = elements.targetEl;
        targetEl.style.transition = 'all 0.3s';
        
        // Flash animation
        targetEl.style.transform = 'scale(1.2)';
        targetEl.style.color = '#ffd700';
        
        setTimeout(() => {
            targetEl.style.transform = 'scale(1)';
            targetEl.style.color = '';
        }, 500);
    }
    
    // Generate numbers based on difficulty
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
    
    // Generate target based on difficulty
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
    
    // Update difficulty based on games played
    function updateDifficulty() {
        if (gameState.gamesPlayed.easy < 5) {
            gameState.difficulty = 'easy';
        } else if (gameState.gamesPlayed.medium < 5) {
            gameState.difficulty = 'medium';
        } else {
            gameState.difficulty = 'hard';
        }
    }
    
    // Render number tiles
    function renderTiles() {
        elements.tilesContainer.innerHTML = '';
        gameState.numbers.forEach((num, index) => {
            const tile = document.createElement('div');
            tile.className = `scramble-tile ${gameState.usedNumbers.includes(index) ? 'used' : ''}`;
            tile.textContent = num;
            tile.dataset.index = index;
            tile.addEventListener('click', () => selectNumber(index));
            elements.tilesContainer.appendChild(tile);
        });
    }
    
    // Render operator buttons
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
    
    // Select number
    function selectNumber(index) {
        gameState.currentExpression += gameState.numbers[index];
        renderTiles();
        updateFeedback('info', `Current: ${gameState.currentExpression}`);
    }
    
    // Add operator
    function addOperator(op) {
        gameState.currentExpression += op;
        gameState.usedNumbers = [];
        renderTiles();
        updateFeedback('info', `Current: ${gameState.currentExpression}`);
    }
    
    // Submit solution
    function submitSolution() {
        if (!gameState.currentExpression || gameState.currentExpression === gameState.target.toString()) {
            updateFeedback('error', 'Create an expression using the numbers!');
            return;
        }
    
        if (!/[\+\-\*\/]/.test(gameState.currentExpression)) {
            updateFeedback('error', 'Use at least one operator (+, -, *, /)');
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
            updateFeedback('error', 'Invalid mathematical expression');
        }
    }
    
    // Handle correct solution
    function handleCorrectSolution() {
        let points = 10;
        
        gameState.streak++;
        if (gameState.streak > gameState.bestStreak) {
            gameState.bestStreak = gameState.streak;
        }
        
        if (gameState.difficulty === 'medium') points *= 1.5;
        if (gameState.difficulty === 'hard') points *= 2;
        if (gameState.difficulty === 'expert') points *= 3;
        
        if (gameState.streak >= 5) points *= 1.5;
        if (gameState.streak >= 10) points *= 2;
        
        points = Math.round(points) || 0;
        
        gameState.score += points;
        gameState.stats.puzzlesSolved++;
        gameState.stats.totalPoints += points;
        gameState.gamesPlayed[gameState.difficulty]++;
        
        if (gameState.difficulty === 'hard') {
            gameState.consecutiveHardWins++;
            if (gameState.consecutiveHardWins >= 5) {
                endGame();
                return;
            }
        } else {
            gameState.consecutiveHardWins = 0;
        }
        
        addXP(points);
        addCoins(Math.floor(points / 2));
        
        updateDifficulty();
        updateFeedback('success', `Correct! ${gameState.currentExpression} = ${gameState.target} (+${points} points)`);
        updateUI();
        
        setTimeout(() => {
            elements.feedbackEl.textContent = '';
            elements.feedbackEl.className = 'scramble-feedback';
            generateNewPuzzle();
        }, 1500);
    }
    
    // Handle incorrect solution
    function handleIncorrectSolution(result) {
        updateFeedback('error', `Incorrect! ${gameState.currentExpression} = ${result} (Target: ${gameState.target})`);
        resetStreak();
        if (gameState.difficulty === 'hard') {
            gameState.consecutiveHardWins = 0;
        }
    }
    
    // Reset streak
    function resetStreak() {
        gameState.streak = 0;
        updateUI();
    }
    
    // End game after 5 consecutive hard wins
    function endGame() {
        updateFeedback('success', 'Congratulations! You won the game with 5 consecutive hard-level victories!');
        elements.submitBtn.disabled = true;
        elements.clearBtn.disabled = true;
        elements.newBtn.disabled = true;
        elements.hintBtn.disabled = true;
        elements.tilesContainer.innerHTML = '';
        elements.operatorsContainer.innerHTML = '';
        if (elements.progressEl) {
            elements.progressEl.textContent = '';
        }
    }
    
    // Add XP and check for level up
    function addXP(amount) {
        gameState.xp += amount;
        const xpNeeded = gameState.level * 100;
        
        if (gameState.xp >= xpNeeded) {
            gameState.level++;
            gameState.xp = gameState.xp - xpNeeded;
            showRewardNotification(`Level Up! Now level ${gameState.level}`, 100);
        }
        
        updateUI();
    }
    
    // Add coins
    function addCoins(amount) {
        gameState.coins += amount;
        if (amount > 0) {
            showRewardNotification(`+${amount} Coins`, amount);
        }
        updateUI();
    }
    
    // Show reward notification
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
    
    // Update feedback display
    function updateFeedback(type, message) {
        elements.feedbackEl.textContent = message;
        elements.feedbackEl.className = `scramble-feedback ${type}`;
    }
    
    // Update all UI elements
    function updateUI() {
        elements.targetEl.innerHTML = `
            Target: <span class="difficulty-${gameState.difficulty}"><b>${gameState.target}</b></span>
            <span class="difficulty-${gameState.difficulty}">(${gameState.difficulty})</span>
        `;
        elements.scoreEl.textContent = `Score: ${gameState.score}`;
        
        if (elements.streakEl) {
            elements.streakEl.innerHTML = gameState.streak > 0 ? 
                `Streak: ${gameState.streak} <span class="streak-fire">🔥</span>` : 
                '';
        }
        
        if (elements.levelEl) {
            elements.levelEl.textContent = `Level: ${gameState.level}`;
        }
        
        if (elements.xpBar) {
            const xpNeeded = gameState.level * 100;
            const percentage = (gameState.xp / xpNeeded) * 100;
            elements.xpBar.style.width = `${percentage}%`;
        }
        
        if (elements.coinsEl) {
            elements.coinsEl.textContent = `Coins: ${gameState.coins}`;
        }
        
        if (elements.progressEl) {
            if (gameState.difficulty === 'easy') {
                const remaining = 5 - gameState.gamesPlayed.easy;
                elements.progressEl.textContent = `${remaining} more game${remaining === 1 ? '' : 's'} to Medium`;
            } else if (gameState.difficulty === 'medium') {
                const remaining = 5 - gameState.gamesPlayed.medium;
                elements.progressEl.textContent = `${remaining} more game${remaining === 1 ? '' : 's'} to Hard`;
            } else if (gameState.difficulty === 'hard') {
                const remaining = 5 - gameState.consecutiveHardWins;
                elements.progressEl.textContent = `${remaining} more consecutive win${remaining === 1 ? '' : 's'} to win the game`;
            }
        }
    }
    
    // Setup event listeners
    function setupEventListeners() {
        elements.submitBtn.addEventListener('click', submitSolution);
        elements.clearBtn.addEventListener('click', clearInput);
        elements.newBtn.addEventListener('click', generateNewPuzzle);
        elements.hintBtn.addEventListener('click', showHint);
    }

    // Show hint
    function showHint() {
        gameState.stats.hintsUsed++;
        
        if (gameState.numbers.length > 0) {
            updateFeedback('hint', `Try starting with ${gameState.numbers[0]}`);
        }
    }
    
    // Start the game
    initGame();
}