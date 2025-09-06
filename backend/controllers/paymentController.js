const Product = require('../models/Product');
const User = require('../models/User');
const polar = require('../configs/polarConfig');
const { clerkClient } = require('@clerk/express');
const logger = require('../configs/loggerConfig');

const paymentController = {

    handleCheckout: async (req,res) => {
        try {
            const { productId } = req.params
            const { callback , ...metadata } = req.query;
            const userId = req.userId;

            const clerkUser = await clerkClient.users.getUser(userId);

            if(!productId || !userId){
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
                externalCustomerId:userId,
                customerBillingAddress:{country:"IN"},
                metadata:{
                    ...metadata,
                    externalCustomerId:customer.externalId,
                }
            });

            res.json({ url: checkout.url });

        } catch (err) {
            logger.error(err);
            res.status(500).json({ error: "Checkout creation failed" });
        }
    },

    listWebhookEndpoints: async (req,res) => {
        try {
            
            const endpoints = await polar.webhooks.listWebhookEndpoints({})
            res.json({ success: true, endpoints : endpoints.result.items});
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: "Webhook resend failed." });
        }
    },

    replayWebhook: async (req, res) => {
        try {
            const { webhookEndpointId } = req.body;
            const { event } = req.params;
            const { limit ,after,succeeded,retry} = req.query;

            const _createdAfter = after == undefined ? 0 : Number(after);
            const _succeeded = succeeded == undefined ? undefined : succeeded == "true" ;
            const _retry = retry == undefined ? false : retry == "true" ;

            const deliveries = await polar.webhooks.listWebhookDeliveries({ endpointId:webhookEndpointId , limit:Number(limit) || 100});


           const totalDeliveries = []

            for (let delivery of deliveries.result.items) {

                const match = delivery.webhookEvent.payload.match(/"type"\s*:\s*"([^"]+)"/);
                const eventType = match ? String(match[1]) : "";

                if (
                    eventType.startsWith(event) && 
                    delivery.createdAt.getTime() > _createdAfter  && 
                    (_succeeded != undefined ? delivery.succeeded == _succeeded : true) 
                ){
                    if(_retry)
                    await polar.webhooks.redeliverWebhookEvent({ id: delivery.webhookEvent.id })

                    delete delivery.webhookEvent.payload;
                    delivery.eventType = eventType
                    totalDeliveries.push(delivery)
                }
            }

            res.json({ success: true, deliveries: totalDeliveries });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: err  });
        }
    },

    customerPortal: async (req, res) => {
        try{
            const userId = req.userId;
            const clerkUser = await clerkClient.users.getUser(userId);
            let session;
            try {
                session = await polar.customerSessions.create({
                    externalCustomerId: userId // Polar customer ID
                });
            } catch (err) {
                customer = await polar.customers.create({
                    email: clerkUser.emailAddresses[0].emailAddress,
                    externalId:userId,
                    name:clerkUser.fullName,
                });
                session = await polar.customerSessions.create({
                    externalCustomerId: userId // Polar customer ID
                });
            }
            res.json({ url: session.customerPortalUrl });

        }catch(error){
            res.status(500).json({ error: error.message});
        }
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
            return res.status(400).json({"status":"invalid"});
        }  
    },

    webhook : {

        handleSubscriptionActive: async (req,res) => {  
            logger.debug(req.event.type);
            const data = req.event.data;
            await User.updateOne({_id:data.customer.externalId} , {productId:data.product.id},{upsert:true});
            res.status(200).end();
        },

        handleProductUpdated: async (req,res) => {
            logger.debug(req.event.type);
            const _product = req.event.data;
            await Product.updateOne({_id:_product.id},{..._product},{upsert:true});
            res.status(200).end();
        },

        handleSubscriptionRevoked: async(req,res) => {
            logger.debug(req.event.type);
            const data = req.event.data;
            await User.updateOne({_id:data.metadata.externalCustomerId} , {productId:null}); //Used data.metadata.externalCustomerId because data.customer.externalId is always 'null'.
            res.status(200).end();
        },

        handleDefault: async (req,res) => {
            const event = req.event;
            logger.debug(event.type);
            res.status(200).end();
        },

    }

}


module.exports = paymentController;