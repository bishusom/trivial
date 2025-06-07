export function initWordGame() {
  // Load saved state
  const savedState = loadGameState();
  let difficulty = savedState?.difficulty || 'easy';
  let consecutiveWins = savedState?.consecutiveWins || 0;
  let currentLevel = savedState?.currentLevel || 1;
  let score = 0;
  let timer = 0;
  let timerInterval = null;

  // Game configuration
  const config = {
    wordLength: {
      easy: 5,
      medium: 6,
      hard: 7
    },
    timeLimit: {
      easy: 300,   // 5 minutes
      medium: 240, // 4 minutes
      hard: 180    // 3 minutes
    },
    scorePerStep: {
      easy: 50,
      medium: 75,
      hard: 100
    },
    bonusPerSecond: 5, // Bonus points per second remaining
    maxHints: 3
  };

  // Word lists by length
  const wordLists = {
    4: [
      'COLD', 'WARM', 'CORD', 'CARD', 'WARD', 'WORD', 'WORM', 'FARM', 'FIRE', 'FIVE', 'FINE', 'LINE', 'LION', 'LOAN', 'LOIN', 'RAIN', 'MAIN', 'MAID', 'MILD', 'MIND',
      'BAND', 'LAND', 'SAND', 'HAND', 'FANS', 'PANS', 'TANS', 'CANS', 'BANS', 'RING', 'SING', 'WING', 'KING', 'PING', 'BONG', 'SONG', 'LONG', 'TONG', 'GONE',
      'CONE', 'BONE', 'TONE', 'HONE', 'LOVE', 'MOVE', 'COVE', 'DOVE', 'ROVE', 'SAVE', 'WAVE', 'CAVE', 'GAVE', 'HAVE', 'LIVE', 'GIVE', 'DIVE', 'HIVE', 'JIVE',
      'BARK', 'PARK', 'DARK', 'LARK', 'MARK', 'CAKE', 'FAKE', 'LAKE', 'MAKE', 'RAKE', 'TAKE', 'WAKE', 'SNAKE', 'STAKE', 'BALE', 'GALE', 'MALE', 'PALE', 'SALE'
    ],
    5: [
      'APPLE', 'AMPLY', 'AMBLE', 'ABLED', 'ABIDE', 'BRICK', 'TRICK', 'QUICK', 'SLICK', 'FLICK', 'CLICK', 'STICK', 'THICK', 'PRICK', 'CRACK', 'TRACK', 'STACK',
      'BLACK', 'SLACK', 'SNACK', 'RINGS', 'SINGS', 'WINGS', 'KINGS', 'PINGS', 'BLOOM', 'GLOOM', 'BROOM', 'ROOMY', 'DOOMY', 'FLOOD', 'BLOOD', 'MOODY', 'GOODY',
      'CANDY', 'HANDY', 'SANDY', 'BANDY', 'RANDY', 'SHINE', 'SPINE', 'TWINE', 'VINEY', 'WINEY', 'CLONE', 'DRONE', 'PRONE', 'STONE', 'PHONE', 'ALONE', 'BONES',
      'CONES', 'TONES', 'HONES', 'ZONES', 'LOVES', 'MOVES', 'COVES', 'DOVES', 'ROVES', 'SAVES', 'WAVES', 'CAVES', 'GIVES', 'LIVES'
    ],
    6: [
      'CANNON', 'CANTON', 'CANTOR', 'CAPTOR', 'BLOOMS', 'GLOOMS', 'BROOMS', 'ROOMS', 'DOOMS', 'FLOODS', 'BLOODS', 'MOODS',
      'GOODS', 'HOODS', 'WOODS', 'STANDS', 'BRANDS', 'GRANDS', 'HANDS', 'LANDS', 'SANDS', 'SHINES', 'SPINES', 'VINES', 'WINES', 'LINES', 'MINES', 'PINES',
      'FINES', 'DINES', 'CLONES', 'DRONES', 'PRONES', 'STONES', 'PHONES', 'ZONES', 'ALONES', 'CONING', 'COMING', 'HOMING', 'FARMER', 'HARMER', 'WARMER',
      'MARKET', 'PARKET', 'TICKET', 'PICKET', 'WICKET', 'CRYPTO', 'SCRIPT', 'BRIGHT', 'FLIGHT', 'SLIGHT', 'PLIGHT', 'NIGHTS', 'LIGHTS'
    ]
  };

  // Game state
  let startWord = '';
  let endWord = '';
  let currentWord = '';
  let ladderWords = [];
  let usedWords = new Set();
  let usedPairs = new Set();
  let wordCache = new Map();
  let hintsUsed = 0;
  let gameActive = false;
  let selectedLetterIndex = -1;

  // Sound effects
  const audioElements = {
    select: new Audio('/audio/click.mp3'),
    found: new Audio('/audio/correct.mp3'),
    win: new Audio('/audio/win.mp3'),
    error: new Audio('/audio/wrong.mp3')
  };

  // Mute state
  let isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;

  // DOM elements
  const currentWordElement = document.getElementById('current-word-display');
  const letterTilesElement = document.getElementById('letter-tiles');
  const wordListElement = document.getElementById('word-ladder-list');
  const feedbackElement = document.getElementById('word-ladder-feedback');
  const newGameBtn = document.getElementById('word-ladder-new');
  const hintBtn = document.getElementById('word-ladder-hint');
  const timeElement = document.getElementById('word-ladder-time') || createTimeElement();
  const scoreElement = document.getElementById('word-ladder-score');
  const levelElement = document.getElementById('word-ladder-level');
  const startWordElement = document.getElementById('start-word');
  const endWordElement = document.getElementById('end-word');
  const muteBtnIcon = document.querySelector('#mute-btn .material-icons');
  const muteBtn = document.getElementById('mute-btn');

  // Function to play sound
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

  // Function to stop sound
  function stopSound(type) {
    if (audioElements[type]) {
      audioElements[type].pause();
      audioElements[type].currentTime = 0;
    }
  }

  // Function to stop all sounds
  function stopAllSounds() {
    Object.keys(audioElements).forEach(type => stopSound(type));
  }

  // Function to load and apply mute state
  function loadMuteState() {
    isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;
    if (muteBtnIcon) {
      muteBtnIcon.textContent = isMuted ? 'volume_off' : 'volume_up';
    }
    if (isMuted) {
      stopAllSounds();
    }
  }

  function createTimeElement() {
    const element = document.createElement('div');
    element.id = 'word-ladder-time';
    element.className = 'word-game-timer';
    document.querySelector('.word-game-meta')?.appendChild(element);
    return element;
  }

  function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
      gtag('event', action, { event_category: category, event_label: label, value: value });
    }
  }

  function saveGameState() {
    const gameState = {
      difficulty,
      consecutiveWins,
      currentLevel
    };
    localStorage.setItem('wordLadderGameState', JSON.stringify(gameState));
  }

  function loadGameState() {
    const savedState = localStorage.getItem('wordLadderGameState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (['easy', 'medium', 'hard'].includes(parsed.difficulty) &&
            typeof parsed.consecutiveWins === 'number' &&
            typeof parsed.currentLevel === 'number') {
          return parsed;
        }
      } catch (e) {
        console.error('Invalid saved game state', e);
      }
    }
    return null;
  }

  // Initialize the game
  initGame();
  loadMuteState();

  async function initGame() {
    console.log('Initializing Word Ladder game with state:', { difficulty, currentLevel, consecutiveWins });
    showLoadingAnimation();
    clearInterval(timerInterval);
    timer = config.timeLimit[difficulty];
    score = 0;
    ladderWords = [];
    usedWords.clear();
    wordCache.clear();
    hintsUsed = 0;
    gameActive = true;
    selectedLetterIndex = -1;

    // Clear previous game
    currentWordElement.innerHTML = '';
    letterTilesElement.innerHTML = '';
    wordListElement.innerHTML = '';
    showFeedback('', 'info');
    updateScore();
    updateLevelInfo();
    updateTimer();

    const wordLength = config.wordLength[difficulty];

    try {
      await initGameWithFirebaseWords(wordLength);
    } catch (error) {
      console.error('Error using Firebase words:', error);
      showErrorAnimation();
      setTimeout(() => {
        initGameWithLocalWords(wordLength).catch(() => {
          showFinalErrorAnimation();
        });
      }, 2000);
    }
  }

  async function initGameWithFirebaseWords(wordLength) {
    console.log('Fetching word ladder from Firebase...');
    
    // Get a random ladder of appropriate difficulty
    const snapshot = await db.collection('wordLadders')
      .where('length', '==', wordLength)
      .where('difficulty', '==', difficulty)
      .limit(100)
      .get();

    if (snapshot.empty) throw new Error('No ladders found');
    
    const ladders = snapshot.docs.map(doc => doc.data());
    const randomLadder = ladders[Math.floor(Math.random() * ladders.length)];
    
    // Set game state
    startWord = randomLadder.startWord.toUpperCase();
    endWord = randomLadder.endWord.toUpperCase();
    currentWord = startWord;
    ladderWords = [startWord];
    usedWords = new Set([startWord]);

    // Display
    startWordElement.textContent = startWord;
    endWordElement.textContent = endWord;
    renderCurrentWord();
    renderWordList();
    
    // Store full solution path (for hints)
    window.currentSolutionPath = randomLadder.path.map(w => w.toUpperCase());
  }

  async function initGameWithLocalWords(wordLength) {
    const availableWords = wordLists[wordLength];

    let validPair = false;
    let attempts = 0;
    const maxAttempts = 50;

    while (!validPair && attempts < maxAttempts) {
      startWord = availableWords[Math.floor(Math.random() * availableWords.length)];
      const startTransformations = await getValidTransformations(startWord);

      if (startTransformations.length === 0) {
        attempts++;
        continue;
      }

      let endWordCandidates = [];
      for (const word of availableWords) {
        if (word !== startWord) {
          const path = await findWordLadderPath(startWord, word, 2);
          if (path && path.length >= 3) {
            endWordCandidates.push(word);
          }
        }
      }

      if (endWordCandidates.length > 0) {
        endWord = endWordCandidates[Math.floor(Math.random() * endWordCandidates.length)];
        const pairKey = `${startWord}-${endWord}`;
        if (!usedPairs.has(pairKey)) {
          validPair = true;
          usedPairs.add(pairKey);
        }
      }

      attempts++;
    }

    if (!validPair) {
      const fallbackSequences = {
        4: [
          ['COLD', 'CORD', 'CARD', 'WARD', 'WARM'],
          ['FIRE', 'FIVE', 'FINE', 'LINE', 'LION']
        ],
        5: [
          ['APPLE', 'AMPLY', 'AMBLE', 'ABLED', 'ABIDE'],
          ['BRICK', 'TRICK', 'TRACK', 'TRUCK', 'TRUNK']
        ],
        6: [
          ['CANNON', 'CANTON', 'CANTOR', 'CAPTOR'],
          ['FARMER', 'HARMER', 'HAMMER', 'HUMMER', 'HUMPER']
        ]
      };

      const sequences = fallbackSequences[wordLength] || [];
      for (const sequence of sequences) {
        const pairKey = `${sequence[0]}-${sequence[sequence.length-1]}`;
        if (!usedPairs.has(pairKey)) {
          startWord = sequence[0];
          endWord = sequence[sequence.length-1];
          usedPairs.add(pairKey);
          validPair = true;
          break;
        }
      }

      if (!validPair) {
        startWord = wordLists[wordLength][0];
        endWord = wordLists[wordLength][1];
      }
    }

    currentWord = startWord;
    ladderWords.push(startWord);
    usedWords.add(startWord);

    // Display words
    startWordElement.textContent = startWord;
    endWordElement.textContent = endWord;
    renderCurrentWord();
    renderLetterTiles();
    renderWordList();

    // Start timer
    startTimer();
    showFeedback('Game started! Transform the start word to the end word.', 'info');
    trackEvent('word_ladder_game_started', 'word_ladder', 'start', 1);
  }

  async function findWordLadderPath(start, end, minSteps) {
    if (canTransformTo(start, end)) {
      return [start, end];
    }

    const queue = [[start]];
    const visited = new Set([start]);
    let iterations = 0;

    while (queue.length > 0 && iterations < 1000) {
      iterations++;
      const path = queue.shift();
      const current = path[path.length - 1];

      if (current === end) {
        return path.length - 1 >= minSteps ? path : null;
      }

      const transformations = await getValidTransformations(current);
      for (const word of transformations) {
        if (!visited.has(word)) {
          visited.add(word);
          queue.push([...path, word]);
        }
      }
    }
    return null;
  }

  function renderCurrentWord() {
    currentWordElement.innerHTML = '';
    for (let i = 0; i < currentWord.length; i++) {
      const letterSpan = document.createElement('span');
      letterSpan.textContent = currentWord[i];
      letterSpan.classList.add('letter-tile');
      if (i === selectedLetterIndex) {
        letterSpan.classList.add('selected');
      }
      letterSpan.addEventListener('click', () => {
        selectLetter(i);
      });
      currentWordElement.appendChild(letterSpan);
    }
  }

  function renderLetterTiles() {
    letterTilesElement.innerHTML = '';
    if (selectedLetterIndex === -1) return;

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const letter of alphabet) {
      const tile = document.createElement('div');
      tile.textContent = letter;
      tile.classList.add('letter-tile');
      tile.addEventListener('click', () => {
        changeLetter(letter);
      });
      letterTilesElement.appendChild(tile);
    }
  }

  function selectLetter(index) {
    selectedLetterIndex = index;
    playSound('select');
    renderCurrentWord();
    renderLetterTiles();
  }

  async function changeLetter(newLetter) {
    if (selectedLetterIndex === -1 || !gameActive) return;

    const newWord = currentWord.substring(0, selectedLetterIndex) + 
                   newLetter + 
                   currentWord.substring(selectedLetterIndex + 1);

    if (await checkWord(newWord)) {
      currentWord = newWord;
      ladderWords.push(newWord);
      usedWords.add(newWord);

      const points = config.scorePerStep[difficulty];
      score += points;
      updateScore();
      renderWordList();
      playSound('found');

      if (newWord === endWord) {
        const timeBonus = timer * config.bonusPerSecond;
        score += timeBonus;
        updateScore();

        clearInterval(timerInterval);
        gameActive = false;
        showFeedback(`You won! +${points} points + ${timeBonus} time bonus`, 'success');
        playSound('win');
        trackEvent('word_ladder_won', 'word_ladder', 'win', score);
        handleGameWin();
      } else {
        showFeedback(`Valid: ${newWord} (+${points} points)`, 'success');
      }

      selectedLetterIndex = -1;
      renderCurrentWord();
      renderLetterTiles();
    }
  }

  function renderWordList() {
    wordListElement.innerHTML = '';
    ladderWords.forEach(word => {
      const li = document.createElement('li');
      li.textContent = word;
      wordListElement.appendChild(li);
    });
  }

  function updateScore() {
    scoreElement.textContent = `Score: ${score}`;
  }

  function updateLevelInfo() {
    levelElement.textContent = `Level: ${currentLevel} (${difficulty})`;
  }

  function updateTimer() {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    timeElement.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    if (timer <= 0 && gameActive) {
      clearInterval(timerInterval);
      gameActive = false;
      showFeedback('Time\'s up!', 'error');
      playSound('error');
      setTimeout(initGame, 2000);
    }
  }

  function startTimer() {
    clearInterval(timerInterval);
    timer = config.timeLimit[difficulty];
    updateTimer();
    timerInterval = setInterval(() => {
      timer--;
      updateTimer();
    }, 1000);
  }

  function showFeedback(message, type) {
    feedbackElement.textContent = message;
    feedbackElement.className = `word-feedback ${type}`;
    if (type === 'error') {
      playSound('error');
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

  function showErrorAnimation() {
    feedbackElement.innerHTML = `
      <div class="error-animation">
        <div class="error-icon">⚠️</div>
        <div class="loading-text">Setting up the board</div>
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    feedbackElement.className = 'word-feedback error';
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

  async function checkWord(word) {
    if (!gameActive) return false;

    if (word.length !== currentWord.length) {
      showFeedback(`Word must be ${currentWord.length} letters long`, 'error');
      return false;
    }

    if (word === currentWord) {
      showFeedback('Word must be different from current word', 'error');
      return false;
    }

    if (usedWords.has(word)) {
      showFeedback('Word already used in this ladder', 'error');
      return false;
    }

    let diffCount = 0;
    for (let i = 0; i < currentWord.length; i++) {
      if (currentWord[i] !== word[i]) diffCount++;
      if (diffCount > 1) {
        showFeedback('Only one letter can be changed at a time', 'error');
        return false;
      }
    }

    let isValid = false;
    if (wordCache.has(word.toLowerCase())) {
      isValid = wordCache.get(word.toLowerCase());
    } else {
      try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
        isValid = response.ok;
        wordCache.set(word.toLowerCase(), isValid);
      } catch (error) {
        isValid = wordLists[word.length].includes(word.toUpperCase());
        wordCache.set(word.toLowerCase(), isValid);
      }
    }

    if (!isValid) {
      showFeedback('Not a valid English word', 'error');
      return false;
    }

    return true;
  }

  async function getValidTransformations(word) {
    const transformations = [];
    const wordLength = word.length;
    const availableWords = wordLists[wordLength];

    for (const candidate of availableWords) {
      let diffCount = 0;
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== candidate[i]) diffCount++;
        if (diffCount > 1) break;
      }
      if (diffCount === 1) {
        transformations.push(candidate);
      }
    }

    return transformations;
  }

  function canTransformTo(word1, word2) {
    let diffCount = 0;
    for (let i = 0; i < word1.length; i++) {
      if (word1[i] !== word2[i]) diffCount++;
      if (diffCount > 1) return false;
    }
    return diffCount === 1;
  }

  async function provideHint() {
    if (!gameActive || hintsUsed >= config.maxHints) {
      showFeedback('No more hints available', 'error');
      return;
    }

    // Find where player is in the solution path
    const currentIndex = window.currentSolutionPath.indexOf(currentWord);
    if (currentIndex === -1 || currentIndex >= window.currentSolutionPath.length - 1) {
      showFeedback('No hints available for this step', 'error');
      return;
    }

    const nextWord = window.currentSolutionPath[currentIndex + 1];
    let changeIndex = -1;
    
    // Find which letter changes
    for (let i = 0; i < currentWord.length; i++) {
      if (currentWord[i] !== nextWord[i]) {
        changeIndex = i;
        break;
      }
    }

    hintsUsed++;
    
    if (changeIndex !== -1) {
      selectLetter(changeIndex);
      showFeedback(
        `Change ${ordinal(changeIndex + 1)} letter to ${nextWord[changeIndex]} (→ ${nextWord})`, 
        'info'
      );
    } else {
      showFeedback(`Next step: ${nextWord}`, 'info');
    }
  }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function canLeadToSolution(word) {
    let matchingLetters = 0;
    for (let i = 0; i < word.length; i++) {
      if (word[i] === endWord[i]) matchingLetters++;
    }
    return matchingLetters >= countMatchingLetters(currentWord, endWord);
  }

  function countMatchingLetters(word1, word2) {
    let count = 0;
    for (let i = 0; i < word1.length; i++) {
      if (word1[i] === word2[i]) count++;
    }
    return count;
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

  function handleGameWin() {
    consecutiveWins++;
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
        victoryMessage = `🎉 Advanced to Hard level! 🎉`;
      } else {
        victoryMessage = `🎉 Mastered Hard level! Continuing at max difficulty. 🎉`;
      }

      if (levelUp) {
        consecutiveWins = 0;
        setTimeout(() => showConfetti({ particleCount: 200, spread: 100 }), 1000);
      }
    } else {
      victoryMessage = `🎉 Level ${currentLevel} Complete! 🎉`;
    }

    const victoryScreen = document.createElement('div');
    victoryScreen.className = 'victory-screen';
    victoryScreen.innerHTML = `
      <h2>Victory!</h2>
      <p>${victoryMessage}</p>
      <p>Words Used: ${ladderWords.length}</p>
      <p>Score: ${score}</p>
      <div class="countdown">Proceeding to the next level in 5...</div>
    `;
    document.body.appendChild(victoryScreen);

    showConfetti();

    let countdown = 5;
    const countdownElement = victoryScreen.querySelector('.countdown');
    const countdownInterval = setInterval(() => {
      countdown--;
      countdownElement.textContent = `Proceeding to the next level in ${countdown}...`;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        victoryScreen.remove();
        currentLevel++;
        saveGameState();
        updateLevelInfo();
        initGame();
      }
    }, 1000);

    trackEvent('level_complete', 'word_ladder', difficulty, score);
  }

  // Event listeners
  newGameBtn.addEventListener('click', () => {
    usedPairs.clear();
    initGame();
  });
  hintBtn.addEventListener('click', provideHint);

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      localStorage.setItem('triviaMasterMuteState', isMuted);
      if (muteBtnIcon) {
        muteBtnIcon.textContent = isMuted ? 'volume_off' : 'volume_up';
      }
      if (isMuted) {
        stopAllSounds();
      }
      playSound('select');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initWordGame();
  });
}