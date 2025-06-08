/* global gtag, confetti */

export function initPuzzle() {
    const gameState = {
        level: 1,
        score: 0,
        timeLeft: 180,
        currentNumbers: [],
        gameActive: false,
        currentRule: '',
        targetHeight: 5,
        currentHeight: 0,
        lastNumber: null,
        isMuted: JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false,
        timerInterval: null,
        difficulty: 'medium' // Added difficulty state
    };

    const audioElements = {
        select: new Audio('/audio/click.mp3'),
        correct: new Audio('/audio/correct.mp3'),
        win: new Audio('/audio/win.mp3'),
        error: new Audio('/audio/wrong.mp3')
    };

    const elements = {
        towerGrid: document.getElementById('tower-grid'),
        towerStack: document.getElementById('tower-stack'),
        towerFeedback: document.getElementById('tower-feedback'),
        towerHint: document.getElementById('tower-hint'),
        towerClear: document.getElementById('tower-clear'),
        towerNew: document.getElementById('tower-new'),
        towerLevel: document.getElementById('tower-level'),
        towerScore: document.getElementById('tower-score'),
        towerTime: document.getElementById('tower-time'),
        towerHeight: document.getElementById('tower-height'),
        towerTarget: document.getElementById('tower-target'),
        towerObjective: document.getElementById('tower-objective'),
        progressFill: document.getElementById('progress-fill'),
        towerDifficulty: document.getElementById('tower-difficulty') // Added difficulty element
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

    function initGame() {
        clearInterval(gameState.timerInterval);
        gameState.level = 1;
        gameState.score = 0;
        gameState.timeLeft = 180;
        gameState.currentHeight = 0;
        gameState.isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;
        gameState.difficulty = localStorage.getItem('towerDifficulty') || 'medium'; // Load difficulty
        setDifficulty(gameState.difficulty);
        updateStats();
        generateRule();
        generateGrid();
        startTimer();
        gameState.gameActive = true;
        trackEvent('numbertower_started', 'number_tower', 1);
        if (gameState.isMuted) {
            stopAllSounds();
        }
        const muteBtnIcon = document.querySelector('#mute-btn .material-icons');
        if (muteBtnIcon) {
            muteBtnIcon.textContent = gameState.isMuted ? 'volume_off' : 'volume_up';
        }
        playSound('select');
    }

    function setDifficulty(difficulty) {
        gameState.difficulty = difficulty;
        localStorage.setItem('towerDifficulty', difficulty);
        switch(difficulty) {
            case 'easy':
                gameState.targetHeight = 3;
                break;
            case 'medium':
                gameState.targetHeight = 5;
                break;
            case 'hard':
                gameState.targetHeight = 8;
                break;
        }
        elements.towerTarget.textContent = gameState.targetHeight;
        updateStats();
    }

    function generateRule() {
        const rules = [
            { 
                name: "multiples",
                text: "Build the tower by selecting multiples of X!", 
                fn: (n, x) => n % x === 0,
                minX: 2,
                xGenerator: (level) => Math.max(2, Math.floor(level / 2) + 1),
                numberGenerator: (x, range) => {
                    const multiples = [];
                    for (let i = x; i <= range; i += x) {
                        multiples.push(i);
                    }
                    return { numbers: multiples, x };
                }
            },
            { 
                name: "factors",
                text: "Build the tower by selecting factors of X!", 
                fn: (n, x) => x % n === 0,
                minX: 4,
                xGenerator: (level) => {
                    const goodNumbers = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20];
                    return goodNumbers[Math.floor(Math.random() * goodNumbers.length)];
                },
                numberGenerator: (x, range) => {
                    const factors = [];
                    for (let i = 1; i <= x; i++) {
                        if (x % i === 0) factors.push(i);
                    }
                    return { numbers: factors, x };
                }
            },
            { 
                name: "greater",
                text: "Build the tower by selecting numbers greater than X!", 
                fn: (n, x) => n > x,
                minX: 1,
                xGenerator: (level, range) => Math.max(1, Math.floor(range * 0.3)),
                numberGenerator: (x, range) => {
                    return { numbers: Array.from({length: range - x}, (_, i) => x + 1 + i), x }; 
                }    
            },
            { 
                name: "less",
                text: "Build the tower by selecting numbers less than X!", 
                fn: (n, x) => n < x,
                minX: 4,
                xGenerator: (level, range) => Math.min(
                    range - 2,
                    Math.max(4, Math.floor(range * 0.7))
                ),
                numberGenerator: (x, range) => {
                    return { numbers: Array.from({length: x - 1}, (_, i) => i + 1), x };
                }    
            },
            { 
                name: "additive",
                text: "Build the tower by selecting numbers that are X more than the last!", 
                fn: (n, x, last) => last ? n === last + x : true,
                xGenerator: (level) => Math.max(1, Math.floor(level / 3) + 1),
                numberGenerator: (x, range) => {
                    return { numbers: Array.from({length: range}, (_, i) => i + 1), x };
                }
            },
            { 
                name: "multiplicative",
                text: "Build the tower by selecting numbers that are X times the last!", 
                fn: (n, x, last) => last ? n === last * x : true,
                xGenerator: (level) => Math.max(2, Math.floor(level / 3) + 2),
                numberGenerator: (x, range) => {
                    return { numbers: Array.from({length: range}, (_, i) => i + 1), x };
                }
            }
        ];
        
        const range = getNumberRange();
        let rule;
        let generated;
        
        for (let i = 0; i < 3; i++) {
            rule = rules[Math.floor(Math.random() * rules.length)];
            const x = rule.xGenerator(gameState.level, range);
            generated = rule.numberGenerator(x, range);
            if (generated.numbers.length >= gameState.targetHeight) break;
        }
        
        if (generated.numbers.length < gameState.targetHeight) {
            rule = rules.find(r => r.name === "multiples");
            const x = rule.xGenerator(gameState.level);
            generated = rule.numberGenerator(x, range);
        }
        
        gameState.currentRule = {
            text: rule.text.replace('X', generated.x),
            fn: (n, last) => rule.fn(n, generated.x, last),
            xValue: generated.x,
            numbers: generated.numbers
        };
        
        elements.towerTarget.textContent = gameState.targetHeight;
        elements.towerHeight.textContent = gameState.currentHeight;
        elements.towerObjective.textContent = gameState.currentRule.text;
    }

    function generateGrid() {
        elements.towerGrid.innerHTML = '';
        elements.towerStack.innerHTML = '';
        gameState.currentNumbers = [];
        gameState.lastNumber = null;
        
        const gridSize = getGridSize();
        const totalCells = gridSize * gridSize;
        const range = getNumberRange();
        let numberPool = [];
        
        // Generate a guaranteed valid sequence based on the current rule
        let validSequence = [];
        const rule = gameState.currentRule;
        const x = rule.xValue;

        if (rule.text.includes("multiples of")) {
            let current = x;
            while (current <= range && validSequence.length < gameState.targetHeight) {
                validSequence.push(current);
                current += x;
            }
            if (validSequence.length < gameState.targetHeight) {
                validSequence = [];
                current = x;
                while (current <= range && validSequence.length < gameState.targetHeight) {
                    validSequence.push(current);
                    current += x;
                }
            }
        } else if (rule.text.includes("factors of")) {
            for (let i = 1; i <= x; i++) {
                if (x % i === 0 && validSequence.length < gameState.targetHeight) {
                    validSequence.push(i);
                }
            }
            while (validSequence.length < gameState.targetHeight && validSequence.length > 0) {
                validSequence.push(validSequence[validSequence.length - 1] * 2);
            }
        } else if (rule.text.includes("greater than")) {
            let current = x + 1;
            while (current <= range && validSequence.length < gameState.targetHeight) {
                validSequence.push(current);
                current++;
            }
        } else if (rule.text.includes("less than")) {
            let current = 1;
            while (current < x && validSequence.length < gameState.targetHeight) {
                validSequence.push(current);
                current++;
            }
        } else if (rule.text.includes("more than the last")) {
            let current = 1;
            while (current <= range && validSequence.length < gameState.targetHeight) {
                validSequence.push(current);
                current += x;
            }
            if (validSequence.length < gameState.targetHeight) {
                validSequence = [];
                current = 1;
                while (current <= range && validSequence.length < gameState.targetHeight) {
                    validSequence.push(current);
                    current += x;
                }
            }
        } else if (rule.text.includes("times the last")) {
            let current = range;
            validSequence = [];
            while (current >= 1 && validSequence.length < gameState.targetHeight) {
                if (current % x === 0 || validSequence.length === 0) {
                    validSequence.unshift(current);
                    current = current / x;
                } else {
                    current--;
                }
            }
            validSequence.reverse();
            if (validSequence.length < gameState.targetHeight) {
                current = 1;
                validSequence = [current];
                while (current <= range && validSequence.length < gameState.targetHeight) {
                    current *= x;
                    if (current <= range) validSequence.push(current);
                }
            }
        }

        numberPool = [...validSequence];
        
        // Add other valid numbers that fit the rule to ensure enough options
        const validNumbersNeeded = Math.max(gameState.targetHeight + 2, Math.ceil(totalCells * 0.4));
        while (numberPool.length < validNumbersNeeded) {
            const potentialNumbers = gameState.currentRule.numbers.filter(n => 
                !numberPool.includes(n) && 
                (gameState.currentHeight === 0 || gameState.currentRule.fn(n, gameState.lastNumber))
            );
            if (potentialNumbers.length > 0) {
                numberPool.push(potentialNumbers[Math.floor(Math.random() * potentialNumbers.length)]);
            } else {
                break;
            }
        }
        
        // Fill remaining cells with random numbers within range
        while (numberPool.length < totalCells) {
            const randomNum = Math.floor(Math.random() * range) + 1;
            numberPool.push(randomNum);
        }
        
        numberPool = shuffleArray(numberPool);
        
        // Create the grid cells
        for (let i = 0; i < totalCells; i++) {
            const num = numberPool[i];
            gameState.currentNumbers.push(num);
            
            const cell = document.createElement('div');
            cell.className = 'tower-cell';
            cell.textContent = num;
            cell.dataset.number = num;
            cell.addEventListener('click', () => handleCellClick(cell));
            elements.towerGrid.appendChild(cell);
        }
        
        elements.towerGrid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    }

    function shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    function getGridSize() {
        if (gameState.level <= 3) return 6;
        if (gameState.level <= 6) return 8;
        return 10;
    }

    function getNumberRange() {
        if (gameState.level <= 2) return 20;
        if (gameState.level <= 4) return 100;
        if (gameState.level <= 6) return 500;
        return 1000;
    }

    function handleCellClick(cell) {
        if (!gameState.gameActive) return;
        
        const number = parseInt(cell.dataset.number);
        playSound('select');
        
        if (cell.classList.contains('selected')) {
            return;
        }
        
        const isValid = gameState.currentRule.fn(number, gameState.lastNumber);
        cell.classList.add('selected');
        
        if (isValid) {
            cell.classList.add('correct');
            addToTower(number);
            gameState.score += gameState.level * 2;
            updateStats();
            updateProgress();
            playSound('correct');
            
            if (gameState.currentHeight >= gameState.targetHeight) {
                levelUp();
            }
        } else {
            cell.classList.add('wrong');
            gameState.timeLeft = Math.max(5, gameState.timeLeft - 3);
            updateStats();
            playSound('error');
        }
    }

    function addToTower(number) {
        gameState.lastNumber = number;
        gameState.currentHeight++;
        elements.towerHeight.textContent = gameState.currentHeight;
        
        const block = document.createElement('div');
        block.className = 'tower-block';
        block.textContent = number;
        elements.towerStack.appendChild(block);
        
        elements.towerStack.style.transform = `translateY(${-10 * gameState.currentHeight}px)`;
        elements.towerStack.style.transition = 'transform 0.3s';
    }

    function levelUp() {
        gameState.gameActive = false;
        clearInterval(gameState.timerInterval);
        
        elements.towerFeedback.textContent = `Level Complete! +${gameState.level * 15} bonus points!`;
        elements.towerFeedback.className = 'tower-feedback correct';
        
        gameState.score += gameState.level * 15;
        gameState.level++;
        updateStats();
        playSound('win');
        showConfetti({ particleCount: 250, spread: 80 });
        
        setTimeout(() => {
            gameState.timeLeft = 180;
            gameState.currentHeight = 0;
            gameState.gameActive = true;
            generateRule();
            generateGrid();
            startTimer();
        }, 2000);
    }

    function startTimer() {
        console.log('Starting timer');
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = setInterval(() => {
            console.log(`Timer tick: ${gameState.timeLeft}`);
            gameState.timeLeft--;
            updateStats();
            
            if (gameState.timeLeft <= 10) {
                elements.towerTime.classList.add('time-critical');
            }
            
            if (gameState.timeLeft <= 0) {
                console.log('Timer expired');
                clearInterval(gameState.timerInterval);
                gameState.timerInterval = null;
                gameOver();
            }
        }, 1000);
    }

    function gameOver() {
        gameState.gameActive = false;
        elements.towerFeedback.textContent = `Game Over! Final Score: ${gameState.score}`;
        elements.towerFeedback.className = 'tower-feedback wrong';
        playSound('error');
    }

    function showHint() {
        if (!gameState.gameActive) return;
        playSound('select');
        
        const validNumbers = Array.from(document.querySelectorAll('.tower-cell'))
            .filter(cell => !cell.classList.contains('selected') && 
                            gameState.currentRule.fn(parseInt(cell.dataset.number), gameState.lastNumber));
        
        if (validNumbers.length > 0) {
            const randomValid = validNumbers[Math.floor(Math.random() * validNumbers.length)];
            randomValid.classList.add('hint');
            setTimeout(() => {
                randomValid.classList.remove('hint');
            }, 1000);
        } else {
            elements.towerFeedback.textContent = "No valid moves left!";
            elements.towerFeedback.className = 'tower-feedback info';
        }
    }

    function updateStats() {
        elements.towerLevel.textContent = `Level: ${gameState.level}`;
        elements.towerScore.textContent = `Score: ${gameState.score}`;
        elements.towerTime.textContent = `Time: ${gameState.timeLeft}s`;
        if (elements.towerDifficulty) {
            elements.towerDifficulty.textContent = `Difficulty: ${gameState.difficulty.charAt(0).toUpperCase() + gameState.difficulty.slice(1)}`;
        }
    }

    function updateProgress() {
        const percentage = (gameState.currentHeight / gameState.targetHeight) * 100;
        elements.progressFill.style.width = `${percentage}%`;
    }

    function clearLastNumber() {
        if (!gameState.gameActive || gameState.currentHeight === 0) return;
        playSound('select');

        const lastBlock = elements.towerStack.lastElementChild;
        if (lastBlock) {
            elements.towerStack.removeChild(lastBlock);
        }

        gameState.currentHeight--;
        elements.towerHeight.textContent = gameState.currentHeight;

        // Modified to clear both correct and wrong selections
        const lastSelectedCell = Array.from(document.querySelectorAll('.tower-cell.selected')).pop();
        if (lastSelectedCell) {
            lastSelectedCell.classList.remove('selected', 'correct', 'wrong');
        }

        if (gameState.currentHeight === 0) {
            gameState.lastNumber = null;
        } else {
            const prevBlock = elements.towerStack.lastElementChild;
            gameState.lastNumber = prevBlock ? parseInt(prevBlock.textContent) : null;
        }

        elements.towerStack.style.transform = `translateY(${-10 * gameState.currentHeight}px)`;
        updateProgress();
    }

    function setupEventListeners() {
        elements.towerHint.addEventListener('click', showHint);
        elements.towerNew.addEventListener('click', initGame);
        elements.towerClear.addEventListener('click', clearLastNumber);
        const muteBtn = document.getElementById('mute-btn');
        const muteBtnIcon = document.querySelector('#mute-btn .material-icons');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                gameState.isMuted = !gameState.isMuted;
                localStorage.setItem('triviaMasterMuteState', gameState.isMuted);
                if (muteBtnIcon) {
                    muteBtnIcon.textContent = gameState.isMuted ? 'volume_off' : 'volume_up';
                }
                if (gameState.isMuted) {
                    stopAllSounds();
                }
                playSound('select');
            });
        }
        // Add difficulty selection listeners
        ['easy', 'medium', 'hard'].forEach(diff => {
            const btn = document.getElementById(`difficulty-${diff}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    setDifficulty(diff);
                    initGame();
                    playSound('select');
                });
            }
        });
    }

    initGame();
    setupEventListeners();
}