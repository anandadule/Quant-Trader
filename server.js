/**
 * Node.js Backend Proxy for Gemini Quant
 * 
 * SETUP:
 * 1. Create a .env file in the root directory
 * 2. Add: FYERS_APP_ID=your_id
 * 3. Add: FYERS_ACCESS_TOKEN=your_token
 * 4. Run: node server.js
 */

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

// Load keys from .env
const FYERS_APP_ID = process.env.FYERS_APP_ID; 
const FYERS_ACCESS_TOKEN = process.env.FYERS_ACCESS_TOKEN;

app.use(cors());
app.use(express.json()); // Allow parsing of JSON bodies for Webhooks

const FYERS_BASE_URL = "https://api-t1.fyers.in/data";

// Middleware to check if keys exist
const requireAuth = (req, res, next) => {
    if (!FYERS_APP_ID || !FYERS_ACCESS_TOKEN) {
        return res.status(503).json({ 
            error: "Server Missing Credentials", 
            message: "Please add FYERS_APP_ID and FYERS_ACCESS_TOKEN to .env file" 
        });
    }
    next();
};

// 0. Root/Redirect URL Handler
// When you log in via Fyers, it redirects here.
app.get('/', (req, res) => {
    res.send(`
        <h1>Gemini Quant Backend is Online 🟢</h1>
        <p>If you were redirected here from Fyers, your Redirect URL configuration is correct.</p>
        <p>Please ensure your <code>.env</code> file is updated with your Access Token.</p>
    `);
});

// 1. Connection Status Check
app.get('/api/status', (req, res) => {
    const hasKeys = !!(FYERS_APP_ID && FYERS_ACCESS_TOKEN);
    res.json({ 
        server: "online", 
        configured: hasKeys 
    });
});

// 2. Webhook Placeholder
// Fyers requires a valid URL. We accept the data here but don't process it yet.
app.post('/api/webhook', (req, res) => {
    console.log("Received Webhook from Fyers:", req.body);
    res.status(200).send({ status: "received" });
});

// 3. Historical Data Proxy
app.get('/api/history', requireAuth, async (req, res) => {
    try {
        const { symbol, resolution, date_format, range_from, range_to, cont_flag } = req.query;
        
        console.log(`[Proxy] Fetching History: ${symbol} (${resolution})`);

        const response = await axios.get(`${FYERS_BASE_URL}/history`, {
            params: { symbol, resolution, date_format, range_from, range_to, cont_flag },
            headers: {
                'Authorization': `${FYERS_APP_ID}:${FYERS_ACCESS_TOKEN}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error("Fyers History Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to fetch history" });
    }
});

// 4. Quotes/Ticker Proxy
app.get('/api/quotes', requireAuth, async (req, res) => {
    try {
        const { symbols } = req.query;
        
        const response = await axios.get(`${FYERS_BASE_URL}/quotes`, {
            params: { symbols },
            headers: {
                'Authorization': `${FYERS_APP_ID}:${FYERS_ACCESS_TOKEN}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error("Fyers Quotes Error:", error.message);
        res.status(500).json({ error: "Failed to fetch quotes" });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Gemini Quant Backend running on http://localhost:${PORT}`);
    console.log(`👉 Use this as Redirect URL: http://localhost:${PORT}/`);
    
    if (FYERS_APP_ID && FYERS_ACCESS_TOKEN) {
        console.log("✅ API Credentials Loaded");
    } else {
        console.log("⚠️  WARNING: API Credentials MISSING. Create a .env file.");
    }
});