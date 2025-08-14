const polar = require('../services/polarService');
const { clerkClient } = require('@clerk/express');

const paymentController = {

    handleCheckout: async (req,res) => {
        try {
            const { productId } = req.params
            const { source, callback } = req.query;
            const { userId } = req.auth;
            
            const clerkUser = await clerkClient.users.getUser(userId);

            if(!productId || !userId || !source){
                return res.status(400).json({error:"Missing Required Params"})
            }

            const checkout = await polar.checkouts.create({
                products: [productId],
                successUrl: `${callback}?checkout_id={CHECKOUT_ID}`,
                customerEmail:clerkUser.emailAddresses[0].emailAddress,
                externalCustomerId:userId,//TODO: create a UUID for polar in user and send that UUID as customerId to polar to prervent edit of email on payment page.
                metadata: {
                    source: source,
                    clerkUserId: userId 
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
            console.log(event);
            console.log(event.metadata.clerkUserId);
            res.status(200);
        },

        handleSubscriptionActive: async (req,res,event) => {
            console.log(event.type)
            res.status(200);
        },

        handleDefault: async (req,res,event) => {
            console.log(event.type);
            res.status(200);
        },

    }

}


module.exports = paymentController;