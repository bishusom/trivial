function initializeQuizControls() {
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

function processSocialSharing() {
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


// Initialize when content loads
document.addEventListener('DOMContentLoaded', initializeQuizControls);

// Re-initialize if content is loaded dynamically
if(window.QuizContentLoaded) {
    initializeQuizControls();
    if (window.parent.QuizContentLoaded) {
        window.parent.QuizContentLoaded();
    }
    processSocialSharing();
}