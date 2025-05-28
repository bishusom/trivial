const axios = require('axios');

exports.handler = async (event) => {
  try {
    const { keyword } = event.queryStringParameters || {};
    if (!keyword) {
      console.log('No keyword provided');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Keyword is required' })
      };
    }

    console.log('Requesting Pixabay API with keyword:', keyword);
    console.log('Using API key:', process.env.PIXABAY_API_KEY ? '****' : 'undefined');

    const response = await axios.get('https://pixabay.com/api/', {
      params: {
        key: '2247821-f0a12b26e72666b6918b29bb1',
        q: keyword,
        image_type: 'photo'
      }
    });

    console.log('Pixabay response status:', response.status);
    console.log('Pixabay response data:', response.data);

    const url = response.data.hits && response.data.hits.length > 0 ? response.data.hits[0].webformatURL : null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    };
  } catch (error) {
    console.error('Pixabay API error:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'No response data'
    });

    return {
      statusCode: error.response?.status || 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Failed to fetch image: ${error.message}` })
    };
  }
};
