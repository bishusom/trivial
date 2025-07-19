import { Resvg } from '@resvg/resvg-js';

export const handler = async (event) => {
  const { score, correct, total, category } = event.queryStringParameters;

  try {
    // 1. Fetch and convert logo to base64
    const logoResponse = await fetch('https://triviaah.com/imgs/triviaah-logo-200.webp');
    const logoBuffer = await logoResponse.arrayBuffer();
    const base64Logo = Buffer.from(logoBuffer).toString('base64');
    const logoDataUrl = `data:image/png;base64,${base64Logo}`;

    // 2. Create SVG with embedded logo
    const svg = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <style>text { font-family: Arial, sans-serif; }</style>
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
      
      <!-- Embedded logo -->
      <image href="${logoDataUrl}" x="50" y="50" height="100" preserveAspectRatio="xMidYMid meet"/>
      
      <!-- Rest of your SVG content -->
      <text x="600" y="180" font-size="60" font-weight="bold" fill="white" text-anchor="middle">Triviaah Results</text>
      <text x="600" y="280" font-size="48" fill="white" text-anchor="middle">Score: ${score}</text>
      <text x="600" y="350" font-size="48" fill="white" text-anchor="middle">${correct} out of ${total} correct</text>
      <text x="600" y="420" font-size="48" fill="white" text-anchor="middle">Category: ${decodeURIComponent(category)}</text>
      <line x1="240" y1="480" x2="960" y2="480" stroke="rgba(255, 255, 255, 0.5)" stroke-width="3"/>
      <text x="600" y="520" font-size="28" fill="white" text-anchor="middle">Play now at triviaah.com</text>
    </svg>
    `;

    // 3. Convert to PNG
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
    const pngBuffer = resvg.render().asPng();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'image/png' },
      body: pngBuffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('Error generating image:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate image' })
    };
  }
};