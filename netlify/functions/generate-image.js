const cloudinary = require('cloudinary').v2;

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

exports.handler = async (event) => {
  const { score, correct, total, category } = event.queryStringParameters;
  
  // Use your actual Cloudinary logo path
  const logoPublicId = "v1752904898/triviaah-logo-200_mv3z7i"; // Remove the extension

  const imageUrl = cloudinary.url(logoPublicId, {
    transformation: [
      {
        width: 1200,
        height: 630,
        crop: "fill",
        background: "linear_gradient:45,#3498db:0.5,#9b59b6:1.0",
        effect: "colorize:40", // Semi-transparent overlay effect
      },
      {
        overlay: {
          font_family: "Arial",
          font_size: 60,
          font_weight: "bold",
          text: `Triviaah Results%0AScore%3A${score}%0A${correct}%20out%20of%20${total}%20correct%0ACategory%3A${encodeURIComponent(category)}`,
          text_align: "center",
          color: "white"
        },
        gravity: "north",
        y: 180
      },
      {
        overlay: logoPublicId,
        width: 200,
        gravity: "north_west",
        x: 50,
        y: 50
      },
      {
        overlay: {
          font_family: "Arial",
          font_size: 28,
          text: "Play now at triviaah.com",
          text_align: "center",
          color: "white"
        },
        gravity: "south",
        y: 50
      }
    ]
  });

  return {
    statusCode: 302,
    headers: {
      'Location': imageUrl,
      'Cache-Control': 'public, max-age=86400'
    },
    body: ''
  };
};