const OpenAI = require('openai');
require('dotenv').config();
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Anthropic } = require("@anthropic-ai/sdk");
const imageService = require('./imageService');
const models = require('../data/models');
const logger = require('../configs/loggerConfig');

// OpenRouter models list
const OPENROUTER_MODELS = ['gpt-oss-120b', 'grok-3-mini'];

// Initialize AI Clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })

// Initialize OpenRouter client
let openRouterClient;
try {
    if (process.env.OPENROUTER_API_KEY) {
        openRouterClient = new OpenAI({
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': process.env.BACKEND_HOST || 'http://localhost:8080',
                'X-Title': 'QueryNox Backend'
            }
        });
    }
} catch (error) {
    logger.error("Could not initialize OpenRouter client:", error.message);
}

const aiService = {
    // Helper function to check if a model should use OpenRouter
    isOpenRouterModel(modelName) {
        return OPENROUTER_MODELS.includes(modelName);
    },

    // This helper function is no longer needed with modern message array formats
    // but kept in case you have other uses for it.
    trimPromptForModel(prompt, _model) {
        if (typeof prompt !== 'string') return '';
        const limit = models.find(m => m.name == model)?.limit || 8000;
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
                model: "llama-3.1-8b-instant",
                max_tokens: 20,
                temperature: 0.7
            });
            const generatedName = groqResponse.choices[0]?.message?.content?.trim().replace(/["']/g, ''); // Remove quotes
            return generatedName || 'New Chat';
        } catch (error) {
            logger.error("Chatname generation failed:", error);
            return 'New Chat';
        }
    },

    async generateContextForWebSearch(messages) {
        try {
            const recentMessages = messages.slice(-10);
            const groqResponse = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system",   
                        content: `You are a web search query resolver.
                        Your job is to take the user's latest query and return ONLY a single, complete search query.
                        Rules:
                        - If the query uses pronouns (it, they, he, she, this, that, etc.) or lacks context, replace them with the correct entity from chat history.
                        - If the query requires certain context from previous chats, ADD that context from chat history.
                        - If the query is already complete, return it as is.
                        - Do NOT add explanations, notes, or sentences. Return ONLY the raw search query string.
                        ` 
                    },
                    ...recentMessages
                ],
                model: "llama-3.1-8b-instant",
                max_tokens: 30,
                temperature: 0.2
            });
            const generatedQuestion= groqResponse.choices[0]?.message?.content?.trim().replace(/["']/g, '');
            return generatedQuestion || messages.pop().content;
        } catch (error) {
            logger.error("Web search context generation failed:", error);
            return 'New Chat';
        }
    },

    async generateContextForImageGeneration(messages) {
        try {
            const recentMessages = messages.slice(-10);
            const groqResponse = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system",   
                        content: `You are an image prompt generator.
                            Your job is to take the user's latest request and return ONLY a single, complete prompt suitable for image generation.

                            Rules:
                            - If the request uses pronouns (it, they, he, she, this, that, etc.) or lacks context, replace them with the correct entity from chat history.
                            - If important context from previous messages is required, ADD that context.
                            - Focus on making the prompt visually descriptive (objects, people, setting, style, colors).
                            - Do NOT add explanations, notes, or sentences. Return ONLY the raw image prompt string.`
                    },
                    ...recentMessages
                ],
                model: "llama-3.1-8b-instant",
                max_tokens: 30,
                temperature: 0.1
            });
            const generatedQuestion = groqResponse.choices[0]?.message?.content?.trim().replace(/["']/g, '');
            return generatedQuestion || messages[messages.length - 1]?.content || '';
        } catch (error) {
            logger.error("Image prompt context generation failed:", error);
            return 'New Chat';
        }
    },
    
    // --- REFACTORED STREAMING RESPONSE GENERATOR ---
    async* generateStreamingResponse(model, messages, systemPrompt, user) {
        try {

            const selectedModel = models.find(m => model == m.name) || models.find(m => m.name == "llama-3.3-70b-versatile");

            //Non Pro User has asked for pro Model
            if(selectedModel.pro && !user.productId){
                yield {content:"System Error : Non Pro User has asked for pro Model"}
                throw new Error("Pro Model requires pro user subscription.")
            }

            // Handle image generation separately
            if(selectedModel.category === "Image Generation"){
                const prompt = await this.generateContextForImageGeneration(messages);
                const imageResult = await imageService.generateImage(prompt, user._id);
                if (!imageResult.success) throw new Error(`Image generation failed: ${imageResult.error}`);
                yield {...imageResult, content:imageResult.previewUrl};
                return;
            }

            // For text models
            const finalSystemPrompt = systemPrompt || 'You are a helpful assistant.';

            // Check if this is an OpenRouter model
            if (this.isOpenRouterModel(model)) {
                if (!openRouterClient) throw new Error('OpenRouter API key not configured.');
                const stream = await openRouterClient.chat.completions.create({
                    model: selectedModel.fullName,
                    messages: [{ role: 'system', content: finalSystemPrompt }, ...messages],
                    max_tokens: 4096,
                    stream: true,
                });
                for await (const chunk of stream) {
                    yield {content: chunk.choices[0]?.delta?.content || ''};
                }
            } else if (model === "Claude 3.5 Sonnet") {
                if (!(anthropic instanceof Anthropic)) throw new Error('Claude API key not configured.');
                const stream = await anthropic.messages.create({
                    model: selectedModel.fullName,
                    max_tokens: 4096,
                    system: finalSystemPrompt,
                    messages: messages,
                    stream: true,
                });
                for await (const event of stream) {
                    if (event.type === 'content_block_delta') {
                        yield {content:event.delta.text};
                    }
                }
            } else if (model === "llama-3.3-70b-versatile") {
                 const stream = await groq.chat.completions.create({
                    messages: [{ role: 'system', content: finalSystemPrompt }, ...messages],
                    model: selectedModel.fullName,
                    max_tokens: 4096,
                    stream: true,
                });
                for await (const chunk of stream) {
                    yield {content:chunk.choices[0]?.delta?.content || ''};
                }
            } else if (model === "gemini-2.5-flash") {
                const geminiModel = genAI.getGenerativeModel({ model: selectedModel.fullName, systemInstruction: finalSystemPrompt });
                const contents = messages.map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : 'user', // Gemini uses 'model' for assistant role
                    parts: [{ text: msg.content }]
                }));
                const result = await geminiModel.generateContentStream({ contents });
                for await (const chunk of result.stream) {
                    yield {content:chunk.text()};
                }
            } else { // Default to GPT
                const stream = await openai.chat.completions.create({
                    model: selectedModel.fullName,
                    messages: [{ role: 'system', content: finalSystemPrompt }, ...messages],
                    max_tokens: 4096,
                    stream: true,
                });
                for await (const chunk of stream) {
                    yield {content:chunk.choices[0]?.delta?.content || ''};
                }
            }
        } catch (error) {
            logger.error(`AI Service Error for model ${model}:`, error);
            throw error; // Re-throw the error to be caught by the controller
        }
    },

    // Legacy non-streaming method now just wraps the streaming one
    async generateResponse(model, messages, systemPrompt, user) {
        try {
            let fullResponse = {content:""};
            for await (const chunk of this.generateStreamingResponse(model, messages, systemPrompt, user)) {
                const {content, ...rest} = chunk;
                fullResponse = {...rest,content:fullResponse.content + chunk.content}
            }
            return fullResponse;
        } catch (error) {
            throw error;
        }
    },

    
    async generateConversationSummary(messages) {   
        try {
            if (!messages || messages.length === 0) return '';
            const _messages = messages.map(q => `${q.role}:${q.content}`).join('\n\n');
            const summaryPrompt = `Concisely summarize the key points of this conversation:\n\n${_messages}`;
            const groqResponse = await groq.chat.completions.create({
                messages: [{ role: "user", content: summaryPrompt }],
                model: "llama-3.1-8b-instant",
                max_tokens: 500,
            });
            return groqResponse.choices[0]?.message?.content?.trim() || '';
        } catch (error) {
            logger.error("Summary generation failed:", error);
            return 'Previous context preserved.';
        }
    },
};

module.exports = aiService;