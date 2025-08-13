const express = require('express');
const multer = require('multer');
const chatController = require('../../controllers/chatController');
const router = express.Router();

// Multer setup for handling file uploads (PDFs & images) in memory
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});


router.post(['/stream','/:chatId/stream'], upload.array('files', 5), chatController.handleChatStreamCombined);
router.post(['/', '/:chatId'], upload.array('files', 5), chatController.handleChatCombined);


router.get('/user/:clerkUserId', chatController.getUserChats);
router.get('/models', chatController.getAvailableModels);
router.get('/:chatId', chatController.getChatHistory);

router.delete('/:chatId',chatController.deleteChat);


module.exports = router;