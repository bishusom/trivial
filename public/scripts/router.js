const routes = {
    '/': 'partials/home.html',
    '/home': 'partials/home.html',
    '/blog': 'partials/blog/list.html',
    '/categories': 'partials/categories.html'
};

async function loadContent(path) {
    const contentDiv = document.getElementById('main-content');
    let templatePath = routes[path];

    // Handle root path
    if (path === '/' || path === '/index.html') {
        templatePath = routes['/'];
    }

    // Handle blog posts
    if (path.startsWith('/blog/')) {
        const postName = path.split('/').pop();
        templatePath = `partials/blog/${postName}.html`;
    }

    try {
        const response = await fetch(templatePath,{
            mode: 'cors',
            credentials: 'same-origin'
        });
        if (!response.ok) throw new Error('Not found');
        
        contentDiv.innerHTML = await response.text();
        
        // Initialize components based on route
        if (templatePath.includes('home.html')) {
            initGameComponents();
        }

    } catch (error) {
        console.error('Loading failed:', error);
        contentDiv.innerHTML = `
            <div class="error-message">
                <h1>Page not found</h1>
                <p>Try these instead:</p>
                <nav class="error-nav">
                    <a href="/">Home</a>
                    <a href="/blog">Blog</a>
                    <a href="/categories">Categories</a>
                </nav>
            </div>
        `;
    }
}

// Modify initGameComponents function
// In router.js
function initGameComponents() {
    // Reinitialize ALL DOM references after partial loads
    window.setupScreen = document.querySelector('.setup-screen');
    window.gameScreen = document.querySelector('.game-screen');
    window.summaryScreen = document.querySelector('.summary-screen');
    window.highscores = document.querySelector('.highscores');
    window.categorySelect = document.getElementById('category');
    window.numQuestionsSelect = document.getElementById('num-questions');
    window.timePerQuestionSelect = document.getElementById('time-per-question');
    window.startBtn = document.getElementById('start-btn');
    window.questionCounterEl = document.getElementById('question-counter');
    window.scoreEl = document.getElementById('score');

    // Initialize only if elements exist
    if (window.categorySelect) window.initCategories();
    if (window.startBtn) window.initGameControls();
    
    // Rebind difficulty pills
    window.difficultyPills = document.querySelectorAll('.difficulty-pill');
    window.difficultyPills?.forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.difficulty-pill').forEach(b => 
                b.classList.remove('active')
            );
            this.classList.add('active');
            window.selectedDifficulty = this.dataset.difficulty;
        });
    });

    // Restart game state
    window.questions = [];
    window.currentQuestion = 0;
    window.score = 0;
    window.isScoreSaved = false;
}

// Handle navigation
document.addEventListener('click', e => {
    if (e.target.tagName === 'A' && e.target.href.includes(window.location.origin)) {
        e.preventDefault();
        const path = new URL(e.target.href).pathname;
        loadContent(path);
        window.history.pushState({}, '', path);
    }
});

// Initial load
window.addEventListener('load', () => {
    loadContent(window.location.pathname);
});