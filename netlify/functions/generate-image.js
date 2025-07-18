const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// Register fallback fonts (must be before handler)
GlobalFonts.registerFromPath(
  require.resolve('@napi-rs/canvas/assets/arial.ttf'),
  'Arial'
);

exports.handler = async (event) => {
  try {
    const { score, correct, total, category } = event.queryStringParameters;
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#1a2b3c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#2980b9');
    gradient.addColorStop(1, '#6a3093');
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;

    // Logo
    try {
      const logo = await loadImage('https://triviaah.com/imgs/triviaah-logo-200.webp');
      const logoHeight = 100;
      const logoWidth = logo.height ? logoHeight * (logo.width/logo.height) : logoHeight;
      ctx.drawImage(logo, 50, 50, logoWidth, logoHeight);
    } catch (e) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '36px Arial';
      ctx.fillText('TRIVIAAH', 50, 100);
    }

    // Text Rendering with Fallbacks
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top'; // Ensure consistent text positioning

    // Title with explicit font stack
    ctx.font = 'bold 60px "Arial", "Liberation Sans", "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Triviaah Results', canvas.width/2, 150);

    // Score details with simpler font
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

    // Footer
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