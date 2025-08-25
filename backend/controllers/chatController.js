const Chat = require('../models/Chat');
const ChatQuery = require('../models/ChatQuery');
const ragService = require('../services/ragService');
const webSearchService = require('../services/webSearchService');
const aiService = require('../services/aiService');
const models = require('../data/models');
const { default: mongoose } = require('mongoose');
const { MAX_MESSAGE_SIZE } = require('../data/configs');

const chatController = {
    // --- NON-STREAMING METHOD ---
    handleChatCombined: async (req, res) => {
        try {
            const { prompt, model, systemPrompt, webSearch } = req.body;
            const user = req.user;
            const { chatId } = req.params;
            const files = req.files;

            if (!prompt || !model) return res.status(400).json({ error: 'Missing required fields' });

            let chat;

            if(chatId){
                // Truthy value of 'chatId' could be used to determine if chat already exist. 

                if (!mongoose.Types.ObjectId.isValid(chatId)) {
                    return res.status(400).json({ error: 'Invalid Chat Id' });
                }

                chat = await Chat.findById(chatId);
                if (!chat) return res.status(404).json({ error: 'Chat not found' });

            }else{
                //Handleing Chat Creation
                const chatName = await aiService.generateChatname(prompt);
                chat = new Chat({ userId: user._id, title: prompt.substring(0, 50), chatName: chatName ,  model, systemPrompt, webSearch });
            }

            const previousQueries = chatId ? await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 }) : [];
            const conversationHistory = previousQueries.map(q => {
                if(models.find(m => m.name == q.model || m.fullName == q.model)?.category == "Image Generation"){
                    return [{ role: 'user', content: q.prompt },{ role: 'assistant', content: "The Image was Generated" }]
                }
                return [{ role: 'user', content: q.prompt },{ role: 'assistant', content: q.response }]
            }).flat();
            
            let context = '';
            if (webSearch == "true" || webSearch == true) {
                context += await webSearchService.search([...conversationHistory, { role: 'user', content: prompt }]);
                user.usedWebSearch++;
            }
            if (files && files.length > 0) {
                context += await ragService.getContextFromFiles(prompt, files);
                user.usedFileRag++;
            }

            const augmentedPrompt = `${prompt}${context}`;
            let messages = [...conversationHistory, { role: 'user', content: augmentedPrompt }];

            //Generate Conversation history if messages is greater than MAX_MESSAGE_SIZE
            if (messages.length > MAX_MESSAGE_SIZE) {
                // first n - x messages
                const oldMessages = messages.slice(0, messages.length - MAX_MESSAGE_SIZE);

                // last x messages remain as they are
                const recentMessages = messages.slice(-MAX_MESSAGE_SIZE);

                // generate summary from old messages
                const summary = await aiService.generateConversationSummary(oldMessages);

                // rebuild messages with summary + recent
                messages = [
                    { role: "user", content: summary },
                    { role: "assistant", content: "summary noted." },
                    ...recentMessages
                ];
            }


            const assistantResponse = await aiService.generateResponse(model, messages, systemPrompt);
            if(models.find(m => m.name == model || m.fullName == model)?.category=="Image Generation"){
                user.usedImageGeneration++;
            }else{
                user.usedChatGeneration++;
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
                response: assistantResponse
            });
            await chatQuery.save();

            if(!chatId){// Create new Chat
                user.chats.push(chat._id);
            }

            await user.save();
            res.status(200).json({chatQuery:chatQuery, chat:chat});

        } catch (error) {
            console.error('Handle Chat Error:', error);
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    // --- STREAMING METHODS ---
    handleChatStreamCombined: async (req, res) => {
        try {
            const { prompt, model, systemPrompt, webSearch } = req.body;
            const user = req.user;
            const { chatId } = req.params;
            const files = req.files;

            if (!prompt || !model) return res.status(400).json({ error: 'Missing required fields' });
            
            let chat;

            res.writeHead(200, {
                'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
                'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*',
            });

            const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

            sendEvent({ type: 'status', message: 'Loading chat...' });

            if(chatId){
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

            }else{
                //Handleing Chat Creation
                const chatName = await aiService.generateChatname(prompt);
                chat = new Chat({ userId: user._id, title: prompt.substring(0, 50), chatName: chatName ,  model, systemPrompt, webSearch });
            }


            sendEvent({ type: 'metadata', chatId: chat._id, chatName: chat.chatName });
            
            sendEvent({ type: 'status', message: 'Loading conversation history...' });
            const previousQueries = await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 });

            const conversationHistory = previousQueries.map(q => {
                if(models.find(m => m.name == q.model)?.category == "Image Generation"){
                    return [{ role: 'user', content: q.prompt },{ role: 'assistant', content: "The Image was Generated" }]
                }
                return [{ role: 'user', content: q.prompt },{ role: 'assistant', content: q.response }]
            }).flat();
            

            let context = '';
            if (webSearch == "true" || webSearch == true) {
                sendEvent({ type: 'status', message: 'Searching the web...' });
                context += await webSearchService.search([...conversationHistory, { role: 'user', content: prompt }]);
                user.usedWebSearch++;
                sendEvent({ type: 'status', message: 'Web search completed.' });
            }

            if (files && files.length > 0) {
                sendEvent({ type: 'status', message: `Processing ${files.length} file(s)...` });
                context += await ragService.getContextFromFiles(prompt, files);
                user.usedFileRag++;
                sendEvent({ type: 'status', message: 'File processing completed.' });
            }

            const augmentedPrompt = `${prompt}${context}`;
            let messages = [...conversationHistory, { role: 'user', content: augmentedPrompt }];

            //Generate Conversation history if messages is greater than MAX_MESSAGE_SIZE
            if (messages.length > MAX_MESSAGE_SIZE) {
                // first n - x messages
                const oldMessages = messages.slice(0, messages.length - MAX_MESSAGE_SIZE);

                // last x messages remain as they are
                const recentMessages = messages.slice(-MAX_MESSAGE_SIZE);

                // generate summary from old messages
                const summary = await aiService.generateConversationSummary(oldMessages);

                // rebuild messages with summary + recent
                messages = [
                    { role: "user", content: summary },
                    { role: "assistant", content: "summary noted." },
                    ...recentMessages
                ];
            }

            sendEvent({ type: 'status', message: 'Generating AI response...' });

            let fullResponse = '';
            try {
                for await (const chunk of aiService.generateStreamingResponse(model, messages, systemPrompt)) {
                    fullResponse += chunk;
                    sendEvent({ type: 'content', content: chunk });
                }
                if(models.find(m => m.name == model || m.fullName == model)?.category=="Image Generation"){
                    user.usedImageGeneration++;
                }else{
                    user.usedChatGeneration++;
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

                if(!chatId){// Create new Chat
                    user.chats.push(chat._id);
                }
                await user.save();

                sendEvent({ type: 'complete', chatQuery, chat });

            } catch (aiError) {
                console.error('AI generation error:', aiError);
                sendEvent({ type: 'error', error: `I apologize, an error occurred with the AI service: ${aiError.message}` });
            }

            res.status(200).end();

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
            const user = req.user;
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
    
    // Will NOT work now because generateConversationSummary is changed!!!
    // switchModel: async (req, res) => {
    //     try {
    //         const { chatId, newModel, systemPrompt } = req.body;
    //         const chat = await Chat.findById(chatId);
    //         if (!chat) {
    //             return res.status(404).json({ error: 'Chat not found' });
    //         }
    //         const previousQueries = await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 });
    //         const lastQuery = previousQueries[previousQueries.length - 1];
    //         const oldModel = lastQuery ? lastQuery.model : 'no previous model';
    //         if (lastQuery && lastQuery.model === newModel) {
    //             return res.status(200).json({ message: 'Model is already set to ' + newModel, chat: chat });
    //         }
    //         let conversationSummary = 'Previous conversation context preserved.';
    //         if (previousQueries.length > 0) {
    //             try {
    //                 conversationSummary = await aiService.generateConversationSummary(previousQueries);
    //             } catch (summaryError) {
    //                 console.error('Summary generation error on model switch:', summaryError);
    //             }
    //         }
    //         const switchChatQuery = new ChatQuery({
    //             chatId: chat._id, prompt: `(System: Model switched from ${oldModel} to ${newModel})`,
    //             model: newModel, systemPrompt: systemPrompt,
    //             webSearch: false, response: conversationSummary
    //         });
    //         await switchChatQuery.save();
    //         chat.updatedAt = Date.now();
    //         await chat.save();
    //         res.status(200).json({ message: `Successfully switched from ${oldModel} to ${newModel}`, chat: chat });
    //     } catch (error) {
    //         console.error('Switch Model Error:', error);
    //         res.status(500).json({ error: 'An internal server error occurred.' });
    //     }
    // },

    getAvailableModels: async (req, res) => {
        try {
            res.status(200).json(models);
        } catch (error) {
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    deleteChat: async (req,res) => {
        const session = await mongoose.startSession();
        session.startTransaction(); 

        try {
            const user = req.user;
            const { chatId } = req.params;

            if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)){
                return res.status(400).json({ error: 'Missing valid Parameters' }); 
            }

            const chat = await Chat.findById(chatId);
            if (!chat) {
                return res.status(404).json({ error: 'Chat not found' });
            }

            if(chat.userId.toString() != user._id.toString()){
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
           console.log(error)
            res.status(500).json({ error: 'An internal server error occurred.' });
        }finally{
           session.endSession();
        }
    }
};

module.exports = chatController;