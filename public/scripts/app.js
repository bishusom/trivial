/* 
 * Trivia Master Game Logic - Optimized
 * Features all original functionality with improved structure
 */

// ======================
// DOM Element References
// ======================
const elements = {
    mainNav: document.querySelector('.main-nav'),
    navLinks: document.querySelectorAll('.nav-link'),
    screens: {
        setup: document.querySelector('.setup-screen'),
        game: document.querySelector('.game-screen'),
        summary: document.querySelector('.summary-screen'),
        blog: document.querySelector('.blog-tbank')
    },
    question: document.getElementById('question'),
    options: document.getElementById('options'),
    nextBtn: document.getElementById('next-btn'),
    score: document.getElementById('score'),
    questionCounter: document.getElementById('question-counter'),
    questionTimer: document.getElementById('question-timer'),
    totalTimer: document.getElementById('total-timer'),
    highscores: {
        container: document.querySelector('.highscores'),
        list: document.getElementById('highscores-list')
    },
    toggles: {
        quickMode: document.getElementById('quick-mode-toggle')
    },
    buttons: {
        mute: document.getElementById('mute-btn'),
        restart: document.getElementById('restart-btn'),
        clearScores: document.getElementById('clear-scores'),
        instantPlay: document.getElementById('instant-play'),
        explore: document.getElementById('explore-btn'),
        featuredPlay: document.querySelector('.featured-play-btn')
    }
};

// ======================
// Constants
// ======================
const constants = {
    timers: {
        quick: 30,
        long: 60
    },
    quizTypes: {
        WEEKLY: 'Weekly',
        MONTHLY: 'Monthly'
    },
    cache: {
        version: 'v1',
        keys: {
            questions: `trivia-questions-v1`,
            fbQuiz: 'fbQuizCache',
            fbQuestions: 'fbQuestionsCache'
        },
        expiry: {
            fbQuiz: 24 * 60 * 60 * 1000,
            fbQuestions: 24 * 60 * 60 * 1000
        }
    },
    defaultQuestions: 10
};

// ======================
// Game State
// ======================
const state = {
    isMuted: false,
    dailyPlayers: 142,
    questions: [],
    currentQuestion: 0,
    score: 0,
    timeLeft: constants.timers.long,
    totalTimeLeft: 10 * constants.timers.long,
    timerId: null,
    totalTimerId: null,
    highScores: JSON.parse(localStorage.getItem('highScores')) || [],
    answersLog: [],
    isScoreSaved: false,
    isNextQuestionPending: false,
    selectedQuestions: constants.defaultQuestions,
    selectedTime: constants.timers.long,
    usedQuestionIds: new Set(),
    questionPool: [],
    pendingNavigationUrl: null,
    fbUsedQuestions: JSON.parse(localStorage.getItem('fbUsedQuestions')) || [],
    fbUsedQuizIds: JSON.parse(localStorage.getItem('fbUsedQuizIds')) || [],
    audio: {
        tick: createAudioElement('/audio/tick.mp3'),
        correct: createAudioElement('/audio/correct.mp3'),
        wrong: createAudioElement('/audio/wrong.mp3')
    }
};

// ======================
// Core Functions
// ======================
function initGame() {
    loadMuteState();
    updateHighScores();
    toggleScreen('setup');
    initTimeToggle();
    initEventListeners();
    initStorage();
    showDailyChallenge();
    updateFeaturedCardPlayerCount();
}

function initEventListeners() {
    // Navigation
    elements.navLinks.forEach(link => link.addEventListener('click', handleNavClick));
    
    // Game controls
    elements.nextBtn?.addEventListener('click', handleNextQuestion);
    elements.buttons.mute?.addEventListener('click', toggleMute);
    elements.buttons.clearScores?.addEventListener('click', clearScores);
    elements.buttons.instantPlay?.addEventListener('click', startRandomGame);
    elements.buttons.explore?.addEventListener('click', showCategoriesTab);
    elements.buttons.featuredPlay?.addEventListener('click', startFeaturedGame);
    
    // Answer selection
    elements.options?.addEventListener('click', (e) => {
        if (e.target.matches('button')) {
            checkAnswer(e.target.dataset.correct === 'true');
        }
    });
    
    // Category cards
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', handleCategorySelection);
        card.addEventListener('touchend', handleCategorySelection);
    });
    
    // Modal buttons
    document.getElementById('accept-challenge')?.addEventListener('click', acceptChallenge);
    document.getElementById('decline-challenge')?.addEventListener('click', declineChallenge);
    document.getElementById('continue-game')?.addEventListener('click', continueGame);
    document.getElementById('end-game')?.addEventListener('click', endCurrentGame);
    
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', switchTab);
    });
    
    // Exit intent
    document.addEventListener('mouseout', handleExitIntent);
}

function initStorage() {
    const defaults = {
        fbUsedQuestions: [],
        fbQuestionsCache: {},
        fbUsedQuizIds: [],
        fbQuizCache: {},
        highScores: []
    };
    
    Object.entries(defaults).forEach(([key, value]) => {
        if (!localStorage.getItem(key)) {
            localStorage.setItem(key, JSON.stringify(value));
        }
    });
}

// ======================
// Game Flow Functions
// ======================
async function startGame(category) {
    try {
        trackEvent('game_start', 'Gameplay', category);
        
        if (category === constants.quizTypes.WEEKLY || category === constants.quizTypes.MONTHLY) {
            await updatePlayerCount(category);
            state.dailyPlayers = await fetchPlayerCount(category);
            updateFeaturedCardPlayerCount();
        }
        
        updateUIForCategorySelection(category);
        toggleLoading(true);
        
        state.questions = await fetchQuestions(category);
        resetGameState();
        toggleScreen('game');
        showQuestion();
    } catch (error) {
        showError(error.message || "Failed to load questions. Please try again.");
    } finally {
        toggleLoading(false);
    }
}

function showQuestion() {
    document.querySelector('.app-footer').classList.add('hidden');
    elements.question.classList.remove('correct-bg', 'wrong-bg');
    elements.questionCounter.textContent = `${state.currentQuestion + 1}/${state.selectedQuestions}`;

    if (!state.questions[state.currentQuestion]) {
        endGame();
        return;
    }

    const question = {...state.questions[state.currentQuestion]};
    question.options = shuffleArray([...question.options]);
    
    renderQuestion(question);
    startTimer();
}

function renderQuestion(question) {
    const selectedCard = document.querySelector('.category-card.active');
    const selectedCategory = selectedCard ? selectedCard.dataset.category : 'General Knowledge';

    elements.question.innerHTML = `
        <div class="question-text">${question.question}</div>
        <div class="question-meta">
            <div class="question-category">
                ${selectedCategory === 'General Knowledge' ? 'General Knowledge' : toInitCaps(question.category)}
                <span class="question-difficulty ${question.difficulty}">${question.difficulty}</span>    
            </div>
            ${question.subcategory ? `
                <div class="question-subcategory">
                    ${question.subcategory}
                </div>
            ` : ''}
        </div>
    `;

    elements.options.innerHTML = question.options.map((option, i) => `
        <button style="animation-delay: ${i * 0.1}s" 
                data-correct="${option === question.correct}">
            ${option}
        </button>
    `).join('');
}

function endGame() {
    clearTimers();
    toggleScreen('summary');
    showSummary();
    saveHighScore();
}

function restartGame() {
    resetQuestionPool();
    state.questions = [];
    resetGameState();
    toggleScreen('setup');
    localStorage.removeItem(constants.cache.keys.questions);
    trackEvent('start_game', 'Gameplay');
}

// ======================
// Timer Functions
// ======================
function startTimer() {
    clearTimers();
    
    if (state.timeLeft <= 0) {
        state.timeLeft = elements.toggles.quickMode?.checked ? constants.timers.quick : constants.timers.long;
    }
    
    elements.questionTimer.textContent = state.timeLeft;
    updateTimerDisplay(state.totalTimeLeft, elements.totalTimer);

    state.timerId = setInterval(() => {
        state.timeLeft = Math.max(0, state.timeLeft - 1);
        elements.questionTimer.textContent = state.timeLeft;
        if (state.timeLeft <= 0) handleTimeout();
    }, 1000);

    state.totalTimerId = setInterval(() => {
        state.totalTimeLeft = Math.max(0, state.totalTimeLeft - 1);
        updateTimerDisplay(state.totalTimeLeft, elements.totalTimer);
        if (state.totalTimeLeft <= 0) clearInterval(state.totalTimerId);
    }, 1000);
    
    playSound('tick');
    state.audio.tick.loop = true;
}

function clearTimers() {
    clearInterval(state.timerId);
    clearInterval(state.totalTimerId);
    stopSound('tick');
}

// ======================
// Answer Handling
// ======================
function checkAnswer(isCorrect) {
    stopSound('tick');
    playSound(isCorrect ? 'correct' : 'wrong');
    trackEvent('answer', 'Gameplay', isCorrect, state.currentQuestion);
    
    if (!state.questions[state.currentQuestion]) return;
    
    clearTimers();
    clearTimeout(state.autoProceedTimeout);
    
    state.answersLog.push({ isCorrect });
    updateAnswerUI(isCorrect);
    
    if (isCorrect) state.score += state.timeLeft * 10;
    elements.score.textContent = state.score;

    if (state.currentQuestion < state.selectedQuestions - 1) {
        showNextButton();
    } else {
        setTimeout(endGame, 1000);
    }
}

function updateAnswerUI(isCorrect) {
    const question = state.questions[state.currentQuestion];
    elements.question.classList.remove('correct-bg', 'wrong-bg');
    elements.question.classList.add(isCorrect ? 'correct-bg' : 'wrong-bg');

    elements.options.querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        const btnText = decodeHTML(btn.textContent.trim());
        const isActuallyCorrect = btnText === question.correct.trim();
        btn.classList.add(isActuallyCorrect ? 'correct' : 'wrong');
    });
}

function handleNextQuestion() {
    if (!state.isNextQuestionPending) return;
    state.isNextQuestionPending = false;
    
    elements.nextBtn.classList.remove('visible');
    clearTimeout(state.autoProceedTimeout);

    if (state.currentQuestion < state.selectedQuestions - 1) {
        state.currentQuestion++;
        showQuestion();
    } else {
        endGame();
    }
}

// ======================
// Utility Functions
// ======================
function toggleScreen(screen) {
    Object.values(elements.screens).forEach(s => s.classList.remove('active'));
    elements.screens[screen].classList.add('active');
    elements.mainNav.classList.toggle('hidden', screen === 'game');
    elements.highscores.container.classList.toggle('hidden', screen !== 'summary');
}

function toggleLoading(show) {
    document.getElementById('loading-indicator').classList.toggle('hidden', !show);
}

function toggleMute() {
    state.isMuted = !state.isMuted;
    updateMuteIcon();
    saveMuteState();
    
    Object.values(state.audio).forEach(audio => {
        if (!audio) return;
        if (state.isMuted) {
            audio.pause();
        } else if (audio.loop) {
            audio.play().catch(() => {});
        }
    });
}

function updateMuteIcon() {
    const icon = document.querySelector('#mute-btn .material-icons');
    if (icon) icon.textContent = state.isMuted ? 'volume_off' : 'volume_up';
}

function saveMuteState() {
    localStorage.setItem('triviaMasterMuteState', JSON.stringify(state.isMuted));
}

function loadMuteState() {
    const savedState = localStorage.getItem('triviaMasterMuteState');
    if (savedState !== null) {
        state.isMuted = JSON.parse(savedState);
    }
    updateMuteIcon();
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

function playSound(type) {
    if (state.isMuted) return;
    const audio = state.audio[type];
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
}

function stopSound(type) {
    const audio = state.audio[type];
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
}

function decodeHTML(text) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function toInitCaps(str) {
    return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function showToast(message, icon = 'ℹ️') {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `${icon} ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, {
            event_category: category,
            event_label: label,
            value: value
        });
    }
}

// ======================
// Initialization
// ======================
document.addEventListener('DOMContentLoaded', initGame);