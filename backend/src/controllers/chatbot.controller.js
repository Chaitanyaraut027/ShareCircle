import { GoogleGenerativeAI } from '@google/generative-ai';

export const handleChat = async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, message: 'Server is missing API key.' });
        }
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const { message, history } = req.body;

        const systemPrompt = `You are "ShareCircle Bot", a helpful AI assistant for the ShareCircle app. 
ShareCircle is a community-driven platform where users can donate items (food, clothes, books, etc.) and post "Need Requests" if they require something.
App Features: 
- Users can post donations with an image, title, category, and location.
- Users can view nearby donations and need requests on a map.
- Users earn 25 points for every donation, contributing to a Leaderboard.
- There is a strict AI moderation system that checks for inappropriate content.
- Users can chat/contact donors via WhatsApp or Phone call.
- Admins moderate the platform, approve/reject items, and handle API issues.

Important Rules:
1. You must answer questions related to ShareCircle, its features, or community sharing and donations.
2. If the user asks something completely unrelated to the app, volunteering, donations, or community help, you MUST politely reply with exactly: "Sorry, I am ShareCircle Bot. I can only help with questions related to the ShareCircle app and community donations."
3. Keep your answers concise, friendly, and use emojis.

User's latest message: ${message}`;

        const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
        
        // Prepare history for Gemini if needed, but for simplicity we can just pass context as prompt
        const prompt = `${systemPrompt}\n\nRespond to the user's latest message appropriately.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        res.status(200).json({ success: true, response: responseText });
    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({ success: false, message: 'Chatbot temporarily unavailable.' });
    }
};
