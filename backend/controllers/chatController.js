const User = require('../models/User');
const Chat = require('../models/Chat');
const ragService = require('../services/ragService');
const webSearchService = require('../services/webSearchService');
const aiService = require('../services/aiService');

const chatController = {
    handleChat: async (req, res) => {
        try {
            const { clerkUserId, prompt, model, systemPrompt, webSearch, chatId } = req.body;
            const files = req.files;

            // 1. Find or create the User
            let user = await User.findOne({ userId: clerkUserId });
            if (!user) {
                user = new User({ userId: clerkUserId });
                await user.save();
            }

            // 2. Find or create the Chat session
            let chat = chatId ? await Chat.findById(chatId) : null;
            if (!chat) {
                chat = new Chat({
                    userId: user._id,
                    title: prompt.substring(0, 30),
                    model: model,
                    systemPrompt: systemPrompt || 'You are a helpful assistant.'
                });
            }

            // 3. Build context from RAG and Web Search
            let context = '';
            if (webSearch === 'true') {
                context += await webSearchService.search(prompt);
            }
            context += await ragService.getContextFromFiles(prompt, files);

            const augmentedPrompt = `${prompt}${context}`;

            // 4. Construct message history for the LLM
            const history = chat.messages.map(msg => ({ role: msg.role, content: msg.content }));
            history.push({ role: 'user', content: augmentedPrompt });

            // 5. Generate AI response
            const assistantResponse = await aiService.generateResponse(
                model,
                history,
                chat.systemPrompt,
                augmentedPrompt
            );
            
            // 6. Save messages to the database and send response
            chat.messages.push({ role: 'user', content: prompt });
            chat.messages.push({ role: 'assistant', content: assistantResponse });
            await chat.save();
            
            res.status(200).json({ 
                chatId: chat._id,
                response: assistantResponse 
            });

        } catch (error) {
            console.error('Chat handling error:', error);
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },
    
    getUserChats: async (req, res) => {
        try {
            const { clerkUserId } = req.params;
            const user = await User.findOne({ userId: clerkUserId });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            const chats = await Chat.find({ userId: user._id }).select('-messages').sort({ updatedAt: -1 });
            res.status(200).json(chats);
        } catch (error) {
            console.error('Error fetching user chats:', error);
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
            res.status(200).json(chat);
        } catch (error) {
            console.error('Error fetching chat history:', error);
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    }
};

module.exports = chatController; 