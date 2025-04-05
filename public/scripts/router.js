const routes = {
    '/': '/',
    '/blog': '/blog/list.html',
    '/tbank': 'tbank/list.html'
};

async function loadContent(path) {
    const contentDiv = document.getElementById('main-content');
    let templatePath = routes[path];
    
    //Handle blog posts
    if(path.startsWith('/blog/')) {
        const postName = path.split('/').pop();
        templatePath = `/blog/${postName}.html`;
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

/* Initialize first load
window.addEventListener('load', () => {
    const initialPath = window.location.pathname;
    loadContent(initialPath === '/' ? '/home' : initialPath);
});*/
