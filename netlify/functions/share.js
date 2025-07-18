exports.handler = async (event) => {
  const { score, correct, total, category } = event.queryStringParameters;
  const imageUrl = `${process.env.URL}/.netlify/functions/generate-image?score=${score}&correct=${correct}&total=${total}&category=${encodeURIComponent(category)}&t=${Date.now()}`;
  
  // Validate URL format
  const shareUrl = event.rawUrl.split('?')[0].replace('--', '--');
  
  const html = `
  <!DOCTYPE html>
  <html prefix="og: https://ogp.me/ns#">
  <head>
    <meta charset="utf-8">
    <title>Triviaah Score</title>
    
    <!-- Critical OG Tags -->
    <meta property="og:title" content="I scored ${score} points in ${decodeURIComponent(category)} trivia!" />
    <meta property="og:description" content="I got ${correct} out of ${total} correct - can you beat my score?" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Triviaah Score Card" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="My Triviaah Score">
    <meta name="twitter:description" content="I scored ${score} in ${decodeURIComponent(category)} trivia!">
    <meta name="twitter:image" content="${imageUrl}">
    
    <!-- WhatsApp Specific -->
    <meta property="og:image:secure_url" content="${imageUrl}" />
    
    <meta http-equiv="refresh" content="0;url=${process.env.URL}" />
  </head>
  <body>
    <p>Redirecting to Triviaah...</p>
  </body>
  </html>
  `;
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: html
  };
};