const polar = require('../services/polarService');
const {} = require("@polar-sh/express")
const { validateEvent ,WebhookVerificationError } = require('@polar-sh/sdk/webhooks');
const User = require('../models/User');

const paymentController = {

    handleCheckout: async (req,res) => {
        try {
            const { productId } = req.params
            const { userId, plan, source, callback } = req.query;
            if(!productId || !userId || !plan || !source){
                return res.status(400).json({error:"Missing Required Params"})
            }

            const checkout = await polar.checkouts.create({
                products: [productId],
                successUrl: `${callback}?checkout_id={CHECKOUT_ID}`,
                metadata: {
                    userId: userId,
                    planType: plan,
                    source: source
                }
            });

            res.json({ url: checkout.url });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Checkout creation failed" });
        }
    },

    webhook: async (req, res) => {
        try{
            const event = validateEvent(
                req.body,
                req.headers,
                process.env.POLAR_WEBHOOK_SECRET_DEV
            );
            
            switch (event.type) {
                case "order.paid":
                    console.log(event)
                    break;
            
                default:
                    console.log(event.type)
                    break;
            }

            res.sendStatus(200)
            
        }catch(error){
            if (error instanceof WebhookVerificationError) {
                res.status(403).send('BAD WEBHOOK SECRET');
            }else{
                res.status(400).json(error);
            }
        }
    },

    customerPortal: async (req, res) => {
        const session = await polar.customerSessions.create({
            customerId: "cus_123" // Polar customer ID
        });
        res.json({ url: session.url });
    }

}

module.exports = paymentController;