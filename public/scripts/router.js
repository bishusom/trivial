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

function initGameComponents() {
    // Reinitialize all game-related DOM references
    window.setupScreen = document.querySelector('.setup-screen');
    window.gameScreen = document.querySelector('.game-screen');
    window.summaryScreen = document.querySelector('.summary-screen');
    window.categorySelect = document.getElementById('category');
    window.numQuestionsSelect = document.getElementById('num-questions');
    window.timePerQuestionSelect = document.getElementById('time-per-question');
    window.startBtn = document.getElementById('start-btn');
    
    // Reinitialize event listeners
    if (window.startBtn) {
        initGameControls();
        initCategories();
        safeClassToggle(window.setupScreen, 'add', 'active');
    }
    
    // Reinitialize other game state
    window.highscores = document.querySelector('.highscores');
    safeClassToggle(window.highscores, 'add', 'hidden');
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
