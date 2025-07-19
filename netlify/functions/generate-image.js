const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');

exports.handler = async (event) => {
  const { score, correct, total, category } = event.queryStringParameters;
  
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  
  await page.setContent(`
    <!DOCTYPE html>
    <style>
      body { margin: 0; background: linear-gradient(135deg, #3498db, #9b59b6); }
      .container { 
        width: 1200px; 
        height: 630px; 
        position: relative;
        color: white;
        font-family: Arial;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 180px;
      }
      .logo {
        position: absolute;
        top: 50px;
        left: 50px;
        height: 100px;
      }
      h1 { font-size: 60px; margin: 0 0 20px; }
      .score { font-size: 48px; margin: 10px; }
      .footer { 
        position: absolute;
        bottom: 50px;
        font-size: 28px;
      }
    </style>
    <div class="container">
      <img class="logo" src="https://triviaah.com/imgs/triviaah-logo-200.webp">
      <h1>Triviaah Results</h1>
      <div class="score">Score: ${score}</div>
      <div class="score">${correct} out of ${total} correct</div>
      <div class="score">Category: ${decodeURIComponent(category)}</div>
      <div class="footer">Play now at triviaah.com</div>
    </div>
  `);

  const buffer = await page.screenshot({ type: 'png' });
  await browser.close();

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400'
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true
  };
};