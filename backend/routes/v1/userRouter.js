const express = require('express');
const router = express.Router();

const clerkAuthMiddleware = require('../../middlewares/clerkAuthMiddleware')

const chatController = require('../../controllers/userController')

router.get('/', clerkAuthMiddleware(requestUser = true, upInsert = false),chatController.getUserInfo);

module.exports = router;