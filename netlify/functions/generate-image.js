const sharp = require('sharp');

// Base64-encoded fallback logo (1x1 transparent pixel as placeholder)
const FALLBACK_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

exports.handler = async (event) => {
  try {
    const { score, correct, total, category } = event.queryStringParameters || {};
    
    // Validate parameters
    if (!score || !correct || !total || !category) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required parameters" }),
      };
    }

    // Use system fonts that work on Linux (Netlify's environment)
    const fontFamily = 'DejaVu Sans, Liberation Sans, sans-serif';
    
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
      
      <!-- Logo with fallback -->
      <image href="https://triviaah.com/imgs/triviaah-logo-200.webp" 
             x="50" y="50" height="100" 
             preserveAspectRatio="xMidYMid meet"
             onerror="this.href='${FALLBACK_LOGO}';this.height=100"/>
      
      <!-- Text content with Linux-compatible fonts -->
      <text x="600" y="180" font-family="${fontFamily}" font-size="60" font-weight="bold" 
            fill="white" text-anchor="middle">Triviaah Results</text>
      <text x="600" y="280" font-family="${fontFamily}" font-size="48" 
            fill="white" text-anchor="middle">Score: ${score}</text>
      <text x="600" y="350" font-family="${fontFamily}" font-size="48" 
            fill="white" text-anchor="middle">${correct} out of ${total} correct</text>
      <text x="600" y="420" font-family="${fontFamily}" font-size="48" 
            fill="white" text-anchor="middle">Category: ${decodeURIComponent(category)}</text>
      
      <!-- Divider line -->
      <line x1="240" y1="480" x2="960" y2="480" 
            stroke="rgba(255, 255, 255, 0.5)" stroke-width="3"/>
      
      <!-- Footer -->
      <text x="600" y="520" font-family="${fontFamily}" font-size="28" 
            fill="white" text-anchor="middle">Play now at triviaah.com</text>
    </svg>
    `;

    // Convert SVG to PNG
    const pngBuffer = await sharp(Buffer.from(svg))
      .png({ quality: 90 }) // Optimize quality
      .toBuffer();

    // For local testing (comment out in production)
    // require('fs').writeFileSync('debug-output.png', pngBuffer);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400'
      },
      body: pngBuffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('Generation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Image generation failed",
        details: error.message
      })
    };
  }
};