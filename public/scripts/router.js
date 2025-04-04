const routes = {
    '/': '/partials/home.html',
    '/home': '/partials/home.html',
    '/blog': '/partials/blog/list.html',
    '/categories': '/partials/categories.html'
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
        // Add cache busting and no-cors mode
        const response = await fetch(`${templatePath}`, {
            mode: 'cors',
            credentials: 'same-origin'
        });
        
        // Verify content structure
        const content = await response.text();

        contentDiv.innerHTML = content;
        
        // Delay controls initialization
        setTimeout(() => {
            initGameControls();
            window.scrollTo(0, 0);
        }, 50);

    } catch (error) {
        console.error('Content load failed:', error.message);
        contentDiv.innerHTML = `
            <div class="error-message">
                <h1>Content initialization failed</h1>
                <p>Please refresh or try later</p>
                <button onclick="window.location.reload()">Reload</button>
            </div>
        `;
    }
}
  
function initGameControls() {
    const startBtn = document.getElementById('start-btn');
    
    if (!startBtn) {
        console.warn('Game controls not found in current view');
        return;
    }
    
    // Remove existing listeners
    startBtn.replaceWith(startBtn.cloneNode(true));
    
    // Reinitialize listener
    startBtn.addEventListener('click', async () => {
        try {
            safeClassToggle(startBtn, 'add', 'hidden');
            selectedQuestions = parseInt(numQuestionsSelect.value);
            selectedTime = parseInt(timePerQuestionSelect.value);
            
            startBtn.disabled = true;
            questions = await fetchQuestions(
                categorySelect.value,
                selectedDifficulty, // Changed from difficultySelect.value
                selectedQuestions
            );
    
            if (questions.length) {
                safeClassToggle(highscores, 'add', 'hidden');
                safeClassToggle(setupScreen, 'remove', 'active');
                safeClassToggle(gameScreen, 'add', 'active');
                currentQuestion = 0;
                score = 0;
                answersLog = [];
                showQuestion();
            }
        } finally {
            startBtn.disabled = false;
            safeClassToggle(startBtn, 'remove', 'hidden');
        }
    });

}

// Handle back/forward
window.addEventListener('popstate', () => {
    loadContent(window.location.pathname);
});

// Initialize first load
window.addEventListener('load', () => {
    const cleanPath = window.location.pathname
        .replace('/index.html', '')
        .replace(/\/$/, '');
        
    loadContent(cleanPath || '/');
});
  
