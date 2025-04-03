const routes = {
    '/': 'partials/home.html',
    '/blog': 'partials/blog/list.html',
    '/categories': 'partials/categories.html'
};

async function loadContent(path) {
    const contentDiv = document.getElementById('main-content');
    let templatePath = routes[path];
    
    // Handle root path explicitly
    if (path === '/' || path === '/index.html') {
        templatePath = routes['/'];
    }
    
    // Handle blog posts
    if (path.startsWith('/blog/')) {
        const postName = path.split('/').pop();
        templatePath = `partials/blog/${postName}.html`;
    }

    try {
        const response = await fetch(templatePath);
        if (!response.ok) throw new Error('Not found');
        contentDiv.innerHTML = await response.text();
        initGameControls();
    } catch (error) {
        contentDiv.innerHTML = `
            <div class="error-message">
                <h1>Page not found</h1>
                <p>Return to <a href="/">home page</a></p>
            </div>
        `;
    }
}

// Initialize first load
window.addEventListener('load', () => {
    const cleanPath = window.location.pathname
        .replace('/index.html', '/')
        .replace(/\/$/, '');
    loadContent(cleanPath || '/');
});
