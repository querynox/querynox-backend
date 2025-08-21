require('dotenv').config();

const { getAuth } = require('@clerk/express');
const User = require('../models/User')

const clerkAuthMiddleware = (requestUser = false, upInsert = true) => {
  return async (req, res, next) => {
    let userId = getAuth(req).userId;

    if(!userId && process.env.NODE_ENV=="development"){
      userId = req.query.userId;
    }

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });

    }else if (requestUser){
      let _user = await User.findById(userId);

      if(!_user && upInsert){
        _user = new User({ _id: userId});
      }
      req.user = _user;        
    }

    req.userId = userId;

    next();
  }; 
};

module.exports = clerkAuthMiddleware;
 