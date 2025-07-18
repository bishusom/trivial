let categoryGroupClickHandlers = [];

document.addEventListener('DOMContentLoaded', () => {
    // Quiz Timer Updates
    const updateQuizTimers = () => {
        const timeLeft = getTimeRemaining();
        
        const updateQuizElement = (category, label, time) => {
            const element = document.querySelector(`[data-category="${category}"]`);
            if (element) {
                const textElement = element.querySelector('span');
                if (textElement) {
                    textElement.innerHTML = `${label} (${category === 'Daily' ? 'Resets' : category === 'Weekly' ? 'Expires' : 'New Quiz'} in <b>${time} ${category === 'Daily' ? 'hrs' : 'days'}</b>)`;
                }
            }
        };
        
        updateQuizElement('Daily', 'Daily Quiz', timeLeft.daily);
        updateQuizElement('Weekly', 'Weekly Quiz', timeLeft.weekly);
        updateQuizElement('Monthly', 'Monthly Quiz', timeLeft.monthly);
    };
    
    updateQuizTimers();
    setInterval(updateQuizTimers, 3600000);

    // DOM Elements
    const setupScreen = document.querySelector('.setup-screen');
    const dynamicContent = document.getElementById('dynamic-content');
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const scrollArrow = document.querySelector('.scroll-arrow');

    let activeDropdown = null;
    let currentPath = window.location.pathname;
    let isRouting = false;

    // Mobile Menu Toggle
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
            hamburger.setAttribute('aria-expanded', !isExpanded);
            navMenu.classList.toggle('active');
            const icon = hamburger.querySelector('.material-icons');
            if (icon) icon.textContent = isExpanded ? 'menu' : 'close';
        });
    }

    // Main Click Handler
    document.addEventListener('click', (e) => {
        // 1. Handle Category Cards
        const categoryCard = e.target.closest('.category-card');
        if (categoryCard && categoryCard.dataset.route) {
            e.preventDefault();
            const path = categoryCard.dataset.route;
            navigateTo(path);
            return;
        }

        // 2. Handle Dropdowns
        if (!e.target.closest('.dropdown') && activeDropdown) {
            activeDropdown.style.display = 'none';
            const toggle = activeDropdown.closest('.dropdown').querySelector('.dropdown-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
            activeDropdown = null;
        }

        // 3. Handle Nav Menu
        if (!e.target.closest('.main-nav') && navMenu && navMenu.classList.contains('active')) {
            navMenu.classList.remove('active');
            if (hamburger) {
                hamburger.setAttribute('aria-expanded', 'false');
                const icon = hamburger.querySelector('.material-icons');
                if (icon) icon.textContent = 'menu';
            }
        }

        // 4. Handle Regular Links
        const link = e.target.closest('a[href]');
        if (!link || link.hostname !== window.location.hostname || link.target || 
            /\.(pdf|jpg|png)$/i.test(link.href)) return;

        e.preventDefault();
        const path = new URL(link.href).pathname;
        navigateTo(path);
    });

    // Dropdown Toggles
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            const dropdown = e.target.closest('.dropdown');
            if (!dropdown) return;
            
            const dropdownContent = dropdown.querySelector('.dropdown-content');
            if (!dropdownContent) return;
            
            const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

            document.querySelectorAll('.dropdown-content').forEach(d => {
                if (d !== dropdownContent) {
                    d.style.display = 'none';
                    const dToggle = d.closest('.dropdown').querySelector('.dropdown-toggle');
                    if (dToggle) dToggle.setAttribute('aria-expanded', 'false');
                }
            });

            dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
            toggle.setAttribute('aria-expanded', dropdownContent.style.display === 'block' ? 'true' : 'false');
            activeDropdown = dropdownContent.style.display === 'block' ? dropdownContent : null;

            if (window.innerWidth <= 768) e.preventDefault();
        });
    });

    // Mobile Submenus
    document.querySelectorAll('.submenu-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return;
            e.preventDefault();
            e.stopPropagation();
            const submenu = e.target.closest('.submenu');
            if (!submenu) return;
            
            document.querySelectorAll('.submenu').forEach(sm => {
                if (sm && sm !== submenu) sm.classList.remove('active');
            });
            submenu.classList.toggle('active');
        });
    });

    // Category Groups
    function initCategoryGroups() {
        categoryGroupClickHandlers.forEach(({group, handler}) => {
            if (group) {
                const header = group.querySelector('.group-header');
                if (header) header.removeEventListener('click', handler);
            }
        });
        categoryGroupClickHandlers = [];
        
        const isMobile = window.innerWidth <= 768;
        document.querySelectorAll('.category-group').forEach(group => {
            const header = group.querySelector('.group-header');
            if (header) {
                if (isMobile) {
                    group.classList.remove('active');
                    const handler = () => group.classList.toggle('active');
                    header.addEventListener('click', handler);
                    categoryGroupClickHandlers.push({group, handler});
                } else {
                    group.classList.add('active');
                }
            }
        });
    }
    
    initCategoryGroups();
    window.addEventListener('resize', () => setTimeout(initCategoryGroups, 100));

    // Navigation Functions
    function navigateTo(path) {
        // Skip routing for share function URLs
        if (path.includes('/.netlify/functions/share')) {
            return; // Allow the share function to handle its own redirect
        }
        
        if (activeDropdown) {
            activeDropdown.style.display = 'none';
            const toggle = activeDropdown.closest('.dropdown').querySelector('.dropdown-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
            activeDropdown = null;
        }
        
        if (navMenu) navMenu.classList.remove('active');
        if (hamburger) {
            hamburger.setAttribute('aria-expanded', 'false');
            const icon = hamburger.querySelector('.material-icons');
            if (icon) icon.textContent = 'menu';
        }

        const gameScreen = document.querySelector('.game-screen');
        if (gameScreen && gameScreen.classList.contains('active') && !document.querySelector('.summary-screen.active')) {
            handleGameInProgressNavigation(path);
        } else {
            window.history.pushState({ path }, '', path);
            handleRouting(path);
        }
    }

    function handleGameInProgressNavigation(path) {
        const modal = document.getElementById('nav-warning-modal');
        if (!modal) {
            window.history.pushState({ path }, '', path);
            handleRouting(path);
            return;
        }

        modal.classList.remove('hidden');
        window.pendingNavigation = path;

        const continueBtn = document.getElementById('continue-game');
        const endBtn = document.getElementById('end-game');

        if (continueBtn) {
            continueBtn.onclick = () => {
                modal.classList.add('hidden');
                window.pendingNavigation = null;
            };
        }

            if (endBtn) {
                endBtn.onclick = () => {
                    modal.classList.add('hidden');
                    
                    // Properly end the game by calling the exported function
                    if (typeof window.triviaGame !== 'undefined' && typeof window.triviaGame.endGame === 'function') {
                        window.triviaGame.endGame();
                    }
                    
                    // Clear any stored game state
                    localStorage.removeItem('triviaMasterGameState');
                    
                    if (window.pendingNavigation) {
                        window.history.pushState({ path: window.pendingNavigation }, '', window.pendingNavigation);
                        handleRouting(window.pendingNavigation);
                        window.pendingNavigation = null;
                    }
                };
            }
        }

    // Main Routing Function
    async function handleRouting(path) {
        if (path === currentPath || isRouting) return;
        isRouting = true;
        currentPath = path;
        path = path === '/' ? '/home' : path.replace(/\/$/, '');

        const pathParts = path.split('/').filter(part => part);
        const baseRoute = pathParts.length > 0 ? `/${pathParts[0]}` : '/home';
        
        // Update Page Metadata
        updatePageMetadata(path, pathParts);

        // Google Analytics Tracking
        if (typeof gtag !== 'undefined') {
            const eventLabel = pathParts[1] ? pathParts[1].replace(/-/g, ' ') : pathParts[0] || 'Home';
            gtag('event', 'navigate', {
                event_category: 'Page View',
                event_label: eventLabel,
                path: path
            });
        }

        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            if (screen) screen.classList.remove('active');
        });

        // Route Definitions
        const validChildren = {
            '/trivias': ['daily', 'weekly', 'monthly', 'general-knowledge', 'literature', 'arts','animals', 'science', 
                        'history', 'fashion', 'festivals', 'geography', 'movies', 'tv', 'music', 'celebrities', 'politics', 
                        'food', 'sports', 'business', 'mythology', 'philosophy', 'video-games','board-games',
                        'country-capitals','90s-movie-trivia','famous-quotes','pub-quiz','catalog', 'tbank'],
            '/number-puzzle': ['guess', 'scramble', 'sequence', 'primehunter', 'numbertower', 'sodoku', 'catalog'],
            '/word-game': ['classic', 'anagram', 'spelling', 'boggle', 'wordsearch', 'wordladder', 'wordcircle', 'catalog']
        };

        try {
            if (path.includes('/privacy')) {
                await loadTemplate('/templates/privacy.html', dynamicContent);
            } else if (path.includes('/contact')) {
                await loadTemplate('/templates/contact.html', dynamicContent);
            } else if (path === '/home' || (validChildren[baseRoute] && pathParts.length === 1)) {
                showHomeScreen();
            } else if (path.startsWith('/trivias')) {
                const triviaType = pathParts[1];
                if (triviaType === 'catalog') {
                    document.body.classList.remove('game-screen-active');
                    await loadTemplate('/templates/trivias/catalog.html', dynamicContent);
                    const { initTriviaCatalog } = await import('/scripts/trivias/catalog.min.js');
                    initTriviaCatalog();       
                } else if (validChildren['/trivias'].includes(triviaType)) {
                    const mainNav = document.querySelector('.main-nav');
                    if (mainNav) mainNav.classList.add('hidden');
                    await loadTemplate('/templates/trivias/trivia.html', dynamicContent);
                    const { initTriviaGame } = await import('/scripts/trivias/trivia.min.js');
                    initTriviaGame(triviaType.replace(/-/g, ' '));
                } else {
                    showHomeScreen();
                }
            } else if (path.startsWith('/number-puzzle')) {
                const puzzleType = pathParts[1];
                if (puzzleType === 'catalog') {
                    const mainNav = document.querySelector('.main-nav');
                    if (mainNav) mainNav.classList.remove('hidden');
                    await loadTemplate('/templates/number-puzzle/catalog.html', dynamicContent);
                } else if (validChildren['/number-puzzle'].includes(puzzleType)) {
                    const mainNav = document.querySelector('.main-nav');
                    if (mainNav) mainNav.classList.add('hidden');
                    await loadTemplate(`/templates/number-puzzle/${puzzleType}.html`, dynamicContent);
                    const { initPuzzle } = await import(`/scripts/number-puzzle/${puzzleType}.min.js`);
                    initPuzzle();
                } else {
                    showHomeScreen();
                }
            } else if (path.startsWith('/word-game')) {
                const gameType = pathParts[1];
                if (gameType === 'catalog') {
                    const mainNav = document.querySelector('.main-nav');
                    if (mainNav) mainNav.classList.remove('hidden');
                    await loadTemplate('/templates/word-game/catalog.html', dynamicContent);
                } else if (validChildren['/word-game'].includes(gameType)) {
                    const mainNav = document.querySelector('.main-nav');
                    if (mainNav) mainNav.classList.add('hidden');
                    await loadTemplate(`/templates/word-game/${gameType}.html`, dynamicContent);
                    const { initWordGame } = await import(`/scripts/word-game/${gameType}.min.js`);
                    initWordGame();
                } else {
                    showHomeScreen();
                }
            } else {
                showHomeScreen();
            }
        } catch (error) {
            console.error('Routing error:', error);
            showError(path.includes('number-puzzle') ? 'number-puzzle' : path.includes('word-game') ? 'word-game' : 'content');
        } finally {
            isRouting = false;
        }
    }

    // Helper Functions
    function updatePageMetadata(path, pathParts) {
        const pageTitles = {
            '/home': 'Triviaah - Play Trivia Games',
            '/privacy': 'Triviaah - Privacy Policy',
            '/contact': 'Triviaah - Contact Us',
            '/trivias': pathParts[1] ? `Triviaah - ${pathParts[1].replace(/-/g, ' ')} Trivia` : 'Triviaah - Trivia Catalog',
            '/number-puzzle': pathParts[1] ? `Triviaah - ${pathParts[1].replace(/-/g, ' ')} Number Puzzle` : 'Triviaah - Number Puzzle Catalog',
            '/word-game': pathParts[1] ? `Triviaah - ${pathParts[1].replace(/-/g, ' ')} Word Game` : 'Triviaah - Word Game Catalog'
        };

        const pageDescriptions = {
            '/home': 'Play fun and challenging trivia games on Triviaah!',
            '/privacy': 'Read the privacy policy for Triviaah to understand how we handle your data.',
            '/contact': 'Get in touch with Triviaah for support or inquiries.',
            '/trivias': pathParts[1] ? `Play ${pathParts[1].replace(/-/g, ' ')} trivia games on Triviaah! Test your knowledge now.` : 'Explore a variety of trivia games on Triviaah.',
            '/number-puzzle': pathParts[1] ? `Solve ${pathParts[1].replace(/-/g, ' ')} number puzzles on Triviaah! Challenge your math skills.` : 'Discover fun number puzzles on Triviaah.',
            '/word-game': pathParts[1] ? `Play ${pathParts[1].replace(/-/g, ' ')} word games on Triviaah! Test your vocabulary skills.` : 'Enjoy word games on Triviaah.'
        };

        const basePath = pathParts.length > 0 ? `/${pathParts[0]}` : '/home';
        document.title = pageTitles[basePath] || 'Triviaah';
        
        let metaDescription = document.querySelector('meta[name="description"]');
        if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.name = 'description';
            document.head.appendChild(metaDescription);
        }
        metaDescription.content = pageDescriptions[basePath] || 'Play fun and challenging games on Triviaah!';
    }

    async function loadTemplate(url, container) {
        if (!container) return;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load template: ${url}`);
            container.innerHTML = await response.text();
            container.classList.add('active');
        } catch (error) {
            console.error('Template load error:', error);
            container.innerHTML = `
                <div class="error">
                    <h3>Error Loading Content</h3>
                    <p>Unable to load the requested page. Please try again later.</p>
                    <a href="/home" class="btn primary">Return Home</a>
                </div>
            `;
            container.classList.add('active');
            throw error;
        }
    }

    function showError(type) {
        if (!dynamicContent) return;
        
        dynamicContent.innerHTML = `
            <div class="error">
                <h3>Error Loading ${type.replace('-', ' ')}</h3>
                <p>Unable to load the game. Please try again later.</p>
                <a href="/home" class="btn primary">Return Home</a>
            </div>
        `;
        dynamicContent.classList.add('active');
    }

    function showHomeScreen() {
        if (setupScreen) setupScreen.classList.add('active');
        if (dynamicContent) dynamicContent.classList.remove('active');
        const gameScreen = document.querySelector('.game-screen');
        if (gameScreen) gameScreen.classList.remove('active');
        const summaryScreen = document.querySelector('.summary-screen');
        if (summaryScreen) summaryScreen.classList.remove('active');
        const mainNav = document.querySelector('.main-nav');
        if (mainNav) mainNav.classList.remove('hidden');
    }

    function getTimeRemaining() {
        const now = new Date();
        const dailyReset = new Date(now);
        dailyReset.setHours(24, 0, 0, 0);
        
        const weeklyReset = new Date(now);
        weeklyReset.setDate(weeklyReset.getDate() + (7 - now.getDay()));
        weeklyReset.setHours(0, 0, 0, 0);
        
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        
        return {
            daily: Math.floor((dailyReset - now) / 3600000),
            weekly: Math.ceil((weeklyReset - now) / 86400000),
            monthly: daysInMonth - now.getDate() + 1
        };
    }

    // Scroll Indicator - Corrected Implementation
    if (scrollIndicator && scrollArrow) {
        const updateScrollIndicator = () => {
            const shouldShowIndicator = 
                (setupScreen && setupScreen.classList.contains('active')) ||
                (dynamicContent && dynamicContent.classList.contains('active') && 
                 document.querySelector('.categories-grid'));
            
            if (!shouldShowIndicator) {
                scrollIndicator.style.display = 'none';
                return;
            }
            
            scrollIndicator.style.display = 'flex';
            const nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 10;
            scrollArrow.textContent = nearBottom ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
        };

        scrollIndicator.addEventListener('click', () => {
            const nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 10;
            window.scrollTo({ 
                top: nearBottom ? 0 : document.documentElement.scrollHeight, 
                behavior: 'smooth' 
            });
        });

        window.addEventListener('scroll', updateScrollIndicator);
        window.addEventListener('resize', updateScrollIndicator);
        updateScrollIndicator();
    }

    // Initialize routing
    window.handleRouting = handleRouting;
    handleRouting(currentPath);
});