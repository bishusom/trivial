export function initWordSearch() {
    console.log('Initializing Word Search game');
    
    // Game configuration
    const config = {
        gridSize: 10,
        minWordLength: 4,
        maxWordLength: 8,
        wordCount: 10
    };
    
    // Game state
    let grid = [];
    let words = [];
    let foundWords = [];
    let selectedCells = [];
    let isSelecting = false;
    let startTime = null;
    let timerInterval = null;
    
    // DOM elements
    const gridElement = document.getElementById('wordsearch-grid');
    const wordListElement = document.getElementById('wordsearch-wordlist');
    const wordsLeftElement = document.getElementById('wordsearch-words-left');
    const timeElement = document.getElementById('wordsearch-time');
    const feedbackElement = document.getElementById('wordsearch-feedback');
    const newGameBtn = document.getElementById('wordsearch-new');
    const hintBtn = document.getElementById('wordsearch-hint');
    
    // Initialize the game
    initGame();
    
    function initGame() {
        // Clear previous game
        clearInterval(timerInterval);
        gridElement.innerHTML = '';
        wordListElement.innerHTML = '';
        selectedCells = [];
        foundWords = [];
        isSelecting = false;
        
        // Generate words
        words = generateWordList();
        
        // Initialize grid
        grid = Array(config.gridSize * config.gridSize).fill().map(() => ({
            letter: '',
            element: null
        }));
        
        // Place words
        placeWords();
        
        // Fill empty cells
        fillEmptyCells();
        
        // Render grid
        renderGrid();
        
        // Render word list
        renderWordList();
        
        // Start timer
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
        
        // Update UI
        updateWordsLeft();
        showFeedback('Find the hidden words!', 'info');
    }
    
    function generateWordList() {
        // Replace with your own word list or API call
        const wordPool = [
            'JAVASCRIPT', 'FUNCTION', 'VARIABLE', 'REACT', 'VUE', 'ANGULAR',
            'COMPONENT', 'PROGRAM', 'ALGORITHM', 'DATABASE', 'NETWORK',
            'INTERNET', 'BROWSER', 'SERVER', 'CLIENT', 'STYLES', 'ROUTER',
            'MODULE', 'PACKAGE', 'DEPENDENCY', 'FRAMEWORK', 'LIBRARY',
            'DEVELOPER', 'DEBUGGING', 'ITERATION', 'SYNTAX', 'OPERATOR',
            'CONDITION', 'LOOP', 'ARRAY', 'OBJECT', 'CLASS', 'METHOD',
            'PROPERTY', 'CALLBACK', 'PROMISE', 'ASYNC', 'AWAIT', 'FETCH',
            'RESPONSE', 'REQUEST', 'JSON', 'QUERY', 'SELECTOR', 'EVENT'
        ];
        
        // Filter by length and randomize
        return wordPool
            .filter(word => word.length >= config.minWordLength && word.length <= config.maxWordLength)
            .sort(() => Math.random() - 0.5)
            .slice(0, config.wordCount);
    }
    
    function placeWords() {
        words.forEach(word => {
            let placed = false;
            let attempts = 0;
            
            while (!placed && attempts < 100) {
                attempts++;
                const direction = Math.floor(Math.random() * 4); // 0: horizontal, 1: vertical, 2: diagonal down, 3: diagonal up
                const row = Math.floor(Math.random() * config.gridSize);
                const col = Math.floor(Math.random() * config.gridSize);
                
                if (canPlaceWord(word, row, col, direction)) {
                    placed = true;
                    placeWord(word, row, col, direction);
                }
            }
        });
    }
    
    function canPlaceWord(word, row, col, direction) {
        for (let i = 0; i < word.length; i++) {
            let r = row, c = col;
            
            switch (direction) {
                case 0: c += i; break; // Horizontal
                case 1: r += i; break; // Vertical
                case 2: r += i; c += i; break; // Diagonal down
                case 3: r -= i; c += i; break; // Diagonal up
            }
            
            // Check bounds
            if (r < 0 || r >= config.gridSize || c < 0 || c >= config.gridSize) {
                return false;
            }
            
            const index = r * config.gridSize + c;
            // Check if cell is empty or has matching letter
            if (grid[index].letter !== '' && grid[index].letter !== word[i]) {
                return false;
            }
        }
        return true;
    }
    
    function placeWord(word, row, col, direction) {
        for (let i = 0; i < word.length; i++) {
            let r = row, c = col;
            
            switch (direction) {
                case 0: c += i; break;
                case 1: r += i; break;
                case 2: r += i; c += i; break;
                case 3: r -= i; c += i; break;
            }
            
            const index = r * config.gridSize + c;
            grid[index].letter = word[i];
        }
    }
    
    function fillEmptyCells() {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        grid.forEach(cell => {
            if (cell.letter === '') {
                cell.letter = alphabet[Math.floor(Math.random() * alphabet.length)];
            }
        });
    }
    
    function renderGrid() {
        gridElement.style.gridTemplateColumns = `repeat(${config.gridSize}, 1fr)`;
        
        grid.forEach((cell, index) => {
            const cellElement = document.createElement('div');
            cellElement.className = 'wordsearch-cell';
            cellElement.textContent = cell.letter;
            cellElement.dataset.index = index;
            
            // Event listeners for selection
            cellElement.addEventListener('mousedown', startSelection);
            cellElement.addEventListener('mouseenter', continueSelection);
            cellElement.addEventListener('mouseup', endSelection);
            cellElement.addEventListener('touchstart', startSelection);
            cellElement.addEventListener('touchmove', continueSelection);
            cellElement.addEventListener('touchend', endSelection);
            
            gridElement.appendChild(cellElement);
            cell.element = cellElement;
        });
    }
    
    function renderWordList() {
        wordListElement.innerHTML = '';
        words.forEach(word => {
            const wordElement = document.createElement('div');
            wordElement.className = 'wordsearch-word';
            wordElement.textContent = word;
            wordElement.dataset.word = word;
            wordListElement.appendChild(wordElement);
        });
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
        if (!isSelecting) return;
        
        const index = getCellIndex(e.target);
        if (index !== null && !selectedCells.includes(index)) {
            // Only allow adjacent cells
            const lastIndex = selectedCells[selectedCells.length - 1];
            if (areAdjacent(lastIndex, index)) {
                selectedCells.push(index);
                updateSelection();
            }
        }
    }
    
    function endSelection() {
        if (!isSelecting) return;
        isSelecting = false;
        checkSelectedWord();
    }
    
    function getCellIndex(target) {
        // Handle touch events
        if (target.classList.contains('wordsearch-cell')) {
            return parseInt(target.dataset.index);
        }
        return null;
    }
    
    function areAdjacent(index1, index2) {
        const row1 = Math.floor(index1 / config.gridSize);
        const col1 = index1 % config.gridSize;
        const row2 = Math.floor(index2 / config.gridSize);
        const col2 = index2 % config.gridSize;
        
        return Math.abs(row1 - row2) <= 1 && Math.abs(col1 - col2) <= 1;
    }
    
    function updateSelection() {
        // Clear previous selection
        grid.forEach(cell => {
            cell.element.classList.remove('selected');
        });
        
        // Apply new selection
        selectedCells.forEach(index => {
            grid[index].element.classList.add('selected');
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
        
        // Check if word is in the list (forward or backward)
        const matchedWord = words.find(word => 
            word === selectedWord || word === reversedWord
        );
        
        if (matchedWord && !foundWords.includes(matchedWord)) {
            // Mark as found
            foundWords.push(matchedWord);
            
            // Update cell styles
            selectedCells.forEach(index => {
                grid[index].element.classList.remove('selected');
                grid[index].element.classList.add('found');
            });
            
            // Update word list
            const wordElements = wordListElement.querySelectorAll('.wordsearch-word');
            wordElements.forEach(el => {
                if (el.dataset.word === matchedWord) {
                    el.classList.add('found');
                }
            });
            
            // Update UI
            updateWordsLeft();
            showFeedback(`Found: ${matchedWord}`, 'success');
            
            // Check for game completion
            if (foundWords.length === words.length) {
                clearInterval(timerInterval);
                const timeTaken = Math.floor((Date.now() - startTime) / 1000);
                showFeedback(`Congratulations! You found all words in ${timeTaken} seconds!`, 'success');
            }
        } else {
            showFeedback('Word not found in list', 'error');
        }
        
        selectedCells = [];
        updateSelection();
    }
    
    function updateWordsLeft() {
        wordsLeftElement.textContent = `Words: ${words.length - foundWords.length}/${words.length}`;
    }
    
    function updateTimer() {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timeElement.textContent = `Time: ${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    function showFeedback(message, type) {
        feedbackElement.textContent = message;
        feedbackElement.className = `wordsearch-feedback ${type}`;
    }
    
    function giveHint() {
        const remainingWords = words.filter(word => !foundWords.includes(word));
        if (remainingWords.length > 0) {
            const hintWord = remainingWords[Math.floor(Math.random() * remainingWords.length)];
            const hint = hintWord.slice(0, 2);
            showFeedback(`Try looking for a word starting with ${hint}...`, 'info');
        } else {
            showFeedback('You found all words!', 'success');
        }
    }
    
    // Event listeners
    newGameBtn.addEventListener('click', initGame);
    hintBtn.addEventListener('click', giveHint);
}