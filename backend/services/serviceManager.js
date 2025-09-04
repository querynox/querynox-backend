const openRouterService = require('./openRouterService');
const aiService = require('./aiService');
const ragService = require('./ragService');
const webSearchService = require('./webSearchService');
const imageService = require('./imageService');
const models = require('../data/models');
const logger = require('../configs/loggerConfig');

// OpenRouter models list
const OPENROUTER_MODELS = ['gpt-oss-120b', 'grok-3-mini'];

class ServiceManager {
    constructor() {
        this.openRouterService = openRouterService;
        this.aiService = aiService;
        this.ragService = ragService;
        this.webSearchService = webSearchService;
        this.imageService = imageService;
    }

    /**
     * Check if a model should use OpenRouter
     */
    isOpenRouterModel(modelName) {
        return OPENROUTER_MODELS.includes(modelName);
    }

    /**
     * Get all available models (original + OpenRouter)
     */
    getAvailableModels() {
        return models;
    }

    /**
     * Generate streaming response - routes to appropriate service
     */
    async* generateStreamingResponse(model, messages, systemPrompt) {
        try {
            if (this.isOpenRouterModel(model)) {
                // Use OpenRouter service for new models
                yield* this.openRouterService.generateStreamingResponse(model, messages, systemPrompt);
            } else {
                // Use original AI service for existing models
                yield* this.aiService.generateStreamingResponse(model, messages, systemPrompt);
            }
        } catch (error) {
            logger.error(`Service Manager Error for model ${model}:`, error);
            throw error;
        }
    }

    /**
     * Generate non-streaming response - routes to appropriate service
     */
    async generateResponse(model, messages, systemPrompt) {
        try {
            if (this.isOpenRouterModel(model)) {
                // Use OpenRouter service for new models
                return await this.openRouterService.generateResponse(model, messages, systemPrompt);
            } else {
                // Use original AI service for existing models
                return await this.aiService.generateResponse(model, messages, systemPrompt);
            }
        } catch (error) {
            logger.error(`Service Manager Error for model ${model}:`, error);
            throw error;
        }
    }

    /**
     * Generate chat name - uses OpenRouter for better performance
     */
    async generateChatName(firstQuery) {
        try {
            return await this.openRouterService.generateChatName(firstQuery);
        } catch (error) {
            logger.error("Chat name generation failed:", error);
            return 'New Chat';
        }
    }

    /**
     * Generate context for web search - uses OpenRouter
     */
    async generateContextForWebSearch(messages) {
        try {
            return await this.openRouterService.generateContextForWebSearch(messages);
        } catch (error) {
            logger.error("Web search context generation failed:", error);
            return messages.pop()?.content || '';
        }
    }

    /**
     * Generate context for image generation - uses OpenRouter
     */
    async generateContextForImageGeneration(messages) {
        try {
            return await this.openRouterService.generateContextForImageGeneration(messages);
        } catch (error) {
            logger.error("Image prompt context generation failed:", error);
            return messages[messages.length - 1]?.content || '';
        }
    }

    /**
     * Generate conversation summary - uses OpenRouter
     */
    async generateConversationSummary(messages) {
        try {
            return await this.openRouterService.generateConversationSummary(messages);
        } catch (error) {
            logger.error("Summary generation failed:", error);
            return 'Previous context preserved.';
        }
    }

    /**
     * Generate embeddings - uses OpenAI directly (OpenRouter doesn't support embeddings)
     */
    async generateEmbeddings(texts) {
        try {
            return await this.openRouterService.generateEmbeddings(texts);
        } catch (error) {
            logger.error("Embedding generation failed:", error);
            throw error;
        }
    }

    /**
     * RAG service methods - uses updated RAG service
     */
    async getTextFromPDF(pdfBuffer) {
        return await this.ragService.getTextFromPDF(pdfBuffer);
    }

    chunkText(text, chunkSize = 1000) {
        return this.ragService.chunkText(text, chunkSize);
    }

    async getEmbeddings(chunks) {
        return await this.ragService.getEmbeddings(chunks);
    }

    findRelevantChunks(promptEmbedding, chunkEmbeddings, chunks, topK = 3) {
        return this.ragService.findRelevantChunks(promptEmbedding, chunkEmbeddings, chunks, topK);
    }

    async getTextFromImage(imageBuffer, mimetype = 'image/jpeg') {
        return await this.ragService.getTextFromImage(imageBuffer, mimetype);
    }

    async getContextFromFiles(prompt, files) {
        return await this.ragService.getContextFromFiles(prompt, files);
    }

    /**
     * Web search service methods
     */
    async search(messages) {
        return await this.webSearchService.search(messages);
    }

    /**
     * Image service methods
     */
    async generateImage(prompt) {
        return await this.imageService.generateImage(prompt);
    }

    /**
     * Health check for all services
     */
    async healthCheck() {
        const health = {
            openRouter: false,
            originalAI: false,
            rag: false,
            webSearch: false,
            image: false
        };

        try {
            // Test OpenRouter with a simple request
            await this.openRouterService.generateChatCompletion('gpt-oss-120b', [
                { role: 'user', content: 'Hello' }
            ], { maxTokens: 1 });
            health.openRouter = true;
        } catch (error) {
            logger.warn('OpenRouter health check failed:', error.message);
        }

        try {
            // Test original AI service
            await this.aiService.generateChatName('Test');
            health.originalAI = true;
        } catch (error) {
            logger.warn('Original AI service health check failed:', error.message);
        }

        try {
            // Test RAG service
            await this.ragService.chunkText('Test text');
            health.rag = true;
        } catch (error) {
            logger.warn('RAG service health check failed:', error.message);
        }

        try {
            // Test web search service
            await this.webSearchService.search([{ role: 'user', content: 'test' }]);
            health.webSearch = true;
        } catch (error) {
            logger.warn('Web search service health check failed:', error.message);
        }

        try {
            // Test image service (just check if it's available)
            if (this.imageService && typeof this.imageService.generateImage === 'function') {
                health.image = true;
            }
        } catch (error) {
            logger.warn('Image service health check failed:', error.message);
        }

        return health;
    }
}

// Create and export singleton instance
const serviceManager = new ServiceManager();
module.exports = serviceManager;
