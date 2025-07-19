exports.handler = async (event) => {
  const { score, correct, total, category } = event.queryStringParameters;
  
  // Using direct URL (no base64 required)
  const logoUrl = 'https://triviaah.com/imgs/triviaah-logo-200.webp';
  
  const svg = `
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <!-- Gradient background -->
    <defs>
      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3498db"/>
        <stop offset="100%" stop-color="#9b59b6"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#gradient)"/>
    
    <!-- Semi-transparent overlay -->
    <rect width="100%" height="100%" fill="rgba(26, 43, 60, 0.6)"/>
    
    <!-- Logo (using direct URL) -->
    <image href="${logoUrl}" x="50" y="50" height="100" preserveAspectRatio="xMidYMid meet"/>
    
    <!-- Text content -->
    <text x="600" y="180" font-family="Arial" font-size="60" font-weight="bold" fill="white" text-anchor="middle">Triviaah Results</text>
    <text x="600" y="280" font-family="Arial" font-size="48" fill="white" text-anchor="middle">Score: ${score}</text>
    <text x="600" y="350" font-family="Arial" font-size="48" fill="white" text-anchor="middle">${correct} out of ${total} correct</text>
    <text x="600" y="420" font-family="Arial" font-size="48" fill="white" text-anchor="middle">Category: ${decodeURIComponent(category)}</text>
    
    <!-- Divider line -->
    <line x1="240" y1="480" x2="960" y2="480" stroke="rgba(255, 255, 255, 0.5)" stroke-width="3"/>
    
    <!-- Footer -->
    <text x="600" y="520" font-family="Arial" font-size="28" fill="white" text-anchor="middle">Play now at triviaah.com</text>
  </svg>
  `;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400'
    },
    body: svg
  };
};