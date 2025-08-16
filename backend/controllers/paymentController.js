const Product = require('../models/Product');
const User = require('../models/User');
const polar = require('../services/polarService');
const { clerkClient } = require('@clerk/express');

const paymentController = {

    handleCheckout: async (req,res) => {
        try {
            const { productId } = req.params
            const { source, callback } = req.query;
            const userId = req.userId;
            
            const clerkUser = await clerkClient.users.getUser(userId);

            if(!productId || !userId || !source){
                return res.status(400).json({error:"Missing Required Params"})
            }

            let customer;

            try {
                customer = await polar.customers.getExternal({externalId:userId});
            } catch (err) {
                customer = await polar.customers.create({
                    email: clerkUser.emailAddresses[0].emailAddress,
                    externalId:userId,
                    name:clerkUser.fullName,
                });
            }

            const checkout = await polar.checkouts.create({
                products: [productId],
                successUrl: `${callback}?checkout_id={CHECKOUT_ID}`,
                customerId:customer.id,
                customerEmail:customer.email,
                customerName:customer.name,
                externalCustomerId:customer.externalId,
                customerBillingAddress:{country:"IN"},
                metadata:{
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
        console.error("NOT IMPLEMENTED") //TODO:
        const session = await polar.customerSessions.create({
            customerId: "cus_123" // Polar customer ID
        });
        res.json({ url: session.url });
    },

    webhook : {

        handleOrderPaid: async (req,res) => {  
            const data = req.event.data;
            await User.updateOne({_id:data.customer.externalId} , {productId:data.product.id});
            res.status(200);
        },

        handleProductUpdated: async (req,res) => {
            const _product = req.event.data;
            await Product.updateOne({_id:_product.id},{..._product},{upsert:true});
            res.status(200);
        },

        handleDefault: async (req,res) => {
            const event = req.event;
            console.log(event.type);
            res.status(200);
        },

    }

}


module.exports = paymentController;