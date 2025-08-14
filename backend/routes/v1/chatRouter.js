const express = require('express');
const chatController = require('../../controllers/chatController');
const router = express.Router();

//Middleware
const upload = require('../../services/multerService');
const clerkAuthMiddleware = require('../../middlewares/clerkAuthMiddleware')

router.post(['/stream','/:chatId/stream'], clerkAuthMiddleware(requireAuth=true) ,upload.array('files', 5), chatController.handleChatStreamCombined);
router.post(['/', '/:chatId'],clerkAuthMiddleware(requireAuth=true), upload.array('files', 5), chatController.handleChatCombined);

router.get('/models', chatController.getAvailableModels);
router.get('/user',clerkAuthMiddleware(requireAuth=true) , chatController.getUserChats);
router.get('/:chatId',clerkAuthMiddleware(requireAuth=true), chatController.getChatHistory);

router.delete('/:chatId',clerkAuthMiddleware(requireAuth=true),chatController.deleteChat);


module.exports = router;