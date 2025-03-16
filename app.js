/* 
 * Trivia Master Game Logic
 * Features:
 * - Category selection from Open Trivia DB
 * - 10 questions per game with 15s/question
 * - Total game timer (2.5 minutes)
 * - Score tracking with time bonuses
 * - High score system with localStorage
 * - Animated transitions and feedback
 * - Detailed end-game summary
 */

// ======================
// DOM Element References
// ======================
const setupScreen = document.querySelector('.setup-screen');
const gameScreen = document.querySelector('.game-screen');
const summaryScreen = document.querySelector('.summary-screen');
const categorySelect = document.getElementById('category');
const difficultySelect = document.getElementById('difficulty');
const startBtn = document.getElementById('start-btn');
const questionEl = document.getElementById('question');
const optionsEl = document.getElementById('options');
const nextBtn = document.getElementById('next-btn');
const scoreEl = document.getElementById('score');
const questionCounterEl = document.getElementById('question-counter');
const questionTimerEl = document.getElementById('question-timer');
const totalTimerEl = document.getElementById('total-timer');
const highscoresList = document.getElementById('highscores-list');
const restartBtn = document.getElementById('restart-btn');
const resultEl = document.getElementById('result');

// =================
// Game State
// =================
let questions = [];               // Array to store current game questions
let currentQuestion = 0;          // Index of current question (0-9)
let score = 0;                    // Player's current score
let timeLeft = 15;                // Time left for current question
let totalTimeLeft = 150;          // Total time left (2.5 minutes in seconds)
let timerId;                      // Interval ID for question timer
let totalTimerId;                 // Interval ID for total timer
let highScores = JSON.parse(localStorage.getItem('highScores')) || [];  // High scores
let answersLog = [];              // Track answers for summary screen
let isScoreSaved = false;         // Tracks completed games
// Fallback categories if API fails
const fallbackCategories = [
    { id: '', name: "All Categories" },
    { id: 9, name: "General Knowledge" },
    { id: 10, name: "Books" },
    { id: 17, name: "Science & Nature" }
];

// ======================
// Initialization Functions
// ======================

/**
 * Initialize categories from Open Trivia DB API
 * Uses fallback categories if API fails
 */
async function initCategories() {
    try {
        categorySelect.classList.add('loading');
        const response = await fetch('https://opentdb.com/api_category.php');
        
        if (!response.ok) throw new Error('Server error');
        
        const data = await response.json();
        populateCategories([{ id: '', name: "All Categories" }, ...data.trivia_categories]);
    } catch (error) {
        console.error('Using fallback categories:', error);
        populateCategories(fallbackCategories);
    } finally {
        categorySelect.classList.remove('loading');
    }
}

/**
 * Populate category select dropdown
 * @param {Array} categories - Array of category objects
 */
function populateCategories(categories) {
    categorySelect.innerHTML = categories.map(cat => `
        <option value="${cat.id}">${cat.name}</option>
    `).join('');
}

// ======================
// Question Handling
// ======================

/**
 * Fetch questions from Open Trivia DB API
 * @param {string} category - Selected category ID
 * @param {string} difficulty - Selected difficulty
 * @returns {Array} - Array of question objects
 */
async function fetchQuestions(category, difficulty) {
    try {
        const url = new URL('https://opentdb.com/api.php');
        url.searchParams.append('amount', 10);
        if (category) url.searchParams.append('category', category);
        if (difficulty) url.searchParams.append('difficulty', difficulty);
        url.searchParams.append('type', 'multiple');

        const response = await fetch(url);
        const data = await response.json();
        
        return data.results.map(q => ({
            question: decodeHTML(q.question),
            correct: decodeHTML(q.correct_answer),
            options: shuffle([...q.incorrect_answers.map(decodeHTML), decodeHTML(q.correct_answer)]),
            category: q.category
        }));
    } catch (error) {
        console.error('Failed to fetch questions:', error);
        return [];
    }
}

/**
 * Display current question with animations
 */
function showQuestion() {
    // Ensure questions exist
    if (!questions.length) {
        console.error('No questions loaded');
        return;
    }

    // Validate current question index
    if (currentQuestion < 0 || currentQuestion >= questions.length) {
        console.error('Invalid question index:', currentQuestion);
        return;
    }

    // Hide next button if last question
    if (currentQuestion === 9) {
        nextBtn.classList.add('hidden');
    } else {
        nextBtn.classList.add('hidden'); // Ensure hidden initially
    }
    // Safely update question text
    if (questionEl) {
        questionEl.textContent = questions[currentQuestion].question;
    } else {
        console.error('Question element not found');
        return;
    }
    
    // Update question counter
    //questionCounterEl.textContent = 0
    questionCounterEl.textContent = `${currentQuestion + 1}/10`;
    
    
    const question = questions[currentQuestion];
    questionEl.innerHTML = `
        ${question.question}
        <div class="question-category">${question.category}</div>
    `;

    // Create answer buttons with staggered animation
    optionsEl.innerHTML = '';
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.innerHTML = option;
        button.style.animationDelay = `${index * 0.1}s`;
        button.onclick = () => checkAnswer(option === question.correct);
        optionsEl.appendChild(button);
    });

    // Start timers
    startTimer();
}

// ======================
// Timer Functions
// ======================

/**
 * Start both question and total timers
 */
function startTimer() {
    timeLeft = 15;
    questionTimerEl.textContent = timeLeft;
    
    timerId = setInterval(() => {
        timeLeft--;
        questionTimerEl.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            checkAnswer(false);
            if (currentQuestion === 9) endGame();
        }
    }, 1000);
}

/**
 * Reset all timers
 */
function resetTimer() {
    clearInterval(timerId);
    clearInterval(totalTimerId);
    questionTimerEl.textContent = '15';
    questionCounterEl.textContent = '0'
}

// ======================
// Game Logic
// ======================

/**
 * Check if selected answer is correct
 * @param {boolean} isCorrect - Whether answer is correct
 */
function checkAnswer(isCorrect) {
    clearInterval(timerId);
    const question = questions[currentQuestion];
    
    optionsEl.querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === question.correct) {
            btn.classList.add('correct');
        } else {
            btn.classList.add('wrong');
        }
    });

    // Update answer log
    answersLog.push({
        question: question.question,
        correct: question.correct,
        selected: isCorrect ? question.correct : '',
        isCorrect
    });

    if (isCorrect) {
        score += timeLeft * 10;
        scoreEl.textContent = score;
    }

    // Modified next button handling
    if (currentQuestion === 9) { // Last question
        setTimeout(endGame, 1000); // Show summary after 1 second
    } else {
        nextBtn.classList.remove('hidden');
    }
} // Only ONE closing brace here

/**
 * Handle next question or end game
 */
function handleNextQuestion() {
    currentQuestion++;
    if (currentQuestion < 10) {
        showQuestion();
    } else {
        endGame();
    }
}

// Ensure clean restart function
function restartGame() {
    // Reset game state
    currentQuestion = 0;
    score = 0;
    timeLeft = 15;
    totalTimeLeft = 150;
    answersLog = [];
    isScoreSaved = false;

    // Clear DOM elements safely
    optionsEl.innerHTML = '';
    questionEl.innerHTML = '';
    if (resultEl) resultEl.textContent = ''; // Safe check
    
    // Reset UI elements
    scoreEl.textContent = '0';
    questionCounterEl.textContent = '0/10';
    questionTimerEl.textContent = '15';
    totalTimerEl.textContent = '2:30';
    
    // Show setup screen
    summaryScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    
    // Re-enable interactions
    document.body.classList.remove('game-ended');
}

// New summary screen implementation
function showSummary() {
    const timeUsed = 150 - totalTimeLeft;
    const correctCount = answersLog.filter(a => a.isCorrect).length;
    const performanceScore = (correctCount * 100) + (150 - timeUsed);
    
    let message;
    if (performanceScore >= 1300) {
        message = `🎉 Legendary! You're a trivia master! 🏆 (Top 1% Performance)`;
    } else if (performanceScore >= 1000) {
        message = `👑 Excellent! Your knowledge shines bright! ✨`;
    } else if (performanceScore >= 700) {
        message = `👍 Good effort! Room to grow! 📚`;
    } else {
        message = `💤 Wake up! Time to hit the books! 📖`;
    }

    summaryScreen.innerHTML = `
        <h2>Game Report Card</h2>
        <div class="performance-card ${performanceScore >= 1000 ? 'gold' : performanceScore >= 700 ? 'silver' : 'bronze'}">
            <div class="stats-grid">
                <div class="stat-box correct">
                    <span class="material-icons">check_circle</span>
                    <h3>${correctCount}</h3>
                    <p>Correct Answers</p>
                </div>
                <div class="stat-box time">
                    <span class="material-icons">timer</span>
                    <h3>${Math.floor(timeUsed/60)}m ${timeUsed%60}s</h3>
                    <p>Total Time</p>
                </div>
            </div>
            <div class="performance-message">${message}</div>
        </div>

        <button class="btn primary" id="restart-btn">
            <span class="material-icons">replay</span>
            Try Again
        </button>
    `;

    // Add event listener properly
    //document.getElementById('restart-btn').addEventListener('click', restartGame);

    // Proper event listener binding
    const restartButton = document.getElementById('restart-btn');
    if (restartButton) {
        restartButton.addEventListener('click', restartGame);
    } else {
        console.error('Restart button not found');
    }
}

/**
 * End game and show summary
 */
function endGame() {
    clearInterval(timerId);
    clearInterval(totalTimerId);
    
    // Hide game screen and show summary
    gameScreen.classList.add('hidden');
    summaryScreen.classList.remove('hidden'); // Add this line
    showSummary();
    saveHighScore();
    
    // Disable all interactions
    optionsEl.querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
    });
}
/*function endGame() {
    try {
        
        if (isScoreSaved) return;
    
        // Add this line
        document.body.classList.add('game-ended');


        // Hide game screen
        gameScreen.classList.add('hidden');
        
        // Clear timers
        clearInterval(timerId);
        clearInterval(totalTimerId);
        
        // Show summary screen
        summaryScreen.classList.remove('hidden');
        summaryScreen.style.display = 'block';
        
        // Generate summary content
        showSummary();
        
        // Save high score
        saveHighScore();

    } catch (error) {
        console.error('Error ending game:', error);
        alert('Game ended unexpectedly. Please refresh the page.');
    }
} */

// ======================
// High Score System
// ======================

/**
 * Save score to localStorage
 */
function saveHighScore() {
    try {
        // Prevent multiple saves
        if (isScoreSaved) return;
        isScoreSaved = true;

        // Only save if score > 0 and in top 5
        const minScore = highScores.length ? 
            Math.min(...highScores.map(h => h.score)) : 0;

        if (score > 0 && (highScores.length < 5 || score > minScore)) {
            const name = prompt('Enter your name for the leaderboard:', 'Anonymous') || 'Anonymous';
            
            highScores.push({ name, score });
            highScores.sort((a, b) => b.score - a.score);
            highScores = highScores.slice(0, 5);
            
            localStorage.setItem('highScores', JSON.stringify(highScores));
            updateHighScores();
        }
    } catch (error) {
        console.error('Error saving high score:', error);
    }
}

/**
 * Update high score display
 */
function updateHighScores() {
    highscoresList.innerHTML = highScores
        .map((entry, index) => `
            <div class="highscore-entry">
                <span class="rank">${index + 1}.</span>
                <span class="name">${entry.name}</span>
                <span class="score">${entry.score}</span>
            </div>
        `).join('');
}

// ======================
// Helper Functions
// ======================

/**
 * Decode HTML entities in questions/answers
 * @param {string} text - Text to decode
 * @returns {string} Decoded text
 */
function decodeHTML(text) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}

/**
 * Fisher-Yates shuffle algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ======================
// Event Listeners
// ======================

// Start game button
startBtn.addEventListener('click', async () => {
    // Reset game state
    questions = await fetchQuestions(categorySelect.value, difficultySelect.value);
    currentQuestion = 0;
    //questionCounterEl = 0;
    score = 0;
    answersLog = [];
    
    if (questions.length > 0) {
        setupScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        showQuestion();
    }
});

// Next question button
nextBtn.addEventListener('click', handleNextQuestion);

// ======================
// Initial Setup
// ======================
initCategories();
updateHighScores();
