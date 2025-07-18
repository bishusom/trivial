const { createCanvas, loadImage } = require('@napi-rs/canvas');

exports.handler = async (event) => {
  try {
    const { score, correct, total, category } = event.queryStringParameters;
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

    // 3. Logo with perfect dimensions (200px height, proportional width)
    try {
      const logo = await loadImage('https://triviaah.com/imgs/triviaah-logo-200.webp');
      
      // Logo dimensions calculation
      const targetHeight = 100; // Your preferred height
      const aspectRatio = logo.width / logo.height;
      const targetWidth = targetHeight * aspectRatio;
      
      // Position (50px from top/left)
      const logoX = 50;
      const logoY = 50;
      
      ctx.drawImage(logo, logoX, logoY, targetWidth, targetHeight);
    } catch (e) {
      // Fallback text if logo fails
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Arial';
      ctx.fillText('TRIVIAAH', 50, 100);
    }

    // 4. Text Content (unchanged from working version)
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    
    // Title (positioned below logo)
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Triviaah Results', canvas.width/2, 180);

    // Score details
    ctx.font = '48px Arial';
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
    ctx.font = '28px Arial';
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
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        note: "Check logo URL and image generation"
      })
    };
  }
};