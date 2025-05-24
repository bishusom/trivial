export function initPuzzle() {
    const towerGrid = document.getElementById('tower-grid');
    const towerStack = document.getElementById('tower-stack');
    const towerFeedback = document.getElementById('tower-feedback');
    const towerHint = document.getElementById('tower-hint');
    const towerClear = document.getElementById('tower-clear');
    const towerNew = document.getElementById('tower-new');
    const towerLevel = document.getElementById('tower-level');
    const towerScore = document.getElementById('tower-score');
    const towerTime = document.getElementById('tower-time');
    const towerHeight = document.getElementById('tower-height');
    const towerTarget = document.getElementById('tower-target');
    const towerObjective = document.getElementById('tower-objective');
    const progressFill = document.getElementById('progress-fill');

    let level = 1;
    let score = 0;
    let timeLeft = 60;
    let timer;
    let currentNumbers = [];
    let gameActive = false;
    let currentRule = '';
    let targetHeight = 5;
    let currentHeight = 0;
    let lastNumber = null;

    // Initialize the game
    initGame();
    
    function initGame() {
        clearInterval(timer);
        level = 1;
        score = 0;
        timeLeft = 60;
        currentHeight = 0;
        updateStats();
        generateRule();
        generateGrid();
        startTimer();
        gameActive = true;
        trackEvent('numbertower_started', 'number_tower',1);
    }
    
    function trackEvent(action, category, label, value) {
        if (typeof gtag !== 'undefined') {
            gtag('event', action, { event_category: category, event_label: label, value: value });
        }
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
                // Numbers with at least 4 factors
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
        
        // Try generating a valid rule up to 3 times
        for (let i = 0; i < 3; i++) {
            rule = rules[Math.floor(Math.random() * rules.length)];
            const x = rule.xGenerator(level, range);
            
            generated = rule.numberGenerator(x, range);
            // Ensure we have enough valid numbers
            if (generated.numbers.length >= 4) break;
        }
        
        // Fallback to multiples if no valid rule found
        if (generated.numbers.length < 4) {
            rule = rules.find(r => r.name === "multiples");
            const x = rule.Generator(level);
            generated = rule.numberGenerator(x, range);
        }
        
        currentRule = {
            text: rule.text.replace('X', generated.x),
            fn: (n, last) => rule.fn(n, generated.x, last),
            xValue: generated.x,
            numbers: generated.numbers
        };
        
        targetHeight = Math.min(4 + level, 10); // Cap target height
        towerTarget.textContent = targetHeight;
        towerHeight.textContent = currentHeight;
        towerObjective.textContent = currentRule.text;
    }
    
    function generateGrid() {
        towerGrid.innerHTML = '';
        towerStack.innerHTML = '';
        currentNumbers = [];
        lastNumber = null;
        
        const gridSize = getGridSize();
        const totalCells = gridSize * gridSize;
        
        // Generate pool with guaranteed valid numbers
        let numberPool = [];
        
        // Add valid numbers (at least 40% of grid)
        const validNeeded = Math.max(4, Math.ceil(totalCells * 0.4));
        const validToAdd = Math.min(validNeeded, currentRule.numbers.length);
        
        // Add valid numbers multiple times if needed
        while (numberPool.length < validToAdd) {
            numberPool = numberPool.concat(
                shuffleArray([...currentRule.numbers]).slice(0, validToAdd - numberPool.length)
            );
        }
        
        // Fill remaining with random numbers (some may still be valid)
        const randomNeeded = totalCells - numberPool.length;
        for (let i = 0; i < randomNeeded; i++) {
            numberPool.push(Math.floor(Math.random() * getNumberRange()) + 1);
        }
        
        // Shuffle final pool
        numberPool = shuffleArray(numberPool);
        
        // Create grid cells
        for (let i = 0; i < totalCells; i++) {
            const num = numberPool[i];
            currentNumbers.push(num);
            
            const cell = document.createElement('div');
            cell.className = 'tower-cell';
            cell.textContent = num;
            cell.dataset.number = num;
            
            cell.addEventListener('click', () => handleCellClick(cell));
            towerGrid.appendChild(cell);
        }
        
        towerGrid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
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
        // Increase grid size with level
        if (level <= 3) return 4;
        if (level <= 6) return 5;
        return 6;
    }
    
    function getNumberRange() {
        // Increase number range with level
        if (level <= 2) return 20;
        if (level <= 4) return 30;
        if (level <= 6) return 50;
        return 75;
    }
    
    function handleCellClick(cell) {
        if (!gameActive) return;
        
        const number = parseInt(cell.dataset.number);
        
        if (cell.classList.contains('selected')) {
            return; // Already selected
        }
        
        // Check if number follows the current rule
        const isValid = currentRule.fn(number, lastNumber);
        
        cell.classList.add('selected');
        
        if (isValid) {
            cell.classList.add('correct');
            addToTower(number);
            score += level * 2;
            updateStats();
            updateProgress();
            
            if (currentHeight >= targetHeight) {
                levelUp();
            }
        } else {
            cell.classList.add('wrong');
            timeLeft = Math.max(5, timeLeft - 3); // Penalty for wrong selection
            updateStats();
        }
    }
    
    function addToTower(number) {
        lastNumber = number;
        currentHeight++;
        towerHeight.textContent = currentHeight;
        
        const block = document.createElement('div');
        block.className = 'tower-block';
        block.textContent = number;
        towerStack.appendChild(block);
        
        // Animate the tower growth
        towerStack.style.transform = `translateY(${-10 * currentHeight}px)`;
        towerStack.style.transition = 'transform 0.3s';
    }
    
    function levelUp() {
        gameActive = false;
        clearInterval(timer);
        
        towerFeedback.textContent = `Level Complete! +${level * 15} bonus points!`;
        towerFeedback.className = 'tower-feedback correct';
        
        score += level * 15;
        level++;
        updateStats();
        
        setTimeout(() => {
            timeLeft = 60;
            currentHeight = 0;
            gameActive = true;
            generateRule();
            generateGrid();
            startTimer();
        }, 2000);
    }
    
    function startTimer() {
        clearInterval(timer);
        timer = setInterval(() => {
            timeLeft--;
            towerTime.textContent = `Time: ${timeLeft}s`;
            
            if (timeLeft <= 10) {
                towerTime.classList.add('time-critical');
            }
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                gameOver();
            }
        }, 1000);
    }
    
    function gameOver() {
        gameActive = false;
        towerFeedback.textContent = `Game Over! Final Score: ${score}`;
        towerFeedback.className = 'tower-feedback wrong';
    }
    
    function showHint() {
        if (!gameActive) return;
        
        // Find valid numbers that follow the current rule
        const validNumbers = Array.from(document.querySelectorAll('.tower-cell'))
            .filter(cell => !cell.classList.contains('selected') && 
                            currentRule.fn(parseInt(cell.dataset.number), lastNumber));
        
        if (validNumbers.length > 0) {
            const randomValid = validNumbers[Math.floor(Math.random() * validNumbers.length)];
            randomValid.classList.add('hint');
            
            setTimeout(() => {
                randomValid.classList.remove('hint');
            }, 1000);
        } else {
            towerFeedback.textContent = "No valid moves left!";
            towerFeedback.className = 'tower-feedback info';
        }
    }
    
    function updateStats() {
        towerLevel.textContent = `Level: ${level}`;
        towerScore.textContent = `Score: ${score}`;
        towerTime.textContent = `Time: ${timeLeft}s`;
    }
    
    function updateProgress() {
        const percentage = (currentHeight / targetHeight) * 100;
        progressFill.style.width = `${percentage}%`;
    }

    function clearLastNumber() {
        if (!gameActive || currentHeight === 0) return;

        // Remove the last block from the tower visually
        const lastBlock = towerStack.lastElementChild;
        if (lastBlock) {
            towerStack.removeChild(lastBlock);
        }

        // Update game state
        currentHeight--;
        towerHeight.textContent = currentHeight;

        // Reset the last selected number (if any)
        const lastSelectedCell = document.querySelector('.tower-cell.selected:last-child');
        if (lastSelectedCell) {
            lastSelectedCell.classList.remove('selected', 'correct', 'wrong');
        }

        // Update lastNumber (needed for sequential rules like "X more than last")
        if (currentHeight === 0) {
            lastNumber = null;
        } else {
            const prevBlock = towerStack.lastElementChild;
            lastNumber = prevBlock ? parseInt(prevBlock.textContent) : null;
        }

        // Reset tower animation
        towerStack.style.transform = `translateY(${-10 * currentHeight}px)`;
    }
        
    // Event listeners
    towerHint.addEventListener('click', showHint);
    towerNew.addEventListener('click', initGame);
    towerClear.addEventListener('click', clearLastNumber);
}