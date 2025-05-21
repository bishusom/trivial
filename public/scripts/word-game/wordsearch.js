export function initWordGame() {
  // Game configuration
  const config = {
    gridCols: 12, // Increased from 10
    gridRows: 8,  // Increased from 6
    minWordLength: 4,
    maxWordLength: 8,
    wordCount: {
      easy: 6,
      medium: 8,
      hard: 10
    },
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
  let difficulty = 'easy';
  let consecutiveWins = 0;
  let currentLevel = 1;
  let usedWordsInGame = new Set();
  let retryCount = 0; // Track retries to avoid infinite loops

  // Direction tracking for balanced placement
  let directionCounts = { horizontal: 0, vertical: 0, diagonal: 0 };

  // DOM elements
  const gridElement = document.getElementById('wordsearch-grid');
  const wordListElement = document.getElementById('wordsearch-wordlist');
  const wordsLeftElement = document.getElementById('wordsearch-words-left');
  let feedbackElement = document.getElementById('wordsearch-feedback');
  const newGameBtn = document.getElementById('wordsearch-new');
  const hintBtn = document.getElementById('wordsearch-hint');
  const levelElement = document.createElement('span');
  levelElement.id = 'wordsearch-level';
  const gamesRemainingElement = document.createElement('span');
  gamesRemainingElement.id = 'wordsearch-games-remaining';

  function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, { event_category: category, event_label: label, value: value });
    }
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
        return JSON.parse(savedState);
      } catch (e) {
        console.error('Failed to parse saved game state', e);
        return null;
      }
    }
    return null;
  }


  // Initialize the game
  initGame();

  async function initGame() {
    // Clear previous game
    gridElement.innerHTML = '';
    wordListElement.innerHTML = '';
    selectedCells = [];
    foundWords = [];
    isSelecting = false;
    usedWordsInGame.clear();
    directionCounts = { horizontal: 0, vertical: 0, diagonal: 0 };

    const savedState = loadGameState();
    if (savedState) {
      difficulty = savedState.difficulty || 'easy';
      consecutiveWins = savedState.consecutiveWins || 0;
      currentLevel = savedState.currentLevel || 1;
    } else {
      // Default values if no saved state
      difficulty = 'easy';
      consecutiveWins = 0;
      currentLevel = 1;
    }

    try {
      // Generate words from Firebase
      words = await generateWordList(config);
      // Sort words by length (descending) to place longer words first
      words.sort((a, b) => b.letters.length - a.letters.length);
      console.log('Words fetched and sorted:', words);

      let placedSuccessfully = false;
      let totalGameAttempts = 0;
      const maxGameAttempts = 3; // Retry entire game up to 3 times

      while (!placedSuccessfully && totalGameAttempts < maxGameAttempts) {
        totalGameAttempts++;
        console.log(`Attempt ${totalGameAttempts} to place all words`);

        // Initialize grid
        grid = Array(config.gridCols * config.gridRows).fill().map(() => ({
          letter: '',
          element: null,
          word: null
        }));

        const placedWords = [];
        let totalAttempts = 0;
        let availableWords = [...words];

        // Calculate direction quotas
        const totalWords = config.wordCount[difficulty];
        const minPerDirection = Math.floor(totalWords / 3);
        const directionQuotas = {
          horizontal: minPerDirection,
          vertical: minPerDirection,
          diagonal: totalWords - 2 * minPerDirection // Assign remaining to diagonal
        };

        // Main placement loop
        while (placedWords.length < config.wordCount[difficulty] && totalAttempts < config.maxTotalAttempts) {
          if (availableWords.length === 0) {
            availableWords = [...words].filter(wordObj => !placedWords.some(p => p.word === wordObj.word));
            console.log('Resetting available words:', availableWords);
          }

          const wordObj = availableWords[0];
          let placed = false;

          // Try to place word with balanced direction
          if (tryPlaceWord(wordObj, directionQuotas)) {
            placedWords.push(wordObj);
            usedWordsInGame.add(wordObj.word);
            availableWords.shift();
            console.log(`Placed word: ${wordObj.word}, Total placed: ${placedWords.length}`);
            placed = true;
          } else {
            availableWords.shift();
            console.log(`Failed to place word: ${wordObj.word}, Moving to next word`);
            totalAttempts++;
          }
        }

        words = placedWords;

        if (words.length < config.wordCount[difficulty]) {
          console.warn(`Only placed ${words.length} out of ${config.wordCount[difficulty]} words`);
          // Fallback: Try simpler placement
          const remainingWordsNeeded = config.wordCount[difficulty] - words.length;
          const simplerWords = await generateWordList(config, remainingWordsNeeded);
          const simplerAvailableWords = simplerWords.filter(wordObj => !usedWordsInGame.has(wordObj.word));
          let simplerAttempts = 0;

          while (words.length < config.wordCount[difficulty] && simplerAttempts < config.maxTotalAttempts && simplerAvailableWords.length > 0) {
            const wordObj = simplerAvailableWords[0];
            if (tryPlaceWord(wordObj, directionQuotas)) {
              words.push(wordObj);
              usedWordsInGame.add(wordObj.word);
              simplerAvailableWords.shift();
              console.log(`Simpler placement: Placed word: ${wordObj.word}, Total placed: ${words.length}`);
            } else {
              simplerAvailableWords.shift();
              simplerAttempts++;
              console.log(`Simpler placement failed for: ${wordObj.word}`);
            }
          }
        }

        if (words.length === config.wordCount[difficulty]) {
          placedSuccessfully = true;
        } else {
          console.warn(`Failed to place all words on attempt ${totalGameAttempts}`);
          usedWordsInGame.clear(); // Clear to allow retry with new words
          words = await generateWordList(config); // Fetch new words for next attempt
          words.sort((a, b) => b.letters.length - a.letters.length); // Re-sort
          directionCounts = { horizontal: 0, vertical: 0, diagonal: 0 }; // Reset direction counts
        }
      }

      if (!placedSuccessfully) {
        throw new Error(`Could only place ${words.length} out of ${config.wordCount[difficulty]} words after ${maxGameAttempts} attempts`);
      }

      // Fill empty cells
      fillEmptyCells();

      // Render game
      renderGrid();
      renderWordList();

      updateWordsLeft();
      updateLevelInfo();
      showFeedback(`Find ${words.length} hidden words!`, 'info');

      retryCount = 0; // Reset retry count on successful game

    } catch (error) {
      console.error("Game initialization failed:", error);
      showFeedback("Failed to load puzzle. Retrying...", 'error');
      retryCount++;
      if (retryCount >= config.maxRetries) {
        showFeedback("Failed to load puzzle after multiple attempts. Please refresh the page.", 'error');
        return;
      }
      // Fallback to static words after delay
      setTimeout(() => {
        const staticWords = [
          'FUNCTION', 'VARIABLE', 'OPERATOR', 'QUERY', 'JAVASCRIPT', 'REACT', 'ANGULAR', 'COMPONENT',
          'MODULE', 'SCRIPT', 'CODING', 'DEBUG', 'ARRAY', 'LOOP', 'METHOD', 'CLASS',
          'STRING', 'NUMBER', 'OBJECT', 'EVENT', 'STYLE', 'DESIGN', 'FORMAT', 'UPDATE',
          'INSERT', 'DELETE', 'SELECT', 'TABLE', 'INDEX', 'FETCH', 'ROUTE', 'SERVER'
        ].filter(word => word.length >= config.minWordLength && word.length <= config.maxWordLength);
        const uniqueStaticWords = [...new Set(staticWords)]
          .filter(word => !usedWordsInGame.has(word));
        words = shuffleArray(uniqueStaticWords).slice(0, config.wordCount[difficulty])
          .map(word => ({ word, letters: word.split('') }));
        words.sort((a, b) => b.letters.length - a.letters.length); // Sort static words
        initGame();
      }, 2000);
    }
    trackEvent('word_search_started','word_search',1);
  }

  async function generateWordList({ minWordLength, maxWordLength, wordCount }, limitOverride = null) {
    try {
      const randomFloor = Math.floor(Math.random() * 900000);
      const limit = limitOverride || wordCount[difficulty] * 3;
      const snapshot = await db.collection('dictionary')
        .where('length', '>=', minWordLength)
        .where('length', '<=', maxWordLength)
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
      const finalWords = shuffledWordData.slice(0, limitOverride || wordCount[difficulty]);
      console.log('Generated word list:', finalWords);
      return finalWords;
    } catch (error) {
      console.error("Error fetching words:", error);
      const staticWords = [
        'FUNCTION', 'VARIABLE', 'OPERATOR', 'QUERY', 'JAVASCRIPT', 'REACT', 'ANGULAR', 'COMPONENT',
        'MODULE', 'SCRIPT', 'CODING', 'DEBUG', 'ARRAY', 'LOOP', 'METHOD', 'CLASS',
        'STRING', 'NUMBER', 'OBJECT', 'EVENT', 'STYLE', 'DESIGN', 'FORMAT', 'UPDATE',
        'INSERT', 'DELETE', 'SELECT', 'TABLE', 'INDEX', 'FETCH', 'ROUTE', 'SERVER'
      ].filter(word => word.length >= minWordLength && word.length <= maxWordLength);
      const uniqueStaticWords = [...new Set(staticWords)]
        .filter(word => !usedWordsInGame.has(word));
      const finalWords = shuffleArray(uniqueStaticWords).slice(0, limitOverride || wordCount[difficulty])
        .map(word => ({ word, letters: word.split('') }));
      console.log('Fallback word list:', finalWords);
      return finalWords;
    }
  }

  function tryPlaceWord(wordObj, directionQuotas) {
    const directions = [
      { id: 0, type: 'horizontal', rowStep: 0, colStep: 1 },
      { id: 1, type: 'vertical', rowStep: 1, colStep: 0 },
      { id: 2, type: 'diagonal', rowStep: 1, colStep: 1 }, // Diagonal down
      { id: 3, type: 'diagonal', rowStep: -1, colStep: 1 } // Diagonal up
    ];
    const attemptsPerDirection = 50;

    // Determine which directions are still needed based on quotas
    const neededDirections = directions.filter(dir => {
      if (dir.type === 'horizontal' && directionCounts.horizontal >= directionQuotas.horizontal) return false;
      if (dir.type === 'vertical' && directionCounts.vertical >= directionQuotas.vertical) return false;
      if (dir.type === 'diagonal' && directionCounts.diagonal >= directionQuotas.diagonal) return false;
      return true;
    });

    // If no directions are needed, allow any direction
    const directionsToTry = neededDirections.length > 0 ? neededDirections : directions;

    // Shuffle directions to avoid bias
    const shuffledDirections = shuffleArray([...directionsToTry]);

    for (const dir of shuffledDirections) {
      for (let i = 0; i < attemptsPerDirection; i++) {
        const maxRow = dir.rowStep === 0 ? config.gridRows : config.gridRows - wordObj.letters.length * Math.abs(dir.rowStep);
        const maxCol = dir.colStep === 0 ? config.gridCols : config.gridCols - wordObj.letters.length * Math.abs(dir.colStep);
        const row = Math.floor(Math.random() * maxRow);
        const col = Math.floor(Math.random() * maxCol);

        if (canPlaceWord(wordObj, row, col, dir.id)) {
          placeWord(wordObj, row, col, dir.id);
          // Update direction count
          if (dir.type === 'horizontal') directionCounts.horizontal++;
          else if (dir.type === 'vertical') directionCounts.vertical++;
          else if (dir.type === 'diagonal') directionCounts.diagonal++;
          console.log(`Placed ${wordObj.word} in ${dir.type} direction at (${row}, ${col})`);
          return true;
        }
      }
    }

    console.log(`Failed to place ${wordObj.word} after trying all directions`);
    return false;
  }

  function canPlaceWord(wordObj, row, col, direction) {
    const { letters } = wordObj;
    for (let i = 0; i < letters.length; i++) {
      let r = row, c = col;
      
      switch (direction) {
        case 0: c += i; break; // Horizontal
        case 1: r += i; break; // Vertical
        case 2: r += i; c += i; break; // Diagonal down
        case 3: r -= i; c += i; break; // Diagonal up
      }
      
      if (r < 0 || r >= config.gridRows || c < 0 || c >= config.gridCols) {
        return false;
      }
      
      const index = r * config.gridCols + c;
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
      
      const index = r * config.gridCols + c;
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
    console.log('Grid after filling empty cells:', grid);
  }

  function renderGrid() {
    console.log(`Rendering grid with ${config.gridCols} cols and ${config.gridRows} rows`);
    
    // Set CSS variables for grid dimensions
    gridElement.style.setProperty('--cols', config.gridCols);
    gridElement.style.setProperty('--rows', config.gridRows);
    
    gridElement.style.display = 'grid';
    gridElement.style.width = '100%';
    gridElement.style.maxWidth = '100%';
    gridElement.style.overflow = 'hidden';
    
    gridElement.innerHTML = '';
    grid.forEach((cell, index) => {
      const cellElement = document.createElement('div');
      cellElement.className = 'wordsearch-cell';
      cellElement.textContent = cell.letter;
      cellElement.dataset.index = index;
      
      // Mouse events
      cellElement.addEventListener('mousedown', startSelection);
      cellElement.addEventListener('mouseenter', (e) => {
        e.preventDefault();
        continueSelection(e);
      });
      cellElement.addEventListener('mouseup', endSelection);
      
      // Touch events
      cellElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      cellElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      cellElement.addEventListener('touchend', handleTouchEnd);
      
      gridElement.appendChild(cellElement);
      cell.element = cellElement;
    });
  }

  function renderWordList() {
    wordListElement.innerHTML = '';
    words.forEach(wordObj => {
      const wordElement = document.createElement('div');
      wordElement.className = 'wordsearch-word';
      wordElement.textContent = wordObj.word;
      wordElement.dataset.word = wordObj.word;
      wordListElement.appendChild(wordElement);
    });
  }

  function checkSelectedWord() {
    if (selectedCells.length < config.minWordLength) {
        selectedCells = [];
        updateSelection();
        return;
    }
    
    const selectedWord = selectedCells.map(index => grid[index].letter).join('');
    const reversedWord = selectedWord.split('').reverse().join('');
    
    // Convert both to uppercase for comparison
    const selectedUpper = selectedWord.toUpperCase();
    const reversedUpper = reversedWord.toUpperCase();
    
    // Find matching word object (compare with uppercase versions)
    const matchedWordObj = words.find(wordObj => 
        wordObj.word.toUpperCase() === selectedUpper || 
        wordObj.word.toUpperCase() === reversedUpper
    );
    
    if (matchedWordObj && !foundWords.includes(matchedWordObj.word)) {
        foundWords.push(matchedWordObj.word);
      
      selectedCells.forEach(index => {
        grid[index].element.classList.remove('selected');
        grid[index].element.classList.add('found');
      });
      
      const wordElements = wordListElement.querySelectorAll('.wordsearch-word');
      wordElements.forEach(el => {
        if (el.dataset.word === matchedWordObj.word) {
          el.classList.add('found');
        }
      });
      
      updateWordsLeft();
      showFeedback(`Found: ${matchedWordObj.word}`, 'success');
      
      if (foundWords.length === words.length) {
        handleGameWin();
      }
    } else {
      showFeedback('Word not found in list', 'error');
    }
    
    selectedCells = [];
    updateSelection();
  }

  function handleGameWin() {
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
    
    updateLevelInfo();
    saveGameState(); // Save the updated state
    setTimeout(initGame, 2000);
  }

  function updateLevelInfo() {
    levelElement.textContent = `Level: ${currentLevel} (${difficulty})`;
    gamesRemainingElement.textContent = `Wins to next level: ${3 - consecutiveWins}`;
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
    }
  }

  function continueSelection(e) {
    e.preventDefault();
    if (!isSelecting || selectedCells.length === 0) return;

    const index = getCellIndex(e.target);
    if (index === null || selectedCells.includes(index)) return;

    const lastIndex = selectedCells[selectedCells.length - 1];
    const direction = getSelectionDirection();

    // Allow first two cells to set direction, then enforce it
    if (selectedCells.length > 1 && !isInDirection(lastIndex, index, direction)) {
      return;
    }

    selectedCells.push(index);
    updateSelection();
  }

  function getSelectionDirection() {
    if (selectedCells.length < 2) return null;
    
    const first = selectedCells[0];
    const second = selectedCells[1];
    const row1 = Math.floor(first / config.gridCols);
    const col1 = first % config.gridCols;
    const row2 = Math.floor(second / config.gridCols);
    const col2 = second % config.gridCols;
    
    const rowDiff = row2 - row1;
    const colDiff = col2 - col1;

    // Normalize direction
    if (rowDiff === 0 && colDiff !== 0) {
      return { row: 0, col: colDiff > 0 ? 1 : -1 }; // Horizontal
    } else if (colDiff === 0 && rowDiff !== 0) {
      return { row: rowDiff > 0 ? 1 : -1, col: 0 }; // Vertical
    } else if (Math.abs(rowDiff) === Math.abs(colDiff)) {
      return {
        row: rowDiff > 0 ? 1 : -1,
        col: colDiff > 0 ? 1 : -1
      }; // Diagonal
    }
    
    return null; // Invalid direction
  }

  function isInDirection(index1, index2, direction) {
  if (!direction) return false;

  const row1 = Math.floor(index1 / config.gridCols);
  const col1 = index1 % config.gridCols;
  const row2 = Math.floor(index2 / config.gridCols);
  const col2 = index2 % config.gridCols;
  
  const rowDiff = row2 - row1;
  const colDiff = col2 - col1;

  // For horizontal: same row, one column step in direction
  if (direction.row === 0) {
    return rowDiff === 0 && colDiff === direction.col;
  }
  // For vertical: same column, one row step in direction
  else if (direction.col === 0) {
    return colDiff === 0 && rowDiff === direction.row;
  }
  // For diagonal: equal row and column steps in direction
  else {
    return (
      Math.sign(rowDiff) === Math.sign(direction.row) &&
      Math.sign(colDiff) === Math.sign(direction.col) &&
      Math.abs(rowDiff) === Math.abs(colDiff)
    );
  }
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
    grid.forEach(cell => {
      cell.element.classList.remove('selected');
    });
    
    selectedCells.forEach(index => {
      grid[index].element.classList.add('selected');
    });
  }

  // New touch event handlers
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

  // Event listeners
  newGameBtn.addEventListener('click', initGame);
  hintBtn.addEventListener('click', giveHint);
}

document.addEventListener('DOMContentLoaded', () => {
  initWordGame();
});