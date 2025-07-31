const OpenAI = require('openai');
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const imageService = require('./imageService');

// Initialize AI Clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize Anthropic client with error handling
let anthropic;
try {
    if (process.env.CLAUDE_API_KEY) {
        anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    }
} catch (error) {
    // Silent fail
}

const aiService = {
    // Helper function to trim prompts based on model limits
    trimPromptForModel(prompt, model) {
        const limits = {
            "Claude Haiku 3.5": 200000, // Claude has very high limits
            "llama-3.3-70b-versatile": 32768, // Llama 3.3 70B context
            "gpt-3.5-turbo": 16385, // GPT-3.5 context
            "gemini-2.5-flash": 1000000, // Gemini has very high limits
            "dall-e-3": 4000, // DALL-E 3 prompt limit
            "gpt-image-1": 4000 // DALL-E 3 prompt limit
        };
        
        const limit = limits[model] || 4000; // Default to 4000 if model not found
        
        if (prompt.length <= limit) {
            return prompt;
        }
        
        // For image models, trim more aggressively
        if (model === "dall-e-3" || model === "gpt-image-1") {
            return prompt.substring(0, limit - 100) + "..."; // Leave some buffer
        }
        
        // For text models, try to preserve more context
        return prompt.substring(0, limit - 500) + "..."; // Leave buffer for system prompts
    },

    async generateChatname(firstQuery) {
        try {
            if (!firstQuery || typeof firstQuery !== 'string' || firstQuery.trim().length === 0) {
                return 'New Chat';
            }
            const groqResponse = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "Generate a concise, descriptive chat name (3-5 words max) based on the user's query. Return only the chat name without quotes or additional text."
                    },
                    {
                        role: "user",
                        content: firstQuery
                    }
                ],
                model: "llama-3-70b-8192",
                max_tokens: 20,
                temperature: 0.7
            });
            const generatedName = groqResponse.choices[0]?.message?.content?.trim();
            if (!generatedName || generatedName.length === 0) {
                return 'New Chat';
            }
            return generatedName.length > 50 ? generatedName.substring(0, 50) : generatedName;
        } catch (error) {
            return 'New Chat';
        }
    },

    async generateConversationSummary(chatQueries) {
        try {
            if (!chatQueries || chatQueries.length === 0) {
                return '';
            }
            // Build conversation from chatQueries
            const conversation = chatQueries.map(q => `User: ${q.prompt}\nAssistant: ${q.response}`).join('\n');
            const summaryPrompt = `Please provide a concise summary (max 500 tokens) of the following conversation, capturing the key points, context, and any important information that should be carried forward:\n\n${conversation}\n\nSummary:`;
            const groqResponse = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that creates concise, accurate summaries of conversations. Focus on key points, context, and important information that should be preserved."
                    },
                    {
                        role: "user",
                        content: summaryPrompt
                    }
                ],
                model: "llama-3-70b-8192",
                max_tokens: 500,
                temperature: 0.3
            });
            const summary = groqResponse.choices[0]?.message?.content?.trim();
            return summary || '';
        } catch (error) {
            return '';
        }
    },

    async generateResponse(model, history, systemPrompt, augmentedPrompt) {
        try {
            const modelMap = {
                "Claude Haiku 3.5": process.env.MODEL_CLAUDE,
                "llama-3.3-70b-versatile": process.env.MODEL_LLAMA_GROQ,
                "gpt-3.5-turbo": process.env.MODEL_GPT_3_5,
                "gemini-2.5-flash": process.env.MODEL_GEMINI,
                "dall-e-3": process.env.MODEL_GPT_IMAGE,
                "gpt-image-1": process.env.MODEL_GPT_IMAGE
            };
            const selectedModel = modelMap[model] || process.env.MODEL_GPT_3_5;
            
            // Trim the augmented prompt for the specific model
            const trimmedPrompt = this.trimPromptForModel(augmentedPrompt, model);
            
            if (model === "dall-e-3" || model === "gpt-image-1") {
                const imageResult = await imageService.generateImage(trimmedPrompt);
                if (!imageResult.success) {
                    throw new Error(`Image generation failed: ${imageResult.error}`);
                }
                return `Image generated: ${imageResult.imageUrl}`;
            }
            const maxRetries = 3;
            let lastError;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    // Create trimmed history for text models
                    const trimmedHistory = history.map(msg => ({
                        ...msg,
                        content: this.trimPromptForModel(msg.content, model)
                    }));
                    
                    if (model === "Claude Haiku 3.5") {
                        if (!anthropic) {
                            throw new Error('Claude API is not available. Please check if CLAUDE_API_KEY is set in your environment variables.');
                        }
                        if (!process.env.CLAUDE_API_KEY) {
                            throw new Error('CLAUDE_API_KEY environment variable is not set. Please add your Claude API key to the .env file.');
                        }
                        const claudeResponse = await anthropic.messages.create({
                            model: selectedModel,
                            max_tokens: 1024,
                            system: systemPrompt,
                            messages: trimmedHistory,
                        });
                        return claudeResponse.content[0].text;
                    } else if (model === "llama-3.3-70b-versatile") {
                        const groqResponse = await groq.chat.completions.create({
                            messages: trimmedHistory,
                            model: selectedModel,
                            max_tokens: 1024,
                        });
                        return groqResponse.choices[0]?.message?.content;
                    } else if (model === "gemini-2.5-flash") {
                        const geminiModel = genAI.getGenerativeModel({ model: selectedModel });
                        const geminiContents = [];
                        if (systemPrompt) {
                            geminiContents.push({
                                role: 'user',
                                parts: [{ text: `System: ${systemPrompt}\n\nUser: ${trimmedHistory[trimmedHistory.length - 1]?.content || ''}` }]
                            });
                        } else {
                            const lastMessage = trimmedHistory[trimmedHistory.length - 1];
                            if (lastMessage) {
                                geminiContents.push({
                                    role: 'user',
                                    parts: [{ text: lastMessage.content }]
                                });
                            }
                        }
                        const result = await geminiModel.generateContent({
                            contents: geminiContents,
                            generationConfig: { 
                                candidateCount: 1,
                                maxOutputTokens: 1024
                            }
                        });
                        const geminiResponse = await result.response;
                        return geminiResponse.text();
                    } else if (model === "gpt-3.5-turbo") {
                        if (!openai) {
                            throw new Error('OpenAI client not initialized. Please check OPENAI_API_KEY.');
                        }
                        const openaiResponse = await openai.chat.completions.create({
                            model: selectedModel,
                            messages: trimmedHistory,
                            max_tokens: 1024,
                        });
                        return openaiResponse.choices[0].message.content;
                    } else {
                        if (!openai) {
                            throw new Error('OpenAI client not initialized. Please check OPENAI_API_KEY.');
                        }
                        const defaultResponse = await openai.chat.completions.create({
                            model: selectedModel,
                            messages: trimmedHistory,
                            max_tokens: 1024,
                        });
                        return defaultResponse.choices[0].message.content;
                    }
                } catch (error) {
                    lastError = error;
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                    }
                }
            }
            throw lastError;
        } catch (error) {
            throw error;
        }
    }
};

module.exports = aiService; 