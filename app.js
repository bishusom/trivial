// DOM Elements
const setupScreen = document.querySelector('.setup-screen');
const gameScreen = document.querySelector('.game-screen');
const summaryScreen = document.querySelector('.summary-screen');
const questionCounterEl = document.getElementById('question-counter');
const questionTimerEl = document.getElementById('question-timer');
const totalTimerEl = document.getElementById('total-timer');
const categorySelect = document.getElementById('category');
const difficultySelect = document.getElementById('difficulty');
const startBtn = document.getElementById('start-btn');
const questionEl = document.getElementById('question');
const optionsEl = document.getElementById('options');
const nextBtn = document.getElementById('next-btn');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const highscoresList = document.getElementById('highscores-list');
const summaryScreen = document.querySelector('.summary-screen');



// Game State
let totalTimeLeft = 150; // 2 minutes 30 seconds for 10 questions
let totalTimerId;
let questions = [];
let currentQuestion = 0;
let score = 0;
let timeLeft = 15;
let timerId;
let answersLog = [];
let highScores = JSON.parse(localStorage.getItem('highScores')) || [];
const fallbackCategories = [
    { id: '', name: "All Categories" },
    { id: 9, name: "General Knowledge" },
    { id: 10, name: "Books" },
    { id: 17, name: "Science & Nature" },
    { id: 11, name: "Film" },
    { id: 12, name: "Music" },
    { id :23, name:"History"},
    { id :24, name:"Politics"},
    { id :26, name:"Celebrities"}    
];



// Modified showQuestion with animation
function showQuestion() {
    resetTimer();
    startTimer();
    
    // Animate question entrance
    questionEl.style.animation = 'slideIn 0.3s ease-out';
    optionsEl.style.animation = 'fadeIn 0.5s ease-out';
    
    const question = questions[currentQuestion];
    questionEl.innerHTML = `
        ${question.question}
        <div class="question-category">${question.category}</div>
    `;

    // Create options with animation delay
    optionsEl.innerHTML = '';
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.innerHTML = option;
        button.style.animationDelay = `${index * 0.1}s`;
        button.addEventListener('click', () => checkAnswer(option === question.correct));
        optionsEl.appendChild(button);
    });

    // Reset animations after completion
    setTimeout(() => {
        questionEl.style.animation = '';
        optionsEl.style.animation = '';
    }, 500);
}

// Updated checkAnswer with animations
function checkAnswer(isCorrect) {
    clearInterval(timerId);
    const correctAnswer = questions[currentQuestion].correct;
    
    // Animate options
    optionsEl.querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === correctAnswer) {
            btn.classList.add('correct-answer');
        } else {
            btn.classList.add('wrong-answer');
        }
    });

    // Log answer
    answersLog.push({
        question: questions[currentQuestion].question,
        correct: correctAnswer,
        selected: isCorrect ? correctAnswer : '',
        isCorrect
    });

    if (isCorrect) {
        score += timeLeft * 10;
        scoreEl.textContent = score;
        resultEl.textContent = "Correct! 🎉";
    } else {
        resultEl.textContent = `Wrong! Correct answer: ${correctAnswer}`;
    }

    nextBtn.classList.remove('hidden');
}

// New summary screen implementation
function showSummary() {
    gameScreen.classList.add('hidden');
    summaryScreen.classList.remove('hidden');
    
    const summaryHTML = `
        <h2>Game Summary</h2>
        <div class="final-score">Final Score: ${score}</div>
        <div class="summary-grid">
            ${answersLog.map((answer, index) => `
                <div class="summary-item ${answer.isCorrect ? 'correct' : 'wrong'}">
                    <div class="question-number">Q${index + 1}</div>
                    <div class="question-text">${answer.question}</div>
                    ${!answer.isCorrect ? `
                        <div class="correct-answer">Correct: ${answer.correct}</div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        <button class="btn primary" onclick="location.reload()">
            <span class="material-icons">replay</span>
            Play Again
        </button>
    `;
    
    summaryScreen.innerHTML = summaryHTML;
    summaryScreen.style.animation = 'slideUp 0.5s ease-out';
}

// Modified endGame
function endGame() {
    clearInterval(totalTimerId);
    showSummary();
    saveHighScore();
}

// Add to CSS
const newStyles = `
    /* Animations */
    @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes slideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
    }

    .correct-answer {
        animation: correctPulse 0.5s ease-out;
        background: #e6f4ea !important;
        border-color: #34a853 !important;
    }

    .wrong-answer {
        animation: wrongShake 0.5s ease-out;
        background: #fce8e6 !important;
        border-color: #ea4335 !important;
    }

    @keyframes correctPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }

    @keyframes wrongShake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }

    /* Summary Screen */
    .summary-screen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: white;
        padding: 2rem;
        overflow-y: auto;
    }

    .summary-grid {
        display: grid;
        gap: 1rem;
        margin: 2rem 0;
    }

    .summary-item {
        padding: 1rem;
        border-radius: 8px;
        animation: slideIn 0.3s ease-out;
    }

    .summary-item.correct {
        background: #e6f4ea;
        border-left: 4px solid #34a853;
    }

    .summary-item.wrong {
        background: #fce8e6;
        border-left: 4px solid #ea4335;
    }

    .final-score {
        font-size: 1.5rem;
        text-align: center;
        margin: 1rem 0;
        color: #1a73e8;
    }
`;

// Add new styles to document
const styleSheet = document.createElement('style');
styleSheet.innerHTML = newStyles;
document.head.appendChild(styleSheet);


// Initialize Categories
async function initCategories() {
    try {
        categorySelect.classList.add('loading');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Removed CORS proxy
        const response = await fetch('https://opentdb.com/api_category.php', {
            signal: controller.signal
        });

        if (!response.ok) throw new Error('Server error');
        
        const data = await response.json();
        populateCategories([{ id: '', name: "All Categories" }, ...data.trivia_categories]);
    } catch (error) {
        console.error('Using fallback categories:', error);
        populateCategories(fallbackCategories);
        showError('Couldn\'t load categories. Using fallback data.');
    } finally {
        categorySelect.classList.remove('loading');
    }
}

function populateCategories(categories) {
    categorySelect.innerHTML = categories.map(cat => `
        <option value="${cat.id}" ${cat.id === '' ? 'selected' : ''}>
            ${cat.name}
        </option>
    `).join('');
}

// Fetch Questions
async function fetchQuestions(category, difficulty) {
    try {
        startBtn.classList.add('loading');
        // Direct API call without proxy
        const url = new URL('https://opentdb.com/api.php');
        // Rest of the function remains the same
        url.searchParams.append('amount', 10);
        if (category) url.searchParams.append('category', category);
        if (difficulty) url.searchParams.append('difficulty', difficulty);
        url.searchParams.append('type', 'multiple');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('API Error');
        
        const data = await response.json();
        if (data.response_code !== 0) throw new Error('No results');
        
        return data.results.map(q => ({
            question: decodeHTML(q.question),
            correct: decodeHTML(q.correct_answer),
            options: shuffle([...q.incorrect_answers.map(decodeHTML), decodeHTML(q.correct_answer)]),
            category: q.category
        }));
    } catch (error) {
        console.error('Fetch questions failed:', error);
        showError('Failed to load questions. Please try again later.');
        return [];
    } finally {
        startBtn.classList.remove('loading');
    }
}

// Game Functions
// Modified showQuestion
function showQuestion() {
    questionCounterEl.textContent = `${currentQuestion + 1}/10`;
    resetTimer();
    startTimer();
    
    const question = questions[currentQuestion];
    questionEl.innerHTML = `
        ${question.question}
        <div class="question-category">${question.category}</div>
    `;
    
    optionsEl.innerHTML = '';
    question.options.forEach(option => {
        const button = document.createElement('button');
        button.innerHTML = option;
        button.addEventListener('click', () => checkAnswer(option === question.correct));
        optionsEl.appendChild(button);
    });
}

function checkAnswer(isCorrect) {
    clearInterval(timerId);
    optionsEl.querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        btn.style.backgroundColor = btn.textContent === questions[currentQuestion].correct ? 
            '#e6f4ea' : '#fce8e6';
    });
    
    if (isCorrect) {
        score += timeLeft * 10;
        scoreEl.textContent = score;
    }
    
    nextBtn.classList.remove('hidden');
}

// Timer Functions
// Modified startTimer function
function startTimer() {
    // Question timer
    timeLeft = 15;
    questionTimerEl.textContent = timeLeft;
    
    timerId = setInterval(() => {
        timeLeft--;
        questionTimerEl.textContent = timeLeft;
        if (timeLeft <= 0) checkAnswer(false);
    }, 1000);

    // Total timer
    totalTimerId = setInterval(() => {
        totalTimeLeft--;
        const minutes = Math.floor(totalTimeLeft / 60);
        const seconds = totalTimeLeft % 60;
        totalTimerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (totalTimeLeft <= 0) {
            clearInterval(totalTimerId);
            endGame();
        }
    }, 1000);
}


// Modified resetTimer
function resetTimer() {
    clearInterval(timerId);
    clearInterval(totalTimerId);
    questionTimerEl.textContent = '15';
}

// Navigation
nextBtn.addEventListener('click', () => {
    nextBtn.classList.add('hidden');
    currentQuestion++;
    
    if (currentQuestion < questions.length) {
        showQuestion();
    } else {
        endGame();
    }
});

// High Scores
function saveHighScore() {
    const name = prompt('Enter your name:', 'Anonymous');
    highScores.push({ name, score });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 5);
    localStorage.setItem('highScores', JSON.stringify(highScores));
    updateHighScores();
}

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

// Helpers
function decodeHTML(text) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function showError(message) {
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.innerHTML = `
        <span class="material-icons">error_outline</span>
        ${message}
    `;
    document.body.prepend(errorEl);
    setTimeout(() => errorEl.remove(), 5000);
}

// Event Listeners
startBtn.addEventListener('click', async () => {
     // Reset timers
    totalTimeLeft = 150;
    totalTimerEl.textContent = '2:30';
    startBtn.disabled = true;
    startBtn.innerHTML = `<span class="material-icons">autorenew</span> Loading...`;
    
    try {
        questions = await fetchQuestions(
            categorySelect.value || undefined,
            difficultySelect.value || undefined
        );
        
        if (questions.length > 0) {
            setupScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            score = 0;
            currentQuestion = 0;
            scoreEl.textContent = '0';
            showQuestion();
        }
    } catch (error) {
        showError('Failed to start game. Please try again.');
    }
    
    startBtn.disabled = false;
    startBtn.innerHTML = `<span class="material-icons">play_arrow</span> Start Game`;
});

// Initialize
initCategories();
updateHighScores();


