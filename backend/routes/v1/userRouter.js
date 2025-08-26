const express = require('express');
const router = express.Router();

const clerkAuthMiddleware = require('../../middlewares/clerkAuthMiddleware')

const chatController = require('../../controllers/userController')

router.get('/', clerkAuthMiddleware(requestUser = true, upInsert = false),chatController.getUserInfo);

// List bookmarked chats for the authenticated user
router.get('/bookmarked-chats', clerkAuthMiddleware(requestUser = true, upInsert = false), chatController.listBookmarkedChats);

module.exports = router;