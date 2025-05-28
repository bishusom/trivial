// netlify/functions/get-image.js
const axios = require('axios');

exports.handler = async (event) => {
  try {
    const { keyword } = event.queryStringParameters;
    const response = await axios.get(`https://pixabay.com/api/`, {
      params: {
        key: '2247821-f0a12b26e72666b6918b29bb1',//process.env.PIXABAY_API_KEY,
        q: keyword,
        image_type: 'photo'
      }
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify(response.data.hits[0]?.webformatURL || null)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch image' })
    };
  }
};  