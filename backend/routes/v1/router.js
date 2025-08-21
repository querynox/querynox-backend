const express = require('express');
const router = express.Router();

const chatRouter = require('./chatRouter')
const paymentsRouter = require('./paymentRouter')
const userRouter = require('./userRouter');

router.use('/chat',chatRouter)
router.use('/payments',paymentsRouter)
router.use('/user',userRouter)

module.exports = router;