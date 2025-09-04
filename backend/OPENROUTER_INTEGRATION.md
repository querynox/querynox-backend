# OpenRouter Integration for QueryNox Backend

This document explains the new OpenRouter integration that allows you to use additional AI models through OpenRouter's API.

## Overview

The integration adds support for two new models via OpenRouter:
- **gpt-oss-120b** (OpenAI GPT-4o Mini - Free)
- **grok-3-mini** (X.AI Grok 3 Mini Beta)

**Important Notes:**
- OpenRouter does **NOT** support embedding models
- Embeddings continue to use OpenAI's `text-embedding-3-small` directly
- Uses OpenAI SDK configured for OpenRouter (no separate SDK needed)

## New Files Created

### Core Services
1. **`services/openRouterService.js`** - Main OpenRouter integration service
2. **`services/serviceManager.js`** - Service manager that routes requests to appropriate services
3. **`services/aiServiceUpdated.js`** - Updated AI service with OpenRouter support
4. **`services/ragServiceUpdated.js`** - Updated RAG service using OpenRouter embeddings
5. **`services/webSearchServiceUpdated.js`** - Updated web search service
6. **`services/imageServiceUpdated.js`** - Updated image service
7. **`controllers/chatControllerUpdated.js`** - Updated chat controller using service manager

### Configuration
8. **`data/models.js`** - Updated with new OpenRouter models

## Environment Variables Required

Add these to your `.env` file:

```env
# OpenRouter API Key (Required)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Existing variables (keep these)
OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
CLAUDE_API_KEY=your_claude_api_key
GOOGLE_API_KEY=your_google_search_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
MODEL_EMBEDDING=text-embedding-3-small
MODEL_GPT_IMAGE=dall-e-3
BACKEND_HOST=http://localhost:8080
```

## How It Works

### Service Routing
The `ServiceManager` automatically routes requests to the appropriate service:

- **OpenRouter Models**: `gpt-oss-120b`, `grok-3-mini`
- **Original Models**: All existing models continue to use their original services

### Model Support

#### Text Generation Models
- **gpt-oss-120b**: OpenAI's GPT-4o Mini model (Free via OpenRouter)
- **grok-3-mini**: X.AI's Grok 3 Mini Beta model (Paid via OpenRouter)

#### RAG (Retrieval Augmented Generation)
- **Internal Use Only**: Embeddings are used automatically by the API when users upload files
- Uses OpenAI's `text-embedding-3-small` model for embeddings (directly via OpenAI API)
- **Note**: OpenRouter does not support embedding models, so embeddings use OpenAI directly
- Works with all text generation models (both OpenRouter and original models)
- Supports PDF and image text extraction

#### Image Generation
- Currently uses existing DALL-E 3 service
- Can be extended to support OpenRouter image generation models when available

## API Endpoints

### New Endpoints
- `GET /api/v1/chat/health` - Service health check

### Updated Endpoints
All existing chat endpoints now support the new OpenRouter models:
- `POST /api/v1/chat/:chatId` - Chat with any supported model
- `POST /api/v1/chat/:chatId/stream` - Streaming chat with any supported model
- `GET /api/v1/chat/models` - Returns all available models (including OpenRouter models)

## Usage Examples

### Using OpenRouter Models

```javascript
// Example request body for chat
{
  "prompt": "Explain quantum computing",
  "model": "gpt-oss-120b",  // or "grok-3-mini"
  "systemPrompt": "You are a helpful assistant",
  "webSearch": false
}
```

### Using RAG with File Uploads

```javascript
// Example request with file upload for RAG
// The API automatically handles embeddings internally
{
  "prompt": "What does this document say about AI?",
  "model": "gpt-oss-120b",  // Any model works with RAG
  "systemPrompt": "You are a helpful assistant",
  "webSearch": false
}
// + file upload (PDF/image)
// The API will:
// 1. Extract text from the file
// 2. Create embeddings using OpenAI (internally)
// 3. Find relevant chunks
// 4. Provide context to the chosen model
```

### Service Health Check

```javascript
// Check which services are working
GET /api/v1/chat/health

// Response
{
  "openRouter": true,
  "originalAI": true,
  "rag": true,
  "webSearch": true,
  "image": true
}
```

## Migration Guide

### Option 1: Gradual Migration (Recommended)
1. Keep existing services running
2. Test new OpenRouter models alongside existing ones
3. Gradually migrate to the new service manager

### Option 2: Full Migration
1. Replace imports in your main application:
   ```javascript
   // Old
   const aiService = require('./services/aiService');
   const ragService = require('./services/ragService');
   const webSearchService = require('./services/webSearchService');
   
   // New
   const serviceManager = require('./services/serviceManager');
   ```

2. Update controller imports:
   ```javascript
   // Old
   const chatController = require('./controllers/chatController');
   
   // New
   const chatController = require('./controllers/chatControllerUpdated');
   ```

## Features

### Automatic Model Routing
- OpenRouter models automatically use OpenRouter service
- Original models continue using their existing services
- No code changes needed for existing functionality

### Enhanced Performance
- OpenRouter models use optimized API calls
- Better error handling and retry logic
- Improved streaming support

### RAG Integration
- All models support RAG with file uploads
- **Automatic Processing**: When users upload PDFs/images, the API automatically:
  1. Extracts text from files
  2. Creates embeddings using OpenAI's text-embedding-3-small
  3. Finds relevant chunks based on user's query
  4. Provides context to the chosen text generation model
- **Important**: OpenRouter does not support embedding models, so embeddings use OpenAI directly
- Supports PDF and image text extraction

### Web Search Integration
- All models support web search context
- Uses OpenRouter for query optimization
- Maintains existing Google Search integration

## Error Handling

The service manager includes comprehensive error handling:
- Automatic fallback to original services if OpenRouter fails
- Detailed logging for debugging
- Graceful degradation for individual service failures

## Monitoring

### Health Check Endpoint
Monitor service health with the new health check endpoint:
```bash
curl http://localhost:8080/api/v1/chat/health
```

### Logging
All services use the existing Winston logger configuration for consistent logging.

## Cost Optimization

### Free Models
- `gpt-oss-120b`: Completely free via OpenRouter

### Paid Models
- `grok-3-mini`: Pay-per-use via OpenRouter (typically cheaper than direct API access)

## Troubleshooting

### Common Issues

1. **OpenRouter API Key Not Set**
   ```
   Error: OPENROUTER_API_KEY is required
   ```
   Solution: Add your OpenRouter API key to the `.env` file

2. **Model Not Found**
   ```
   Error: Model gpt-oss-120b not found
   ```
   Solution: Ensure the model name matches exactly (case-sensitive)

3. **Embedding Errors**
   ```
   Error: OpenRouter doesn't support embeddings
   ```
   Solution: This is expected - embeddings are used internally by the API when processing uploaded files, not directly by users

4. **Service Health Check Fails**
   - Check your internet connection
   - Verify API keys are correct (both OpenRouter and OpenAI for embeddings)
   - Check OpenRouter service status

### Debug Mode
Enable debug logging by setting the log level in your logger configuration.

## Future Enhancements

1. **Image Generation**: Add support for OpenRouter image generation models
2. **Model Selection**: Add automatic model selection based on query type
3. **Caching**: Implement response caching for frequently asked questions
4. **Load Balancing**: Distribute requests across multiple model providers

## Support

For issues with the OpenRouter integration:
1. Check the health endpoint first
2. Review logs for specific error messages
3. Verify API keys and network connectivity
4. Test with a simple query to isolate the issue

## License

This integration maintains the same license as the original QueryNox backend.
