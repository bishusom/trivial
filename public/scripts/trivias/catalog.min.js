export function initTriviaCatalog() {
    console.log('Initializing trivia catalog...');
    setupCategoryCards();
    updateProgressTracker();
}

function setupCategoryCards() {
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.category-card');
        if (card) {
            const category = card.dataset.category;
            const isTimedMode = false; // Default to non-timed
            console.log('Dispatching startQuiz for category:', category, 'isTimedMode:', isTimedMode);
            document.dispatchEvent(new CustomEvent('startQuiz', { 
                detail: { 
                    category,
                    isTimedMode
                }
            }));
        }
    });
}

function updateProgressTracker() {
    const gamesPlayed = parseInt(localStorage.getItem('gamesPlayed') || '0');
    const progress = Math.min((gamesPlayed / 5) * 100, 100);
    const progressElement = document.getElementById('progress-fill');
    
    if (progressElement) {
        progressElement.style.width = `${progress}%`;
        progressElement.setAttribute('aria-valuenow', progress);
    }

    const messages = [
        { threshold: 0, text: "You're one game away from your first badge! Play now" },
        { threshold: 1, text: "Keep going! 3 more games for a new achievement!" },
        { threshold: 3, text: "Almost there! 1 more game to level up!" },
        { threshold: 5, text: "Trivia Master! Play to discover new challenges!" }
    ];
    
    const message = messages.reverse().find(m => gamesPlayed >= m.threshold)?.text || messages[0].text;
    document.getElementById('progress-message').textContent = message;
}