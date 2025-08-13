const express = require('express');
const paymentController = require('../../controllers/paymentController');
const { validateEvent ,WebhookVerificationError } = require('@polar-sh/sdk/webhooks');
const router = express.Router();


router.get('/checkout/:productId',paymentController.handleCheckout);


router.post('/customerPortal',paymentController.customerPortal)

router.post('/webhook',async (req, res) => {
    try{
        const event = validateEvent(req.body,req.headers,process.env.POLAR_WEBHOOK_SECRET_DEV);
        
        switch (event.type) {
            case "order.paid":
                await paymentController.webhook.handleOrderPaid(req, res, event);
                break;
        
            default:
                await paymentController.webhook.handleDefault(req, res, event);
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