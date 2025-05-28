export function initWordGame() {
  // Load saved state BEFORE setting defaults
  const savedState = loadGameState();
  let difficulty = savedState?.difficulty || 'easy';
  let consecutiveWins = savedState?.consecutiveWins || 0;
  let currentLevel = savedState?.currentLevel || 1;
  let score = 0;
  let timer = 180; // 3 minutes in seconds
  let timerInterval = null;
  let dictionaryWords = [];

  // Game configuration
  const config = {
    gridSize: {
      easy: 4,   // 4x4 grid
      medium: 5, // 5x5 grid
      hard: 5    // 5x5 grid with stricter scoring
    },
    minWordLength: 3,
    maxWordLength: 4,
    timeLimit: 180, // 3 minutes in seconds
    scorePerLetter: 10, // Points per letter in a valid word
    winThreshold: {
      easy: 50,
      medium: 100,
      hard: 120
    },
    vowelPercentage: {
      easy: 0.4,   // 40% vowels
      medium: 0.35,
      hard: 0.35    // 30% vowels minimum
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
  const hintBtn = document.getElementById('boggle-hint');
  const timeElement = document.getElementById('boggle-time');
  const scoreElement = document.getElementById('boggle-score');
  const levelElement = document.getElementById('boggle-level');

  function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
      gtag('event', action, { event_category: category, event_label: label, value: value });
    }
  }

  async function fetchDictionaryWords() {
    try {
      const randomFloor = Math.floor(Math.random() * 10000);
        
      const query = db.collection('dictionary')
                    .where('length', '>=', config.minWordLength)
                    .where('length', '<=', config.maxWordLength)
                    .where('randomIndex', '>=', randomFloor)
                    .orderBy('randomIndex')
                   .limit(50);

      const snapshot = await query.get();
      const dictionaryWords = snapshot.docs.map(doc => doc.data().word.toUpperCase());
      
      console.log(`Fetched ${dictionaryWords.length} words from Firebase`);
    } catch (error) {
      console.error("Error fetching words from Firebase:", error);
      // Fallback to a basic set if Firebase fails
      dictionaryWords = [
        'CAT', 'DOG', 'HAT', 'RUN', 'SUN', 'PEN', 'RED', 'BLUE', 'TREE', 'BIRD',
        'FISH', 'STAR', 'MOON', 'PLAY', 'BOOK', 'FOOD', 'GOOD', 'LOVE', 'HOME', 'TIME'
      ].map(word => word.toUpperCase());
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
    await fetchDictionaryWords();
    // Clear any existing line
    const existingLine = document.querySelector('.selection-line');
    if (existingLine) existingLine.remove();
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
  
  // Create optimized letter pool
  const letterPool = [];
  
  // 1. Add letters from dictionary words (ensures valid word fragments)
  dictionaryWords.forEach(word => {
    word.split('').forEach(letter => letterPool.push(letter));
  });

  // 2. Add common word starters and vowel-consonant pairs
  const commonStarters = ['S', 'T', 'B', 'C', 'D', 'F', 'G', 'H', 'L', 'M', 'N', 'P', 'R'];
  const commonPairs = ['TH', 'CH', 'SH', 'QU', 'BR', 'CR', 'DR', 'FR', 'GR', 'PR', 'TR'];
  
  commonStarters.forEach(c => letterPool.push(c));
  commonPairs.forEach(pair => {
    letterPool.push(pair[0]);
    letterPool.push(pair[1]);
  });

  // 3. Add strategic vowels
  for (let i = 0; i < 30; i++) {
    letterPool.push(vowels[Math.floor(Math.random() * vowels.length)]);
  }

  // 4. Add balanced consonants (reduced rare consonants in hard mode)
  const commonConsonants = 'BCDFGHKLMNPRSTVWY';
  const rareConsonants = difficulty === 'hard' ? 'JQXZ' : 'JQX';
  
  for (let i = 0; i < 40; i++) {
    const consonantGroup = Math.random() < 0.8 ? commonConsonants : rareConsonants;
    letterPool.push(consonantGroup[Math.floor(Math.random() * consonantGroup.length)]);
  }

  // Generate grid with better word-forming potential
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    grid = [];
    vowelCount = 0;
    
    // Create grid with center-weighted vowels
    for (let i = 0; i < size * size; i++) {
      const row = Math.floor(i / size);
      const col = i % size;
      
      // Center cells more likely to be vowels
      const isCenterCell = row > 0 && row < size-1 && col > 0 && col < size-1;
      const needsVowel = isCenterCell || vowelCount < minVowels;
      
      if (needsVowel && (vowelCount < minVowels || Math.random() < 0.6)) {
        const vowel = vowels[Math.floor(Math.random() * vowels.length)];
        grid.push({ letter: vowel, element: null });
        vowelCount++;
      } else {
        const randomIndex = Math.floor(Math.random() * letterPool.length);
        grid.push({ letter: letterPool[randomIndex], element: null });
      }
    }
    
    // For hard level, verify grid has sufficient word potential
    if (difficulty !== 'hard' || isGridPlayable()) {
      break;
    }
    
    attempts++;
  }

  // Final vowel check
  const finalVowelCount = grid.filter(cell => vowels.includes(cell.letter)).length;
  console.log(`Generated ${size}x${size} grid with ${finalVowelCount} vowels`);
  
  return grid;
}

// Helper function to validate grid playability
function isGridPlayable() {
  // Check for consonant clusters that can form word stems
  const commonClusters = ['STR', 'THR', 'SPL', 'SPR', 'SCR', 'SHR', 'PHL', 'CHR'];
  const gridLetters = grid.map(cell => cell.letter).join('');
  
  // Verify at least 3 common clusters exist
  const clusterCount = commonClusters.filter(cluster => 
    gridLetters.includes(cluster)
  ).length;
  
  // Check vowel distribution (no more than 2 vowels touching)
  let adjacentVowels = 0;
  const size = config.gridSize[difficulty];
  
  for (let i = 0; i < grid.length; i++) {
    const row = Math.floor(i / size);
    const col = i % size;
    if ('AEIOU'.includes(grid[i].letter)) {
      // Check adjacent cells
      for (let r = row-1; r <= row+1; r++) {
        for (let c = col-1; c <= col+1; c++) {
          if (r >= 0 && r < size && c >= 0 && c < size) {
            const idx = r * size + c;
            if (idx !== i && 'AEIOU'.includes(grid[idx].letter)) {
              adjacentVowels++;
            }
          }
        }
      }
    }
  }
  
  return clusterCount >= 3 && adjacentVowels <= size * 2;
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

  function getCellCenter(index) {
    const cell = grid[index].element;
    const rect = cell.getBoundingClientRect();
    const gridRect = gridElement.getBoundingClientRect();
    return {
      x: rect.left + rect.width/2 - gridRect.left,
      y: rect.top + rect.height/2 - gridRect.top
    };
  }

  function updateSelectionLine() {
    // Remove any existing line
    const existingLine = document.querySelector('.selection-line');
    if (existingLine) existingLine.remove();

    // Don't draw line for single cell or empty selection
    if (selectedCells.length < 2) return;

    // Create line element
    const line = document.createElement('div');
    line.className = 'selection-line';
    gridElement.appendChild(line);

    // Draw lines between all selected cells
    for (let i = 0; i < selectedCells.length - 1; i++) {
      const start = getCellCenter(selectedCells[i]);
      const end = getCellCenter(selectedCells[i + 1]);

      // Calculate line length and angle
      const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;

      // Create line segment
      const segment = document.createElement('div');
      segment.className = 'selection-line';
      segment.style.width = `${length}px`;
      segment.style.left = `${start.x}px`;
      segment.style.top = `${start.y}px`;
      segment.style.transform = `rotate(${angle}deg)`;
      gridElement.appendChild(segment);
    }
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
    
    // Create victory screen
    const victoryScreen = document.createElement('div');
    victoryScreen.className = 'victory-screen';
    
    // Fire confetti
    fireConfetti();
    
    consecutiveWins++;
    let victoryMessage = '';
    
    if (consecutiveWins >= 3) {
      if (difficulty === 'easy') {
        difficulty = 'medium';
        victoryMessage = `🎉 Advanced to Medium level! 🎉`;
        // Special confetti for level up
        setTimeout(() => fireConfetti({ particleCount: 200, spread: 100 }), 1000);
      } else if (difficulty === 'medium') {
        difficulty = 'hard';
        victoryMessage = `🏆 Advanced to Hard level! 🏆`;
        // Even bigger celebration for hard level
        setTimeout(() => fireConfetti({ particleCount: 300, spread: 120, shapes: ['circle', 'square'] }), 1000);
      } else {
        victoryMessage = `👑 Mastered all levels! 👑`;
        // Biggest celebration for mastering all levels
        setTimeout(() => fireConfetti({ particleCount: 400, spread: 150, shapes: ['circle', 'square', 'star'] }), 1000);
        setTimeout(() => fireConfetti({ particleCount: 400, spread: 150, origin: { x: 0 } }), 1500);
        setTimeout(() => fireConfetti({ particleCount: 400, spread: 150, origin: { x: 1 } }), 2000);
      }
      consecutiveWins = 0;
      currentLevel++;
    } else {
      victoryMessage = `🎊 Great job! ${3 - consecutiveWins} more wins to advance. 🎊`;
    }

    victoryScreen.innerHTML = `
      <h2>Victory!</h2>
      <p>${victoryMessage}</p>
      <p>Score: ${score}</p>
      <p>Words Found: ${foundWords.size}</p>
      <div class="countdown">Next game starting in 5...</div>
    `;
    
    document.body.appendChild(victoryScreen);
    
    // Countdown before next game
    let countdown = 5;
    const countdownElement = victoryScreen.querySelector('.countdown');
    const countdownInterval = setInterval(() => {
      countdown--;
      countdownElement.textContent = `Next game starting in ${countdown}...`;
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        victoryScreen.remove();
        saveGameState();
        updateLevelInfo();
        initGame();
      }
    }, 1000);
    
    trackEvent('level_complete', 'boggle', difficulty, score);
    saveGameState();
    updateLevelInfo();
    setTimeout(initGame, 3600);
  }

  // Confetti helper function
  function fireConfetti(options = {}) {
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
    
    // Remove the line when selection ends
    const line = document.querySelector('.selection-line');
    if (line) line.remove();
    
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
    grid.forEach(cell => {
      cell.element.classList.remove('selected', 'highlight');
    });
    
    selectedCells.forEach(index => {
      if (grid[index].element) {
        grid[index].element.classList.add('selected');
        // Add highlight to last selected cell
        if (index === selectedCells[selectedCells.length - 1]) {
          grid[index].element.classList.add('highlight');
        }
      }
    });
    
    updateSelectionLine(); // Add this line
  }

  async function showHint() {
    if (foundWords.size > 0) {
      showFeedback("Try finding more words first!", 'info');
      return;
    }
      
    showFeedback("Looking for a hint...", 'info');
      
    // This would require pre-generating a list of valid words in the grid
    // or implementing a word finder algorithm
    const hint = await findValidWordHint(); 
      
    if (hint) {
      showFeedback(`Hint: Try finding a word starting with ${hint[0]}`, 'success');
      trackEvent('hint_used', 'boggle', difficulty, currentLevel);
    } else {
      showFeedback("No hints available", 'error');
    }
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
  hintBtn.addEventListener('click', showHint);
}

document.addEventListener('DOMContentLoaded', () => {
  initWordGame();
});