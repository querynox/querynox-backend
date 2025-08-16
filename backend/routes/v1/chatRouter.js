const express = require('express');
const chatController = require('../../controllers/chatController');
const router = express.Router();

//Middleware
const upload = require('../../services/multerService');
const clerkAuthMiddleware = require('../../middlewares/clerkAuthMiddleware')
const userLimitMiddleware = require('../../middlewares/userLimitMiddleware')

router.post(['/stream','/:chatId/stream'], clerkAuthMiddleware(requestUser = true),upload.array('files', 10),userLimitMiddleware(), chatController.handleChatStreamCombined);
router.post(['/', '/:chatId'],clerkAuthMiddleware(requestUser = true), upload.array('files', 10), userLimitMiddleware(),chatController.handleChatCombined);

router.get('/models', chatController.getAvailableModels);
router.get('/user',clerkAuthMiddleware(requestUser = true), chatController.getUserChats);
router.get('/:chatId',clerkAuthMiddleware(), chatController.getChatHistory);

router.delete('/:chatId',clerkAuthMiddleware(requestUser = true),chatController.deleteChat);


module.exports = router;