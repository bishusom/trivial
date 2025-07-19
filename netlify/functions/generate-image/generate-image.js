const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

exports.handler = async (event) => {
  try {
    const { score, correct, total, category } = event.queryStringParameters;
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    // Background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#3498db');
    gradient.addColorStop(1, '#9b59b6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(26, 43, 60, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Logo
    try {
      const response = await axios.get('https://triviaah.com/imgs/triviaah-logo-200.webp', {
        responseType: 'arraybuffer'
      });
      const logo = await loadImage(response.data);
      ctx.drawImage(logo, 50, 50, 200, 100); // Fixed size for simplicity
    } catch (e) {
      console.error('Logo load failed:', e);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Arial';
      ctx.fillText('TRIVIAAH', 50, 100);
    }

    // Text - Using system fonts with fallbacks
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    
    // Title
    ctx.font = 'bold 60px "Arial", sans-serif';
    ctx.fillText('Triviaah Results', canvas.width/2, 180);
    
    // Other text
    ctx.font = '48px "Arial", sans-serif';
    ctx.fillText(`Score: ${score}`, canvas.width/2, 280);
    ctx.fillText(`${correct} out of ${total} correct`, canvas.width/2, 350);
    ctx.fillText(`Category: ${decodeURIComponent(category)}`, canvas.width/2, 420);

    // Divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(240, 480);
    ctx.lineTo(960, 480);
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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};