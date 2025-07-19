const { Canvas } = require('canvas-constructor');
const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    const { score, correct, total, category } = event.queryStringParameters;
    
    if (!score || !correct || !total || !category) {
      throw new Error('Missing required parameters');
    }

    // Load logo image
    let logo;
    try {
      const response = await fetch('https://triviaah.com/imgs/triviaah-logo-200.webp');
      logo = await response.buffer();
    } catch (e) {
      console.error('Error loading logo:', e);
      logo = null;
    }

    // Create image
    const image = new Canvas(1200, 630)
      // Gradient background
      .createLinearGradient(0, 0, 1200, 630)
      .addColorStop(0, '#3498db')
      .addColorStop(1, '#9b59b6')
      .setColorGradient()
      .printRectangle(0, 0, 1200, 630)
      
      // Semi-transparent overlay
      .setColor('rgba(26, 43, 60, 0.6)')
      .printRectangle(0, 0, 1200, 630)
      
      // Logo (if loaded)
      .printImage(logo, 50, 50, 100, 100)
      
      // Title
      .setTextAlign('center')
      .setColor('#ffffff')
      .setTextFont('bold 60px sans-serif')
      .printText('Triviaah Results', 600, 180)
      
      // Score details
      .setTextFont('48px sans-serif')
      .printText(`Score: ${score}`, 600, 280)
      .printText(`${correct} out of ${total} correct`, 600, 350)
      .printText(`Category: ${decodeURIComponent(category)}`, 600, 420)
      
      // Divider line
      .setStroke('rgba(255, 255, 255, 0.5)')
      .setLineWidth(3)
      .printLine(240, 480, 960, 480)
      
      // Footer
      .setTextFont('28px sans-serif')
      .printText('Play now at triviaah.com', 600, 520);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400'
      },
      body: image.toBuffer().toString('base64'),
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