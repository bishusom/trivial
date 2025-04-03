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
        console.log('Loading:', templatePath);
        const response = await fetch(templatePath);
        console.log('Response status:', response.status);
        console.log('Content length:', (await response.text()).length);
        const content = await response.text();
        
        // Add content validation
        if (!response.ok || content.trim() === '') {
            throw new Error('Empty content');
        }

        contentDiv.innerHTML = content;
        initGameControls();
    } catch (error) {
        console.error('Loading failed:', error);
        contentDiv.innerHTML = `
            <div class="error-message">
                <h1>Content not found</h1>
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

// Initialize first load
window.addEventListener('load', () => {
    const cleanPath = window.location.pathname
        .replace('/index.html', '')
        .replace(/\/$/, '');
        
    loadContent(cleanPath || '/');
});
