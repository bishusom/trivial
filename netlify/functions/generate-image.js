const sharp = require('sharp');

exports.handler = async (event) => {
  try {
    const { score, correct, total, category } = event.queryStringParameters || {};
    if (!score || !correct || !total || !category) {
      return { statusCode: 400, body: "Missing parameters" };
    }

    const fontFamily = 'DejaVu Sans, sans-serif'; // Simplified for Netlify
    const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3498db"/>
          <stop offset="100%" stop-color="#9b59b6"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#gradient)"/>
      <rect width="100%" height="100%" fill="rgba(26, 43, 60, 0.6)"/>
      <text x="600" y="180" font-family="${fontFamily}" font-size="60" fill="white" text-anchor="middle">Triviaah Results</text>
      <text x="600" y="280" font-family="${fontFamily}" font-size="48" fill="white" text-anchor="middle">Score: ${score}</text>
      <text x="600" y="350" font-family="${fontFamily}" font-size="48" fill="white" text-anchor="middle">${correct}/${total} correct</text>
      <text x="600" y="420" font-family="${fontFamily}" font-size="48" fill="white" text-anchor="middle">Category: ${decodeURIComponent(category)}</text>
      <line x1="240" y1="480" x2="960" y2="480" stroke="rgba(255,255,255,0.5)" stroke-width="3"/>
      <text x="600" y="520" font-family="${fontFamily}" font-size="28" fill="white" text-anchor="middle">triviaah.com</text>
    </svg>
    `;

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'image/png' },
      body: pngBuffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    return { statusCode: 500, body: "Generation failed: " + error.message };
  }
};