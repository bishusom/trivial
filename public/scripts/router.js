document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.querySelector('.setup-screen');
    const dynamicContent = document.getElementById('dynamic-content');
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    let activeDropdown = null;
    let currentPath = window.location.pathname;
    let isRouting = false;

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
            hamburger.setAttribute('aria-expanded', !isExpanded);
            navMenu.classList.toggle('active');
            hamburger.querySelector('.material-icons').textContent = isExpanded ? 'menu' : 'close';
        });
    }

    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', (e) => {
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
            const dropdown = e.target.closest('.nav-dropdown').querySelector('.dropdown-content');
            const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

            document.querySelectorAll('.dropdown-content').forEach(d => {
                if (d !== dropdown) {
                    d.style.display = 'none';
                    d.closest('.nav-dropdown').querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
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
        if (!e.target.closest('.nav-dropdown') && activeDropdown) {
            activeDropdown.style.display = 'none';
            activeDropdown.closest('.nav-dropdown').querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
            activeDropdown = null;
        }

        if (!e.target.closest('.main-nav') && navMenu?.classList.contains('active')) {
            navMenu.classList.remove('active');
            if (hamburger) {
                hamburger.setAttribute('aria-expanded', 'false');
                hamburger.querySelector('.material-icons').textContent = 'menu';
            }
        }

        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
                hamburger.setAttribute('aria-expanded', !isExpanded);
                navMenu.classList.toggle('active');
                hamburger.querySelector('.material-icons').textContent = isExpanded ? 'menu' : 'close';
            });
        }

        const link = e.target.closest('a[href]');
        if (!link) return;

        if (link.hostname !== window.location.hostname || 
            link.target ||
            link.href.includes('.pdf') || 
            link.href.includes('.jpg') ||
            link.href.includes('.png')) {
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
            activeDropdown.closest('.nav-dropdown').querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
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
            
            // Close all other submenus first
            document.querySelectorAll('.submenu').forEach(sm => {
                if (sm !== submenu) {
                    sm.classList.remove('active');
                }
            });
            
            // Toggle current submenu
            submenu.classList.toggle('active');
        });
    });

    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                const dropdown = this.closest('.dropdown');
                const isExpanded = this.getAttribute('aria-expanded') === 'true';
                
                // Close all other dropdowns
                document.querySelectorAll('.dropdown').forEach(d => {
                    if (d !== dropdown) {
                        d.classList.remove('active');
                        d.querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
                    }
                });
                
                // Toggle current dropdown
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
            hamburger.querySelector('.material-icons').textContent-Germain = 'menu';
            navClose.style.display = 'none';
            hamburger.style.display = 'block';
        });
    }

    window.addEventListener('popstate', () => {
        if (!isRouting) {
            isRouting = true;
            handleRouting(window.location.pathname);
            setTimeout(() => { isRouting = false; }, 100);
        }
    });

    function handleGameInProgressNavigation(path) {
        const modal = document.getElementById('nav-warning-modal');
        if (modal) {
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
    }

    async function handleRouting(path) {
        if (path === currentPath) return;
        currentPath = path;
        path = path === '/' ? '/home' : path.replace(/\/$/, '');
    
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
        if (window.gtag) {
            window.gtag('event', 'navigate', {
                event_category: eventCategory,
                event_label: eventLabel,
                path: path
            });
        }
    
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
    
        const validChildren = {
            '/trivias': ['weekly', 'monthly', 'general-knowledge', 'literature', 'arts', 'animals', 'science', 'history', 'geography', 'movies', 'tv-web-series', 'music', 'celebrities', 'politics', 'food', 'sports', 'business', 'mythology', 'catalog'],
            '/number-puzzle': ['guess', 'scramble', 'sequence', 'catalog'],
            '/word-game': ['classic', 'anagram', 'spelling', 'catalog']
        };
    
        if (validChildren[baseRoute] && pathParts.length === 1) {
            showHomeScreen();
            return;
        }
    
        if (path.includes('/privacy')) {
            await loadTemplate('/templates/privacy.html', dynamicContent);
        } else if (path.includes('/contact')) {
            await loadTemplate('/templates/contact.html', dynamicContent);
        } else if (path === '/home') {
            showHomeScreen();
        } else if (path.startsWith('/trivias')) {
            const triviaType = pathParts[1];
            if (triviaType === 'catalog') {
                await loadTemplate('/templates/trivias/catalog.html', dynamicContent);
                const { initTriviaCatalog } = await import('/scripts/trivias/catalog.js');
                initTriviaCatalog();
            } else if (validChildren['/trivias'].includes(triviaType)) {
                await loadTemplate('/templates/trivias/trivia.html', dynamicContent);
                const { initTriviaGame } = await import('/scripts/trivias/trivia.js');
                initTriviaGame(triviaType.replace(/-/g, ' '));
            } else {
                showHomeScreen();
            }
        } else if (path.startsWith('/number-puzzle')) {
            const puzzleType = pathParts[1];
            if (puzzleType === 'catalog') {
                await loadTemplate('/templates/number-puzzle/catalog.html', dynamicContent);
            } else if (validChildren['/number-puzzle'].includes(puzzleType)) {
                await loadTemplate(`/templates/number-puzzle/${puzzleType}.html`, dynamicContent);
                try {
                    const { initPuzzle } = await import(`/scripts/number-puzzle/${puzzleType}.js`);
                    initPuzzle();
                } catch (error) {
                    showHomeScreen();
                    showError('number-puzzle');
                }
            } else {
                showHomeScreen();
            }
        } else if (path.startsWith('/word-game')) {
            const gameType = pathParts[1];
            if (gameType === 'catalog') {
                await loadTemplate('/templates/word-game/catalog.html', dynamicContent);
            } else if (validChildren['/word-game'].includes(gameType)) {
                await loadTemplate(`/templates/word-game/${gameType}.html`, dynamicContent);
                try {
                    const { initWordGame } = await import(`/scripts/word-game/${gameType}.js`);
                    initWordGame();
                } catch (error) {
                    showHomeScreen();
                    showError('word-game');
                }
            } else {
                showHomeScreen();
            }
        } else {
            showHomeScreen();
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
            container.innerHTML = `
                <div class="error">
                    <h3>Error Loading Content</h3>
                    <p>Unable to load the requested page. Please try again later.</p>
                    <a href="/home" class="btn primary">Return Home</a>
                </div>
            `;
            container.classList.add('active');
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
    }
});