# QueryNox API Testing Guide

This guide provides detailed instructions for testing all QueryNox APIs using Postman.

## Table of Contents
- [Environment Setup](#environment-setup)
- [Chat APIs](#chat-apis)
  - [Create/Continue Chat](#createcontinue-chat)
  - [Get User's Chats](#get-users-chats)
  - [Get Chat History](#get-chat-history)
- [Testing Scenarios](#testing-scenarios)
- [Error Testing](#error-testing)

## Environment Setup

1. Create a new environment in Postman called "QueryNox Local"
2. Add the following variables:
```
BASE_URL: http://localhost:3000/api
CLERK_USER_ID: your_test_user_id
```

## Chat APIs

### Create/Continue Chat

**Endpoint:** `POST {{BASE_URL}}/chat`

**Headers:**
```
Content-Type: multipart/form-data
```

**Form Data Parameters:**

| Key | Type | Required | Description | Example |
|-----|------|----------|-------------|---------|
| clerkUserId | Text | Yes | User identifier | testuser_16945564 |
| prompt | Text | Yes | User's message/query | "What is artificial intelligence?" |
| model | Text | Yes | AI model to use | "gpt-3.5-turbo" |
| systemPrompt | Text | No | System instructions | "You are a helpful assistant." |
| webSearch | Text | No | Enable web search | "true" or "false" |
| chatId | Text | No | Existing chat ID | "65f2a1b3c4d5e6f7g8h9i0j1" |
| files | File | No | PDF files (max 5) | document.pdf |

**Available Models:**
```json
{
    "text_models": [
        "gpt-3.5-turbo",
        "Claude Haiku 3.5",
        "llama-3.3-70b-versatile",
        "gemini-2.5-flash"
    ],
    "image_models": [
        "dall-e-3",
        "gpt-image-1"
    ]
}
```

**Success Response (200):**
```json
{
    "chatId": "65f2a1b3c4d5e6f7g8h9i0j1",
    "response": "AI response text or image URL"
}
```

**Example Requests:**

1. Text Generation:
```json
{
    "clerkUserId": "testuser_16945564",
    "prompt": "What is artificial intelligence?",
    "model": "gpt-3.5-turbo",
    "systemPrompt": "You are a helpful assistant.",
    "webSearch": "true"
}
```

2. Image Generation:
```json
{
    "clerkUserId": "testuser_16945564",
    "prompt": "A beautiful sunset over mountains",
    "model": "dall-e-3",
    "systemPrompt": "Generate beautiful images"
}
```

3. PDF Context:
```json
{
    "clerkUserId": "testuser_16945564",
    "prompt": "Summarize the PDF content",
    "model": "gpt-3.5-turbo",
    "files": [file1.pdf]
}
```

### Get User's Chats

**Endpoint:** `GET {{BASE_URL}}/chats/user/:clerkUserId`

**URL Parameters:**
- clerkUserId: User identifier

**Example Request:**
```http
GET {{BASE_URL}}/chats/user/testuser_16945564
```

**Success Response (200):**
```json
[
    {
        "_id": "65f2a1b3c4d5e6f7g8h9i0j1",
        "title": "What is artificial intelligence?",
        "model": "gpt-3.5-turbo",
        "systemPrompt": "You are a helpful assistant.",
        "webSearch": true,
        "createdAt": "2024-03-15T10:30:00.000Z",
        "updatedAt": "2024-03-15T10:30:00.000Z"
    }
]
```

### Get Chat History

**Endpoint:** `GET {{BASE_URL}}/chat/:chatId`

**URL Parameters:**
- chatId: Chat session identifier

**Example Request:**
```http
GET {{BASE_URL}}/chat/65f2a1b3c4d5e6f7g8h9i0j1
```

**Success Response (200):**
```json
{
    "_id": "65f2a1b3c4d5e6f7g8h9i0j1",
    "userId": "65f2a1b3c4d5e6f7g8h9i0j2",
    "title": "What is artificial intelligence?",
    "model": "gpt-3.5-turbo",
    "systemPrompt": "You are a helpful assistant.",
    "webSearch": true,
    "messages": [
        {
            "role": "user",
            "content": "What is artificial intelligence?",
            "createdAt": "2024-03-15T10:30:00.000Z"
        },
        {
            "role": "assistant",
            "content": "AI response text here...",
            "createdAt": "2024-03-15T10:30:01.000Z"
        }
    ],
    "createdAt": "2024-03-15T10:30:00.000Z",
    "updatedAt": "2024-03-15T10:30:01.000Z"
}
```

## Testing Scenarios

### 1. Basic Text Chat
```json
{
    "clerkUserId": "testuser_16945564",
    "prompt": "What is artificial intelligence?",
    "model": "gpt-3.5-turbo"
}
```

### 2. Chat with Web Search
```json
{
    "clerkUserId": "testuser_16945564",
    "prompt": "What are the latest developments in AI?",
    "model": "gpt-3.5-turbo",
    "webSearch": "true"
}
```

### 3. Image Generation
```json
{
    "clerkUserId": "testuser_16945564",
    "prompt": "A beautiful ghibli image of a girl",
    "model": "dall-e-3",
    "systemPrompt": "Generate beautiful images"
}
```

### 4. PDF Analysis
1. Prepare a PDF file
2. Set form-data with file upload
3. Add prompt about the PDF content

### 5. Chat Continuation
1. Create initial chat
2. Save chatId from response
3. Send follow-up message with saved chatId

## Error Testing

### 1. Invalid User
```json
{
    "clerkUserId": "invalid_user",
    "prompt": "Test message",
    "model": "gpt-3.5-turbo"
}
```
Expected: 404 Not Found

### 2. Invalid Model
```json
{
    "clerkUserId": "testuser_16945564",
    "prompt": "Test message",
    "model": "invalid-model"
}
```
Expected: Default to gpt-3.5-turbo

### 3. Large File
1. Prepare PDF > 5MB
2. Attempt upload
Expected: 413 Payload Too Large

### 4. Too Many Files
1. Prepare 6+ PDF files
2. Attempt upload
Expected: 413 Payload Too Large

### 5. Invalid Chat ID
```http
GET {{BASE_URL}}/chat/invalid_chat_id
```
Expected: 404 Not Found

## Postman Collection Setup

1. Create a new collection: "QueryNox API Tests"

2. Add request folders:
   - Chat Operations
   - User Operations
   - Error Tests

3. Create environment variables:
```
BASE_URL: http://localhost:3000/api
TEST_USER_ID: testuser_16945564
TEST_CHAT_ID: (to be filled after creating chat)
```

4. Add test scripts for validation:
```javascript
// Status check
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Response structure check
pm.test("Response has required fields", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('chatId');
    pm.expect(jsonData).to.have.property('response');
});
```

5. Save example responses for documentation

## Tips for Testing

1. **Sequential Testing:**
   - Start with user creation/verification
   - Create new chat
   - Continue existing chat
   - Retrieve chat history

2. **Model Testing:**
   - Test each AI model separately
   - Verify model-specific responses
   - Test model switching in same chat

3. **File Handling:**
   - Test various file sizes
   - Test multiple file uploads
   - Test invalid file types

4. **Performance Testing:**
   - Monitor response times
   - Test concurrent requests
   - Test with/without web search

5. **Error Handling:**
   - Test all error scenarios
   - Verify error messages
   - Check error recovery 