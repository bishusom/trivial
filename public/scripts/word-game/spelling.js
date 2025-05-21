export function initWordGame() {
    console.log('Initializing Spelling Bee game with DictionaryAPI.dev');
    
    // Game state
    let letters = [];
    let centerLetter = '';
    let currentWord = [];
    let foundWords = [];
    let score = 0;
    let allPossibleWords = [];
    let gameOver = false;
    let rank = 'Beginner';
    
    // DOM elements
    const centerLetterEl = document.getElementById('center-letter');
    const letterElements = [
        document.getElementById('letter-0'),
        document.getElementById('letter-1'),
        document.getElementById('letter-2'),
        document.getElementById('letter-3'),
        document.getElementById('letter-4'),
        document.getElementById('letter-5')
    ];
    const currentWordEl = document.getElementById('current-word');
    const submitBtn = document.getElementById('spelling-submit');
    const clearBtn = document.getElementById('spelling-clear');
    const shuffleBtn = document.getElementById('spelling-shuffle');
    const newBtn = document.getElementById('spelling-new');
    const hintBtn = document.getElementById('spelling-hint');
    const giveUpBtn = document.getElementById('spelling-give-up'); // NEW
    const feedbackEl = document.getElementById('spelling-feedback');
    const centerLetterDisplay = document.getElementById('spelling-center-letter');
    const scoreEl = document.getElementById('spelling-score');
    const wordsList = document.getElementById('words-list');
    const rankEl = document.getElementById('spelling-rank');
    const gameOverModal = document.getElementById('game-over-modal');
    const gameOverScore = document.getElementById('game-over-score');
    const gameOverWords = document.getElementById('game-over-words');
    const playAgainBtn = document.getElementById('play-again-btn');


    // Initialize the game
    initGame();

    function trackEvent(action, category, label, value) {
        if (typeof gtag !== 'undefined') {
            gtag('event', action, { event_category: category, event_label: label, value: value });
        }
    }

    async function initGame() {
        const vowels = ['A', 'E', 'I', 'O', 'U'];
        const consonants = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z'];
        const qLetter = ['Q'];

        // Generate a solvable letter set
        do {
            centerLetter = getRandomLetter([...vowels, ...consonants]);
            letters = [centerLetter];
            
            if (centerLetter === 'Q') {
                letters.push('U');
            } else {
                letters.push(getRandomLetter(vowels));
            }
            
            while (letters.length < 7) {
                const letter = getRandomLetter([...vowels, ...consonants]);
                if (!letters.includes(letter)) {
                    letters.push(letter);
                }
            }
            
            letters = [letters[0], ...shuffleArray(letters.slice(1))];
            allPossibleWords = generateFallbackWords().slice(0, 50); // Limit to 50 words
        } while (allPossibleWords.length < 5);
        
        // Reset game state
        currentWord = [];
        foundWords = [];
        score = 0;
        gameOver = false;
        rank = 'Beginner';
        
        // Update UI
        renderLetters();
        updateCurrentWord();
        updateFoundWords();
        updateRank();
        centerLetterDisplay.textContent = `Center: ${centerLetter}`;
        scoreEl.textContent = `Score: ${score}`;
        feedbackEl.textContent = 'Words must be 4+ letters, include the center letter, and use only the given letters.';
        feedbackEl.className = 'spelling-feedback info';
        submitBtn.disabled = false;
        gameOverModal.style.display = 'none';
        trackEvent('spelling_bee_started','spelling_bee',1);
    }

    async function validateWord(word) {
        const wordUpper = word.toUpperCase();
        console.log(`Validating word: ${wordUpper}, Letters: ${letters.join(', ')}, Center: ${centerLetter}`);
        
        // Check if word matches letter set and center letter
        if (!wordUpper.split('').every(l => letters.includes(l)) || !wordUpper.includes(centerLetter)) {
            console.log(`Word ${wordUpper} rejected: Invalid letters or missing center letter`);
            return false;
        }

        // Check fallback list first to reduce API calls
        if (allPossibleWords.includes(wordUpper)) {
            console.log(`Word ${wordUpper} found in allPossibleWords`);
            return true;
        }

        // Try API validation
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
            if (response.ok) {
                console.log(`Word ${wordUpper} validated by API`);
                allPossibleWords.push(wordUpper);
                return true;
            } else {
                console.log(`API returned ${response.status} for ${wordUpper}`);
                showFeedback('info', 'Word validation failed. Try again or start a new game.');
                return allPossibleWords.includes(wordUpper); // Fallback to local list
            }
        } catch (error) {
            console.error(`Error validating word ${wordUpper}:`, error);
            showFeedback('info', 'Network error. Using local word list.');
            return allPossibleWords.includes(wordUpper);
        }
    }

    function generateFallbackWords() {
        const examples = [
            'ABLE', 'BAKE', 'CAKE', 'DEAL', 'FEAR', 'GEAR', 'HEAL', 'JADE', 'KALE', 'LEAK',
            'PEAR', 'REAL', 'SEAL', 'TEAR', 'WEAR', 'BABE', 'BALD', 'BALL', 'BAND', 'BANE',
            'BARK', 'BASE', 'BEAD', 'BEAN', 'BEAR', 'BEAT', 'BELL', 'BELT', 'BEND', 'BILL',
            'BIRD', 'BITE', 'BLADE', 'BLEED', 'BLEND', 'BLOW', 'BLUE', 'BOAR', 'BOAT', 'BOLD',
            'BONE', 'BOOK', 'BOOM', 'BOOT', 'BORN', 'BOSS', 'BOWL', 'BREAD', 'BREAK', 'BREED',
            'BRING', 'BROWN', 'BUILD', 'BURN', 'BURST', 'CAGE', 'CALL', 'CALM', 'CANE', 'CARD',
            'CARE', 'CASE', 'CAST', 'CATCH', 'CAUSE', 'CELL', 'CENT', 'CLAD', 'CLAN', 'CLAP',
            'CLEAN', 'CLEAR', 'CLIP', 'CLOUD', 'COAL', 'COAT', 'CODE', 'COLD', 'COME', 'CONE',
            'COOK', 'COOL', 'CORE', 'CORN', 'COST', 'CRAWL', 'CREAM', 'CREEP', 'CROWD', 'CROWN',
            'CURE', 'CURL', 'CUT', 'DANCE', 'DARE', 'DARK', 'DATE', 'DAWN', 'DEAD', 'DECK',
            'DEED', 'DEEP', 'DEER', 'DESK', 'DIVE', 'DOOR', 'DOSE', 'DRAW', 'DREAM', 'DRESS',
            'DRILL', 'DRINK', 'DRIVE', 'DROP', 'DRUM', 'DUST', 'EASE', 'EDGE', 'ELSE', 'EVEN',
            'EVER', 'FACE', 'FACT', 'FADE', 'FAIL', 'FAIR', 'FALL', 'FARM', 'FAST', 'FEED',
            'FEEL', 'FELL', 'FEND', 'FIND', 'FINE', 'FIRE', 'FIRM', 'FISH', 'FIST', 'FIVE',
            'FLAG', 'FLAT', 'FLEW', 'FLOW', 'FOAM', 'FOLD', 'FOOD', 'FOOT', 'FORD', 'FORM',
            'FORT', 'FREE', 'FRESH', 'FRIEND', 'FROST', 'FULL', 'FUSE', 'GAIN', 'GAME', 'GATE',
            'GAVE', 'GIFT', 'GIRL', 'GIVE', 'GLAD', 'GLASS', 'GLOW', 'GOAL', 'GOAT', 'GOLD',
            'GONE', 'GOOD', 'GRAB', 'GRADE', 'GRAND', 'GRASS', 'GREAT', 'GREEN', 'GREW', 'GRIP',
            'GROW', 'GUARD', 'GUESS', 'GUIDE', 'HALL', 'HAND', 'HANG', 'HARD', 'HARM', 'HATE',
            'HAVE', 'HEAD', 'HEAT', 'HEEL', 'HELL', 'HELP', 'HIDE', 'HIGH', 'HILL', 'HIRE',
            'HOLD', 'HOLE', 'HOME', 'HOOK', 'HOPE', 'HORN', 'HORSE', 'HOST', 'HOUR', 'HUNT',
            'HURT', 'IDEA', 'INCH', 'IRON', 'JACK', 'JAIL', 'JERK', 'JOIN', 'JOKE', 'JUMP',
            'JUST', 'KEEP', 'KICK', 'KILL', 'KIND', 'KING', 'KISS', 'KNEE', 'KNOW', 'LACK',
            'LAKE', 'LAND', 'LAST', 'LATE', 'LEAD', 'LEAF', 'LEAN', 'LEAP', 'LEFT', 'LEND',
            'LESS', 'LIFT', 'LIKE', 'LINE', 'LINK', 'LIST', 'LIVE', 'LOAD', 'LOAN', 'LOCK',
            'LONG', 'LOOK', 'LOOP', 'LORD', 'LOSE', 'LOSS', 'LOVE', 'LUCK', 'MAIL', 'MAIN',
            'MAKE', 'MALE', 'MARK', 'MASS', 'MEAL', 'MEAN', 'MEAT', 'MEET', 'MEND', 'MILE',
            'MILK', 'MIND', 'MINE', 'MISS', 'MIX', 'MOOD', 'MOON', 'MOVE', 'MUD', 'MUST',
            'NAME', 'NEAR', 'NECK', 'NEED', 'NEST', 'NEWS', 'NEXT', 'NICE', 'NIGHT', 'NODE',
            'NOISE', 'NONE', 'NOON', 'NOTE', 'OPEN', 'PACE', 'PACK', 'PAGE', 'PAIN', 'PAIR',
            'PALE', 'PALM', 'PARK', 'PART', 'PASS', 'PAST', 'PATH', 'PEACE', 'PEAK', 'PICK',
            'PILE', 'PINE', 'PINK', 'PIPE', 'PLAN', 'PLAY', 'PLOT', 'PLUS', 'POLE', 'POOL',
            'POOR', 'PORT', 'POST', 'POUR', 'PRAY', 'PULL', 'PUMP', 'PURE', 'PUSH', 'QUACK',
            'QUAD', 'QUAIL', 'QUAKE', 'QUART', 'QUEEN', 'QUEST', 'QUICK', 'QUIET', 'QUILL',
            'QUILT', 'QUITE', 'QUOTE', 'RACE', 'RAIN', 'RAKE', 'RANK', 'RATE', 'READ', 'REAR',
            'REED', 'REST', 'RICE', 'RIDE', 'RING', 'RISE', 'ROAD', 'ROCK', 'ROLE', 'ROLL',
            'ROOF', 'ROOM', 'ROOT', 'ROPE', 'ROSE', 'RULE', 'RUN', 'RUSH', 'SAFE', 'SAIL',
            'SALE', 'SALT', 'SAND', 'SAVE', 'SEAT', 'SEED', 'SEEK', 'SEEM', 'SELF', 'SELL',
            'SEND', 'SENSE', 'SET', 'SHIP', 'SHOP', 'SHOT', 'SHOW', 'SHUT', 'SICK', 'SIDE',
            'SIGN', 'SILK', 'SING', 'SINK', 'SITE', 'SIZE', 'SKIN', 'SKIP', 'SLIP', 'SLOW',
            'SNAP', 'SNOW', 'SOFT', 'SOIL', 'SOLD', 'SOLE', 'SONG', 'SOON', 'SORT', 'SOUL',
            'SPOT', 'STAR', 'STAY', 'STEP', 'STOP', 'SUCH', 'SUIT', 'SURE', 'SWAP', 'SWIM',
            'TAIL', 'TAKE', 'TALE', 'TALK', 'TALL', 'TANK', 'TAPE', 'TASK', 'TEAM', 'TELL',
            'TEND', 'TENT', 'TERM', 'TEST', 'TEXT', 'THAN', 'THAT', 'THEM', 'THEN', 'THIN',
            'THIS', 'TIDE', 'TILE', 'TIME', 'TIRE', 'TONE', 'TOOL', 'TOUR', 'TOWN', 'TRAP',
            'TREE', 'TRIP', 'TRUE', 'TUNE', 'TURN', 'TYPE', 'UNIT', 'VAST', 'VEIL', 'VIEW',
            'VOTE', 'WAGE', 'WAIT', 'WAKE', 'WALK', 'WALL', 'WANT', 'WARM', 'WASH', 'WAVE',
            'WEAK', 'WEAR', 'WEEK', 'WELL', 'WEST', 'WHAT', 'WHEN', 'WHIP', 'WIDE', 'WIFE',
            'WILD', 'WILL', 'WIND', 'WINE', 'WING', 'WIPE', 'WIRE', 'WISE', 'WISH', 'WITH',
            'WOOD', 'WORD', 'WORK', 'YARD', 'YEAR', 'YELL', 'YET', 'YOUR', 'ZONE'
        ];
        
        return examples.filter(word => {
            if (!word.includes(centerLetter)) return false;
            for (const letter of word) {
                if (!letters.includes(letter)) return false;
            }
            return true;
        });
    }

    function renderLetters() {
        centerLetterEl.textContent = letters[0];
        centerLetterEl.onclick = () => selectLetter(letters[0]);
        
        for (let i = 0; i < 6; i++) {
            letterElements[i].textContent = letters[i + 1];
            letterElements[i].onclick = () => selectLetter(letters[i + 1]);
        }
    }

    function selectLetter(letter) {
        if (gameOver) return;
        currentWord.push(letter);
        updateCurrentWord();
    }

    function updateCurrentWord() {
        currentWordEl.textContent = currentWord.join('');
    }

    function updateRank() {
        const wordCount = foundWords.length;
        // NYT-style rank progression
        if (score >= 100) {
            rank = "Genius";
            if (!gameOver) {
                gameOver = true;
                showGameOver();
            }
        } else if (score >= 70) {
            rank = "Amazing";
        } else if (score >= 50) {
            rank = "Great";
        } else if (score >= 30) {
            rank = "Nice";
        } else if (score >= 20) {
            rank = "Solid";
        } else if (score >= 10) {
            rank = "Good";
        } else if (score >= 5) {
            rank = "Moving Up";
        } else {
            rank = "Beginner";
        }
        rankEl.textContent = `Rank: ${rank}`;
    }

    async function submitWord() {
        if (gameOver) return;

        const word = currentWord.join('');
        
        // Basic validation
        if (word.length < 4) {
            showFeedback('error', 'Word must be at least 4 letters');
            return;
        }
        
        if (!word.includes(centerLetter)) {
            showFeedback('error', 'Must use the center letter');
            return;
        }
        
        if (foundWords.includes(word)) {
            showFeedback('error', 'You already found this word');
            return;
        }
        
        // Check if word is valid
        const isValid = await validateWord(word);
        if (isValid) {
            // Calculate score
            let wordScore = Math.max(1, word.length - 3);
            const isPangram = word.split('').filter((l, i, arr) => arr.indexOf(l) === i).length === 7;
            if (isPangram) {
                wordScore += 7;
                showFeedback('success', `Pangram! +${wordScore} points!`);
            } else {
                showFeedback('success', `+${wordScore} points!`);
            }
            
            // Update game state
            score += wordScore;
            foundWords.push(word);
            updateFoundWords();
            updateRank(); // Check for "Genius" rank
            scoreEl.textContent = `Score: ${score}`;
            scoreEl.classList.add('score-update');
            setTimeout(() => scoreEl.classList.remove('score-update'), 500);
            
            // Clear current word
            currentWord = [];
            updateCurrentWord();
        } else {
            showFeedback('error', 'Not a valid word');
        }
    }

    function updateFoundWords() {
        wordsList.innerHTML = '';
        foundWords.sort((a, b) => b.length - a.length).forEach(word => {
            const wordEl = document.createElement('div');
            wordEl.className = 'word-item';
            const isPangram = word.split('').filter((l, i, arr) => arr.indexOf(l) === i).length === 7;
            if (isPangram) {
                wordEl.classList.add('pangram');
            }
            wordEl.textContent = word;
            wordsList.appendChild(wordEl);
        });
    }

    function showGameOver() {
        gameOverScore.textContent = `Final Score: ${score}`;
        gameOverWords.textContent = `Words Found: ${foundWords.join(', ')}`;
        gameOverModal.style.display = 'block';
    }

    function showHint() {
        if (gameOver) {
            showFeedback('info', 'Game over! Start a new game to continue.');
            return;
        }
        const remainingWords = allPossibleWords.filter(w => !foundWords.includes(w));
        if (remainingWords.length > 0) {
            const hintWord = remainingWords.reduce((a, b) => a.length > b.length ? a : b);
            const hint = hintWord.slice(0, 2);
            showFeedback('hint', `Try starting with: ${hint}...`);
        } else {
            showFeedback('hint', `Try combining the center letter (${centerLetter}) with other letters!`);
        }
    }

    function showFeedback(type, message) {
        feedbackEl.textContent = message;
        feedbackEl.className = `spelling-feedback ${type}`;
    }

    function clearCurrentWord() {
        if (gameOver) return;
        currentWord = [];
        updateCurrentWord();
    }

    function shuffleLetters() {
        if (gameOver) return;
        letters = [letters[0], ...shuffleArray(letters.slice(1))];
        renderLetters();
    }

    function giveUp() { // NEW
        gameOver = true;
        showGameOver();
    }

    // Helper functions
    function getRandomLetter(letterArray) {
        return letterArray[Math.floor(Math.random() * letterArray.length)];
    }

    function shuffleArray(array) {
        return array.sort(() => Math.random() - 0.5);
    }

    // Event listeners
    submitBtn.addEventListener('click', submitWord);
    clearBtn.addEventListener('click', clearCurrentWord);
    shuffleBtn.addEventListener('click', shuffleLetters);
    newBtn.addEventListener('click', initGame);
    hintBtn.addEventListener('click', showHint);
    giveUpBtn.addEventListener('click', giveUp); // NEW
    playAgainBtn.addEventListener('click', initGame);
}