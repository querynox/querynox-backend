const OpenAI = require('openai');
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const imageService = require('./imageService');

// Initialize AI Clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
let anthropic;
try {
    if (process.env.CLAUDE_API_KEY) {
        anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    }
} catch (error) {
    console.error("Could not initialize Anthropic client:", error.message);
}

const aiService = {
    // This helper function is no longer needed with modern message array formats
    // but kept in case you have other uses for it.
    trimPromptForModel(prompt, model) {
        if (typeof prompt !== 'string') return ''; // Prevent crashes
        const limits = {
            "Claude Haiku 3.5": 200000,
            "llama-3.3-70b-versatile": 32768,
            "gpt-3.5-turbo": 16385,
            "gemini-2.5-flash": 1000000,
            "dall-e-3": 4000
        };
        const limit = limits[model] || 8000;
        return prompt.length > limit ? prompt.substring(0, limit) : prompt;
    },

    async generateChatname(firstQuery) {
        try {
            if (!firstQuery || typeof firstQuery !== 'string' || firstQuery.trim().length === 0) {
                return 'New Chat';
            }
            const groqResponse = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "Generate a concise, descriptive chat name (3-5 words max). Return only the chat name." },
                    { role: "user", content: firstQuery }
                ],
                model: "llama3-70b-8192",
                max_tokens: 20,
                temperature: 0.7
            });
            const generatedName = groqResponse.choices[0]?.message?.content?.trim().replace(/["']/g, ''); // Remove quotes
            return generatedName || 'New Chat';
        } catch (error) {
            console.error("Chatname generation failed:", error);
            return 'New Chat';
        }
    },
    
    // --- REFACTORED STREAMING RESPONSE GENERATOR ---
    async* generateStreamingResponse(model, messages, systemPrompt) {
        try {
            const modelMap = {
                "Claude 3.5 Sonnet": "claude-3-5-sonnet-20240620",
                "llama3-70b-8192": "llama3-70b-8192",
                "gpt-3.5-turbo": "gpt-3.5-turbo",
                "gemini-1.5-flash": "gemini-1.5-flash",
                "dall-e-3": "dall-e-3"
            };
            const selectedModel = modelMap[model] || "gpt-3.5-turbo";

            // Handle image generation separately
            if (model === "dall-e-3") {
                const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
                const imageResult = await imageService.generateImage(lastUserMessage);
                if (!imageResult.success) throw new Error(`Image generation failed: ${imageResult.error}`);
                yield imageResult.base64Image;
                return;
            }

            // For text models
            const finalSystemPrompt = systemPrompt || 'You are a helpful assistant.';

            if (model === "Claude 3.5 Sonnet") {
                if (!anthropic) throw new Error('Claude API key not configured.');
                const stream = await anthropic.messages.create({
                    model: selectedModel,
                    max_tokens: 4096,
                    system: finalSystemPrompt,
                    messages: messages,
                    stream: true,
                });
                for await (const event of stream) {
                    if (event.type === 'content_block_delta') {
                        yield event.delta.text;
                    }
                }
            } else if (model === "llama3-70b-8192") {
                 const stream = await groq.chat.completions.create({
                    messages: [{ role: 'system', content: finalSystemPrompt }, ...messages],
                    model: selectedModel,
                    max_tokens: 4096,
                    stream: true,
                });
                for await (const chunk of stream) {
                    yield chunk.choices[0]?.delta?.content || '';
                }
            } else if (model === "gemini-1.5-flash") {
                const geminiModel = genAI.getGenerativeModel({ model: selectedModel, systemInstruction: finalSystemPrompt });
                const contents = messages.map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : 'user', // Gemini uses 'model' for assistant role
                    parts: [{ text: msg.content }]
                }));
                const result = await geminiModel.generateContentStream({ contents });
                for await (const chunk of result.stream) {
                    yield chunk.text();
                }
            } else { // Default to GPT
                const stream = await openai.chat.completions.create({
                    model: selectedModel,
                    messages: [{ role: 'system', content: finalSystemPrompt }, ...messages],
                    max_tokens: 4096,
                    stream: true,
                });
                for await (const chunk of stream) {
                    yield chunk.choices[0]?.delta?.content || '';
                }
            }
        } catch (error) {
            console.error(`AI Service Error for model ${model}:`, error);
            throw error; // Re-throw the error to be caught by the controller
        }
    },

    // Legacy non-streaming method now just wraps the streaming one
    async generateResponse(model, messages, systemPrompt) {
        try {
            let fullResponse = '';
            for await (const chunk of this.generateStreamingResponse(model, messages, systemPrompt)) {
                fullResponse += chunk;
            }
            return fullResponse;
        } catch (error) {
            throw error;
        }
    },

    
    async generateConversationSummary(chatQueries) {
        
        try {
            if (!chatQueries || chatQueries.length === 0) return '';
            const conversation = chatQueries.map(q => `User: ${q.prompt}\nAssistant: ${q.response}`).join('\n\n');
            const summaryPrompt = `Concisely summarize the key points of this conversation:\n\n${conversation}`;
            const groqResponse = await groq.chat.completions.create({
                messages: [{ role: "user", content: summaryPrompt }],
                model: "llama3-70b-8192",
                max_tokens: 500,
            });
            return groqResponse.choices[0]?.message?.content?.trim() || '';
        } catch (error) {
            console.error("Summary generation failed:", error);
            return 'Previous context preserved.';
        }
    },
};

module.exports = aiService;