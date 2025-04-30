import { endGame } from '/scripts/app.js';

document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.querySelector('.setup-screen');
    const gameScreen = document.querySelector('.game-screen');
    const blogTbankScreen = document.querySelector('.blog-tbank');
    let currentContentPath = '';

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

    window.handleRouting = handleRouting; // Expose for app.js
    handleRouting(window.location.pathname);

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        
        if (link.hostname !== window.location.hostname || 
            link.target ||
            link.href.includes('.pdf') || 
            link.href.includes('.jpg') ||
            link.href.includes('.png')) return;
        
        e.preventDefault();
        const path = new URL(link.href).pathname;
        
        if (gameScreen.classList.contains('active')) {
            const modal = document.getElementById('nav-warning-modal');
            modal.classList.remove('hidden');
            
            window.pendingNavigation = path;
            
            const continueBtn = document.getElementById('continue-game');
            const endBtn = document.getElementById('end-game');
            
            const newContinueBtn = continueBtn.cloneNode(true);
            const newEndBtn = endBtn.cloneNode(true);
            continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);
            endBtn.parentNode.replaceChild(newEndBtn, endBtn);
            
            newContinueBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
                window.pendingNavigation = null;
            });
            
            newEndBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
                endGame();
                if (window.pendingNavigation) {
                    window.history.pushState({}, '', window.pendingNavigation);
                    handleRouting(window.pendingNavigation);
                    window.pendingNavigation = null;
                }
            });
        } else {
            window.history.pushState({}, '', path);
            handleRouting(path);
        }
    });

    window.addEventListener('popstate', () => handleRouting(window.location.pathname));

    async function handleRouting(path) {
        console.log(`Handling route: ${path}`);
        path = path === '/' ? '/home' : path;
        path = path.replace(/\/$/, '');
        
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
    
        if (path.includes('/privacy')) {
            document.querySelector('.privacy-screen').classList.add('active');
        } else if (path.includes('/contact')) {
            document.querySelector('.contact-screen').classList.add('active');
        } else if (path === '/home') {
            showHomeScreen();
        } else if (path === '/number-puzzle') {
            document.querySelector('.number-puzzle-screen').classList.add('active');
            try {
                const { initPuzzle } = await import('/scripts/number-puzzle.js');
                initPuzzle();
            } catch (error) {
                console.error('Error loading number-puzzle.js:', error);
                showHomeScreen();
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error';
                errorDiv.innerHTML = `
                    <h3>Error Loading Number Puzzle</h3>
                    <p>Unable to load the Number Puzzle game. Please try again later.</p>
                    <a href="/home" class="btn primary">Return Home</a>
                `;
                document.querySelector('.number-puzzle-screen').innerHTML = errorDiv.outerHTML;
            }
        } else if (path === '/word-game') {
            document.querySelector('.word-game-screen').classList.add('active');
            try {
                const { initWordGame } = await import('/scripts/word-game.js');
                initWordGame();
            } catch (error) {
                console.error('Error loading word-game.js:', error);
                showHomeScreen();
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error';
                errorDiv.innerHTML = `
                    <h3>Error Loading Word Game</h3>
                    <p>Unable to load the Word Game. Please try again later.</p>
                    <a href="/home" class="btn primary">Return Home</a>
                `;
                document.querySelector('.word-game-screen').innerHTML = errorDiv.outerHTML;
            }
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
            showHomeScreen();
        }
    }

    function showHomeScreen() {
        setupScreen.classList.add('active');
        gameScreen.classList.remove('active');
        blogTbankScreen.classList.remove('active');
        blogTbankScreen.innerHTML = '';
        currentContentPath = '';
    }

    async function loadContent(section, path) {
        if (currentContentPath === path) return;
        
        setupScreen.classList.remove('active');
        gameScreen.classList.remove('active');
        blogTbankScreen.classList.add('active');

        try {
            const contentPath = contentPaths[section].contentPath(path);
            console.log(`Fetching content: ${contentPath}`);
            
            const response = await fetch(contentPath);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            blogTbankScreen.innerHTML = await response.text();
            currentContentPath = path;
            
            const title = blogTbankScreen.querySelector('title')?.textContent || 
                         `${section.charAt(0).toUpperCase() + section.slice(1)} Content`;
            document.title = title;
            
        } catch (error) {
            console.error(`Error loading ${section} content:`, error);
            blogTbankScreen.innerHTML = `
                <div class="error">
                    <h3>Content Not Found</h3>
                    <p>Unable to load ${section} content. Please check your connection or try again later.</p>
                    <a href="/home" class="btn primary">Return Home</a>
                </div>
            `;
            currentContentPath = '';
        }
    }
});

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

function initializeQuizControls(hideAnswersByDefault = false) {
    const toggleLink = document.getElementById('toggleAnswers');
    const printLink = document.getElementById('printPDF');
    const showHideEmoji = document.getElementById('show_hide_emoji');

    if (!toggleLink) return;
    let answersVisible = !hideAnswersByDefault;
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