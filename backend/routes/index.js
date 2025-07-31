const express = require('express');
const multer = require('multer');
const chatController = require('../controllers/chatController');

const router = express.Router();

// Debug middleware for routes (remove logging)
router.use((req, res, next) => {
  next();
});

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Multer setup for handling file uploads (PDFs & images) in memory
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Chat routes
router.post('/chat', upload.array('files', 5), chatController.createChat); // New chat
router.post('/chat/:chatId', upload.array('files', 5), chatController.handleChat); // Continue existing chat
router.get('/chats/user/:clerkUserId', chatController.getUserChats);
router.get('/chat/:chatId', chatController.getChatHistory);

// Model switching routes
router.post('/chat/switch-model', chatController.switchModel);
router.get('/models', chatController.getAvailableModels);

module.exports = router; 