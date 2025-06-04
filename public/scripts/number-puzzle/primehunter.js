/* global gtag, confetti */

export function initPuzzle() {
    const gameState = {
        level: 1,
        score: 0,
        timeLeft: 60,
        primesInGrid: 0,
        primesCollected: 0,
        currentNumbers: [],
        gameActive: false,
        isMuted: JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false,
        timerInterval: null
    };

    const audioElements = {
        select: new Audio('/audio/click.mp3'),
        correct: new Audio('/audio/correct.mp3'),
        win: new Audio('/audio/win.mp3'),
        error: new Audio('/audio/wrong.mp3')
    };

    const elements = {
        hunterGrid: document.getElementById('hunter-grid'),
        hunterFeedback: document.getElementById('hunter-feedback'),
        hunterHint: document.getElementById('hunter-hint'),
        hunterNew: document.getElementById('hunter-new'),
        hunterLevel: document.getElementById('hunter-level'),
        hunterScore: document.getElementById('hunter-score'),
        hunterTime: document.getElementById('hunter-time'),
        primesFound: document.getElementById('primes-found'),
        primesTotal: document.getElementById('primes-total'),
        progressFill: document.getElementById('progress-fill')
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
        gameState.timeLeft = 60;
        gameState.primesCollected = 0;
        gameState.isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;
        updateStats();
        generateGrid();
        startTimer();
        gameState.gameActive = true;
        trackEvent('primehunter_started', 'primehunter', 1);
        if (gameState.isMuted) {
            stopAllSounds();
        }
        const muteBtnIcon = document.querySelector('#mute-btn .material-icons');
        if (muteBtnIcon) {
            muteBtnIcon.textContent = gameState.isMuted ? 'volume_off' : 'volume_up';
        }
        playSound('select');
    }

    function generateGrid() {
        elements.hunterGrid.innerHTML = '';
        gameState.currentNumbers = [];
        gameState.primesInGrid = 0;
        
        const gridSize = getGridSize();
        const numberRange = getNumberRange();
        
        for (let i = 0; i < gridSize * gridSize; i++) {
            const num = Math.floor(Math.random() * numberRange) + 1;
            gameState.currentNumbers.push(num);
            
            const cell = document.createElement('div');
            cell.className = 'hunter-cell';
            cell.textContent = num;
            cell.dataset.number = num;
            cell.dataset.isPrime = isPrime(num);
            
            if (cell.dataset.isPrime === 'true') {
                gameState.primesInGrid++;
            }
            
            cell.addEventListener('click', () => handleCellClick(cell));
            elements.hunterGrid.appendChild(cell);
        }
        
        elements.primesTotal.textContent = gameState.primesInGrid;
        elements.primesFound.textContent = gameState.primesCollected;
        updateProgress();
        
        elements.hunterGrid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    }

    function getGridSize() {
        if (gameState.level <= 3) return 4;
        if (gameState.level <= 6) return 5;
        return 6;
    }

    function getNumberRange() {
        if (gameState.level <= 2) return 30;
        if (gameState.level <= 4) return 50;
        if (gameState.level <= 6) return 75;
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
        if (!gameState.gameActive) return;
        
        const number = parseInt(cell.dataset.number);
        const isPrime = cell.dataset.isPrime === 'true';
        playSound('select');
        
        if (cell.classList.contains('selected')) {
            return;
        }
        
        cell.classList.add('selected');
        
        if (isPrime) {
            cell.classList.add('correct');
            gameState.primesCollected++;
            gameState.score += gameState.level * 5;
            updateStats();
            updateProgress();
            playSound('correct');
            
            if (gameState.primesCollected === gameState.primesInGrid) {
                levelUp();
            }
        } else {
            cell.classList.add('wrong');
            gameState.timeLeft = Math.max(5, gameState.timeLeft - 5);
            updateStats();
            playSound('error');
        }
    }

    function levelUp() {
        gameState.gameActive = false;
        clearInterval(gameState.timerInterval);
        
        elements.hunterFeedback.textContent = `Level Complete! +${gameState.level * 20} bonus points!`;
        elements.hunterFeedback.className = 'hunter-feedback correct';
        
        gameState.score += gameState.level * 20;
        gameState.level++;
        updateStats();
        playSound('win');
        showConfetti({ particleCount: 250, spread: 80 });
        
        setTimeout(() => {
            gameState.timeLeft = 60;
            gameState.primesCollected = 0;
            gameState.gameActive = true;
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
                elements.hunterTime.classList.add('time-critical');
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
        elements.hunterFeedback.textContent = `Game Over! Final Score: ${gameState.score}`;
        elements.hunterFeedback.className = 'hunter-feedback wrong';
        playSound('error');
        
        document.querySelectorAll('.hunter-cell').forEach(cell => {
            if (cell.dataset.isPrime === 'true' && !cell.classList.contains('correct')) {
                cell.classList.add('missed');
            }
        });
    }

    function showHint() {
        if (!gameState.gameActive) return;
        playSound('select');
        
        const primes = Array.from(document.querySelectorAll('.hunter-cell'))
            .filter(cell => cell.dataset.isPrime === 'true' && !cell.classList.contains('correct'));
        
        if (primes.length > 0) {
            const randomPrime = primes[Math.floor(Math.random() * primes.length)];
            randomPrime.classList.add('hint');
            setTimeout(() => {
                randomPrime.classList.remove('hint');
            }, 1000);
        } else {
            elements.hunterFeedback.textContent = "No primes left to find!";
            elements.hunterFeedback.className = 'hunter-feedback info';
        }
    }

    function updateStats() {
        elements.hunterLevel.textContent = `Level: ${gameState.level}`;
        elements.hunterScore.textContent = `Score: ${gameState.score}`;
        elements.hunterTime.textContent = `Time: ${gameState.timeLeft}s`;
        elements.primesFound.textContent = gameState.primesCollected;
    }

    function updateProgress() {
        const percentage = gameState.primesInGrid > 0 ? (gameState.primesCollected / gameState.primesInGrid) * 100 : 0;
        elements.progressFill.style.width = `${percentage}%`;
    }

    function setupEventListeners() {
        elements.hunterHint.addEventListener('click', showHint);
        elements.hunterNew.addEventListener('click', initGame);
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
    }

    initGame();
    setupEventListeners();
}