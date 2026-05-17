import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

/**
 * Gemini AI Image Moderation for ShareCircle
 * 
 * Analyzes donation images for:
 *   - Nudity / explicit content
 *   - Violence / blood / gore
 *   - Weapons / drugs / illegal items
 *   - Spam text / OCR analysis
 *   - Context mismatch (image vs title/category/description)
 * 
 * Returns: { verdict, reason, scores }
 *   verdict: 'safe' | 'unsafe' | 'uncertain'
 */

// Using only gemini-flash-lite-latest to save tokens and prevent rate limits
const MODEL_NAME = "gemini-flash-lite-latest";

/**
 * Build the moderation prompt with donation context
 */
function buildModerationPrompt(context) {
    const { title, category, quantity } = context;

    return `You are a strict content moderation AI for "ShareCircle", a donation platform where people donate items like food, clothes, books, electronics, medical supplies, and toys.

Analyze the uploaded image and return a JSON response. Check for ALL of the following:

1. **NUDITY**: Any nudity, sexually suggestive content, revealing/inappropriate clothing.
2. **VIOLENCE**: Blood, gore, injuries, violent scenes, disturbing imagery.
3. **WEAPONS_DRUGS**: Guns, knives (non-kitchen), explosives, illegal drugs, drug paraphernalia, alcohol, tobacco.
4. **SPAM_TEXT**: Excessive text overlays, advertisements, spam, memes, screenshots of chats, promotional content.
5. **CONTEXT_MISMATCH**: Does the image match what the donor claims?
   - Title: "${title || 'not provided'}"
   - Category: "${category || 'not provided'}"
   - Quantity: "${quantity || 'not provided'}"
   
   For context_mismatch, check if the image reasonably matches the title and category. For example:
   - If title says "Fresh Meals" and category is "Food", the image should show food.
   - If title says "Winter Jacket" and category is "Clothes", the image should show clothing.
   - Be lenient — the image doesn't need to be perfect, just reasonable.

**SCORING**: For each category, give a score from 0 to 100:
- 0–30: Safe / no concern
- 31–60: Minor concern / borderline
- 61–100: Clear violation

**VERDICT**: Based on your scores:
- "safe": ALL scores are ≤ 30. The image is clearly appropriate for a donation platform.
- "unsafe": ANY score is ≥ 61. The image clearly violates content policies.
- "uncertain": ANY score is between 31–60 and no score is ≥ 61. Needs human review.

**IMPORTANT**: Respond ONLY with valid JSON, no markdown, no code fences, no explanation outside JSON:

{
  "verdict": "safe" | "unsafe" | "uncertain",
  "reason": "One clear sentence explaining your decision",
  "scores": {
    "nudity": <0-100>,
    "violence": <0-100>,
    "weapons_drugs": <0-100>,
    "spam_text": <0-100>,
    "context_mismatch": <0-100>
  }
}`;
}

/**
 * Convert a local image file to a Gemini-compatible inline data part
 */
function fileToGenerativePart(filePath, mimeType) {
    const data = fs.readFileSync(filePath);
    return {
        inlineData: {
            data: data.toString('base64'),
            mimeType: mimeType || 'image/jpeg',
        },
    };
}

/**
 * Detect MIME type from file extension
 */
function getMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const mimeMap = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
    };
    return mimeMap[ext] || 'image/jpeg';
}

/**
 * Parse Gemini response text into a structured result.
 * Handles edge cases like markdown fences, extra text, etc.
 */
function parseGeminiResponse(text) {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    try {
        const parsed = JSON.parse(cleaned);

        // Validate required fields
        if (!parsed.verdict || !parsed.scores) {
            throw new Error('Missing verdict or scores in AI response');
        }

        // Normalize verdict
        const verdict = parsed.verdict.toLowerCase();
        if (!['safe', 'unsafe', 'uncertain'].includes(verdict)) {
            throw new Error(`Invalid verdict: ${verdict}`);
        }

        return {
            verdict,
            reason: parsed.reason || 'No reason provided',
            scores: {
                nudity: Math.min(100, Math.max(0, Number(parsed.scores.nudity) || 0)),
                violence: Math.min(100, Math.max(0, Number(parsed.scores.violence) || 0)),
                weapons_drugs: Math.min(100, Math.max(0, Number(parsed.scores.weapons_drugs) || 0)),
                spam_text: Math.min(100, Math.max(0, Number(parsed.scores.spam_text) || 0)),
                context_mismatch: Math.min(100, Math.max(0, Number(parsed.scores.context_mismatch) || 0)),
            },
        };
    } catch (err) {
        console.error('❌ Failed to parse Gemini moderation response:', err.message);
        console.error('   Raw text:', text.substring(0, 300));
        return null;
    }
}

/**
 * Main moderation function.
 * 
 * @param {string} imagePath  - Absolute path to the temp image file (from multer)
 * @param {object} context    - { title, category, quantity, description }
 * @returns {object} { verdict, reason, scores } or { verdict: 'error', reason: '...' }
 */
export async function moderateImage(imagePath, context = {}) {
    // Look for a specific moderation key first to split the load, otherwise use the general one
    const apiKey = process.env.GEMINI_MODERATION_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        console.error('🛡️ GEMINI API KEY not set — moderation skipped (error path)');
        return { verdict: 'error', reason: 'AI moderation service not configured', scores: null };
    }

    if (!imagePath || !fs.existsSync(imagePath)) {
        console.error('🛡️ Image file not found for moderation:', imagePath);
        return { verdict: 'error', reason: 'Image file not found', scores: null };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const mimeType = getMimeType(imagePath);
    const imagePart = fileToGenerativePart(imagePath, mimeType);
    const prompt = buildModerationPrompt(context);

    try {
        console.log(`🛡️ Moderating image with ${MODEL_NAME}...`);
        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            generationConfig: {
                maxOutputTokens: 250, // Keep JSON response small
                temperature: 0.1,     // Make output highly deterministic
            }
        });

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        if (!text || text.trim().length === 0) {
            throw new Error('API returned empty response');
        }

        const parsed = parseGeminiResponse(text);
        if (parsed) {
            console.log(`🛡️ Moderation result (${MODEL_NAME}): ${parsed.verdict} — ${parsed.reason}`);
            return parsed;
        }

        throw new Error('Failed to parse AI JSON response');
    } catch (err) {
        console.warn(`🛡️ ${MODEL_NAME} moderation failed: ${err.message}`);
        
        // Handle specific rate limit errors for better UI feedback
        let userFriendlyError = err.message;
        if (err.message.includes('429') || err.message.toLowerCase().includes('quota')) {
            userFriendlyError = 'API Limit Reached (429 Quota Exceeded)';
        }

        return { verdict: 'error', reason: userFriendlyError, scores: null };
    }
}

/**
 * Generates a descriptive caption for a donation image using Gemini AI.
 * 
 * @param {string} imagePath - Absolute path to the image
 * @param {object} context   - { title, category }
 * @returns {Promise<string|null>} - The generated description or null on failure
 */
export async function generateDescriptionFromImage(imagePath, context = {}) {
    const apiKey = process.env.GEMINI_API_KEY; // Use primary key for description
    
    if (!apiKey) {
        console.warn('🛡️ GEMINI_API_KEY not set — description generation skipped');
        return null;
    }

    if (!imagePath || !fs.existsSync(imagePath)) {
        return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const mimeType = getMimeType(imagePath);
    const imagePart = fileToGenerativePart(imagePath, mimeType);
    
    const { title, category } = context;
    const prompt = `Describe this donation item briefly (1-2 sentences). 
    The donor titled it "${title || 'Item'}" in category "${category || 'General'}". 
    Focus on condition, color, and key features. Keep it helpful for someone who might need it. 
    Do not use introductory phrases like "The image shows...". Just describe the item.`;

    try {
        console.log(`🛡️ Generating description using ${MODEL_NAME}...`);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text().trim();
        
        return text || null;
    } catch (err) {
        console.error('❌ Failed to generate description:', err.message);
        return null;
    }
}

/**
 * Text Moderation function (For text-only content like Need Requests)
 */
export async function moderateText(context = {}) {
    const apiKey = process.env.GEMINI_MODERATION_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        console.error('🛡️ GEMINI API KEY not set — text moderation skipped');
        return { verdict: 'error', reason: 'AI moderation service not configured', scores: null };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const { title, category, quantity, description } = context;

    const prompt = `You are a strict content moderation AI for "ShareCircle", a platform where people post "Need Requests" asking for items.

Analyze the following text and return a JSON response. Check for ALL of the following:

1. **NUDITY_PROFANITY**: Any explicit content, sexually suggestive language, vulgarity, swearing, or profanity.
2. **VIOLENCE**: Threats, promoting violence, self-harm, hate speech.
3. **WEAPONS_DRUGS**: Asking for guns, explosives, illegal drugs, alcohol, tobacco, or restricted items.
4. **SPAM**: Advertisements, promotional content, or obvious spam.

Text to analyze:
- Title: "${title || 'not provided'}"
- Category: "${category || 'not provided'}"
- Quantity: "${quantity || 'not provided'}"
- Description: "${description || 'not provided'}"

**SCORING**: For each category, give a score from 0 to 100:
- 0–30: Safe / no concern
- 31–60: Minor concern / borderline
- 61–100: Clear violation

**VERDICT**: Based on your scores:
- "safe": ALL scores are ≤ 30.
- "unsafe": ANY score is ≥ 61.
- "uncertain": ANY score is between 31–60 and no score is ≥ 61.

**IMPORTANT**: Respond ONLY with valid JSON, no markdown, no code fences:

{
  "verdict": "safe" | "unsafe" | "uncertain",
  "reason": "One clear sentence explaining your decision",
  "scores": {
    "nudity_profanity": <0-100>,
    "violence": <0-100>,
    "weapons_drugs": <0-100>,
    "spam": <0-100>
  }
}`;

    try {
        console.log(`🛡️ Moderating text with ${MODEL_NAME}...`);
        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            generationConfig: { maxOutputTokens: 250, temperature: 0.1 }
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (!text || text.trim().length === 0) throw new Error('API returned empty response');

        const parsed = parseGeminiResponse(text);
        if (parsed) {
            console.log(`🛡️ Text Moderation result: ${parsed.verdict} — ${parsed.reason}`);
            return parsed;
        }

        throw new Error('Failed to parse AI JSON response');
    } catch (err) {
        console.warn(`🛡️ Text moderation failed: ${err.message}`);
        let userFriendlyError = err.message;
        if (err.message.includes('429') || err.message.toLowerCase().includes('quota')) {
            userFriendlyError = 'API Limit Reached (429 Quota Exceeded)';
        }
        return { verdict: 'error', reason: userFriendlyError, scores: null };
    }
}
