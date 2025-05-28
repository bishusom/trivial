const soundFiles = {
  victory: '/audio/victory.mp3',
  click: '/audio/click.mp3',
  error: '/audio/error.mp3'
};

const audioCache = {};

export function playSound(type) {
  if (!soundFiles[type]) return;
  
  // Cache audio objects
  if (!audioCache[type]) {
    audioCache[type] = new Audio(soundFiles[type]);
  }
  
  try {
    audioCache[type].currentTime = 0;
    audioCache[type].play();
  } catch (e) {
    console.error('Error playing sound:', e);
  }
}