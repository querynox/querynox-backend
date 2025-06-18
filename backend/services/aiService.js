const OpenAI = require('openai');
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const imageService = require('./imageService');

// Initialize AI Clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

const aiService = {
    async generateResponse(model, history, systemPrompt, augmentedPrompt) {
        const modelMap = {
            "Claude Haiku 3.5": process.env.MODEL_CLAUDE,
            "llama-3.3-70b-versatile": process.env.MODEL_LLAMA_GROQ,
            "gpt-3.5-turbo": process.env.MODEL_GPT_3_5,
            "gemini-2.5-flash": process.env.MODEL_GEMINI,
            "dall-e-3": process.env.MODEL_GPT_IMAGE,
            "gpt-image-1": process.env.MODEL_GPT_IMAGE
        };
        
        const selectedModel = modelMap[model] || process.env.MODEL_GPT_3_5;

        // Check if the selected model matches the image generation model
        if (selectedModel === process.env.MODEL_GPT_IMAGE) {
            const imageResult = await imageService.generateImage(augmentedPrompt);
            if (!imageResult.success) {
                throw new Error(`Image generation failed: ${imageResult.error}`);
            }
            return `Image generated: ${imageResult.imageUrl}`;
        }

        switch (model) {
            case "Claude Haiku 3.5":
                const claudeResponse = await anthropic.messages.create({
                    model: selectedModel,
                    max_tokens: 1024,
                    system: systemPrompt,
                    messages: history,
                });
                return claudeResponse.content[0].text;

            case "llama-3.3-70b-versatile":
                const groqResponse = await groq.chat.completions.create({
                    messages: history,
                    model: selectedModel,
                });
                return groqResponse.choices[0]?.message?.content;

            case "gemini-2.5-flash":
                const geminiModel = genAI.getGenerativeModel({ model: selectedModel });
                const result = await geminiModel.generateContent({
                    contents: [{
                        role: "user",
                        parts: [{ text: augmentedPrompt }]
                    }],
                    generationConfig: { "candidateCount": 1 }
                });
                const geminiResponse = await result.response;
                return geminiResponse.text();

            default: // GPT
                const openaiResponse = await openai.chat.completions.create({
                    model: selectedModel,
                    messages: history,
                });
                return openaiResponse.choices[0].message.content;
        }
    }
};

module.exports = aiService; 