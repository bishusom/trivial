/* global gtag, confetti */

// Game configuration
const SUDOKU_CONFIG = {
    difficulties: {
        easy: { name: "Easy", emptyCells: 40 },
        medium: { name: "Medium", emptyCells: 50 },
        hard: { name: "Hard", emptyCells: 60 }
    },
    baseHints: 3,
    timeLimit: 600 // 10 minutes in seconds
};

// Game state
const gameState = {
    board: [],
    solution: [],
    difficulty: 'medium',
    emptyCells: 0,
    hintsUsed: 0,
    maxHints: SUDOKU_CONFIG.baseHints,
    selectedCell: null,
    startTime: null,
    timerInterval: null,
    timeElapsed: 0,
    isMuted: JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false,
    stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        bestTime: Infinity
    }
};

// Sound effects
const audioElements = {
    select: new Audio('/audio/click.mp3'),
    correct: new Audio('/audio/correct.mp3'),
    wrong: new Audio('/audio/wrong.mp3'),
    win: new Audio('/audio/win.mp3')
};

// Function to play sound
function playSound(type) {
    if (gameState.isMuted) return;
    if (audioElements[type]) {
        audioElements[type].currentTime = 0;
        audioElements[type].play().catch(err => console.error(`Error playing ${type} sound:`, err));
    }
}

// Initialize the Sudoku board
function initBoard() {
    gameState.board = Array(9).fill().map(() => Array(9).fill(0));
    gameState.solution = Array(9).fill().map(() => Array(9).fill(0));
    gameState.selectedCell = null;
    gameState.hintsUsed = 0;
    gameState.timeElapsed = 0;
    clearInterval(gameState.timerInterval);
    
    // Generate a complete valid Sudoku solution
    generateSolution(0, 0);
    
    // Create a playable board by removing some numbers
    createPlayableBoard();
    
    // Start timer
    gameState.startTime = Date.now();
    gameState.timerInterval = setInterval(updateTimer, 1000);
    
    updateUI();
}

// Generate a valid Sudoku solution using backtracking
function generateSolution(row, col) {
    if (row === 9) return true;
    
    const nextRow = col === 8 ? row + 1 : row;
    const nextCol = col === 8 ? 0 : col + 1;
    
    // If cell is already filled, move to next
    if (gameState.solution[row][col] !== 0) {
        return generateSolution(nextRow, nextCol);
    }
    
    // Try numbers 1-9 in random order
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    shuffleArray(numbers);
    
    for (const num of numbers) {
        if (isValidPlacement(gameState.solution, row, col, num)) {
            gameState.solution[row][col] = num;
            if (generateSolution(nextRow, nextCol)) {
                return true;
            }
            gameState.solution[row][col] = 0;
        }
    }
    
    return false;
}

// Create a playable board by removing numbers
function createPlayableBoard() {
    // Copy solution to board
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            gameState.board[i][j] = gameState.solution[i][j];
        }
    }
    
    // Remove cells based on difficulty
    const emptyCells = SUDOKU_CONFIG.difficulties[gameState.difficulty].emptyCells;
    gameState.emptyCells = emptyCells;
    
    let cellsRemoved = 0;
    while (cellsRemoved < emptyCells) {
        const row = Math.floor(Math.random() * 9);
        const col = Math.floor(Math.random() * 9);
        
        if (gameState.board[row][col] !== 0) {
            // Store the value before removing
            const backup = gameState.board[row][col];
            gameState.board[row][col] = 0;
            
            // Check if the puzzle still has a unique solution
            if (countSolutions(JSON.parse(JSON.stringify(gameState.board))) === 1) {
                cellsRemoved++;
            } else {
                // If not unique, put the value back
                gameState.board[row][col] = backup;
            }
        }
    }
}

// Count number of solutions (for ensuring uniqueness)
function countSolutions(board) {
    let count = 0;
    const stack = [];
    
    // Find first empty cell
    let row = 0, col = 0, found = false;
    for (row = 0; row < 9; row++) {
        for (col = 0; col < 9; col++) {
            if (board[row][col] === 0) {
                found = true;
                break;
            }
        }
        if (found) break;
    }
    
    if (!found) return 1; // Board is complete
    
    // Try numbers 1-9
    for (let num = 1; num <= 9; num++) {
        if (isValidPlacement(board, row, col, num)) {
            board[row][col] = num;
            count += countSolutions(board);
            if (count > 1) return count; // Early exit if multiple solutions found
            board[row][col] = 0;
        }
    }
    
    return count;
}

// Check if a number can be placed in a cell
function isValidPlacement(board, row, col, num) {
    // Check row
    for (let i = 0; i < 9; i++) {
        if (board[row][i] === num) return false;
    }
    
    // Check column
    for (let i = 0; i < 9; i++) {
        if (board[i][col] === num) return false;
    }
    
    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[boxRow + i][boxCol + j] === num) return false;
        }
    }
    
    return true;
}

// Shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Update timer display
function updateTimer() {
    gameState.timeElapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    
    const minutes = Math.floor(gameState.timeElapsed / 60);
    const seconds = gameState.timeElapsed % 60;
    
    const timeElement = document.getElementById('puzzle-time');
    if (timeElement) {
        timeElement.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Update UI elements
function updateUI() {
    const gridElement = document.getElementById('sudoku-grid');
    if (gridElement) {
        console.log('Updating Sudoku grid...');
        gridElement.innerHTML = '';
        
        // Create 9 rows
        for (let i = 0; i < 9; i++) {
            const rowElement = document.createElement('div');
            rowElement.className = 'sudoku-row';
            console.log(`Creating row ${i}`);
            
            // Create 9 cells in each row
            for (let j = 0; j < 9; j++) {
                const cell = document.createElement('div');
                cell.className = 'sudoku-cell';
                cell.dataset.row = i;
                cell.dataset.col = j;
                console.log(`Creating cell [${i}][${j}]`);
                
                if (gameState.board[i][j] !== 0) {
                    cell.textContent = gameState.board[i][j];
                    cell.classList.add(gameState.solution[i][j] === gameState.board[i][j] ? 'fixed' : 'user-input');
                }
                
                if (gameState.selectedCell && gameState.selectedCell.row === i && gameState.selectedCell.col === j) {
                    cell.classList.add('selected');
                }
                
                cell.addEventListener('click', () => selectCell(i, j));
                rowElement.appendChild(cell);
            }
            
            gridElement.appendChild(rowElement);
        }
    }
    
    // Update difficulty display
    const difficultyElement = document.getElementById('puzzle-difficulty');
    if (difficultyElement) {
        difficultyElement.textContent = `Difficulty: ${SUDOKU_CONFIG.difficulties[gameState.difficulty].name}`;
    }
    
    // Update hints display
    const hintsElement = document.getElementById('puzzle-hints');
    if (hintsElement) {
        hintsElement.textContent = `Hints left: ${gameState.maxHints - gameState.hintsUsed}`;
    }
    
    // Update stats
    const gamesPlayedElement = document.getElementById('games-played');
    const gamesWonElement = document.getElementById('games-won');
    const bestTimeElement = document.getElementById('best-time');
    
    if (gamesPlayedElement) gamesPlayedElement.textContent = gameState.stats.gamesPlayed;
    if (gamesWonElement) gamesWonElement.textContent = gameState.stats.gamesWon;
    if (bestTimeElement) {
        const minutes = Math.floor(gameState.stats.bestTime / 60);
        const seconds = gameState.stats.bestTime % 60;
        bestTimeElement.textContent = gameState.stats.bestTime === Infinity ? '0:00' : 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Select a cell
function selectCell(row, col) {
    if (gameState.board[row][col] !== 0 && !gameState.selectedCell) return;
    
    // Deselect if clicking the same cell
    if (gameState.selectedCell && gameState.selectedCell.row === row && gameState.selectedCell.col === col) {
        gameState.selectedCell = null;
    } else {
        gameState.selectedCell = { row, col };
    }
    
    updateUI();
    playSound('select');
}

// Fill selected cell with a number
function fillSelectedCell(num) {
    if (!gameState.selectedCell || gameState.board[gameState.selectedCell.row][gameState.selectedCell.col] !== 0) {
        return;
    }
    
    const { row, col } = gameState.selectedCell;
    gameState.board[row][col] = num;
    
    // Check if the number is correct
    if (gameState.board[row][col] === gameState.solution[row][col]) {
        gameState.emptyCells--;
        if (gameState.emptyCells === 0) {
            handleWin();
        }
    } else {
        // Mark as error
        const cellElement = document.querySelector(`.sudoku-cell[data-row="${row}"][data-col="${col}"]`);
        if (cellElement) {
            cellElement.classList.add('error');
            setTimeout(() => cellElement.classList.remove('error'), 500);
        }
        playSound('wrong');
    }
    
    updateUI();
}

// Handle win condition
function handleWin() {
    clearInterval(gameState.timerInterval);
    
    // Update stats
    gameState.stats.gamesPlayed++;
    gameState.stats.gamesWon++;
    if (gameState.timeElapsed < gameState.stats.bestTime) {
        gameState.stats.bestTime = gameState.timeElapsed;
    }
    
    // Show win message
    const feedbackElement = document.getElementById('puzzle-feedback');
    if (feedbackElement) {
        const minutes = Math.floor(gameState.timeElapsed / 60);
        const seconds = gameState.timeElapsed % 60;
        feedbackElement.innerHTML = `
            <div class="feedback-message">
                <strong>🎉 You solved it!</strong><br>
                Time: ${minutes}:${seconds.toString().padStart(2, '0')}<br>
                Difficulty: ${SUDOKU_CONFIG.difficulties[gameState.difficulty].name}
            </div>
        `;
        feedbackElement.className = 'puzzle-feedback feedback-correct';
    }
    
    playSound('win');
    showConfetti();
    
    // Save stats to localStorage
    localStorage.setItem('sudokuStats', JSON.stringify(gameState.stats));
}

// Provide a hint
function provideHint() {
    if (gameState.hintsUsed >= gameState.maxHints) {
        const feedbackElement = document.getElementById('puzzle-feedback');
        if (feedbackElement) {
            feedbackElement.textContent = 'You have used all your hints!';
            feedbackElement.className = 'puzzle-feedback feedback-wrong';
            playSound('wrong');
        }
        return;
    }
    
    // Find an empty cell
    const emptyCells = [];
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (gameState.board[i][j] === 0) {
                emptyCells.push({ row: i, col: j });
            }
        }
    }
    
    if (emptyCells.length === 0) return;
    
    // Select a random empty cell
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    gameState.board[randomCell.row][randomCell.col] = gameState.solution[randomCell.row][randomCell.col];
    gameState.hintsUsed++;
    gameState.emptyCells--;
    
    // Highlight the cell
    const cellElement = document.querySelector(`.sudoku-cell[data-row="${randomCell.row}"][data-col="${randomCell.col}"]`);
    if (cellElement) {
        cellElement.classList.add('highlighted');
        setTimeout(() => cellElement.classList.remove('highlighted'), 1000);
    }
    
    if (gameState.emptyCells === 0) {
        handleWin();
    }
    
    updateUI();
    playSound('correct');
}

// Check current board for errors
function checkBoard() {
    let hasErrors = false;
    
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (gameState.board[i][j] !== 0 && gameState.board[i][j] !== gameState.solution[i][j]) {
                hasErrors = true;
                const cellElement = document.querySelector(`.sudoku-cell[data-row="${i}"][data-col="${j}"]`);
                if (cellElement) {
                    cellElement.classList.add('error');
                    setTimeout(() => cellElement.classList.remove('error'), 1000);
                }
            }
        }
    }
    
    const feedbackElement = document.getElementById('puzzle-feedback');
    if (feedbackElement) {
        if (hasErrors) {
            feedbackElement.textContent = 'There are errors in your solution.';
            feedbackElement.className = 'puzzle-feedback feedback-wrong';
            playSound('wrong');
        } else {
            feedbackElement.textContent = 'No errors found so far!';
            feedbackElement.className = 'puzzle-feedback feedback-correct';
            playSound('correct');
        }
    }
}

// Show confetti
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

// Initialize number selector buttons
function initNumberSelector() {
    const numberSelector = document.getElementById('number-selector');
    if (!numberSelector) return;
    
    numberSelector.innerHTML = '';
    
    // Create buttons for numbers 1-9
    for (let i = 1; i <= 9; i++) {
        const btn = document.createElement('button');
        btn.className = 'number-btn';
        btn.textContent = i;
        btn.addEventListener('click', () => fillSelectedCell(i));
        numberSelector.appendChild(btn);
    }
    
    // Add clear button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'number-btn clear';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
        if (gameState.selectedCell) {
            const { row, col } = gameState.selectedCell;
            if (gameState.board[row][col] !== 0 && gameState.board[row][col] !== gameState.solution[row][col]) {
                gameState.board[row][col] = 0;
                gameState.emptyCells++;
                updateUI();
                playSound('select');
            }
        }
    });
    numberSelector.appendChild(clearBtn);
}

// Setup event listeners
function setupEventListeners() {
    // Hint button
    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) {
        hintBtn.addEventListener('click', provideHint);
    }
    
    // Check button
    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
        checkBtn.addEventListener('click', checkBoard);
    }
    
    // New game button
    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', initBoard);
    }
    
    // Mute button
    const muteBtn = document.getElementById('mute-btn');
    const muteBtnIcon = document.querySelector('#mute-btn .material-icons');
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            gameState.isMuted = !gameState.isMuted;
            localStorage.setItem('triviaMasterMuteState', gameState.isMuted);
            if (muteBtnIcon) {
                muteBtnIcon.textContent = gameState.isMuted ? 'volume_off' : 'volume_up';
            }
        });
    }
    
    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (!gameState.selectedCell) return;
        
        const key = e.key;
        if (key >= '1' && key <= '9') {
            fillSelectedCell(parseInt(key));
        } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
            const { row, col } = gameState.selectedCell;
            if (gameState.board[row][col] !== 0 && gameState.board[row][col] !== gameState.solution[row][col]) {
                gameState.board[row][col] = 0;
                gameState.emptyCells++;
                updateUI();
                playSound('select');
            }
        } else if (key === 'ArrowUp' && gameState.selectedCell.row > 0) {
            selectCell(gameState.selectedCell.row - 1, gameState.selectedCell.col);
        } else if (key === 'ArrowDown' && gameState.selectedCell.row < 8) {
            selectCell(gameState.selectedCell.row + 1, gameState.selectedCell.col);
        } else if (key === 'ArrowLeft' && gameState.selectedCell.col > 0) {
            selectCell(gameState.selectedCell.row, gameState.selectedCell.col - 1);
        } else if (key === 'ArrowRight' && gameState.selectedCell.col < 8) {
            selectCell(gameState.selectedCell.row, gameState.selectedCell.col + 1);
        }
    });
}

// Load stats from localStorage
function loadStats() {
    const savedStats = localStorage.getItem('sudokuStats');
    if (savedStats) {
        try {
            gameState.stats = JSON.parse(savedStats);
        } catch (e) {
            console.error('Failed to parse saved stats', e);
        }
    }
}

// Initialize the game
function initPuzzle() {
    loadStats();
    initNumberSelector();
    setupEventListeners();
    initBoard();
    
    // Set initial mute state
    const muteBtnIcon = document.querySelector('#mute-btn .material-icons');
    if (muteBtnIcon) {
        muteBtnIcon.textContent = gameState.isMuted ? 'volume_off' : 'volume_up';
    }
}

export { initPuzzle };