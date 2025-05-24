export function initPuzzle() {
    const hunterGrid = document.getElementById('hunter-grid');
    const hunterFeedback = document.getElementById('hunter-feedback');
    const hunterHint = document.getElementById('hunter-hint');
    const hunterNew = document.getElementById('hunter-new');
    const hunterLevel = document.getElementById('hunter-level');
    const hunterScore = document.getElementById('hunter-score');
    const hunterTime = document.getElementById('hunter-time');
    const primesFound = document.getElementById('primes-found');
    const primesTotal = document.getElementById('primes-total');
    const progressFill = document.getElementById('progress-fill');

    let level = 1;
    let score = 0;
    let timeLeft = 60;
    let timer;
    let primesInGrid = 0;
    let primesCollected = 0;
    let currentNumbers = [];
    let gameActive = false;

    // Initialize the game
    initGame();
    
    function initGame() {
        clearInterval(timer);
        level = 1;
        score = 0;
        timeLeft = 60;
        primesCollected = 0;
        updateStats();
        generateGrid();
        startTimer();
        gameActive = true;
        trackEvent('primehunter_started', 'primehunter',1);
    }

    function trackEvent(action, category, label, value) {
        if (typeof gtag !== 'undefined') {
            gtag('event', action, { event_category: category, event_label: label, value: value });
        }
    }
    
    function generateGrid() {
        hunterGrid.innerHTML = '';
        currentNumbers = [];
        primesInGrid = 0;
        
        const gridSize = getGridSize();
        const numberRange = getNumberRange();
        
        // Generate numbers for the grid
        for (let i = 0; i < gridSize * gridSize; i++) {
            const num = Math.floor(Math.random() * numberRange) + 1;
            currentNumbers.push(num);
            
            const cell = document.createElement('div');
            cell.className = 'hunter-cell';
            cell.textContent = num;
            cell.dataset.number = num;
            cell.dataset.isPrime = isPrime(num);
            
            if (cell.dataset.isPrime === 'true') {
                primesInGrid++;
            }
            
            cell.addEventListener('click', () => handleCellClick(cell));
            hunterGrid.appendChild(cell);
        }
        
        primesTotal.textContent = primesInGrid;
        primesFound.textContent = primesCollected;
        updateProgress();
        
        // Set grid columns
        hunterGrid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    }
    
    function getGridSize() {
        // Increase grid size with level
        if (level <= 3) return 4;
        if (level <= 6) return 5;
        return 6;
    }
    
    function getNumberRange() {
        // Increase number range with level
        if (level <= 2) return 30;
        if (level <= 4) return 50;
        if (level <= 6) return 75;
        return 100;
    }
    
    function isPrime(num) {
        if (num <= 1) return false;
        if (num <= 3) return true;
        
        if (num % 2 === 0 || num % 3 === 0) return false;
        
        for (let i = 5; i * i <= num; i += 6) {
            if (num % i === 0 || num % (i + 2) === 0) return false;
        }
        
        return true;
    }
    
    function handleCellClick(cell) {
        if (!gameActive) return;
        
        const number = parseInt(cell.dataset.number);
        const isPrime = cell.dataset.isPrime === 'true';
        
        if (cell.classList.contains('selected')) {
            return; // Already selected
        }
        
        cell.classList.add('selected');
        
        if (isPrime) {
            cell.classList.add('correct');
            primesCollected++;
            score += level * 5;
            updateStats();
            updateProgress();
            
            if (primesCollected === primesInGrid) {
                levelUp();
            }
        } else {
            cell.classList.add('wrong');
            timeLeft = Math.max(5, timeLeft - 5); // Penalty for wrong selection
            updateStats();
        }
    }
    
    function levelUp() {
        gameActive = false;
        clearInterval(timer);
        
        hunterFeedback.textContent = `Level Complete! +${level * 20} bonus points!`;
        hunterFeedback.className = 'hunter-feedback correct';
        
        score += level * 20;
        level++;
        updateStats();
        
        setTimeout(() => {
            timeLeft = 60;
            primesCollected = 0;
            gameActive = true;
            generateGrid();
            startTimer();
        }, 2000);
    }
    
    function startTimer() {
        clearInterval(timer);
        timer = setInterval(() => {
            timeLeft--;
            hunterTime.textContent = `Time: ${timeLeft}s`;
            
            if (timeLeft <= 10) {
                hunterTime.classList.add('time-critical');
            }
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                gameOver();
            }
        }, 1000);
    }
    
    function gameOver() {
        gameActive = false;
        hunterFeedback.textContent = `Game Over! Final Score: ${score}`;
        hunterFeedback.className = 'hunter-feedback wrong';
        
        // Mark all primes that weren't found
        document.querySelectorAll('.hunter-cell').forEach(cell => {
            if (cell.dataset.isPrime === 'true' && !cell.classList.contains('correct')) {
                cell.classList.add('missed');
            }
        });
    }
    
    function showHint() {
        if (!gameActive) return;
        
        // Find first uncollected prime
        const primes = Array.from(document.querySelectorAll('.hunter-cell'))
            .filter(cell => cell.dataset.isPrime === 'true' && !cell.classList.contains('correct'));
        
        if (primes.length > 0) {
            const randomPrime = primes[Math.floor(Math.random() * primes.length)];
            randomPrime.classList.add('hint');
            
            setTimeout(() => {
                randomPrime.classList.remove('hint');
            }, 1000);
        } else {
            hunterFeedback.textContent = "No primes left to find!";
            hunterFeedback.className = 'hunter-feedback info';
        }
    }
    
    function updateStats() {
        hunterLevel.textContent = `Level: ${level}`;
        hunterScore.textContent = `Score: ${score}`;
        hunterTime.textContent = `Time: ${timeLeft}s`;
        primesFound.textContent = primesCollected;
    }
    
    function updateProgress() {
        const percentage = primesInGrid > 0 ? (primesCollected / primesInGrid) * 100 : 0;
        progressFill.style.width = `${percentage}%`;
    }
    
    // Event listeners
    hunterHint.addEventListener('click', showHint);
    hunterNew.addEventListener('click', initGame);
}