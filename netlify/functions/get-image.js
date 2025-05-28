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
                key: process.env.PIXABAY_API_KEY,
                q: keyword,
                image_type: 'photo'
            }
        });

        const url = response.data.hits?.[0]?.webformatURL || null;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        };
    } catch (error) {
        console.error('Pixabay API error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: `Failed to fetch image: ${error.message}` })
        };
    }
};