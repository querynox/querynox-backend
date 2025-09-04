const OpenAI = require('openai');
const logger = require('../configs/loggerConfig');

// OpenRouter API configuration using OpenAI SDK
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Model configurations for OpenRouter
const OPENROUTER_MODELS = {
    // Text Generation Models
    'gpt-oss-120b': {
        name: 'gpt-oss-120b',
        fullName: 'gpt-oss-120b',
        category: 'Text Generation',
        description: 'Openai Open Source 120B Model',
        limit: 128000,
        provider: 'openrouter'
    },
    'grok-3-mini': {
        name: 'grok-3-mini',
        fullName: 'grok-3-mini',
        category: 'Text Generation',
        description: 'X.AI Grok 3 Mini Model',
        limit: 128000,
        provider: 'openrouter'
    }
};

// Embedding model for RAG (keeping existing OpenAI embedding)
const EMBEDDING_MODEL = 'text-embedding-3-small';

class OpenRouterService {
    constructor() {
        if (!OPENROUTER_API_KEY) {
            throw new Error('OPENROUTER_API_KEY is required');
        }
        // Initialize OpenAI client configured for OpenRouter
        this.client = new OpenAI({
            apiKey: OPENROUTER_API_KEY,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': process.env.BACKEND_HOST || 'http://localhost:8080',
                'X-Title': 'QueryNox Backend'
            }
        });
    }

    /**
     * Get all available models
     */
    getAvailableModels() {
        return Object.values(OPENROUTER_MODELS);
    }

    /**
     * Get model configuration by name
     */
    getModelConfig(modelName) {
        return OPENROUTER_MODELS[modelName];
    }

    /**
     * Generate chat completion using OpenRouter
     */
    async generateChatCompletion(modelName, messages, options = {}) {
        try {
            const modelConfig = this.getModelConfig(modelName);
            if (!modelConfig) {
                throw new Error(`Model ${modelName} not found`);
            }

            const response = await this.client.chat.completions.create({
                model: modelConfig.fullName,
                messages: messages,
                max_tokens: options.maxTokens || 4096,
                temperature: options.temperature || 0.7,
                stream: options.stream || false,
                ...options
            });

            return response;
        } catch (error) {
            logger.error(`OpenRouter API Error for model ${modelName}:`, error.message);
            throw error;
        }
    }

    /**
     * Generate streaming chat completion
     */
    async* generateStreamingChatCompletion(modelName, messages, options = {}) {
        try {
            const modelConfig = this.getModelConfig(modelName);
            if (!modelConfig) {
                throw new Error(`Model ${modelName} not found`);
            }

            const stream = await this.client.chat.completions.create({
                model: modelConfig.fullName,
                messages: messages,
                max_tokens: options.maxTokens || 4096,
                temperature: options.temperature || 0.7,
                stream: true,
                ...options
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    yield { content };
                }
            }
        } catch (error) {
            logger.error(`OpenRouter Streaming Error for model ${modelName}:`, error.message);
            throw error;
        }
    }

    /**
     * Generate embeddings using OpenAI directly (OpenRouter doesn't support embeddings)
     */
    async generateEmbeddings(texts) {
        try {
            // Use OpenAI directly for embeddings since OpenRouter doesn't support them
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            
            const response = await openai.embeddings.create({
                model: EMBEDDING_MODEL,
                input: Array.isArray(texts) ? texts : [texts],
            });
            
            return response.data.map(item => item.embedding);
        } catch (error) {
            logger.error('Embedding generation error:', error);
            throw error;
        }
    }

    /**
     * Generate image using OpenRouter (if supported) or fallback to existing service
     */
    async generateImage(prompt, options = {}) {
        try {
            // For now, we'll use the existing image service since OpenRouter doesn't have image generation
            // You can extend this to use other image generation APIs through OpenRouter if available
            const imageService = require('./imageService');
            return await imageService.generateImage(prompt);
        } catch (error) {
            logger.error('Image generation error:', error);
            throw error;
        }
    }

    /**
     * Generate chat name using a lightweight model
     */
    async generateChatName(firstQuery) {
        try {
            if (!firstQuery || typeof firstQuery !== 'string' || firstQuery.trim().length === 0) {
                return 'New Chat';
            }

            const response = await this.generateChatCompletion('gpt-oss-120b', [
                { role: "system", content: "Generate a concise, descriptive chat name (3-5 words max). Return only the chat name." },
                { role: "user", content: firstQuery }
            ], {
                maxTokens: 20,
                temperature: 0.7
            });

            const generatedName = response.choices[0]?.message?.content?.trim().replace(/["']/g, '');
            return generatedName || 'New Chat';
        } catch (error) {
            logger.error("Chat name generation failed:", error);
            return 'New Chat';
        }
    }

    /**
     * Generate context for web search
     */
    async generateContextForWebSearch(messages) {
        try {
            const recentMessages = messages.slice(-10);
            const response = await this.generateChatCompletion('gpt-oss-120b', [
                { 
                    role: "system",   
                    content: `You are a web search query resolver.
                    Your job is to take the user's latest query and return ONLY a single, complete search query.
                    Rules:
                    - If the query uses pronouns (it, they, he, she, this, that, etc.) or lacks context, replace them with the correct entity from chat history.
                    - If the query requires certain context from previous chats, ADD that context from chat history.
                    - If the query is already complete, return it as is.
                    - Do NOT add explanations, notes, or sentences. Return ONLY the raw search query string.`
                },
                ...recentMessages
            ], {
                maxTokens: 30,
                temperature: 0.2
            });

            const generatedQuestion = response.choices[0]?.message?.content?.trim().replace(/["']/g, '');
            return generatedQuestion || messages.pop().content;
        } catch (error) {
            logger.error("Web search context generation failed:", error);
            return messages.pop()?.content || '';
        }
    }

    /**
     * Generate context for image generation
     */
    async generateContextForImageGeneration(messages) {
        try {
            const recentMessages = messages.slice(-10);
            const response = await this.generateChatCompletion('gpt-oss-120b', [
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
            ], {
                maxTokens: 30,
                temperature: 0.1
            });

            const generatedQuestion = response.choices[0]?.message?.content?.trim().replace(/["']/g, '');
            return generatedQuestion || messages[messages.length - 1]?.content || '';
        } catch (error) {
            logger.error("Image prompt context generation failed:", error);
            return messages[messages.length - 1]?.content || '';
        }
    }

    /**
     * Generate conversation summary
     */
    async generateConversationSummary(messages) {
        try {
            if (!messages || messages.length === 0) return '';
            
            const _messages = messages.map(q => `${q.role}:${q.content}`).join('\n\n');
            const summaryPrompt = `Concisely summarize the key points of this conversation:\n\n${_messages}`;
            
            const response = await this.generateChatCompletion('gpt-oss-120b', [
                { role: "user", content: summaryPrompt }
            ], {
                maxTokens: 500,
                temperature: 0.3
            });

            return response.choices[0]?.message?.content?.trim() || '';
        } catch (error) {
            logger.error("Summary generation failed:", error);
            return 'Previous context preserved.';
        }
    }

    /**
     * Main streaming response generator (compatible with existing aiService interface)
     */
    async* generateStreamingResponse(model, messages, systemPrompt) {
        try {
            const modelConfig = this.getModelConfig(model);
            if (!modelConfig) {
                throw new Error(`Model ${model} not found`);
            }

            // Handle image generation separately
            if (modelConfig.category === "Image Generation") {
                const prompt = await this.generateContextForImageGeneration(messages);
                const imageResult = await this.generateImage(prompt);
                if (!imageResult.success) throw new Error(`Image generation failed: ${imageResult.error}`);
                yield {...imageResult, content: imageResult.previewUrl};
                return;
            }

            // For text models
            const finalSystemPrompt = systemPrompt || 'You are a helpful assistant.';
            const finalMessages = [{ role: 'system', content: finalSystemPrompt }, ...messages];

            for await (const chunk of this.generateStreamingChatCompletion(model, finalMessages)) {
                yield chunk;
            }
        } catch (error) {
            logger.error(`OpenRouter Service Error for model ${model}:`, error);
            throw error;
        }
    }

    /**
     * Non-streaming response generator (compatible with existing aiService interface)
     */
    async generateResponse(model, messages, systemPrompt) {
        try {
            let fullResponse = { content: "" };
            for await (const chunk of this.generateStreamingResponse(model, messages, systemPrompt)) {
                const { content, ...rest } = chunk;
                fullResponse = { ...rest, content: fullResponse.content + chunk.content };
            }
            return fullResponse;
        } catch (error) {
            throw error;
        }
    }
}

// Create and export singleton instance
const openRouterService = new OpenRouterService();
module.exports = openRouterService;
