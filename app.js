// DOM Elements
const questionEl = document.getElementById("question");
const optionsEl = document.getElementById("options");
const nextBtn = document.getElementById("next-btn");
const scoreEl = document.getElementById("score");
const resultEl = document.getElementById("result");
const timerEl = document.getElementById("timer");
const highscoreEl = document.getElementById("highscore");

// Game State
let questions = [];
let currentQuestion = 0;
let score = 0;
let timeLeft = 15;
let timerId;
let highScores = JSON.parse(localStorage.getItem("highScores")) || [];

// Initialize Game
async function initGame() {
    try {
        questions = await fetchQuestions();
        showQuestion();
        updateHighScoreDisplay();
    } catch (error) {
        questionEl.textContent = "Failed to load questions. Please try again later.";
    }
}

// Fetch Questions from Open Trivia DB
async function fetchQuestions() {
    const response = await fetch("https://opentdb.com/api.php?amount=10&type=multiple");
    const data = await response.json();
    return data.results.map(q => ({
        question: decodeURIComponent(q.question),
        correct_answer: decodeURIComponent(q.correct_answer),
        incorrect_answers: q.incorrect_answers.map(a => decodeURIComponent(a))
    }));
}

// Display Question
function showQuestion() {
    resetTimer();
    startTimer();
    
    const question = questions[currentQuestion];
    const options = shuffle([...question.incorrect_answers, question.correct_answer]);
    
    questionEl.innerHTML = question.question;
    optionsEl.innerHTML = "";
    
    options.forEach(option => {
        const button = document.createElement("button");
        button.className = "option-btn";
        button.innerHTML = option;
        button.onclick = () => checkAnswer(option === question.correct_answer);
        optionsEl.appendChild(button);
    });
}

// Check Answer
function checkAnswer(isCorrect) {
    clearInterval(timerId);
    if (isCorrect) {
        score += timeLeft * 10; // Bonus points for remaining time
        scoreEl.textContent = `Score: ${score}`;
        resultEl.textContent = "Correct! 🎉";
    } else {
        resultEl.textContent = "Wrong! ❌";
    }
    nextBtn.classList.remove("hidden");
}

// Timer Functions
function startTimer() {
    timeLeft = 15;
    timerEl.textContent = `Time: ${timeLeft}s`;
    
    timerId = setInterval(() => {
        timeLeft--;
        timerEl.textContent = `Time: ${timeLeft}s`;
        
        if (timeLeft <= 0) {
            clearInterval(timerId);
            checkAnswer(false);
        }
    }, 1000);
}

function resetTimer() {
    clearInterval(timerId);
    timerEl.textContent = `Time: 15s`;
}

// Next Question
nextBtn.addEventListener("click", () => {
    currentQuestion++;
    resultEl.textContent = "";
    nextBtn.classList.add("hidden");
    
    if (currentQuestion < questions.length) {
        showQuestion();
    } else {
        endGame();
    }
});

// End Game
function endGame() {
    questionEl.textContent = `Game Over! Final Score: ${score}`;
    optionsEl.innerHTML = "";
    timerEl.textContent = "";
    saveHighScore();
    updateHighScoreDisplay();
}

// High Scores
function saveHighScore() {
    const name = prompt("Enter your name for the high score board:", "Anonymous");
    highScores.push({ name, score });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 5); // Keep top 5 scores
    localStorage.setItem("highScores", JSON.stringify(highScores));
}

function updateHighScoreDisplay() {
    highscoreEl.innerHTML = "<h3>High Scores</h3>" + 
        highScores.map((entry, index) => 
            `${index + 1}. ${entry.name}: ${entry.score}`
        ).join("<br>");
}

// Utility Functions
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Start the game
initGame();
