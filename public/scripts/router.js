const routes = {
    '/': 'partials/home.html',
    '/blog': 'partials/blog/list.html',
    '/blog/:post': 'partials/blog/',
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

    const response = await fetch(templatePath);
    contentDiv.innerHTML = await response.text();
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
    const initialPath = window.location.pathname;
    loadContent(initialPath === '/' ? '/home' : initialPath);
});
