const express = require('express');
const paymentController = require('../../controllers/paymentController');
const router = express.Router();


router.get('/checkout/:productId',paymentController.handleCheckout);


router.post('/webhook',paymentController.webhook)
router.post('/customerPortal',paymentController.customerPortal)


module.exports = router;