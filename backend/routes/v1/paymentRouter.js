const express = require('express');
const paymentController = require('../../controllers/paymentController');
const { validateEvent ,WebhookVerificationError } = require('@polar-sh/sdk/webhooks');
const clerkAuthMiddleware = require('../../middlewares/clerkAuthMiddleware');
const router = express.Router();


router.get('/checkout/:productId',clerkAuthMiddleware(), paymentController.handleCheckout);
router.get('/status/:checkoutId', paymentController.validateCheckout);

router.post('/customerPortal',paymentController.customerPortal);

router.post('/webhook',async (req, res) => {
    try{
        const event = validateEvent(req.body,req.headers,process.env.POLAR_WEBHOOK_SECRET_DEV);
        req.event = event;
        switch (event.type) {
            case "order.paid":
                await paymentController.webhook.handleOrderPaid(req, res);
                break;
            case "product.updated":
                await paymentController.webhook.handleProductUpdated(req, res);
                break;
            default:
                await paymentController.webhook.handleDefault(req, res);
                break;
        }
    }catch(error){
        if (error instanceof WebhookVerificationError) {
            res.status(403).send('BAD WEBHOOK SECRET');
        }else{
            res.status(400).json(error);
        }
    }
},)

module.exports = router;