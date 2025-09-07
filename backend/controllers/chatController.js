const Chat = require('../models/Chat');
const ChatQuery = require('../models/ChatQuery');
const ragService = require('../services/ragService');
const webSearchService = require('../services/webSearchService');
const aiService = require('../services/aiService');
const models = require('../data/models');
const { default: mongoose } = require('mongoose');
const { MAX_MESSAGE_SIZE } = require('../data/configs');
const logger = require('../configs/loggerConfig');
const axios = require('axios');
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const r2client = require('../configs/R2Client');

const chatController = {
    // --- PUBLIC: Get shared chat (read-only) ---
    getPublicSharedChat: async (req, res) => {
        try {
            const { chatId } = req.params;

            if (!mongoose.Types.ObjectId.isValid(chatId)) {
                return res.status(404).json({ error: 'Chat not found or not shared' });
            }

            const chat = await Chat.findOne({ _id: chatId, isShared: true })
                .select('_id title')
                .lean();

            if (!chat) {
                return res.status(404).json({ error: 'Chat not found or not shared' });
            }

            const chatQueries = await ChatQuery.find({ chatId: chat._id })
                .sort({ createdAt: 1 })
                .select('_id chatId model prompt response createdAt updatedAt meta')
                .lean();

            const safeChat = {
                _id: chat._id,
                title: chat.title,
                chatQueries: (chatQueries || []).map(q => ({
                    _id: q._id,
                    chatId: q.chatId,
                    model: q.model,
                    prompt: q.prompt,
                    response: q.response,
                    error: null,
                    createdAt: q.createdAt,
                    updatedAt: q.updatedAt,
                    meta:q.meta
                }))
            };

            return res.status(200).json(safeChat);
        } catch (error) {
            logger.error(error)
            return res.status(500).json({ error: error.message || 'Internal server error' });
        }
    },
    // --- AUTH: Toggle share ---
    toggleShare: async (req, res) => {
        try {
            const user = req.user;
            const { chatId } = req.params;
            const { isShared } = req.body || {};

            if (!mongoose.Types.ObjectId.isValid(chatId)) {
                return res.status(400).json({ error: 'Invalid Chat Id' });
            }

            const chat = await Chat.findById(chatId);
            if (!chat) return res.status(404).json({ error: 'Chat not found' });
            if (chat.userId.toString() !== user._id.toString()) {
                return res.status(401).json({ error: 'Unauthorised User' });
            }

            chat.isShared = !!isShared;
            chat.updatedAt = Date.now();
            await chat.save();

            return res.status(200).json({ _id: chat._id, isShared: chat.isShared });
        } catch (error) {
            logger.error(error)
            return res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },
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


            const {content, ...rest} = await aiService.generateResponse(model, messages, systemPrompt, user);
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
                response: content,
                meta:rest
            });
            await chatQuery.save();

            if(!chatId){// Create new Chat
                user.chats.push(chat._id);
            }

            user.updatedAt = Date.now();
            await user.save();
            res.status(200).json({chatQuery:chatQuery, chat:chat});

        } catch (error) {
            logger.error('Handle Chat Error:', error);
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

            const sendEvent = (data) => {
                res.write(`data: ${JSON.stringify(data)}\n\n`)
                if (res.flush) res.flush()
            };

            sendEvent({ type: 'status', message: 'Loading chat...', chatId: chatId || "" });
            if(chatId){
                // Truthy value of 'chatId' could be used to determine if chat already exist. 

                if (!mongoose.Types.ObjectId.isValid(chatId)) {
                    sendEvent({ type: 'error', error: 'Invalid Chat Id', chatId: chatId });
                    res.write(`data: [DONE]\n\n`);
                    return res.end();
                }

                chat = await Chat.findById(chatId);
                if (!chat){
                    sendEvent({ type: 'error', error: 'Chat not found', chatId: chatId });
                    res.write(`data: [DONE]\n\n`);
                    return res.end();
                }

            }else{
                //Handleing Chat Creation
                const chatName = await aiService.generateChatname(prompt);
                chat = new Chat({ userId: user._id, title: prompt.substring(0, 50), chatName: chatName ,  model, systemPrompt, webSearch });
            }

            sendEvent({ type: 'metadata', chatId: chat._id, chatName: chat.chatName });
            
            sendEvent({ type: 'status', message: 'Loading conversation history...' , chatId: chat._id});
            const previousQueries = await ChatQuery.find({ chatId: chat._id }).sort({ createdAt: 1 });

            const conversationHistory = previousQueries.map(q => {
                if(models.find(m => m.name == q.model || m.fullName == q.model)?.category == "Image Generation"){
                    return [{ role: 'user', content: q.prompt },{ role: 'assistant', content: "The Image was Generated" }]
                }
                return [{ role: 'user', content: q.prompt },{ role: 'assistant', content: q.response }]
            }).flat();
            

            let context = '';
            if (webSearch == "true" || webSearch == true) {
                sendEvent({ type: 'status', message: 'Searching the web...', chatId: chat._id });
                context += await webSearchService.search([...conversationHistory, { role: 'user', content: prompt }]);
                user.usedWebSearch++;
                sendEvent({ type: 'status', message: 'Web search completed.', chatId: chat._id });
            }

            if (files && files.length > 0) {
                sendEvent({ type: 'status', message: `Processing ${files.length} file(s)...`, chatId: chat._id });
                context += await ragService.getContextFromFiles(prompt, files);
                user.usedFileRag++;
                sendEvent({ type: 'status', message: 'File processing completed.', chatId: chat._id });
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

            sendEvent({ type: 'status', message: 'Generating AI response...', chatId: chat._id });

            let fullResponse = {content:""};
            try {
                for await (const chunk of aiService.generateStreamingResponse(model, messages, systemPrompt,user)) {
                    const {content, ...rest} = chunk;
                    fullResponse = {...rest,content:fullResponse.content + chunk.content}
                    sendEvent({ type: 'content', content: chunk.content, chatId: chat._id });
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

                const {content,...rest} = fullResponse
                const chatQuery = new ChatQuery({
                    chatId: chat._id,
                    prompt: prompt,
                    model: model,
                    systemPrompt: systemPrompt,
                    webSearch: webSearch == "true" || webSearch == true,
                    response: content,
                    meta:rest
                });
                await chatQuery.save();
                if(!chatId){// Create new Chat
                    user.chats.push(chat._id);
                }
                user.updatedAt = Date.now();
                await user.save();
                sendEvent({ type: 'complete', chatQuery, chat  });

            } catch (aiError) {
                logger.error('AI generation error:', aiError);
                sendEvent({ type: 'error', error: `I apologize, an error occurred with the AI service: ${aiError.message}` , chatId: chat._id });
            }

            res.end();

        } catch (error) {
            logger.error('Streaming handleChat error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: error.message || 'An internal server error occurred.' });
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
            logger.error(error)
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    getChatHistory: async (req, res) => {
        try {
            const { chatId } = req.params;
            const { limit = 50, offset = 0 } = req.query; // Add limit and offset parameters
            const chat = await Chat.findById(chatId);
            if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
            }
            const chatQueries = await ChatQuery.find({ chatId: chat._id })
            .sort({ createdAt: 1 })
            .skip(offset) // Add skip for pagination 
            .limit(limit); // Add limit for pagination
            res.status(200).json({ ...chat._doc, chatQueries });
        } catch (error) {
            logger.error(error)
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    getAvailableModels: async (req, res) => {
        try {
            res.status(200).json(models);
        } catch (error) {
            logger.error(error)
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    deleteChat: async (req,res) => {

        try {
            const user = req.user;
            const { chatId } = req.params;

            if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)){
                return res.status(400).json({ error: 'Missing valid Parameters' }); 
            }

            const chat = await Chat.findById(chatId)
            if (!chat) {
                return res.status(404).json({ error: 'Chat not found' });
            }

            if(chat.userId.toString() != user._id.toString()){
                return res.status(401).json({ error: 'Unauthorised User' });
            }

            user.chats = user.chats.filter(c => c.toString() !== chatId.toString());

            const chatQueries = await ChatQuery.find({chatId:chatId},{meta:true})
            const deleteCommands = chatQueries
                .filter(cq => cq.meta.get('key'))
                .map(cq =>{
                    const key = cq.meta.get('key');
                    console.log("Deleting:", key);
                    return r2client.send(new DeleteObjectCommand({
                        Bucket: process.env.R2_BUCKET,
                        Key: key,
                    }))
                }); 

            await Promise.all(deleteCommands);

            await ChatQuery.deleteMany({chatId:chatId});
            await chat.deleteOne();
            await user.save()

            return res.status(200).json({ message: 'Chat deleted' });

        } catch (error) {
            logger.error(error)
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    },

    downloadImage: async(req,res) => {
        try{
            const fileUrl = `${process.env.PUBLIC_BUCKET_URL}/${decodeURIComponent(req.params.key)}`;
            const response = await axios.get(fileUrl, { responseType: "stream" });

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="image.png"`
            );
            res.setHeader(
                "Content-Type",
                response.headers["content-type"] || "application/octet-stream"
            );

            response.data.pipe(res);
        }catch(e){
            logger.error(e.message);
            if(e.status == 404){
                res.status(404).send("File Not Found");
            }else{
                res.status(500).send("Error fetching file");
            }
        }

    }
};

module.exports = chatController;