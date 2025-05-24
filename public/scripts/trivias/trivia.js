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

const els = {
    game: () => document.querySelector('.game-screen'),
    summary: () => document.querySelector('.summary-screen'),
    question: () => document.getElementById('question'),
    options: () => document.getElementById('options'),
    nextBtn: () => document.getElementById('next-btn'),
    score: () => document.getElementById('score'),
    questionTimer: () => document.getElementById('question-timer'),
    totalTimer: () => document.getElementById('total-timer'),
    highscores: () => document.querySelector('.highscores'),
    highscoresList: () => document.getElementById('highscores-list'),
    resultMessage: () => document.getElementById('result-message'),
    correctCount: () => document.getElementById('correct-count'),
    timeUsed: () => document.getElementById('time-used'),
    questionCounter: () => document.getElementById('question-counter')
};

const timers = { quick: 30, long: 60 };
const audio = {
    tick: document.getElementById('tick-sound'),
    correct: document.getElementById('correct-sound'),
    wrong: document.getElementById('wrong-sound')
};
audio.tick.loop = true;

let state = {
    isMuted: false,
    questions: [],
    current: 0,
    score: 0,
    timeLeft: null,
    totalTime: null,
    timerId: null,
    totalTimerId: null,
    highScores: [],
    answers: [],
    isScoreSaved: false,
    isNextPending: false,
    selectedQuestions: 10,
    usedQuestions: new Set(),
    fbUsedQuestions: JSON.parse(localStorage.getItem('fbUsedQuestions') || '[]'),
    fbUsedQuizIds: JSON.parse(localStorage.getItem('fbUsedQuizIds') || '[]'),
    isTimedMode: true,
    timerDuration: 'long'
};

const QUIZ_TYPES = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly'};
const CACHE = { QUESTIONS: 'trivia-questions-v1', EXPIRY: 24 * 60 * 60 * 1000 };

function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, { 'event_category': category, 'event_label': label, 'value': value });
    }
}

function toggleClass(el, action, cls) {
    el?.classList?.[action]?.(cls);
}

function playSound(type) {
    if (state.isMuted) {
        console.log(`Sound ${type} skipped: muted`);
        return;
    }
    console.log(`Playing sound: ${type}`);
    audio[type].play().catch(err => console.error(`Error playing ${type} sound:`, err));
}

function stopSound(type) {
    console.log(`Stopping sound: ${type}`);
    audio[type].pause();
    audio[type].currentTime = 0;
}

function stopAllSounds() {
    console.log('Stopping all sounds');
    ['tick', 'correct', 'wrong'].forEach(type => stopSound(type));
}

function loadMuteState() {
    state.isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || 'false';
    
    // Only use saved timer settings if they exist, otherwise use defaults
    const savedTimedMode = localStorage.getItem('triviaMasterTimedMode');
    state.isTimedMode = savedTimedMode !== null ? JSON.parse(savedTimedMode) : true;
    
    const savedTimerDuration = localStorage.getItem('triviaMasterTimerDuration');
    state.timerDuration = savedTimerDuration !== null ? savedTimerDuration : 'long';
    
    const muteBtnIcon = document.querySelector('#mute-btn .material-icons');
    if (muteBtnIcon) {
        muteBtnIcon.textContent = state.isMuted ? 'volume_off' : 'volume_up';
    }
    if (state.isMuted) {
        stopAllSounds();
    }
}

function showError(msg) {
    let error = document.getElementById('error-message');
    if (!error) {
        error = document.createElement('div');
        error.id = 'error-message';
        error.className = 'error-message';
        error.innerHTML = `<div id="error-text">${msg}</div><button id="retry-btn" class="btn small primary">Retry</button>`;
        els.game().appendChild(error);
        document.getElementById('retry-btn').addEventListener('click', () => {
            initTriviaGame(state.questions[0]?.category || 'general knowledge');
        });
    }
    error.classList.remove('hidden');
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
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
        console.log('Updating player count: ', newCount);
    } catch (error) {
        console.error('Error updating player count:', error);
        // Fallback to random number if update fails
        return Math.floor(Math.random() * 40) + 100;
    }
}

async function fetchQuestions(category) {
    try {
        console.log('Fetching questions for category:', category);
        if ([QUIZ_TYPES.DAILY, QUIZ_TYPES.WEEKLY, QUIZ_TYPES.MONTHLY].includes(category.toLowerCase())) {
            return await fetchfbQuiz(category.toLowerCase());
        }
        return await fetchfbQuestions(category);
    } catch (e) {
        console.error('Error in fetchQuestions:', e);
        showError(e.message || 'Failed to load questions.');
        throw e;
    }
}

async function fetchfbQuiz(type) {
    // Add this at the beginning of the function
        if (type === 'daily') {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const cacheKey = `fb-daily-quiz-${today}`;
        
        // Check cache with the same expiration as router.js (midnight)
        const cached = JSON.parse(localStorage.getItem('fbdailyQuizCache'))?.[cacheKey];
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        
        if (cached && now < midnight) {
            return shuffle(cached.questions);
        }
        
        // Fetch 5 general knowledge questions
        const querySnapshot = await db.collection('basic_intro_questions')
                             .where('randomIndex', '>=', Math.floor(Math.random() * 900))
                             .orderBy('randomIndex')
                             .limit(5)
                             .get();
            
        const questions = querySnapshot.docs.map(doc => ({
            id: doc.id,
            question: decodeHTML(doc.data().question),
            correct: decodeHTML(doc.data().correct_answer),
            options: shuffle([...doc.data().incorrect_answers.map(decodeHTML), decodeHTML(doc.data().correct_answer)]),
            category: 'daily',
            difficulty: doc.data().difficulty || 'medium',
            titbits: doc.data().titbits || ''
        })).slice(0, 5);
            
        localStorage.setItem('fbdailyQuizCache', JSON.stringify({
            ...JSON.parse(localStorage.getItem('fbdailyQuizCache') || '{}'),
            [cacheKey]: { questions, timestamp: now.getTime() }
        }));
        
        return shuffle(questions);
    }
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
        difficulty: q.difficulty || 'medium',
        titbits: q.titbits || ''
    }));
    localStorage.setItem('fbQuizCache', JSON.stringify({ ...JSON.parse(localStorage.getItem('fbQuizCache') || '{}'), [cacheKey]: { questions, timestamp: Date.now() } }));
    state.fbUsedQuizIds.push(cacheKey);
    localStorage.setItem('fbUsedQuizIds', JSON.stringify(state.fbUsedQuizIds));
    return shuffle(questions);
}

async function fetchfbQuestions(category, amount = 10) {
    const normalizedCategory = category.toLowerCase();
    console.log('Fetching questions for category:', category);
    const cacheKey = `fb_questions-${normalizedCategory}`;
    const cache = JSON.parse(localStorage.getItem('fbQuestionsCache'))?.[cacheKey];
    if (cache && cache.questions.length >= amount && cache.questions.filter(q => !state.fbUsedQuestions.includes(q.id)).length >= amount) {
        console.log('Using cached questions:', cache.questions);
        return processfbQuestions(cache.questions, amount);
    }
    let query = db.collection('triviaMaster').doc('questions').collection('items');
    if (category !== 'general knowledge') query = query.where('category', '==', category);
    query = query.where('randomIndex', '>=', Math.floor(Math.random() * 900))
            .orderBy('randomIndex')
            .limit(amount * 2);
    const snapshot = await query.get();
    if (snapshot.empty) {
        console.warn(`No questions found for ${category}, falling back to general knowledge`);
        showError(`No questions available for ${category}. Loading general knowledge instead.`);
        return fetchfbQuestions('general knowledge', amount);
    }
    const questions = snapshot.docs.map(doc => ({
        id: doc.id,
        question: decodeHTML(doc.data().question),
        correct: decodeHTML(doc.data().correct_answer),
        options: shuffle([...doc.data().incorrect_answers.map(decodeHTML), decodeHTML(doc.data().correct_answer)]),
        category: doc.data().category,
        subcategory: doc.data().subcategory || '',
        difficulty: doc.data().difficulty || 'medium',
        titbits: doc.data().titbits || ''
    }));
    console.log('Fetched questions:', questions);
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
    return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function updateTimerUI() {
    state.timeLeft = state.isTimedMode ? timers[state.timerDuration] : null;
    state.totalTime = state.isTimedMode ? state.selectedQuestions * state.timeLeft : null;
    const questionTimerParent = els.questionTimer()?.parentElement;
    const totalTimerParent = els.totalTimer()?.parentElement;
    if (state.isTimedMode) {
        toggleClass(questionTimerParent, 'remove', 'hidden');
        toggleClass(totalTimerParent, 'remove', 'hidden');
        if (els.questionTimer()) els.questionTimer().textContent = state.timeLeft;
        if (els.totalTimer()) els.totalTimer().textContent = `${Math.floor(state.totalTime / 60)}:${(state.totalTime % 60).toString().padStart(2, '0')}`;
    } else {
        toggleClass(questionTimerParent, 'add', 'hidden');
        toggleClass(totalTimerParent, 'add', 'hidden');
        if (els.questionTimer()) els.questionTimer().textContent = 'N/A';
        if (els.totalTimer()) els.totalTimer().textContent = 'N/A';
    }
}

export function initTriviaGame(category) {
    if (category === 'daily') {
        state.isTimedMode = true;
        state.timerDuration = 'quick';
        state.selectedQuestions = 5;
        localStorage.setItem('triviaMasterTimedMode', 'true');
        localStorage.setItem('triviaMasterTimerDuration', 'quick');
        messages.zero = [
            "Don't worry! These were starter questions.",
            "Everyone starts somewhere! Try again?",
            "Basic knowledge builds up over time!",
            "Ready for another quick try?"
        ];
    } else {
        // For non-daily games, use the loaded settings (which default to timed mode with 60s timer)
        state.isTimedMode = JSON.parse(localStorage.getItem('triviaMasterTimedMode')) || true;
        state.timerDuration = localStorage.getItem('triviaMasterTimerDuration') || 'long';
    }
    
    // Ensure game screen is active
    els.game().classList.add('active');
    els.game().classList.remove('hidden');
    els.summary().classList.remove('active');
    
    console.log('Initializing game for category:', category);
    trackEvent('game_start', 'game', category, 1);
    state.questions = [];
    state.current = 0;
    state.score = 0;
    state.answers = [];
    state.isScoreSaved = false;
    state.isNextPending = false;
    updateTimerUI();
    els.score().textContent = '0';
    loadMuteState();
    updatePlayerCount(category);
    
    fetchQuestions(category).then(questions => {
        state.questions = questions;
        showQuestion();
    }).catch(err => {
        console.error('Error fetching questions:', err);
        showError(err.message || 'Failed to load questions.');
    });
    
    setupEvents();
}

function showQuestion() {
    toggleClass(document.querySelector('.app-footer'), 'add', 'hidden');
    els.question().classList.remove('correct-bg', 'wrong-bg');
    const q = state.questions[state.current];
    if (!q) return endGame();
    const displayCategory = q.category === 'general knowledge' ? 'general knowledge' : toInitCaps(q.category);
    els.question().innerHTML = `
        <div class="question-text">${q.question}</div>
        <div class="question-meta">
            <div class="question-category">${displayCategory}${q.difficulty ? `<span class="question-difficulty ${q.difficulty}">${toInitCaps(q.difficulty)}</span>` : ''}</div>
            ${q.subcategory ? `<div class="question-subcategory">${q.subcategory}</div>` : ''}
        </div>
    `;
    els.options().innerHTML = q.options.map((opt, i) => `<button style="animation-delay: ${i * 0.1}s" data-correct="${opt === q.correct}">${opt}</button>`).join('');
    if (els.questionCounter()) {
        els.questionCounter().textContent = `${state.current + 1}/${state.selectedQuestions}`;
    }
    toggleClass(els.game(), 'add', 'active');
    toggleClass(els.summary(), 'remove', 'active');
    els.questionTimer().textContent = state.isTimedMode ? state.timeLeft : 'N/A';
    els.totalTimer().textContent = state.isTimedMode ? `${Math.floor(state.totalTime / 60)}:${(state.totalTime % 60).toString().padStart(2, '0')}` : 'N/A';
    setupOptionEvents();
    startTimer();
}

function setupOptionEvents() {
    const optionsContainer = els.options();
    if (!optionsContainer) {
        console.error('Options container (#options) not found in DOM');
        return;
    }
    optionsContainer.querySelectorAll('button').forEach(button => {
        button.removeEventListener('click', handleOptionClick);
        button.addEventListener('click', handleOptionClick);
    });
    els.nextBtn().classList.remove('visible');
}

function handleOptionClick(e) {
    console.log('Option button clicked:', e.target.textContent, 'data-correct:', e.target.dataset.correct);
    const isCorrect = e.target.dataset.correct === 'true';
    checkAnswer(isCorrect);
}

function startTimer() {
    clearInterval(state.timerId);
    clearInterval(state.totalTimerId);
    if (state.isTimedMode) {
        state.timeLeft = timers[state.timerDuration];
        state.totalTime = state.selectedQuestions * state.timeLeft;
        els.questionTimer().textContent = state.timeLeft;
        els.totalTimer().textContent = `${Math.floor(state.totalTime / 60)}:${(state.totalTime % 60).toString().padStart(2, '0')}`;
        state.timerId = setInterval(() => {
            if (--state.timeLeft <= 0) {
                clearInterval(state.timerId);
                handleTimeout();
            }
            els.questionTimer().textContent = state.timeLeft;
        }, 1000);
        state.totalTimerId = setInterval(() => {
            if (--state.totalTime <= 0) clearInterval(state.totalTimerId);
            els.totalTimer().textContent = `${Math.floor(state.totalTime / 60)}:${(state.totalTime % 60).toString().padStart(2, '0')}`;
        }, 1000);
        if (!state.isMuted) playSound('tick');
    } else {
        els.questionTimer().textContent = 'N/A';
        els.totalTimer().textContent = 'N/A';
    }
}

function handleTimeout() {
    if (state.isTimedMode) {
        els.question().classList.add('wrong-bg');
        checkAnswer(false);
    }
}

function checkAnswer(correct) {
    stopSound('tick');
    playSound(correct ? 'correct' : 'wrong');
    state.answers.push({ correct });
    clearInterval(state.timerId);
    clearInterval(state.totalTimerId);
    els.question().classList.add(correct ? 'correct-bg' : 'wrong-bg');
    els.options().querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        btn.classList.add(btn.dataset.correct === 'true' ? 'correct' : 'wrong');
    });
    if (correct && state.isTimedMode) state.score += state.timeLeft * 10;
    els.score().textContent = state.score;
    const q = state.questions[state.current];
    const existingTitbits = els.question().querySelector('.question-titbits');
    if (existingTitbits) existingTitbits.remove();
    if (q.titbits) {
        els.question().innerHTML += `
            <div class="question-titbits">
                <span class="titbits-icon">💡</span> Fun Fact: ${q.titbits}
            </div>
        `;
    }
    if (state.current < state.selectedQuestions - 1) {
        els.nextBtn().classList.add('visible');
        state.isNextPending = true;
        if (state.isTimedMode) {
            setTimeout(() => {
                if (state.isNextPending) handleNextQuestion();
            }, 2000);
        }
    } else {
        setTimeout(endGame, 1000);
    }
}

function handleNextQuestion() {
    if (!state.isNextPending) return;
    state.isNextPending = false;
    els.nextBtn().classList.remove('visible');
    if (state.current++ < state.selectedQuestions - 1) {
        showQuestion();
    } else {
        endGame();
    }
}

async function endGame() {
    console.log('Starting endGame, answers:', state.answers.length, 'questions:', state.selectedQuestions);
    window.endGame = endGame;
    const correctCount = state.answers.filter(a => a.correct).length;
    trackEvent('game_complete', 'performance', `${correctCount}/${state.selectedQuestions} correct`, state.score);
    
    const gameScreen = els.game();
    const summaryScreen = els.summary();
    const highscores = els.highscores();
    
    if (!gameScreen || !summaryScreen || !highscores) {
        console.error('DOM elements missing:', {
            gameScreen: !!gameScreen,
            summaryScreen: !!summaryScreen,
            highscores: !!highscores
        });
        return;
    }
    
    console.log('Removing active from game-screen, adding active to summary-screen, showing highscores');
    gameScreen.classList.add('hidden');
    summaryScreen.classList.add('active');
    highscores.classList.remove('hidden');
    document.querySelector('.app-footer')?.classList.remove('hidden');
    
    clearInterval(state.timerId);
    clearInterval(state.totalTimerId);
    stopAllSounds();

    const category = state.questions[0]?.category || 'general knowledge';
    let globalHigh = null;
    try {
        const highScoreSnapshot = await db.collection('scores')
                                        .where('category', '==', category)
                                        .orderBy('score', 'desc')
                                        .limit(1)
                                        .get();
        
        console.log(highScoreSnapshot);                   
        globalHigh = highScoreSnapshot.empty ? null : highScoreSnapshot.docs[0].data();
    } catch (error) {
        console.error('endGame: Error fetching global high score:', error);
    }

    try {
        saveHighScore();
    } catch (error) {
        console.error('endGame: Error in saveHighScore:', error);
    }

    try {
        await showSummary(globalHigh);
    } catch (error) {
        console.error('endGame: Error in showSummary:', error);
    }
    
    // Handle daily game specific UI
    if (state.questions[0]?.category === 'daily') {
        const actionButtons = document.querySelector('.action-buttons');
        if (actionButtons) {
            actionButtons.innerHTML = `
                <div class="progress-message">
                    <p>You've completed today's daily challenge!</p>
                    <p>New questions in <span id="daily-reset-timer"></span></p>
                    <button id="upgrade-btn" class="btn primary">Try Regular Quiz</button>
                </div>
            `;
            
            // Properly set up the upgrade button
            const upgradeBtn = document.getElementById('upgrade-btn');
            if (upgradeBtn) {
                upgradeBtn.addEventListener('click', () => {
                    // Reset game state for regular quiz
                    state.isTimedMode = false;
                    state.selectedQuestions = 10;
                    localStorage.removeItem('triviaMasterTimedMode');
                    localStorage.removeItem('triviaMasterTimerDuration');
                    initTriviaGame('general knowledge');
                });
            }
            
            // Update the timer display
            updateDailyResetTimer();
            setInterval(updateDailyResetTimer, 1000);
        }
    } else {
        // Show restart button for non-daily games
        const actionButtons = document.querySelector('.action-buttons');
        if (actionButtons) {
            actionButtons.innerHTML = `
                <button class="btn primary" id="restart-btn">
                    <span class="material-icons">replay</span>Play Again
                </button>
            `;
            
            // Set up restart button
            const restartBtn = document.getElementById('restart-btn');
            if (restartBtn) {
                restartBtn.addEventListener('click', restartGame);
            }
        }
    }
}

// Add this new function to update the daily reset timer
function updateDailyResetTimer() {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    const timerElement = document.getElementById('daily-reset-timer');
    if (timerElement) {
        timerElement.textContent = `${hours}h ${minutes}m`;
    }
}

function restartGame() {
    trackEvent('restart_game', 'navigation', 'from_summary');
    state.usedQuestions.clear();
    state.questions = [];
    state.current = 0;
    state.score = 0;
    state.answers = [];
    updateTimerUI();
    els.score().textContent = '0';
    els.totalTimer().textContent = state.isTimedMode ? `${Math.floor(state.totalTime / 60)}:${(state.totalTime % 60).toString().padStart(2, '0')}` : 'N/A';
    
    // Fix: Remove hidden class and add active class
    els.game().classList.remove('hidden');
    els.game().classList.add('active');
    
    els.summary().classList.remove('active');
    els.highscores().classList.add('hidden');
    localStorage.removeItem(CACHE.QUESTIONS);
    initTriviaGame(state.questions[0]?.category || 'general knowledge');
}

async function showSummary(globalHigh) {
    console.log('Starting showSummary, globalHigh:', globalHigh);
    const timeUsed = state.isTimedMode ? (state.selectedQuestions * timers[state.timerDuration] - state.totalTime) : 0;
    const correctCount = state.answers.filter(a => a.correct).length;
    const category = state.questions[0]?.category || 'general knowledge';
    
    let messageCategory, messageClass;
    if (correctCount === 0) {
        messageCategory = 'zero';
        messageClass = 'zero';
    } else if (correctCount >= 0.9 * state.selectedQuestions) {
        messageCategory = 'gold';
        messageClass = 'gold';
    } else if (correctCount >= 0.7 * state.selectedQuestions) {
        messageCategory = 'silver';
        messageClass = 'silver';
    } else {
        messageCategory = 'bronze';
        messageClass = 'bronze';
    }
    const message = messages[messageCategory][Math.floor(Math.random() * messages[messageCategory].length)];

    const highscoresList = els.highscoresList();
    if (!highscoresList) {
        console.error('Highscores list (#highscores-list) not found in DOM');
        return;
    }

    const perfMsg = document.querySelector('.performance-message');
    if ( perfMsg ) {
        perfMsg.classList.add(messageClass);
    }
    
    highscoresList.innerHTML = '<div class="loading-indicator"><div class="loading-spinner"></div><p>Loading high scores...</p></div>';

    const correctCountEl = els.correctCount();
    const timeUsedEl = els.timeUsed();
    const resultMessageEl = els.resultMessage();
    
    if (!correctCountEl || !timeUsedEl || !resultMessageEl) {
        console.error('Summary elements missing:', {
            correctCount: !!correctCountEl,
            timeUsed: !!timeUsedEl,
            resultMessage: !!resultMessageEl
        });
        return;
    }
    
    console.log('Updating summary: correctCount=', correctCount, 'timeUsed=', timeUsed, 'message=', message);
    correctCountEl.textContent = `${correctCount}/${state.selectedQuestions}`;
    timeUsedEl.textContent = state.isTimedMode ? `${Math.floor(timeUsed / 60)}m ${(timeUsed % 60).toString().padStart(2, '0')}s` : 'N/A';
    resultMessageEl.innerHTML = message;
    
    if (globalHigh) {
        console.log('Adding global high score:', globalHigh);
        resultMessageEl.insertAdjacentHTML('afterend', `
            <div class="global-high-score">
                <div class="global-high-details">
                    <div class="global-high-text"> 🏆 Global High in ${toInitCaps(category)}: ${globalHigh.score} by ${globalHigh.name}</div>
                </div>
            </div>
            ${globalHigh.score > state.score ? `<div class="motivation-text">You're ${globalHigh.score - state.score} points behind the leader!</div>` : `<div class="global-champion-message">🎉 You beat the global high score! Submit your score to claim the crown!</div>`}
        `);
    }

    // Update total score display
    document.getElementById('total-score').textContent = state.score;

    // Ensure high scores fit in compact view
    els.highscoresList().innerHTML = state.highScores.length ? 
        state.highScores.map((e, i) => `
            <div class="highscore-entry compact">
                <span class="name">${i+1}. ${e.name}</span>
                <span class="score">${e.score}</span>
            </div>
        `).join('') : 
        '<p class="no-scores">No high scores yet</p>';
    
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.removeEventListener('click', restartGame);
        restartBtn.addEventListener('click', restartGame);
        console.log('Restart button event listener set');
    } else {
        console.error('Restart button (#restart-btn) not found in DOM');
    }
    
    els.highscores().classList.remove('hidden');
    localStorage.setItem('gamesPlayed', (parseInt(localStorage.getItem('gamesPlayed') || '0') + 1));
    
    try {
        await updateHighScores();
        console.log('High scores updated');
    } catch (error) {
        console.error('showSummary: Error updating high scores:', error);
    }
}


async function saveHighScore() {
    if (state.isScoreSaved || !state.score) return;
    const category = state.questions[0]?.category || 'general knowledge';
    const name = prompt('Enter your name:', 'Anonymous') || 'Anonymous';
    
    await db.collection('scores').add({
        name, 
        score: state.score, 
        category, 
        timestamp: firebase.firestore.Timestamp.now()
    });
    state.isScoreSaved = true;
    updateHighScores();
}

async function updateHighScores() {
    const highscoresList = els.highscoresList();
    if (!highscoresList) return;

    const category = state.questions[0]?.category || 'general knowledge';
    try {
        const snapshot = await db.collection('scores')
            .where('category', '==', category)
            .orderBy('score', 'desc')
            .limit(5)
            .get();
            
        state.highScores = snapshot.docs.map(doc => doc.data());
        highscoresList.innerHTML = state.highScores.length ? 
            state.highScores.map((e, i) => `
                <div class="highscore-entry">
                    <span class="rank">${i + 1}.</span>
                    <span class="name">${e.name}</span>
                    <span class="score">${e.score}</span>
                </div>
            `).join('') : 
            '<p class="no-scores">No high scores yet for this category. Play a game to start!</p>';
    } catch (error) {
        console.error('updateHighScores: Error fetching global high scores:', error);
        highscoresList.innerHTML = '<p class="no-scores">Error loading high scores. Please try again later.</p>';
    }
}

function setupEvents() {
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', handleNextQuestion);
    }

    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            state.isMuted = !state.isMuted;
            localStorage.setItem('triviaMasterMuteState', state.isMuted);
            const icon = muteBtn.querySelector('.material-icons');
            if (icon) icon.textContent = state.isMuted ? 'volume_off' : 'volume_up';
            if (state.isMuted) {
                stopAllSounds();
            } else if (els.game().classList.contains('active') && state.isTimedMode) {
                playSound('tick');
            }
        });
    }

    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const timedModeToggle = document.getElementById('timed-mode');
    const modeLabel = document.getElementById('mode-label');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const timerDurationSelect = document.getElementById('timer-duration');

    if (settingsBtn && settingsPanel) {
        settingsBtn.addEventListener('click', () => {
            toggleClass(settingsPanel, 'remove', 'hidden');
            if (timedModeToggle) timedModeToggle.checked = state.isTimedMode;
            if (modeLabel) modeLabel.textContent = state.isTimedMode ? 'Timed' : 'Non-Timed';
            if (timerDurationSelect) {
                timerDurationSelect.value = state.timerDuration;
                timerDurationSelect.parentElement.style.display = state.isTimedMode ? 'flex' : 'none';
            }
        });
    }

    if (timedModeToggle) {
        timedModeToggle.addEventListener('change', () => {
            console.log('Timed mode toggled to:', timedModeToggle.checked);
            modeLabel.textContent = timedModeToggle.checked ? 'Timed' : 'Non-Timed';
            if (timerDurationSelect) {
                timerDurationSelect.parentElement.style.display = timedModeToggle.checked ? 'flex' : 'none';
            }
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const newTimedMode = timedModeToggle ? timedModeToggle.checked : state.isTimedMode;
            const newTimerDuration = timerDurationSelect ? timerDurationSelect.value : state.timerDuration;
            if (newTimedMode !== state.isTimedMode || newTimerDuration !== state.timerDuration) {
                state.isTimedMode = newTimedMode;
                state.timerDuration = newTimerDuration;
                localStorage.setItem('triviaMasterTimedMode', state.isTimedMode);
                localStorage.setItem('triviaMasterTimerDuration', state.timerDuration);
                state.current = 0;
                updateTimerUI();
                showQuestion();
            }
            toggleClass(settingsPanel, 'add', 'hidden');
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            toggleClass(settingsPanel, 'add', 'hidden');
        });
    }
}

function setupStartQuizListener() {
    console.log('Setting up startQuiz listener');
    document.addEventListener('startQuiz', (e) => {
        const { category, isTimedMode } = e.detail;
        console.log('Received startQuiz event:', { category, isTimedMode });
        state.isTimedMode = isTimedMode;
        initTriviaGame(category);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('trivia.js DOMContentLoaded');
    setupStartQuizListener();
    loadMuteState();
    if (window.location.pathname.includes('catalog.html')) return;
    const pathParts = window.location.pathname.split('/').filter(part => part);
    const category = pathParts.length > 1 ? pathParts[1].replace(/-/g, ' ') : 'general knowledge';
    initTriviaGame(category);
});