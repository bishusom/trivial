exports.handler = async (event) => {
  const { score, correct, total, category } = event.queryStringParameters;
  
  // Add cache-buster parameter to force image refresh
  const timestamp = Date.now();
  const staticImageUrl = `https://triviaah.com/imgs/trivia-fun-share-image.png?t=${timestamp}`;
  
  const shareUrl = event.rawUrl.includes('?') 
    ? event.rawUrl 
    : `${event.rawUrl}?t=${timestamp}`;
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
    <meta property="og:image:alt" content="Triviaah Score Card: ${score} points in ${decodedCategory}">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@TriviaahApp"> <!-- Add your Twitter handle -->
    <meta name="twitter:creator" content="@TriviaahApp"> <!-- Add your Twitter handle -->
    <meta name="twitter:url" content="${shareUrl}">
    <meta name="twitter:title" content="I scored ${score} points in ${decodedCategory} trivia!">
    <meta name="twitter:description" content="I got ${correct} out of ${total} correct - can you beat my score?">
    <meta name="twitter:image" content="${staticImageUrl}">
    <meta name="twitter:image:alt" content="Triviaah Score Card">
    
    <!-- WhatsApp Specific -->
    <meta property="og:image:secure_url" content="${staticImageUrl}">
    <meta property="og:image:type" content="image/png"> <!-- Explicitly declare image type -->
  </head>
  <body>
    <!-- ... rest of your body content remains the same ... -->
  </body>
  </html>
  `;
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: html
  };
};