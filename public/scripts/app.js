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
const navLinks = document.querySelectorAll('.nav-link')
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
//==========================
// Open Trivia Category IDs
//==========================
const otbdIDs = {
    'Animals' : 27,
    'Arts' : 25,
    'Board Games' : 15,
    'Computers' : 18,
    'Cartoons': 32,
    'General Knowledge': 9,
    'History': 23,
    'Geography': 22,
    'Literature' : 10,
    'Movies' : 11,
    'Music' : 12,
    'Mythology' : 20,
    'Science': 17,
    'Sports': 21,
    'Television' : 14,
    'Board Games' : 15
};
//==========================
// Firebase Quiz
//==========================
const QUIZ_TYPES = {
    WEEKLY: 'Weekly',
    MONTHLY: 'Monthly'
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
let pendingNavigationUrl = null;
let otdbUsedQuestions = JSON.parse(localStorage.getItem('otdbUsedQuestions')) || [];
let firebaseUsedQuizIds = JSON.parse(localStorage.getItem('firebaseUsedQuizIds')) || [];
// ======================
// Core Functions
// ======================

// Initialization
const CACHE_VERSION = 'v1';
const QUESTION_CACHE_KEY = `trivia-questions-${CACHE_VERSION}`;
const CATEGORY_CACHE_KEY = `trivia-categories-${CACHE_VERSION}`;
const OTDB_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours cache
const FIREBASE_QUIZ_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

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

function handleNavClick(e) {
    if (gameScreen.classList.contains('active')) {
        e.preventDefault();
        pendingNavigationUrl = e.target.href;
        
        // Pause the game
        clearInterval(timerId);
        clearInterval(totalTimerId);
        stopSound('tick');
        
        // Show warning modal
        document.getElementById('nav-warning-modal').classList.remove('hidden');
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

// Helper function to get week number
function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

async function fetchWithRetry(url, retries = 3, delay = 1000) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response; // Return the response object, not the JSON
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, retries - 1, delay * 2);
        }
        throw error;
    }
}

async function fetchFirebaseQuiz(quizType) {
    try {
        // Get current week/month identifier
        const now = new Date();
        const periodId = quizType === QUIZ_TYPES.WEEKLY 
            ? `week-${getWeekNumber(now)}-${now.getFullYear()}`
            : `month-${now.getMonth()+1}-${now.getFullYear()}`;
        
        console.log(periodId);

        // Check if we've already used this quiz
        const quizCacheKey = `firebase-quiz-${periodId}`;
        const cachedQuiz = getFirebaseQuizCache(quizCacheKey);
        
        if (cachedQuiz && !firebaseUsedQuizIds.includes(quizCacheKey)) {
            return cachedQuiz.questions;
        }

        // Query Firebase for this period's quiz
        const quizDoc = await db.collection('quizzes')
            .doc(quizType.toLowerCase())
            .collection('periods')
            .doc(periodId)
            .get();

        if (!quizDoc.exists) {
            console.error('Firebase document not found at:', quizRef.path);
            throw new Error(`No ${quizType} available yet. Check back soon!`);
        }

        console.log(`Found ${quizDoc.data().questions.length} questions`);
        
        const questions = quizDoc.data().questions.map(q => ({
            id: generateQuestionId(q), // Generate unique ID for each question
            question: q.question,
            correct: q.correct_answer,
            options: shuffleArray([
                ...q.incorrect_answers,
                q.correct_answer
            ]),
            category: quizType,
            difficulty: q.difficulty || 'medium'
        }));

        // Cache these questions
        setFirebaseQuizCache(quizCacheKey, questions);
        
        // Mark this quiz as used
        firebaseUsedQuizIds.push(quizCacheKey);
        localStorage.setItem('firebaseUsedQuizIds', JSON.stringify(firebaseUsedQuizIds));

        return questions;
    } catch (error) {
        console.error(`Error fetching ${quizType}:`, error);
        throw error;
    }
}

// Add these cache management functions
function getFirebaseQuizCache(key) {
    const cache = JSON.parse(localStorage.getItem('firebaseQuizCache')) || {};
    const entry = cache[key];
    
    if (entry && Date.now() - entry.timestamp < FIREBASE_QUIZ_CACHE_EXPIRY) {
        return entry;
    }
    return null;
}

function setFirebaseQuizCache(key, questions) {
    const cache = JSON.parse(localStorage.getItem('firebaseQuizCache')) || {};
    cache[key] = {
        questions,
        timestamp: Date.now()
    };
    localStorage.setItem('firebaseQuizCache', JSON.stringify(cache));
}


async function fetchOTdbQuestions(category, amount = 10) {
    try {
      // Check cache first
      const cacheKey = `otdb-${category}`;
      const cached = getOtdbCache(cacheKey);
      
      // If we have enough cached questions that haven't been used recently
      if (cached && cached.questions.length >= amount) {
          const available = cached.questions.filter(q => 
            !otdbUsedQuestions.includes(q.id)
          );
          if (available.length >= amount) {
            return processOtdbQuestions(cached.questions, amount);
          }
      }
    
      // Not enough in cache, fetch fresh
      const url = new URL('https://opentdb.com/api.php');
      url.searchParams.append('amount', 30); // Fetch more to have buffer
      if (category && otbdIDs[category]) {
        url.searchParams.append('category', otbdIDs[category]);
      }
      url.searchParams.append('type', 'multiple');
  
      const response = await fetchWithRetry(url);
      const data = await response.json(); // Parse JSON here
  
      if (data.response_code !== 0) {
        throw new Error('OpenTriviaDB API error');
      }
  
      // Process and cache the new questions
      const newQuestions = data.results.map(q => ({
        id: generateQuestionId(q), // Generate unique ID for each question
        question: decodeHTML(q.question),
        correct: decodeHTML(q.correct_answer),
        options: [
          ...q.incorrect_answers.map(decodeHTML), 
          decodeHTML(q.correct_answer)
        ],
        category: q.category,
        difficulty: q.difficulty || 'medium' 
      }));
  
      // Update cache
      setOtdbCache(cacheKey, newQuestions);
      
      return processOtdbQuestions(newQuestions, amount);
    } catch (error) {
      console.error('Failed to fetch OTDB questions:', error);
      throw error; // Re-throw the error to be caught by the calling function
    }
}
  

// Helper to generate unique ID for OTDB questions
function generateQuestionId(q) {
  return CryptoJS.MD5(q.question + q.correct_answer).toString();
}

// Cache management functions
function getOtdbCache(key) {
  const cache = JSON.parse(localStorage.getItem('otdbCache')) || {};
  const entry = cache[key];
  
  if (entry && Date.now() - entry.timestamp < OTDB_CACHE_EXPIRY) {
    return entry;
  }
  return null;
}

function setOtdbCache(key, questions) {
  const cache = JSON.parse(localStorage.getItem('otdbCache')) || {};
  cache[key] = {
    questions,
    timestamp: Date.now()
  };
  localStorage.setItem('otdbCache', JSON.stringify(cache));
}

// Process OTDB questions with repeat prevention
function processOtdbQuestions(questions, amount) {
    // Filter out used questions
    const availableQuestions = questions.filter(q => 
        !otdbUsedQuestions.includes(q.id)
    );

    // If not enough, use some repeats but prefer unused ones
    const selected = [];
    const needed = Math.min(amount, availableQuestions.length + questions.length);
    
    // First add all available unique questions
    selected.push(...shuffleArray(availableQuestions).slice(0, needed));

    // If still need more, add from the full pool (including repeats)
    if (selected.length < needed) {
        const remaining = needed - selected.length;
        selected.push(...shuffleArray(questions)
        .filter(q => !selected.includes(q))
        .slice(0, remaining));
    }

    // Mark these questions as used
    otdbUsedQuestions = [
        ...otdbUsedQuestions,
        ...selected.map(q => q.id)
    ].slice(-500); // Keep last 500 to prevent memory issues
    
    localStorage.setItem('otdbUsedQuestions', JSON.stringify(otdbUsedQuestions));

    // Format for game
    return selected.map(q => ({
        ...q,
        options: shuffleArray([...q.options]) // Shuffle options
    }));
}

async function fetchQuestions(category) {
    try {
        // Exact match for special quizzes
        if (category === QUIZ_TYPES.WEEKLY || category === QUIZ_TYPES.MONTHLY) {
            return await fetchFirebaseQuiz(category);
        } 
        // All other categories go to OpenTriviaDB
        else {
            const questions = await fetchOTdbQuestions(category);
            if (questions.length === 0) {
                throw new Error('No questions available for this category. Please try another one.');
            }
            return questions;
        }
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
                //subcategory: data.subcategory || '',
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

    // Add modal button handlers
    document.getElementById('continue-game')?.addEventListener('click', () => {
        document.getElementById('nav-warning-modal').classList.add('hidden');
        pendingNavigationUrl = null; // Clear the pending navigation
        startTimer(); // Resume the game
    });
    
    document.getElementById('end-game')?.addEventListener('click', () => {
        // Clean up game state
        questions = [];
        currentQuestion = 0;
        score = 0;
        
        // Hide modal and navigate
        document.getElementById('nav-warning-modal').classList.add('hidden');
        if (pendingNavigationUrl) {
            window.history.pushState({}, '', pendingNavigationUrl);
            handleRouting(pendingNavigationUrl); // Use the router's handling
        }
        pendingNavigationUrl = null;
    });
    
    // Add navigation handlers
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavClick);
    });

    if (!localStorage.getItem('otdbUsedQuestions')) {
        localStorage.setItem('otdbUsedQuestions', JSON.stringify([]));
      }
    if (!localStorage.getItem('otdbCache')) {
        localStorage.setItem('otdbCache', JSON.stringify({}));
    }
    
    if (!localStorage.getItem('firebaseUsedQuizIds')) {
    localStorage.setItem('firebaseUsedQuizIds', JSON.stringify([]));
    }
    if (!localStorage.getItem('firebaseQuizCache')) {
    localStorage.setItem('firebaseQuizCache', JSON.stringify({}));
    }
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
                <button id="try-another-btn" class="btn small secondary">Try Another</button>
            `;
            setupScreen.appendChild(errorDiv);
            
            // Add try another button handler
            document.getElementById('try-another-btn')?.addEventListener('click', () => {
                hideError();
                document.querySelector('.category-card.active')?.classList.remove('active');
            });
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