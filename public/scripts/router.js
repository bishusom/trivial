import { endGame } from '/scripts/app.js';

document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.querySelector('.setup-screen');
    const gameScreen = document.querySelector('.game-screen')

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
        } else {
            showHomeScreen();
        }
    }

    function showHomeScreen() {
        setupScreen.classList.add('active');
        gameScreen.classList.remove('active');
        currentContentPath = '';
    }
});