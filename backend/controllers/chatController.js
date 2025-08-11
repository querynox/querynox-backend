const User = require('../models/User');
const Chat = require('../models/Chat');
const ChatQuery = require('../models/ChatQuery');
const ragService = require('../services/ragService');
const webSearchService = require('../services/webSearchService');
const aiService = require('../services/aiService');
const models = require('../data/models');
const { default: mongoose } = require('mongoose');

const chatController = {
    // --- NON-STREAMING METHOD ---
    handleChatCombined: async (req, res) => {
        try {
            const { clerkUserId, prompt, model, systemPrompt, webSearch } = req.body;
            const { chatId } = req.params;
            const files = req.files;

            if (!clerkUserId || !prompt || !model) return res.status(400).json({ error: 'Missing required fields' });

            let chat, user;

            if(chatId){
                // Assumption: User already exist which has already created Chat with ChatID
                // Truthy value of 'chatId' could be used to determine if chat already exist. 

                if (!mongoose.Types.ObjectId.isValid(chatId)) {
                    return res.status(400).json({ error: 'Invalid Chat Id' });
                }

                chat = await Chat.findById(chatId);
                if (!chat) return res.status(404).json({ error: 'Chat not found' });

                // Ensuring that user is never undefined but optionally can be removed.
                user = await User.findOne({ userId: clerkUserId }); 
                if (!chat) return res.status(404).json({ error: 'User not found' });

            }else{
                //Handleing User Creation(UpInsert)
                user = await User.findOne({ userId: clerkUserId });
                if (!user) {
                    user = new User({ userId: clerkUserId, chats: [] });
                    await user.save();
                }

                //Handleing Chat Creation
                const chatName = await aiService.generateChatname(prompt);
                chat = new Chat({ userId: user._id, title: prompt.substring(0, 50), chatName: chatName ,  model, systemPrompt, webSearch });
            }
            
            let context = '';
            if (webSearch == "true" || webSearch == true) {
                context += await webSearchService.search(prompt);
            }
            if (files && files.length > 0) {
                context += await ragService.getContextFromFiles(prompt, files);
            }

            const previousQueries = chatId ? await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 }) : [];
            const conversationHistory = previousQueries.map(q => ([
                { role: 'user', content: q.prompt },
                { role: 'assistant', content: q.response }
            ])).flat();

            const augmentedPrompt = `${prompt}${context}`;
            const messages = [...conversationHistory, { role: 'user', content: augmentedPrompt }];

            const assistantResponse = await aiService.generateResponse(model, messages, systemPrompt);

            chat.updatedAt = Date.now();
            chat['model'] = model;
            chat.systemPrompt = systemPrompt;
            chat.webSearch = webSearch;
            chat = await chat.save();

            const chatQuery = new ChatQuery({
                chatId: chat._id,
                prompt: prompt,
                model: model,
                systemPrompt: systemPrompt,
                webSearch: webSearch == "true" || webSearch == true,
                response: assistantResponse
            });
            await chatQuery.save();

            if(!chatId && user){// Create new Chat
                user.chats.push(chat._id);
                await user.save();
                res.status(201).json({chatQuery:chatQuery, chat:chat});
            }else{
                res.status(200).json({chatQuery});
            }

        } catch (error) {
            console.error('Handle Chat Error:', error);
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    // --- STREAMING METHODS ---
    createChatStream: async (req, res) => {
        try {
            const { clerkUserId, prompt, model, systemPrompt, webSearch } = req.body;
            const files = req.files;

            if (!clerkUserId || !prompt || !model) return res.status(400).json({ error: 'Missing required fields' });

            res.writeHead(200, {
                'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
                'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*',
            });

            const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

            sendEvent({ type: 'status', message: 'Initializing chat...' });

            let user = await User.findOne({ userId: clerkUserId });
            if (!user) {
                user = new User({ userId: clerkUserId, chats: [] });
                await user.save();
            }

            sendEvent({ type: 'status', message: 'Generating chat name...' });
            const chatName = await aiService.generateChatname(prompt);

            const chat = new Chat({ userId: user._id, title: prompt.substring(0, 50), chatName: chatName });
            await chat.save();
            user.chats.push(chat._id);
            await user.save();

            sendEvent({ type: 'metadata', chatId: chat._id, chatName: chat.chatName });

            let context = '';
            if (webSearch == "true" || webSearch == true) {
                sendEvent({ type: 'status', message: 'Searching the web...' });
                context += await webSearchService.search(prompt);
                sendEvent({ type: 'status', message: 'Web search completed.' });
            }

            if (files && files.length > 0) {
                sendEvent({ type: 'status', message: `Processing ${files.length} file(s)...` });
                context += await ragService.getContextFromFiles(prompt, files);
                sendEvent({ type: 'status', message: 'File processing completed.' });
            }
            
            const augmentedPrompt = `${prompt}${context}`;
            const messages = [{ role: 'user', content: augmentedPrompt }];
            
            sendEvent({ type: 'status', message: 'Generating AI response...' });

            let fullResponse = '';
            try {
                for await (const chunk of aiService.generateStreamingResponse(model, messages, systemPrompt)) {
                    fullResponse += chunk;
                    sendEvent({ type: 'content', content: chunk });
                }
                
                const firstChatQuery = new ChatQuery({
                    chatId: chat._id, prompt, model, systemPrompt,
                    webSearch: webSearch == "true" || webSearch == true,
                    response: fullResponse
                });
                await firstChatQuery.save();
                sendEvent({ type: 'complete', fullResponse });

            } catch (aiError) {
                console.error('AI generation error:', aiError);
                sendEvent({ type: 'error', error: `I apologize, an error occurred with the AI service: ${aiError.message}` });
            }

            res.write(`data: [DONE]\n\n`);
            res.end();

        } catch (error) {
            console.error('Streaming createChat error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'An internal server error occurred.' });
            } else {
                res.end();
            }
        }
    },

    handleChatStream: async (req, res) => {
        try {
            const { clerkUserId, prompt, model, systemPrompt, webSearch } = req.body;
            const { chatId } = req.params;
            const files = req.files;

            if (!clerkUserId || !prompt || !model || !chatId) return res.status(400).json({ error: 'Missing required fields' });

            res.writeHead(200, {
                'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
                'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*',
            });

            const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

            sendEvent({ type: 'status', message: 'Loading chat...' });

            const chat = await Chat.findById(chatId);
            if (!chat) {
                sendEvent({ type: 'error', error: 'Chat not found' });
                res.write(`data: [DONE]\n\n`);
                return res.end();
            }

            sendEvent({ type: 'metadata', chatId: chat._id, chatName: chat.chatName });
            
            sendEvent({ type: 'status', message: 'Loading conversation history...' });
            const previousQueries = await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 });

            let context = '';
            if (webSearch == "true" || webSearch == true) {
                sendEvent({ type: 'status', message: 'Searching the web...' });
                context += await webSearchService.search(prompt);
                sendEvent({ type: 'status', message: 'Web search completed.' });
            }

            if (files && files.length > 0) {
                sendEvent({ type: 'status', message: `Processing ${files.length} file(s)...` });
                context += await ragService.getContextFromFiles(prompt, files);
                sendEvent({ type: 'status', message: 'File processing completed.' });
            }

            const conversationHistory = previousQueries.map(q => ([
                { role: 'user', content: q.prompt },
                { role: 'assistant', content: q.response }
            ])).flat();

            const messages = [...conversationHistory, { role: 'user', content: `${prompt}${context}` }];

            sendEvent({ type: 'status', message: 'Generating AI response...' });

            let fullResponse = '';
            try {
                for await (const chunk of aiService.generateStreamingResponse(model, messages, systemPrompt)) {
                    fullResponse += chunk;
                    sendEvent({ type: 'content', content: chunk });
                }

                const newChatQuery = new ChatQuery({
                    chatId: chat._id, prompt, model, systemPrompt,
                    webSearch: webSearch == "true" || webSearch == true,
                    response: fullResponse
                });
                await newChatQuery.save();
                
                chat.updatedAt = Date.now();
                await chat.save();
                sendEvent({ type: 'complete', fullResponse });

            } catch (aiError) {
                console.error('AI generation error:', aiError);
                sendEvent({ type: 'error', error: `I apologize, an error occurred with the AI service: ${aiError.message}` });
            }

            res.write(`data: [DONE]\n\n`);
            res.end();

        } catch (error) {
            console.error('Streaming handleChat error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'An internal server error occurred.' });
            } else {
                res.end();
            }
        }
    },

    handleChatStreamCombined: async (req, res) => {
        try {
            const { clerkUserId, prompt, model, systemPrompt, webSearch } = req.body;
            const { chatId } = req.params;
            const files = req.files;
            console.log(req.body)

            if (!clerkUserId || !prompt || !model) return res.status(400).json({ error: 'Missing required fields' });
            
            let chat, user;

            res.writeHead(200, {
                'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
                'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*',
            });

            const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

            sendEvent({ type: 'status', message: 'Loading chat...' });

            if(chatId){
                // Assumption: User already exist which has already created Chat with ChatID
                // Truthy value of 'chatId' could be used to determine if chat already exist. 

                if (!mongoose.Types.ObjectId.isValid(chatId)) {
                    sendEvent({ type: 'error', error: 'Invalid Chat Id' });
                    res.write(`data: [DONE]\n\n`);
                    return res.end();
                }

                chat = await Chat.findById(chatId);
                if (!chat){
                    sendEvent({ type: 'error', error: 'Chat not found' });
                    res.write(`data: [DONE]\n\n`);
                    return res.end();
                }

                // Ensuring that user is never undefined but optionally can be removed.
                user = await User.findOne({ userId: clerkUserId }); 
                if (!chat){
                    sendEvent({ type: 'error', error: 'User not found' });
                    res.write(`data: [DONE]\n\n`);
                    return res.end();                  
                }

            }else{
                //Handleing User Creation(UpInsert)
                user = await User.findOne({ userId: clerkUserId });
                if (!user) {
                    user = new User({ userId: clerkUserId, chats: [] });
                    await user.save();
                }

                //Handleing Chat Creation
                const chatName = await aiService.generateChatname(prompt);
                chat = new Chat({ userId: user._id, title: prompt.substring(0, 50), chatName: chatName ,  model, systemPrompt, webSearch });
            }


            sendEvent({ type: 'metadata', chatId: chat._id, chatName: chat.chatName });
            
            sendEvent({ type: 'status', message: 'Loading conversation history...' });
            const previousQueries = await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 });

            let context = '';
            if (webSearch == "true" || webSearch == true) {
                sendEvent({ type: 'status', message: 'Searching the web...' });
                context += await webSearchService.search(prompt);
                sendEvent({ type: 'status', message: 'Web search completed.' });
            }

            if (files && files.length > 0) {
                sendEvent({ type: 'status', message: `Processing ${files.length} file(s)...` });
                context += await ragService.getContextFromFiles(prompt, files);
                sendEvent({ type: 'status', message: 'File processing completed.' });
            }

            const conversationHistory = previousQueries.map(q => ([
                { role: 'user', content: q.prompt },
                { role: 'assistant', content: q.response }
            ])).flat();

            const augmentedPrompt = `${prompt}${context}`;
            const messages = [...conversationHistory, { role: 'user', content: augmentedPrompt }];

            sendEvent({ type: 'status', message: 'Generating AI response...' });

            let fullResponse = '';
            try {
                for await (const chunk of aiService.generateStreamingResponse(model, messages, systemPrompt)) {
                    fullResponse += chunk;
                    sendEvent({ type: 'content', content: chunk });
                }

                chat.updatedAt = Date.now();
                chat['model'] = model;
                chat.systemPrompt = systemPrompt;
                chat.webSearch = webSearch;
                chat = await chat.save();


                const chatQuery = new ChatQuery({
                    chatId: chat._id,
                    prompt: prompt,
                    model: model,
                    systemPrompt: systemPrompt,
                    webSearch: webSearch == "true" || webSearch == true,
                    response: fullResponse
                });
                await chatQuery.save();

                if(!chatId && user){// Create new Chat
                    user.chats.push(chat._id);
                    await user.save();
                }

                sendEvent({ type: 'complete', chatQuery, chat });

            } catch (aiError) {
                console.error('AI generation error:', aiError);
                sendEvent({ type: 'error', error: `I apologize, an error occurred with the AI service: ${aiError.message}` });
            }

            res.end();

        } catch (error) {
            console.error('Streaming handleChat error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'An internal server error occurred.' });
            } else {
                res.end();
            }
        }
    },
   
    getUserChats: async (req, res) => {
        try {
            const { clerkUserId } = req.params;
            const user = await User.findOne({ userId: clerkUserId });
            if (!user) {
                return res.status(404).json({error:`Specifed user with userid ${clerkUserId} could not be found.`});
            }
            const chats = await Chat.find({ _id: { $in: user.chats } }).sort({ updatedAt: -1 }).select('-__v');
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
            const chatQueries = await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 });
            res.status(200).json({...chat._doc, chatQueries});
        } catch (error) {
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },
    
    switchModel: async (req, res) => {
        try {
            const { clerkUserId, chatId, newModel, systemPrompt } = req.body;
            const chat = await Chat.findById(chatId);
            if (!chat) {
                return res.status(404).json({ error: 'Chat not found' });
            }
            const previousQueries = await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 });
            const lastQuery = previousQueries[previousQueries.length - 1];
            const oldModel = lastQuery ? lastQuery.model : 'no previous model';
            if (lastQuery && lastQuery.model === newModel) {
                return res.status(200).json({ message: 'Model is already set to ' + newModel, chat: chat });
            }
            let conversationSummary = 'Previous conversation context preserved.';
            if (previousQueries.length > 0) {
                try {
                    conversationSummary = await aiService.generateConversationSummary(previousQueries);
                } catch (summaryError) {
                    console.error('Summary generation error on model switch:', summaryError);
                }
            }
            const switchChatQuery = new ChatQuery({
                chatId: chat._id, prompt: `(System: Model switched from ${oldModel} to ${newModel})`,
                model: newModel, systemPrompt: systemPrompt,
                webSearch: false, response: conversationSummary
            });
            await switchChatQuery.save();
            chat.updatedAt = Date.now();
            await chat.save();
            res.status(200).json({ message: `Successfully switched from ${oldModel} to ${newModel}`, chat: chat });
        } catch (error) {
            console.error('Switch Model Error:', error);
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    getAvailableModels: async (req, res) => {
        try {
            res.status(200).json(models.default);
        } catch (error) {
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    deleteChat: async (req,res) => {
        const session = await mongoose.startSession();
        session.startTransaction(); 

        try {
            const { clerkUserId } = req.body;
            const { chatId } = req.params;

            if (!clerkUserId && !chatId || !mongoose.Types.ObjectId.isValid(chatId)){
                return res.status(400).json({ error: 'Missing valid Parameters' }); 
            }

            const chat = await Chat.findById(chatId);
            if (!chat) {
                return res.status(404).json({ error: 'Chat not found' });
            }

            const user = await User.findOne({userId:clerkUserId});
            if(!user || chat.userId.toString() != user._id.toString()){
                return res.status(401).json({ error: 'Unauthorised User' });
            }

            user.chats = user.chats.filter(chat => chat.id !== chatId);

            await ChatQuery.deleteMany({chatId:chatId});
            await chat.deleteOne();
            await user.save()

           await session.commitTransaction();

            return res.status(200).json({ message: 'Chat deleted' });

        } catch (error) {
           await session.abortTransaction();
            res.status(500).json({ error: 'An internal server error occurred.' });
        }finally{
           session.endSession();
        }
    }
};

module.exports = chatController;