export function initTBankControls() {
    const toggleButton = document.getElementById('toggleAnswers');
    const printButton = document.getElementById('printPDF');
    const showHideEmoji = document.getElementById('show_hide_emoji');
    
    if(toggleButton && printButton) {
        let answersVisible = false;
        const answers = document.querySelectorAll('.answer');

        // Toggle answers
        toggleButton.addEventListener('click', () => {
            answersVisible = !answersVisible;
            answers.forEach(answer => {
                answer.style.display = answersVisible ? 'block' : 'none';
            });
            toggleButton.textContent = showHideEmoji.textContent
            toggleButton.textContent += answersVisible ? ' Hide Answers' : ' Show Answers';;
        });

        // Print handling
        printButton.addEventListener('click', () => {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>${document.querySelector('title').text} - Printable Version</title>
                        <style>
                            .answer { display: block !important; }
                            .controls, .blog-footer { display: none; }
                        </style>
                    </head>
                    <body>
                        ${document.querySelector('body').innerHTML}
                        <br>©www.triviaah.com
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
            printWindow.close();
        });
    }
}

export function initTbankFilters(){
    const alphaBtns = document.querySelectorAll('.alpha-btn');
    const blogPreviews = document.querySelectorAll('.blog-preview');
    const noResultsDiv = document.querySelector('.no-results');
    const selectedLetterSpan = document.querySelector('.selected-letter');
    const filterCriteria = document.querySelector('.filter-criteria');
    const criteriaText = document.querySelector('.criteria-text');

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

export function processSocialSharing() {
    const blogTbankScreen = document.querySelector('.blog-content');
    if (!blogTbankScreen) return;

    const postUrl = encodeURIComponent(window.location.href);
    const postTitle = encodeURIComponent(blogTbankScreen.querySelector('h1')?.textContent || '');
    
    blogTbankScreen.querySelectorAll('.social-button').forEach(link => {
        link.href = link.href
            .replace(/POST_URL/g, postUrl)
            .replace(/POST_TITLE/g, postTitle);
    });
}