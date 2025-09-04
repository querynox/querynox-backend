const OpenAI = require('openai');
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const imageService = require('./imageService');
const openRouterService = require('./openRouterService');
const models = require('../data/models');
const logger = require('../configs/loggerConfig');

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
    logger.error("Could not initialize Anthropic client:", error.message);
}

// OpenRouter models list
const OPENROUTER_MODELS = ['gpt-oss-120b', 'gemini-2.5-flash-image-preview', 'grok-3-mini'];

const aiService = {
    // Helper function to determine if a model should use OpenRouter
    isOpenRouterModel(modelName) {
        return OPENROUTER_MODELS.includes(modelName);
    },

    // This helper function is no longer needed with modern message array formats
    // but kept in case you have other uses for it.
    trimPromptForModel(prompt, model) {
        if (typeof prompt !== 'string') return '';
        const limit = models.find(m => m.name === model)?.limit || 8000;
        return prompt.length > limit ? prompt.substring(0, limit) : prompt;
    },

    async generateChatname(firstQuery) {
        try {
            if (!firstQuery || typeof firstQuery !== 'string' || firstQuery.trim().length === 0) {
                return 'New Chat';
            }
            
            // Use OpenRouter for chat name generation (faster and free)
            const generatedName = await openRouterService.generateChatName(firstQuery);
            return generatedName;
        } catch (error) {
            logger.error("Chatname generation failed:", error);
            return 'New Chat';
        }
    },

    async generateContextForWebSearch(messages) {
        try {
            // Use OpenRouter for web search context generation
            return await openRouterService.generateContextForWebSearch(messages);
        } catch (error) {
            logger.error("Web search context generation failed:", error);
            return messages.pop()?.content || '';
        }
    },

    async generateContextForImageGeneration(messages) {
        try {
            // Use OpenRouter for image context generation
            return await openRouterService.generateContextForImageGeneration(messages);
        } catch (error) {
            logger.error("Image prompt context generation failed:", error);
            return messages[messages.length - 1]?.content || '';
        }
    },
    
    // --- REFACTORED STREAMING RESPONSE GENERATOR ---
    async* generateStreamingResponse(model, messages, systemPrompt) {
        try {
            const selectedModel = models.find(m => model === m.name) || models.find(m => "gpt-3.5-turbo" === m.name);

            // Handle image generation separately
            if (selectedModel.category === "Image Generation") {
                const prompt = await this.generateContextForImageGeneration(messages);
                const imageResult = await imageService.generateImage(prompt);
                if (!imageResult.success) throw new Error(`Image generation failed: ${imageResult.error}`);
                yield {...imageResult, content: imageResult.previewUrl};
                return;
            }

            // For text models - check if it's an OpenRouter model
            if (this.isOpenRouterModel(model)) {
                const finalSystemPrompt = systemPrompt || 'You are a helpful assistant.';
                const finalMessages = [{ role: 'system', content: finalSystemPrompt }, ...messages];
                
                for await (const chunk of openRouterService.generateStreamingChatCompletion(model, finalMessages)) {
                    yield chunk;
                }
                return;
            }

            // Original model handling
            const finalSystemPrompt = systemPrompt || 'You are a helpful assistant.';

            if (model === "Claude 3.5 Sonnet") {
                if (!anthropic) throw new Error('Claude API key not configured.');
                const stream = await anthropic.messages.create({
                    model: selectedModel.fullName,
                    max_tokens: 4096,
                    system: finalSystemPrompt,
                    messages: messages,
                    stream: true,
                });
                for await (const event of stream) {
                    if (event.type === 'content_block_delta') {
                        yield {content: event.delta.text};
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
                    yield {content: chunk.choices[0]?.delta?.content || ''};
                }
            } else if (model === "gemini-1.5-flash") {
                const geminiModel = genAI.getGenerativeModel({ model: selectedModel.fullName, systemInstruction: finalSystemPrompt });
                const contents = messages.map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : 'user', // Gemini uses 'model' for assistant role
                    parts: [{ text: msg.content }]
                }));
                const result = await geminiModel.generateContentStream({ contents });
                for await (const chunk of result.stream) {
                    yield {content: chunk.text()};
                }
            } else { // Default to GPT
                const stream = await openai.chat.completions.create({
                    model: selectedModel.fullName,
                    messages: [{ role: 'system', content: finalSystemPrompt }, ...messages],
                    max_tokens: 4096,
                    stream: true,
                });
                for await (const chunk of stream) {
                    yield {content: chunk.choices[0]?.delta?.content || ''};
                }
            }
        } catch (error) {
            logger.error(`AI Service Error for model ${model}:`, error);
            throw error; // Re-throw the error to be caught by the controller
        }
    },

    // Legacy non-streaming method now just wraps the streaming one
    async generateResponse(model, messages, systemPrompt) {
        try {
            let fullResponse = {content: ""};
            for await (const chunk of this.generateStreamingResponse(model, messages, systemPrompt)) {
                const {content, ...rest} = chunk;
                fullResponse = {...rest, content: fullResponse.content + chunk.content};
            }
            return fullResponse;
        } catch (error) {
            throw error;
        }
    },

    async generateConversationSummary(messages) {   
        try {
            if (!messages || messages.length === 0) return '';
            
            // Use OpenRouter for conversation summary (faster and free)
            return await openRouterService.generateConversationSummary(messages);
        } catch (error) {
            logger.error("Summary generation failed:", error);
            return 'Previous context preserved.';
        }
    },
};

module.exports = aiService;
