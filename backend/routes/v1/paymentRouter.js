const express = require('express');
const paymentController = require('../../controllers/paymentController');
const { validateEvent ,WebhookVerificationError } = require('@polar-sh/sdk/webhooks');
const clerkAuthMiddleware = require('../../middlewares/clerkAuthMiddleware');
const logger = require('../../configs/loggerConfig');
const { basicAuth } = require('../../middlewares/basicAuthMiddleware');
const router = express.Router();


router.get('/checkout/:productId',clerkAuthMiddleware(), paymentController.handleCheckout);
router.get('/status/:checkoutId', paymentController.validateCheckout);
router.get('/portal',clerkAuthMiddleware(),paymentController.customerPortal);
router.get("/list-webhooks",basicAuth({username:process.env.USERNAME,password:process.env.PASSWORD}),paymentController.listWebhookEndpoints)

router.post('/replay-event/:event',basicAuth({username:process.env.USERNAME,password:process.env.PASSWORD}),paymentController.replayWebhook);


router.post('/webhook',async (req, res) => {
    try{
        const event = validateEvent(req.body,req.headers,process.env.POLAR_WEBHOOK_SECRET);
        req.event = event;
        switch (event.type) {
            case "subscription.active":
                await paymentController.webhook.handleSubscriptionActive(req, res);
                break;
            case "product.updated":
                await paymentController.webhook.handleProductUpdated(req, res);
                break;
            case "subscription.revoked":
                await paymentController.webhook.handleSubscriptionRevoked(req,res);
                break;
            default:
                await paymentController.webhook.handleDefault(req, res);
                break;
        }
    }catch(error){
        if (error instanceof WebhookVerificationError) {
            res.status(403).send('BAD WEBHOOK SECRET');
        }else{
            logger.error(error)
            res.status(400).json(error);
        }
    }
},)

module.exports = router;