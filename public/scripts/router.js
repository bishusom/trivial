document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.querySelector('.setup-screen');
    const blogTbankScreen = document.querySelector('.blog-tbank');
    let currentContentPath = '';

    // Path configuration
    const contentPaths = {
        blog: {
            base: '/partials/blog',
            default: '/partials/blog/list.html'
        },
        tbank: {
            base: '/partials/tbank',
            default: '/partials/tbank/content.html'
        }
    };

    // Initial route
    handleRouting(window.location.pathname);

    // Event delegation for all links
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="/"]');
        if (!link) return;
        
        e.preventDefault();
        const path = new URL(link.href).pathname;
        window.history.pushState({}, '', path);
        handleRouting(path);
    });

    // History navigation
    window.addEventListener('popstate', () => handleRouting(window.location.pathname));

    function handleRouting(path) {
        path = path === '/' ? '/home' : path;
        
        if (path === '/home') {
            showHomeScreen();
        } else if (path.startsWith('/blog')) {
            loadContent('blog', path);
        } else if (path.startsWith('/tbank')) {
            loadContent('tbank', path);
        } else {
            showHomeScreen();
        }
    }

    function showHomeScreen() {
        setupScreen.classList.add('active');
        blogTbankScreen.classList.remove('active');
        blogTbankScreen.innerHTML = '';
        currentContentPath = '';
    }

    async function loadContent(section, path) {
        if (currentContentPath === path) return;
        
        setupScreen.classList.remove('active');
        blogTbankScreen.classList.add('active');

        try {
            const contentPath = path === `/${section}` 
                ? contentPaths[section].default
                : `${contentPaths[section].base}${path.replace(`/${section}`, '')}.html`;

            const response = await fetch(contentPath);
            if (!response.ok) throw new Error('Content not found');
            
            blogTbankScreen.innerHTML = await response.text();
            currentContentPath = path;
            processSocialSharing();
        } catch (error) {
            blogTbankScreen.innerHTML = `
                <div class="error">
                    <h3>Content not found</h3>
                    <p>${error.message}</p>
                </div>
            `;
            currentContentPath = '';
        }
    }
});

function processSocialSharing() {
    const blogTbankScreen = document.querySelector('.blog-tbank');
    const postUrl = encodeURIComponent(window.location.href);
    const postTitle = encodeURIComponent(blogTbankScreen.querySelector('h1').textContent);
    
    blogTbankScreen.querySelectorAll('.social-button').forEach(link => {
        link.href = link.href
            .replace(/POST_URL/g, postUrl)
            .replace(/POST_TITLE/g, postTitle);
    });
}