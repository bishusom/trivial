const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const axios = require('axios');
const path = require('path');

// Register fonts from filesystem
try {
  const fontsDir = path.join(__dirname, 'fonts');
  console.log('Attempting to register fonts from:', fontsDir);

  // Register Regular Arial
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Arial.ttf'), 'Arial');
  console.log('Registered Arial.ttf');

  // Register Arial Bold, specifying the weight explicitly for the 'Arial' family
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Arial-Bold.ttf'), 'Arial', { weight: 'bold' });
  console.log('Registered Arial-Bold.ttf with weight: bold');

  console.log('Custom fonts registered successfully');
} catch (e) {
  console.error('Error registering fonts:', e.message);
  console.error('Font registration stack trace:', e.stack);
  console.log('Using fallback fonts due to registration error.');
}

exports.handler = async (event) => {
  try {
    const { score, correct, total, category } = event.queryStringParameters;
    
    if (!score || !correct || !total || !category) {
      throw new Error('Missing required parameters');
    }

    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    // Log available fonts for debugging - check styles array here again
    console.log('Available font families after registration:', GlobalFonts.families);

    // Gradient Background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#3498db');
    gradient.addColorStop(1, '#9b59b6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(26, 43, 60, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Logo - using axios for reliable fetching
    try {
      const response = await axios.get('https://triviaah.com/imgs/triviaah-logo-200.webp', {
        responseType: 'arraybuffer'
      });
      const logo = await loadImage(response.data);
      const targetHeight = 100;
      const targetWidth = targetHeight * (logo.width / logo.height);
      ctx.drawImage(logo, 50, 50, targetWidth, targetHeight);
    } catch (e) {
      console.error('Error loading logo:', e);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Arial, sans-serif'; // Fallback for logo text
      ctx.fillText('TRIVIAAH', 50, 100);
    }

    // Text Content
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    
    // Use registered font or fallback
    const fontFamily = GlobalFonts.families.some(f => f.family === 'Arial' && f.styles.some(s => s.weight === 'bold')) ? 'Arial' : 'sans-serif'; // More robust check
    console.log('Using font family for text:', fontFamily); // Log which font is actually used
    
    // Title
    ctx.font = `bold 60px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('Triviaah Results', canvas.width/2, 180);

    // Score details
    ctx.font = `48px ${fontFamily}`;
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
    ctx.font = `28px ${fontFamily}`;
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