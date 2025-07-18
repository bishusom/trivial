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
    highscores: () => document.querySelector('.highscores'),
    highscoresList: () => document.getElementById('highscores-list'),
    resultMessage: () => document.getElementById('result-message'),
    correctCount: () => document.getElementById('correct-count'),
    timeUsed: () => document.getElementById('time-used'),
    questionCounter: () => document.getElementById('question-counter'),
    difficultyDisplay: () => document.getElementById('difficulty-level-display'),
    difficultyBox: () => document.querySelector('.difficulty-box')
};

const timers = { quick: 10, long: 60 };
const audio = {
    tick: document.getElementById('tick-sound'),
    correct: document.getElementById('correct-sound'),
    wrong: document.getElementById('wrong-sound')
};
audio.tick.loop = true;

const imageCache = {};
const SPECIAL_QUIZ_TYPES = ['daily', '90s movie trivia', 'pub quiz', 'famous quotes', 'country capitals'];

const CATEGORY_ALIASES = {
    'board games': 'board-games',
    'video games': 'video-games',
    'famous quotes': 'famous-quotes',
    'country capitals': 'country-capitals',
    '90s movie trivia': '90s-movie-trivia',
    'pub quiz': 'pub-quiz'
};

let state = {
    isMuted: false,
    questions: [],
    current: 0,
    score: 0,
    timeLeft: null,
    timerId: null,
    highScores: [],
    answers: [],
    isScoreSaved: false,
    isNextPending: false,
    selectedQuestions: 10,
    usedQuestions: new Set(),
    fbUsedQuestions: JSON.parse(localStorage.getItem('fbUsedQuestions') || '[]'),
    fbUsedQuizIds: JSON.parse(localStorage.getItem('fbUsedQuizIds') || '[]'),
    isTimedMode: true,
    timerDuration: 'long',
    difficulty: 'mixed',
    rememberSettings: false,
    showSettingsOnStart: true,
    category: 'general knowledge'
};

let nlp;
if (typeof window !== 'undefined' && window.nlp) {
    nlp = window.nlp;
    console.log('Found nlp');
} else {
    nlp = {
        nouns: () => ({ out: () => [] }),
        adjectives: () => ({ out: () => [] })
    };
    console.log('Creating home-grown nlp');
}

const QUIZ_TYPES = { DAILY: 'daily' };
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
    state.isMuted = JSON.parse(localStorage.getItem('triviaMasterMuteState')) || false;
    const savedTimedMode = localStorage.getItem('triviaMasterTimedMode');
    state.isTimedMode = savedTimedMode !== null ? JSON.parse(savedTimedMode) : true;
    const savedTimerDuration = localStorage.getItem('triviaMasterTimerDuration');
    state.timerDuration = savedTimerDuration !== null ? savedTimerDuration : 'long';
    const savedDifficulty = localStorage.getItem('triviaMasterDifficulty');
    state.difficulty = savedDifficulty !== null ? savedDifficulty : 'mixed';
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
            initTriviaGame(state.category);
        });
    }
    error.classList.remove('hidden');
}

async function updatePlayerCount(category) {
    try {
        const countRef = db.collection('playerCounts').doc(category);
        const doc = await countRef.get();
        const currentCount = doc.exists ? doc.data().count : 0;
        const newCount = currentCount + 1;
        await countRef.set({
            count: newCount,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            category: category
        }, { merge: true });
        console.log('Updating player count: ', newCount);
    } catch (error) {
        console.error('Error updating player count:', error);
        return Math.floor(Math.random() * 40) + 100;
    }
}

function extractKeywordNLP(question) {
    const doc = nlp(question);
    const nouns = doc.nouns().out('array');
    if (nouns.length > 0) return nouns[0];
    const adjectives = doc.adjectives().out('array');
    if (adjectives.length > 0) return adjectives[0];
    const words = question.replace(/[^a-zA-Z0-9\s]/g, '').split(' ');
    const validWords = words.filter(w => w.length > 3 && !['what', 'which', 'where', 'when', 'who', 'how'].includes(w.toLowerCase()));
    return validWords[0] || words[0] || 'trivia';
}

async function fetchImage(keyword) {
    if (!keyword || typeof keyword !== 'string') {
        console.warn('Invalid keyword for image fetch:', keyword);
        return null;
    }
    if (imageCache[keyword]) {
        console.log('Using cached image for keyword:', keyword, imageCache[keyword]);
        return imageCache[keyword];
    }
    console.log('Fetching image for keyword:', keyword);
    let attempts = 2;
    while (attempts > 0) {
        try {
            const response = await fetch(`/.netlify/functions/get-image?keyword=${encodeURIComponent(keyword)}`);
            console.log('fetchImage response status:', response.status, 'keyword:', keyword);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('fetchImage HTTP error:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('fetchImage invalid content type:', contentType);
                throw new Error('Invalid content type');
            }
            const data = await response.json();
            console.log('fetchImage response data:', data);
            if (data.url) {
                imageCache[keyword] = data.url;
                return data.url;
            }
            console.warn('fetchImage: No URL in response for keyword:', keyword);
            return null;
        } catch (error) {
            console.error(`fetchImage: Error (attempt ${3 - attempts}) for keyword "${keyword}":`, error);
            attempts--;
            if (attempts === 0) {
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        }
    }
    return null;
}

async function preFetchImages(questions) {
    const keywords = questions.map(q => q.image_keyword || extractKeywordNLP(q.question));
    const uniqueKeywords = [...new Set(keywords)];
    console.log('Pre-fetching images for keywords:', uniqueKeywords);
    try {
        await Promise.all(uniqueKeywords.map(async keyword => {
            if (!imageCache[keyword]) {
                const url = await fetchImage(keyword);
                if (url) {
                    imageCache[keyword] = url;
                    console.log('Cached image for', keyword, ':', url);
                }
            }
        }));
        console.log('All images pre-fetched:', imageCache);
    } catch (error) {
        console.error('Error pre-fetching images:', error);
        // Do not clear imageCache to preserve existing entries
    }
}

async function fetchQuestions(category) {
    try {
        console.log('Fetching questions for category:', category);
        if (SPECIAL_QUIZ_TYPES.includes(category.toLowerCase())) {
            return await fetchSpecialQuiz(category.toLowerCase());
        }
        return await fetchfbQuestions(category, state.selectedQuestions, state.difficulty);
    } catch (e) {
        console.error('Error in fetchQuestions:', e);
        showError(e.message || 'Failed to load questions.');
        throw e;
    }
}

async function fetchSpecialQuiz(category) {
    const queryCategory = CATEGORY_ALIASES[category] || category;
    console.log('Fetching special quiz for:', queryCategory);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const cacheKey = `fb-${queryCategory}-quiz-${today}`;
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const cached = JSON.parse(localStorage.getItem('fbQuizCache'))?.[cacheKey];
    if (cached && now < midnight) {
        return shuffle(cached.questions);
    }
    const querySnapshot = await db.collection('triviaMaster').doc('questions').collection('items')
        .where('category', '==', queryCategory)
        .where('randomIndex', '>=', Math.floor(Math.random() * 900))
        .orderBy('randomIndex')
        .limit(10)
        .get();
    
    if (querySnapshot.empty) {
        console.warn(`No questions found for ${category}, falling back to general knowledge`);
        showError(`No questions available for ${category}. Loading general knowledge instead.`);
        return fetchfbQuestions('general knowledge', 10, 'mixed');
    }
    
    const questions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        question: decodeHTML(doc.data().question),
        correct: decodeHTML(doc.data().correct_answer),
        options: shuffle([...doc.data().incorrect_answers.map(decodeHTML), decodeHTML(doc.data().correct_answer)]),
        category: queryCategory,
        subcategory: doc.data().subcategory,
        difficulty: doc.data().difficulty,
        titbits: doc.data().titbits || '',
        image_keyword: doc.data().image_keyword || null 
    })).slice(0, 10);
    
    localStorage.setItem('fbQuizCache', JSON.stringify({
        ...JSON.parse(localStorage.getItem('fbQuizCache') || '{}'),
        [cacheKey]: { questions, timestamp: now.getTime() }
    }));
    return shuffle(questions);
}

async function fetchfbQuestions(category, amount = 10, difficulty = 'mixed') {
    const normalizedCategory = category.toLowerCase();
    const queryCategory = CATEGORY_ALIASES[category] || category;
    console.log('Fetching questions for category:', queryCategory, 'difficulty:', difficulty);
    
    const difficulties = difficulty === 'mixed' ? ['easy', 'medium', 'hard'] : [difficulty];
    const cacheKey = `fb_questions-${normalizedCategory}-${difficulty}`;
    const cache = JSON.parse(localStorage.getItem('fbQuestionsCache'))?.[cacheKey];
    
    if (cache && cache.questions.length >= amount && cache.questions.filter(q => !state.fbUsedQuestions.includes(q.id)).length >= amount) {
        console.log('Using cached questions:', cache.questions);
        return processfbQuestions(cache.questions, amount);
    }
    
    let questions = [];
    for (const diff of difficulties) {
        let query = db.collection('triviaMaster').doc('questions').collection('items');
        if (queryCategory !== 'general knowledge') query = query.where('category', '==', queryCategory);
        
        query = query.where('randomIndex', '>=', Math.floor(Math.random() * 900))
                .where('difficulty', '==', diff)
                .orderBy('randomIndex')
                .limit(Math.ceil(amount / difficulties.length) * 2);
                
        const snapshot = await query.get();
        if (!snapshot.empty) {
            questions.push(...snapshot.docs.map(doc => ({
                id: doc.id,
                question: decodeHTML(doc.data().question),
                correct: decodeHTML(doc.data().correct_answer),
                options: shuffle([...doc.data().incorrect_answers.map(decodeHTML), decodeHTML(doc.data().correct_answer)]),
                category: queryCategory,
                subcategory: doc.data().subcategory || '',
                difficulty: doc.data().difficulty || diff,
                titbits: doc.data().titbits || '',
                image_keyword: doc.data().image_keyword || null
            })));
        }
    }
    
    if (questions.length === 0) {
        console.warn(`No questions found for ${category}, falling back to general knowledge`);
        showError(`No questions available for ${category}. Loading general knowledge instead.`);
        return fetchfbQuestions('general knowledge', amount, difficulty);
    }
    
    console.log('Fetched questions:', questions);
    localStorage.setItem('fbQuestionsCache', JSON.stringify({ 
        ...JSON.parse(localStorage.getItem('fbQuestionsCache') || '{}'), 
        [cacheKey]: { questions, timestamp: Date.now() } 
    }));
    
    return processfbQuestions(shuffle(questions), amount);
}

function processfbQuestions(questions, amount) {
    const available = questions.filter(q => !state.fbUsedQuestions.includes(q.id));
    const selected = shuffle(available).slice(0, Math.min(amount, available.length));
    state.fbUsedQuestions.push(...selected.map(q => q.id));
    localStorage.setItem('fbUsedQuestions', JSON.stringify(state.fbUsedQuestions.slice(-500)));
    return selected.map(q => ({ 
        ...q, 
        options: shuffle([...q.options]),
        image_keyword: q.image_keyword || null
    }));
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

function updateDifficultyDisplay() {
    const display = els.difficultyDisplay();
    const box = els.difficultyBox();
    if (!display || !box) return;
    
    box.classList.remove('easy', 'medium', 'hard', 'mixed');
    if (SPECIAL_QUIZ_TYPES.includes(state.category)) {
        display.textContent = 'Mixed';
        box.classList.add('mixed');
    } else {
        switch(state.difficulty) {
            case 'easy':
                display.textContent = 'Easy';
                box.classList.add('easy');
                break;
            case 'medium':
                display.textContent = 'Medium';
                box.classList.add('medium');
                break;
            case 'hard':
                display.textContent = 'Hard';
                box.classList.add('hard');
                break;
            default:
                display.textContent = 'Mixed';
                box.classList.add('mixed');
        }
    }
}

function updateTimerUI() {
    state.timeLeft = state.isTimedMode ? timers[state.timerDuration] : null;
    const questionTimerParent = els.questionTimer()?.parentElement;
    if (state.isTimedMode) {
        toggleClass(questionTimerParent, 'remove', 'hidden');
        if (els.questionTimer()) els.questionTimer().textContent = state.timeLeft;
    } else {
        toggleClass(questionTimerParent, 'add', 'hidden');
        if (els.questionTimer()) els.questionTimer().textContent = 'N/A';
    }
}

export function initTriviaGame(category) {
    loadMuteState();
    state.rememberSettings = JSON.parse(localStorage.getItem('triviaMasterRememberSettings')) || false;
    state.showSettingsOnStart = !state.rememberSettings && !SPECIAL_QUIZ_TYPES.includes(category);
    state.category = category;
    
    if (SPECIAL_QUIZ_TYPES.includes(category)) {
        state.isTimedMode = true;
        state.timerDuration = 'quick';
        state.selectedQuestions = 10;
        state.difficulty = 'mixed';
        localStorage.setItem('triviaMasterTimedMode', 'true');
        localStorage.setItem('triviaMasterTimerDuration', 'quick');
        messages.zero = [
            "Don't worry! These were starter questions.",
            "Everyone starts somewhere! Try again?",
            "Basic knowledge builds up over time!",
            "Ready for another quick try?"
        ];
    } else {
        state.isTimedMode = JSON.parse(localStorage.getItem('triviaMasterTimedMode')) || true;
        state.timerDuration = localStorage.getItem('triviaMasterTimerDuration') || 'long';
        state.rememberSettings = JSON.parse(localStorage.getItem('triviaMasterRememberSettings')) || true;
        state.difficulty = localStorage.getItem('triviaMasterDifficulty') || 'mixed';
    }
    
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
    updatePlayerCount(category);
    
    if (state.showSettingsOnStart) {
        showSettingsPanel(true);
    } else {
        startGameWithSettings(category);
    }
    
    setupEvents();
}

async function showQuestion() {
    toggleClass(document.querySelector('.app-footer'), 'add', 'hidden');
    els.question().classList.remove('correct-bg', 'wrong-bg');
    const q = state.questions[state.current];
    if (!q) return endGame();
    
    const displayCategory = q.category === 'general knowledge' ? 'general knowledge' : toInitCaps(q.category);
    
    els.question().innerHTML = '<div class="question-loading">Loading question...</div>';
    
    const keyword = q.image_keyword || extractKeywordNLP(q.question);
    let imageUrl = imageCache[keyword] || null;
    if (!imageUrl) {
        imageUrl = await fetchImage(keyword); // Fallback fetch if not pre-fetched
    }
    
    let questionHTML = '';
    if (imageUrl) {
        questionHTML += `
            <div class="question-image-container">
                <img src="${imageUrl}" alt="${keyword}" class="question-image">
            </div>
        `;
    }
    
    questionHTML += `
        <div class="question-text">${q.question}</div>
        <div class="question-meta">
            <div class="question-category">${displayCategory}<span class="question-difficulty ${q.difficulty}">${toInitCaps(q.difficulty)}</span></div>
            ${q.subcategory ? `<div class="question-subcategory">${q.subcategory}</div>` : ''}
        </div>
    `;
    
    els.question().innerHTML = questionHTML;
    
    els.options().innerHTML = q.options.map((opt, i) => `<button style="animation-delay: ${i * 0.1}s" data-correct="${opt === q.correct}">${opt}</button>`).join('');
    if (els.questionCounter()) {
        els.questionCounter().textContent = `${state.current + 1}/${state.selectedQuestions}`;
    }
    toggleClass(els.game(), 'add', 'active');
    toggleClass(els.summary(), 'remove', 'active');
    els.questionTimer().textContent = state.isTimedMode ? state.timeLeft : 'N/A';
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
    if (state.isTimedMode) {
        state.timeLeft = timers[state.timerDuration];
        els.questionTimer().textContent = state.timeLeft;
        state.timerId = setInterval(() => {
            if (--state.timeLeft <= 0) {
                clearInterval(state.timerId);
                handleTimeout();
            }
            els.questionTimer().classList.add('urgent');
            if (state.timeLeft <= 5) playSound('tick');
            els.questionTimer().textContent = state.timeLeft;
        }, 1000);
        if (!state.isMuted) playSound('tick');
    } else {
        els.questionTimer().textContent = 'N/A';
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
    els.question().classList.remove('correct-bg', 'wrong-bg');
    els.question().classList.add(correct ? 'correct-bg' : 'wrong-bg');

    els.options().querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        btn.classList.add(btn.dataset.correct === 'true' ? 'correct' : 'wrong');
    });
    if (correct) {
        state.score += state.isTimedMode ? (state.timeLeft * 10 + 50) : 100;
    }
    els.score().textContent = state.score;
    const q = state.questions[state.current];
    const existingTitbits = els.question().querySelector('.question-titbits');
    if (existingTitbits) existingTitbits.remove();
    
    if (q.titbits) {
        const titbitsEl = document.createElement('div');
        titbitsEl.className = 'question-titbits';
        titbitsEl.innerHTML = `<span class="titbits-icon">💡</span> Fun Fact: ${q.titbits}`;
        els.question().appendChild(titbitsEl);
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
    
    gameScreen.classList.add('hidden');
    summaryScreen.classList.add('active');
    highscores.classList.remove('hidden');
    document.querySelector('.app-footer')?.classList.remove('hidden');
    
    clearInterval(state.timerId);
    stopAllSounds();

    const category = state.questions[0]?.category || 'general knowledge';
    let globalHigh = null;
    try {
        const highScoreSnapshot = await db.collection('scores')
                                        .where('category', '==', category)
                                        .orderBy('score', 'desc')
                                        .limit(1)
                                        .get();
        globalHigh = highScoreSnapshot.empty ? null : highScoreSnapshot.docs[0].data();
    } catch (error) {
        console.error('endGame: Error fetching global high score:', error);
    }

    try {
        await saveHighScore();
    } catch (error) {
        console.error('endGame: Error in saveHighScore:', error);
        showError('Failed to save high score. Please try again.');
    }

    try {
        await showSummary(globalHigh);
    } catch (error) {
        console.error('endGame: Error in showSummary:', error);
    }
    
    state.questions = [];
    state.current = 0;
    state.score = 0;
    state.answers = [];
    state.isScoreSaved = false;
    state.isNextPending = false;

    if (SPECIAL_QUIZ_TYPES.includes(category)) {
        const actionButtons = document.querySelector('.action-buttons');
        if (actionButtons) {
            actionButtons.innerHTML = `
                <div class="progress-message">
                    <p>You've completed today's ${toInitCaps(category)} challenge!</p>
                    <p>New questions in <span id="daily-reset-timer"></span></p>
                    <button id="upgrade-btn" class="btn primary">Try Regular Quiz</button>
                    <a href="/" class="btn"><span class="material-icons">home</span> Back Home</a>
                </div>`;
            const upgradeBtn = document.getElementById('upgrade-btn');
            if (upgradeBtn) {
                upgradeBtn.addEventListener('click', () => {
                    state.isTimedMode = false;
                    state.selectedQuestions = 10;
                    localStorage.removeItem('triviaMasterTimedMode');
                    localStorage.removeItem('triviaMasterTimerDuration');
                    initTriviaGame('general knowledge');
                });
            }
            updateDailyResetTimer();
            setInterval(updateDailyResetTimer, 1000);
        }
    } else {
        const actionButtons = document.querySelector('.action-buttons');
        if (actionButtons) {
            actionButtons.innerHTML = `
                <button class="btn primary" id="restart-btn">
                    <span class="material-icons">replay</span>Play Again
                </button>
                <a href="/" class="btn"><span class="material-icons">home</span> Back Home</a>`;
            const restartBtn = document.getElementById('restart-btn');
            if (restartBtn) {
                restartBtn.addEventListener('click', restartGame);
            }
        }
    }
}

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

function showSettingsPanel(isInitial) {
    const settingsPanel = document.getElementById('settings-panel');
    const timedModeToggle = document.getElementById('timed-mode');
    const modeLabel = document.getElementById('mode-label');
    const timerDurationSelect = document.getElementById('timer-duration');
    const difficultySelect = document.getElementById('difficulty-level');
    const rememberCheckbox = document.getElementById('remember-settings');
    
    if (!settingsPanel || !timedModeToggle || !modeLabel || !timerDurationSelect || !difficultySelect || !rememberCheckbox) return;
    
    timedModeToggle.checked = state.isTimedMode;
    modeLabel.textContent = state.isTimedMode ? 'Timed' : 'Non-Timed';
    timerDurationSelect.value = state.timerDuration;
    timerDurationSelect.parentElement.style.display = state.isTimedMode ? 'flex' : 'none';
    difficultySelect.value = state.difficulty || 'mixed';
    rememberCheckbox.checked = state.rememberSettings;
    
    settingsPanel.classList.remove('hidden');
    
    const closeBtn = document.getElementById('close-settings-btn');
    if (isInitial && closeBtn) {
        closeBtn.disabled = true;
        closeBtn.style.opacity = '0.5';
        closeBtn.style.cursor = 'not-allowed';
    } else if (closeBtn) {
        closeBtn.disabled = false;
        closeBtn.style.opacity = '1';
        closeBtn.style.cursor = 'pointer';
    }
}

function startGameWithSettings(category) {
    fetchQuestions(category).then(questions => {
        state.questions = questions;
        preFetchImages(questions).then(() => {
            showQuestion();
        }).catch(err => {
            console.error('Error pre-fetching images:', err);
            showQuestion();
        });
    }).catch(err => {
        console.error('Error fetching questions:', err);
        showError(err.message || 'Failed to load questions.');
    });
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
    els.game().classList.remove('hidden');
    els.game().classList.add('active');
    els.summary().classList.remove('active');
    els.highscores().classList.add('hidden');
    localStorage.removeItem(CACHE.QUESTIONS);
    initTriviaGame(state.category);
}

// Function to generate share URLs
function generateShareUrls(score, correctCount, totalQuestions, category) {
    const shareUrl = `${window.location.origin}/.netlify/functions/share?score=${score}&correct=${correctCount}&total=${totalQuestions}&category=${encodeURIComponent(category)}`;
    
    return {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I scored ${score} points on ${category} trivia!`)}&url=${encodeURIComponent(shareUrl)}`,
        whatsapp: `https://wa.me/?text=${encodeURIComponent(`I scored ${score} points on ${category} trivia! ${shareUrl}`)}`,
        directUrl: shareUrl
    };
}


// Function to add share buttons to the summary screen
function addShareButtons(score, correctCount, totalQuestions, category) {
    const actionButtons = document.querySelector('.action-buttons');
    if (!actionButtons) return;

    const shareUrls = generateShareUrls(score, correctCount, totalQuestions, category);
    
    const shareHTML = `
        <div class="share-buttons">
            <p>Share your score:</p>
            <a href="${shareUrls.facebook}" target="_blank" class="btn share-btn facebook">
                <i class="fab fa-facebook-f"></i> Facebook
            </a>
            <a href="${shareUrls.twitter}" target="_blank" class="btn share-btn twitter">
                <i class="fab fa-twitter"></i> Twitter
            </a>
            <a href="${shareUrls.whatsapp}" target="_blank" class="btn share-btn whatsapp">
                <i class="fab fa-whatsapp"></i> WhatsApp
            </a>
        </div>
    `;
    
    actionButtons.insertAdjacentHTML('afterbegin', shareHTML);
}


async function showSummary(globalHigh) {
    console.log('showSummary: state.answers:', state.answers);
    console.log('showSummary: state.answers.length:', state.answers.length);
    console.log('showSummary: correctCount:', state.answers.filter(a => a.correct).length);
    const timeUsed = state.isTimedMode ? (state.selectedQuestions * timers[state.timerDuration] - state.timeLeft) : 0;
    const correctCount = state.answers.filter(a => a.correct).length;
    const category = state.questions[0]?.category || 'general knowledge';
    
    addShareButtons(state.score, correctCount, state.selectedQuestions, category);

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
    if (perfMsg) {
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
    
    correctCountEl.textContent = `${correctCount}/${state.selectedQuestions}`;
    timeUsedEl.textContent = state.isTimedMode ? `${Math.floor(timeUsed / 60)}m ${(timeUsed % 60).toString().padStart(2, '0')}s` : 'N/A';
    resultMessageEl.innerHTML = message;
    
    if (globalHigh) {
        resultMessageEl.insertAdjacentHTML('afterend', `
            <div class="global-high-score">
                <div class="global-high-details">
                    <div class="global-high-text"> 🏆 Global High in ${toInitCaps(category)}: ${globalHigh.score} by ${globalHigh.name}</div>
                </div>
            </div>
            ${globalHigh.score > state.score ? `<div class="motivation-text">You're ${globalHigh.score - state.score} points behind the leader!</div>` : `<div class="global-champion-message">🎉 You beat the global high score! Submit your score to claim the crown!</div>`}
        `);
    }

    document.getElementById('total-score').textContent = state.score;
    els.highscoresList().innerHTML = state.highScores.length ? 
        state.highScores.map((e, i) => `
            <div class="highscore-entry compact">
                <span class="name">${i+1}. ${e.name}</span>
                <span class="score">${e.score}</span>
            </div>
        `).join('') : 
        '<p class="no-scores">No high scores yet</p>';
    
    await updateHighScores();
}

async function saveHighScore() {
    if (state.isScoreSaved || !state.score) {
        console.log('saveHighScore: Skipped - isScoreSaved:', state.isScoreSaved, 'score:', state.score);
        return;
    }
    const category = CATEGORY_ALIASES[state.questions[0]?.category] || state.questions[0]?.category || 'general knowledge';
    const name = prompt('Enter your name:', 'Anonymous') || 'Anonymous';
    console.log('saveHighScore: Saving score:', {
        name,
        score: state.score,
        category,
        difficulty: state.difficulty,
        timestamp: firebase.firestore.Timestamp.now()
    });
    let attempts = 2;
    while (attempts > 0) {
        try {
            await db.collection('scores').add({
                name,
                score: state.score,
                category,
                difficulty: state.difficulty,
                timestamp: firebase.firestore.Timestamp.now()
            });
            state.isScoreSaved = true;
            console.log('saveHighScore: Score saved successfully');
            return;
        } catch (error) {
            console.error('saveHighScore: Error saving score (attempt ' + (3 - attempts) + '):', error);
            attempts--;
            if (attempts === 0) {
                showError('Failed to save high score after retries. Please try again.');
            }
        }
    }
}

async function updateHighScores() {
    const highscoresList = els.highscoresList();
    if (!highscoresList) return;

    const category = CATEGORY_ALIASES[state.questions[0]?.category] || state.questions[0]?.category || 'general knowledge';
    try {
        const snapshot = await db.collection('scores')
            .where('category', '==', category)
            .where('difficulty', '==', state.difficulty)
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
    const difficultySelect = document.getElementById('difficulty-level');

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const newTimedMode = timedModeToggle ? timedModeToggle.checked : state.isTimedMode;
            const newTimerDuration = timerDurationSelect ? timerDurationSelect.value : state.timerDuration;
            const newDifficulty = difficultySelect ? difficultySelect.value : state.difficulty;
            const rememberSettings = document.getElementById('remember-settings')?.checked || false;
            
            state.isTimedMode = newTimedMode;
            state.timerDuration = newTimerDuration;
            state.difficulty = newDifficulty;
            state.rememberSettings = rememberSettings;
            
            localStorage.setItem('triviaMasterTimedMode', state.isTimedMode);
            localStorage.setItem('triviaMasterTimerDuration', state.timerDuration);
            localStorage.setItem('triviaMasterDifficulty', state.difficulty);
            localStorage.setItem('triviaMasterRememberSettings', state.rememberSettings);
            
            updateDifficultyDisplay();
            
            toggleClass(settingsPanel, 'add', 'hidden');
            
            if (state.showSettingsOnStart) {
                state.showSettingsOnStart = false;
                startGameWithSettings(state.category);
            } else {
                state.current = 0;
                updateTimerUI();
                showQuestion();
            }
        });
    }

    if (settingsBtn && settingsPanel) {
        settingsBtn.addEventListener('click', () => {
            toggleClass(settingsPanel, 'remove', 'hidden');
            if (timedModeToggle) timedModeToggle.checked = state.isTimedMode;
            if (modeLabel) modeLabel.textContent = state.isTimedMode ? 'Timed' : 'Non-Timed';
            if (timerDurationSelect) {
                timerDurationSelect.value = state.timerDuration;
                timerDurationSelect.parentElement.style.display = state.isTimedMode ? 'flex' : 'none';
            }
            if (difficultySelect) difficultySelect.value = state.difficulty;
        });
    }

    if (timedModeToggle) {
        timedModeToggle.addEventListener('change', () => {
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
            const newDifficulty = difficultySelect ? difficultySelect.value : state.difficulty;
            if (newTimedMode !== state.isTimedMode || newTimerDuration !== state.timerDuration || newDifficulty !== state.difficulty) {
                state.isTimedMode = newTimedMode;
                state.timerDuration = newTimerDuration;
                state.difficulty = newDifficulty;
                localStorage.setItem('triviaMasterTimedMode', state.isTimedMode);
                localStorage.setItem('triviaMasterTimerDuration', state.timerDuration);
                localStorage.setItem('triviaMasterDifficulty', state.difficulty);
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

    window.addEventListener('beforeunload', () => {
        clearInterval(state.timerId);
        stopAllSounds();
    });
}

function setupStartQuizListener() {
    document.addEventListener('startQuiz', (e) => {
        const { category, isTimedMode } = e.detail;
        state.isTimedMode = isTimedMode;
        initTriviaGame(category);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupStartQuizListener();
    loadMuteState();
    if (window.location.pathname.includes('catalog.html')) return;
    const pathParts = window.location.pathname.split('/').filter(part => part);
    const category = pathParts.length > 1 ? pathParts[1].replace(/-/g, ' ') : 'general knowledge';
    initTriviaGame(category);
});

window.triviaGame = {
    endGame: endGame
};