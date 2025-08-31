const Product = require('../models/Product');
const Chat = require('../models/Chat');
const polar = require('../configs/polarConfig');
const User = require('../models/User')

const userController = {
    getUserInfo: async (req, res) => {
        try {
            const user = req.user;
            
            // Use when need to manually update user payment status when server was not online
            // try {
            // // 1. Fetch Polar customer by externalId
            //     const customer = await polar.customers.getExternal({ externalId: req.userId});

            //     // 2. If customer exists and has subscriptions, find active product
            //     if (customer && customer.subscriptions && customer.subscriptions.length > 0) {
            //         const activeSub = customer.subscriptions.find(s => s.status === "active");
            //         if (activeSub) {
            //             updatedProductId = activeSub.product.id;

            //             // 3. Update user in MongoDB if productId changed
            //             if (updatedProductId && updatedProductId !== productId) {
            //                 await User.updateOne(
            //                     { _id: user.id },
            //                     { productId: updatedProductId }
            //                 );
            //             }

            //             userDTO.isPro = true;
            //         }
            //     }
            // } catch (err) {// If customer not found.
            //     await User.updateOne(
            //         { _id: user.id },
            //         { productId: null }
            //     );
            // }
 
            const userDTO = {...user.toObject() , isPro:!!user.productId } 

            if (user.productId){
                userDTO.product = await Product.findById(user.productId)
            }

            return res.status(200).json({user:userDTO});

        } catch (error) {
            res.status(500).json({ error: error.message || String(error) });
        }
    },

    toggleBookmark: async (req, res) => {
        try {
            const user = req.user;
            const { chatId } = req.params;
            const { bookmarked } = req.body || {};

            if (!chatId) return res.status(400).json({ error: 'Missing chatId' });

            const exists = await Chat.findById(chatId).select('_id');
            if (!exists) return res.status(404).json({ error: 'Chat not found' });

            const already = user.bookmarkedChats?.some(id => id.toString() === chatId);
            if (bookmarked === true && !already) {
                user.bookmarkedChats.push(chatId);
            } else if (bookmarked === false && already) {
                user.bookmarkedChats = user.bookmarkedChats.filter(id => id.toString() !== chatId);
            }
            await user.save();
            return res.status(200).json({ bookmarked: user.bookmarkedChats.some(id => id.toString() === chatId) });
        } catch (error) {
            res.status(500).json({ error: error.message || String(error) });
        }
    },

    listBookmarkedChats: async (req, res) => {
        try {
            const user = req.user;
            const chats = await Chat.find({ _id: { $in: user.bookmarkedChats || [] } })
                .sort({ updatedAt: -1 })
                .select('_id title updatedAt createdAt');
            return res.status(200).json({ chats });
        } catch (error) {
            res.status(500).json({ error: error.message || String(error) });
        }
    }
}

module.exports = userController;
