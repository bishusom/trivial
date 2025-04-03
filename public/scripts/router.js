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

// Initialize first load
window.addEventListener('load', () => {
    const cleanPath = window.location.pathname
        .replace('/index.html', '')
        .replace(/\/$/, '');
        
    loadContent(cleanPath || '/');
});
