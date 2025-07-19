exports.handler = async (event) => {
  const { score, correct, total, category } = event.queryStringParameters;
  
  // Use a static fun trivia image (replace with your actual image URL)
  const staticImageUrl = 'https://triviaah.com/imgs/trivia-fun-share-image.png';
  
  const shareUrl = event.rawUrl;
  const decodedCategory = decodeURIComponent(category);
  
  const html = `
  <!DOCTYPE html>
  <html prefix="og: https://ogp.me/ns#">
  <head>
    <meta charset="utf-8">
    <title>Triviaah Score</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    <!-- Primary Meta Tags -->
    <meta name="title" content="I scored ${score} points in ${decodedCategory} trivia!">
    <meta name="description" content="I got ${correct} out of ${total} correct - can you beat my score?">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${shareUrl}">
    <meta property="og:title" content="I scored ${score} points in ${decodedCategory} trivia!">
    <meta property="og:description" content="I got ${correct} out of ${total} correct - can you beat my score?">
    <meta property="og:image" content="${staticImageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Fun Triviaah Challenge">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${shareUrl}">
    <meta name="twitter:title" content="I scored ${score} points in ${decodedCategory} trivia!">
    <meta name="twitter:description" content="I got ${correct} out of ${total} correct - can you beat my score?">
    <meta name="twitter:image" content="${staticImageUrl}">
    
    <!-- WhatsApp Specific -->
    <meta property="og:image:secure_url" content="${staticImageUrl}">
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <h1 style="color: #3498db; text-align: center;">Triviaah Results</h1>
      
      <div style="text-align: center; margin: 30px 0;">
        <img src="${staticImageUrl}" alt="Triviaah Fun" style="max-width: 100%; border-radius: 8px;">
      </div>
      
      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <p style="font-size: 18px;"><strong>Score:</strong> ${score}</p>
        <p style="font-size: 18px;"><strong>Correct Answers:</strong> ${correct}/${total}</p>
        <p style="font-size: 18px;"><strong>Category:</strong> ${decodedCategory}</p>
      </div>
      
      <div style="text-align: center;">
        <a href="${process.env.URL}" style="display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Play Now at triviaah.com
        </a>
      </div>
    </div>
  </body>
  </html>
  `;
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: html
  };
};