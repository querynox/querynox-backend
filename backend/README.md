# QueryNox - Multi-Model AI Chat Platform

QueryNox is a powerful, flexible chat platform that integrates multiple AI models and advanced features like web search augmentation and document-based context (RAG).

## Features

- **Multiple AI Model Support**
  - OpenAI GPT-3.5
  - Claude Haiku 3.5
  - Llama 3.3 70B (via Groq)
  - Gemini 2.5 Flash
  - DALL-E 3 /gpt-image-1 (Image Generation)

- **Advanced Context Enhancement**
  - Web Search Integration
  - PDF Document Analysis (RAG)
  - Image OCR Text Extraction (RAG)
  - Multi-file Upload Support

- **Chat Management**
  - Persistent Chat History
  - User Session Management
  - System Prompt Customization

## Technical Stack

- **Backend**: Node.js + Express
- **Database**: MongoDB
- **File Processing**: Multer
- **AI Services**:
  - OpenAI API
  - Anthropic API
  - Groq API
  - Google Gemini API

## Project Structure

```
backend/
├── server.js              # Main application entry point
├── package.json          # Project dependencies
├── models/              # Database models
│   ├── User.js         # User model
│   └── Chat.js         # Chat model
├── controllers/         # Route controllers
│   └── chatController.js
├── services/           # Business logic
│   ├── aiService.js    # AI model integration
│   ├── imageService.js # Image generation
│   ├── ragService.js   # Document analysis
│   └── webSearchService.js # Web search
└── routes/            # API routes
    └── index.js
```

## How It Works

1. **Chat Initialization**
   - User starts a new chat or continues an existing one
   - System creates/retrieves chat session
   - Optional system prompt can be provided

2. **Message Processing**
   - User sends message with optional files
   - If web search is enabled, relevant web content is fetched
   - If files are uploaded, RAG processes them for context
   - Combined context is sent to selected AI model

3. **AI Model Integration**
   - Each model has specific handling in aiService
   - Responses are formatted consistently
   - Image generation requests are handled separately

4. **Response Storage**
   - Chat history is maintained in MongoDB
   - User sessions are tracked
   - Files are processed but not stored

## API Features

1. **Chat Endpoints**
   - Create/continue chat conversations
   - Retrieve chat history
   - List user's chats

2. **File Processing**
   - PDF document analysis
   - Image OCR text extraction
   - Context extraction
   - RAG implementation

3. **Model Selection**
   - Dynamic model switching
   - Different capabilities per model
   - Image generation support

## Security Features

- File size limits (5MB per file)
- Maximum 5 files per request
- API key security
- User session management

## Error Handling

- Graceful error handling for all services
- Detailed error messages
- Failed request recovery

## Performance Considerations

- Efficient file processing
- Batched database operations
- Optimized context generation

## License
