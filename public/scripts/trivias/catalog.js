export function initTriviaCatalog() {
    console.log('Initializing trivia catalog...');
    setupCarousel();
    setupCategoryCards();
    updateProgressTracker();
    setupEvents();
}

// Add smooth scrolling behavior for mobile
function initCarouselScroll() {
    const carousel = document.querySelector('.carousel-wrapper');
    let isDown = false;
    let startX;
    let scrollLeft;

    carousel.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - carousel.offsetLeft;
        scrollLeft = carousel.scrollLeft;
    });

    carousel.addEventListener('mouseleave', () => {
        isDown = false;
    });

    carousel.addEventListener('mouseup', () => {
        isDown = false;
    });

    carousel.addEventListener('mousemove', (e) => {
        if(!isDown) return;
        e.preventDefault();
        const x = e.pageX - carousel.offsetLeft;
        const walk = (x - startX) * 2;
        carousel.scrollLeft = scrollLeft - walk;
    });

    // Touch support
    carousel.addEventListener('touchstart', (e) => {
        isDown = true;
        startX = e.touches[0].pageX - carousel.offsetLeft;
        scrollLeft = carousel.scrollLeft;
    });

    carousel.addEventListener('touchend', () => {
        isDown = false;
    });

    carousel.addEventListener('touchmove', (e) => {
        if(!isDown) return;
        e.preventDefault();
        const x = e.touches[0].pageX - carousel.offsetLeft;
        const walk = (x - startX) * 2;
        carousel.scrollLeft = scrollLeft - walk;
    });
}

function setupCarousel() {
    const wrapper = document.querySelector('.carousel-wrapper');
    const track = document.querySelector('.carousel-track');
    const leftArrow = document.querySelector('.left-arrow');
    const rightArrow = document.querySelector('.right-arrow');

    if (!wrapper || !track) return;

    function scroll(direction) {
        const scrollAmount = 300;
        wrapper.scrollBy({
            left: direction * scrollAmount,
            behavior: 'smooth'
        });
    }

    // Initialize mobile touch scrolling only on mobile
    if (window.matchMedia('(max-width: 768px)').matches) {
        initCarouselScroll();
    }

    leftArrow?.addEventListener('click', () => scroll(-1));
    rightArrow?.addEventListener('click', () => scroll(1));

    const updateArrows = () => {
        if (leftArrow) {
            leftArrow.style.opacity = wrapper.scrollLeft > 10 ? '1' : '0.3';
            leftArrow.style.cursor = wrapper.scrollLeft > 10 ? 'pointer' : 'default';
        }
        if (rightArrow) {
            const atEnd = wrapper.scrollLeft + wrapper.clientWidth >= track.scrollWidth - 10;
            rightArrow.style.opacity = atEnd ? '0.3' : '1';
            rightArrow.style.cursor = atEnd ? 'default' : 'pointer';
        }
    };

    wrapper.addEventListener('scroll', updateArrows);
    updateArrows();
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