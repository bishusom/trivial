/* 
 * Trivia Master Game Logic - Optimized
 * Features:
 * - User-selectable questions/time
 * - Compact summary screen
 * - Optimized code structure
 * - Better error handling
 * - Adaptive difficulty
 * - Performance improvements
 */

// ======================
// DOM Element References
// ======================
const mainNav = document.querySelector('.main-nav');
const setupScreen = document.querySelector('.setup-screen');
const gameScreen = document.querySelector('.game-screen');
const summaryScreen = document.querySelector('.summary-screen');
const categorySelect = document.getElementById('category');
const questionEl = document.getElementById('question');
const optionsEl = document.getElementById('options');
const nextBtn = document.getElementById('next-btn');
const scoreEl = document.getElementById('score');
const questionCounterEl = document.getElementById('question-counter');
const questionTimerEl = document.getElementById('question-timer');
const totalTimerEl = document.getElementById('total-timer');
const highscores = document.querySelector('.highscores');
const highscoresList = document.getElementById('highscores-list');
const timer = {
    quick: 30,
    long: 60
};
const audioElements = {
    tick: createAudioElement('/audio/tick.mp3'),
    correct: createAudioElement('/audio/correct.mp3'),
    wrong: createAudioElement('/audio/wrong.mp3')
};

// ======================
// Game State
// ======================
let isMuted = false;
let selectedDifficulty = 'easy';
let questions = [];
let currentQuestion = 0;
let score = 0;
let timeLeft = timer.long;
let totalTimeLeft = 10;
let timerId;
let totalTimerId;
let highScores = JSON.parse(localStorage.getItem('highScores')) || [];
let answersLog = [];
let isScoreSaved = false;
let isNextQuestionPending = false;
let selectedQuestions = 10;
let selectedTime = timer.long;
let usedQuestionIds = new Set();
let questionPool = [];

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

function initTimeToggle() {
    const toggle = document.getElementById('quick-mode-toggle');
    if (!toggle) return;

    // Set default to Normal mode (10s)
    timeLeft = 15;
    totalTimeLeft = 15 * timeLeft;
    toggle.checked = false;

    toggle.addEventListener('change', function() {
        if (this.checked) {
            // Quick mode 
            timeLeft = timer.quick;
        } else {
            // Normal mode
            timeLeft = timer.long;
        }
        totalTimeLeft = 10 * timeLeft;
        
        // Update UI immediately if in game
        if (gameScreen.classList.contains('active')) {
            questionTimerEl.textContent = timeLeft;
            updateTimerDisplay(totalTimeLeft, totalTimerEl);
        }
    });
}

function toggleLoading(show) {
    const loader = document.getElementById('loading-indicator');
    if (show) {
        loader.classList.remove('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

function showError(message) {
    // Ensure error element exists
    let errorDiv = document.getElementById('error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div id="error-text"></div>
            <button id="retry-btn" class="btn small primary">Retry</button>
        `;
        setupScreen.appendChild(errorDiv);
    }

    const errorText = document.getElementById('error-text');
    if (errorText) {
        errorText.textContent = message;
    }
    
    errorDiv.classList.remove('hidden');
    
    // Add retry button handler
    document.getElementById('retry-btn')?.addEventListener('click', () => {
        const activeCard = document.querySelector('.category-card.active');
        if (activeCard) {
            activeCard.dispatchEvent(new Event('dblclick'));
        }
    });
}

function hideError() {
    document.getElementById('error-message').classList.add('hidden');
}

async function fetchQuestions(category, amount = 10) {
    try {
        console.log("Querying for category:", JSON.stringify(category));
        // If we don't have a pool yet, or it's empty, fetch new questions
        if (questionPool.length === 0) {
            if (category == 'General Knowledge') {
                snapshot = await db.collection('questions')
                .orderBy('randomField', 'asc')
                .limit(100)
                .get();
            } else {
                snapshot = await db.collection('questions')
                .where('category', '==', category)
                .orderBy('randomField', 'asc')
                .limit(100)
                .get();

            }
           
                
            questionPool = processQuestions(snapshot);
            
            // If we've used most questions, reset the used set
            if (usedQuestionIds.size > questionPool.length * 0.7) {
                usedQuestionIds = new Set();
            }
        }
        
        // Filter out already used questions
        const availableQuestions = questionPool.filter(q => !usedQuestionIds.has(q.id));
        
        if (availableQuestions.length < amount) {
            // If not enough, use some repeats but prefer unused ones
            const needed = amount - availableQuestions.length;
            const backupQuestions = shuffleArray(questionPool)
                .filter(q => !availableQuestions.includes(q))
                .slice(0, needed);
                
            availableQuestions.push(...backupQuestions);
        }
        
        // Mark these questions as used
        const selectedQuestions = shuffleArray(availableQuestions).slice(0, amount);
        selectedQuestions.forEach(q => usedQuestionIds.add(q.id));
        
        return selectedQuestions;
        
    } catch (error) {
        console.error('Error fetching questions:', error);
        throw error;
    }
}

function processQuestions(snapshot) {
    const seenQuestions = new Set();
    const questions = [];
    
    // First pass - filter duplicates
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const questionText = decodeHTML(data.question).trim().toLowerCase();
        
        if (!seenQuestions.has(questionText)) {
            seenQuestions.add(questionText);
            
            questions.push({
                id: doc.id,
                question: decodeHTML(data.question),
                correct: decodeHTML(data.correct_answer),
                options: shuffleArray([
                    ...(data.incorrect_answers || []).map(decodeHTML),
                    decodeHTML(data.correct_answer)
                ]),
                category: data.category || 'General',
                subcategory: data.subcategory || '',
                difficulty: data.difficulty || 'medium',
                lastUsed: 0 // Timestamp of when last used
            });
        }
    });
    
    return questions;
}

function decodeHTML(text) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
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
    questionEl.classList.remove('correct-bg', 'wrong-bg');
    questionCounterEl.textContent = `${currentQuestion + 1}/${selectedQuestions}`;

    if (!questions[currentQuestion]) {
        console.error('Invalid question index');
        endGame();
        return;
    }

    const question = {...questions[currentQuestion]}; // Create a copy
    question.options = shuffle([...question.options]); // Shuffle options
    
    questionEl.innerHTML = `
        <div class="question-text">${question.question}</div>
        <div class="question-meta">
             <div class="question-category">
                ${question.category}
                ${question.subcategory ? `<span class="question-subcategory">${question.subcategory}</span>` : ''}
                <span class="question-difficulty ${question.difficulty}">${question.difficulty}</span>    
             </div>
        </div>
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

     // Reset timeLeft to the selected value if it's 0
     if (timeLeft <= 0) {
        timeLeft = document.getElementById('quick-mode-toggle').checked ? timer.quick : timer.long;
    }
    
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

    if (typeof gtag !== 'undefined') {
        gtag('event', 'answer', {
            category: 'Gameplay',
            correct: isCorrect,
            question_number: currentQuestion
        });
    }
      
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
        isNextQuestionPending = true;
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

//endGame function
function endGame() {
    safeClassToggle(mainNav, 'add', 'hidden');
    clearInterval(timerId);
    clearInterval(totalTimerId);
    safeClassToggle(gameScreen, 'remove', 'active');
    safeClassToggle(summaryScreen, 'add', 'active');
    safeClassToggle(highscores, 'remove', 'hidden');
    
    // Get selected category
    const selectedCard = document.querySelector('.category-card.active');
    const category = selectedCard ? selectedCard.dataset.category : 'General Knowledge';
    
    showSummary();
    saveHighScore();
}

function resetQuestionPool() {
    // Keep the pool but reset usage tracking
    usedQuestionIds = new Set();
    
    // Optional: shuffle the existing pool for better randomness
    questionPool = shuffleArray(questionPool);
}

// In restartGame function
function restartGame() {
    resetQuestionPool();
    // Clear the current questions array to force fresh fetch
    questions = [];
    
    safeClassToggle(mainNav, 'remove', 'hidden');
    currentQuestion = 0;
    score = 0;
    answersLog = [];
    
    const quickMode = document.getElementById('quick-mode-toggle').checked;
    selectedTime = quickMode ? timer.quick : timer.long;
    timeLeft = selectedTime;
    totalTimeLeft = 10 * selectedTime;

    scoreEl.textContent = '0';
    questionCounterEl.textContent = `0/${selectedQuestions}`;
    updateTimerDisplay(selectedQuestions * selectedTime, totalTimerEl);
    
    safeClassToggle(gameScreen, 'remove', 'active');
    safeClassToggle(summaryScreen, 'remove', 'active');
    safeClassToggle(setupScreen, 'add', 'active');
    safeClassToggle(highscores, 'add', 'hidden');
    
    localStorage.removeItem(QUESTION_CACHE_KEY);

    if (typeof gtag !== 'undefined') {
        gtag('event', 'start_game', {
            category: 'Gameplay',
            difficulty: selectedDifficulty,
            questions: selectedQuestions
        });
    }
}

// Summary Screen
function showSummary() {
    const timeUsed = (selectedQuestions * selectedTime) - totalTimeLeft;
    const correctCount = answersLog.filter(a => a.isCorrect).length;
    const percentage = Math.round((correctCount / selectedQuestions) * 100);

    summaryScreen.innerHTML = `
        <div class="card performance-card compact">
            <h2>Game Report</h2>
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
                <div class="stat-item percentage">
                    <span class="material-icons">percent</span>
                    <div>
                        <h3>${percentage}%</h3>
                        <small>Success Rate</small>
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
        const name = prompt('Enter your name for local records:', 'Anonymous') || 'Anonymous';
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
document.addEventListener('DOMContentLoaded', () => {
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

// Category card initialization
document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('dblclick', async function() {
        const category = this.dataset.category;
        
        // Create error message element if it doesn't exist
        if (!document.getElementById('error-message')) {
            const errorDiv = document.createElement('div');
            errorDiv.id = 'error-message';
            errorDiv.className = 'error-message hidden';
            errorDiv.innerHTML = `
                <div id="error-text"></div>
                <button id="retry-btn" class="btn small primary">Retry</button>
            `;
            setupScreen.appendChild(errorDiv);
        }

        // Update UI
        document.querySelectorAll('.category-card').forEach(c => 
            c.classList.remove('active')
        );
        this.classList.add('active');
        
        // Show loading indicator
        toggleLoading(true);
        hideError();

        try {
            // Fetch questions
            questions = await fetchQuestions(category);
            
            if (questions.length === 0) {
                throw new Error('No questions found for this category');
            }

            // Initialize game state
            safeClassToggle(highscores, 'add', 'hidden');
            safeClassToggle(setupScreen, 'remove', 'active');
            safeClassToggle(gameScreen, 'add', 'active');
            
            currentQuestion = 0;
            score = 0;
            answersLog = [];
            
            // Initialize game state with time from toggle
            const quickMode = document.getElementById('quick-mode-toggle').checked;
            timeLeft = quickMode ? timer.quick : timer.long;
            totalTimeLeft = 10 * timeLeft;
            
            showQuestion();
            
        } catch (error) {
            console.error('Error starting game:', error);
            showError(error.message || "Failed to load questions. Please try again.");
        } finally {
            toggleLoading(false);
        }
    });
});

// Clear scores button
document.getElementById('clear-scores')?.addEventListener('click', () => {
    if (confirm("Permanently delete all your local scores?")) {
      highScores = [];
      localStorage.setItem('highScores', JSON.stringify([]));
      updateHighScores();
      showToast('All scores cleared!', '⚠️');
    }
});

// Retry button
document.getElementById('retry-btn')?.addEventListener('click', () => {
    hideError();
    const activeCard = document.querySelector('.category-card.active');
    if (activeCard) {
        activeCard.dispatchEvent(new Event('dblclick'));
    }
});

// Toast notification
function showToast(message, icon = 'ℹ️') {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `${icon} ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 2000);
}