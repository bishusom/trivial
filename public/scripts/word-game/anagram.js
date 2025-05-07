import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD476kdtlngttCBw6vMnc73QWA7P1OnHdg",
    authDomain: "triviaahdb.firebaseapp.com",
    projectId: "triviaahdb",
    storageBucket: "triviaahdb.appspot.com",
    messagingSenderId: "758082588437",
    appId: "1:758082588437:web:9eada609e974b9e458631c",
    measurementId: "G-ZT8Q78QYDQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export function initWordGame() {
    console.log('Initializing Anagram game');
    
    // Game state
    let baseWord = '';
    let scrambledLetters = [];
    let currentWord = [];
    let foundWords = [];
    let score = 0;
    let allPossibleWords = [];
    let usedBaseWords = [];
    let autoStartTimeout = null;
    
    // DOM elements
    const scrambledLettersEl = document.getElementById('scrambled-letters');
    const currentAttemptEl = document.getElementById('current-attempt');
    const submitBtn = document.getElementById('anagram-submit');
    const clearBtn = document.getElementById('anagram-clear');
    const shuffleBtn = document.getElementById('anagram-shuffle');
    const newBtn = document.getElementById('anagram-new');
    const hintBtn = document.getElementById('anagram-hint');
    const revealBtn = document.getElementById('anagram-reveal'); // New: Reveal button
    const feedbackEl = document.getElementById('anagram-feedback');
    const targetEl = document.getElementById('anagram-target');
    const scoreEl = document.getElementById('anagram-score');
    const solutionsList = document.getElementById('solutions-list');
    
    // Helper functions
    function scrambleWord(word) {
        return word.split('').sort(() => Math.random() - 0.5).join('');
    }
    
    function canFormWord(baseWord, word) {
        const baseLetters = baseWord.split('');
        const wordLetters = word.split('');
        
        for (const letter of wordLetters) {
            const index = baseLetters.indexOf(letter);
            if (index === -1) return false;
            baseLetters.splice(index, 1);
        }
        return true;
    }
    
    function generateLocalPossibleWords(baseWord) {
        const words = new Set();
        words.add(baseWord);
        
        const commonSubstrings = ['ATE', 'EAT', 'TEA', 'TAN', 'NET', 'RAT', 'ART'];
        commonSubstrings.forEach(sub => {
            if (baseWord.includes(sub)) words.add(sub);
        });
        
        return Array.from(words);
    }
    
    async function generatePossibleWords(baseWord) {
        try {
            const wordsRef = collection(db, "dictionary");
            const q = query(
                wordsRef,
                where("letters", "array-contains", baseWord[0]),
                where("length", "<=", baseWord.length),
                where("length", ">=", 3)
            );
            
            const querySnapshot = await getDocs(q);
            const possibleWords = new Set();
            
            possibleWords.add(baseWord);
            
            querySnapshot.forEach((doc) => {
                const word = doc.data().word.toUpperCase();
                if (canFormWord(baseWord, word)) {
                    possibleWords.add(word);
                }
            });
            
            return Array.from(possibleWords) || [];
            
        } catch (error) {
            console.error("Error fetching possible words:", error);
            return generateLocalPossibleWords(baseWord);
        }
    }
    
    async function debugFirestore() {
        try {
            const wordsRef = collection(db, "dictionary");
            const snapshot = await getDocs(wordsRef);
            console.log("Total documents:", snapshot.size);
            snapshot.forEach(doc => {
                console.log("Document:", doc.id, "=>", doc.data());
            });
        } catch (error) {
            console.error("Debug error:", error);
        }
    }
    
    async function initGame() {
        try {
            if (autoStartTimeout) {
                clearTimeout(autoStartTimeout);
                autoStartTimeout = null;
            }
            
            const wordsRef = collection(db, "dictionary");
            const q = query(
                wordsRef, 
                where("length", "==", 8),
                where("isCommon", "==", true),
                limit(10)
            );
            
            const querySnapshot = await getDocs(q);
            let wordList = [];
            
            querySnapshot.forEach((doc) => {
                const word = doc.data().word.toUpperCase();
                if (!usedBaseWords.includes(word)) {
                    wordList.push(word);
                }
            });
            
            if (wordList.length === 0) {
                throw new Error("No unused words found in database");
            }
            
            baseWord = wordList[Math.floor(Math.random() * wordList.length)];
            usedBaseWords.push(baseWord);
            scrambledLetters = scrambleWord(baseWord).split('');
            foundWords = [];
            score = 0;
            currentWord = [];
            
            allPossibleWords = await generatePossibleWords(baseWord);
            console.log('All possible words:', allPossibleWords);
            
            renderLetters();
            updateCurrentAttempt();
            updateFoundWords();
            targetEl.textContent = `Word Length: ${baseWord.length}`;
            scoreEl.textContent = `Score: ${score}`;
            feedbackEl.textContent = '';
            feedbackEl.className = 'anagram-feedback';
            
        } catch (error) {
            console.error("Error initializing game:", error);
            const localWordList = [
                'CREATION', 'REACTION', 'EDUCATION', 'GENERATE', 
                'TEAMWORK', 'NOTEBOOK', 'KEYBOARD', 'MONITOR'
            ].filter(word => !usedBaseWords.includes(word));
            
            if (localWordList.length === 0) {
                console.warn("No unused words available in fallback list. Resetting used words.");
                usedBaseWords = [];
                localWordList.push(...[
                    'CREATION', 'REACTION', 'EDUCATION', 'GENERATE', 
                    'TEAMWORK', 'NOTEBOOK', 'KEYBOARD', 'MONITOR'
                ]);
            }
            
            baseWord = localWordList[Math.floor(Math.random() * localWordList.length)];
            usedBaseWords.push(baseWord);
            scrambledLetters = scrambleWord(baseWord).split('');
            foundWords = [];
            score = 0;
            currentWord = [];
            allPossibleWords = generateLocalPossibleWords(baseWord);
            
            renderLetters();
            updateCurrentAttempt();
            updateFoundWords();
            targetEl.textContent = `Word Length: ${baseWord.length}`;
            scoreEl.textContent = `Score: ${score}`;
            feedbackEl.textContent = '';
            feedbackEl.className = 'anagram-feedback';
        }
    }
    
    function renderLetters() {
        scrambledLettersEl.innerHTML = '';
        scrambledLetters.forEach((letter, index) => {
            const tile = document.createElement('div');
            tile.className = `letter-tile ${currentWord.includes(index) ? 'used' : ''}`;
            tile.textContent = letter;
            tile.dataset.index = index;
            tile.addEventListener('click', () => selectLetter(index));
            scrambledLettersEl.appendChild(tile);
        });
    }
    
    function selectLetter(index) {
        if (currentWord.includes(index)) return;
        currentWord.push(index);
        updateCurrentAttempt();
        renderLetters();
    }
    
    function updateCurrentAttempt() {
        currentAttemptEl.innerHTML = '';
        currentWord.forEach(index => {
            const letter = document.createElement('span');
            letter.textContent = scrambledLetters[index];
            currentAttemptEl.appendChild(letter);
        });
    }
    
    function submitWord() {
        if (currentWord.length === 0) {
            showFeedback('error', 'Please select some letters first');
            return;
        }
        
        const word = currentWord.map(index => scrambledLetters[index]).join('');
        
        if (word.length < 3) {
            showFeedback('error', 'Word must be at least 3 letters');
            return;
        }
        
        if (foundWords.includes(word)) {
            showFeedback('error', 'You already found this word');
            return;
        }
        
        const validWords = Array.isArray(allPossibleWords) ? allPossibleWords : [];
        if (validWords.includes(word)) {
            foundWords.push(word);
            score += calculateScore(word);
            showFeedback('success', `Correct! +${calculateScore(word)} points`);
            updateFoundWords();
            scoreEl.textContent = `Score: ${score}`;
            clearCurrentAttempt();
            
            if (autoStartTimeout) {
                clearTimeout(autoStartTimeout);
            }
            autoStartTimeout = setTimeout(() => {
                initGame();
                autoStartTimeout = null;
            }, 2500);
        } else {
            showFeedback('error', 'Not a valid word');
        }
    }
    
    function calculateScore(word) {
        return word.length * 5;
    }
    
    function clearCurrentAttempt() {
        currentWord = [];
        updateCurrentAttempt();
        renderLetters();
    }
    
    function shuffleLetters() {
        scrambledLetters = scrambleWord(baseWord).split('');
        renderLetters();
    }
    
    function showHint() {
        const validWords = Array.isArray(allPossibleWords) ? allPossibleWords : [];
        const remainingWords = validWords.filter(word => !foundWords.includes(word));
        
        if (remainingWords.length > 0) {
            const hint = remainingWords[0].split('').slice(0, 2).join('');
            showFeedback('info', `Try starting with: ${hint}...`);
        } else {
            showFeedback('info', 'You found all possible words!');
        }
    }
    
    function revealWord() {
        showFeedback('info', `The word was: ${baseWord}`);
        if (autoStartTimeout) {
            clearTimeout(autoStartTimeout);
        }
        autoStartTimeout = setTimeout(() => {
            initGame();
            autoStartTimeout = null;
        }, 2500);
    }
    
    function updateFoundWords() {
        solutionsList.innerHTML = '';
        foundWords.sort((a, b) => b.length - a.length).forEach(word => {
            const wordEl = document.createElement('div');
            wordEl.className = 'solution-word';
            wordEl.textContent = word;
            solutionsList.appendChild(wordEl);
        });
    }
    
    function showFeedback(type, message) {
        feedbackEl.textContent = message;
        feedbackEl.className = `anagram-feedback ${type}`;
    }
    
    // Event listeners
    submitBtn.addEventListener('click', submitWord);
    clearBtn.addEventListener('click', clearCurrentAttempt);
    shuffleBtn.addEventListener('click', shuffleLetters);
    newBtn.addEventListener('click', initGame);
    hintBtn.addEventListener('click', showHint);
    revealBtn.addEventListener('click', revealWord); // New: Reveal button listener
    
    // Start the game
    initGame();
}