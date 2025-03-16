// DOM Elements
const setupScreen = document.querySelector('.setup-screen');
const gameScreen = document.querySelector('.game-screen');
const categorySelect = document.getElementById('category');
const difficultySelect = document.getElementById('difficulty');
const startBtn = document.getElementById('start-btn');
const questionEl = document.getElementById('question');
const optionsEl = document.getElementById('options');
const nextBtn = document.getElementById('next-btn');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const highscoresList = document.getElementById('highscores-list');

// Game State
let questions = [];
let currentQuestion = 0;
let score = 0;
let timeLeft = 15;
let timerId;
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

// Initialize Categories
async function initCategories() {
    try {
        categorySelect.classList.add('loading');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('https://cors-anywhere.herokuapp.com/https://opentdb.com/api_category.php', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

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
        const url = new URL('https://cors-anywhere.herokuapp.com/https://opentdb.com/api.php');
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
function showQuestion() {
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
function startTimer() {
    timeLeft = 15;
    timerEl.textContent = timeLeft;
    
    timerId = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        
        if (timeLeft <= 0) checkAnswer(false);
    }, 1000);
}

function resetTimer() {
    clearInterval(timerId);
    timerEl.textContent = '15';
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
