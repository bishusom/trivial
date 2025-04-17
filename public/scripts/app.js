/* 
 * Trivia Master Game Logic - Optimized
 * Features:
 * - User-selectable questions/time
 * - Compact summary screen
 * - Optimized code structure
 * - Better error handling
 */

// ======================
// DOM Element References
// ======================
const mainNav = document.querySelector('.main-nav');
const setupScreen = document.querySelector('.setup-screen');
const gameScreen = document.querySelector('.game-screen');
const summaryScreen = document.querySelector('.summary-screen');
const categorySelect = document.getElementById('category');
const difficultyPicker = document.getElementById('difficulty');
const numQuestionsSelect = document.getElementById('num-questions');
const timePerQuestionSelect = document.getElementById('time-per-question');
const startBtn = document.getElementById('start-btn');
const questionEl = document.getElementById('question');
const optionsEl = document.getElementById('options');
const nextBtn = document.getElementById('next-btn');
const scoreEl = document.getElementById('score');
const questionCounterEl = document.getElementById('question-counter');
const questionTimerEl = document.getElementById('question-timer');
const totalTimerEl = document.getElementById('total-timer');
const highscores = document.querySelector('.highscores');
const highscoresList = document.getElementById('highscores-list');
const audioElements = {
    tick: createAudioElement('/audio/tick.mp3'),
    correct: createAudioElement('/audio/correct.mp3'),
    wrong: createAudioElement('/audio/wrong.mp3')
};

// ======================
// Game State
// ======================
let isMuted = false;
let selectedQuestions = 10;
let selectedTime = 15;
let selectedDifficulty = 'easy'
let questions = [];
let currentQuestion = 0;
let score = 0;
let timeLeft = 15;
let totalTimeLeft = 150;
let timerId;
let totalTimerId;
let highScores = JSON.parse(localStorage.getItem('highScores')) || [];
let answersLog = [];
let isScoreSaved = false;
let isNextQuestionPending = false;

// ======================
// Core Functions
// ======================

// Initialization
const CACHE_VERSION = 'v1';
const QUESTION_CACHE_KEY = `trivia-questions-${CACHE_VERSION}`;
const CATEGORY_CACHE_KEY = `trivia-categories-${CACHE_VERSION}`;

// Cache expiration (1 hour)
const CACHE_EXPIRY = 60 * 60 * 1000; 

// Initialize cache
function initCache() {
    if (!localStorage.getItem(QUESTION_CACHE_KEY)) {
        localStorage.setItem(QUESTION_CACHE_KEY, JSON.stringify({
            data: {},
            timestamp: 0
        }));
    }
}

async function initCategories() {
    // Check cache first
    const now = Date.now();
    const cachedCategories = localStorage.getItem(CATEGORY_CACHE_KEY);
    
    if (cachedCategories) {
        const { data, timestamp } = JSON.parse(cachedCategories);
        if (now - timestamp < CACHE_EXPIRY) {
            populateCategorySelect(data);
            return;
        }
    }
    
    // If no valid cache, fetch from Firestore
    try {
        categorySelect.disabled = true;
        categorySelect.innerHTML = '<option>Loading categories...</option>';
        
        const snapshot = await db.collection('questions').get();
        const categories = new Set(['All Categories']);
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.category) {
                categories.add(data.category);
            }
        });
        
        const categoryArray = Array.from(categories).sort();
        
        // Update cache
        localStorage.setItem(CATEGORY_CACHE_KEY, JSON.stringify({
            data: categoryArray,
            timestamp: now
        }));
        
        populateCategorySelect(categoryArray);
        
    } catch (error) {
        console.error('Error loading categories:', error);
        populateCategorySelect([
            'All Categories',
            'General Knowledge',
            'Science',
            'History',
            'Geography'
        ]);
    } finally {
        categorySelect.disabled = false;
    }
}

function populateCategorySelect(categories) {
    categorySelect.innerHTML = categories.map(cat => 
        `<option value="${cat === 'All Categories' ? '' : cat}">${cat}</option>`
    ).join('');
}

async function fetchQuestions(category, difficulty, amount) {
    try {
        let query = db.collection('questions');
        
        // Apply filters if specified
        if (category) query = query.where('category', '==', category);
        if (difficulty && difficulty !== 'any') {
            query = query.where('difficulty', '==', difficulty);
        }

        query = query.orderBy('randomField', 'asc').limit(amount * 3);
        
        // Get ALL matching questions first
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            console.log('No matching questions.');
            return [];
        }
        
        // Convert to array and shuffle
        let questions = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                question: decodeHTML(data.question),
                correct: decodeHTML(data.correct_answer),
                options: [
                    ...(data.incorrect_answers || []).map(decodeHTML),
                    decodeHTML(data.correct_answer)
                ],
                category: data.category || 'General',
                difficulty: data.difficulty || 'medium'
            };
        });
        
        // Shuffle the entire question set
        questions = shuffleArray(questions);
        
        // Then take the requested amount
        return questions.slice(0, amount);
        
    } catch (error) {
        console.error('Error fetching questions:', error);
        return [];
    }
}

// Improved shuffle function
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function showQuestion() {
    // Clear previous question background
    questionEl.classList.remove('correct-bg', 'wrong-bg');

    // Update question counter
    questionCounterEl.textContent = `${currentQuestion + 1}/${selectedQuestions}`;

    if (!questions[currentQuestion]) {
        console.error('Invalid question index');
        endGame();
        return;
    }

    const question = questions[currentQuestion];
    
    // Shuffle options for THIS question
    question.options = shuffle(question.options);
    
    questionEl.innerHTML = `
        <div class="question-text">${question.question}</div>
        <div class="question-category">${question.category}</div>
    `;

    optionsEl.innerHTML = question.options.map((option, i) => `
        <button style="animation-delay: ${i * 0.1}s" 
                data-correct="${option === question.correct}">
            ${option}
        </button>
    `).join('');

    safeClassToggle(setupScreen, 'remove', 'active');
    safeClassToggle(gameScreen, 'add', 'active');
    startTimer();
}

// Timer System
function startTimer() {
    clearInterval(timerId);
    clearInterval(totalTimerId);
    
    timeLeft = selectedTime;
    totalTimeLeft = selectedQuestions * selectedTime;

    // Reset and start sounds
    if (audioElements.tick) {
        audioElements.tick.loop = true;
        if (!isMuted) audioElements.tick.play().catch(() => {});
    }

    questionTimerEl.textContent = timeLeft;
    updateTimerDisplay(totalTimeLeft, totalTimerEl);

    timerId = setInterval(() => {
        timeLeft = Math.max(0, timeLeft - 1);
        questionTimerEl.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerId);
            handleTimeout();
        }
    }, 1000);

    totalTimerId = setInterval(() => {
        totalTimeLeft = Math.max(0, totalTimeLeft - 1);
        updateTimerDisplay(totalTimeLeft, totalTimerEl);
        if (totalTimeLeft <= 0) clearInterval(totalTimerId);
    }, 1000);
    playSound('tick');
    audioElements.tick.loop = true;
}

function handleTimeout() {
    const questionEl = document.getElementById('question');
    questionEl.classList.add('wrong-bg');
    checkAnswer(false);
}

// ======================
// Audio Functions
// ======================
function playSound(type) {
    if (isMuted) return;
    
    const audio = audioElements[type];
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
}

function stopSound(type) {
    const audio = audioElements[type];
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
}


// ======================
// Answer Handling
// ======================
let autoProceedTimeout;

function checkAnswer(isCorrect) {
    stopSound('tick');
    playSound(isCorrect ? 'correct' : 'wrong');

    gtag('event', 'answer', {
        category: 'Gameplay',
        correct: isCorrect,
        question_number: currentQuestion
      });
      
    if (!questions[currentQuestion]) return;
    clearInterval(timerId);
    clearTimeout(autoProceedTimeout);
    
    answersLog.push({ isCorrect });
    const questionEl = document.getElementById('question');
    const correctAnswer = questions[currentQuestion].correct;

    questionEl.classList.remove('correct-bg', 'wrong-bg');
    questionEl.classList.add(isCorrect ? 'correct-bg' : 'wrong-bg');

    optionsEl.querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        const btnText = decodeHTML(btn.textContent.trim());
        const isActuallyCorrect = btnText === correctAnswer.trim();
        btn.classList.add(isActuallyCorrect ? 'correct' : 'wrong');
    });

    if (isCorrect) score += timeLeft * 10;
    scoreEl.textContent = score;

    if (currentQuestion < selectedQuestions - 1) {
        nextBtn.classList.add('visible');
        isNextQuestionPending = true; // Track pending state
        autoProceedTimeout = setTimeout(() => {
            if (isNextQuestionPending) {
                handleNextQuestion();
            }
        }, 2500);
    } else {
        setTimeout(endGame, 1000);
    }
}

function handleNextQuestion() {
    if (!isNextQuestionPending) return;
    isNextQuestionPending = false;
    
    nextBtn.classList.remove('visible');
    clearTimeout(autoProceedTimeout);

    if (currentQuestion < selectedQuestions - 1) {
        currentQuestion++;
        showQuestion();
    } else {
        endGame();
    }
}

// ======================
// Modified Event Listener
// ======================
nextBtn?.addEventListener('click', () => {
    if (isNextQuestionPending) {
        handleNextQuestion();
    }
});

// In endGame function
function endGame() {
    safeClassToggle(mainNav, 'add', 'hidden');
    clearInterval(timerId);
    clearInterval(totalTimerId);
    safeClassToggle(gameScreen, 'remove', 'active');
    safeClassToggle(summaryScreen, 'add', 'active');
    safeClassToggle(highscores, 'remove', 'hidden');
    
    // Hide start button in end game
    safeClassToggle(startBtn, 'add', 'hidden');
    showSummary();
    saveHighScore();
}

// In restartGame function
function restartGame() {
    // Clear the current questions array to force fresh fetch
    questions = [];
    
    safeClassToggle(mainNav, 'remove', 'hidden');
    currentQuestion = 0;
    score = 0;
    answersLog = [];
    selectedQuestions = parseInt(numQuestionsSelect.value);
    
    scoreEl.textContent = '0';
    questionCounterEl.textContent = `0/${selectedQuestions}`;
    updateTimerDisplay(selectedQuestions * selectedTime, totalTimerEl);
    
    safeClassToggle(gameScreen, 'remove', 'active');
    safeClassToggle(summaryScreen, 'remove', 'active');
    safeClassToggle(setupScreen, 'add', 'active');
    safeClassToggle(startBtn, 'remove', 'hidden');
    safeClassToggle(highscores, 'add', 'hidden');
    
    localStorage.removeItem(QUESTION_CACHE_KEY);

    gtag('event', 'start_game', {
        category: 'Gameplay',
        difficulty: selectedDifficulty,
        questions: selectedQuestions
    });
}

// Summary Screen
function showSummary() {
    const timeUsed = (selectedQuestions * selectedTime) - totalTimeLeft;
    const correctCount = answersLog.filter(a => a.isCorrect).length;

    summaryScreen.innerHTML = `
        <h2>Game Report</h2>
        <div class="performance-card compact">
            <div class="stats-row">
                <div class="stat-item correct">
                    <span class="material-icons">check_circle</span>
                    <div>
                        <h3>${correctCount}/${selectedQuestions}</h3>
                        <small>Correct Answers</small>
                    </div>
                </div>
                <div class="stat-item time">
                    <span class="material-icons">timer</span>
                    <div>
                        <h3>${formatTimeDisplay(timeUsed)}</h3>
                        <small>Total Time</small>
                    </div>
                </div>
            </div>
            ${createPerformanceMessage(correctCount)}
            <button class="btn primary" id="restart-btn">
                <span class="material-icons">replay</span>
                Play Again
            </button>
        </div>
    `;

    document.getElementById('restart-btn')?.addEventListener('click', restartGame);
}

// High Scores
function saveHighScore() {
    if (isScoreSaved || score === 0) return;
    
    const minScore = Math.min(...highScores.map(h => h.score));
    if (highScores.length < 5 || score > minScore) {
        const name = prompt('Enter your name for local records::', 'Anonymous') || 'Anonymous';
        highScores = [...highScores, { name, score }]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
        
        localStorage.setItem('highScores', JSON.stringify(highScores));
        updateHighScores();
    }
    isScoreSaved = true;
}

function updateHighScores() {
    if (!highscoresList) return;
    
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
// Utility Functions
// ======================
function safeClassToggle(element, action, className) {
    element?.classList?.[action]?.(className);
}

function updateTimerDisplay(seconds, element) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    element.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

function createAudioElement(src) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    return audio;
}

function createPerformanceMessage(correctCount) {
    const percentage = (correctCount / selectedQuestions) * 100;
    const messages = {
        gold: [
            "🏆 Trivia Deity! The knowledge gods bow before you!",
            "🧠 Mind = Blown! You're a walking encyclopedia!",
            "🤯 Unstoppable Genius! Someone call Guinness World Records!",
            "🎖️ Absolute Legend! You just broke the trivia matrix!"
        ],
        silver: [
            "✨ Brainiac Alert! You're crushing it!",
            "🚀 Knowledge Rocket! Almost perfect!",
            "💎 Diamond Mind! You're trivia royalty!",
            "🧩 Puzzle Master! You've got all the pieces!"
        ],
        bronze: [
            "👍 Solid Effort! You're getting dangerous!",
            "📚 Bookworm Rising! The library is your dojo!",
            "💡 Bright Spark! Keep that curiosity lit!",
            "🏅 Contender Status! The podium is in sight!"
        ],
        zero: [
            "💥 Knowledge Explosion Incoming! The next attempt will be better!",
            "🎯 Fresh Start! Every master was once a beginner!",
            "🔥 Fueling Curiosity! Your learning journey begins now!",
            "🚀 Launch Pad Ready! Next round will be your breakthrough!",
            "🌱 Seeds of Knowledge Planted! Water them with another try!"
        ],
        default: [
            "🌱 Sprouting Scholar! Every master was once a beginner!",
            "🦉 Wise Owl in Training! The nest is just the start!",
            "📖 Chapter 1 Complete! Your knowledge journey begins!",
            "🧭 Learning Compass Active! New horizons ahead!"
        ]
    };

    let category = 'default';
    if (correctCount === 0) {
        category = 'zero';
    } else if (percentage >= 90) {
        category = 'gold';
    } else if (percentage >= 70) {
        category = 'silver';
    } else if (percentage >= 50) {
        category = 'bronze';
    }

    // Select random message from category
    const randomIndex = Math.floor(Math.random() * messages[category].length);
    const message = messages[category][randomIndex];

    return `<div class="performance-message ${category}">${message}</div>`;
}

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

// ======================
// Event Listeners
// ======================
startBtn.addEventListener('click', async () => {
    try {
        safeClassToggle(mainNav, 'add', 'hidden');
        safeClassToggle(startBtn, 'add', 'hidden');
        selectedQuestions = parseInt(numQuestionsSelect.value);
        selectedTime = parseInt(timePerQuestionSelect.value);
        
        startBtn.disabled = true;
        
        // Force fresh fetch by not reusing existing questions
        questions = await fetchQuestions(
            categorySelect.value,
            selectedDifficulty,
            selectedQuestions
        );

        if (questions.length) {
            safeClassToggle(highscores, 'add', 'hidden');
            safeClassToggle(setupScreen, 'remove', 'active');
            safeClassToggle(gameScreen, 'add', 'active');
            currentQuestion = 0;
            score = 0;
            answersLog = [];
            
            // Shuffle options for the first question
            questions[0].options = shuffle(questions[0].options);
            showQuestion();
        }
    } finally {
        startBtn.disabled = false;
        safeClassToggle(startBtn, 'remove', 'hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initCategories();
    updateHighScores();
    safeClassToggle(setupScreen, 'add', 'active');
    safeClassToggle(highscores, 'add', 'hidden');
    nextBtn.classList.remove('visible');
    nextBtn?.addEventListener('click', handleNextQuestion);

    // Mute button handler
    document.getElementById('mute-btn')?.addEventListener('click', () => {
        isMuted = !isMuted;
        const icon = document.querySelector('#mute-btn .material-icons');
        if (icon) {
            icon.textContent = isMuted ? 'volume_off' : 'volume_up';
        }
        
        // Toggle all sounds
        Object.values(audioElements).forEach(audio => {
            if (!audio) return;
            if (isMuted) {
                audio.pause();
            } else if (audio.loop) {
                audio.play().catch(() => {});
            }
        });
    });
});

document.addEventListener('click', (e) => {
    if (e.target.matches('#options button')) {
        const isCorrect = e.target.dataset.correct === 'true';
        checkAnswer(isCorrect);
    }
});

document.querySelectorAll('.difficulty-pill').forEach(btn => {
    btn.addEventListener('click', function() {
        // Remove active class from all buttons
        document.querySelectorAll('.difficulty-pill').forEach(b => 
            b.classList.remove('active')
        );
        
        // Add active class to clicked button
        this.classList.add('active');
        
        // Update selected difficulty
        selectedDifficulty = this.dataset.difficulty;
    });
});

// Add this event listener in your DOMContentLoaded handler
document.getElementById('clear-scores')?.addEventListener('click', () => {
    if (confirm("Permanently delete all your local scores?")) {
      highScores = [];
      localStorage.setItem('highScores', JSON.stringify([]));
      updateHighScores();
      showToast('All scores cleared!', '⚠️');
    }
  });
  
  // Optional toast notification
  function showToast(message, icon = 'ℹ️') {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `${icon} ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 2000);
  }