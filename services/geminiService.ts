
import { GoogleGenAI } from "@google/genai";
import { PriceData, AIAnalysis, GroundingSource } from "../types";

/**
 * Gemini-Powered Quantitative Analysis Engine
 * Uses Gemini 3 Flash to interpret actual chart data and indicators.
 */
export const analyzeMarket = async (data: PriceData[], symbol: string = 'BTCUSDT'): Promise<AIAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Extract key metrics for the prompt
  const latest = data[data.length - 1];
  const previous = data[data.length - 2] || latest;
  const recentData = data.slice(-30); // Reduced context slightly for better stability
  
  const prompt = `
    Analyze the following market data for ${symbol}.
    
    CURRENT STATE:
    - Price: ${latest.price}
    - 24h Change: ${((latest.price - previous.price) / previous.price * 100).toFixed(4)}%
    - RSI: ${latest.rsi?.toFixed(2) || 'N/A'}
    - SMA10: ${latest.sma10?.toFixed(2) || 'N/A'}
    - SMA20: ${latest.sma20?.toFixed(2) || 'N/A'}
    
    HISTORICAL CONTEXT (JSON):
    ${JSON.stringify(recentData.map(d => ({ p: d.price, v: d.volume, r: d.rsi })))}
    
    TASK:
    1. Identify the primary trend (Bullish/Bearish/Neutral).
    2. Look for RSI divergences or exhaustion levels.
    3. Check SMA crossovers (Golden/Death cross).
    4. Use Google Search to find any breaking news or sentiment shifts for ${symbol} that might invalidate technicals.
    5. Provide a clear BUY, SELL, or HOLD recommendation.

    OUTPUT FORMAT:
    Respond with a raw JSON object (no markdown formatting, no code blocks).
    JSON Structure:
    {
      "action": "BUY" | "SELL" | "HOLD",
      "confidence": number (0.0 to 1.0),
      "reasoning": "Concise professional explanation"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional Quant Trading Bot. You provide high-probability signals based on technical analysis and real-time market news.",
        tools: [{ googleSearch: {} }],
        // responseSchema and responseMimeType removed to prevent conflict with Google Search tool which was causing 500 errors
      }
    });

    let text = response.text || "{}";
    // Clean markdown code blocks if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.warn("JSON Parse Fallback:", e);
      // Fallback if strict JSON parsing fails
      result = {
        action: 'HOLD',
        confidence: 0,
        reasoning: text.substring(0, 300) || "Analysis format invalid."
      };
    }
    
    // Extract grounding sources if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: GroundingSource[] = groundingChunks.map((chunk: any) => ({
      title: chunk.web?.title || "Market Context",
      uri: chunk.web?.uri || "#"
    })).filter((s: GroundingSource) => s.uri !== "#");

    return {
      action: result.action || 'HOLD',
      confidence: result.confidence || 0.5,
      reasoning: result.reasoning || "Failed to parse AI response.",
      sources: sources.length > 0 ? sources : [
        { title: "Live Market Data", uri: `https://www.tradingview.com/symbols/${symbol}/` }
      ]
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      action: 'HOLD',
      confidence: 0,
      reasoning: "AI analysis service error. Reverting to manual monitoring.",
      sources: []
    };
  }
};
