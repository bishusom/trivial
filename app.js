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

// Initialize Categories
async function initCategories() {
    try {
        const response = await fetch('https://opentdb.com/api_category.php');
        const data = await response.json();
        populateCategories(data.trivia_categories);
    } catch (error) {
        categorySelect.innerHTML = `
            <option value="9">General Knowledge</option>
            <option value="10">Books</option>
            <option value="17">Science & Nature</option>
        `;
    }
}

function populateCategories(categories) {
    categorySelect.innerHTML = categories.map(cat => `
        <option value="${cat.id}">${cat.name}</option>
    `).join('');
}

// Start Game
startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.innerHTML = `<span class="material-icons">autorenew</span> Loading...`;
    
    try {
        questions = await fetchQuestions(
            categorySelect.value,
            difficultySelect.value
        );
        
        if (questions.length > 0) {
            setupScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            showQuestion();
            updateHighScores();
        } else {
            alert('No questions found for this category!');
        }
    } catch (error) {
        alert('Failed to load questions. Please try again.');
    }
    
    startBtn.disabled = false;
    startBtn.innerHTML = `<span class="material-icons">play_arrow</span> Start Game`;
});

// Fetch Questions
async function fetchQuestions(category, difficulty) {
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
}

// Show Question
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

// Check Answer
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
   
