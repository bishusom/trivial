const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Load environment variables
  require('dotenv').config();
  const API_KEY = process.env.MERRIAM_WEBSTER_API_KEY;

  // Get the word from query parameters
  const word = event.queryStringParameters.word;

  if (!word) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Word parameter is required' }),
    };
  }

  // Construct the Merriam-Webster API URL
  const url = `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${API_KEY}`;

  try {
    // Make the API request
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    const data = await response.json();

    // Return the API response
    return {
      statusCode: 200,
      body: JSON.stringify({
        word,
        definitions: data[0]?.shortdef || ['No definitions found'],
        pronunciations: data[0]?.hwi?.prs || [],
        etymology: data[0]?.et || [],
      }),
    };
  } catch (error) {
    console.error('Error fetching dictionary data:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch dictionary data' }),
    };
  }
};