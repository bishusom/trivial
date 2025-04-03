const routes = {
    '/': 'partials/home.html',
    '/blog': 'partials/blog/list.html',
    '/categories': 'partials/categories.html'
};

async function loadContent(path) {
    const contentDiv = document.getElementById('main-content');
    let templatePath = routes[path];
    
    // Handle blog posts
    if(path.startsWith('/blog/')) {
        const postName = path.split('/').pop();
        templatePath = `partials/blog/${postName}.html`;
    }

    // Handle unknown routes
    if (!templatePath) {
        contentDiv.innerHTML = '<h1>Page not found</h1>';
        return;
    }

    try {
        const response = await fetch(templatePath);
        if (!response.ok) throw new Error('Not found');
        contentDiv.innerHTML = await response.text();
        initGameControls(); // Reinitialize game controls
    } catch (error) {
        contentDiv.innerHTML = `
            <div class="error-message">
                <h1>Page not found</h1>
                <p>Return to <a href="/">home page</a></p>
            </div>
        `;
    }
}

// Handle navigation
document.addEventListener('click', e => {
    if(e.target.tagName === 'A' && e.target.href.includes(window.location.origin)) {
        e.preventDefault();
        const path = new URL(e.target.href).pathname;
        loadContent(path);
        window.history.pushState({}, '', path);
    }
});

// Handle back/forward
window.addEventListener('popstate', () => {
    loadContent(window.location.pathname);
});

// Initialize first load
window.addEventListener('load', () => {
    loadContent(window.location.pathname);
});
