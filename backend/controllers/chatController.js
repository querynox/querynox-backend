const User = require('../models/User');
const Chat = require('../models/Chat');
const ChatQuery = require('../models/ChatQuery');
const ragService = require('../services/ragService');
const webSearchService = require('../services/webSearchService');
const aiService = require('../services/aiService');

const chatController = {
    createChat: async (req, res) => {
        try {
            const { clerkUserId, prompt, model, systemPrompt, webSearch } = req.body;
            const files = req.files;

            // 1. Find or create the User
            let user = await User.findOne({ userId: clerkUserId });
            if (!user) {
                user = new User({ userId: clerkUserId, chats: [] });
                await user.save();
            }

            // 2. Generate chatname using Llama3 via Groq (only at creation)
            const chatname = await aiService.generateChatname(prompt);

            // 3. Create new Chat session
            const chat = new Chat({
                userId: user._id,
                title: prompt.substring(0, 30),
                chatname: chatname, // Set only at creation, never changes
            });

            // 4. Build context from RAG and Web Search
            let context = '';
            if (webSearch === 'true' || webSearch === true) {
                context += await webSearchService.search(prompt);
            }
            context += await ragService.getContextFromFiles(prompt, files);

            const augmentedPrompt = `${prompt}${context}`;

            // 5. Generate AI response
            const assistantResponse = await aiService.generateResponse(
                model,
                [{ role: 'user', content: augmentedPrompt }],
                systemPrompt || 'You are a helpful assistant.',
                augmentedPrompt
            );

            // 6. Save chat first
            await chat.save();

            // 7. Create first chatQuery in separate collection
            const firstChatQuery = new ChatQuery({
                chatId: chat._id,
                prompt: prompt,
                model: model,
                systemPrompt: systemPrompt || 'You are a helpful assistant.',
                webSearch: webSearch === 'true' || webSearch === true,
                response: assistantResponse
            });
            await firstChatQuery.save();

            // 8. Add chat to user's chats array
            user.chats.push(chat._id);
            await user.save();

            res.status(201).json({ 
                chatId: chat._id,
                chatname: chat.chatname,
                chat: chat,
                response: assistantResponse 
            });
        } catch (error) {
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    handleChat: async (req, res) => {
        try {
            const { clerkUserId, prompt, model, systemPrompt, webSearch } = req.body;
            const { chatId } = req.params; // Get chatId from URL parameter
            const files = req.files;

            // 1. Find or create the User
            let user = await User.findOne({ userId: clerkUserId });
            if (!user) {
                user = new User({ userId: clerkUserId, chats: [] });
                await user.save();
            }

            // 2. Find or create the Chat session
            let chat = null;
            let isModelSwitch = false;
            let conversationSummary = '';

            if (chatId) {
                // Try to find existing chat
                chat = await Chat.findById(chatId);
                if (chat) {
                    // Get previous chatQueries for this chat
                    const previousQueries = await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 });
                    
                    // Check if model is being switched
                    const lastQuery = previousQueries[previousQueries.length - 1];
                    if (lastQuery && lastQuery.model !== model) {
                        isModelSwitch = true;
                        
                        // Generate conversation summary for model switch (only if not first message)
                        if (previousQueries.length > 0) {
                            try {
                                conversationSummary = await aiService.generateConversationSummary(previousQueries);
                            } catch (summaryError) {
                                conversationSummary = 'Previous conversation context preserved.';
                            }
                        }
                    }
                }
            }

            if (!chat) {
                // Create new chat only if no chatId provided or chatId not found
                const chatname = await aiService.generateChatname(prompt);
                chat = new Chat({
                    userId: user._id,
                    title: prompt.substring(0, 30),
                    chatname: chatname, // Set only at creation
                });
                await chat.save();
                user.chats.push(chat._id);
                await user.save();
            }

            // 3. Build context from RAG and Web Search
            let context = '';
            if (webSearch === 'true' || webSearch === true) {
                context += await webSearchService.search(prompt);
            }
            context += await ragService.getContextFromFiles(prompt, files);

            // 4. Prepare the prompt with conversation history and summary if model switching
            let finalPrompt = prompt;
            let conversationHistory = '';
            
            // Get previous chatQueries for this chat
            const previousQueries = await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 });
            
            // Build conversation history from previous chatQueries
            if (previousQueries && previousQueries.length > 0) {
                conversationHistory = previousQueries.map(q => 
                    `User: ${q.prompt}\nAssistant: ${q.response}`
                ).join('\n\n');
            }
            
            if (isModelSwitch && conversationSummary) {
                finalPrompt = `Previous conversation summary: ${conversationSummary}\n\nCurrent user message: ${prompt}`;
            } else if (conversationHistory) {
                finalPrompt = `Previous conversation:\n${conversationHistory}\n\nCurrent user message: ${prompt}`;
            }

            const augmentedPrompt = `${finalPrompt}${context}`;

            // 5. Generate AI response
            let assistantResponse;
            try {
                assistantResponse = await aiService.generateResponse(
                    model,
                    [{ role: 'user', content: augmentedPrompt }],
                    systemPrompt || 'You are a helpful assistant.',
                    augmentedPrompt
                );
            } catch (aiError) {
                assistantResponse = `I apologize, but I'm experiencing technical difficulties with the ${model} service. Please try again in a moment or switch to a different model. Error: ${aiError.message}`;
            }

            // 6. Create new chatQuery in separate collection
            const newChatQuery = new ChatQuery({
                chatId: chat._id,
                prompt: prompt,
                model: model,
                systemPrompt: systemPrompt || 'You are a helpful assistant.',
                webSearch: webSearch === 'true' || webSearch === true,
                response: assistantResponse
            });
            await newChatQuery.save();

            res.status(200).json({ 
                chatId: chat._id,
                chatname: chat.chatname,
                chat: chat,
                response: assistantResponse 
            });
        } catch (error) {
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    getUserChats: async (req, res) => {
        try {
            const { clerkUserId } = req.params;
            const user = await User.findOne({ userId: clerkUserId });
            if (!user) {
                const newUser = new User({ userId: clerkUserId, chats: [] });
                await newUser.save();
                return res.status(200).json([]);
            }
            const chats = await Chat.find({ _id: { $in: user.chats } }).sort({ updatedAt: -1 });
            res.status(200).json(chats);
        } catch (error) {
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    getChatHistory: async (req, res) => {
        try {
            const { chatId } = req.params;
            const chat = await Chat.findById(chatId);
            if (!chat) {
                return res.status(404).json({ error: 'Chat not found' });
            }
            
            // Get all chatQueries for this chat
            const chatQueries = await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 });
            
            res.status(200).json({
                chat: chat,
                chatQueries: chatQueries
            });
        } catch (error) {
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    switchModel: async (req, res) => {
        try {
            const { clerkUserId, chatId, newModel, systemPrompt } = req.body;

            // 1. Find the User
            let user = await User.findOne({ userId: clerkUserId });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // 2. Find the Chat
            const chat = await Chat.findById(chatId);
            if (!chat) {
                return res.status(404).json({ error: 'Chat not found' });
            }

            // 3. Get previous chatQueries
            const previousQueries = await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 });
            const lastQuery = previousQueries[previousQueries.length - 1];
            
            // Check if model is actually changing
            if (lastQuery && lastQuery.model === newModel) {
                return res.status(200).json({ 
                    message: 'Model is already set to ' + newModel,
                    chat: chat 
                });
            }

            const oldModel = lastQuery ? lastQuery.model : 'no previous model';

            // 4. Generate conversation summary if there are chatQueries
            let conversationSummary = '';
            if (previousQueries && previousQueries.length > 0) {
                try {
                    conversationSummary = await aiService.generateConversationSummary(previousQueries);
                } catch (summaryError) {
                    conversationSummary = 'Previous conversation context preserved.';
                }
            }

            // 5. Add a system message about the model switch as a new chatQuery
            const switchChatQuery = new ChatQuery({
                chatId: chat._id,
                prompt: `Model switched from ${oldModel} to ${newModel}`,
                model: newModel,
                systemPrompt: systemPrompt || 'You are a helpful assistant.',
                webSearch: false,
                response: conversationSummary ? `Model switched. Previous conversation summary: ${conversationSummary}` : `Model switched from ${oldModel} to ${newModel}.`
            });
            await switchChatQuery.save();

            res.status(200).json({ 
                message: `Successfully switched from ${oldModel} to ${newModel}`,
                chat: chat,
                oldModel: oldModel,
                newModel: newModel
            });
        } catch (error) {
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    getAvailableModels: async (req, res) => {
        try {
            const models = [
                { 
                    modelName: "Claude Haiku 3.5", 
                    modelCategory: "Text Generation",
                    description: "Fast and efficient text generation"
                },
                { 
                    modelName: "llama-3.3-70b-versatile", 
                    modelCategory: "Text Generation",
                    description: "Powerful open-source model via Groq"
                },
                { 
                    modelName: "gpt-3.5-turbo", 
                    modelCategory: "Text Generation",
                    description: "Reliable and versatile text generation"
                },
                { 
                    modelName: "gemini-2.5-flash", 
                    modelCategory: "Text Generation",
                    description: "Google's advanced language model"
                },
                { 
                    modelName: "dall-e-3", 
                    modelCategory: "Image Generation",
                    description: "High-quality image generation"
                },
                { 
                    modelName: "gpt-image-1", 
                    modelCategory: "Image Generation",
                    description: "Alternative image generation model"
                }
            ];
            res.status(200).json(models);
        } catch (error) {
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    }
};

module.exports = chatController; 