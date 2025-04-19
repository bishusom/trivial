// Updated router.js
document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.querySelector('.setup-screen');
    const blogTbankScreen = document.querySelector('.blog-tbank');
    let currentContentPath = '';

    // Path configuration - match your file structure
    const contentPaths = {
        blog: {
            base: '/blog',
            default: '/blog/list.html',
            contentPath: (path) => {
                if (path === '/blog' || path === '/blog/') return '/blog/list.html';
                return `/blog${path.replace('/blog', '')}.html`;
            }
        },
        tbank: {
            base: '/tbank',
            default: '/tbank/content.html',
            contentPath: (path) => {
                if (path === '/tbank' || path === '/tbank/') return '/tbank/content.html';
                return `/tbank${path.replace('/tbank', '')}.html`;
            }
        }
    };

    // Initial route
    handleRouting(window.location.pathname);

    // Event delegation for all links
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        
        // Skip if it's an external link, has a target, or is a non-HTML link
        if (link.hostname !== window.location.hostname || 
            link.target ||
            link.href.includes('.pdf') || 
            link.href.includes('.jpg') ||
            link.href.includes('.png')) return;
        
        e.preventDefault();
        const path = new URL(link.href).pathname;
        window.history.pushState({}, '', path);
        handleRouting(path);
    });

    // History navigation
    window.addEventListener('popstate', () => handleRouting(window.location.pathname));

    async function handleRouting(path) {
        path = path === '/' ? '/home' : path;
        
        // Remove trailing slash
        path = path.replace(/\/$/, '');
        
        if (path === '/home') {
            showHomeScreen();
        } else if (path.startsWith('/blog')) {
            await loadContent('blog', path);
        } else if (path.startsWith('/tbank')) {
            await loadContent('tbank', path);
            if (blogTbankScreen) {
                initializeQuizControls(true);
                initializeAlphabetFilters();
                processSocialSharing();
            }
        } else {
            // Handle 404
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
            // Use the contentPath function from the configuration
            const contentPath = contentPaths[section].contentPath(path);
            
            const response = await fetch(contentPath);
            if (!response.ok) throw new Error('Content not found');
            
            blogTbankScreen.innerHTML = await response.text();
            currentContentPath = path;
            
            // Update page title
            const title = blogTbankScreen.querySelector('title')?.textContent || 
                         `${section.charAt(0).toUpperCase() + section.slice(1)} Content`;
            document.title = title;
            
        } catch (error) {
            blogTbankScreen.innerHTML = `
                <div class="error">
                    <h3>Content not found</h3>
                    <p>The requested page could not be found.</p>
                    <a href="/" class="btn primary">Return Home</a>
                </div>
            `;
            currentContentPath = '';
        }
    }
});

// Update loadContent function to call the initializer
function initializeAlphabetFilters() {
    const blogTbankScreen = document.querySelector('.blog-tbank');
    if (!blogTbankScreen) return;

    const alphaBtns = blogTbankScreen.querySelectorAll('.alpha-btn');
    const blogPreviews = blogTbankScreen.querySelectorAll('.blog-preview');
    const noResultsDiv = blogTbankScreen.querySelector('.no-results');
    const selectedLetterSpan = blogTbankScreen.querySelector('.selected-letter');
    const filterCriteria = blogTbankScreen.querySelector('.filter-criteria');
    const criteriaText = blogTbankScreen.querySelector('.criteria-text');

    if (!alphaBtns.length) return;

    function filterPosts(selectedLetter) {
        let visibleCount = 0;
        let matchingTags = new Set();
        
        blogPreviews.forEach(preview => {
            const postTags = preview.dataset.post.split(' ');
            const shouldShow = selectedLetter === 'all' || 
                postTags.some(tag => {
                    const matches = tag.toLowerCase().startsWith(selectedLetter);
                    if (matches) matchingTags.add(tag);
                    return matches;
                });
            
            if(shouldShow) visibleCount++;
            preview.style.display = shouldShow ? 'block' : 'none';
        });

        // Update filter criteria display
        if (selectedLetter === 'all') {
            criteriaText.textContent = 'All';
        } else {
            const tagsList = Array.from(matchingTags).map(tag => {
                return tag.split('-').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ');
            }).join(', ');
            
            criteriaText.textContent = `"${selectedLetter.toUpperCase()}" (${tagsList})`;
        }
        filterCriteria.style.display = 'block';
        // Show/hide no results message
        if(visibleCount === 0 && selectedLetter !== 'all') {
            selectedLetterSpan.textContent = selectedLetter.toUpperCase();
            noResultsDiv.style.display = 'block';
        } else {
            noResultsDiv.style.display = 'none';
        }
    }

    alphaBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            alphaBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const letter = e.target.dataset.letter;
            filterPosts(letter);
        });
    });
}

// Initialize quiz controls function
function initializeQuizControls(hideAnswersByDefault = false) {
    const toggleLink = document.getElementById('toggleAnswers');
    const printLink = document.getElementById('printPDF');
    const showHideEmoji = document.getElementById('show_hide_emoji');

    //Nothing to do if /tbank/content.html or /blog/list.html
    if (!toggleLink) return;
    let answersVisible = !hideAnswersByDefault;
    // Toggle answers
    toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    answersVisible = !answersVisible;
    document.querySelectorAll('.answer').forEach(answer => {
        answer.style.display = answersVisible ? 'block' : 'none';
    });
    toggleLink.textContent = showHideEmoji.textContent
    toggleLink.textContent += answersVisible ? ' Hide Answers' : ' Show Answers';
    });

       
    
        printLink.addEventListener('click', (e) => {
        const blogTbankScreen = document.querySelector('.blog-tbank');
        const printWindow = window.open('', '_blank');
        printWindow.document.body.innerHTML = `
            <html>
                <head>
                    <title>${blogTbankScreen.querySelector('title').text} - Printable Version'</title>
                    <style>
                        .answer { display: block !important; }
                        .controls, .blog-footer { display: none; }
                    </style>
                </head>
                <body>
                    ${blogTbankScreen.innerHTML}
                    <br>©www.triviaah.com
                </body>
            </html>
        `;
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
    });    
}                      


function processSocialSharing() {
    const blogTbankScreen = document.querySelector('.blog-tbank');
    if (!blogTbankScreen) return;

    const postUrl = encodeURIComponent(window.location.href);
    const postTitle = encodeURIComponent(blogTbankScreen.querySelector('h1')?.textContent || '');
    
    blogTbankScreen.querySelectorAll('.social-button').forEach(link => {
        link.href = link.href
            .replace(/POST_URL/g, postUrl)
            .replace(/POST_TITLE/g, postTitle);
    });
}
