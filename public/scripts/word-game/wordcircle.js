export function initWordGame() {
    // Load saved state
    const savedState = loadGameState();
    let difficulty = savedState?.difficulty || 'easy';
    let consecutiveWins = savedState?.consecutiveWins || 0;
    let currentLevel = savedState?.currentLevel || 1;

    // Game configuration
    const config = {
        easy: { letterCount: 6, minWordLength: 3, maxWordLength: 5, wordCount: 6 },
        medium: { letterCount: 7, minWordLength: 4, maxWordLength: 6, wordCount: 8 },
        hard: { letterCount: 8, minWordLength: 4, maxWordLength: 7, wordCount: 10 }
    };

    // Game state
    let letters = [];
    let words = [];
    let foundWords = [];
    let selectedLetters = [];
    let currentWord = '';
    let usedWordsInGame = new Set();

    // DOM elements
    const lettersElement = document.getElementById('wordcircle-letters');
    const wordListElement = document.getElementById('wordcircle-wordlist');
    const wordsLeftElement = document.getElementById('wordcircle-words-left');
    const currentWordElement = document.getElementById('current-word');
    let feedbackElement = document.getElementById('wordcircle-feedback');
    const newGameBtn = document.getElementById('wordcircle-new');
    const hintBtn = document.getElementById('wordcircle-hint');
    const shuffleBtn = document.getElementById('wordcircle-shuffle');
    const submitBtn = document.getElementById('wordcircle-submit');
    const levelElement = document.getElementById('wordcircle-level');
    const gamesRemainingElement = document.getElementById('wordcircle-games-remaining');
    const muteBtnIcon = document.querySelector('#mute-btn .material-icons');

    // Sound effects
    const audioElements = {
        select: new Audio('/audio/click.mp3'),
        found: new Audio('/audio/correct.mp3'),
        win: new Audio('/audio/win.mp3'),
        error: new Audio('/audio/wrong.mp3')
    };

    // Mute state
    let isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;

    // Sound functions
    function playSound(type) {
        if (isMuted) return;
        if (audioElements[type]) {
            audioElements[type].currentTime = 0;
            audioElements[type].play().catch(err => console.error(`Error playing ${type} sound:`, err));
        }
    }

    function stopAllSounds() {
        Object.keys(audioElements).forEach(type => {
            audioElements[type].pause();
            audioElements[type].currentTime = 0;
        });
    }

    function loadMuteState() {
        isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;
        if (muteBtnIcon) {
            muteBtnIcon.textContent = isMuted ? 'volume_off' : 'volume_up';
        }
        if (isMuted) stopAllSounds();
    }

    // Game state functions
    function saveGameState() {
        const gameState = { difficulty, consecutiveWins, currentLevel };
        localStorage.setItem('wordCircleState', JSON.stringify(gameState));
    }

    function loadGameState() {
        const savedState = localStorage.getItem('wordCircleState');
        return savedState ? JSON.parse(savedState) : null;
    }

    // Word generation
    async function generateWordList(diffConfig) {
        try {
            const randomFloor = Math.floor(Math.random() * 900000);
            const snapshot = await db.collection('dictionary')
                .where('length', '>=', diffConfig.minWordLength)
                .where('length', '<=', diffConfig.maxWordLength)
                .where('randomIndex', '>=', randomFloor)
                .orderBy('randomIndex')
                .limit(diffConfig.wordCount * 3) // Increased limit for more variety
                .get();

            if (snapshot.empty) throw new Error("No words found");

            const wordPool = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.word && data.letters && !usedWordsInGame.has(data.word.toUpperCase())) {
                    wordPool.push({ word: data.word.toUpperCase(), letters: data.word.toUpperCase().split('') });
                }
            });

            return shuffleArray(wordPool).slice(0, diffConfig.wordCount);
        } catch (error) {
            console.error("Error fetching words:", error);
            const staticWords = [
                'CAT', 'HAT', 'RAT', 'MAT', 'PAT', 'SAT', 'BAT',
                'DOG', 'LOG', 'FOG', 'HOG', 'JOG', 'BOG',
                'PEN', 'MEN', 'TEN', 'DEN', 'HEN', 'KEN',
                'SUN', 'RUN', 'FUN', 'GUN', 'BUN', 'NUN',
                'CANE', 'LANE', 'PANE', 'SANE', 'VANE',
                'BAND', 'LAND', 'SAND', 'HAND', 'RAND'
            ].filter(word => word.length >= diffConfig.minWordLength && word.length <= diffConfig.maxWordLength);
            const uniqueStaticWords = [...new Set(staticWords)]
                .filter(word => !usedWordsInGame.has(word));
            return shuffleArray(uniqueStaticWords).slice(0, diffConfig.wordCount)
                .map(word => ({ word, letters: word.split('') }));
        }
    }

    function selectLetters(wordList, letterCount) {
        // Collect all unique letters from word list
        const allLetters = [...new Set(wordList.flatMap(wordObj => wordObj.letters))];
        console.log('All unique letters:', allLetters);

        // Try to find a minimal set of letters that can form all words
        let selected = [];
        let remainingWords = [...wordList];

        while (remainingWords.length > 0 && selected.length < letterCount) {
            // Count frequency of letters in remaining words
            const letterFreq = {};
            remainingWords.forEach(wordObj => {
                [...new Set(wordObj.letters)].forEach(letter => {
                    letterFreq[letter] = (letterFreq[letter] || 0) + 1;
                });
            });

            // Pick the letter that appears in the most remaining words
            const bestLetter = Object.keys(letterFreq).reduce((a, b) => 
                letterFreq[a] > letterFreq[b] ? a : b, Object.keys(letterFreq)[0]);

            if (bestLetter) {
                selected.push(bestLetter);
                // Remove words that can be formed with current letters
                remainingWords = remainingWords.filter(wordObj => {
                    const letterCounts = {};
                    selected.forEach(l => letterCounts[l] = (letterCounts[l] || 0) + 1);
                    return !wordObj.letters.every(l => letterCounts[l] > 0 && (letterCounts[l]--, true));
                });
            } else {
                break;
            }
        }

        // Fill remaining slots with random letters from allLetters
        while (selected.length < letterCount && allLetters.length > 0) {
            const randomLetter = allLetters.splice(Math.floor(Math.random() * allLetters.length), 1)[0];
            if (!selected.includes(randomLetter)) {
                selected.push(randomLetter);
            }
        }

        console.log('Selected letters:', selected);
        return selected;
    }

    function canFormWords(wordList, selectedLetters) {
        const result = wordList.every(wordObj => {
            const letterCounts = {};
            selectedLetters.forEach(letter => {
                letterCounts[letter] = (letterCounts[letter] || 0) + 1;
            });
            return wordObj.letters.every(letter => {
                if (!letterCounts[letter]) return false;
                letterCounts[letter]--;
                return letterCounts[letter] >= 0;
            });
        });
        console.log('Can form all words:', result, 'with letters:', selectedLetters);
        return result;
    }

    // Game initialization
    async function initGame() {
        showLoadingAnimation();
        lettersElement.innerHTML = '';
        wordListElement.innerHTML = '';
        currentWordElement.innerHTML = '';
        selectedLetters = [];
        foundWords = [];
        currentWord = '';
        usedWordsInGame.clear();

        updateLevelInfo();
        try {
            words = await generateWordList(config[difficulty]);
            console.log('Generated words:', words.map(w => w.word));
            let validLetters = false;
            let attempts = 0;
            const maxAttempts = 20; // Increased attempts

            while (!validLetters && attempts < maxAttempts) {
                letters = selectLetters(words, config[difficulty].letterCount);
                if (canFormWords(words, letters)) {
                    validLetters = true;
                } else {
                    words = await generateWordList(config[difficulty]);
                    attempts++;
                    console.log(`Attempt ${attempts} failed, retrying with new words`);
                }
            }

            if (!validLetters) {
                // Fallback to simpler word list
                console.warn('Falling back to simpler word list');
                words = [
                    { word: 'CAT', letters: ['C', 'A', 'T'] },
                    { word: 'HAT', letters: ['H', 'A', 'T'] },
                    { word: 'RAT', letters: ['R', 'A', 'T'] },
                    { word: 'MAT', letters: ['M', 'A', 'T'] },
                    { word: 'PAT', letters: ['P', 'A', 'T'] },
                    { word: 'SAT', letters: ['S', 'A', 'T'] }
                ].slice(0, config[difficulty].wordCount);
                letters = ['C', 'H', 'R', 'M', 'P', 'S', 'A', 'T'].slice(0, config[difficulty].letterCount);
                if (!canFormWords(words, letters)) {
                    throw new Error("Failed to generate valid letter set even with fallback");
                }
            }

            renderLetters();
            renderWordList();
            updateWordsLeft();
            showFeedback(`Form ${words.length} words using these letters!`, 'info');
        } catch (error) {
            console.error("Game initialization failed:", error);
            showFinalErrorAnimation();
        }
    }

    // Rendering functions
    function renderLetters() {
        lettersElement.innerHTML = '';
        const radius = 100;
        const centerX = 150;
        const centerY = 150;
        const angleStep = (2 * Math.PI) / letters.length;

        letters.forEach((letter, index) => {
            const angle = index * angleStep;
            const x = centerX + radius * Math.cos(angle) - 25;
            const y = centerY + radius * Math.sin(angle) - 25;

            const letterElement = document.createElement('div');
            letterElement.className = 'wordcircle-letter';
            letterElement.textContent = letter;
            letterElement.dataset.letter = letter;
            letterElement.dataset.index = index;
            letterElement.style.left = `${x}px`;
            letterElement.style.top = `${y}px`;

            letterElement.addEventListener('click', handleLetterClick);
            lettersElement.appendChild(letterElement);
        });
    }

    function renderWordList() {
        wordListElement.innerHTML = '';
        const sortedWords = [...words].sort((a, b) => a.word.localeCompare(b.word));
        sortedWords.forEach(wordObj => {
            const wordElement = document.createElement('div');
            wordElement.className = 'wordcircle-word';
            wordElement.textContent = wordObj.word;
            wordElement.dataset.word = wordObj.word;
            wordListElement.appendChild(wordElement);
        });
    }

    // Event handlers
    function handleLetterClick(e) {
        const letter = e.target.dataset.letter;
        const index = parseInt(e.target.dataset.index);
        if (!selectedLetters.includes(index)) {
            selectedLetters.push(index);
            currentWord += letter;
            e.target.classList.add('selected');
            if (selectedLetters.length > 1) {
                e.target.classList.add('last-selected');
                const prevIndex = selectedLetters[selectedLetters.length - 2];
                lettersElement.children[prevIndex].classList.remove('last-selected');
            }
            updateCurrentWord();
            playSound('select');
        }
    }

    function handleSubmit() {
        const word = currentWord.toUpperCase();
        if (word.length < config[difficulty].minWordLength) {
            showFeedback('Word too short!', 'error');
            playSound('error');
            return;
        }

        const matchedWordObj = words.find(wordObj => wordObj.word === word);
        if (matchedWordObj && !foundWords.includes(word)) {
            foundWords.push(word);
            playSound('found');
            const wordElement = wordListElement.querySelector(`[data-word="${word}"]`);
            if (wordElement) {
                wordElement.classList.add('found');
            }
            showFeedback(`Found: ${word}`, 'success');
            updateWordsLeft();
            if (foundWords.length === words.length) {
                handleGameWin();
            }
        } else {
            showFeedback('Invalid word!', 'error');
            playSound('error');
        }
        clearSelection();
    }

    function handleShuffle() {
        letters = shuffleArray(letters);
        renderLetters();
        clearSelection();
    }

    function handleGameWin() {
        playSound('win');
        const victoryScreen = document.createElement('div');
        victoryScreen.className = 'victory-screen';
        showConfetti();

        consecutiveWins++;
        currentLevel++;

        let victoryMessage = '';
        let levelUp = false;

        if (consecutiveWins >= 3) {
            if (difficulty === 'easy') {
                difficulty = 'medium';
                levelUp = true;
                victoryMessage = `🎉 Advanced to Medium level! 🎉`;
            } else if (difficulty === 'medium') {
                difficulty = 'hard';
                levelUp = true;
                victoryMessage = `🏆 Advanced to Hard level! 🏆`;
            } else {
                victoryMessage = `👑 Mastered Hard level! 👑`;
            }
            if (levelUp) {
                consecutiveWins = 0;
                setTimeout(() => showConfetti({ particleCount: 200, spread: 100 }), 1000);
            }
        } else {
            victoryMessage = `🎊 Level ${currentLevel} Complete! 🎊`;
        }

        victoryScreen.innerHTML = `
            <h2>Victory!</h2>
            <p>${victoryMessage}</p>
            <p>Words Found: ${foundWords.length}</p>
            <div class="countdown">Next level in 5...</div>
        `;
        document.body.appendChild(victoryScreen);

        let countdown = 5;
        const countdownElement = victoryScreen.querySelector('.countdown');
        const countdownInterval = setInterval(() => {
            countdown--;
            countdownElement.textContent = `Next level in ${countdown}...`;
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                victoryScreen.remove();
                saveGameState();
                updateLevelInfo();
                initGame();
            }
        }, 1000);
        saveGameState();
    }

    function clearSelection() {
        selectedLetters = [];
        currentWord = '';
        updateCurrentWord();
        Array.from(lettersElement.children).forEach(child => {
            child.classList.remove('selected', 'last-selected');
        });
    }

    // Utility functions
    function updateWordsLeft() {
        wordsLeftElement.textContent = `Words: ${words.length - foundWords.length}/${words.length}`;
    }

    function updateCurrentWord() {
        currentWordElement.textContent = currentWord || ' ';
    }

    function updateLevelInfo() {
        if (levelElement) {
            levelElement.textContent = `Level: ${currentLevel} (${difficulty})`;
        }
        if (difficulty !== 'hard') {
            const winsNeeded = 3 - consecutiveWins;
            gamesRemainingElement.textContent = winsNeeded > 0
                ? `Wins to next difficulty: ${winsNeeded}`
                : 'Ready to advance difficulty!';
        } else {
            gamesRemainingElement.textContent = 'Max difficulty reached!';
        }
    }

    function showFeedback(message, type) {
        feedbackElement.textContent = message;
        feedbackElement.className = `word-feedback ${type}`;
    }

    function giveHint() {
        const remainingWords = words.filter(wordObj => !foundWords.includes(wordObj.word));
        if (remainingWords.length > 0) {
            const hintWordObj = remainingWords[Math.floor(Math.random() * remainingWords.length)];
            const hint = hintWordObj.word.slice(0, 2);
            showFeedback(`Try a word starting with ${hint}...`, 'info');
        } else {
            showFeedback('You found all words!', 'success');
        }
    }

    function showLoadingAnimation() {
        feedbackElement.innerHTML = `
            <div class="loading-animation">
                <div class="loading-spinner"></div>
                <div class="loading-text">Creating your puzzle</div>
                <div class="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        feedbackElement.className = 'word-feedback info';
    }

    function showFinalErrorAnimation() {
        feedbackElement.innerHTML = `
            <div class="error-animation">
                <div class="error-icon">❌</div>
                <div>Having trouble loading</div>
                <button class="btn primary" onclick="initWordGame()">Try Again</button>
            </div>
        `;
        feedbackElement.className = 'word-feedback error';
    }

    function shuffleArray(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    function showConfetti(options = {}) {
        const defaults = {
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
        };
        confetti({ ...defaults, ...options });
    }

    // Event listeners
    newGameBtn.addEventListener('click', initGame);
    hintBtn.addEventListener('click', giveHint);
    shuffleBtn.addEventListener('click', handleShuffle);
    submitBtn.addEventListener('click', handleSubmit);

    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            localStorage.setItem('triviaMasterMuteState', isMuted);
            if (muteBtnIcon) {
                muteBtnIcon.textContent = isMuted ? 'volume_off' : 'volume_up';
            }
            if (isMuted) stopAllSounds();
        });
    }

    // Initialize
    initGame();
    loadMuteState();
}

document.addEventListener('DOMContentLoaded', () => {
    initWordGame();
});