// /scripts/word-game.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Reuse Firebase config from index.html
const firebaseApp = window.firebase?.app();
const db = firebaseApp ? getDatabase() : null;

// Sound effects
const sounds = {
  correct: document.getElementById('correct-sound'),
  wrong: document.getElementById('wrong-sound'),
  win: document.getElementById('win-sound'),
  lose: document.getElementById('lose-sound'),
  hint: document.getElementById('hint-sound')
};

// Difficulty settings
const difficultySettings = {
  easy: { maxAttempts: 8, maxHints: 3, revealLetters: 2, timePerGuess: 90 },
  medium: { maxAttempts: 6, maxHints: 2, revealLetters: 1, timePerGuess: 60 },
  hard: { maxAttempts: 4, maxHints: 1, revealLetters: 0, timePerGuess: 30 }
};

// Game state
const wordState = {
  targetWord: '',
  category: '',
  difficulty: 'medium',
  attemptsLeft: 6,
  maxAttempts: 6,
  guesses: [],
  hintsUsed: 0,
  maxHints: 2,
  revealedLetters: [],
  timeLeft: 60,
  timer: null,
  isDailyChallenge: false
};

// Fetch words from Firebase or use fallback
async function fetchWords() {
  if (!db) {
    console.warn("Firebase not initialized. Using fallback words.");
    return {
      animal: { 
        easy: ['lion', 'frog', 'duck'],
        medium: ['zebra', 'panda'],
        hard: ['chameleon']
      },
      bird: {
        easy: ['crow', 'dove'],
        medium: ['eagle', 'heron'],
        hard: ['flamingo']
      }
    };
  }

  try {
    const snapshot = await get(ref(db, 'wordLists'));
    return snapshot.exists() ? snapshot.val() : fallbackWords;
  } catch (error) {
    console.error("Firebase fetch failed:", error);
    return fallbackWords;
  }
}

// Initialize game with words from Firebase
async function startNewGame(difficulty = 'medium') {
  const words = await fetchWords();
  wordState.difficulty = difficulty;
  const settings = difficultySettings[difficulty];

  // Apply difficulty
  wordState.maxAttempts = settings.maxAttempts;
  wordState.maxHints = settings.maxHints;
  wordState.timeLeft = settings.timePerGuess;

  // Select random category and word
  const categoryKeys = Object.keys(words);
  wordState.category = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
  const wordPool = words[wordState.category][difficulty];
  wordState.targetWord = wordPool[Math.floor(Math.random() * wordPool.length)];

  // Reset game state
  wordState.attemptsLeft = settings.maxAttempts;
  wordState.guesses = [];
  wordState.hintsUsed = 0;
  wordState.revealedLetters = [];

  // Reveal letters based on difficulty
  for (let i = 0; i < settings.revealLetters; i++) {
    const randomPos = Math.floor(Math.random() * wordState.targetWord.length);
    if (!wordState.revealedLetters.includes(randomPos)) {
      wordState.revealedLetters.push(randomPos);
    }
  }

  startTimer();
  updateWordGameUI();
  playSound('start'); // Optional start sound
}

// Sound effects
function playSound(type) {
  if (sounds[type] && !sounds[type].paused) sounds[type].currentTime = 0;
  sounds[type]?.play().catch(e => console.warn("Sound blocked:", e));
}

// Handle guess submission (with sounds)
function handleGuessSubmit() {
  const guess = guessInput.value.toLowerCase().trim();
  // ... (existing validation logic)

  if (guess === wordState.targetWord) {
    playSound('correct');
    playSound('win');
    feedback.textContent = '🎉 Correct!';
  } else if (wordState.attemptsLeft <= 0) {
    playSound('lose');
    feedback.textContent = 'Game Over!';
  } else {
    playSound('wrong');
    feedback.textContent = 'Try again!';
  }
}

// Hint with sound
function giveHint() {
  playSound('hint');
  // ... (existing hint logic)
}

// Initialize
async function initWordGame() {
  await fetchWords();
  setupDifficultyButtons();
  setupWordGameEvents();
  startNewGame();
}

export { initWordGame };