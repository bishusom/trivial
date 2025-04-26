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
const blogTbankScreen = document.querySelector('.blog-tbank');
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
// fb Quiz
//==========================
const QUIZ_TYPES = {
    WEEKLY: 'Weekly',
    MONTHLY: 'Monthly'
};

// ======================
// Game State
// ======================
let isMuted = false;
let dailyPlayers = 142; 
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
let fbUsedQuestions = JSON.parse(localStorage.getItem('fbUsedQuestions')) || [];
let fbUsedQuizIds = JSON.parse(localStorage.getItem('fbUsedQuizIds')) || [];
// ======================
// Core Functions
// ======================

// Initialization
const QUESTION_COLLECTION = 'triviaMaster/questions';
const CATEGORIES_DOC = 'triviaMaster/categories';
const CACHE_VERSION = 'v1';
const QUESTION_CACHE_KEY = `trivia-questions-${CACHE_VERSION}`;
const fb_QUESTIONS_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours cache
const fb_QUIZ_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours


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

function saveMuteState() {
    localStorage.setItem('triviaMasterMuteState', JSON.stringify(isMuted));
}

function loadMuteState() {
    const savedState = localStorage.getItem('triviaMasterMuteState');
    if (savedState !== null) {
        isMuted = JSON.parse(savedState);
    }
    updateMuteIcon();
}

function updateMuteIcon() {
    const icon = document.querySelector('#mute-btn .material-icons');
    if (icon) {
        icon.textContent = isMuted ? 'volume_off' : 'volume_up';
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

function toInitCaps(str) {
    return str.replace(/\w\S*/g, function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

async function fetchPlayerCount(category) {
    try {
        const doc = await db.collection('playerCounts').doc(category).get();
        if (doc.exists) {
            return doc.data().count;
        }
        // If document doesn't exist, create it with count=1
        const initialCount = 1;
        await db.collection('playerCounts').doc(category).set({
            count: initialCount,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            category: category
        });
        return initialCount;
    } catch (error) {
        console.error('Error fetching player count:', error);
        return Math.floor(Math.random() * 40) + 100; // Fallback
    }
}

// Update the fetchfbQuiz function to prevent duplicate fetches
async function fetchfbQuiz(quizType) {
    try {
        const now = new Date();
        const periodId = quizType === QUIZ_TYPES.WEEKLY 
            ? `week-${getWeekNumber(now)}-${now.getFullYear()}`
            : `month-${now.getMonth()+1}-${now.getFullYear()}`;
        
        // Check if we're already fetching this quiz
        if (window.currentQuizFetch && window.currentQuizFetch.quizType === quizType) {
            return window.currentQuizFetch.promise;
        }

        // Create a new fetch promise and store it
        const fetchPromise = (async () => {
            // Check cache first
            const quizCacheKey = `fb-quiz-${periodId}`;
            const cachedQuiz = getfbQuizCache(quizCacheKey);
            
            if (cachedQuiz && !fbUsedQuizIds.includes(quizCacheKey)) {
                return shuffleArray(cachedQuiz.questions);
            }

            // Query Firestore
            const quizDoc = await db.collection('quizzes')
                .doc(quizType.toLowerCase())
                .collection('periods')
                .doc(periodId)
                .get();

            if (!quizDoc.exists) {
                throw new Error(`No ${quizType} available yet. Check back soon!`);
            }
            
            let questions = quizDoc.data().questions.map(q => ({
                id: generateQuestionId(q),
                question: q.question,
                correct: q.correct_answer,
                options: shuffleArray([...q.incorrect_answers, q.correct_answer]),
                category: quizType,
                subcategory: q.subcategory || '',
                difficulty: q.difficulty || 'medium'
            }));

            questions = shuffleArray(questions);
            setfbQuizCache(quizCacheKey, questions);
            fbUsedQuizIds.push(quizCacheKey);
            localStorage.setItem('fbUsedQuizIds', JSON.stringify(fbUsedQuizIds));

            return questions;
        })();

        // Store the current fetch
        window.currentQuizFetch = {
            quizType,
            promise: fetchPromise
        };

        const result = await fetchPromise;
        
        // Clear the current fetch when done
        if (window.currentQuizFetch?.quizType === quizType) {
            window.currentQuizFetch = null;
        }

        return result;
    } catch (error) {
        // Clear the current fetch on error
        if (window.currentQuizFetch?.quizType === quizType) {
            window.currentQuizFetch = null;
        }
        throw error;
    }
}

// Add these cache management functions
function getfbQuizCache(key) {
    const cache = JSON.parse(localStorage.getItem('fbQuizCache')) || {};
    const entry = cache[key];
    
    if (entry && Date.now() - entry.timestamp < fb_QUIZ_CACHE_EXPIRY) {
        return entry;
    }
    return null;
}

function setfbQuizCache(key, questions) {
    const cache = JSON.parse(localStorage.getItem('fbQuizCache')) || {};
    cache[key] = {
        questions,
        timestamp: Date.now()
    };
    localStorage.setItem('fbQuizCache', JSON.stringify(cache));
}

async function fetchfbQuestions(category, amount = 10) {
    try {
      // Check cache first
      const cacheKey = `fb_questions-${category}`;
      const cached = getfbQuestionsCache(cacheKey);
      
      if (cached && cached.questions.length >= amount) {
        const available = cached.questions.filter(q => !fbUsedQuestions.includes(q.id));
        if (available.length >= amount) {
          return processfbQuestions(available, amount);
        }
      }
  
      // Fetch from Firestore using nested collection
      const randomIndex = Math.floor(Math.random() * 900);
      let query = db.collection('triviaMaster').doc('questions').collection('items')

      if (category && category !== 'General Knowledge') {
        query = query.where('category', '==', category);
      }
    
        query = query.where('randomIndex', '>=', randomIndex)
                .orderBy('randomIndex')
                .limit(amount * 2);
  
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        throw new Error('No questions found for this category');
      }
  
      const newQuestions = snapshot.docs.map(doc => ({
        id: doc.id,
        question: decodeHTML(doc.data().question),
        correct: decodeHTML(doc.data().correct_answer),
        options: shuffleArray([
          ...doc.data().incorrect_answers.map(decodeHTML),
          decodeHTML(doc.data().correct_answer)
        ]),
        category: doc.data().category,
        subcategory: doc.data().subcategory || '',
        difficulty: doc.data().difficulty || 'medium'
      }));
  
      // Update cache
      setfbQuestionsCache(cacheKey, newQuestions);
      
      return processfbQuestions(newQuestions, amount);
    } catch (error) {
      console.error('Failed to fetch questions:', error);
      throw error;
    }
}  

// Helper to generate unique ID for fb_questions questions
function generateQuestionId(q) {
  return CryptoJS.MD5(q.question + q.correct_answer).toString();
}

// Cache management functions
function getfbQuestionsCache(key) {
  const cache = JSON.parse(localStorage.getItem('fbQuestionsCache')) || {};
  const entry = cache[key];
  
  if (entry && Date.now() - entry.timestamp < fb_QUESTIONS_CACHE_EXPIRY) {
    return entry;
  }
  return null;
}

function setfbQuestionsCache(key, questions) {
  const cache = JSON.parse(localStorage.getItem('fbQuestionsCache')) || {};
  cache[key] = {
    questions,
    timestamp: Date.now()
  };
  localStorage.setItem('fbQuestionsCache', JSON.stringify(cache));
}

// Process fb_questions questions with repeat prevention
function processfbQuestions(questions, amount) {
    // Filter out used questions
    const availableQuestions = questions.filter(q => 
        !fbUsedQuestions.includes(q.id)
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
    fbUsedQuestions = [
        ...fbUsedQuestions,
        ...selected.map(q => q.id)
    ].slice(-500); // Keep last 500 to prevent memory issues
    
    localStorage.setItem('fbUsedQuestions', JSON.stringify(fbUsedQuestions));

    // Format for game (preserve all properties including subcategory)
    return selected.map(q => ({
        ...q,
        options: shuffleArray([...q.options]) // Shuffle options
    }));
}

async function fetchQuestions(category) {
    try {
        // Track category selection
        if (typeof gtag !== 'undefined') {
            gtag('event', 'select_category', {
                event_category: 'Gameplay',
                event_label: category
            });
        }

        // Exact match for special quizzes
        if (category === QUIZ_TYPES.WEEKLY || category === QUIZ_TYPES.MONTHLY) {
            return await fetchfbQuiz(category);
        } 
        // All other categories go to OpenTriviaDB
        else {
            const questions = await fetchfbQuestions(category);
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
    document.querySelector('.app-footer').classList.add('hidden');
    
    questionEl.classList.remove('correct-bg', 'wrong-bg');
    questionCounterEl.textContent = `${currentQuestion + 1}/${selectedQuestions}`;

    if (!questions[currentQuestion]) {
        console.error('Invalid question index');
        endGame();
        return;
    }

    // Get selected category from active card
    const selectedCard = document.querySelector('.category-card.active');
    const selectedCategory = selectedCard ? selectedCard.dataset.category : 'General Knowledge';

    const question = {...questions[currentQuestion]}; // Create a copy
    question.options = shuffle([...question.options]); // Shuffle options
    
    // Build the question meta HTML
    let questionMetaHTML = `
        <div class="question-category">
            ${selectedCategory === 'General Knowledge' ? 'General Knowledge' : toInitCaps(question.category)}
            <span class="question-difficulty ${question.difficulty}">${question.difficulty}</span>    
        </div>
    `;
    
    // Add subcategory if available (for both regular questions and quizzes)
    if (question.subcategory) {
        questionMetaHTML += `
            <div class="question-subcategory">
                ${question.subcategory}
            </div>
        `;
    }

    questionEl.innerHTML = `
        <div class="question-text">${question.question}</div>
        <div class="question-meta">
            ${questionMetaHTML}
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
            category: 'Gameplay'
        });
    }
}

async function getGlobalCategoryHighScore(category) {
    try {
      const snapshot = await db.collection('scores')
        .where('category', '==', category)
        .orderBy('score', 'desc')
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        return {
          score: data.score,
          name: data.name
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching global category high score:', error);
      return null;
    }
}

// Summary Screen
async function showSummary() {
    const timeUsed = (selectedQuestions * selectedTime) - totalTimeLeft;
    const correctCount = answersLog.filter(a => a.isCorrect).length;
    const percentage = Math.round((correctCount / selectedQuestions) * 100);
  
    // Get current category
    const selectedCard = document.querySelector('.category-card.active');
    const category = selectedCard ? selectedCard.dataset.category : 'General Knowledge';
    
    // Get global high score for this category
    const globalHigh = await getGlobalCategoryHighScore(category);
    
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
        </div>
        ${createPerformanceMessage(correctCount)}
        
        ${globalHigh ? `
          <div class="global-high-score">
            <div class="trophy-icon">🏆</div>
            <div class="global-high-details">
              <div class="global-high-text">Global High Score in ${category}:</div>
              <div class="global-high-value">${globalHigh.score} by ${globalHigh.name}</div>
            </div>
          </div>
        ` : ''}
        
        <button class="btn primary" id="restart-btn">
          <span class="material-icons">replay</span>
          ${globalHigh && globalHigh.score > score ? 
            `Chase ${globalHigh.name}'s ${globalHigh.score}!` : 
            'Play Again'}
        </button>
        
        ${globalHigh && globalHigh.score > score ? 
          `<div class="motivation-text">
            You're ${globalHigh.score - score} points behind the leader!
          </div>` : 
          globalHigh && globalHigh.score <= score ?
          `<div class="global-champion-message">
            🎉 You beat the global high score! Submit your score to claim the crown!
          </div>` :
          ''}
      </div>
    `;
  
    document.getElementById('restart-btn')?.addEventListener('click', restartGame);
    document.querySelector('.app-footer').classList.remove('hidden');
}

// High Scores
function saveHighScore() {
    if (isScoreSaved || score === 0) return;
    
    const selectedCard = document.querySelector('.category-card.active');
    const category = selectedCard ? selectedCard.dataset.category : 'General Knowledge';
    
    // Save to localStorage (existing functionality)
    const minScore = Math.min(...highScores.map(h => h.score));
    if (highScores.length < 5 || score > minScore) {
      const name = prompt('Enter your name for records:', 'Anonymous') || 'Anonymous';
      highScores = [...highScores, { name, score }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      
      localStorage.setItem('highScores', JSON.stringify(highScores));
      updateHighScores();
      
      // Also save to Firebase
      saveScoreToFirebase(name, score, category);
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

async function saveScoreToFirebase(name, score, category) {
    try {
      await db.collection('scores').add({
        name: name,
        score: score,
        category: category,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('Score saved to Firebase');
    } catch (error) {
      console.error('Error saving score to Firebase:', error);
    }
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
            "🏆 Trivia Deity! The knowledge gods bow before you! Can you maintain your reign?",
            "🧠 Mind = Blown! Think you can top this perfect score? Try again!",
            "🤯 Unstoppable Genius! Ready for an even bigger challenge next round?",
            "🎖️ Absolute Legend! The leaderboard needs your name again!"
        ],
        silver: [
            "✨ Brainiac Alert! One more round could push you to perfection!",
            "🚀 Knowledge Rocket! You're just one launch away from trivia greatness!",
            "💎 Diamond Mind! Polish your skills further with another game!",
            "🧩 Puzzle Master! Can you complete the picture perfectly next time?"
        ],
        bronze: [
            "👍 Solid Effort! Your next attempt could be your breakthrough!",
            "📚 Bookworm Rising! Every replay makes you wiser - try again!",
            "💡 Bright Spark! Your knowledge is growing - fuel it with another round!",
            "🏅 Contender Status! The podium is within reach - one more try!"
        ],
        zero: [
            "💥 Knowledge Explosion Incoming! Stick around - the next attempt will be better!",
            "🎯 Fresh Start! Now that you've warmed up, the real game begins!",
            "🔥 Fueling Curiosity! Your learning journey starts here - play again!",
            "🚀 Launch Pad Ready! First attempts are just practice - try for real now!",
            "🌱 Seeds of Knowledge Planted! Water them with another try!"
        ],
        default: [
            "🌱 Sprouting Scholar! Every replay makes you stronger - continue your journey!",
            "🦉 Wise Owl in Training! The more you play, the wiser you become!",
            "📖 Chapter 1 Complete! Turn the page to your next knowledge adventure!",
            "🧭 Learning Compass Active! Your next game could be your true north!"
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

    // Add a consistent call-to-action that appears with all messages
    const cta = "<div class='replay-cta'>Ready for another challenge? The next round awaits!</div>";
    
    return `
        <div class="performance-message ${category}">${message}</div>
        ${cta}
    `;
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
    loadMuteState();
    updateHighScores();
    safeClassToggle(setupScreen, 'add', 'active');
    safeClassToggle(highscores, 'add', 'hidden');
    nextBtn.classList.remove('visible');
    nextBtn?.addEventListener('click', handleNextQuestion);
    updateFeaturedCardPlayerCount();

    // Featured challenge button
    document.querySelector('.featured-play-btn')?.addEventListener('click', function() {
        const featuredCard = document.querySelector('.featured-card');
        const category = featuredCard.dataset.category;
        document.querySelector(`.category-card[data-category="${category}"]`).click();
    });

    // Value prop tracking
    document.querySelectorAll('.prop-card').forEach(card => {
        card.addEventListener('click', () => {
            if (typeof gtag !== 'undefined') {
                gtag('event', 'click_value_prop', {
                    event_category: 'Engagement',
                    event_label: card.textContent.trim()
                });
            }
        });
    });

    // Mute button handler
    document.getElementById('mute-btn')?.addEventListener('click', () => {
        isMuted = !isMuted;
        updateMuteIcon();
        saveMuteState();
        
        Object.values(audioElements).forEach(audio => {
            if (!audio) return;
            if (isMuted) {
                audio.pause();
            } else if (audio.loop) {
                audio.play().catch(() => {});
            }
        });
    });

    // Modal buttons
    document.getElementById('continue-game')?.addEventListener('click', () => {
        document.getElementById('nav-warning-modal').classList.add('hidden');
        pendingNavigationUrl = null;
        startTimer();
        safeClassToggle(gameScreen, 'add', 'active');
        safeClassToggle(blogTbankScreen, 'remove', 'active');
        safeClassToggle(setupScreen, 'remove', 'active');
    });
    
    document.getElementById('end-game')?.addEventListener('click', () => {
        questions = [];
        currentQuestion = 0;
        score = 0;
        
        document.getElementById('nav-warning-modal').classList.add('hidden');
        safeClassToggle(gameScreen, 'remove', 'active');
        document.querySelector('.app-footer').classList.remove('hidden');

        if (pendingNavigationUrl) {
            window.history.pushState({}, '', pendingNavigationUrl);
            handleRouting(pendingNavigationUrl);
        }
        pendingNavigationUrl = null;
    });
    
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavClick);
    });

    // Initialize storage
    if (!localStorage.getItem('fbUsedQuestions')) {
        localStorage.setItem('fbUsedQuestions', JSON.stringify([]));
    }
    if (!localStorage.getItem('fbQuestionsCache')) {
        localStorage.setItem('fbQuestionsCache', JSON.stringify({}));
    }
    if (!localStorage.getItem('fbUsedQuizIds')) {
        localStorage.setItem('fbUsedQuizIds', JSON.stringify([]));
    }
    if (!localStorage.getItem('fbQuizCache')) {
        localStorage.setItem('fbQuizCache', JSON.stringify({}));
    }

    // Track featured challenge impressions
    if (typeof gtag !== 'undefined') {
        gtag('event', 'view_featured_challenge', {
            event_category: 'Engagement'
        });
    }
});

// Add to event listeners section
document.querySelector('.featured-play-btn')?.addEventListener('click', function() {
    const featuredCard = document.querySelector('.featured-card');
    const category = featuredCard.dataset.category;
    document.querySelector(`.category-card[data-category="${category}"]`).click();
});


document.addEventListener('click', (e) => {
    if (e.target.matches('#options button')) {
        const isCorrect = e.target.dataset.correct === 'true';
        checkAnswer(isCorrect);
    }
});


// Replace the category card initialization code with this optimized version
document.querySelectorAll('.category-card').forEach(card => {
    let lastTap = 0;
    let touchStartY = 0;
    let isScrolling = false;
    let isProcessing = false; // Add processing flag
    
    card.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
        isScrolling = false;
    });
    
    card.addEventListener('touchmove', function(e) {
        if (Math.abs(e.touches[0].clientY - touchStartY) > 5) {
            isScrolling = true;
        }
    });
    
    card.addEventListener('touchend', function(e) {
        if (!isScrolling && !isProcessing) {
            e.preventDefault();
            isProcessing = true;
            handleCategorySelection.call(this).finally(() => {
                isProcessing = false;
            });
        }
    });
    
    // Click handler for desktop
    card.addEventListener('click', function(e) {
        if ('ontouchstart' in window || isProcessing) return;
        isProcessing = true;
        handleCategorySelection.call(this).finally(() => {
            isProcessing = false;
        });
    });
});


// Extract the game start logic into a separate function
async function handleCategorySelection() {
    const category = this.dataset.category;

    // Track the game start event
    if (typeof gtag !== 'undefined') {
        gtag('event', 'game_start', {
            'event_category': 'Gameplay',
            'event_label': category,
            'value': 1
        });
    }

    if (category === QUIZ_TYPES.WEEKLY || category === QUIZ_TYPES.MONTHLY) {
        await updatePlayerCount(category);  // First update the count
        dailyPlayers = await fetchPlayerCount(category);
        updateFeaturedCardPlayerCount();
    }
    
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
        const toggle = document.getElementById('quick-mode-toggle');
        const quickMode = toggle ? toggle.checked : false;
        timeLeft = quickMode ? timer.quick : timer.long;
        totalTimeLeft = 10 * timeLeft;
        
        showQuestion();
        
    } catch (error) {
        console.error('Error starting game:', error);
        showError(error.message || "Failed to load questions. Please try again.");
    } finally {
        toggleLoading(false);
    }
}

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

async function getPlayerCount(category='Weekly') {
    try {
        const doc = await db.collection('playerCounts').doc(category).get();
        if (doc.exists) {
            return doc.data().count || 0;
        }
        // If document doesn't exist, create it with count=1
        await db.collection('playerCounts').doc(category).set({
            count: 1,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        return 1;
    } catch (error) {
        console.error(`Error getting player count for ${category}:`, error);
        return Math.floor(Math.random() * 100) + 50; // Fallback
    }
}

function updateFeaturedCardPlayerCount() {
    const countElement = document.querySelector('.players-count span:last-child');
    dailyPlayers = fetchPlayerCount();
    if (countElement) {
        countElement.textContent = `${dailyPlayers} playing today`;
    }
}

async function updatePlayerCount(category) {
    try {
        const countRef = db.collection('playerCounts').doc(category);
        
        // First try to get the current count
        const doc = await countRef.get();
        const currentCount = doc.exists ? doc.data().count : 0;
        const newCount = currentCount + 1;
        
        // Try to update with the new count
        await countRef.set({
            count: newCount,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            category: category
        }, { merge: true });
        
        return newCount;
    } catch (error) {
        console.error('Error updating player count:', error);
        // Fallback to random number if update fails
        return Math.floor(Math.random() * 40) + 100;
    }
}

// Tab switching functionality
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons and content
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Show corresponding content
        const tabId = button.dataset.tab;
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// Tab switching functionality
document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and content
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Show corresponding content
            const tabId = button.dataset.tab;
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Track tab switch event
            if (typeof gtag !== 'undefined') {
                gtag('event', 'switch_tab', {
                    'event_category': 'Navigation',
                    'event_label': tabId
                });
            }
        });
    });
});
