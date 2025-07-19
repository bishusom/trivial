const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { readFileSync } = require('fs');
const { join } = require('path');

// Fallback to pure JS canvas if @napi-rs fails
let canvasLib;
try {
  canvasLib = require('@napi-rs/canvas');
} catch (e) {
  console.warn('@napi-rs/canvas failed, falling back to canvas');
  canvasLib = require('canvas');
}

// Font buffer as fallback
let fontBuffer;
try {
  fontBuffer = readFileSync(join(__dirname, 'fonts', 'Arial.ttf'));
} catch (e) {
  console.warn('Could not load font file');
}

exports.handler = async (event) => {
  try {
    const { score, correct, total, category } = event.queryStringParameters;
    
    if (!score || !correct || !total || !category) {
      throw new Error('Missing required parameters');
    }

    const canvas = canvasLib.createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    // Register font if available
    if (fontBuffer && canvasLib.registerFont) {
      try {
        canvasLib.registerFont(join(__dirname, 'fonts', 'Arial.ttf'), { family: 'Arial' });
        console.log('Font registered successfully');
      } catch (e) {
        console.warn('Font registration failed:', e.message);
      }
    }

    // Gradient Background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#3498db');
    gradient.addColorStop(1, '#9b59b6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(26, 43, 60, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Logo
    try {
      const logo = await loadImage('https://triviaah.com/imgs/triviaah-logo-200.webp');
      const targetHeight = 100;
      const aspectRatio = logo.width / logo.height;
      const targetWidth = targetHeight * aspectRatio;
      ctx.drawImage(logo, 50, 50, targetWidth, targetHeight);
    } catch (e) {
      console.error('Error loading logo:', e);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Arial", sans-serif';
      ctx.fillText('TRIVIAAH', 50, 100);
    }

    // Text Content - with explicit fallbacks
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    
    // Title
    ctx.font = 'bold 60px "Arial", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Triviaah Results', canvas.width/2, 180);

    // Score details
    ctx.font = '48px "Arial", sans-serif';
    ctx.fillText(`Score: ${score}`, canvas.width/2, 280);
    ctx.fillText(`${correct} out of ${total} correct`, canvas.width/2, 350);
    ctx.fillText(`Category: ${decodeURIComponent(category)}`, canvas.width/2, 420);

    // Divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.2, 480);
    ctx.lineTo(canvas.width * 0.8, 480);
    ctx.stroke();

    // Footer
    ctx.font = '28px "Arial", sans-serif';
    ctx.fillText('Play now at triviaah.com', canvas.width/2, 520);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400'
      },
      body: canvas.toBuffer('image/png').toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('Image generation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        note: "Check logo URL and image generation",
        details: error.stack
      })
    };
  }
};