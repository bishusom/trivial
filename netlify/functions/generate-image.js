// /netlify/functions/generate-image.js
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

exports.handler = async (event) => {
  try {
    // Parse query parameters
    const { score, correct, total, category } = event.queryStringParameters;
    
    // Create canvas
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#3498db');
    gradient.addColorStop(1, '#9b59b6');
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;
    
    // Load logo (make sure this exists in your site)
    const logo = await loadImage('https://triviaah.com/imgs/triviaah-logo-200.webp');
    ctx.drawImage(logo, 50, 50, 200, 200);
    
    // Add text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px "Arial"';
    ctx.textAlign = 'center';
    ctx.fillText('Trivia Master Results', canvas.width/2, 150);
    
    ctx.font = '48px "Arial"';
    ctx.fillText(`Score: ${score}`, canvas.width/2, 280);
    ctx.fillText(`${correct} out of ${total} correct`, canvas.width/2, 350);
    ctx.fillText(`Category: ${decodeURIComponent(category)}`, canvas.width/2, 420);
    
    // Add decorative elements
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(200, 500);
    ctx.lineTo(canvas.width - 200, 500);
    ctx.stroke();
    
    ctx.font = '32px "Arial"';
    ctx.fillText('Play now at triviaah.com', canvas.width/2, 550);
    
    // Convert to buffer
    const buffer = canvas.toBuffer('image/png');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};