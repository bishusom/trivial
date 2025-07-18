const { createCanvas, loadImage } = require('@napi-rs/canvas');

exports.handler = async (event) => {
  try {
    const { score, correct, total, category } = event.queryStringParameters;
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    // 1. Background with better contrast
    ctx.fillStyle = '#1a2b3c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Gradient overlay (more subtle)
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#2980b9');
    gradient.addColorStop(1, '#6a3093');
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;

    // 3. Logo handling with error fallback
    try {
      const logo = await loadImage('https://triviaah.com/imgs/triviaah-logo-200.webp');
      // Maintain aspect ratio for logo
      const logoAspectRatio = logo.width / logo.height;
      const logoHeight = 100;
      const logoWidth = logoHeight * logoAspectRatio;
      ctx.drawImage(logo, 50, 50, logoWidth, logoHeight);
    } catch (e) {
      console.log('Logo failed to load, using text fallback');
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Arial';
      ctx.fillText('TRIVIAAH', 50, 100);
    }

    // 4. Text rendering with explicit font registration
    ctx.fillStyle = '#ffffff';
    
    // Main title
    ctx.font = 'bold 60px "Arial"';
    ctx.textAlign = 'center';
    ctx.fillText('Triviaah Results', canvas.width/2, 150);

    // Score details
    ctx.font = '48px "Arial"';
    ctx.fillText(`Score: ${score}`, canvas.width/2, 250);
    ctx.fillText(`${correct} out of ${total} correct`, canvas.width/2, 320);
    ctx.fillText(`Category: ${decodeURIComponent(category)}`, canvas.width/2, 390);

    // Divider line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(canvas.width/4, 450);
    ctx.lineTo((canvas.width/4)*3, 450);
    ctx.stroke();

    // Footer text
    ctx.font = '28px "Arial"';
    ctx.fillText('Play now at triviaah.com', canvas.width/2, 520);

    const buffer = canvas.toBuffer('image/png');
    
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
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      })
    };
  }
};