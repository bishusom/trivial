/* global gtag, confetti */

export function initPuzzle() {
    const gameState = {
        currentSequence: [],
        correctAnswer: 0,
        level: 1,
        score: 0,
        sequencesSolved: 0,
        timeoutId: null,
        isMuted: JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false,
        timeLeft: 120,
        timerInterval: null
    };

    const audioElements = {
        select: new Audio('/audio/click.mp3'),
        found: new Audio('/audio/correct.mp3'),
        win: new Audio('/audio/win.mp3'),
        error: new Audio('/audio/wrong.mp3')
    };

    const elements = {
        sequenceDisplay: document.getElementById('sequence-display'),
        sequenceOptions: document.getElementById('sequence-options'),
        sequenceFeedback: document.getElementById('sequence-feedback'),
        hintText: document.getElementById('hint-text'),
        sequenceHint: document.getElementById('sequence-hint'),
        sequenceNext: document.getElementById('sequence-next'),
        sequenceNew: document.getElementById('sequence-new'),
        sequenceLevel: document.getElementById('sequence-level'),
        sequenceScore: document.getElementById('sequence-score'),
        timeEl: document.getElementById('sequence-time') || createTimeElement()
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
        element.id = 'sequence-time';
        element.className = 'timer-value';
        const meta = document.querySelector('.puzzle-meta');
        if (meta) meta.appendChild(element);
        return element;
    }

    function startTimer() {
        console.log('Starting timer');
        if (gameState.timerInterval) {
            clearInterval(gameState.timerInterval);
        }
        gameState.timeLeft = 120;
        updateTimer();
        gameState.timerInterval = setInterval(() => {
            console.log(`Timer tick: ${gameState.timeLeft}`);
            gameState.timeLeft = Math.max(0, gameState.timeLeft - 1);
            updateTimer();
            if (gameState.timeLeft <= 0) {
                console.log('Timer expired');
                clearInterval(gameState.timerInterval);
                gameState.timerInterval = null;
                elements.sequenceFeedback.textContent = "Time's up!";
                elements.sequenceFeedback.className = 'sequence-feedback wrong';
                playSound('error');
                setTimeout(generateSequence, 2000);
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

    function initGame() {
        if (gameState.timeoutId) {
            clearTimeout(gameState.timeoutId);
            gameState.timeoutId = null;
        }
        gameState.level = 1;
        gameState.score = 0;
        gameState.sequencesSolved = 0;
        gameState.isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;
        updateStats();
        generateSequence();
        startTimer();
        trackEvent('sequence_started', 'number_sequence', 1);
        if (gameState.isMuted) {
            stopAllSounds();
        }
        const muteBtnIcon = document.querySelector('#mute-btn .material-icons');
        if (muteBtnIcon) {
            muteBtnIcon.textContent = gameState.isMuted ? 'volume_off' : 'volume_up';
        }
    }

    function generateArithmeticSequence() {
        const start = Math.floor(Math.random() * 10) + 1;
        const difference = Math.floor(Math.random() * 6) + 2;
        const length = Math.floor(Math.random() * 3) + 4;
        const sequence = [];
        for (let i = 0; i < length; i++) {
            sequence.push(start + i * difference);
        }
        return {
            sequence: sequence.slice(0, -1),
            answer: sequence[sequence.length - 1],
            description: `Arithmetic sequence: add ${difference} each time`
        };
    }

    function generateGeometricSequence() {
        const start = Math.floor(Math.random() * 5) + 1;
        const ratio = Math.floor(Math.random() * 3) + 2;
        const length = Math.floor(Math.random() * 3) + 4;
        const sequence = [];
        for (let i = 0; i < length; i++) {
            sequence.push(start * Math.pow(ratio, i));
        }
        return {
            sequence: sequence.slice(0, -1),
            answer: sequence[sequence.length - 1],
            description: `Geometric sequence: multiply by ${ratio} each time`
        };
    }

    function generateSquareSequence() {
        const start = Math.floor(Math.random() * 5) + 1;
        const length = Math.floor(Math.random() * 3) + 4;
        const sequence = [];
        for (let i = 0; i < length; i++) {
            sequence.push(Math.pow(start + i, 2));
        }
        return {
            sequence: sequence.slice(0, -1),
            answer: sequence[sequence.length - 1],
            description: `Square numbers: n² where n starts at ${start}`
        };
    }

    function generatePrimeSequence() {
        const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
        const start = Math.floor(Math.random() * 4);
        const length = Math.floor(Math.random() * 3) + 4;
        const sequence = primes.slice(start, start + length);
        return {
            sequence: sequence.slice(0, -1),
            answer: sequence[sequence.length - 1],
            description: `Prime number sequence`
        };
    }

    function generateFibonacciLikeSequence() {
        const a = Math.floor(Math.random() * 5) + 1;
        const b = Math.floor(Math.random() * 5) + 1;
        const length = Math.floor(Math.random() * 3) + 5;
        const sequence = [a, b];
        for (let i = 2; i < length; i++) {
            sequence.push(sequence[i-1] + sequence[i-2]);
        }
        return {
            sequence: sequence.slice(0, -1),
            answer: sequence[sequence.length - 1],
            description: `Fibonacci-like sequence: each number is the sum of the two preceding ones`
        };
    }

    function generateMixedSequence() {
        const types = [generateSquareSequence, generatePrimeSequence, generateFibonacciLikeSequence];
        return types[Math.floor(Math.random() * types.length)]();
    }

    function generateSequence() {
        elements.sequenceDisplay.innerHTML = '';
        elements.sequenceOptions.innerHTML = '';
        elements.sequenceFeedback.textContent = '';
        elements.hintText.textContent = '';

        const sequenceTypes = [
            generateArithmeticSequence,
            generateGeometricSequence,
            generateSquareSequence,
            generatePrimeSequence,
            generateFibonacciLikeSequence,
            generateMixedSequence
        ];

        let typeIndex;
        if (gameState.level <= 2) {
            typeIndex = Math.floor(Math.random() * 2);
        } else if (gameState.level <= 4) {
            typeIndex = Math.random() < 0.7 ? Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);
        } else if (gameState.level <= 6) {
            const rand = Math.random();
            if (rand < 0.5) {
                typeIndex = 2 + Math.floor(Math.random() * 2);
            } else if (rand < 0.8) {
                typeIndex = Math.floor(Math.random() * 2);
            } else {
                typeIndex = 4 + Math.floor(Math.random() * 2);
            }
        } else {
            const rand = Math.random();
            if (rand < 0.6) {
                typeIndex = 4 + Math.floor(Math.random() * 2);
            } else if (rand < 0.9) {
                typeIndex = 2 + Math.floor(Math.random() * 2);
            } else {
                typeIndex = Math.floor(Math.random() * 2);
            }
        }

        const { sequence, answer, description } = sequenceTypes[typeIndex]();
        
        gameState.currentSequence = sequence;
        gameState.correctAnswer = answer;

        sequence.forEach((num, index) => {
            const numElement = document.createElement('span');
            numElement.className = 'sequence-number';
            numElement.textContent = num;
            elements.sequenceDisplay.appendChild(numElement);
        });
        const lastElement = document.createElement('span');
        lastElement.className = 'sequence-number missing';
        lastElement.textContent = '?';
        elements.sequenceDisplay.appendChild(lastElement);

        const options = generateOptions(answer);
        options.forEach((option, index) => {
            const optionBtn = document.createElement('button');
            optionBtn.className = 'btn';
            optionBtn.textContent = option;
            optionBtn.addEventListener('click', () => checkAnswer(option));
            elements.sequenceOptions.appendChild(optionBtn);
        });

        elements.hintText.dataset.description = description;
        startTimer();
    }

    function generateOptions(correctAnswer) {
        const options = [correctAnswer];
        while (options.length < 4) {
            let wrongAnswer;
            const variation = Math.floor(Math.random() * 3) + 1;
            switch (variation) {
                case 1:
                    wrongAnswer = correctAnswer + (Math.floor(Math.random() * 5)) + 1;
                    break;
                case 2:
                    wrongAnswer = correctAnswer - (Math.floor(Math.random() * 5)) + 1;
                    break;
                case 3:
                    wrongAnswer = correctAnswer * (Math.floor(Math.random() * 2)) + 1;
                    break;
            }
            if (wrongAnswer > 0 && !options.includes(wrongAnswer)) {
                options.push(wrongAnswer);
            }
        }
        return options.sort(() => Math.random() - 0.5);
    }

    function checkAnswer(selected) {
        playSound('select');
        if (parseInt(selected) === gameState.correctAnswer) {
            elements.sequenceFeedback.textContent = 'Correct! Well done!';
            elements.sequenceFeedback.className = 'sequence-feedback correct';
            
            gameState.score += gameState.level * 10;
            gameState.sequencesSolved++;
            
            if (gameState.sequencesSolved >= 3) {
                gameState.level++;
                gameState.sequencesSolved = 0;
                showConfetti({ particleCount: 150, spread: 80 });
            } else {
                showConfetti();
            }
            
            updateStats();
            
            document.querySelectorAll('#sequence-options button').forEach(btn => {
                btn.disabled = true;
                if (parseInt(btn.textContent) === gameState.correctAnswer) {
                    btn.classList.add('correct');
                }
            });
            
            clearInterval(gameState.timerInterval);
            gameState.timerInterval = null;
            playSound('win');
            trackEvent('sequence_solved', 'number_sequence', gameState.level);
            
            gameState.timeoutId = setTimeout(() => {
                generateSequence();
                gameState.timeoutId = null;
            }, 2500);
        } else {
            elements.sequenceFeedback.textContent = `Incorrect. Try again!`;
            elements.sequenceFeedback.className = 'sequence-feedback wrong';
            
            document.querySelectorAll('#sequence-options button').forEach(btn => {
                if (btn.textContent === selected) {
                    btn.classList.add('wrong');
                }
            });
            playSound('error');
        }
    }

    function showHint() {
        elements.hintText.textContent = elements.hintText.dataset.description;
        playSound('select');
    }

    function updateStats() {
        elements.sequenceLevel.textContent = `Level: ${gameState.level}`;
        elements.sequenceScore.textContent = `Score: ${gameState.score}`;
    }

    function setupEventListeners() {
        elements.sequenceHint.addEventListener('click', showHint);
        elements.sequenceNext.addEventListener('click', () => {
            playSound('select');
            if (gameState.timeoutId) {
                clearTimeout(gameState.timeoutId);
                gameState.timeoutId = null;
            }
            generateSequence();
        });
        elements.sequenceNew.addEventListener('click', () => {
            playSound('select');
            initGame();
        });
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