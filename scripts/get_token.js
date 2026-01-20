
/**
 * Run this script to generate a Fyers Access Token.
 * Command: node scripts/get_token.js
 */

import FyersAPI from 'fyers-api-v3';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const fyers = new FyersAPI.fyersModel();

const APP_ID = process.env.FYERS_APP_ID;
const SECRET_ID = process.env.FYERS_SECRET_ID;
const REDIRECT_URI = "http://localhost:3001/"; // Must match Fyers Dashboard

if (!APP_ID || !SECRET_ID) {
    console.error("❌ Error: Please add FYERS_APP_ID and FYERS_SECRET_ID to your .env file.");
    process.exit(1);
}

// 1. Setup the App
fyers.setAppId(APP_ID);
fyers.setRedirectUrl(REDIRECT_URI);

// 2. Generate Auth URL
const generateAuthUrl = () => {
    // Challenge needs to be a random string, but for simplicity we use a fixed one or timestamp
    // Ideally use a crypto library, but we keep dependencies low here.
    const challenge = "protrader_auth_" + Date.now(); 
    
    // Note: The Fyers Node SDK generates the URL format internally usually, 
    // but sometimes it helps to print the direct link for the user.
    const url = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&state=${challenge}`;
    
    console.log("\n==================================================");
    console.log("👉  STEP 1: Open this URL in your browser and Login:");
    console.log("==================================================\n");
    console.log(url);
    console.log("\n==================================================");
    console.log("👉  STEP 2: After login, you will be redirected to localhost:3001");
    console.log("    Copy the 'auth_code' from the URL address bar.");
    console.log("    (Example: http://localhost:3001/?auth_code=YOUR_CODE_HERE&state=...)");
    console.log("==================================================\n");
};

// 3. Exchange Code for Token
const getToken = async (authCode) => {
    try {
        console.log("\n🔄 Generating Access Token...");
        
        const response = await fyers.generate_access_token({
            client_id: APP_ID,
            secret_key: SECRET_ID,
            auth_code: authCode
        });

        if (response.s === 'ok') {
            console.log("\n✅ SUCCESS! Here is your Access Token:\n");
            console.log(response.access_token);
            console.log("\n📋 Copy the token above and paste it into your .env file as FYERS_ACCESS_TOKEN");
        } else {
            console.error("\n❌ Failed to generate token:", response);
        }

    } catch (error) {
        console.error("\n❌ Error:", error.message || error);
    }
};

// Main Execution Flow
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

generateAuthUrl();

rl.question('Paste the Auth Code here: ', (code) => {
    if (code) {
        getToken(code.trim());
    } else {
        console.log("No code provided.");
    }
    rl.close();
});
