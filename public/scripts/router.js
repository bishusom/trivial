let categoryGroupClickHandlers = [];

document.addEventListener('DOMContentLoaded', () => {
        // Update the quiz timers
    const updateQuizTimers = () => {
        const timeLeft = getTimeRemaining();
        
        // Update Daily Quiz
        const dailyQuiz = document.querySelector('[data-category="Daily"]');
        if (dailyQuiz) {
            const dailyText = dailyQuiz.querySelector('span');
            if (dailyText) {
                dailyText.innerHTML = `Daily Quiz (Resets in <b>${timeLeft.daily} hrs</b>)`;
            }
        }
        
        // Update Weekly Quiz
        const weeklyQuiz = document.querySelector('[data-category="Weekly"]');
        if (weeklyQuiz) {
            const weeklyText = weeklyQuiz.querySelector('span');
            if (weeklyText) {
                weeklyText.innerHTML = `Weekly Quiz (Expires in <b>${timeLeft.weekly} days</b>)`;
            }
        }
        
        // Update Monthly Quiz
        const monthlyQuiz = document.querySelector('[data-category="Monthly"]');
        if (monthlyQuiz) {
            const monthlyText = monthlyQuiz.querySelector('span');
            if (monthlyText) {
                monthlyText.innerHTML = `Monthly Quiz (New Quiz in <b>${timeLeft.monthly} days</b>)`;
            }
        }
    };
    
    // Call it initially
    updateQuizTimers();
    
    // Set up interval to update every hour
    setInterval(updateQuizTimers, 3600000); // 3600000ms = 1 hour
    
    const setupScreen = document.querySelector('.setup-screen');
    const dynamicContent = document.getElementById('dynamic-content');
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const scrollArrow = document.querySelector('.scroll-arrow');

    let activeDropdown = null;
    let currentPath = window.location.pathname;
    let isRouting = false;
    let loadingTimeout = null;

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
            hamburger.setAttribute('aria-expanded', !isExpanded);
            navMenu.classList.toggle('active');
            hamburger.querySelector('.material-icons').textContent = isExpanded ? 'menu' : 'close';
        });
    }

    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            if (navMenu && hamburger) {
                navMenu.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
                hamburger.querySelector('.material-icons').textContent = 'menu';
            }
        });
    });

    window.handleRouting = handleRouting;
    handleRouting(currentPath);

    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            const dropdown = e.target.closest('.dropdown').querySelector('.dropdown-content');
            const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

            document.querySelectorAll('.dropdown-content').forEach(d => {
                if (d !== dropdown) {
                    d.style.display = 'none';
                    d.closest('.dropdown').querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
                }
            });

            if (dropdown.style.display === 'block') {
                dropdown.style.display = 'none';
                toggle.setAttribute('aria-expanded', 'false');
                activeDropdown = null;
            } else {
                dropdown.style.display = 'block';
                toggle.setAttribute('aria-expanded', 'true');
                activeDropdown = dropdown;
            }

            if (window.innerWidth <= 768) {
                e.preventDefault();
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown') && activeDropdown) {
            activeDropdown.style.display = 'none';
            activeDropdown.closest('.dropdown').querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
            activeDropdown = null;
        }

        if (!e.target.closest('.main-nav') && navMenu?.classList.contains('active')) {
            navMenu.classList.remove('active');
            if (hamburger) {
                hamburger.setAttribute('aria-expanded', 'false');
                hamburger.querySelector('.material-icons').textContent = 'menu';
            }
        }

        const link = e.target.closest('a[href]');
        if (!link) return;

        if (
            link.hostname !== window.location.hostname ||
            link.target ||
            link.href.includes('.pdf') ||
            link.href.includes('.jpg') ||
            link.href.includes('.png')
        ) {
            return;
        }

        const isParentLink = link.classList.contains('dropdown-toggle');
        if (isParentLink && window.innerWidth > 768) {
            return;
        }

        e.preventDefault();
        const path = new URL(link.href).pathname;

        if (activeDropdown) {
            activeDropdown.style.display = 'none';
            activeDropdown.closest('.dropdown').querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
            activeDropdown = null;
        }
        if (navMenu) {
            navMenu.classList.remove('active');
            if (hamburger) {
                hamburger.setAttribute('aria-expanded', 'false');
                hamburger.querySelector('.material-icons').textContent = 'menu';
            }
        }

        const gameScreen = document.querySelector('.game-screen');
        if (gameScreen && gameScreen.classList.contains('active')) {
            handleGameInProgressNavigation(path);
        } else {
            window.history.pushState({ path }, '', path);
            handleRouting(path);
        }
    });

    document.querySelectorAll('.submenu-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return;

            e.preventDefault();
            e.stopPropagation();

            const submenu = e.target.closest('.submenu');
            const isActive = submenu.classList.contains('active');

            document.querySelectorAll('.submenu').forEach(sm => {
                if (sm !== submenu) {
                    sm.classList.remove('active');
                }
            });

            submenu.classList.toggle('active');
        });
    });

    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', function (e) {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                const dropdown = this.closest('.dropdown');
                const isExpanded = this.getAttribute('aria-expanded') === 'true';

                document.querySelectorAll('.dropdown').forEach(d => {
                    if (d !== dropdown) {
                        d.classList.remove('active');
                        d.querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
                    }
                });

                dropdown.classList.toggle('active');
                this.setAttribute('aria-expanded', !isExpanded);
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown') && window.innerWidth <= 768) {
            document.querySelectorAll('.dropdown').forEach(dropdown => {
                dropdown.classList.remove('active');
                dropdown.querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
            });
        }
    });

    const navClose = document.querySelector('.nav-close');
    if (navClose && navMenu) {
        navClose.addEventListener('click', () => {
            navMenu.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
            hamburger.querySelector('.material-icons').textContent = 'menu';
            navClose.style.display = 'none';
            hamburger.style.display = 'block';
        });
    }

    window.addEventListener('popstate', () => {
        if (!isRouting) {
            isRouting = true;
            handleRouting(window.location.pathname);
            setTimeout(() => {
                isRouting = false;
            }, 100);
        }
    });

    const categoryGroups = document.querySelectorAll('.category-group');
    
    // Function to handle group toggling
    const handleGroupToggle = (group) => {
        group.classList.toggle('active');
    };
    
    // Initialize groups based on screen size
    function initCategoryGroups() {
        // Remove all existing click handlers first
        categoryGroupClickHandlers.forEach(({group, handler}) => {
            group.querySelector('.group-header').removeEventListener('click', handler);
        });
        categoryGroupClickHandlers = [];
        
        const isMobile = window.innerWidth <= 768;
        
        categoryGroups.forEach(group => {
            const header = group.querySelector('.group-header');
            
            if (isMobile) {
                // Close all groups by default on mobile
                group.classList.remove('active');
                
                // Create a specific handler for this group
                const handler = () => handleGroupToggle(group);
                header.addEventListener('click', handler);
                
                // Store reference for later removal
                categoryGroupClickHandlers.push({group, handler});
            } else {
                // Show all groups on desktop
                group.classList.add('active');
            }
        });
    }
    
    // Initial setup
    initCategoryGroups();
    
    // Handle window resize - throttled for performance
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(initCategoryGroups, 100);
    });

    function handleGameInProgressNavigation(path) {
        // Don't show modal if we're already on the summary screen
        const summaryScreen = document.querySelector('.summary-screen');
        if (summaryScreen && summaryScreen.classList.contains('active')) {
            window.history.pushState({ path }, '', path);
            handleRouting(path);
            return;
        }

        // Only show modal if game screen is active
        const gameScreen = document.querySelector('.game-screen');
        if (gameScreen && gameScreen.classList.contains('active')) {
            const modal = document.getElementById('nav-warning-modal');
            if (modal) {
                modal.classList.remove('hidden');
                window.pendingNavigation = path;

                const continueBtn = document.getElementById('continue-game');
                const endBtn = document.getElementById('end-game');

                // Clone buttons to avoid duplicate event listeners
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
                    if (typeof window.endGame === 'function') {
                        window.endGame();
                        localStorage.removeItem('triviaMasterGameState');
                    }
                    if (window.pendingNavigation) {
                        window.history.pushState({ path: window.pendingNavigation }, '', window.pendingNavigation);
                        handleRouting(window.pendingNavigation);
                        window.pendingNavigation = null;
                    }
                });
            }
        } else {
            // No game in progress, proceed with navigation
            window.history.pushState({ path }, '', path);
            handleRouting(path);
        }
    }

    async function handleRouting(path) {
        if (path === currentPath || isRouting) return;
        isRouting = true;
        currentPath = path;
        path = path === '/' ? '/home' : path.replace(/\/$/, '');

        // Determine loading indicator delay based on route
        let loadingDelay = 0; // Default: no loading indicator

        // Show loading indicator if delay is set
        let loadingPromise = Promise.resolve();
        if (loadingDelay > 0) {
            toggleLoading(true);
            if (loadingTimeout) clearTimeout(loadingTimeout);
            loadingPromise = new Promise(resolve => {
                loadingTimeout = setTimeout(resolve, loadingDelay);
            });
        }

        // Track navigation event with Google Analytics
        const pathParts = path.split('/').filter(part => part);
        const baseRoute = pathParts.length > 0 ? `/${pathParts[0]}` : '/home';
        let eventCategory = '';
        let eventLabel = path;

        if (path === '/home') {
            eventCategory = 'Page View';
            eventLabel = 'Home';
            document.title = 'Triviaah - Play Trivia Games';
            updateMetaDescription('Play fun and challenging trivia games on Triviaah!');
        } else if (path.includes('/privacy')) {
            eventCategory = 'Page View';
            eventLabel = 'Privacy Policy';
            document.title = 'Triviaah - Privacy Policy';
            updateMetaDescription('Read the privacy policy for Triviaah to understand how we handle your data.');
        } else if (path.includes('/contact')) {
            eventCategory = 'Page View';
            eventLabel = 'Contact Us';
            document.title = 'Triviaah - Contact Us';
            updateMetaDescription('Get in touch with Triviaah for support or inquiries.');
        } else if (path.startsWith('/trivias')) {
            eventCategory = 'Trivia';
            eventLabel = pathParts[1] ? pathParts[1].replace(/-/g, ' ') : 'Trivia Catalog';
            if (pathParts[1] && pathParts[1] !== 'catalog') {
                const triviaTitle = pathParts[1].replace(/-/g, ' ');
                document.title = `Triviaah - ${triviaTitle} Trivia`;
                updateMetaDescription(`Play ${triviaTitle} trivia games on Triviaah! Test your knowledge now.`);
            } else {
                document.title = 'Triviaah - Trivia Catalog';
                updateMetaDescription('Explore a variety of trivia games on Triviaah, from weekly challenges to general knowledge.');
            }
        } else if (path.startsWith('/number-puzzle')) {
            eventCategory = 'Number Puzzle';
            eventLabel = pathParts[1] ? pathParts[1].replace(/-/g, ' ') : 'Number Puzzle Catalog';
            if (pathParts[1] && pathParts[1] !== 'catalog') {
                const puzzleTitle = pathParts[1].replace(/-/g, ' ');
                document.title = `Triviaah - ${puzzleTitle} Number Puzzle`;
                updateMetaDescription(`Solve ${puzzleTitle} number puzzles on Triviaah! Challenge your math skills.`);
            } else {
                document.title = 'Triviaah - Number Puzzle Catalog';
                updateMetaDescription('Discover fun number puzzles on Triviaah, including guess, scramble, and sequence games.');
            }
        } else if (path.startsWith('/word-game')) {
            eventCategory = 'Word Game';
            eventLabel = pathParts[1] ? pathParts[1].replace(/-/g, ' ') : 'Word Game Catalog';
            if (pathParts[1] && pathParts[1] !== 'catalog') {
                const gameTitle = pathParts[1].replace(/-/g, ' ');
                document.title = `Triviaah - ${gameTitle} Word Game`;
                updateMetaDescription(`Play ${gameTitle} word games on Triviaah! Test your vocabulary skills.`);
            } else {
                document.title = 'Triviaah - Word Game Catalog';
                updateMetaDescription('Enjoy word games on Triviaah, including classic, anagram, and spelling challenges.');
            }
        }

        // Send gtag event
        if (typeof gtag !== 'undefined') {
            gtag('event', 'navigate', {
                event_category: eventCategory,
                event_label: eventLabel,
                path: path
            });
        }

        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        const validChildren = {
            '/trivias': ['daily', 'weekly', 'monthly', 'general-knowledge', 'literature', 'arts','animals', 'science', 
                         'history', 'fashion', 'festivals', 'geography', 'movies', 'tv', 'music', 'celebrities', 'politics', 
                         'food', 'sports', 'business', 'mythology', 'philosophy', 'video-games','board-games','catalog', 
                         'tbank'],
            '/number-puzzle': ['guess', 'scramble', 'sequence', 'primehunter', 'numbertower', 'sodoku', 'catalog'],
            '/word-game': ['classic', 'anagram', 'spelling', 'boggle', 'wordsearch', 'wordladder', 'wordcircle', 'catalog']
        };

        try {
            if (validChildren[baseRoute] && pathParts.length === 1) {
                showHomeScreen();
            } else if (path.includes('/privacy')) {
                await loadTemplate('/templates/privacy.html', dynamicContent);
            } else if (path.includes('/contact')) {
                await loadTemplate('/templates/contact.html', dynamicContent);
            } else if (path === '/home') {
                showHomeScreen();
            } else if (path.startsWith('/trivias')) {
                    const triviaType = pathParts[1];
                    document.querySelector('.floating-cta').classList.add('hidden');
                    if (triviaType === 'catalog') {
                        document.body.classList.remove('game-screen-active');
                        await loadTemplate('/templates/trivias/catalog.html', dynamicContent);
                        const { initTriviaCatalog } = await import('/scripts/trivias/catalog.min.js');
                        initTriviaCatalog();       
                    } else if (validChildren['/trivias'].includes(triviaType)) {
                        //document.body.classList.add('game-screen-active');
                        await loadTemplate('/templates/trivias/trivia.html', dynamicContent);
                        const { initTriviaGame } = await import('/scripts/trivias/trivia.min.js');
                        initTriviaGame(triviaType.replace(/-/g, ' '));
                    } else {
                        showHomeScreen();
                    }
            } else if (path.startsWith('/tbank')) {
                document.querySelector('.floating-cta').classList.add('hidden');
                console.log(pathParts);
                if (pathParts.length === 2) {
                   window.location.href = `/tbank${pathParts.length > 1 ? `/${pathParts[1]}` : ''}`;
                   return; // Exit early since we're doing a full page load 
                } else {
                    showHomeScreen();
                }         
            } else if (path.startsWith('/blog')) {
                document.querySelector('.floating-cta').classList.add('hidden');
                console.log(pathParts);
                if (pathParts.length === 2) {
                   window.location.href = `/blog${pathParts.length > 1 ? `/${pathParts[1]}` : ''}`;
                   return; // Exit early since we're doing a full page load 
                } else {
                    showHomeScreen();
                }        
            } else if (path.startsWith('/number-puzzle')) {
                const puzzleType = pathParts[1];
                document.querySelector('.floating-cta').classList.add('hidden');
                if (puzzleType === 'catalog') {
                    document.querySelector('.main-nav').classList.remove('hidden');
                    await loadTemplate('/templates/number-puzzle/catalog.html', dynamicContent);
                } else if (validChildren['/number-puzzle'].includes(puzzleType)) {
                    document.querySelector('.main-nav').classList.add('hidden');
                    await loadTemplate(`/templates/number-puzzle/${puzzleType}.html`, dynamicContent);
                    const { initPuzzle } = await import(`/scripts/number-puzzle/${puzzleType}.min.js`);
                    initPuzzle();
                } else {
                    showHomeScreen();
                }
            } else if (path.startsWith('/word-game')) {
                document.querySelector('.floating-cta').classList.add('hidden');
                const gameType = pathParts[1];
                if (gameType === 'catalog') {
                    document.querySelector('.main-nav').classList.remove('hidden');
                    await loadTemplate('/templates/word-game/catalog.html', dynamicContent);
                } else if (validChildren['/word-game'].includes(gameType)) {
                    document.querySelector('.main-nav').classList.add('hidden');
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
            // Wait for both content loading and minimum delay (if applicable)
            await loadingPromise;
            if (loadingDelay > 0) {
                toggleLoading(false);
            }
            isRouting = false;
        }
    }

    function updateMetaDescription(content) {
        let metaDescription = document.querySelector('meta[name="description"]');
        if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.name = 'description';
            document.head.appendChild(metaDescription);
        }
        metaDescription.content = content;
    }

    async function loadTemplate(url, container) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load template from ${url}. Status: ${response.status}`);
            }
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
            throw error; // Re-throw to trigger error handling in handleRouting
        }
    }

    function showError(type) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.innerHTML = `
            <h3>Error Loading ${type.replace('-', ' ')}</h3>
            <p>Unable to load the game. Please try again later.</p>
            <a href="/home" class="btn primary">Return Home</a>
        `;
        dynamicContent.innerHTML = errorDiv.outerHTML;
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
        document.querySelector('.floating-cta').classList.remove('hidden');
    }

    function toggleLoading(show) {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList[show ? 'remove' : 'add']('hidden');
        }
    }

    // Scroll Indicator Logic
    function updateScrollIndicator() {
        if (!scrollIndicator || !scrollArrow) return;

        // Always show on setup-screen when active
        if (setupScreen.classList.contains('active')) {
            scrollIndicator.style.display = 'flex';
        } else {
            scrollIndicator.style.display = 'none';
            return;
        }

        // Toggle arrow direction based on scroll position
        const docHeight = document.documentElement.scrollHeight;
        const winHeight = window.innerHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;

        if (scrollTop + winHeight >= docHeight - 10) { // Near bottom
            scrollArrow.textContent = 'keyboard_arrow_up';
        } else {
            scrollArrow.textContent = 'keyboard_arrow_down';
        }
    }

    // Scroll to top or bottom on click
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', () => {
            const docHeight = document.documentElement.scrollHeight;
            const winHeight = window.innerHeight;
            const scrollTop = window.scrollY || document.documentElement.scrollTop;

            if (scrollTop + winHeight >= docHeight - 10) {
                // At bottom, scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                // Not at bottom, scroll to bottom
                window.scrollTo({ top: docHeight - winHeight, behavior: 'smooth' });
            }
        });
    }

    // Update indicator on scroll, resize, and initial load
    window.addEventListener('scroll', updateScrollIndicator);
    window.addEventListener('resize', updateScrollIndicator);
    updateScrollIndicator(); // Run immediately on load

    function getTimeRemaining() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay(); // 0 (Sunday) to 6 (Saturday)
        const currentDate = now.getDate();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // Calculate days in current month
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        // Daily quiz resets at midnight (0:00)
        const dailyReset = new Date(now);
        dailyReset.setHours(24, 0, 0, 0);
        const dailyHoursLeft = Math.floor((dailyReset - now) / (1000 * 60 * 60));
        
        // Weekly quiz resets on Sunday at midnight
        const weeklyReset = new Date(now);
        weeklyReset.setDate(weeklyReset.getDate() + (7 - currentDay));
        weeklyReset.setHours(0, 0, 0, 0);
        const weeklyDaysLeft = Math.ceil((weeklyReset - now) / (1000 * 60 * 60 * 24));
        
        // Monthly quiz resets on 1st of next month at midnight
        const monthlyReset = new Date(currentYear, currentMonth + 1, 1);
        const monthlyDaysLeft = daysInMonth - currentDate + 1;
        
        return {
            daily: dailyHoursLeft,
            weekly: weeklyDaysLeft,
            monthly: monthlyDaysLeft
    };
}
});