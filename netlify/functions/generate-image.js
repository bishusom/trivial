const { createCanvas, loadImage } = require('canvas');
const path = require('path');

exports.handler = async (event) => {
  try {
    const { score, correct, total, category } = event.queryStringParameters;
    
    // Validate parameters
    if (!score || !correct || !total || !category) {
      throw new Error('Missing required parameters');
    }

    // Log parameters for debugging
    console.log('Parameters:', { score, correct, total, category });

    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    // 1. Gradient Background (blue to purple)
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#3498db');
    gradient.addColorStop(1, '#9b59b6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Logo
    try {
      const logo = await loadImage('https://triviaah.com/imgs/triviaah-logo-200.webp');
      const targetHeight = 100;
      const aspectRatio = logo.width / logo.height;
      const targetWidth = targetHeight * aspectRatio;
      ctx.drawImage(logo, 50, 50, targetWidth, targetHeight);
      console.log('Logo drawn successfully');
    } catch (e) {
      console.error('Error loading logo:', e);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('TRIVIAAH', 50, 50);
      console.log('Fallback logo text drawn');
    }

    // 3. Text Content with system fonts and explicit context
    ctx.save(); // Save context state for text rendering
    ctx.fillStyle = '#ffffff'; // White text for visibility
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';

    // Title
    ctx.font = 'bold 60px sans-serif';
    console.log('Drawing title with font:', ctx.font);
    ctx.fillText('Triviaah Results', canvas.width / 2, 180);
    console.log('Title drawn');

    // Score details
    ctx.font = '48px sans-serif';
    console.log('Drawing score with font:', ctx.font);
    ctx.fillText(`Score: ${score}`, canvas.width / 2, 280);
    console.log('Score drawn');

    ctx.fillText(`${correct} out of ${total} correct`, canvas.width / 2, 350);
    console.log('Correct/total drawn');

    ctx.fillText(`Category: ${decodeURIComponent(category)}`, canvas.width / 2, 420);
    console.log('Category drawn');

    // Divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.2, 480);
    ctx.lineTo(canvas.width * 0.8, 480);
    ctx.stroke();
    console.log('Divider line drawn');

    // Footer
    ctx.font = '28px sans-serif';
    console.log('Drawing footer with font:', ctx.font);
    ctx.fillText('Play now at triviaah.com', canvas.width / 2, 520);
    console.log('Footer drawn');
    ctx.restore(); // Restore context state

    // 4. Semi-transparent overlay (applied after text)
    ctx.fillStyle = 'rgba(26, 43, 60, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Return the image
    const buffer = canvas.toBuffer('image/png');
    console.log('Image buffer created, size:', buffer.length);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400'
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('Image generation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        note: 'Check logo URL, font rendering, and canvas operations',
        details: error.stack
      })
    };
  }
};