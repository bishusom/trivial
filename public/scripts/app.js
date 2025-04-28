/* Trivia Master Game Logic - Compact */
const els = {
    mainNav: document.querySelector('.main-nav'),
    setup: document.querySelector('.setup-screen'),
    game: document.querySelector('.game-screen'),
    summary: document.querySelector('.summary-screen'),
    question: document.getElementById('question'),
    options: document.getElementById('options'),
    nextBtn: document.getElementById('next-btn'),
    score: document.getElementById('score'),
    questionCounter: document.getElementById('question-counter'),
    questionTimer: document.getElementById('question-timer'),
    totalTimer: document.getElementById('total-timer'),
    highscores: document.querySelector('.highscores'),
    highscoresList: document.getElementById('highscores-list')
};

const timers = { quick: 30, long: 60 };
const audio = {
    tick: new Audio('/audio/tick.mp3'),
    correct: new Audio('/audio/correct.mp3'),
    wrong: new Audio('/audio/wrong.mp3')
};
audio.tick.loop = true;

let state = {
    isMuted: false,
    dailyPlayers: 142,
    questions: [],
    current: 0,
    score: 0,
    timeLeft: timers.long,
    totalTime: 10 * timers.long,
    timerId: null,
    totalTimerId: null,
    highScores: JSON.parse(localStorage.getItem('highScores')) || [],
    answers: [],
    isScoreSaved: false,
    isNextPending: false,
    selectedQuestions: 10,
    usedQuestions: new Set(),
    fbUsedQuestions: JSON.parse(localStorage.getItem('fbUsedQuestions')) || [],
    fbUsedQuizIds: JSON.parse(localStorage.getItem('fbUsedQuizIds')) || []
};

const QUIZ_TYPES = { WEEKLY: 'Weekly', MONTHLY: 'Monthly' };
const CACHE = { QUESTIONS: 'trivia-questions-v1', EXPIRY: 24 * 60 * 60 * 1000 };

async function setPlayerCount(category='Weekly', update=true) {
    try {
        const doc = await db.collection('playerCounts').doc(category).get();
        const currentCount = doc.exists ? doc.data().count : 0;
        if (update) {
            newCount = currentCount + 1;
            await db.collection('playerCounts').doc(category).set({
                count: newCount,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                category: category
            }, { merge: true });
        } else {
            newCount = currentCount;
            const countElement = document.querySelector('.players-count span:last-child');
            countElement.textContent = `${newCount} playing today`;
        }
        return newCount;
    } catch (error) {
        console.error('Error updating player count:', error);
        return Math.floor(Math.random() * 40) + 100;
    }
}

function init() {
    loadMuteState();
    updateHighScores();
    updateProgressTracker();
    setPlayerCount(category='Weekly', update=false);
    els.setup.classList.add('active');
    els.highscores.classList.add('hidden');
    setupEvents();
    showDailyChallenge();
}

function toggleLoading(show) {
    document.getElementById('loading-indicator').classList[show ? 'remove' : 'add']('hidden');
}

function toggleClass(el, action, cls) {
    el?.classList?.[action]?.(cls);
}

function playSound(type) {
    if (!state.isMuted) audio[type].play().catch(() => {});
}

function stopSound(type) {
    audio[type].pause();
    audio[type].currentTime = 0;
}

function handleNavClick(e) {
    if (elements.screens.game.classList.contains('active')) {
        e.preventDefault();
        state.pendingNavigationUrl = e.target.href;
        
        // Pause the game
        clearTimers();
        stopSound('tick');
        
        // Show warning modal
        document.getElementById('nav-warning-modal').classList.remove('hidden');
    }
}

function continueGame() {
    document.getElementById('nav-warning-modal').classList.add('hidden');
    state.pendingNavigationUrl = null;
    startTimer();
    toggleScreen('game');
}

function endCurrentGame() {
    state.questions = [];
    state.currentQuestion = 0;
    state.score = 0;
    
    document.getElementById('nav-warning-modal').classList.add('hidden');
    toggleScreen('setup');
    document.querySelector('.app-footer').classList.remove('hidden');

    if (state.pendingNavigationUrl) {
        window.history.pushState({}, '', state.pendingNavigationUrl);
        handleRouting(state.pendingNavigationUrl);
    }
    state.pendingNavigationUrl = null;
}

function showError(msg) {
    let error = document.getElementById('error-message');
    if (!error) {
        error = document.createElement('div');
        error.id = 'error-message';
        error.className = 'error-message';
        error.innerHTML = `<div id="error-text">${msg}</div><button id="retry-btn" class="btn small primary">Retry</button>`;
        els.setup.appendChild(error);
        document.getElementById('retry-btn').addEventListener('click', () => {
            document.querySelector('.category-card.active')?.dispatchEvent(new Event('dblclick'));
        });
    }
    error.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error-message')?.classList.add('hidden');
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

async function fetchQuestions(category) {
    try {
        setPlayerCount(category);
        if ([QUIZ_TYPES.WEEKLY, QUIZ_TYPES.MONTHLY].includes(category)) {
            return await fetchfbQuiz(category);
        }
        return await fetchfbQuestions(category);
    } catch (e) {
        showError(e.message || 'Failed to load questions.');
        throw e;
    }
}

async function fetchfbQuiz(type) {
    const now = new Date();
    const id = type === QUIZ_TYPES.WEEKLY ? `week-${getWeekNumber(now)}-${now.getFullYear()}` : `month-${now.getMonth()+1}-${now.getFullYear()}`;
    const cacheKey = `fb-quiz-${id}`;
    const cached = JSON.parse(localStorage.getItem('fbQuizCache'))?.[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE.EXPIRY && !state.fbUsedQuizIds.includes(cacheKey)) {
        return shuffle(cached.questions);
    }
    const doc = await db.collection('quizzes').doc(type.toLowerCase()).collection('periods').doc(id).get();
    if (!doc.exists) throw new Error(`No ${type} quiz available.`);
    const questions = doc.data().questions.map(q => ({
        id: CryptoJS.MD5(q.question + q.correct_answer).toString(),
        question: q.question,
        correct: q.correct_answer,
        options: shuffle([...q.incorrect_answers, q.correct_answer]),
        category: type,
        subcategory: q.subcategory || '',
        difficulty: q.difficulty || 'medium'
    }));
    localStorage.setItem('fbQuizCache', JSON.stringify({ ...JSON.parse(localStorage.getItem('fbQuizCache') || '{}'), [cacheKey]: { questions, timestamp: Date.now() } }));
    state.fbUsedQuizIds.push(cacheKey);
    localStorage.setItem('fbUsedQuizIds', JSON.stringify(state.fbUsedQuizIds));
    return shuffle(questions);
}

async function fetchfbQuestions(category, amount = 10) {
    const cacheKey = `fb_questions-${category}`;
    const cache = JSON.parse(localStorage.getItem('fbQuestionsCache'))?.[cacheKey];
    if (cache && cache.questions.length >= amount && cache.questions.filter(q => !state.fbUsedQuestions.includes(q.id)).length >= amount) {
        return processfbQuestions(cache.questions, amount);
    }
    const query = db.collection('triviaMaster').doc('questions').collection('items')
        .where('randomIndex', '>=', Math.floor(Math.random() * 900))
        .orderBy('randomIndex')
        .limit(amount * 2);
    if (category !== 'General Knowledge') query.where('category', '==', category);
    const snapshot = await query.get();
    if (snapshot.empty) throw new Error('No questions found.');
    const questions = snapshot.docs.map(doc => ({
        id: doc.id,
        question: decodeHTML(doc.data().question),
        correct: decodeHTML(doc.data().correct_answer),
        options: shuffle([...doc.data().incorrect_answers.map(decodeHTML), decodeHTML(doc.data().correct_answer)]),
        category: doc.data().category,
        subcategory: doc.data().subcategory || '',
        difficulty: doc.data().difficulty || 'medium'
    }));
    localStorage.setItem('fbQuestionsCache', JSON.stringify({ ...JSON.parse(localStorage.getItem('fbQuestionsCache') || '{}'), [cacheKey]: { questions, timestamp: Date.now() } }));
    return processfbQuestions(questions, amount);
}

function processfbQuestions(questions, amount) {
    const available = questions.filter(q => !state.fbUsedQuestions.includes(q.id));
    const selected = shuffle(available).slice(0, Math.min(amount, available.length));
    state.fbUsedQuestions.push(...selected.map(q => q.id));
    localStorage.setItem('fbUsedQuestions', JSON.stringify(state.fbUsedQuestions.slice(-500)));
    return selected.map(q => ({ ...q, options: shuffle([...q.options]) }));
}

function decodeHTML(text) {
    const ta = document.createElement('textarea');
    ta.innerHTML = text;
    return ta.value;
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function toInitCaps(str) {
    return str.replace(/\w\S*/g, function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function showQuestion() {
    toggleClass(document.querySelector('.app-footer'), 'add', 'hidden');
    els.question.classList.remove('correct-bg', 'wrong-bg');
    els.questionCounter.textContent = `${state.current + 1}/${state.selectedQuestions}`;
    const q = state.questions[state.current];
    if (!q) return endGame();
    const category = document.querySelector('.category-card.active')?.dataset.category || 'General Knowledge';
    els.question.innerHTML = `
        <div class="question-text">${q.question}</div>
        <div class="question-meta">
            <div class="question-category">${toInitCaps(q.category)}${q.difficulty ? `<span class="question-difficulty ${q.difficulty}">${toInitCaps(q.difficulty)}</span>` : ''}</div>
            ${q.subcategory ? `<div class="question-subcategory">${q.subcategory}</div>` : ''}
        </div>
    `;
    els.options.innerHTML = q.options.map((opt, i) => `<button style="animation-delay: ${i * 0.1}s" data-correct="${opt === q.correct}">${opt}</button>`).join('');
    toggleClass(els.setup, 'remove', 'active');
    toggleClass(els.game, 'add', 'active');
    startTimer();
}

function startTimer() {
    clearInterval(state.timerId);
    clearInterval(state.totalTimerId);
    state.timeLeft = document.getElementById('quick-mode-toggle').checked ? timers.quick : timers.long;
    els.questionTimer.textContent = state.timeLeft;
    els.totalTimer.textContent = `${Math.floor(state.totalTime / 60)}:${(state.totalTime % 60).toString().padStart(2, '0')}`;
    state.timerId = setInterval(() => {
        if (--state.timeLeft <= 0) {
            clearInterval(state.timerId);
            handleTimeout();
        }
        els.questionTimer.textContent = state.timeLeft;
    }, 1000);
    state.totalTimerId = setInterval(() => {
        if (--state.totalTime <= 0) clearInterval(state.totalTimerId);
        els.totalTimer.textContent = `${Math.floor(state.totalTime / 60)}:${(state.totalTime % 60).toString().padStart(2, '0')}`;
    }, 1000);
    playSound('tick');
}

function handleTimeout() {
    els.question.classList.add('wrong-bg');
    checkAnswer(false);
}

function checkAnswer(correct) {
    stopSound('tick');
    playSound(correct ? 'correct' : 'wrong');
    state.answers.push({ correct });
    clearInterval(state.timerId);
    els.question.classList.add(correct ? 'correct-bg' : 'wrong-bg');
    els.options.querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        btn.classList.add(btn.dataset.correct === 'true' ? 'correct' : 'wrong');
    });
    if (correct) state.score += state.timeLeft * 10;
    els.score.textContent = state.score;
    if (state.current < state.selectedQuestions - 1) {
        els.nextBtn.classList.add('visible');
        state.isNextPending = true;
        setTimeout(() => state.isNextPending && handleNextQuestion(), 2000);
    } else {
        setTimeout(endGame, 1000);
    }
}

function handleNextQuestion() {
    if (!state.isNextPending) return;
    state.isNextPending = false;
    els.nextBtn.classList.remove('visible');
    if (state.current++ < state.selectedQuestions - 1) {
        showQuestion();
    } else {
        endGame();
    }
}

function endGame() {
    toggleClass(els.mainNav, 'add', 'hidden');
    clearInterval(state.timerId);
    clearInterval(state.totalTimerId);
    toggleClass(els.game, 'remove', 'active');
    toggleClass(els.summary, 'add', 'active');
    toggleClass(els.highscores, 'remove', 'hidden');
    showSummary();
    saveHighScore();
}

function restartGame() {
    state.usedQuestions.clear();
    state.questions = [];
    toggleClass(els.mainNav, 'remove', 'hidden');
    state.current = 0;
    state.score = 0;
    state.answers = [];
    state.timeLeft = document.getElementById('quick-mode-toggle').checked ? timers.quick : timers.long;
    state.totalTime = 10 * state.timeLeft;
    els.score.textContent = '0';
    els.questionCounter.textContent = `0/${state.selectedQuestions}`;
    els.totalTimer.textContent = `${Math.floor(state.totalTime / 60)}:${(state.totalTime % 60).toString().padStart(2, '0')}`;
    toggleClass(els.game, 'remove', 'active');
    toggleClass(els.summary, 'remove', 'active');
    toggleClass(els.setup, 'add', 'active');
    toggleClass(els.highscores, 'add', 'hidden');
    localStorage.removeItem(CACHE.QUESTIONS);
}

async function showSummary() {
    const timeUsed = state.selectedQuestions * (document.getElementById('quick-mode-toggle').checked ? timers.quick : timers.long) - state.totalTime;
    const correctCount = state.answers.filter(a => a.correct).length;
    const category = document.querySelector('.category-card.active')?.dataset.category || 'General Knowledge';
    const globalHigh = await db.collection('scores').where('category', '==', category).orderBy('score', 'desc').limit(1).get().then(s => s.empty ? null : s.docs[0].data());
    els.summary.innerHTML = `
        <div class="card performance-card compact">
            <h2>Game Report</h2>
            <div class="stats-row">
                <div class="stat-item correct"><span class="material-icons">check_circle</span><div><h3>${correctCount}/${state.selectedQuestions}</h3><small>Correct</small></div></div>
                <div class="stat-item time"><span class="material-icons">timer</span><div><h3>${Math.floor(timeUsed / 60)}m ${(timeUsed % 60).toString().padStart(2, '0')}s</h3><small>Time</small></div></div>
            </div>
            <div class="performance-message ${correctCount >= 0.9 * state.selectedQuestions ? 'gold' : correctCount >= 0.7 * state.selectedQuestions ? 'silver' : 'bronze'}">
                ${correctCount >= 0.9 * state.selectedQuestions ? '🏆 Trivia Deity!' : correctCount >= 0.7 * state.selectedQuestions ? '✨ Brainiac!' : '👍 Solid Effort!'}
            </div>
            ${globalHigh ? `<div class="global-high-score"><div class="trophy-icon">🏆</div><div class="global-high-details"><div class="global-high-text">Global High in ${category}:</div><div class="global-high-value">${globalHigh.score} by ${globalHigh.name}</div></div></div>` : ''}
            <button class="btn primary" id="restart-btn"><span class="material-icons">replay</span>${globalHigh && globalHigh.score > state.score ? `Chase ${globalHigh.name}'s ${globalHigh.score}!` : 'Play Again'}</button>
            ${globalHigh && globalHigh.score > state.score ? `<div class="motivation-text">You're ${globalHigh.score - state.score} points behind the leader!</div>` : globalHigh && globalHigh.score <= state.score ? `<div class="global-champion-message">🎉 You beat the global high score! Submit your score to claim the crown!</div>` : ''}
        </div>
    `;
    document.getElementById('restart-btn').addEventListener('click', restartGame);
    toggleClass(els.highscores, 'remove', 'hidden');
    toggleClass(document.querySelector('.app-footer'), 'remove', 'hidden');
    localStorage.setItem('gamesPlayed', (parseInt(localStorage.getItem('gamesPlayed') || 0) + 1));
}

function saveHighScore() {
    if (state.isScoreSaved || !state.score) return;
    const category = document.querySelector('.category-card.active')?.dataset.category || 'General Knowledge';
    const name = prompt('Enter your name:', 'Anonymous') || 'Anonymous';
    state.highScores = [...state.highScores, { name, score: state.score }].sort((a, b) => b.score - a.score).slice(0, 5);
    localStorage.setItem('highScores', JSON.stringify(state.highScores));
    updateHighScores();
    db.collection('scores').add({ name, score: state.score, category, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    state.isScoreSaved = true;
}

function updateHighScores() {
    els.highscoresList.innerHTML = state.highScores.length ? state.highScores.map((e, i) => `
        <div class="highscore-entry">
            <span class="rank">${i + 1}.</span>
            <span class="name">${e.name}</span>
            <span class="score">${e.score}</span>
        </div>
    `).join('') : '<p class="no-scores">No high scores yet. Play a game to start!</p>';
}

function setupEvents() {
    document.getElementById('instant-play').addEventListener('click', () => {
        const cards = document.querySelectorAll('.category-card');
        cards[Math.floor(Math.random() * cards.length)].click();
    });
    document.getElementById('explore-btn').addEventListener('click', () => {
        document.querySelector('.tab-button[data-tab="categories"]').click();
    });
    document.getElementById('mute-btn').addEventListener('click', () => {
        state.isMuted = !state.isMuted;
        localStorage.setItem('triviaMasterMuteState', state.isMuted);
        document.querySelector('#mute-btn .material-icons').textContent = state.isMuted ? 'volume_off' : 'volume_up';
    });
    document.getElementById('clear-scores').addEventListener('click', () => {
        if (confirm('Delete all scores?')) {
            state.highScores = [];
            localStorage.setItem('highScores', '[]');
            updateHighScores();
        }
    });
    document.querySelector('.featured-play-btn').addEventListener('click', () => {
        document.querySelector('.category-card[data-category="Weekly"]').click();
    });
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', function(e) {
            // Prevent touch devices from triggering both touch and click
            if (e.type === 'click' && ('ontouchstart' in window)) return;
            handleCategorySelection.call(this);
        });
        
        card.addEventListener('touchend', function(e) {
            handleCategorySelection.call(this);
            e.preventDefault(); // Prevent mouse events from firing
        });
    });
    document.getElementById('continue-game')?.addEventListener('click', continueGame);
    document.getElementById('end-game')?.addEventListener('click', endCurrentGame);
    elements.navLinks.forEach(link => link.addEventListener('click', handleNavClick));
    document.getElementById('decline-challenge')?.addEventListener('click', () => {
        localStorage.setItem('challengeDismissed', Date.now());
        document.getElementById('daily-challenge-modal').classList.add('hidden');
    });
    document.getElementById('accept-challenge')?.addEventListener('click', () => {
        localStorage.setItem('challengeDismissed', Date.now());
        document.getElementById('daily-challenge-modal').classList.add('hidden');
        document.querySelector('.category-card[data-category="Weekly"]').click();
    });
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(`${button.dataset.tab}-tab`).classList.add('active');
        });
    });
    els.nextBtn.addEventListener('click', handleNextQuestion);
    document.addEventListener('click', e => {
        if (e.target.matches('#options button')) checkAnswer(e.target.dataset.correct === 'true');
    });
}

function loadMuteState() {
    state.isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState') || 'false');
    document.querySelector('#mute-btn .material-icons').textContent = state.isMuted ? 'volume_off' : 'volume_up';
}

function showDailyChallenge() {
    const now = Date.now();
    if (!localStorage.getItem('challengeDismissed') || now - localStorage.getItem('challengeDismissed') > 24 * 60 * 60 * 1000) {
        setTimeout(() => document.getElementById('daily-challenge-modal').classList.remove('hidden'), 5000);
    }
}

function updateProgressTracker() {
    const gamesPlayed = localStorage.getItem('gamesPlayed') || 0;
    const progress = Math.min((gamesPlayed / 5) * 100, 100);
    const progressElement = document.getElementById('user-progress');
    progressElement.style.width = `${progress}%`;
    progressElement.setAttribute('aria-valuenow', progress);
    progressElement.setAttribute('aria-valuemin', 0);
    progressElement.setAttribute('aria-valuemax', 100);
    progressElement.setAttribute('role', 'progressbar');
    const messages = [
        { threshold: 0, message: "Play 1 more game to unlock your first badge!" },
        { threshold: 1, message: "Keep going! 3 more games for a new achievement!" },
        { threshold: 3, message: "Almost there! 1 more game to level up!" },
        { threshold: 5, message: "Trivia Master! Play to discover new challenges!" }
    ];
    const currentMessage = messages.reverse().find(m => gamesPlayed >= m.threshold) || messages[0];
    document.getElementById('progress-message').textContent = currentMessage.message;
}

document.addEventListener('DOMContentLoaded', init);