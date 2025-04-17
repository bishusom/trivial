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
const difficultyPicker = document.getElementById('difficulty');
const numQuestionsSelect = document.getElementById('num-questions');
const timePerQuestionSelect = document.getElementById('time-per-question');
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
let selectedDifficulty = 'easy';
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
let selectedQuestions = 10;
let selectedTime = 15;

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

// Progressive timing based on player skill
function calculateTimePerQuestion(category) {
    const progress = getCategoryProgress(category);
    const plays = progress.plays || 0;
    
    // Base time
    let baseTime = 15; // seconds
    
    // Reduce time as player gets better
    if (plays >= 3) baseTime = 12;
    if (plays >= 5) baseTime = 10;
    if (plays >= 10) baseTime = 8;
    if (plays >= 15) baseTime = 5;
    
    return baseTime;
}

function updateDifficultyDisplay(category) {
    const progress = getCategoryProgress(category);
    const plays = progress.plays || 0;
    const meter = document.getElementById('difficulty-meter-fill');
    const levelText = document.getElementById('current-difficulty-level');
    
    let level = "Beginner";
    let percent = 20;
    
    if (plays >= 3) {
        level = "Intermediate";
        percent = 40;
    }
    if (plays >= 5) {
        level = "Advanced";
        percent = 60;
    }
    if (plays >= 10) {
        level = "Expert";
        percent = 80;
    }
    if (plays >= 15) {
        level = "Master";
        percent = 100;
    }
    
    meter.style.width = `${percent}%`;
    levelText.textContent = level;
}

// Track player progress per category
function getCategoryProgress(category) {
    const progress = JSON.parse(localStorage.getItem('categoryProgress')) || {};
    return progress[category] || { plays: 0, highScore: 0 };
}

function updateCategoryProgress(category, score) {
    const progress = JSON.parse(localStorage.getItem('categoryProgress')) || {};
    const current = getCategoryProgress(category);
    
    progress[category] = {
        plays: current.plays + 1,
        highScore: Math.max(current.highScore, score)
    };
    
    localStorage.setItem('categoryProgress', JSON.stringify(progress));
    return progress[category];
}

// Calculate dynamic difficulty mix
function getDifficultyMix(category) {
    const progress = getCategoryProgress(category);
    const plays = progress.plays || 0;
    
    // Base mix (60% easy, 30% medium, 10% hard)
    let mix = { easy: 0.6, medium: 0.3, hard: 0.1 };
    
    // Adjust based on plays
    if (plays >= 3) {
        mix = { easy: 0.4, medium: 0.4, hard: 0.2 };
    }
    if (plays >= 5) {
        mix = { easy: 0.3, medium: 0.4, hard: 0.3 };
    }
    if (plays >= 10) {
        mix = { easy: 0.2, medium: 0.4, hard: 0.4 };
    }
    
    return mix;
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

async function fetchQuestions(category, difficulty, amount) {
    try {
        let query = db.collection('questions');
        
        // Only apply category filter if it's not 'Mix-n-Match'
        if (category && category !== 'Mix-n-Match') {
            query = query.where('category', '==', category);
        }
        
        // Apply difficulty filter if specified
        if (difficulty && difficulty !== 'any') {
            query = query.where('difficulty', '==', difficulty);
        }

        // Get the snapshot
        const snapshot = await query.limit(amount * 3).get();
        
        if (snapshot.empty) {
            // Try a more general query if no results found
            const fallbackQuery = db.collection('questions')
                                  .where('category', '==', category)
                                  .limit(amount * 3);
            const fallbackSnapshot = await fallbackQuery.get();
            
            if (fallbackSnapshot.empty) {
                throw new Error('No questions available for this category');
            }
            
            return processQuestions(fallbackSnapshot);
        }
        
        return processQuestions(snapshot);
        
    } catch (error) {
        console.error('Error fetching questions:', error);
        throw error;
    }
}

function processQuestions(snapshot) {
    const questions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            question: decodeHTML(data.question),
            correct: decodeHTML(data.correct_answer),
            options: shuffleArray([
                ...(data.incorrect_answers || []).map(decodeHTML),
                decodeHTML(data.correct_answer)
            ]),
            category: data.category || 'General',
            difficulty: data.difficulty || 'medium'
        };
    });
    
    return shuffleArray(questions).slice(0, Math.min(questions.length, 10));
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
    const category = selectedCard ? selectedCard.dataset.category : 'Mix-n-Match';
    
    // Update category progress
    updateCategoryProgress(category, score);
    
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
        updateDifficultyDisplay(category);
        
        // Show loading indicator
        toggleLoading(true);
        hideError();

        try {
            // Fetch questions
            questions = await fetchQuestions(category, 'any', 10);
            
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
            timeLeft = 15;
            totalTimeLeft = 10 * 15;
            
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