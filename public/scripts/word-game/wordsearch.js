export function initWordGame() {
  // Load saved state BEFORE setting defaults
  const savedState = loadGameState();
  let difficulty = savedState?.difficulty || 'easy';
  let consecutiveWins = savedState?.consecutiveWins || 0;
  let currentLevel = savedState?.currentLevel || 1;

  // Game configuration based on difficulty
  const config = {
    easy: { gridCols: 6, gridRows: 8, minWordLength: 3, maxWordLength: 5, wordCount: 6, timeLimit: 240 },
    medium: { gridCols: 8, gridRows: 10, minWordLength: 4, maxWordLength: 7, wordCount: 8, timeLimit: 300 },
    hard: { gridCols: 10, gridRows: 10, minWordLength: 5, maxWordLength: 8, wordCount: 10, timeLimit: 500 },
    maxPlacementAttempts: 200, // Per word
    maxTotalAttempts: 1000, // Total attempts across all words
    maxRetries: 3 // Limit retries to avoid infinite loops
  };

  // Game state
  let grid = [];
  let words = [];
  let foundWords = [];
  let selectedCells = [];
  let isSelecting = false;
  let usedWordsInGame = new Set();
  let retryCount = 0;
  let directionCounts = { horizontal: 0, vertical: 0, diagonal: 0 };
  let timer = config[difficulty].timeLimit;
  let timerInterval = null;
  const timeElement = document.getElementById('wordsearch-time') || createTimeElement();

  // DOM elements
  const gridElement = document.getElementById('wordsearch-grid');
  const wordListElement = document.getElementById('wordsearch-wordlist');
  const wordsLeftElement = document.getElementById('wordsearch-words-left');
  let feedbackElement = document.getElementById('wordsearch-feedback');
  const newGameBtn = document.getElementById('wordsearch-new');
  const hintBtn = document.getElementById('wordsearch-hint');
  const levelElement = document.getElementById('wordsearch-level');
  const gamesRemainingElement = document.getElementById('wordsearch-games-remaining');
  const muteBtnIcon = document.querySelector('#mute-btn .material-icons'); // Changed from muteBtn to muteBtnIcon

  // Sound effects
  const audioElements = { // Renamed to avoid conflict and better describe
    select: new Audio('/audio/click.mp3'),
    found: new Audio('/audio/correct.mp3'),
    win: new Audio('/audio/win.mp3'),
    error: new Audio('/audio/wrong.mp3')
  };

  // Mute state
  let isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false; // Initial mute state from localStorage

  // Function to play sound
  function playSound(type) {
    if (isMuted) {
      console.log(`Sound ${type} skipped: muted`);
      return;
    }
    console.log(`Playing sound: ${type}`);
    // Ensure the audio element exists and can be played
    if (audioElements[type]) {
      audioElements[type].currentTime = 0; // Reset to start
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

  // Function to load and apply mute state from localStorage
  function loadMuteState() {
    isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;
    if (muteBtnIcon) {
      muteBtnIcon.textContent = isMuted ? 'volume_off' : 'volume_up';
    }
    if (isMuted) {
      stopAllSounds();
    }
  }

  function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
      gtag('event', action, { event_category: category, event_label: label, value: value });
    }
  }

  function createTimeElement() {
    const element = document.createElement('div');
    element.id = 'wordsearch-time';
    element.className = 'word-game-timer';
    document.querySelector('.word-game-meta').appendChild(element);
    return element;
  }

  function startTimer() {
    clearInterval(timerInterval);
    timer = config[difficulty].timeLimit;
    updateTimer();
    timerInterval = setInterval(() => {
        timer--;
        updateTimer();
        if (timer <= 0) {
        clearInterval(timerInterval);
        showFeedback('Time\'s up!', 'error');
        setTimeout(initGame, 2000);
        }
    }, 1000);
}

function updateTimer() {
  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;
  timeElement.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

  // Create fallback feedback element if missing
  if (!feedbackElement) {
    feedbackElement = document.createElement('div');
    feedbackElement.id = 'wordsearch-feedback';
    feedbackElement.className = 'word-feedback';
    document.querySelector('.game-body').appendChild(feedbackElement);
  }

  // Add level info to game meta
  const gameMeta = document.querySelector('.word-game-meta');
  if (gameMeta) {
    gameMeta.appendChild(levelElement);
    gameMeta.appendChild(gamesRemainingElement);
  }

  updateLevelInfo();

  function saveGameState() {
    const gameState = {
      difficulty,
      consecutiveWins,
      currentLevel
    };
    localStorage.setItem('wordGameState', JSON.stringify(gameState));
  }

  function loadGameState() {
    const savedState = localStorage.getItem('wordGameState');
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
  loadMuteState(); // Load mute state on game initialization

  async function initGame() {
    console.log('Initializing game with state:', { difficulty, currentLevel, consecutiveWins });
    showLoadingAnimation();
    showFeedback('', 'info');
    gridElement.innerHTML = '';
    wordListElement.innerHTML = '';
    selectedCells = [];
    foundWords = [];
    isSelecting = false;
    usedWordsInGame.clear();
    directionCounts = { horizontal: 0, vertical: 0, diagonal: 0 };

    // Ensure levelElement is still in the DOM
    const gameMeta = document.querySelector('.word-game-meta');
    if (gameMeta && !document.getElementById('wordsearch-level')) {
      gameMeta.appendChild(levelElement);
      gameMeta.appendChild(gamesRemainingElement);
    }
    updateLevelInfo();

    try {
      // Generate words from Firebase
      words = await generateWordList(config[difficulty]);
      words.sort((a, b) => b.letters.length - a.letters.length);
      console.log('Words fetched and sorted:', words);

      let placedSuccessfully = false;
      let totalGameAttempts = 0;
      const maxGameAttempts = 3;

      while (!placedSuccessfully && totalGameAttempts < maxGameAttempts) {
        totalGameAttempts++;
        console.log(`Attempt ${totalGameAttempts} to place all words`);

        // Initialize grid based on difficulty
        grid = Array(config[difficulty].gridCols * config[difficulty].gridRows).fill().map(() => ({
          letter: '',
          element: null,
          word: null
        }));

        const placedWords = [];
        let totalAttempts = 0;
        let availableWords = [...words];

        // Calculate direction quotas
        const totalWords = config[difficulty].wordCount;
        const minPerDirection = Math.floor(totalWords / 3);
        const directionQuotas = {
          horizontal: minPerDirection,
          vertical: minPerDirection,
          diagonal: totalWords - 2 * minPerDirection
        };

        // Main placement loop
        while (placedWords.length < config[difficulty].wordCount && totalAttempts < config.maxTotalAttempts) {
          if (availableWords.length === 0) {
            availableWords = [...words].filter(wordObj => !placedWords.some(p => p.word === wordObj.word));
          }

          const wordObj = availableWords[0];
          let placed = false;

          if (tryPlaceWord(wordObj, directionQuotas)) {
            placedWords.push(wordObj);
            usedWordsInGame.add(wordObj.word);
            availableWords.shift();
            placed = true;
          } else {
            availableWords.shift();
            totalAttempts++;
          }
        }

        words = placedWords;

        if (words.length < config[difficulty].wordCount) {
          console.warn(`Only placed ${words.length} out of ${config[difficulty].wordCount} words`);
          const remainingWordsNeeded = config[difficulty].wordCount - words.length;
          const simplerWords = await generateWordList(config[difficulty], remainingWordsNeeded);
          const simplerAvailableWords = simplerWords.filter(wordObj => !usedWordsInGame.has(wordObj.word));
          let simplerAttempts = 0;

          while (words.length < config[difficulty].wordCount && simplerAttempts < config.maxTotalAttempts && simplerAvailableWords.length > 0) {
            const wordObj = simplerAvailableWords[0];
            if (tryPlaceWord(wordObj, directionQuotas)) {
              words.push(wordObj);
              usedWordsInGame.add(wordObj.word);
              simplerAvailableWords.shift();
            } else {
              simplerAvailableWords.shift();
              simplerAttempts++;
            }
          }
        }

        if (words.length === config[difficulty].wordCount) {
          placedSuccessfully = true;
        } else {
          console.warn(`Failed to place all words on attempt ${totalGameAttempts}`);
          usedWordsInGame.clear();
          words = await generateWordList(config[difficulty]);
          words.sort((a, b) => b.letters.length - a.letters.length);
          directionCounts = { horizontal: 0, vertical: 0, diagonal: 0 };
        }
      }

      if (!placedSuccessfully) {
        throw new Error(`Could only place ${words.length} out of ${config[difficulty].wordCount} words after ${maxGameAttempts} attempts`);
      }

      // Fill empty cells
      fillEmptyCells();

      // Render game
      renderGrid();
      renderWordList();

      updateWordsLeft();
      updateLevelInfo();
      showFeedback(`Find ${words.length} hidden words!`, 'info');
      startTimer();
      retryCount = 0;

    } catch (error) {
      console.error("Game initialization failed:", error);
      //showFeedback("Failed to load puzzle. Retrying...", 'error');
      showErrorAnimation();
      retryCount++;
      if (retryCount >= config.maxRetries) {
        //showFeedback("Failed to load puzzle after multiple attempts. Please refresh the page.", 'error');
        showFinalErrorAnimation();
        return;
      }
      setTimeout(() => {
        const staticWords = [
          'FUNCTION', 'VARIABLE', 'OPERATOR', 'QUERY', 'JAVASCRIPT', 'REACT', 'ANGULAR', 'COMPONENT',
          'MODULE', 'SCRIPT', 'CODING', 'DEBUG', 'ARRAY', 'LOOP', 'METHOD', 'CLASS',
          'STRING', 'NUMBER', 'OBJECT', 'EVENT', 'STYLE', 'DESIGN', 'FORMAT', 'UPDATE',
          'INSERT', 'DELETE', 'SELECT', 'TABLE', 'INDEX', 'FETCH', 'ROUTE', 'SERVER'
        ].filter(word => word.length >= config[difficulty].minWordLength && word.length <= config[difficulty].maxWordLength);
        const uniqueStaticWords = [...new Set(staticWords)]
          .filter(word => !usedWordsInGame.has(word));
        words = shuffleArray(uniqueStaticWords).slice(0, config[difficulty].wordCount)
          .map(word => ({ word, letters: word.split('') }));
        words.sort((a, b) => b.letters.length - a.letters.length);
        initGame();
      }, 2000);
    }
    trackEvent('word_search_started', 'word_search', 1);
  }

  async function generateWordList(diffConfig, limitOverride = null) {
    try {
      const randomFloor = Math.floor(Math.random() * 900000);
      const limit = limitOverride || diffConfig.wordCount;
      const snapshot = await db.collection('dictionary')
        .where('length', '>=', diffConfig.minWordLength)
        .where('length', '<=', diffConfig.maxWordLength)
        .where('randomIndex', '>=', randomFloor)
        .orderBy('randomIndex')
        .limit(limit)
        .get();

      if (snapshot.empty) {
        throw new Error("No words found in dictionary");
      }

      const wordPoolSet = new Set();
      const wordData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.word && data.letters) {
          const word = data.word.toUpperCase();
          if (!usedWordsInGame.has(word)) {
            wordPoolSet.add(word);
            wordData.push({ word, letters: word.split('').map(l => l.toUpperCase()) });
          }
        }
      });

      if (wordPoolSet.size === 0) {
        throw new Error("No valid words found");
      }

      const shuffledWordData = shuffleArray(wordData);
      const finalWords = shuffledWordData.slice(0, limitOverride || diffConfig.wordCount);
      return finalWords;
    } catch (error) {
      console.error("Error fetching words:", error);
      const staticWords = [
        'FUNCTION', 'VARIABLE', 'OPERATOR', 'QUERY', 'JAVASCRIPT', 'REACT', 'ANGULAR', 'COMPONENT',
        'MODULE', 'SCRIPT', 'CODING', 'DEBUG', 'ARRAY', 'LOOP', 'METHOD', 'CLASS',
        'STRING', 'NUMBER', 'OBJECT', 'EVENT', 'STYLE', 'DESIGN', 'FORMAT', 'UPDATE',
        'INSERT', 'DELETE', 'SELECT', 'TABLE', 'INDEX', 'FETCH', 'ROUTE', 'SERVER'
      ].filter(word => word.length >= diffConfig.minWordLength && word.length <= diffConfig.maxWordLength);
      const uniqueStaticWords = [...new Set(staticWords)]
        .filter(word => !usedWordsInGame.has(word));
      const finalWords = shuffleArray(uniqueStaticWords).slice(0, limitOverride || diffConfig.wordCount)
        .map(word => ({ word, letters: word.split('') }));
      return finalWords;
    }
  }

  function tryPlaceWord(wordObj, directionQuotas) {
    const directions = [
      { id: 0, type: 'horizontal', rowStep: 0, colStep: 1 },
      { id: 1, type: 'vertical', rowStep: 1, colStep: 0 },
      { id: 2, type: 'diagonal', rowStep: 1, colStep: 1 },
      { id: 3, type: 'diagonal', rowStep: -1, colStep: 1 }
    ];
    const attemptsPerDirection = 50;

    const neededDirections = directions.filter(dir => {
      if (dir.type === 'horizontal' && directionCounts.horizontal >= directionQuotas.horizontal) return false;
      if (dir.type === 'vertical' && directionCounts.vertical >= directionQuotas.vertical) return false;
      if (dir.type === 'diagonal' && directionCounts.diagonal >= directionQuotas.diagonal) return false;
      return true;
    });

    const directionsToTry = neededDirections.length > 0 ? neededDirections : directions;
    const shuffledDirections = shuffleArray([...directionsToTry]);

    for (const dir of shuffledDirections) {
      for (let i = 0; i < attemptsPerDirection; i++) {
        const maxRow = dir.rowStep === 0 ? config[difficulty].gridRows : config[difficulty].gridRows - wordObj.letters.length * Math.abs(dir.rowStep);
        const maxCol = dir.colStep === 0 ? config[difficulty].gridCols : config[difficulty].gridCols - wordObj.letters.length * Math.abs(dir.colStep);
        const row = Math.floor(Math.random() * maxRow);
        const col = Math.floor(Math.random() * maxCol);

        if (canPlaceWord(wordObj, row, col, dir.id)) {
          placeWord(wordObj, row, col, dir.id);
          if (dir.type === 'horizontal') directionCounts.horizontal++;
          else if (dir.type === 'vertical') directionCounts.vertical++;
          else if (dir.type === 'diagonal') directionCounts.diagonal++;
          return true;
        }
      }
    }
    return false;
  }

  function canPlaceWord(wordObj, row, col, direction) {
    const { letters } = wordObj;
    for (let i = 0; i < letters.length; i++) {
      let r = row, c = col;
      switch (direction) {
        case 0: c += i; break;
        case 1: r += i; break;
        case 2: r += i; c += i; break;
        case 3: r -= i; c += i; break;
      }
      if (r < 0 || r >= config[difficulty].gridRows || c < 0 || c >= config[difficulty].gridCols) {
        return false;
      }
      const index = r * config[difficulty].gridCols + c;
      if (grid[index].letter !== '' && grid[index].letter !== letters[i]) {
        return false;
      }
    }
    return true;
  }

  function placeWord(wordObj, row, col, direction) {
    const { word, letters } = wordObj;
    for (let i = 0; i < letters.length; i++) {
      let r = row, c = col;
      switch (direction) {
        case 0: c += i; break;
        case 1: r += i; break;
        case 2: r += i; c += i; break;
        case 3: r -= i; c += i; break;
      }
      const index = r * config[difficulty].gridCols + c;
      grid[index].letter = letters[i];
      grid[index].word = word;
    }
  }

  function fillEmptyCells() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    grid.forEach((cell, index) => {
      if (cell.letter === '') {
        cell.letter = alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    });
  }

  function renderGrid() {
    gridElement.style.setProperty('--cols', config[difficulty].gridCols);
    gridElement.style.setProperty('--rows', config[difficulty].gridRows);
    gridElement.style.display = 'grid';

    // Determine the base container width (adjust based on screen size or container)
    const containerWidth = Math.min(window.innerWidth, 600); // Cap at 600px or screen width
    const baseCellSize = containerWidth / config[difficulty].gridCols; // Base cell size
    const cellSize = Math.min(baseCellSize, 50); // Cap cell size at 50px for readability

    // Set grid dimensions
    const gridWidth = cellSize * config[difficulty].gridCols;
    const gridHeight = cellSize * config[difficulty].gridRows;

    gridElement.style.width = `${gridWidth}px`;
    gridElement.style.height = `${gridHeight}px`;
    gridElement.style.maxWidth = '100%';
    gridElement.style.overflow = 'hidden';

    gridElement.innerHTML = '';
    grid.forEach((cell, index) => {
      const cellElement = document.createElement('div');
      cellElement.className = 'wordsearch-cell';
      cellElement.textContent = cell.letter;
      cellElement.dataset.index = index;

      // Set cell size dynamically
      cellElement.style.width = `${cellSize}px`;
      cellElement.style.height = `${cellSize}px`;
      cellElement.style.fontSize = `${Math.min(cellSize * 0.6, 16)}px`; // Adjust font size based on cell size
      cellElement.style.borderRadius = '0'; // Remove rounded borders

      cellElement.addEventListener('mousedown', startSelection);
      cellElement.addEventListener('mouseenter', (e) => {
        e.preventDefault();
        continueSelection(e);
        playSound('select'); // Use playSound
      });
      cellElement.addEventListener('mouseup', endSelection);

      cellElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      cellElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      cellElement.addEventListener('touchend', handleTouchEnd);

      gridElement.appendChild(cellElement);
      cell.element = cellElement;
    });
  }

  function renderWordList() {
    wordListElement.innerHTML = '';
    const sortedWords = [...words].sort((a, b) => a.word.localeCompare(b.word));
    sortedWords.forEach(wordObj => {
      const wordElement = document.createElement('div');
      wordElement.className = 'wordsearch-word';
      wordElement.textContent = wordObj.word;
      wordElement.dataset.word = wordObj.word;
      wordListElement.appendChild(wordElement);
    });

    // Ensure word list layout is adjusted for desktop and mobile
    adjustWordListLayout();
  }

  function checkSelectedWord() {
    if (selectedCells.length < config[difficulty].minWordLength) {
      playSound('error'); // Use playSound
      selectedCells = [];
      updateSelection();
      return;
    }

    const selectedWord = selectedCells.map(index => grid[index].letter).join('');
    const reversedWord = selectedWord.split('').reverse().join('');

    const selectedUpper = selectedWord.toUpperCase();
    const reversedUpper = reversedWord.toUpperCase();

    const matchedWordObj = words.find(wordObj =>
      wordObj.word.toUpperCase() === selectedUpper ||
      wordObj.word.toUpperCase() === reversedUpper
    );

    if (matchedWordObj && !foundWords.includes(matchedWordObj.word)) {
      foundWords.push(matchedWordObj.word);
      playSound('found'); // Use playSound

      // Apply different colors to found cells
      const colorIndex = foundWords.length % 4; // Cycle through 4 colors
      const colors = ['#7AFFC3', '#8EC4FA', '#FFD875', '#FF9EE8']; // Green, Ocean Blue, Orange
      const orderedCells = matchedWordObj.word.toUpperCase() === reversedUpper ? selectedCells.reverse() : selectedCells;

      orderedCells.forEach((index, i) => {
        if (i < matchedWordObj.letters.length && grid[index].letter === matchedWordObj.letters[i]) {
          grid[index].element.style.backgroundColor = colors[colorIndex];
          grid[index].element.classList.add('found');
        }
      });

      // Remove the word from the word list
      const wordToRemove = wordListElement.querySelector(`[data-word="${matchedWordObj.word}"]`);
      if (wordToRemove) {
        wordToRemove.remove();
      }

      updateWordsLeft();
      showFeedback(`Found: ${matchedWordObj.word}`, 'success');

      if (foundWords.length === words.length) {
        handleGameWin();
      }
    } else {
      playSound('error'); // Use playSound
      showFeedback('Word not found in list', 'error');
    }

    selectedCells = [];
    updateSelection();
  }

  function handleGameWin() {
    playSound('win'); // Use playSound

    // Create victory screen
    const victoryScreen = document.createElement('div');
    victoryScreen.className = 'victory-screen';

    // Show confetti
    showConfetti();

    consecutiveWins++;
    currentLevel++; // Always increment level

    let victoryMessage = '';
    let levelUp = false; // Add this line to declare the variable

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
        victoryMessage = `👑 Mastered Hard level! Continuing at max difficulty. 👑`;
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
      <div class="countdown">Proceeding to the next level in 5...</div>
    `;

    document.body.appendChild(victoryScreen);

    // Countdown before next game
    let countdown = 5;
    const countdownElement = victoryScreen.querySelector('.countdown');
    const countdownInterval = setInterval(() => {
      countdown--;
      countdownElement.textContent = `Proceeding to the next level in ${countdown}...`;
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        victoryScreen.remove();
        saveGameState();
        updateLevelInfo();
        initGame();
      }
    }, 1000);

    trackEvent('level_complete', 'word_search', difficulty, foundWords.length);
    saveGameState();
    updateLevelInfo();
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
    
    // Add some randomness to the confetti
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

  function updateWordsLeft() {
    wordsLeftElement.textContent = `Words: ${words.length - foundWords.length}/${words.length}`;
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
      showFeedback(`Try looking for a word starting with ${hint}...`, 'info');
    } else {
      showFeedback('You found all words!', 'success');
    }
  }

  function shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function startSelection(e) {
    e.preventDefault();
    isSelecting = true;
    const index = getCellIndex(e.target);
    if (index !== null) {
      selectedCells = [index];
      updateSelection();
      playSound('select'); // Use playSound
    }
  }

  function continueSelection(e) {
    e.preventDefault();
    if (!isSelecting || selectedCells.length === 0) return;

    const index = getCellIndex(e.target);
    if (index === null || selectedCells.includes(index)) return;

    const lastIndex = selectedCells[selectedCells.length - 1];
    const size = config[difficulty].gridCols;
    
    // For first 2 cells, be very permissive
    if (selectedCells.length < 2) {
        const row1 = Math.floor(lastIndex / size);
        const col1 = lastIndex % size;
        const row2 = Math.floor(index / size);
        const col2 = index % size;
        
        // Allow any adjacent cell (including diagonals)
        if (Math.abs(row2 - row1) <= 1 && Math.abs(col2 - col1) <= 1) {
            selectedCells.push(index);
            updateSelection();
        }
        return;
    }

    // For subsequent cells, enforce direction strictly
    const direction = getSelectionDirection();
    if (!direction) return;

    // Calculate expected next position
    const lastRow = Math.floor(lastIndex / size);
    const lastCol = lastIndex % size;
    const currentRow = Math.floor(index / size);
    const currentCol = index % size;

    // Check if moving in same direction
    if ((currentRow - lastRow === direction.row) && 
        (currentCol - lastCol === direction.col)) {
        selectedCells.push(index);
        updateSelection();
    }
  }

  function getSelectionDirection() {
    if (selectedCells.length < 2) return null;

    const size = config[difficulty].gridCols;
    const first = selectedCells[0];
    const last = selectedCells[selectedCells.length - 1];
    
    const firstRow = Math.floor(first / size);
    const firstCol = first % size;
    const lastRow = Math.floor(last / size);
    const lastCol = last % size;

    const rowDiff = lastRow - firstRow;
    const colDiff = lastCol - firstCol;

    // Calculate simplest direction (reduced ratio)
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const divisor = gcd(Math.abs(rowDiff), Math.abs(colDiff));
    const rowStep = rowDiff / divisor;
    const colStep = colDiff / divisor;

    // Limit to basic directions (horizontal, vertical, diagonal)
    if (Math.abs(rowStep) > 1 || Math.abs(colStep) > 1) return null;

    return {
        row: rowStep,
        col: colStep,
        type: rowStep === 0 ? 'horizontal' : 
              colStep === 0 ? 'vertical' : 'diagonal'
    };
  }

  function endSelection() {
    if (!isSelecting) return;
    isSelecting = false;
    checkSelectedWord();
  }

  function getCellIndex(target) {
    if (target.classList.contains('wordsearch-cell')) {
      return parseInt(target.dataset.index);
    }
    return null;
  }

  function updateSelection() {
    // Clear previous selection
    grid.forEach(cell => {
        cell.element.classList.remove('selected');
        cell.element.classList.remove('direction-locked');
    });

    // Apply new selection
    selectedCells.forEach(index => {
        grid[index].element.classList.add('selected');
    });

    // Add special class when direction is locked (after 2 cells)
    if (selectedCells.length >= 2) {
        selectedCells.forEach(index => {
            grid[index].element.classList.add('direction-locked');
        });
    }
  }

  function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && target.classList.contains('wordsearch-cell')) {
      startSelection({ target, preventDefault: () => {} });
    }
  }

  function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && target.classList.contains('wordsearch-cell')) {
      continueSelection({ target, preventDefault: () => {} });
    }
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    endSelection();
  }

  // Ensure full screen on mobile and adjust word list visibility
  function adjustGameLayout() {
    const wordGameCard = document.querySelector('.word-game-card');
    if (wordGameCard) {
      if (window.innerWidth <= 768) {
        wordGameCard.style.width = '100%';
        wordGameCard.style.margin = '0';
        wordGameCard.style.padding = '1rem';
        wordGameCard.style.minHeight = 'calc(100vh - 80px)';
        wordGameCard.style.display = 'flex';
        wordGameCard.style.flexDirection = 'column';
        wordGameCard.style.alignItems = 'center';
      } else {
        wordGameCard.style.width = '600px';
        wordGameCard.style.margin = '2rem auto';
        wordGameCard.style.padding = '2rem';
        wordGameCard.style.minHeight = 'auto';
        wordGameCard.style.display = 'block';
      }
    }
    adjustWordListLayout();
  }

  function adjustWordListLayout() {
    const wordListContainer = wordListElement.parentElement;
    if (window.innerWidth <= 768) {
      // Mobile layout: single column with wrapping
      wordListElement.style.width = '100%';
      wordListElement.style.maxWidth = '100%';
      wordListElement.style.overflowX = 'auto';
      wordListElement.style.whiteSpace = 'nowrap';
      wordListElement.style.marginTop = '1rem';
      wordListElement.style.padding = '0.5rem';
      wordListElement.style.display = 'flex';
      wordListElement.style.flexWrap = 'wrap';
      wordListElement.style.justifyContent = 'center';

      const wordElements = wordListElement.querySelectorAll('.wordsearch-word');
      wordElements.forEach(word => {
        word.style.display = 'inline-block';
        word.style.margin = '0.25rem 0.5rem';
        word.style.fontSize = '14px';
      });

      if (wordListContainer) {
        wordListContainer.style.display = 'block';
        wordListContainer.style.width = '100%';
        wordListContainer.style.overflow = 'visible';
      }
    } else {
      // Desktop layout: 2 columns per row using CSS grid
      wordListElement.style.width = 'auto';
      wordListElement.style.maxWidth = 'none';
      wordListElement.style.overflowX = 'visible';
      wordListElement.style.whiteSpace = 'normal';
      wordListElement.style.marginTop = '0';
      wordListElement.style.padding = '0';
      wordListElement.style.display = 'grid';
      wordListElement.style.gridTemplateColumns = 'repeat(2, 1fr)';
      wordListElement.style.gap = '0.5rem';

      const wordElements = wordListElement.querySelectorAll('.wordsearch-word');
      wordElements.forEach(word => {
        word.style.display = 'block';
        word.style.margin = '0.5rem 0';
        word.style.fontSize = '16px';
      });

      if (wordListContainer) {
        wordListContainer.style.display = 'block';
        wordListContainer.style.width = 'auto';
        wordListContainer.style.overflow = 'visible';
      }
    }
  }

  // Add these new animation functions:
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

  newGameBtn.addEventListener('click', initGame);
  hintBtn.addEventListener('click', giveHint);

  // Mute button event listener
  const muteBtn = document.getElementById('mute-btn'); // Get the actual button element
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
    });
  }


  window.addEventListener('resize', adjustGameLayout);
  adjustGameLayout();
}

document.addEventListener('DOMContentLoaded', () => {
  initWordGame();
});