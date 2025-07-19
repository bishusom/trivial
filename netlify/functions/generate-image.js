const { createCanvas, loadImage } = require('@napi-rs/canvas');

exports.handler = async (event) => {
  try {
    const { score, correct, total, category } = event.queryStringParameters;
    
    // Validate parameters
    if (!score || !correct || !total || !category) {
      throw new Error('Missing required parameters');
    }

    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    // 1. Gradient Background (blue to purple)
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#3498db');
    gradient.addColorStop(1, '#9b59b6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Semi-transparent overlay
    ctx.fillStyle = 'rgba(26, 43, 60, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Logo
    try {
      const logo = await loadImage('https://triviaah.com/imgs/triviaah-logo-200.webp');
      const targetHeight = 100;
      const aspectRatio = logo.width / logo.height;
      const targetWidth = targetHeight * aspectRatio;
      ctx.drawImage(logo, 50, 50, targetWidth, targetHeight);
    } catch (e) {
      console.error('Error loading logo:', e);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('TRIVIAAH', 50, 100);
    }

    // 4. Text Content with system fonts
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    
    // Title
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Triviaah Results', canvas.width/2, 180);

    // Score details
    ctx.font = '48px sans-serif';
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
    ctx.font = '28px sans-serif';
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