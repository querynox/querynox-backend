const express = require('express');
const router = express.Router();

const chatRouter = require('./chatRouter')
const paymentsRouter = require('./paymentRouter')
const userRouter = require('./userRouter');
const publicRouter = require('./sharePublicRouter');

router.use('/chat',chatRouter)
router.use('/payments',paymentsRouter)
router.use('/user',userRouter)
router.use('/public', publicRouter)

module.exports = router;