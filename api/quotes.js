import axios from 'axios';

export default async function handler(req, res) {
  // CORS Handling
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { FYERS_APP_ID, FYERS_ACCESS_TOKEN } = process.env;

  if (!FYERS_APP_ID || !FYERS_ACCESS_TOKEN) {
    return res.status(503).json({ error: "Server Configuration Error: Missing Fyers Credentials" });
  }

  const { symbols } = req.query;

  try {
    const response = await axios.get(`https://api-t1.fyers.in/data/quotes`, {
      params: { symbols },
      headers: {
        'Authorization': `${FYERS_APP_ID}:${FYERS_ACCESS_TOKEN}`
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Fyers API Error:", error.message);
    res.status(500).json({ error: "Failed to fetch quotes" });
  }
}