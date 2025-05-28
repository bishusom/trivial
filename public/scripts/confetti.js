export function showConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1000';
  document.body.appendChild(canvas);
  
  const confetti = window.confetti.create(canvas, {
    resize: true,
    useWorker: true
  });
  
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 }
  }).then(() => {
    setTimeout(() => {
      document.body.removeChild(canvas);
    }, 3000);
  });
}