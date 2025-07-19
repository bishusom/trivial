exports.handler = async (event) => {
  const { score, correct, total, category } = event.queryStringParameters;
  const imageUrl = `${process.env.URL}/.netlify/functions/generate-image?score=${score}&correct=${correct}&total=${total}&category=${encodeURIComponent(category)}&t=${Date.now()}&format=png`;
  
  const shareUrl = event.rawUrl;
  
  const html = `
  <!DOCTYPE html>
  <html prefix="og: https://ogp.me/ns#">
  <head>
    <meta charset="utf-8">
    <title>Triviaah Score</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    <!-- Primary Meta Tags -->
    <meta name="title" content="I scored ${score} points in ${decodeURIComponent(category)} trivia!">
    <meta name="description" content="I got ${correct} out of ${total} correct - can you beat my score?">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${shareUrl}">
    <meta property="og:title" content="I scored ${score} points in ${decodeURIComponent(category)} trivia!">
    <meta property="og:description" content="I got ${correct} out of ${total} correct - can you beat my score?">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${shareUrl}">
    <meta name="twitter:title" content="I scored ${score} points in ${decodeURIComponent(category)} trivia!">
    <meta name="twitter:description" content="I got ${correct} out of ${total} correct - can you beat my score?">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:image:alt" content="Triviaah score card showing ${score} points">
    
    <!-- WhatsApp Specific -->
    <meta property="og:image:secure_url" content="${imageUrl}">
  </head>
  <body>
    <div style="text-align:center;padding:20px;">
      <h1>Triviaah Results</h1>
      <p>Score: ${score}</p>
      <p>${correct} out of ${total} correct</p>
      <p>Category: ${decodeURIComponent(category)}</p>
      <p><a href="${process.env.URL}">Play now at triviaah.com</a></p>
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