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

    // Level system
    let currentLevel = 1;
    let levels = [
        { difficulty: 'easy', wordLength: [6, 7], games: 3 },
        { difficulty: 'medium', wordLength: [8, 9], games: 3 },
        { difficulty: 'hard', wordLength: [10, 11, 12], games: 3 }
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
            let wordLength = currentDifficulty.wordLength[Math.floor(Math.random() * 2)];

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
            feedbackEl.textContent = '';
            feedbackEl.className = 'anagram-feedback';
        } catch (error) {
            console.error('Error initializing game:', error);
            const localWordList = [
                'PICTURE', 'SILENCE', 'CAPTURE', 'MOUNTAIN',
                'ADVENTURE', 'DISCOVERY',
                'STANDARD', 'PARADISE'
            ].filter(word => !usedBaseWords.includes(word));

            let currentDifficulty = levels.find(level => currentLevel <= level.games + (levels.slice(0, levels.indexOf(level)).reduce((sum, l) => sum + l.games, 0)));
            let wordLength = currentDifficulty.wordLength[Math.floor(Math.random() * 2)];

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
            feedbackEl.textContent = '';
            feedbackEl.className = 'anagram-feedback';
        }
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
            showFeedback('error', 'Please select some letters first');
            return;
        }

        const word = currentWord.map(index => scrambledLetters[index]).join('');

        if (word.length !== baseWord.length) {
            showFeedback('error', `Word must be ${baseWord.length} letters`);
            return;
        }

        if (word === baseWord) {
            foundWords.push(word);
            score += calculateScore(word);
            showFeedback('success', `Correct! You found the word! +${calculateScore(word)} points`);
            scrambledLettersEl.innerHTML = ''; // Remove letter tiles
            updateFoundWords();
            scoreEl.textContent = `Score: ${score}`;
            clearCurrentAttempt();

            if (autoStartTimeout) {
                clearTimeout(autoStartTimeout);
            }
            autoStartTimeout = setTimeout(() => {
                checkLevelProgress();
                autoStartTimeout = null;
            }, 2500);
        } else {
            showFeedback('error', 'Not the correct word');
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
            showFeedback('info', 'You already found the word!');
        } else {
            const hint = baseWord.split('').slice(0, 2).join('');
            showFeedback('info', `Try starting with: ${hint}...`);
        }
    }

    function revealWord() {
        showFeedback('info', `The word was: ${baseWord}`);
        scrambledLettersEl.innerHTML = ''; // Remove letter tiles
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

    function showFeedback(type, message) {
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
        }

        if (currentLevel > totalGames) {
            showFeedback('success', 'Congratulations! You won the game!');
            setTimeout(() => {
                currentLevel = 1;
                gamesCompletedInCurrentDifficulty = 0;
                usedBaseWords = [];
                score = 0;
                initGame();
            }, 3000);
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

    // Start the game
    initGame();
}