const sharp = require('sharp');

exports.handler = async (event) => {
  try {
    const { score, correct, total, category } = event.queryStringParameters || {};

    if (!score || !correct || !total || !category) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required parameters" }),
      };
    }

    // 1. Generate SVG
    const svg = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#3498db" />
            <stop offset="100%" stop-color="#9b59b6" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#gradient)" />
        <rect width="100%" height="100%" fill="rgba(26, 43, 60, 0.6)" />
        
        <!-- Logo (fallback to text if URL fails) -->
        <image href="https://triviaah.com/imgs/triviaah-logo-200.webp" x="50" y="50" height="100" />
        
        <!-- Text -->
        <text x="50%" y="220" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="#ffffff" text-anchor="middle">Triviaah Results</text>
        <text x="50%" y="320" font-family="Arial, sans-serif" font-size="48" fill="#ffffff" text-anchor="middle">Score: ${score}</text>
        <text x="50%" y="390" font-family="Arial, sans-serif" font-size="48" fill="#ffffff" text-anchor="middle">${correct} out of ${total} correct</text>
        <text x="50%" y="460" font-family="Arial, sans-serif" font-size="48" fill="#ffffff" text-anchor="middle">Category: ${decodeURIComponent(category)}</text>
        <line x1="240" y1="500" x2="960" y2="500" stroke="rgba(255, 255, 255, 0.5)" stroke-width="3" />
        <text x="50%" y="550" font-family="Arial, sans-serif" font-size="28" fill="#ffffff" text-anchor="middle">Play now at triviaah.com</text>
      </svg>
    `;

    // 2. Convert SVG to PNG
    const pngBuffer = await sharp(Buffer.from(svg)).toFormat('png').toBuffer();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: pngBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Image generation failed",
        details: error.message,
      }),
    };
  }
};