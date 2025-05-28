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
  let usedPairs = new Set(); // Track used startWord-endWord pairs
  let wordCache = new Map();
  let hintsUsed = 0;
  let gameActive = false;
  let selectedLetterIndex = -1;

  // DOM elements
  const currentWordElement = document.getElementById('current-word-display');
  const letterTilesElement = document.getElementById('letter-tiles');
  const wordListElement = document.getElementById('word-ladder-list');
  const feedbackElement = document.getElementById('word-ladder-feedback');
  const newGameBtn = document.getElementById('word-ladder-new');
  const submitBtn = document.getElementById('word-ladder-submit');
  const hintBtn = document.getElementById('word-ladder-hint');
  const timeElement = document.getElementById('word-ladder-time');
  const scoreElement = document.getElementById('word-ladder-score');
  const levelElement = document.getElementById('word-ladder-level');
  const startWordElement = document.getElementById('start-word');
  const endWordElement = document.getElementById('end-word');

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

  async function initGame() {
    console.log('Initializing Word Ladder game with state:', { difficulty, currentLevel, consecutiveWins });
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
        // Try to use Firebase word pairs first
        await initGameWithFirebaseWords(wordLength);
    } catch (error) {
        console.error('Error using Firebase words:', error);
        // Fallback to local words
        await initGameWithLocalWords(wordLength);
    }
    }

    async function initGameWithFirebaseWords(wordLength) {
      console.log('Fetching fb db for wordLength ', wordLength);
    // 1. Fetch word pair from Firebase
      const querySnapshot = await db.collection('wordLadders')
          .where('length', '==', wordLength)
          .limit(50)
          .get();
    
      if (querySnapshot.empty) {
        throw new Error('No word pairs found in Firebase');
      }
    
      // Convert to array and pick random
      const pairs = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
          startWord: data.startWord?.toUpperCase(),
          endWord: data.endWord?.toUpperCase()
          };
      }).filter(pair => pair.startWord && pair.endWord);
      
      if (pairs.length === 0) {
          throw new Error('No valid word pairs in Firebase');
      }
      
      const randomPair = pairs[Math.floor(Math.random() * pairs.length)];
      console.log(randomPair);
      // 2. Check if valid transformation path exists
      //const path = await findWordLadderPath(randomPair.startWord, randomPair.endWord, 1);
      //if (!path) {
      //    throw new Error('No valid path between words');
      //}
      
      // 3. Initialize game with this pair
      const pairKey = `${randomPair.startWord}-${randomPair.endWord}`;
      if (usedPairs.has(pairKey)) {
          throw new Error('Pair already used');
      }
      
      usedPairs.add(pairKey);
      startWord = randomPair.startWord;
      endWord = randomPair.endWord;
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
      trackEvent('word_ladder_game_started', 'word_ladder', 'start', 1);
      }

      async function initGameWithLocalWords(wordLength) {
      const availableWords = wordLists[wordLength];
      
      // Find a valid word pair with minimum 2 transformations
      let validPair = false;
      let attempts = 0;
      const maxAttempts = 50;
      
      while (!validPair && attempts < maxAttempts) {
          // Select a random start word that has transformations
          startWord = availableWords[Math.floor(Math.random() * availableWords.length)];
          const startTransformations = await getValidTransformations(startWord);
          
          if (startTransformations.length === 0) {
          attempts++;
          continue;
          }

          // Find an end word that's reachable in minSteps+1 steps
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
          // Fallback to known valid pairs
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
          // Ultimate fallback
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
      trackEvent('word_ladder_game_started', 'word_ladder', 'start', 1);
    }

  // New function to find a word ladder path with minimum steps
  async function findWordLadderPath(start, end, minSteps) {
    // First check if direct transformation exists
    if (canTransformTo(start, end)) {
        return [start, end]; // But we'll filter these out in initGame
    }

    // Then look for longer paths
    const queue = [[start]];
    const visited = new Set([start]);
    let iterations = 0;
    
    while (queue.length > 0 && iterations < 1000) {
        iterations++;
        const path = queue.shift();
        const current = path[path.length - 1];
        console.log(`Current path (${path.length}): ${path.join(' → ')}`);

        if (current === end) {
          console.log(`Found path with ${path.length - 1} steps`);
          return path.length - 1 >= minSteps ? path : null;
        }
        
        const transformations = await getValidTransformations(current);
        console.log(`Transformations from ${current}:`, transformations);
        for (const word of transformations) {
        if (!visited.has(word)) {
          visited.add(word);
          queue.push([...path, word]);
          console.log(`Added to queue: ${word}`);
        }
      }
    }
    console.log(`Pathfinding terminated after ${iterations} iterations`);
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
    renderCurrentWord();
    renderLetterTiles();
  }

  async function changeLetter(newLetter) {
    if (selectedLetterIndex === -1 || !gameActive) return;

    const newWord = currentWord.substring(0, selectedLetterIndex) + 
                   newLetter + 
                   currentWord.substring(selectedLetterIndex + 1);
    console.log('newWord', newWord);
    
    if (await checkWord(newWord)) {
      // Valid word
      currentWord = newWord;
      ladderWords.push(newWord);
      usedWords.add(newWord);
      
      const points = config.scorePerStep[difficulty];
      score += points;
      updateScore();
      renderWordList();
      
      if (newWord === endWord) {
        // Game won!
        const timeBonus = timer * config.bonusPerSecond;
        score += timeBonus;
        updateScore();
        
        clearInterval(timerInterval);
        gameActive = false;
        showFeedback(`You won! +${points} points + ${timeBonus} time bonus`, 'success');
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

  function showFeedback(message, type) {
    feedbackElement.textContent = message;
    feedbackElement.className = `word-feedback ${type}`;
  }

  async function checkWord(word) {
    if (!gameActive) return false;
    
    // Basic validation
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

    // Check if it's a valid transformation (only one letter changed)
    let diffCount = 0;
    for (let i = 0; i < currentWord.length; i++) {
      if (currentWord[i] !== word[i]) diffCount++;
      if (diffCount > 1) {
        showFeedback('Only one letter can be changed at a time', 'error');
        return false;
      }
    }

    // Check if word exists
    let isValid = false;
    if (wordCache.has(word.toLowerCase())) {
      isValid = wordCache.get(word.toLowerCase());
    } else {
      try {
        // Check DictionaryAPI
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
        isValid = response.ok;
        console.log(response);
        wordCache.set(word.toLowerCase(), isValid);
      } catch (error) {
        // Fallback to our word list
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
    // Check if word1 can be transformed to word2 in one step
    let diffCount = 0;
    for (let i = 0; i < word1.length; i++) {
      if (word1[i] !== word2[i]) diffCount++;
      if (diffCount > 1) return false;
    }
    return diffCount === 1;
  }

  async function provideHint() {
    if (!gameActive || hintsUsed >= config.maxHints) return;
    
    const transformations = await getValidTransformations(currentWord);
    const validNextSteps = transformations.filter(word => 
      !usedWords.has(word) && canLeadToSolution(word)
    );
    
    if (validNextSteps.length > 0) {
      hintsUsed++;
      const hintWord = validNextSteps[Math.floor(Math.random() * validNextSteps.length)];
      
      // Highlight the letter that needs to be changed
      let changeIndex = -1;
      for (let i = 0; i < currentWord.length; i++) {
        if (currentWord[i] !== hintWord[i]) {
          changeIndex = i;
          break;
        }
      }
      
      if (changeIndex !== -1) {
        selectLetter(changeIndex);
        showFeedback(`Try changing the ${ordinal(changeIndex + 1)} letter to ${hintWord[changeIndex]}`, 'info');
      } else {
        showFeedback(`Try: ${hintWord}`, 'info');
      }
      
      trackEvent('hint_used', 'word_ladder', 'hint', hintsUsed);
    } else {
      showFeedback('No hints available for this step', 'error');
    }
  }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function canLeadToSolution(word) {
    // Simple check - does this word share more letters with the end word?
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

    saveGameState();
    updateLevelInfo();
    setTimeout(initGame, 3000);
  }

  // Event listeners
  newGameBtn.addEventListener('click', () => {
    usedPairs.clear(); // Clear used pairs for a fresh session
    initGame();
  });
  submitBtn.addEventListener('click', () => {
    if (selectedLetterIndex !== -1) {
      showFeedback('Please select a letter to change', 'error');
    } else {
      showFeedback('Select a letter to change', 'info');
    }
  });
  hintBtn.addEventListener('click', provideHint);
}

document.addEventListener('DOMContentLoaded', () => {
  initWordGame();
});