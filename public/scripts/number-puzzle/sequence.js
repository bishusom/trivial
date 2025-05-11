export function initPuzzle() {
    const sequenceDisplay = document.getElementById('sequence-display');
    const sequenceOptions = document.getElementById('sequence-options');
    const sequenceFeedback = document.getElementById('sequence-feedback');
    const hintText = document.getElementById('hint-text');
    const sequenceHint = document.getElementById('sequence-hint');
    const sequenceNext = document.getElementById('sequence-next');
    const sequenceNew = document.getElementById('sequence-new');
    const sequenceLevel = document.getElementById('sequence-level');
    const sequenceScore = document.getElementById('sequence-score');
    
    let currentSequence = [];
    let correctAnswer = 0;
    let level = 1;
    let score = 0;
    let sequencesSolved = 0;
    let timeoutId = null;
    

    function trackEvent(action, category, label, value) {
        if (typeof gtag !== 'undefined') {
            gtag('event', action, { event_category: category, event_label: label, value: value });
        }
    }

    // Initialize the game
    initGame();
    
    function initGame() {
        // Clear any pending timeout when starting a new game manually
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        level = 1;
        score = 0;
        sequencesSolved = 0;
        updateStats();
        generateSequence();
        trackEvent('sequence_started','number_sequence',1)
    }
    
    // Sequence generation functions
    function generateArithmeticSequence() {
        const start = Math.floor(Math.random() * 10) + 1;
        const difference = Math.floor(Math.random() * 6) + 2;
        const length = Math.floor(Math.random() * 3) + 4; // 4-6 numbers
        console.log('length',length);
        const sequence = [];
        for (let i = 0; i < length; i++) {
            sequence.push(start + i * difference);
        }
        console.log('sequence',sequence);
        return {
            sequence: sequence.slice(0, -1), // Show all but last
            answer: sequence[sequence.length - 1],
            description: `Arithmetic sequence: add ${difference} each time`
        };
    }
    
    function generateGeometricSequence() {
        const start = Math.floor(Math.random() * 5) + 1;
        const ratio = Math.floor(Math.random() * 3) + 2;
        const length = Math.floor(Math.random() * 3) + 4;
        
        const sequence = [];
        for (let i = 0; i < length; i++) {
            sequence.push(start * Math.pow(ratio, i));
        }
        
        return {
            sequence: sequence.slice(0, -1),
            answer: sequence[sequence.length - 1],
            description: `Geometric sequence: multiply by ${ratio} each time`
        };
    }
    
    function generateSquareSequence() {
        const start = Math.floor(Math.random() * 5) + 1;
        const length = Math.floor(Math.random() * 3) + 4;
        
        const sequence = [];
        for (let i = 0; i < length; i++) {
            sequence.push(Math.pow(start + i, 2));
        }
        
        return {
            sequence: sequence.slice(0, -1),
            answer: sequence[sequence.length - 1],
            description: `Square numbers: n² where n starts at ${start}`
        };
    }
    
    function generatePrimeSequence() {
        const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
        const start = Math.floor(Math.random() * 4);
        const length = Math.floor(Math.random() * 3) + 4;
        
        const sequence = primes.slice(start, start + length);
        
        return {
            sequence: sequence.slice(0, -1),
            answer: sequence[sequence.length - 1],
            description: `Prime number sequence`
        };
    }
    
    function generateFibonacciLikeSequence() {
        const a = Math.floor(Math.random() * 5) + 1;
        const b = Math.floor(Math.random() * 5) + 1;
        const length = Math.floor(Math.random() * 3) + 5;
        
        const sequence = [a, b];
        for (let i = 2; i < length; i++) {
            sequence.push(sequence[i-1] + sequence[i-2]);
        }
        
        return {
            sequence: sequence.slice(0, -1),
            answer: sequence[sequence.length - 1],
            description: `Fibonacci-like sequence: each number is the sum of the two preceding ones`
        };
    }
    
    function generateMixedSequence() {
        // Only select from moderate or complex sequences for higher difficulty
        const types = [
            generateSquareSequence,        // Tier 2
            generatePrimeSequence,         // Tier 2
            generateFibonacciLikeSequence  // Tier 3
        ];
        
        return types[Math.floor(Math.random() * types.length)]();
    }
    
    function generateSequence() {
        // Clear previous
        sequenceDisplay.innerHTML = '';
        sequenceOptions.innerHTML = '';
        sequenceFeedback.textContent = '';
        hintText.textContent = '';
    
        // Sequence types by difficulty tiers
        const sequenceTypes = [
            generateArithmeticSequence, // Tier 1
            generateGeometricSequence,  // Tier 1
            generateSquareSequence,     // Tier 2
            generatePrimeSequence,      // Tier 2
            generateFibonacciLikeSequence, // Tier 3
            generateMixedSequence       // Tier 3
        ];
    
        // Determine sequence type based on level
        let typeIndex;
        if (level <= 2) {
            // Levels 1-2: Only Tier 1 (arithmetic, geometric)
            typeIndex = Math.floor(Math.random() * 2); // 0 or 1
        } else if (level <= 4) {
            // Levels 3-4: 70% Tier 1, 30% Tier 2
            typeIndex = Math.random() < 0.7 ? Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2); // 0, 1, 2, or 3
        } else if (level <= 6) {
            // Levels 5-6: 50% Tier 2, 30% Tier 1, 20% Tier 3
            const rand = Math.random();
            if (rand < 0.5) {
                typeIndex = 2 + Math.floor(Math.random() * 2); // 2 or 3
            } else if (rand < 0.8) {
                typeIndex = Math.floor(Math.random() * 2); // 0 or 1
            } else {
                typeIndex = 4 + Math.floor(Math.random() * 2); // 4 or 5
            }
        } else {
            // Levels 7+: 60% Tier 3, 30% Tier 2, 10% Tier 1
            const rand = Math.random();
            if (rand < 0.6) {
                typeIndex = 4 + Math.floor(Math.random() * 2); // 4 or 5
            } else if (rand < 0.9) {
                typeIndex = 2 + Math.floor(Math.random() * 2); // 2 or 3
            } else {
                typeIndex = Math.floor(Math.random() * 2); // 0 or 1
            }
        }
    
        const { sequence, answer, description } = sequenceTypes[typeIndex]();
        
        currentSequence = sequence;
        correctAnswer = answer;
        
        // Display the sequence
        sequence.forEach((num, index) => {
            const numElement = document.createElement('span');
            numElement.className = 'sequence-number';
            numElement.textContent = num;
            sequenceDisplay.appendChild(numElement);
        });
        const lastElement = document.createElement('span');
        lastElement.className = 'sequence-number missing';
        lastElement.textContent = '?';
        sequenceDisplay.appendChild(lastElement);
    
        // Generate options (3 wrong, 1 correct)
        const options = generateOptions(answer);
        options.forEach((option, index) => {
            const optionBtn = document.createElement('button');
            optionBtn.className = 'btn';
            optionBtn.textContent = option;
            optionBtn.addEventListener('click', () => checkAnswer(option));
            sequenceOptions.appendChild(optionBtn);
        });
        
        // Store description for hints
        hintText.dataset.description = description;
    }
    
    function generateOptions(correctAnswer) {
        console.log('correctAnswer',correctAnswer);
        const options = [correctAnswer];
        
        // Generate 3 wrong answers
        while (options.length < 4) {
            let wrongAnswer;
            const variation = Math.floor(Math.random() * 3) + 1;
            
            switch (variation) {
                case 1:
                    wrongAnswer = correctAnswer + (Math.floor(Math.random() * 5)) + 1;
                    break;
                case 2:
                    wrongAnswer = correctAnswer - (Math.floor(Math.random() * 5)) + 1;
                    break;
                case 3:
                    wrongAnswer = correctAnswer * (Math.floor(Math.random() * 2)) + 1;
                    break;
            }
            
            // Ensure wrong answer is positive and unique
            if (wrongAnswer > 0 && !options.includes(wrongAnswer)) {
                options.push(wrongAnswer);
            }
        }
        
        // Shuffle options
        return options.sort(() => Math.random() - 0.5);
    }
    
    function checkAnswer(selected) {
        if (parseInt(selected) === correctAnswer) {
            sequenceFeedback.textContent = 'Correct! Well done!';
            sequenceFeedback.className = 'sequence-feedback correct';
            
            score += level * 10;
            sequencesSolved++;
            
            if (sequencesSolved >= 3) {
                level++;
                sequencesSolved = 0;
            }
            
            updateStats();
            
            document.querySelectorAll('#sequence-options button').forEach(btn => {
                btn.disabled = true;
                if (parseInt(btn.textContent) === correctAnswer) {
                    btn.classList.add('correct');
                }
            });
            
            // Start a new game after 2.5 seconds
            timeoutId = setTimeout(() => {
                generateSequence();
                timeoutId = null;
            }, 2500);
            
        } else {
            sequenceFeedback.textContent = `Incorrect. Try again!`;
            sequenceFeedback.className = 'sequence-feedback wrong';
            
            document.querySelectorAll('#sequence-options button').forEach(btn => {
                if (btn.textContent === selected) {
                    btn.classList.add('wrong');
                }
            });
        }
    }
    
    function showHint() {
        hintText.textContent = hintText.dataset.description;
    }
    
    function updateStats() {
        sequenceLevel.textContent = `Level: ${level}`;
        sequenceScore.textContent = `Score: ${score}`;
    }
    
    // Event listeners
    sequenceHint.addEventListener('click', showHint);
    sequenceNext.addEventListener('click', generateSequence);
    sequenceNext.addEventListener('click', () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        generateSequence();
    });
    sequenceNew.addEventListener('click', initGame);
}