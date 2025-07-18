// /netlify/functions/share.js
exports.handler = async (event) => {
  const { score, correct, total, category } = event.queryStringParameters;
  
  // Generate image URL
  const imageUrl = `${process.env.URL}/.netlify/functions/generate-image?score=${score}&correct=${correct}&total=${total}&category=${encodeURIComponent(category)}`;
  
  const html = `
  <!DOCTYPE html>
  <html prefix="og: https://ogp.me/ns#">
  <head>
      <title>Trivia Master Result</title>
      <meta property="og:title" content="I scored ${score} points!" />
      <meta property="og:description" content="I got ${correct} out of ${total} correct in ${category} trivia!" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="${event.rawUrl}" />
      <meta property="og:image" content="${imageUrl}" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Triviaah" />
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="Triviaah Result">
      <meta name="twitter:description" content="I scored ${score} points on ${category} trivia!">
      <meta name="twitter:image" content="${imageUrl}">
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