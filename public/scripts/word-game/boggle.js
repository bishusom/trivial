export function initWordGame() {
  // Load saved state BEFORE setting defaults
  const savedState = loadGameState();
  let difficulty = savedState?.difficulty || 'easy';
  let consecutiveWins = savedState?.consecutiveWins || 0;
  let currentLevel = savedState?.currentLevel || 1;
  let score = 0;
  let timer = 180; // 3 minutes in seconds
  let timerInterval = null;

  // Game configuration
  const config = {
    gridSize: {
      easy: 4,   // 4x4 grid
      medium: 5, // 5x5 grid
      hard: 5    // 5x5 grid with stricter scoring
    },
    minWordLength: 3,
    maxWordLength: 8,
    timeLimit: 180, // 3 minutes in seconds
    scorePerLetter: 10, // Points per letter in a valid word
    winThreshold: {
      easy: 50,
      medium: 100,
      hard: 150
    },
    vowelPercentage: {
      easy: 0.4,   // 40% vowels
      medium: 0.35,
      hard: 0.3    // 30% vowels minimum
    }
  };

  // Common 3–5 letter words for grid generation
  const commonWords = [
    'CAT', 'DOG', 'HAT', 'RUN', 'SUN', 'PEN', 'RED', 'BLUE', 'TREE', 'BIRD',
    'FISH', 'STAR', 'MOON', 'PLAY', 'BOOK', 'FOOD', 'GOOD', 'LOVE', 'HOME', 'TIME',
    'BALL', 'GAME', 'CARS', 'SHIP', 'WIND', 'RAIN', 'SNOW', 'FIRE', 'WAVE', 'HILL'
  ].map(word => word.toUpperCase());

  // Game state
  let grid = [];
  let foundWords = new Set();
  let selectedCells = [];
  let isSelecting = false;
  let usedLetters = new Set();
  let wordCache = new Map(); // Cache for validated words
  let lastSelectionTime = 0; // For debouncing rapid selections

  // DOM elements
  const gridElement = document.getElementById('boggle-grid');
  const wordListElement = document.getElementById('boggle-word-list');
  const feedbackElement = document.getElementById('boggle-feedback');
  const newGameBtn = document.getElementById('boggle-new');
  const submitBtn = document.getElementById('boggle-submit');
  const timeElement = document.getElementById('boggle-time');
  const scoreElement = document.getElementById('boggle-score');
  const levelElement = document.getElementById('boggle-level');

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
    localStorage.setItem('boggleGameState', JSON.stringify(gameState));
  }

  function loadGameState() {
    const savedState = localStorage.getItem('boggleGameState');
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

  async function initGame() {
    console.log('Initializing Boggle game with state:', { difficulty, currentLevel, consecutiveWins });
    clearInterval(timerInterval);
    timer = config.timeLimit;
    score = 0;
    foundWords.clear();
    selectedCells = [];
    isSelecting = false;
    usedLetters.clear();
    wordCache.clear();

    // Clear previous game
    gridElement.innerHTML = '';
    wordListElement.innerHTML = '';
    showFeedback('', 'info');
    updateScore();
    updateLevelInfo();
    updateTimer();

    // Start timer
    startTimer();

    try {
      // Generate grid
      generateGrid();
      renderGrid();
      trackEvent('boggle_game_started', 'boggle', 'start', 1);
    } catch (error) {
      console.error("Game initialization failed:", error);
      showFeedback("Failed to load puzzle. Please refresh the page.", 'error');
    }
  }

  function generateGrid() {
  const size = config.gridSize[difficulty];
  const vowels = 'AEIOU';
  const minVowels = Math.ceil(size * size * config.vowelPercentage[difficulty]);
  let vowelCount = 0;
  grid = [];
  
    // Create letter pool with extra vowels
    const letterPool = [];
    
    // Add letters from common words (which naturally contain vowels)
    commonWords.forEach(word => {
      word.split('').forEach(letter => letterPool.push(letter));
    });
    
    // Add extra vowels to ensure sufficient quantity
    for (let i = 0; i < 50; i++) {
      letterPool.push(vowels[Math.floor(Math.random() * vowels.length)]);
    }
    
    // Add some random consonants for variety
    const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
    for (let i = 0; i < 25; i++) {
      letterPool.push(consonants[Math.floor(Math.random() * consonants.length)]);
    }

    // Generate grid ensuring minimum vowels
    while (grid.length < size * size) {
      const randomIndex = Math.floor(Math.random() * letterPool.length);
      const letter = letterPool[randomIndex];
      
      // If we need more vowels and this is a vowel, take it
      if (vowelCount < minVowels && vowels.includes(letter)) {
        grid.push({ letter, element: null });
        vowelCount++;
      }
      // If we have enough vowels, take any letter
      else if (vowelCount >= minVowels) {
        grid.push({ letter, element: null });
      }
      // Otherwise try again
    }
    
    // Final check (shouldn't be needed but good for debugging)
    const finalVowelCount = grid.filter(cell => vowels.includes(cell.letter)).length;
    console.log(`Generated ${size}x${size} grid with ${finalVowelCount} vowels`);
    
    return grid;
  }

  function renderGrid() {
    const size = config.gridSize[difficulty];
    gridElement.style.gridTemplateColumns = `repeat(${size}, 1fr)`; // Explicitly set columns
    gridElement.style.gridTemplateRows = `repeat(${size}, 1fr)`;    // and rows
    gridElement.style.setProperty('--grid-size', size);
    gridElement.style.display = 'grid';
    gridElement.style.width = '100%';
    gridElement.style.maxWidth = '100%';
    gridElement.style.overflow = 'hidden';

    grid.forEach((cell, index) => {
      const cellElement = document.createElement('div');
      cellElement.className = 'boggle-cell';
      cellElement.textContent = cell.letter;
      cellElement.dataset.index = index;

      // Mouse events
      cellElement.addEventListener('mousedown', startSelection);
      cellElement.addEventListener('mouseenter', continueSelection);
      cellElement.addEventListener('mouseup', endSelection);

      // Touch events
      cellElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      cellElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      cellElement.addEventListener('touchend', handleTouchEnd);

      gridElement.appendChild(cellElement);
      cell.element = cellElement;
    });
  }

  async function checkSelectedWord() {
    if (selectedCells.length < config.minWordLength) {
      showFeedback('Word too short', 'error');
      selectedCells = [];
      updateSelection();
      return;
    }

    const selectedWord = selectedCells.map(index => grid[index].letter).join('');
    if (foundWords.has(selectedWord)) {
      showFeedback('Word already found', 'error');
      selectedCells = [];
      updateSelection();
      return;
    }

    try {
      let isValid = false;
      if (wordCache.has(selectedWord.toLowerCase())) {
        isValid = wordCache.get(selectedWord.toLowerCase());
      } else {
        // Check DictionaryAPI
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${selectedWord.toLowerCase()}`);
        isValid = response.ok; // Valid if API returns 200
        wordCache.set(selectedWord.toLowerCase(), isValid);
      }

      if (isValid && selectedWord.length >= config.minWordLength && selectedWord.length <= config.maxWordLength) {
        foundWords.add(selectedWord);
        const points = selectedWord.length * config.scorePerLetter;
        score += points;
        selectedCells.forEach(index => grid[index].element.classList.add('found'));
        renderWordList();
        updateScore();
        showFeedback(`Found: ${selectedWord} (+${points} points)`, 'success');
        trackEvent('word_found', 'boggle', selectedWord, points);

        if (score >= config.winThreshold[difficulty]) {
          handleGameWin();
        }
      } else {
        showFeedback('Not a valid word', 'error');
      }
    } catch (error) {
      console.error('Error checking word:', error);
      // Fallback to static common words
      if (commonWords.includes(selectedWord.toUpperCase())) {
        foundWords.add(selectedWord);
        const points = selectedWord.length * config.scorePerLetter;
        score += points;
        selectedCells.forEach(index => grid[index].element.classList.add('found'));
        renderWordList();
        updateScore();
        showFeedback(`Found: ${selectedWord} (+${points} points)`, 'success');
        trackEvent('word_found', 'boggle', selectedWord, points);
      } else {
        showFeedback('Error checking word, try another', 'error');
      }
    }

    selectedCells = [];
    updateSelection();
  }

  function renderWordList() {
    wordListElement.innerHTML = '';
    Array.from(foundWords).sort().forEach(word => {
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
    if (timer <= 0) {
      clearInterval(timerInterval);
      showFeedback('Time’s up!', 'error');
      setTimeout(initGame, 2000);
    }
  }

  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timer--;
      updateTimer();
    }, 1000);
  }

  function handleGameWin() {
    clearInterval(timerInterval);
    consecutiveWins++;
    if (consecutiveWins >= 3) {
      if (difficulty === 'easy') {
        difficulty = 'medium';
        showFeedback('Advanced to Medium level!', 'success');
      } else if (difficulty === 'medium') {
        difficulty = 'hard';
        showFeedback('Advanced to Hard level!', 'success');
      } else {
        showFeedback('Mastered all levels!', 'success');
      }
      consecutiveWins = 0;
      currentLevel++;
    } else {
      showFeedback(`Great job! ${3 - consecutiveWins} more wins to advance.`, 'info');
    }

    saveGameState();
    updateLevelInfo();
    setTimeout(initGame, 2000);
  }

  function showFeedback(message, type) {
    feedbackElement.textContent = message;
    feedbackElement.className = `word-feedback ${type}`;
  }

  function startSelection(e) {
    e.preventDefault();
    isSelecting = true;
    const index = getCellIndex(e.target);
    if (index !== null) {
      selectedCells = [index];
      usedLetters = new Set([index]);
      updateSelection();
      highlightAdjacentCells(index);
      console.log(`Selection started at index ${index} (${grid[index].letter}) at (${Math.floor(index / 5)}, ${index % 5})`);
    }
  }

  function continueSelection(e) {
    e.preventDefault();
    if (!isSelecting || selectedCells.length === 0) return;

    const now = Date.now();
    if (now - lastSelectionTime < 20) return;
    lastSelectionTime = now;

    const index = getCellIndex(e.target);
    if (index === null || usedLetters.has(index)) return;

    const lastIndex = selectedCells[selectedCells.length - 1];
    const size = config.gridSize[difficulty];
    
    console.log(`Checking adjacency between: 
      ${lastIndex} (${grid[lastIndex].letter}) at (${Math.floor(lastIndex/size)},${lastIndex%size}) and 
      ${index} (${grid[index].letter}) at (${Math.floor(index/size)},${index%size})`);

    if (isAdjacent(lastIndex, index)) {
      selectedCells.push(index);
      usedLetters.add(index);
      updateSelection();
      highlightAdjacentCells(index);
    } else {
      console.log('Not adjacent - row/col diff too large');
    }
  }

  function endSelection() {
    if (!isSelecting) return;
    isSelecting = false;
    grid.forEach(cell => cell.element.classList.remove('adjacent'));
    console.log(`Selection ended, word: ${selectedCells.map(i => grid[i].letter).join('')}`);
    if (selectedCells.length < 2) {
      showFeedback('Selection too short, please select at least 2 letters', 'error');
      selectedCells = [];
      updateSelection();
    } else {
      checkSelectedWord();
    }
  }

  function highlightAdjacentCells(currentIndex) {
    // Remove previous adjacent highlights
    grid.forEach(cell => cell.element.classList.remove('adjacent'));

    // Highlight cells adjacent to the current index
    const size = config.gridSize[difficulty];
    const row = Math.floor(currentIndex / size);
    const col = currentIndex % size;

    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (r === row && c === col) continue; // Skip the current cell
        if (r < 0 || r >= size || c < 0 || c >= size) continue; // Skip out-of-bounds
        const index = r * size + c;
        if (!usedLetters.has(index)) {
          grid[index].element.classList.add('adjacent');
        }
      }
    }
  }

  function getCellIndex(target) {
    if (target.classList.contains('boggle-cell')) {
      return parseInt(target.dataset.index);
    }
    return null;
  }

  function getPositionFromIndex(index) {
    const size = config.gridSize[difficulty];
    return {
      row: Math.floor(index / size),
      col: index % size
    };
  }

  function isAdjacent(index1, index2) {
    const pos1 = getPositionFromIndex(index1);
    const pos2 = getPositionFromIndex(index2);
    
    const rowDiff = Math.abs(pos2.row - pos1.row);
    const colDiff = Math.abs(pos2.col - pos1.col);
    
    // Valid if adjacent in any direction (including diagonals)
    return (rowDiff <= 1 && colDiff <= 1) && !(rowDiff === 0 && colDiff === 0);
  }

  function updateSelection() {
    grid.forEach(cell => cell.element.classList.remove('selected'));
    selectedCells.forEach(index => {
      if (grid[index].element) grid[index].element.classList.add('selected');
    });
  }

  function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && target.classList.contains('boggle-cell')) {
      startSelection({ target, preventDefault: () => {} });
    }
  }

  function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && target.classList.contains('boggle-cell')) {
      continueSelection({ target, preventDefault: () => {} });
    }
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    endSelection();
  }

  // Event listeners
  newGameBtn.addEventListener('click', initGame);
  submitBtn.addEventListener('click', checkSelectedWord);
}

document.addEventListener('DOMContentLoaded', () => {
  initWordGame();
});