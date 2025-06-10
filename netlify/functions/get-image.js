const axios = require('axios');

exports.handler = async (event) => {
  try {
    const { keyword } = event.queryStringParameters || {};
    if (!keyword) {
      console.log('No keyword provided');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Keyword is required' }),
      };
    }

    console.log('Requesting Pixabay API with keyword:', keyword);
    const response = await axios.get('https://pixabay.com/api/', {
      params: {
        key: process.env.PIXABAY_API_KEY,
        q: keyword,
        image_type: 'photo',
        per_page: 20, // Fetch more images to select the best
        order: 'popular', // Prioritize popular images
      },
    });

    console.log('Pixabay API response:', response.data);
    const hits = response.data.hits || [];
    if (hits.length === 0) return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: null }) };

    // Select the best image based on resolution and likes
    const bestImage = hits.reduce((best, current) => {
      const bestScore = best ? (best.webformatWidth * best.webformatHeight + (best.likes || 0) * 10) : 0;
      const currentScore = current.webformatWidth * current.webformatHeight + (current.likes || 0) * 10;
      return currentScore > bestScore ? current : best;
    }, null);

    const url = bestImage ? bestImage.webformatURL : hits[0].webformatURL;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
      body: JSON.stringify({ url }),
    };
  } catch (error) {
    console.error('Pixabay API error:', error.message, error.response?.data);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Failed to fetch image: ${error.message}` }),
    };
  }
};