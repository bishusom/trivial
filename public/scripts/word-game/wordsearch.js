export function initWordGame() {
  // Load saved state with meta progression
  const savedState = loadGameState();
  let difficulty = savedState?.difficulty || 'easy';
  let consecutiveWins = savedState?.consecutiveWins || 0;
  let currentLevel = savedState?.currentLevel || 1;
  let metaProgression = savedState?.metaProgression || {
    totalWordsFound: 0,
    streaks: 0,
    highestCombo: 0,
    unlockedThemes: ['default'],
    currentTheme: 'default',
    powerUps: [],
    lastPlayed: null,
    dailyChallengeCompleted: false
  };

  // Game configuration with progressive difficulty
  const config = {
    easy: { 
      gridCols: 6, 
      gridRows: 8, 
      minWordLength: 3, 
      maxWordLength: 5, 
      wordCount: 6, 
      timeLimit: 240,
      progressive: false
    },
    medium: { 
      gridCols: 8, 
      gridRows: 10, 
      minWordLength: 4, 
      maxWordLength: 7, 
      wordCount: 8, 
      timeLimit: 300,
      progressive: false
    },
    hard: { 
      gridCols: 10, 
      gridRows: 10, 
      minWordLength: 5, 
      maxWordLength: 8, 
      wordCount: 10, 
      timeLimit: 500,
      progressive: true,
      minTimeLimit: 300,
      maxWordCount: 15
    },
    maxPlacementAttempts: 200,
    maxTotalAttempts: 1000,
    maxRetries: 3,
    specialRoundInterval: 5
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
  let currentSpecialEffect = null;
  let effectInterval = null;
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
  const muteBtnIcon = document.querySelector('#mute-btn .material-icons');
  const powerUpContainer = document.getElementById('powerup-container');

  // Sound effects
  const audioElements = {
    select: new Audio('/audio/click.mp3'),
    found: new Audio('/audio/correct.mp3'),
    win: new Audio('/audio/win.mp3'),
    error: new Audio('/audio/wrong.mp3'),
    powerup: new Audio('/audio/powerup.mp3'),
    unlock: new Audio('/audio/unlock.mp3')
  };

  // Mute state
  let isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;

  /* ------------------------- */
  /* Core Game Functionality   */
  /* ------------------------- */

  function playSound(type) {
    if (isMuted) return;
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
    if (isMuted) stopAllSounds();
  }

  function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
      gtag('event', action, { event_category: category, event_label: label, value: value });
    }
  }

  function startTimer() {
    clearInterval(timerInterval);
    updateTimer();
    timerInterval = setInterval(() => {
      timer--;
      updateTimer();
      if (timer <= 0) {
        clearInterval(timerInterval);
        showFeedback('Time\'s up!', 'error');
        metaProgression.streaks = 0;
        setTimeout(initGame, 2000);
      }
    }, 1000);
  }

  function updateTimer() {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    timeElement.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    timeElement.style.color = timer <= 10 ? '#ff4444' : '#ffffff';
  }

  function saveGameState() {
    const gameState = { 
      difficulty, 
      consecutiveWins, 
      currentLevel,
      metaProgression 
    };
    localStorage.setItem('wordGameState', JSON.stringify(gameState));
  }

  function loadGameState() {
    const savedState = localStorage.getItem('wordGameState');
    return savedState ? JSON.parse(savedState) : null;
  }

  function tryPlaceWord(wordObj, directionQuotas) {
    const directions = [
      { id: 0, type: 'horizontal', rowStep: 0, colStep: 1 },
      { id: 1, type: 'vertical', rowStep: 1, colStep: 0 },
      { id: 2, type: 'diagonal', rowStep: 1, colStep: 1 },
      { id: 3, type: 'diagonal', rowStep: -1, colStep: 1 }
    ];
    
    const neededDirections = directions.filter(dir => {
      if (dir.type === 'horizontal' && directionCounts.horizontal >= directionQuotas.horizontal) return false;
      if (dir.type === 'vertical' && directionCounts.vertical >= directionQuotas.vertical) return false;
      if (dir.type === 'diagonal' && directionCounts.diagonal >= directionQuotas.diagonal) return false;
      return true;
    });

    const directionsToTry = neededDirections.length > 0 ? neededDirections : directions;
    const shuffledDirections = shuffleArray([...directionsToTry]);

    for (const dir of shuffledDirections) {
      for (let i = 0; i < config.maxPlacementAttempts; i++) {
        const maxRow = dir.rowStep === 0 ? config[difficulty].gridRows : 
                      config[difficulty].gridRows - wordObj.letters.length * Math.abs(dir.rowStep);
        const maxCol = dir.colStep === 0 ? config[difficulty].gridCols : 
                      config[difficulty].gridCols - wordObj.letters.length * Math.abs(dir.colStep);
        const row = Math.floor(Math.random() * maxRow);
        const col = Math.floor(Math.random() * maxCol);

        if (canPlaceWord(wordObj, row, col, dir.id)) {
          placeWord(wordObj, row, col, dir.id);
          directionCounts[dir.type]++;
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

  /* ------------------------- */
  /* Selection System          */
  /* ------------------------- */

  function startSelection(e) {
    e.preventDefault();
    isSelecting = true;
    const index = getCellIndex(e.target);
    if (index !== null) {
      selectedCells = [index];
      updateSelection();
      playSound('select');
    }
  }

  function continueSelection(e) {
    e.preventDefault();
    if (!isSelecting || selectedCells.length === 0) return;

    const index = getCellIndex(e.target);
    if (index === null || selectedCells.includes(index)) return;

    const lastIndex = selectedCells[selectedCells.length - 1];
    const size = config[difficulty].gridCols;
    
    const lastRow = Math.floor(lastIndex / size);
    const lastCol = lastIndex % size;
    const currentRow = Math.floor(index / size);
    const currentCol = index % size;

    // Always allow adjacent cells to start
    if (selectedCells.length < 2) {
      if (Math.abs(currentRow - lastRow) <= 1 && 
          Math.abs(currentCol - lastCol) <= 1) {
        selectedCells.push(index);
        updateSelection();
      }
      return;
    }

    // For longer selections, use predictive continuation
    const direction = getSelectionDirection();
    if (!direction) return;

    // Calculate expected position with floating point steps
    const expectedRow = lastRow + direction.row;
    const expectedCol = lastCol + direction.col;

    // Allow some tolerance around the expected position
    if (Math.abs(currentRow - expectedRow) <= 0.7 && 
        Math.abs(currentCol - expectedCol) <= 0.7) {
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

    // Calculate primary direction with more tolerance
    if (Math.abs(rowDiff) <= 0.5 && Math.abs(colDiff) > 0.5) {
      return { row: 0, col: Math.sign(colDiff), type: 'horizontal' };
    } else if (Math.abs(colDiff) <= 0.5 && Math.abs(rowDiff) > 0.5) {
      return { row: Math.sign(rowDiff), col: 0, type: 'vertical' };
    } else {
      // Diagonal - use floating point steps for smoother detection
      const rowStep = rowDiff / Math.max(Math.abs(rowDiff), Math.abs(colDiff));
      const colStep = colDiff / Math.max(Math.abs(rowDiff), Math.abs(colDiff));
      return {
        row: rowStep,
        col: colStep,
        type: 'diagonal'
      };
    }
  }

  function endSelection() {
    if (!isSelecting) return;
    isSelecting = false;
    
    // Only snap if we have a clear diagonal direction
    if (selectedCells.length >= 3) {
      const direction = getSelectionDirection();
      if (direction && direction.type === 'diagonal') {
        const size = config[difficulty].gridCols;
        const first = selectedCells[0];
        const firstRow = Math.floor(first / size);
        const firstCol = first % size;
        
        // Calculate perfect diagonal path
        const perfectSelection = [first];
        for (let i = 1; i < selectedCells.length; i++) {
          const nextRow = Math.round(firstRow + direction.row * i);
          const nextCol = Math.round(firstCol + direction.col * i);
          
          if (nextRow >= 0 && nextRow < config[difficulty].gridRows &&
              nextCol >= 0 && nextCol < config[difficulty].gridCols) {
            const nextIndex = nextRow * size + nextCol;
            perfectSelection.push(nextIndex);
          }
        }
        
        // Only replace if most cells match (for user forgiveness)
        const matchingCells = perfectSelection.filter((cell, i) => 
          i < selectedCells.length && cell === selectedCells[i]);
        
        if (matchingCells.length >= selectedCells.length * 0.7) {
          selectedCells = perfectSelection.slice(0, selectedCells.length);
        }
      }
    }
    
    checkSelectedWord();
  }

  function updateSelection() {
    // Clear previous selection
    grid.forEach(cell => {
      cell.element.classList.remove('selected');
      cell.element.classList.remove('direction-locked');
      cell.element.classList.remove('diagonal-hint');
    });

    // Apply new selection
    selectedCells.forEach(index => {
      grid[index].element.classList.add('selected');
    });

    // Visual feedback
    if (selectedCells.length >= 2) {
      const direction = getSelectionDirection();
      if (direction) {
        // Show direction hint
        selectedCells.forEach(index => {
          grid[index].element.classList.add('direction-locked');
          if (direction.type === 'diagonal') {
            grid[index].element.classList.add('diagonal-hint');
          }
        });

        // Show next cell hint for diagonals
        if (direction.type === 'diagonal' && selectedCells.length > 1) {
          const size = config[difficulty].gridCols;
          const lastIndex = selectedCells[selectedCells.length - 1];
          const lastRow = Math.floor(lastIndex / size);
          const lastCol = lastIndex % size;
          
          const nextRow = lastRow + direction.row;
          const nextCol = lastCol + direction.col;
          
          if (nextRow >= 0 && nextRow < config[difficulty].gridRows &&
              nextCol >= 0 && nextCol < config[difficulty].gridCols) {
            const nextIndex = nextRow * size + nextCol;
            grid[nextIndex].element.classList.add('diagonal-hint');
          }
        }
      }
    }
  }

  function checkSelectedWord() {
    if (selectedCells.length < config[difficulty].minWordLength) {
      playSound('error');
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
      playSound('found');

      // New color system with opacity
      const colorIndex = foundWords.length % 4;
      const colors = [
        'rgba(122, 255, 195, 0.7)',
        'rgba(142, 196, 250, 0.7)',
        'rgba(255, 216, 117, 0.7)',
        'rgba(255, 158, 232, 0.7)'
      ];
      
      const orderedCells = matchedWordObj.word.toUpperCase() === reversedUpper ? 
        selectedCells.reverse() : selectedCells;

      orderedCells.forEach((index, i) => {
        if (i < matchedWordObj.letters.length && grid[index].letter === matchedWordObj.letters[i]) {
          const currentBg = grid[index].element.style.backgroundColor;
          
          if (currentBg && currentBg !== 'transparent') {
            grid[index].element.style.backgroundColor = colors[colorIndex];
            grid[index].element.style.boxShadow = `inset 0 0 0 2px ${currentBg}`;
          } else {
            grid[index].element.style.backgroundColor = colors[colorIndex];
          }
          
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
      playSound('error');
      showFeedback('Word not found in list', 'error');
    }

    selectedCells = [];
    updateSelection();
  }

  /* ------------------------- */
  /* Enhanced Game Mechanics   */
  /* ------------------------- */

  function activateSpecialEffect(effect) {
    clearInterval(effectInterval);
    currentSpecialEffect = effect;
    
    // Clear previous effects
    gridElement.classList.remove(
      'time-attack', 
      'hidden-letters', 
      'moving-words'
    );
    
    switch(effect.name) {
      case 'Time Attack':
        timer = Math.floor(timer * effect.modifyTime);
        gridElement.classList.add('time-attack');
        showFeedback(`${effect.name}: ${effect.description}`, 'warning');
        break;
        
      case 'Hidden Letters':
        const cells = Array.from(gridElement.querySelectorAll('.wordsearch-cell'));
        cells.forEach(cell => {
          if (Math.random() < effect.hidePercentage) {
            cell.classList.add('hidden-letter');
            if (effect.revealOnHover) {
              cell.addEventListener('mouseenter', () => {
                cell.classList.remove('hidden-letter');
              });
            }
          }
        });
        gridElement.classList.add('hidden-letters');
        showFeedback(`${effect.name}: ${effect.description}`, 'warning');
        break;
        
      case 'Moving Words':
        effectInterval = setInterval(() => {
          if (!isSelecting) {
            shuffleUnfoundWords();
            showFeedback('Words have shifted positions!', 'warning');
          }
        }, effect.shuffleInterval);
        gridElement.classList.add('moving-words');
        showFeedback(`${effect.name}: ${effect.description}`, 'warning');
        break;
    }
  }

  function shuffleUnfoundWords() {
    const unfoundWords = words.filter(wordObj => !foundWords.includes(wordObj.word));
    const placedWords = [];
    
    // Remove unfound words from grid
    grid.forEach(cell => {
      if (cell.word && unfoundWords.some(w => w.word === cell.word)) {
        cell.letter = '';
        cell.word = null;
      }
    });
    
    // Try to place words again
    unfoundWords.forEach(wordObj => {
      const directionQuotas = {
        horizontal: Math.floor(config.hard.wordCount / 3),
        vertical: Math.floor(config.hard.wordCount / 3),
        diagonal: config.hard.wordCount - 2 * Math.floor(config.hard.wordCount / 3)
      };
      
      if (tryPlaceWord(wordObj, directionQuotas)) {
        placedWords.push(wordObj);
      }
    });
    
    // Update grid display
    renderGrid();
  }

  async function generateWordList(diffConfig) {
    const themes = ['Technology', 'Nature', 'Science', 'Geography', 'Literature'];
    const theme = themes[Math.floor(currentLevel / 3) % themes.length];
    
    try {
      // Try to fetch themed words from API
      const response = await fetch(`/api/words?theme=${theme}&minLength=${diffConfig.minWordLength}&maxLength=${diffConfig.maxWordLength}`);
      const data = await response.json();
      return data.map(word => ({ 
        word: word.toUpperCase(), 
        letters: word.toUpperCase().split('') 
      }));
    } catch (error) {
      console.error("Error fetching themed words:", error);
      return getStaticWordsByTheme(theme, diffConfig);
    }
  }

  function getStaticWordsByTheme(theme, diffConfig) {
    const themedWords = {
      Technology: ['ALGORITHM', 'DATABASE', 'FUNCTION', 'NETWORK', 'ROUTER', 'VARIABLE', 'BROWSER', 'PROTOCOL'],
      Nature: ['WATERFALL', 'MOUNTAIN', 'SUNFLOWER', 'HURRICANE', 'ECOSYSTEM', 'VOLCANO', 'GLACIER', 'CAVERN'],
      Science: ['MOLECULE', 'GRAVITY', 'QUANTUM', 'PARTICLE', 'ELEMENT', 'FISSION', 'KINETIC', 'THERMODYNAMICS'],
      Geography: ['CONTINENT', 'PENINSULA', 'LONGITUDE', 'LATITUDE', 'ARCHIPELAGO', 'POPULATION', 'ATMOSPHERE', 'PRECIPITATION'],
      Literature: ['METAPHOR', 'SYMBOLISM', 'PROTAGONIST', 'ANTAGONIST', 'ALLITERATION', 'FORESHADOW', 'PAPERBACK', 'BIBLIOGRAPHY']
    };
    
    return (themedWords[theme] || themedWords.Technology)
      .filter(word => word.length >= diffConfig.minWordLength && 
                      word.length <= diffConfig.maxWordLength)
      .map(word => ({ word, letters: word.split('') }));
  }

  function getProgressiveDifficulty() {
    if (difficulty !== 'hard' || !config.hard.progressive) {
      return config.hard;
    }
    
    const scalingFactor = Math.floor(currentLevel / 5);
    return {
      ...config.hard,
      wordCount: Math.min(
        config.hard.maxWordCount,
        config.hard.wordCount + scalingFactor
      ),
      timeLimit: Math.max(
        config.hard.minTimeLimit,
        config.hard.timeLimit - (scalingFactor * 20)
      )
    };
  }

  function setupPowerUps() {
    if (!powerUpContainer) return;
    powerUpContainer.innerHTML = '';
    
    metaProgression.powerUps.forEach((powerUp, index) => {
      const btn = document.createElement('button');
      btn.className = 'powerup-btn';
      btn.textContent = powerUp;
      btn.dataset.powerup = powerUp.toLowerCase().replace(' ', '-');
      btn.addEventListener('click', () => usePowerUp(powerUp, index));
      powerUpContainer.appendChild(btn);
    });
  }

  function usePowerUp(powerUp, index) {
    playSound('powerup');
    
    switch(powerUp) {
      case 'Extra Time':
        timer += 30;
        updateTimer();
        showFeedback('+30 seconds!', 'success');
        break;
        
      case 'Word Reveal':
        const unfoundWords = words.filter(w => !foundWords.includes(w.word));
        if (unfoundWords.length > 0) {
          const hintWord = unfoundWords[0].word;
          showFeedback(`One word is: ${hintWord}`, 'info');
        }
        break;
        
      case 'Letter Highlight':
        const unfoundWords = words.filter(w => !foundWords.includes(w.word));
        if (unfoundWords.length > 0) {
          const wordObj = unfoundWords[0];
          const firstLetter = wordObj.letters[0];
          
          grid.forEach((cell, i) => {
            if (cell.letter === firstLetter) {
              cell.element.classList.add('highlight-letter');
              setTimeout(() => {
                cell.element.classList.remove('highlight-letter');
              }, 3000);
            }
          });
          
          showFeedback(`Look for words starting with ${firstLetter}`, 'info');
        }
        break;
    }
    
    // Remove used power-up
    metaProgression.powerUps.splice(index, 1);
    setupPowerUps();
    saveGameState();
  }

  function updateVisualProgress() {
    const progressBars = document.querySelectorAll('.progress-bar');
    progressBars.forEach(bar => {
      const progress = bar.querySelector('.progress');
      if (progress) {
        progress.style.width = `${(currentLevel % 10) * 10}%`;
      }
    });
    
    // Update theme if changed
    if (gridElement.dataset.theme !== metaProgression.currentTheme) {
      gridElement.dataset.theme = metaProgression.currentTheme;
    }
  }

  function addSpecialRoundEffects(tier) {
    const effects = [
      { 
        name: "Time Attack",
        description: "30% less time but bonus points!",
        modifyTime: 0.7,
        scoreMultiplier: 1.5
      },
      { 
        name: "Hidden Letters",
        description: "Random letters are hidden!",
        hidePercentage: 0.3,
        revealOnHover: true
      },
      { 
        name: "Moving Words",
        description: "Words shift positions every 30 seconds!",
        shuffleInterval: 30000,
        preserveFound: true
      }
    ];

    const effect = effects[Math.min(tier - 1, effects.length - 1)];
    activateSpecialEffect(effect);
  }

  /* ------------------------- */
  /* Game Initialization       */
  /* ------------------------- */

  async function initGame() {
    console.log('Initializing game with state:', { 
      difficulty, 
      currentLevel, 
      consecutiveWins,
      metaProgression 
    });
    
    showLoadingAnimation();
    showFeedback('', 'info');
    gridElement.innerHTML = '';
    wordListElement.innerHTML = '';
    selectedCells = [];
    foundWords = [];
    isSelecting = false;
    usedWordsInGame.clear();
    directionCounts = { horizontal: 0, vertical: 0, diagonal: 0 };
    clearInterval(effectInterval);
    currentSpecialEffect = null;

    // Update level info
    updateLevelInfo();
    updateVisualProgress();
    setupPowerUps();

    try {
      // Get appropriate difficulty settings (progressive if enabled)
      const currentConfig = difficulty === 'hard' ? 
        getProgressiveDifficulty() : 
        config[difficulty];
      
      // Generate words with theme
      words = await generateWordList(currentConfig);
      words.sort((a, b) => b.letters.length - a.letters.length);
      
      // Initialize grid
      grid = Array(currentConfig.gridCols * currentConfig.gridRows).fill().map(() => ({
        letter: '',
        element: null,
        word: null
      }));

      // Place words with direction quotas
      const directionQuotas = {
        horizontal: Math.floor(currentConfig.wordCount / 3),
        vertical: Math.floor(currentConfig.wordCount / 3),
        diagonal: currentConfig.wordCount - 2 * Math.floor(currentConfig.wordCount / 3)
      };
      
      let placedWords = [];
      for (const wordObj of words) {
        if (tryPlaceWord(wordObj, directionQuotas)) {
          placedWords.push(wordObj);
          usedWordsInGame.add(wordObj.word);
        }
      }
      
      words = placedWords;
      
      // Fill empty cells and render
      fillEmptyCells();
      renderGrid();
      renderWordList();
      
      // Start timer with special effects if applicable
      timer = currentConfig.timeLimit;
      
      // Apply special effects at max difficulty
      if (difficulty === 'hard' && currentLevel % config.specialRoundInterval === 0) {
        const effectTier = Math.floor(currentLevel / (config.specialRoundInterval * 2)) + 1;
        addSpecialRoundEffects(effectTier);
      }
      
      startTimer();
      updateWordsLeft();
      showFeedback(`Find ${words.length} hidden words!`, 'info');
      retryCount = 0;
      
    } catch (error) {
      console.error("Game initialization failed:", error);
      showErrorAnimation();
      retryCount++;
      
      if (retryCount >= config.maxRetries) {
        showFinalErrorAnimation();
        return;
      }
      
      setTimeout(() => {
        words = getStaticWordsByTheme('Technology', config[difficulty]);
        words.sort((a, b) => b.letters.length - a.letters.length);
        initGame();
      }, 2000);
    }
  }

  function renderGrid() {
    gridElement.style.setProperty('--cols', config[difficulty].gridCols);
    gridElement.style.setProperty('--rows', config[difficulty].gridRows);
    gridElement.style.display = 'grid';

    // Determine cell size based on screen size
    const containerWidth = Math.min(window.innerWidth, 600);
    const baseCellSize = containerWidth / config[difficulty].gridCols;
    const cellSize = Math.min(baseCellSize, 50);

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
      cellElement.style.fontSize = `${Math.min(cellSize * 0.6, 16)}px`;
      cellElement.style.borderRadius = '0';

      cellElement.addEventListener('mousedown', startSelection);
      cellElement.addEventListener('mouseenter', continueSelection);
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

    adjustWordListLayout();
  }

  /* ------------------------- */
  /* Game Completion Handling  */
  /* ------------------------- */

  function handleGameWin() {
    playSound('win');
    clearInterval(timerInterval);
    clearInterval(effectInterval);
    
    // Update progression stats
    metaProgression.totalWordsFound += foundWords.length;
    metaProgression.streaks++;
    metaProgression.highestCombo = Math.max(
      metaProgression.highestCombo, 
      foundWords.length
    );
    
    // Check for unlocks
    checkForUnlocks();
    
    // Create victory screen
    const victoryScreen = document.createElement('div');
    victoryScreen.className = 'victory-screen';
    
    // Show confetti
    showConfetti();
    
    // Determine level progression
    consecutiveWins++;
    currentLevel++;
    
    let victoryMessage = '';
    let levelUp = false;
    
    if (difficulty !== 'hard' && consecutiveWins >= 3) {
      if (difficulty === 'easy') {
        difficulty = 'medium';
        levelUp = true;
        victoryMessage = `🎉 Advanced to Medium level! 🎉`;
      } else if (difficulty === 'medium') {
        difficulty = 'hard';
        levelUp = true;
        victoryMessage = `🏆 Advanced to Hard level! 🏆`;
      }
      
      if (levelUp) {
        consecutiveWins = 0;
        setTimeout(() => showConfetti({ particleCount: 200, spread: 100 }), 1000);
      }
    } else {
      victoryMessage = `🎊 Level ${currentLevel - 1} Complete! 🎊`;
    }
    
    // Build victory screen HTML
    victoryScreen.innerHTML = `
      <div class="victory-content">
        <h2>Victory!</h2>
        <p class="victory-message">${victoryMessage}</p>
        <div class="victory-stats">
          <div>Words Found: ${foundWords.length}/${words.length}</div>
          <div>Current Streak: ${metaProgression.streaks}</div>
          <div>Total Words Found: ${metaProgression.totalWordsFound}</div>
        </div>
        
        ${difficulty === 'hard' ? `
        <div class="progression-container">
          <div class="progress-bar">
            <div class="progress" style="width: ${(currentLevel % 10) * 10}%"></div>
            ${Array.from({length: 9}, (_, i) => `
              <div class="milestone" data-milestone="${i+1}" style="left: ${(i+1)*10}%"></div>
            `).join('')}
          </div>
          ${currentLevel % 5 === 0 ? `
            <div class="unlock-notification">
              New ${currentLevel % 10 === 0 ? 'Theme' : 'Power-Up'} Unlocked!
            </div>
          ` : ''}
        </div>
        ` : ''}
        
        <div class="competitive-elements">
          <div class="leaderboard-preview">
            <h3>Top Players</h3>
            <ol>
              <li>WordMaster: Level 42</li>
              <li>PuzzleKing: Level 38</li>
              <li>${localStorage.getItem('playerName') || 'You'}: Level ${currentLevel - 1}</li>
            </ol>
          </div>
          <div class="action-buttons">
            <button class="btn primary continue-btn">Continue</button>
            <button class="btn secondary share-btn">Share</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(victoryScreen);
    
    // Add event listeners
    victoryScreen.querySelector('.continue-btn').addEventListener('click', () => {
      victoryScreen.remove();
      saveGameState();
      initGame();
    });
    
    victoryScreen.querySelector('.share-btn').addEventListener('click', () => {
      shareResult();
    });
    
    saveGameState();
  }

  function checkForUnlocks() {
    // Theme unlocks
    if (metaProgression.totalWordsFound >= 100 && !metaProgression.unlockedThemes.includes('dark')) {
      metaProgression.unlockedThemes.push('dark');
      showUnlockNotification('New Theme Unlocked: Dark Mode!');
      playSound('unlock');
    }
    
    if (metaProgression.totalWordsFound >= 250 && !metaProgression.unlockedThemes.includes('nature')) {
      metaProgression.unlockedThemes.push('nature');
      showUnlockNotification('New Theme Unlocked: Nature!');
      playSound('unlock');
    }
    
    // Power-up unlocks
    if (metaProgression.streaks % 5 === 0) {
      const allPowerUps = ['Extra Time', 'Word Reveal', 'Letter Highlight', 'Time Freeze'];
      const newPowerUp = allPowerUps.find(p => !metaProgression.powerUps.includes(p));
      
      if (newPowerUp) {
        metaProgression.powerUps.push(newPowerUp);
        showUnlockNotification(`New Power-Up: ${newPowerUp}!`);
        playSound('unlock');
      }
    }
  }

  function showUnlockNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'unlock-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }

  /* ------------------------- */
  /* Helper Functions          */
  /* ------------------------- */

  function shareResult() {
    const text = `I just completed level ${currentLevel - 1} in Word Search Master! Can you beat my score?`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Word Search Master',
        text: text,
        url: window.location.href
      }).catch(err => console.log('Error sharing:', err));
    } else {
      const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
      window.open(shareUrl, '_blank');
    }
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

  function getCellIndex(target) {
    if (target.classList.contains('wordsearch-cell')) {
      return parseInt(target.dataset.index);
    }
    return null;
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

  function createTimeElement() {
    const element = document.createElement('div');
    element.id = 'wordsearch-time';
    element.className = 'word-game-timer';
    document.querySelector('.word-game-meta').appendChild(element);
    return element;
  }

  // Initialize the game
  initGame();
  loadMuteState();

  // Event listeners
  newGameBtn.addEventListener('click', initGame);
  hintBtn.addEventListener('click', giveHint);

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

  window.addEventListener('resize', adjustGameLayout);
  adjustGameLayout();
}

document.addEventListener('DOMContentLoaded', () => {
  initWordGame();
});