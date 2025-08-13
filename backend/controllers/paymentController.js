const polar = require('../services/polarService');

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

    customerPortal: async (req, res) => {
        const session = await polar.customerSessions.create({
            customerId: "cus_123" // Polar customer ID
        });
        res.json({ url: session.url });
    },

    webhook : {

        handleOrderPaid: async (req,res,event) => {
            
            console.log(event.type);
            res.status(200);

        },

        handleDefault: async (req,res,event) => {

            console.log(event.type);
            res.status(200);

        },

    }

}


module.exports = paymentController;