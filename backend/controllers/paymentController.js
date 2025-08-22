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

    validateCheckout: async (req, res) => {
        try{
            const { checkoutId } = req.params;
            const checkout = await polar.checkouts.get({ id: checkoutId });

            return res.status(200).json({
                id: checkout.id,
                status: checkout.status,
                customer: {
                    id: checkout.customerId,
                    email: checkout.customerEmail,
                    name: checkout.customerName,
                    clerkUserId: checkout.externalCustomerId,
                },
                product: {
                    id: checkout.product?.id,
                    name: checkout.product?.name,
                    description: checkout.product?.description,
                    recurringInterval: checkout.product?.recurringInterval,
                    isRecurring: checkout.product?.isRecurring,
                    isArchived:checkout.product?.isArchived,
                    organizationId:checkout.product?.organizationId,
                    modifiedAt:checkout.product?.modifiedAt,
                    createdAt:checkout.product?.createdAt
                },
                orderId: checkout.orderId,
                createdAt: checkout.createdAt
            });

        } catch (err) {
            if (err.response?.status === 404) {
                return res.status(404).json({"status":"notfound"});
            }
        }  
    },

    webhook : {

        handleOrderPaid: async (req,res) => {  
            const data = req.event.data;
            const response = await User.updateOne({_id:data.customer.externalId} , {productId:data.product.id},{upsert:true});
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