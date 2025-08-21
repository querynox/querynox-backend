const Product = require('../models/Product');

const userController = {
    getUserInfo: async (req, res) => {
        try {
            const { productId, ...user } = req.user.toObject ? req.user.toObject() : req.user;
            const userDTO = {...user, isPro:!!productId } 
 
            if (productId){
                userDTO.product = await Product.findById(productId)
            }

            return res.status(200).json({user:userDTO});

        } catch (error) {
            res.status(500).json({ error: error.message || String(error) });
        }
    }
}

module.exports = userController;
