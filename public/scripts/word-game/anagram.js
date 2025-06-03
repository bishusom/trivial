export function initWordGame() {
    console.log('Initializing Anagram game');

    // Game state
    let baseWord = '';
    let scrambledLetters = [];
    let currentWord = [];
    let foundWords = [];
    let score = 0;
    let usedBaseWords = [];
    let autoStartTimeout = null;
    let timer = 0;
    let timerInterval = null;
    let isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;

    // Level system
    let currentLevel = 1;
    let levels = [
        { difficulty: 'easy', wordLength: [6, 7], games: 3, timeLimit: 240 },
        { difficulty: 'medium', wordLength: [8, 9], games: 3, timeLimit: 300 },
        { difficulty: 'hard', wordLength: [10, 11, 12], games: 3, timeLimit: 500 }
    ];
    let gamesCompletedInCurrentDifficulty = 0;
    const totalGames = levels.reduce((sum, level) => sum + level.games, 0); // 9 games

    // DOM elements
    const scrambledLettersEl = document.getElementById('scrambled-letters');
    const currentAttemptEl = document.getElementById('current-attempt');
    const submitBtn = document.getElementById('anagram-submit');
    const clearBtn = document.getElementById('anagram-clear');
    const shuffleBtn = document.getElementById('anagram-shuffle');
    const newBtn = document.getElementById('anagram-new');
    const hintBtn = document.getElementById('anagram-hint');
    const revealBtn = document.getElementById('anagram-reveal');
    const feedbackEl = document.getElementById('anagram-feedback');
    const targetEl = document.getElementById('anagram-target');
    const scoreEl = document.getElementById('anagram-score');
    const solutionsList = document.getElementById('solutions-list');
    const levelEl = document.getElementById('anagram-level');
    const gamesRemainingEl = document.getElementById('anagram-games-remaining');
    const timeElement = document.getElementById('anagram-time') || createTimeElement();
    const muteBtn = document.getElementById('mute-btn');
    const muteBtnIcon = document.querySelector('#mute-btn .material-icons');

    // Sound effects
    const audioElements = {
        select: new Audio('/audio/click.mp3'),
        found: new Audio('/audio/correct.mp3'),
        win: new Audio('/audio/win.mp3'),
        error: new Audio('/audio/wrong.mp3')
    };

    function trackEvent(action, category, label, value) {
        if (typeof gtag !== 'undefined') {
            gtag('event', action, { event_category: category, event_label: label, value: value });
        }
    }

    function createTimeElement() {
        const element = document.createElement('span');
        element.id = 'anagram-time';
        element.className = 'word-game-timer';
        document.querySelector('.game-meta').appendChild(element);
        return element;
    }

    function playSound(type) {
        if (isMuted) {
            console.log(`Sound ${type} skipped: muted`);
            return;
        }
        console.log(`Playing sound: ${type}`);
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

    function loadMuteState() {
        isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;
        if (muteBtnIcon) {
            muteBtnIcon.textContent = isMuted ? 'volume_off' : 'volume_up';
        }
        if (isMuted) {
            stopAllSounds();
        }
    }

    function startTimer() {
        clearInterval(timerInterval);
        const currentDifficulty = levels.find(level => currentLevel <= level.games + (levels.slice(0, levels.indexOf(level)).reduce((sum, l) => sum + l.games, 0)));
        timer = currentDifficulty.timeLimit;
        updateTimer();
        timerInterval = setInterval(() => {
            timer--;
            updateTimer();
            if (timer <= 0) {
                clearInterval(timerInterval);
                showFeedback('Time\'s up!', 'error');
                setTimeout(checkLevelProgress, 2000);
            }
        }, 1000);
    }

    function updateTimer() {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        timeElement.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    function showConfetti(options = {}) {
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

    // Helper functions
    function scrambleWord(word) {
        return word.split('').sort(() => Math.random() - 0.5).join('');
    }

    async function initGame() {
        try {
            if (autoStartTimeout) {
                clearTimeout(autoStartTimeout);
                autoStartTimeout = null;
            }

            // Determine current difficulty
            let currentDifficulty = levels.find(level => currentLevel <= level.games + (levels.slice(0, levels.indexOf(level)).reduce((sum, l) => sum + l.games, 0)));
            let wordLength = currentDifficulty.wordLength[Math.floor(Math.random() * currentDifficulty.wordLength.length)];

            const randomFloor = Math.floor(Math.random() * 900000);

            const query = db.collection('dictionary')
                     .where('length', '==', wordLength)
                     .where('isCommon', '==', true)
                     .where('randomIndex', '>=', randomFloor)
                     .orderBy('randomIndex')
                     .limit(50);

            const querySnapshot = await query.get();
            
            let wordList = [];

            querySnapshot.forEach((doc) => {
                const word = doc.data().word.toUpperCase();
                if (!usedBaseWords.includes(word)) {
                    wordList.push(word);
                }
            });

            if (wordList.length === 0) {
                throw new Error('No unused words found in database');
            }

            baseWord = wordList[Math.floor(Math.random() * wordList.length)];
            usedBaseWords.push(baseWord);
            scrambledLetters = scrambleWord(baseWord).split('');
            foundWords = [];
            currentWord = [];

            renderLetters();
            updateCurrentAttempt();
            updateFoundWords();
            targetEl.textContent = `Word Length: ${baseWord.length}`;
            scoreEl.textContent = `Score: ${score}`;
            levelEl.textContent = `Level: ${currentLevel} (${currentDifficulty.difficulty})`;
            updateGamesRemaining();
            feedbackEl.textContent = 'Unscramble the letters to form the correct word!';
            feedbackEl.className = 'anagram-feedback info';
            startTimer();
        } catch (error) {
            console.error('Error initializing game:', error);
            const localWordList = [
                'PICTURE', 'SILENCE', 'CAPTURE', 'MOUNTAIN',
                'ADVENTURE', 'DISCOVERY',
                'STANDARD', 'PARADISE'
            ].filter(word => !usedBaseWords.includes(word));

            let currentDifficulty = levels.find(level => currentLevel <= level.games + (levels.slice(0, levels.indexOf(level)).reduce((sum, l) => sum + l.games, 0)));
            let wordLength = currentDifficulty.wordLength[Math.floor(Math.random() * currentDifficulty.wordLength.length)];

            let filteredWords = localWordList.filter(word => word.length === wordLength);
            if (filteredWords.length === 0) {
                console.warn('No unused words available in fallback list. Resetting used words.');
                usedBaseWords = [];
                filteredWords = localWordList.filter(word => word.length === wordLength);
                if (filteredWords.length === 0) {
                    filteredWords = localWordList.filter(word => currentDifficulty.wordLength.includes(word.length));
                    if (filteredWords.length === 0) {
                        filteredWords = ['PICTURE'];
                    }
                }
            }

            baseWord = filteredWords[Math.floor(Math.random() * filteredWords.length)];
            usedBaseWords.push(baseWord);
            scrambledLetters = scrambleWord(baseWord).split('');
            foundWords = [];
            currentWord = [];

            renderLetters();
            updateCurrentAttempt();
            updateFoundWords();
            targetEl.textContent = `Word Length: ${baseWord.length}`;
            scoreEl.textContent = `Score: ${score}`;
            levelEl.textContent = `Level: ${currentLevel} (${currentDifficulty.difficulty})`;
            updateGamesRemaining();
            feedbackEl.textContent = 'Unscramble the letters to form the correct word!';
            feedbackEl.className = 'anagram-feedback info';
            startTimer();
        }
        trackEvent('anagram_started', 'anagram', 1);
    }

    function renderLetters() {
        scrambledLettersEl.innerHTML = '';
        scrambledLetters.forEach((letter, index) => {
            const tile = document.createElement('div');
            tile.className = `letter-tile ${currentWord.includes(index) ? 'used' : ''}`;
            tile.textContent = letter;
            tile.dataset.index = index;
            tile.addEventListener('click', () => selectLetter(index));
            scrambledLettersEl.appendChild(tile);
        });
    }

    function selectLetter(index) {
        if (currentWord.includes(index)) return;
        currentWord.push(index);
        playSound('select');
        updateCurrentAttempt();
        renderLetters();
    }

    function updateCurrentAttempt() {
        currentAttemptEl.innerHTML = '';
        currentWord.forEach(index => {
            const letter = document.createElement('span');
            letter.textContent = scrambledLetters[index];
            currentAttemptEl.appendChild(letter);
        });
    }

    function submitWord() {
        if (currentWord.length === 0) {
            showFeedback('Please select some letters first', 'error');
            playSound('error');
            return;
        }

        const word = currentWord.map(index => scrambledLetters[index]).join('');

        if (word.length !== baseWord.length) {
            showFeedback(`Word must be ${baseWord.length} letters`, 'error');
            playSound('error');
            return;
        }

        if (word === baseWord) {
            foundWords.push(word);
            score += calculateScore(word);
            showFeedback(`Correct! You found the word! +${calculateScore(word)} points`, 'success');
            playSound('found');
            scrambledLettersEl.innerHTML = ''; // Remove letter tiles
            updateFoundWords();
            scoreEl.textContent = `Score: ${score}`;
            clearCurrentAttempt();
            clearInterval(timerInterval);

            const victoryScreen = document.createElement('div');
            victoryScreen.className = 'victory-screen';
            showConfetti();

            let message = `🎉 Word Found: ${word}! 🎉`;
            victoryScreen.innerHTML = `
                <h2>Victory!</h2>
                <p>${message}</p>
                <p>Score: ${score}</p>
                <div class="countdown">Next game starting in 5...</div>
            `;
            document.body.appendChild(victoryScreen);

            let countdown = 5;
            const countdownElement = victoryScreen.querySelector('.countdown');
            const countdownInterval = setInterval(() => {
                countdown--;
                countdownElement.textContent = `Next game starting in ${countdown}...`;
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    victoryScreen.remove();
                    checkLevelProgress();
                }
            }, 1000);

            if (autoStartTimeout) {
                clearTimeout(autoStartTimeout);
                autoStartTimeout = null;
            }
        } else {
            showFeedback('Not the correct word', 'error');
            playSound('error');
        }
    }

    function calculateScore(word) {
        return word.length * 5;
    }

    function clearCurrentAttempt() {
        currentWord = [];
        updateCurrentAttempt();
        renderLetters();
    }

    function shuffleLetters() {
        scrambledLetters = scrambleWord(baseWord).split('');
        renderLetters();
    }

    function showHint() {
        if (foundWords.includes(baseWord)) {
            showFeedback('You already found the word!', 'info');
        } else {
            const hint = baseWord.split('').slice(0, 2).join('');
            showFeedback(`Try starting with: ${hint}...`, 'info');
        }
    }

    function revealWord() {
        showFeedback(`The word was: ${baseWord}`, 'info');
        scrambledLettersEl.innerHTML = ''; // Remove letter tiles
        clearInterval(timerInterval);
        if (autoStartTimeout) {
            clearTimeout(autoStartTimeout);
        }
        autoStartTimeout = setTimeout(() => {
            checkLevelProgress();
            autoStartTimeout = null;
        }, 2500);
    }

    function updateFoundWords() {
        solutionsList.innerHTML = '';
        if (foundWords.includes(baseWord)) {
            const wordEl = document.createElement('div');
            wordEl.className = 'solution-word';
            wordEl.textContent = baseWord;
            solutionsList.appendChild(wordEl);
        }
    }

    function showFeedback(message, type) {
        feedbackEl.textContent = message;
        feedbackEl.className = `anagram-feedback ${type}`;
    }

    function updateGamesRemaining() {
        const currentDifficultyIndex = levels.findIndex(level => 
            currentLevel <= level.games + (levels.slice(0, levels.indexOf(level)).reduce((sum, l) => sum + l.games, 0)));
        const gamesPlayed = levels.slice(0, currentDifficultyIndex).reduce((sum, l) => sum + l.games, 0) + gamesCompletedInCurrentDifficulty;
        const gamesRemaining = totalGames - gamesPlayed;
        gamesRemainingEl.textContent = `Games to Win: ${gamesRemaining}`;
    }

    function checkLevelProgress() {
        gamesCompletedInCurrentDifficulty++;
        let currentDifficulty = levels.find(level => currentLevel <= level.games + (levels.slice(0, levels.indexOf(level)).reduce((sum, l) => sum + l.games, 0)));

        if (gamesCompletedInCurrentDifficulty >= currentDifficulty.games) {
            currentLevel++;
            gamesCompletedInCurrentDifficulty = 0;
            if (currentLevel <= totalGames) {
                showConfetti({ particleCount: 200, spread: 100 });
            }
        }

        if (currentLevel > totalGames) {
            const victoryScreen = document.createElement('div');
            victoryScreen.className = 'victory-screen';
            showConfetti({ particleCount: 200, spread: 100 });
            playSound('win');

            victoryScreen.innerHTML = `
                <h2>Congratulations!</h2>
                <p>You've won the game!</p>
                <p>Final Score: ${score}</p>
                <div class="countdown">Restarting in 5...</div>
            `;
            document.body.appendChild(victoryScreen);

            let countdown = 5;
            const countdownElement = victoryScreen.querySelector('.countdown');
            const countdownInterval = setInterval(() => {
                countdown--;
                countdownElement.textContent = `Restarting in ${countdown}...`;
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    victoryScreen.remove();
                    currentLevel = 1;
                    gamesCompletedInCurrentDifficulty = 0;
                    usedBaseWords = [];
                    score = 0;
                    initGame();
                }
            }, 1000);
        } else {
            initGame();
        }
    }

    // Event listeners
    submitBtn.addEventListener('click', submitWord);
    clearBtn.addEventListener('click', clearCurrentAttempt);
    shuffleBtn.addEventListener('click', shuffleLetters);
    newBtn.addEventListener('click', initGame);
    hintBtn.addEventListener('click', showHint);
    revealBtn.addEventListener('click', revealWord);

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            localStorage.setItem('triviaMasterMuteState', JSON.stringify(isMuted));
            if (muteBtnIcon) {
                muteBtnIcon.textContent = isMuted ? 'volume_off' : 'volume_up';
            }
            if (isMuted) {
                stopAllSounds();
            }
        });
    }

    // Start the game
    loadMuteState();
    initGame();
}