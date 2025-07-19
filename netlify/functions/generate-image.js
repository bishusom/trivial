const { Resvg } = require('@resvg/resvg-js');
const fetch = require('node-fetch');

// Helper function to convert logo to Base64
async function getLogoBase64() {
  try {
    const response = await fetch('https://triviaah.com/imgs/triviaah-logo-200.webp');
    const buffer = await response.buffer();
    return `data:image/webp;base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error converting logo to Base64:', error);
    return ''; // Fallback empty string
  }
}

exports.handler = async (event) => {
  const { score, correct, total, category } = event.queryStringParameters;
  
  // Get Base64 logo (cached after first request)
  const logoBase64 = await getLogoBase64();
  
  const svg = `
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <!-- Gradient background -->
    <defs>
      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3498db"/>
        <stop offset="100%" stop-color="#9b59b6"/>
      </linearGradient>
      
      <!-- Embed Arial font -->
      <style>
        @font-face {
          font-family: 'Arial';
          src: url('file:///Arial.ttf');
          font-weight: normal;
        }
        @font-face {
          font-family: 'Arial';
          src: url('file:///Arial-Bold.ttf');
          font-weight: bold;
        }
      </style>
    </defs>
    
    <rect width="100%" height="100%" fill="url(#gradient)"/>
    <rect width="100%" height="100%" fill="rgba(26, 43, 60, 0.6)"/>
    
    <!-- Base64 logo -->
    ${logoBase64 ? `<image href="${logoBase64}" x="50" y="50" height="100"/>` : ''}
    
    <!-- Text content -->
    <text x="600" y="180" font-family="Arial" font-size="60" font-weight="bold" fill="white" text-anchor="middle">Triviaah Results</text>
    <text x="600" y="280" font-family="Arial" font-size="48" fill="white" text-anchor="middle">Score: ${score}</text>
    <text x="600" y="350" font-family="Arial" font-size="48" fill="white" text-anchor="middle">${correct} out of ${total} correct</text>
    <text x="600" y="420" font-family="Arial" font-size="48" fill="white" text-anchor="middle">Category: ${decodeURIComponent(category)}</text>
    
    <line x1="240" y1="480" x2="960" y2="480" stroke="rgba(255, 255, 255, 0.5)" stroke-width="3"/>
    <text x="600" y="520" font-family="Arial" font-size="28" fill="white" text-anchor="middle">Play now at triviaah.com</text>
  </svg>
  `;

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      loadSystemFonts: false,
      fontDirs: ['./fonts'],
      defaultFontFamily: 'Arial'
    }
  });

  const pngBuffer = resvg.render().asPng();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'image/png' },
    body: pngBuffer.toString('base64'),
    isBase64Encoded: true
  };
};