const express = require('express');
const router = express.Router();

const chatRouter = require('./chatRouter')
const paymentsRouter = require('./paymentRouter')

router.use('/chat',chatRouter)
router.use('/payments',paymentsRouter)

module.exports = router;